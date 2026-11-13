interface Env {
  MDBLIST_API_KEY?: string;
  OMDB_API_KEY?: string;
}

interface MDBListRatingEntry {
  source?: string;
  value?: number | string | null;
  score?: number | null;
  votes?: number | null;
}

interface MDBListResponse {
  id?: number;
  imdbid?: string;
  ratings?: MDBListRatingEntry[];
}

interface OMDbResponse {
  Response?: string;
  imdbRating?: string;
  Metascore?: string;
  Ratings?: { Source?: string; Value?: string }[];
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

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
  cacheControl = 'no-store',
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      ...corsHeaders,
    },
  });
}

function hasExternalMdbRating(data: MDBListResponse | null): boolean {
  if (!data || !Array.isArray(data.ratings)) return false;
  return data.ratings.some((entry) => {
    const src = (entry?.source || '').toLowerCase().trim();
    if (!src || src === 'tmdb') return false;
    const score = typeof entry.score === 'number' ? entry.score : Number(entry.score);
    if (!Number.isNaN(score) && score > 0) return true;
    const val =
      typeof entry.value === 'string'
        ? Number(entry.value.replace('%', '').trim())
        : Number(entry.value);
    return !Number.isNaN(val) && val > 0;
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const url = new URL(request.url);
  const tmdbIdRaw = url.searchParams.get('tmdbId') || '';
  const tmdbId = Number(tmdbIdRaw);
  const typeParam = (url.searchParams.get('type') || 'movie').toLowerCase().trim();
  const endpointType = typeParam === 'tv' || typeParam === 'show' ? 'show' : 'movie';
  const rawImdbId = (url.searchParams.get('imdbId') || '').trim();

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return jsonResponse({ error: 'Parâmetro tmdbId inválido' }, 400, corsHeaders);
  }

  if (rawImdbId && !/^tt\d+$/i.test(rawImdbId)) {
    return jsonResponse({ error: 'Parâmetro imdbId inválido' }, 400, corsHeaders);
  }

  const cleanSecret = (val?: string): string =>
    (val || '').trim().replace(/^['"]+|['"]+$/g, '').trim();

  const mdbKey = cleanSecret(env.MDBLIST_API_KEY);
  const omdbKey = cleanSecret(env.OMDB_API_KEY);

  let resolvedImdbId = rawImdbId;
  let mdblist: MDBListResponse | null = null;
  let omdb: OMDbResponse | null = null;

  if (mdbKey) {
    try {
      const mdbUrl = `https://api.mdblist.com/tmdb/${endpointType}/${tmdbId}?apikey=${encodeURIComponent(
        mdbKey,
      )}`;
      const res = await fetch(mdbUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = (await res.json()) as MDBListResponse;
        mdblist = data;
        if (!resolvedImdbId && data?.imdbid && /^tt\d+$/i.test(data.imdbid.trim())) {
          resolvedImdbId = data.imdbid.trim();
        }
      }
    } catch {
      /* segue para fallback OMDb */
    }
  }

  if (!hasExternalMdbRating(mdblist) && omdbKey && resolvedImdbId && /^tt\d+$/i.test(resolvedImdbId)) {
    try {
      const omdbUrl = `https://www.omdbapi.com/?i=${encodeURIComponent(
        resolvedImdbId,
      )}&apikey=${encodeURIComponent(omdbKey)}`;
      const res = await fetch(omdbUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = (await res.json()) as OMDbResponse;
        if (data && data.Response !== 'False') {
          omdb = data;
        }
      }
    } catch {
      /* degrada para contingência TMDb no cliente */
    }
  }

  const cacheHeader =
    mdblist || omdb ? 'public, max-age=3600, s-maxage=86400' : 'public, max-age=300';

  return jsonResponse(
    {
      mdblist,
      omdb,
      resolvedImdbId: resolvedImdbId || null,
    },
    200,
    corsHeaders,
    cacheHeader,
  );
};
