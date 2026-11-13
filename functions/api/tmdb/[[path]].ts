interface Env {
  TMDB_ACCESS_TOKEN?: string;
  TMDB_READ_TOKEN?: string;
  TMDB_API_KEY?: string;
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
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
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

function cleanSecret(val?: string): string {
  if (!val) return '';
  return val
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const incomingUrl = new URL(request.url);
  const rawPath = params.path;
  const segmentsFromParams = Array.isArray(rawPath)
    ? rawPath
    : typeof rawPath === 'string'
      ? rawPath.split('/').filter(Boolean)
      : [];
  const segments =
    segmentsFromParams.length > 0
      ? segmentsFromParams
      : incomingUrl.pathname.replace(/^\/api\/tmdb\/?/, '').split('/').filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((seg) => seg === '.' || seg === '..' || !/^[A-Za-z0-9_.-]+$/.test(seg))
  ) {
    return jsonResponse({ error: 'Invalid TMDB endpoint path' }, 400, corsHeaders);
  }

  const rawAccessToken = cleanSecret(env.TMDB_ACCESS_TOKEN) || cleanSecret(env.TMDB_READ_TOKEN);
  const rawApiKey = cleanSecret(env.TMDB_API_KEY);

  const bearerToken =
    rawAccessToken && (rawAccessToken.length > 50 || rawAccessToken.includes('.'))
      ? rawAccessToken
      : rawApiKey && (rawApiKey.length > 50 || rawApiKey.includes('.'))
        ? rawApiKey
        : '';

  const v3ApiKey =
    rawApiKey && !rawApiKey.includes('.') && rawApiKey.length <= 50
      ? rawApiKey
      : rawAccessToken && !rawAccessToken.includes('.') && rawAccessToken.length <= 50
        ? rawAccessToken
        : '';

  if (!bearerToken && !v3ApiKey) {
    return jsonResponse(
      { error: 'TMDB credentials are not configured on the server' },
      500,
      corsHeaders,
    );
  }

  const baseTargetUrl = new URL(`https://api.themoviedb.org/3/${segments.join('/')}`);
  incomingUrl.searchParams.forEach((value, key) => {
    if (key.toLowerCase() === 'api_key') return;
    baseTargetUrl.searchParams.append(key, value);
  });

  const doUpstreamFetch = async (useBearer: boolean): Promise<Response> => {
    const targetUrl = new URL(baseTargetUrl.toString());
    const upstreamHeaders: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'MyWorld-Cloudflare-Pages/1.0',
    };

    if (useBearer && bearerToken) {
      upstreamHeaders.Authorization = `Bearer ${bearerToken}`;
    } else if (v3ApiKey) {
      targetUrl.searchParams.set('api_key', v3ApiKey);
    }

    return fetch(targetUrl.toString(), {
      method: request.method,
      headers: upstreamHeaders,
    });
  };

  try {
    let upstreamRes = await doUpstreamFetch(Boolean(bearerToken));
    if (upstreamRes.status === 401 && bearerToken && v3ApiKey) {
      upstreamRes = await doUpstreamFetch(false);
    }

    const responseHeaders: Record<string, string> = {
      'Content-Type': upstreamRes.headers.get('Content-Type') || 'application/json; charset=utf-8',
      ...corsHeaders,
      'Cache-Control': upstreamRes.ok ? 'public, max-age=300, s-maxage=600' : 'no-store',
    };

    const retryAfter = upstreamRes.headers.get('Retry-After');
    if (retryAfter) {
      responseHeaders['Retry-After'] = retryAfter;
    }

    const body = request.method === 'HEAD' ? null : await upstreamRes.arrayBuffer();
    return new Response(body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch {
    return jsonResponse({ error: 'Failed to reach TMDB upstream' }, 502, corsHeaders);
  }
};
