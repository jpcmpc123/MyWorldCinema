import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ---------------------------------------------------------------------------
// PARTE 3 — Middleware /api/imdb (contorna CORS do IMDb no dev server)
// ---------------------------------------------------------------------------

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

interface SpecItem { label: string; value: string }
interface TriviaItem { text: string; spoiler: boolean }
interface ImdbPayload { specs: SpecItem[]; trivia: TriviaItem[] }

// Cache em memória: imdbId → { data, expiresAt } (TTL de 5 min)
const imdbCache = new Map<string, { data: ImdbPayload; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractNextData(html: string): any | null {
  const m = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

function textFromContent(content: any): string {
  if (content == null) return ''
  if (typeof content === 'string') return stripHtml(content)
  if (Array.isArray(content)) return content.map(textFromContent).filter(Boolean).join(', ')
  if (typeof content === 'object') {
    if (typeof content.value === 'string') return stripHtml(content.value)
    if (Array.isArray(content.value)) return textFromContent(content.value)
    if (typeof content.plainText === 'string') return content.plainText.trim()
    if (typeof content.html === 'string') return stripHtml(content.html)
  }
  return ''
}

/** Varredura generosa por especificações técnicas em __NEXT_DATA__ */
function findSpecsInNextData(root: any): SpecItem[] {
  const out: SpecItem[] = []
  const seen = new Set<string>()
  const visit = (node: any) => {
    if (!node || out.length >= 40) return
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (typeof node !== 'object') return

    // formato { label, text/value }
    const label =
      typeof node.label === 'string' ? node.label
        : typeof node.name === 'string' ? node.name : null
    const val = node.value ?? node.plainText ?? node.text
    if (label && val != null) {
      const value = textFromContent(val)
      if (value && !seen.has(label)) {
        seen.add(label)
        out.push({ label, value })
      }
    }
    for (const k of Object.keys(node)) visit(node[k])
  }
  visit(root)
  return out
}

/** Fallback: HTML da página /technical/ (listas de data-testid, dl/dt/dd, li) */
function specsFromHtml(html: string): SpecItem[] {
  const out: SpecItem[] = []
  const seen = new Set<string>()
  const push = (label: string, value: string) => {
    label = stripHtml(label)
    value = stripHtml(value)
    if (label && value && !seen.has(label)) {
      seen.add(label)
      out.push({ label, value })
    }
  }
  let m: RegExpExecArray | null
  const liRe =
    /<li[^>]*data-testid=["'][^"']*tech[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<(?:div|span)[^>]*>([\s\S]*?)<\/(?:div|span)>/gi
  while ((m = liRe.exec(html))) push(m[1], m[2])
  const dlRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi
  while ((m = dlRe.exec(html))) push(m[1], m[2])
  return out
}

/** Varredura genérica de itens de trivia em __NEXT_DATA__ */
function findTriviaInNextData(root: any): TriviaItem[] {
  const out: TriviaItem[] = []
  const visit = (node: any) => {
    if (!node || out.length >= 100) return
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (typeof node !== 'object') return

    // Formatos conhecidos: { text: { plainText }, isSpoiler }, { displayableArticle? } etc.
    const t = node.text ?? node.body ?? node.html
    const spoiler =
      typeof node.isSpoiler === 'boolean' ? node.isSpoiler
        : typeof node.spoiler === 'boolean' ? node.spoiler : false
    const text = textFromContent(t)
    if (text && text.length > 30 && (node.isSpoiler !== undefined || node.spoiler !== undefined)) {
      out.push({ text, spoiler })
      return
    }
    for (const k of Object.keys(node)) visit(node[k])
  }
  visit(root)
  return out
}

/** Fallback: HTML da página /trivia/ (data-testid*="trivia", itens de lista) */
function triviaFromHtml(html: string): TriviaItem[] {
  const out: TriviaItem[] = []
  let m: RegExpExecArray | null
  const testidRe =
    /<li[^>]*data-testid=["'][^"']*trivia[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi
  while ((m = testidRe.exec(html))) {
    const text = stripHtml(m[1])
    if (text.length > 15) {
      out.push({
        text,
        spoiler: /spoiler/i.test(m[1]),
      })
    }
  }
  if (out.length === 0) {
    const liRe = /<li[^>]*class=["'][^"']*ipc-html-content-inner-div[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi
    while ((m = liRe.exec(html))) {
      const text = stripHtml(m[1])
      if (text.length > 30) out.push({ text, spoiler: false })
    }
  }
  return out
}

async function fetchImdbPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`IMDb HTTP ${res.status}`)
  return res.text()
}

async function fetchImdbData(imdbId: string): Promise<ImdbPayload> {
  const cached = imdbCache.get(imdbId)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const [techHtml, triviaHtml] = await Promise.all([
    fetchImdbPage(`https://www.imdb.com/title/${imdbId}/technical/`),
    fetchImdbPage(`https://www.imdb.com/title/${imdbId}/trivia/`),
  ])

  // --- Specs ---
  let specs: SpecItem[] = []
  const techData = extractNextData(techHtml)
  if (techData) specs = findSpecsInNextData(techData)
  if (specs.length === 0) specs = specsFromHtml(techHtml)

  // --- Trivia ---
  let trivia: TriviaItem[] = []
  const triviaData = extractNextData(triviaHtml)
  if (triviaData) trivia = findTriviaInNextData(triviaData)
  if (trivia.length === 0) trivia = triviaFromHtml(triviaHtml)

  const data: ImdbPayload = { specs, trivia }
  imdbCache.set(imdbId, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  return data
}

function imdbApiPlugin() {
  return {
    name: 'imdb-api-middleware',
    configureServer(server: any) {
      server.middlewares.use('/api/imdb', async (req: any, res: any) => {
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const imdbId = url.searchParams.get('imdbId') ?? ''
          if (!/^tt\d{5,}$/.test(imdbId)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'imdbId inválido — esperado formato ttXXXXXXX' }))
            return
          }
          const data = await fetchImdbData(imdbId)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        } catch {
          // Frontend degrada silenciosamente
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ specs: [], trivia: [] }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.CAPACITOR === 'true'
    ? './'
    : (process.env.VITE_BASE_PATH || '/'),
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    imdbApiPlugin(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Supabase (pesado) fica em chunk próprio → cache separado
        manualChunks(id) {
          if (id.includes('@supabase')) return 'supabase';
        },
      },
    },
  },
})
