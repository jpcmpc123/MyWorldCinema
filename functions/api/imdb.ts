const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

interface SpecItem {
  label: string;
  value: string;
}

interface TriviaItem {
  text: string;
  spoiler: boolean;
}

interface ImdbPayload {
  specs: SpecItem[];
  trivia: TriviaItem[];
}

const ALLOWED_ORIGINS = new Set([
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const requestOrigin = new URL(request.url).origin;
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (origin && (origin === requestOrigin || ALLOWED_ORIGINS.has(origin))) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (!origin) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  }

  return headers;
}

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
    .trim();
}

function extractNextData(html: string): unknown | null {
  const m = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function textFromContent(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return stripHtml(content);
  if (Array.isArray(content)) return content.map(textFromContent).filter(Boolean).join(', ');
  if (typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    if (typeof obj.value === 'string') return stripHtml(obj.value);
    if (Array.isArray(obj.value)) return textFromContent(obj.value);
    if (typeof obj.plainText === 'string') return obj.plainText.trim();
    if (typeof obj.html === 'string') return stripHtml(obj.html);
  }
  return '';
}

function findSpecsInNextData(root: unknown): SpecItem[] {
  const out: SpecItem[] = [];
  const seen = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || out.length >= 40) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object') return;

    const obj = node as Record<string, unknown>;
    const label =
      typeof obj.label === 'string'
        ? obj.label
        : typeof obj.name === 'string'
          ? obj.name
          : null;
    const val = obj.value ?? obj.plainText ?? obj.text;
    if (label && val != null) {
      const value = textFromContent(val);
      if (value && !seen.has(label)) {
        seen.add(label);
        out.push({ label, value });
      }
    }
    for (const k of Object.keys(obj)) visit(obj[k]);
  };
  visit(root);
  return out;
}

function specsFromHtml(html: string): SpecItem[] {
  const out: SpecItem[] = [];
  const seen = new Set<string>();
  const push = (label: string, value: string): void => {
    const cleanLabel = stripHtml(label);
    const cleanValue = stripHtml(value);
    if (cleanLabel && cleanValue && !seen.has(cleanLabel)) {
      seen.add(cleanLabel);
      out.push({ label: cleanLabel, value: cleanValue });
    }
  };

  let m: RegExpExecArray | null;
  const liRe =
    /<li[^>]*data-testid=["'][^"']*tech[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<(?:div|span)[^>]*>([\s\S]*?)<\/(?:div|span)>/gi;
  while ((m = liRe.exec(html))) push(m[1], m[2]);
  const dlRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  while ((m = dlRe.exec(html))) push(m[1], m[2]);
  return out;
}

function findTriviaInNextData(root: unknown): TriviaItem[] {
  const out: TriviaItem[] = [];
  const visit = (node: unknown): void => {
    if (!node || out.length >= 100) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object') return;

    const obj = node as Record<string, unknown>;
    const t = obj.text ?? obj.body ?? obj.html;
    const spoiler =
      typeof obj.isSpoiler === 'boolean'
        ? obj.isSpoiler
        : typeof obj.spoiler === 'boolean'
          ? obj.spoiler
          : false;
    const text = textFromContent(t);
    if (text && text.length > 30 && (obj.isSpoiler !== undefined || obj.spoiler !== undefined)) {
      out.push({ text, spoiler });
      return;
    }
    for (const k of Object.keys(obj)) visit(obj[k]);
  };
  visit(root);
  return out;
}

function triviaFromHtml(html: string): TriviaItem[] {
  const out: TriviaItem[] = [];
  let m: RegExpExecArray | null;
  const testidRe = /<li[^>]*data-testid=["'][^"']*trivia[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  while ((m = testidRe.exec(html))) {
    const text = stripHtml(m[1]);
    if (text.length > 15) {
      out.push({
        text,
        spoiler: /spoiler/i.test(m[1]),
      });
    }
  }
  if (out.length === 0) {
    const liRe = /<li[^>]*class=["'][^"']*ipc-html-content-inner-div[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    while ((m = liRe.exec(html))) {
      const text = stripHtml(m[1]);
      if (text.length > 30) out.push({ text, spoiler: false });
    }
  }
  return out;
}

async function fetchImdbPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`IMDb HTTP ${res.status}`);
  return res.text();
}

async function fetchImdbData(imdbId: string): Promise<ImdbPayload> {
  const [techHtml, triviaHtml] = await Promise.all([
    fetchImdbPage(`https://www.imdb.com/title/${imdbId}/technical/`),
    fetchImdbPage(`https://www.imdb.com/title/${imdbId}/trivia/`),
  ]);

  let specs: SpecItem[] = [];
  const techData = extractNextData(techHtml);
  if (techData) specs = findSpecsInNextData(techData);
  if (specs.length === 0) specs = specsFromHtml(techHtml);

  let trivia: TriviaItem[] = [];
  const triviaData = extractNextData(triviaHtml);
  if (triviaData) trivia = findTriviaInNextData(triviaData);
  if (trivia.length === 0) trivia = triviaFromHtml(triviaHtml);

  return { specs, trivia };
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const corsHeaders = getCorsHeaders(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders,
      },
    });
  }

  const url = new URL(request.url);
  const imdbId = (url.searchParams.get('imdbId') ?? '').trim();

  if (!/^tt\d{5,}$/.test(imdbId)) {
    return new Response(
      JSON.stringify({ error: 'imdbId inválido — esperado formato ttXXXXXXX' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders,
        },
      },
    );
  }

  try {
    const data = await fetchImdbData(imdbId);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        ...corsHeaders,
      },
    });
  } catch {
    return new Response(JSON.stringify({ specs: [], trivia: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders,
      },
    });
  }
};
