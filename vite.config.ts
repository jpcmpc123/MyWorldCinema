import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
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
  if (imdbCache.size >= 100) {
    const oldestKey = imdbCache.keys().next().value
    if (oldestKey) imdbCache.delete(oldestKey)
  }
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

function tmdbProxyDevPlugin(env: Record<string, string>) {
  return {
    name: 'tmdb-proxy-dev-middleware',
    configureServer(server: any) {
      server.middlewares.use('/api/tmdb', async (req: any, res: any) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const reqUrl = new URL(req.url ?? '/', 'http://localhost')
        const rawPath = reqUrl.pathname.replace(/^\/+/, '')
        const segments = rawPath.split('/').filter(Boolean)
        if (
          segments.length === 0 ||
          segments.some((seg) => seg === '.' || seg === '..' || !/^[A-Za-z0-9_.-]+$/.test(seg))
        ) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Invalid TMDB endpoint path' }))
          return
        }

        const token = (env.TMDB_ACCESS_TOKEN || env.VITE_TMDB_ACCESS_TOKEN || '').trim()
        const apiKey = (env.TMDB_API_KEY || env.VITE_TMDB_API_KEY || '').trim()
        if (!token && !apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'TMDB_ACCESS_TOKEN / TMDB_API_KEY não configurados no .env' }))
          return
        }

        const targetUrl = new URL(`https://api.themoviedb.org/3/${segments.join('/')}`)
        reqUrl.searchParams.forEach((value, key) => {
          if (key.toLowerCase() === 'api_key') return
          targetUrl.searchParams.append(key, value)
        })

        const headers: Record<string, string> = { Accept: 'application/json' }
        if (token) {
          headers.Authorization = `Bearer ${token}`
        } else {
          targetUrl.searchParams.set('api_key', apiKey)
        }

        try {
          const upstream = await fetch(targetUrl.toString(), { method: req.method, headers })
          res.statusCode = upstream.status
          res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'application/json; charset=utf-8')
          const retryAfter = upstream.headers.get('Retry-After')
          if (retryAfter) res.setHeader('Retry-After', retryAfter)
          const body = req.method === 'HEAD' ? '' : Buffer.from(await upstream.arrayBuffer())
          res.end(body)
        } catch {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Failed to reach TMDB upstream' }))
        }
      })
    },
  }
}

function ratingsProxyDevPlugin(env: Record<string, string>) {
  return {
    name: 'ratings-proxy-dev-middleware',
    configureServer(server: any) {
      server.middlewares.use('/api/ratings', async (req: any, res: any) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const url = new URL(req.url ?? '', 'http://localhost')
        const tmdbId = Number(url.searchParams.get('tmdbId') || '')
        const typeParam = (url.searchParams.get('type') || 'movie').toLowerCase().trim()
        const endpointType = typeParam === 'tv' || typeParam === 'show' ? 'show' : 'movie'
        const rawImdbId = (url.searchParams.get('imdbId') || '').trim()

        if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Parâmetro tmdbId inválido' }))
          return
        }
        if (rawImdbId && !/^tt\d+$/i.test(rawImdbId)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Parâmetro imdbId inválido' }))
          return
        }

        const mdbKey = (env.MDBLIST_API_KEY || env.VITE_MDBLIST_API_KEY || '').trim()
        const omdbKey = (env.OMDB_API_KEY || env.VITE_OMDB_API_KEY || '').trim()
        let resolvedImdbId = rawImdbId
        let mdblist: { imdbid?: string; ratings?: Array<{ source?: string; score?: unknown; value?: unknown }> } | null = null
        let omdb: { Response?: string } | null = null

        if (mdbKey) {
          try {
            const mdbRes = await fetch(
              `https://api.mdblist.com/tmdb/${endpointType}/${tmdbId}?apikey=${encodeURIComponent(mdbKey)}`,
              { headers: { Accept: 'application/json' } },
            )
            if (mdbRes.ok) {
              mdblist = (await mdbRes.json()) as {
                imdbid?: string
                ratings?: Array<{ source?: string; score?: unknown; value?: unknown }>
              }
              if (!resolvedImdbId && mdblist?.imdbid && /^tt\d+$/i.test(mdblist.imdbid.trim())) {
                resolvedImdbId = mdblist.imdbid.trim()
              }
            }
          } catch {
            /* segue para fallback OMDb */
          }
        }

        const hasExternal = Array.isArray(mdblist?.ratings) && mdblist.ratings.some((e) => {
          const src = String(e?.source || '').toLowerCase().trim()
          if (!src || src === 'tmdb') return false
          const score = Number(e?.score)
          const val = Number(String(e?.value ?? '').replace('%', '').trim())
          return (!Number.isNaN(score) && score > 0) || (!Number.isNaN(val) && val > 0)
        })

        if (!hasExternal && omdbKey && resolvedImdbId && /^tt\d+$/i.test(resolvedImdbId)) {
          try {
            const omdbRes = await fetch(
              `https://www.omdbapi.com/?i=${encodeURIComponent(resolvedImdbId)}&apikey=${encodeURIComponent(omdbKey)}`,
              { headers: { Accept: 'application/json' } },
            )
            if (omdbRes.ok) {
              const data = (await omdbRes.json()) as { Response?: string }
              if (data && data.Response !== 'False') omdb = data
            }
          } catch {
            /* degrada para TMDb no cliente */
          }
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ mdblist, omdb, resolvedImdbId: resolvedImdbId || null }))
      })
    },
  }
}

import {
  recommendMovies,
  setLoadedLayaWeights,
  type Weights5DModel,
} from './src/ai'

let nodeWeightsLoaded = false

function ensureNodeCheckpointWeights(): Weights5DModel | null {
  if (nodeWeightsLoaded) return null
  nodeWeightsLoaded = true
  try {
    const weightsPath = path.resolve(
      process.cwd(),
      'tmdb_recommender/model_checkpoint/checkpoint_latest/weights_5d.json'
    )
    if (fs.existsSync(weightsPath)) {
      const model = JSON.parse(fs.readFileSync(weightsPath, 'utf-8')) as Weights5DModel
      setLoadedLayaWeights(model)
      return model
    }
  } catch {
    // fallback to semantic rules if file read fails
  }
  return null
}

function recommendApiPlugin(env: Record<string, string>) {
  const tmdbKeyDefault =
    env.TMDB_ACCESS_TOKEN ||
    env.TMDB_API_KEY ||
    env.TMDB_READ_TOKEN ||
    env.VITE_TMDB_ACCESS_TOKEN ||
    env.VITE_TMDB_API_KEY ||
    ''

  return {
    name: 'laya-recommend-api-middleware',
    configureServer(server: any) {
      ensureNodeCheckpointWeights()
      server.middlewares.use('/api/recommend', async (req: any, res: any) => {
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const q = (url.searchParams.get('q') ?? '').trim()
          const lang = url.searchParams.get('lang') ?? 'pt-BR'
          if (!q) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Parâmetro q obrigatório' }))
            return
          }

          const payload = await recommendMovies(q, {
            language: lang,
            apiKeyOrToken: tmdbKeyDefault,
          })

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(payload))
        } catch (err: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: err?.message || 'Erro interno na recomendação' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: process.env.CAPACITOR === 'true' ? './' : '/',
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
    },
    plugins: [
      react(),
      tailwindcss(),
      tmdbProxyDevPlugin(env),
      ratingsProxyDevPlugin(env),
      imdbApiPlugin(),
      recommendApiPlugin(env),
    ],
    build: {
      rollupOptions: {
        output: {
          // Divide dependências pesadas em chunks próprios para cache independente e menor parse inicial
          manualChunks(id) {
            if (id.includes('weights_5d.json')) return 'ai-weights';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/lucide-react')) return 'icons';
          },
        },
      },
    },
  }
})
