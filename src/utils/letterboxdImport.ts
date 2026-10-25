import { tmdb, type TMDBSearchResult } from '../services/tmdb';

export const MAX_IMPORT_FILE_BYTES = 1024 * 1024; // 1MB limit per Letterboxd spec

export type ImportDestination = 'profile' | 'list' | 'watchlist';

export type ImportFormatKind =
  | 'letterboxd_zip'
  | 'letterboxd_csv'
  | 'letterboxd_list_csv'
  | 'imdb_csv'
  | 'icheckmovies_csv'
  | 'delicious_xml';

export interface ParsedImportRow {
  rowNumber: number;
  letterboxdUri: string;
  tmdbId: number | null;
  imdbId: string;
  title: string;
  year: string;
  directors: string[];
  rating: number; // 0 (unrated) or 0.5..5.0
  watchedDate: string; // YYYY-MM-DD or ''
  rewatch: boolean;
  liked: boolean;
  tags: string[];
  review: string; // Review text/HTML (also used for List Notes)
  imdbTitleType?: string;
  sourceFile?: string; // ex.: 'watched.csv', 'diary.csv', 'reviews.csv'
}

export type MatchConfidence = 'exact_id' | 'best_guess' | 'tv_warning' | 'unmatched';

export interface MatchedImportItem {
  id: string; // internal row id
  raw: ParsedImportRow;
  matchedMovie: TMDBSearchResult | null;
  alternatives: TMDBSearchResult[];
  confidence: MatchConfidence;
  selected: boolean;
  combinedCount: number; // >1 if multiple rows had same film + same WatchedDate
  updatesExistingDiary?: boolean;
}

export interface ParsedZipListBundle {
  fileName: string;
  title: string;
  description: string;
  tags: string[];
  rows: ParsedImportRow[];
}

export interface ZipExtraBundles {
  watchlistRows: ParsedImportRow[];
  lists: ParsedZipListBundle[];
  fileCounts: {
    watched: number;
    ratings: number;
    diary: number;
    reviews: number;
    likes: number;
    watchlist: number;
    lists: number;
  };
}

export interface ParseFileResult {
  ok: boolean;
  errorKey?: string;
  errorMessage?: string;
  format?: ImportFormatKind;
  rows: ParsedImportRow[];
  detectedListMeta?: {
    title?: string;
    description?: string;
    tags?: string[];
  };
  zipExtras?: ZipExtraBundles;
}

/**
 * Parser CSV completo compatível com as regras do Letterboxd:
 * - Delimitador vírgula (,)
 * - Strings entre aspas ("...") podendo conter vírgulas e quebras de linha
 * - Escape de aspas com barra invertida (\" -> ") E aspas duplas RFC-4180 ("" -> ")
 */
export function parseCsvRecords(csvText: string): string[][] {
  const text = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '\\' && (next === '"' || next === '\\')) {
        currentCell += next;
        i++;
      } else if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell !== '')) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Trunca timestamps ou formatos variados para data de calendário YYYY-MM-DD.
 */
export function normalizeCalendarDate(raw: string): string {
  const clean = raw.trim();
  if (!clean) return '';

  // Já começa com YYYY-MM-DD (mesmo se tiver T14:30:00Z depois)
  const isoMatch = clean.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const month = Number(m);
    const day = Number(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // DD/MM/YYYY
  const brMatch = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    const month = Number(m);
    const day = Number(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  return '';
}

/**
 * Converte string booleana ("true", "yes", "1", "y", "sim") em boolean.
 */
export function parseBooleanFlag(raw: string): boolean {
  const val = raw.trim().toLowerCase();
  return val === 'true' || val === 'yes' || val === '1' || val === 'y' || val === 'sim';
}

/**
 * Normaliza nota na escala 0.5 a 5.0 (incrementos de 0.5).
 */
export function normalizeRating5(raw: string): number | null {
  const clean = raw.trim().replace(',', '.');
  if (!clean) return null;
  // Caso venha com estrelas (ex.: "★★★★½")
  if (clean.includes('★') || clean.includes('½')) {
    const full = (clean.match(/★/g) || []).length;
    const half = clean.includes('½') ? 0.5 : 0;
    const total = full + half;
    return total >= 0.5 && total <= 5 ? total : null;
  }
  const num = Number(clean);
  if (!Number.isFinite(num) || num <= 0) return null;
  const clamped = Math.min(5, Math.max(0.5, Math.round(num * 2) / 2));
  return clamped;
}

/**
 * Converte Rating10 (1..10) para escala 0.5..5.0.
 */
export function normalizeRating10(raw: string): number | null {
  const clean = raw.trim().replace(',', '.');
  if (!clean) return null;
  const num = Number(clean);
  if (!Number.isFinite(num) || num <= 0) return null;
  const scaled = num / 2;
  return Math.min(5, Math.max(0.5, Math.round(scaled * 2) / 2));
}

/**
 * Extrai pista de título e ano a partir de uma URL do Letterboxd
 * (ex.: https://letterboxd.com/film/paris-texas/ ou https://letterboxd.com/user/film/dune-part-two-2024/)
 */
export function extractHintFromLetterboxdUri(uri: string): { titleHint: string; yearHint: string } {
  const clean = uri.trim();
  if (!clean) return { titleHint: '', yearHint: '' };
  const match = clean.match(/letterboxd\.com\/(?:[^/]+\/)?film\/([a-z0-9-]+)\/?/i);
  if (!match) return { titleHint: '', yearHint: '' };

  let slug = match[1];
  let yearHint = '';
  const yearSuffix = slug.match(/^(.*)-((?:19|20)\d{2})$/);
  if (yearSuffix && yearSuffix[1]) {
    slug = yearSuffix[1];
    yearHint = yearSuffix[2];
  }

  const titleHint = slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return { titleHint, yearHint };
}

/**
 * Faz o parse de arquivos XML do Delicious Library v2 ou v3 (suportado ao importar para uma lista).
 */
function parseDeliciousLibraryXml(xmlText: string): ParseFileResult {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return {
        ok: false,
        errorKey: 'imp_err_xml_invalid',
        errorMessage: 'Invalid Delicious Library XML file.',
        rows: [],
      };
    }

    const mediaNodes = Array.from(
      doc.querySelectorAll('medium, movie, video, item'),
    );
    const rows: ParsedImportRow[] = [];

    mediaNodes.forEach((node, idx) => {
      const attrOrTag = (names: string[]): string => {
        for (const n of names) {
          const attr = node.getAttribute(n);
          if (attr && attr.trim()) return attr.trim();
          const child = node.querySelector(n);
          if (child?.textContent?.trim()) return child.textContent.trim();
        }
        return '';
      };

      const title = attrOrTag(['title', 'name']);
      const rawYear = attrOrTag(['releaseDate', 'year', 'published']);
      const yearMatch = rawYear.match(/\b((?:18|19|20)\d{2})\b/);
      const year = yearMatch ? yearMatch[1] : '';
      const directorRaw = attrOrTag(['director', 'directors', 'creators', 'author']);
      const imdbRaw = attrOrTag(['imdb', 'imdbID', 'url']);
      const imdbMatch = imdbRaw.match(/\b(tt\d{6,10})\b/i);
      const ratingRaw = attrOrTag(['rating', 'userRating', 'stars']);
      const notes = attrOrTag(['notes', 'description', 'comments', 'review']);

      if (!title && !imdbMatch) return;

      rows.push({
        rowNumber: idx + 1,
        letterboxdUri: '',
        tmdbId: null,
        imdbId: imdbMatch ? imdbMatch[1].toLowerCase() : '',
        title,
        year,
        directors: directorRaw
          ? directorRaw.split(',').map((d) => d.trim()).filter(Boolean)
          : [],
        rating: normalizeRating5(ratingRaw) ?? 0,
        watchedDate: '',
        rewatch: false,
        liked: false,
        tags: [],
        review: notes,
      });
    });

    if (rows.length === 0) {
      return {
        ok: false,
        errorKey: 'cfg_no_valid_rows',
        errorMessage: 'No valid movie items found in the Delicious Library XML file.',
        rows: [],
      };
    }

    return {
      ok: true,
      format: 'delicious_xml',
      rows,
    };
  } catch {
    return {
      ok: false,
      errorKey: 'imp_err_xml_invalid',
      errorMessage: 'Could not parse Delicious Library XML file.',
      rows: [],
    };
  }
}

/**
 * Faz o parse e validação de um arquivo de importação (Letterboxd CSV, IMDb CSV,
 * ICheckMovies CSV ou Delicious Library XML).
 */
export function parseImportFileContent(
  content: string,
  fileName: string,
  destination: ImportDestination,
): ParseFileResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      ok: false,
      errorKey: 'cfg_csv_empty',
      errorMessage: 'The import file appears to be empty.',
      rows: [],
    };
  }

  const isXml =
    fileName.toLowerCase().endsWith('.xml') ||
    trimmed.startsWith('<?xml') ||
    trimmed.startsWith('<library') ||
    trimmed.startsWith('<delicious');

  if (isXml) {
    if (destination !== 'list') {
      return {
        ok: false,
        errorKey: 'imp_err_delicious_list_only',
        errorMessage: 'Delicious Library files (XML) are only supported when importing to a list.',
        rows: [],
      };
    }
    return parseDeliciousLibraryXml(trimmed);
  }

  const allRecords = parseCsvRecords(content);
  if (allRecords.length < 2) {
    return {
      ok: false,
      errorKey: 'cfg_csv_empty',
      errorMessage: 'The CSV file appears to be empty (no data rows).',
      rows: [],
    };
  }

  // Detecta se é um export de Lista do Letterboxd ("Letterboxd list export v7")
  // que possui um cabeçalho de metadados da lista seguido pela tabela de filmes.
  let headerRowIdx = 0;
  let detectedListMeta: ParseFileResult['detectedListMeta'] = undefined;
  let format: ImportFormatKind = 'letterboxd_csv';

  if (
    allRecords[0]?.[0]?.toLowerCase().startsWith('letterboxd list export') &&
    allRecords.length >= 4
  ) {
    format = 'letterboxd_list_csv';
    const metaHeaders = (allRecords[1] || []).map((h) => h.toLowerCase().trim());
    const metaValues = allRecords[2] || [];
    const nameIdx = metaHeaders.indexOf('name');
    const descIdx = metaHeaders.indexOf('description');
    const tagsIdx = metaHeaders.indexOf('tags');
    detectedListMeta = {
      title: nameIdx >= 0 ? metaValues[nameIdx] : undefined,
      description: descIdx >= 0 ? metaValues[descIdx] : undefined,
      tags:
        tagsIdx >= 0 && metaValues[tagsIdx]
          ? metaValues[tagsIdx].split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
    };
    const foundFilmHeader = allRecords.findIndex(
      (r, idx) =>
        idx >= 3 &&
        r.some((c) => ['position', 'name', 'title', 'url', 'letterboxduri'].includes(c.toLowerCase().trim())),
    );
    if (foundFilmHeader >= 0) {
      headerRowIdx = foundFilmHeader;
    }
  }

  const rawHeaders = allRecords[headerRowIdx].map((h) => h.trim());
  const normHeaders = rawHeaders.map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));

  const findCol = (candidates: string[]): number => {
    for (const c of candidates) {
      const idx = normHeaders.indexOf(c);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  // As 4 colunas identificadoras obrigatórias do Letterboxd (pelo menos 1 deve existir)
  const colUri = findCol(['letterboxduri', 'url']);
  const colTmdbId = findCol(['tmdbid', 'filmid']);
  const colImdbId = findCol(['imdbid', 'const', 'imdb']);
  const colTitle = findCol(['title', 'name', 'originaltitle', 'film', 'filmtitle']);

  if (colUri === -1 && colTmdbId === -1 && colImdbId === -1 && colTitle === -1) {
    return {
      ok: false,
      errorKey: 'cfg_csv_unrecognized',
      errorMessage:
        'Unrecognized CSV header. You must include at least one of: LetterboxdURI (or url), tmdbID, imdbID, or Title.',
      rows: [],
    };
  }

  // Detecta se é IMDb export ou ICheckMovies export
  const colImdbTitleType = findCol(['titletype', 'type']);
  const colYourRating = findCol(['yourrating']);
  const colDateRated = findCol(['daterated']);
  const colIcmChecked = findCol(['checked']);

  if (normHeaders.includes('const') && (colYourRating !== -1 || colImdbTitleType !== -1)) {
    format = 'imdb_csv';
  } else if (colIcmChecked !== -1) {
    format = 'icheckmovies_csv';
  }

  // Demais colunas opcionais do padrão Letterboxd
  const colYear = findCol(['year', 'releaseyear', 'filmyear']);
  const colDirectors = findCol(['directors', 'director', 'directedby']);
  const colRating = findCol(['rating']);
  const colRating10 = findCol(['rating10', 'yourrating']);
  const colWatchedDate = findCol(['watcheddate', 'watchedon', 'daterated']);
  // Em watched.csv / watchlist.csv do Letterboxd existe apenas "Date", mas em diary.csv
  // existe "Date" (data do log) E "Watched Date" (data em que assistiu).
  const colFallbackDate = colWatchedDate === -1 && format === 'imdb_csv' ? colDateRated : -1;
  const colRewatch = findCol(['rewatch', 'isrewatch']);
  const colTags = findCol(['tags', 'tag']);
  const colReview = findCol(['review', 'reviewtext', 'notes', 'description']);
  const colLiked = findCol(['liked', 'like', 'favorite']);

  const parsedRows: ParsedImportRow[] = [];

  for (let rIdx = headerRowIdx + 1; rIdx < allRecords.length; rIdx++) {
    const row = allRecords[rIdx];
    if (!row || row.every((c) => !c.trim())) continue;

    // Pula cabeçalhos de seção de exportação combinada (ex.: "# Watchlist")
    if (row[0]?.startsWith('#')) continue;

    const getCell = (colIdx: number): string =>
      colIdx >= 0 && colIdx < row.length ? (row[colIdx] ?? '').trim() : '';

    const rawUri = getCell(colUri);
    const rawTmdb = getCell(colTmdbId);
    const rawImdb = getCell(colImdbId);
    let rawTitle = getCell(colTitle);
    let rawYear = getCell(colYear);

    const tmdbNum = rawTmdb ? parseInt(rawTmdb, 10) : NaN;
    const tmdbId = Number.isFinite(tmdbNum) && tmdbNum > 0 ? tmdbNum : null;

    // Extrai tt\d+ mesmo se a coluna imdb contiver URL completa do IMDb
    const imdbMatch = (rawImdb || rawUri).match(/\b(tt\d{6,10})\b/i);
    const imdbId = imdbMatch ? imdbMatch[1].toLowerCase() : '';

    // Se não houver Title mas houver LetterboxdURI com slug, extrai pista do título
    if (!rawTitle && rawUri) {
      const hint = extractHintFromLetterboxdUri(rawUri);
      if (hint.titleHint) rawTitle = hint.titleHint;
      if (!rawYear && hint.yearHint) rawYear = hint.yearHint;
    }

    if (!rawUri && !tmdbId && !imdbId && !rawTitle) continue;

    // Regra oficial do Letterboxd para precedência entre Rating e Rating10:
    // "If both Rating columns contain data on any given line of the file,
    // whichever column appears second in the file will take precedence."
    const valRating5 = colRating !== -1 ? normalizeRating5(getCell(colRating)) : null;
    const valRating10 = colRating10 !== -1 ? normalizeRating10(getCell(colRating10)) : null;

    let finalRating = 0;
    if (valRating5 !== null && valRating10 !== null) {
      finalRating = colRating10 > colRating ? valRating10 : valRating5;
    } else if (valRating5 !== null) {
      finalRating = valRating5;
    } else if (valRating10 !== null) {
      finalRating = valRating10;
    }

    const watchedDateRaw = getCell(colWatchedDate !== -1 ? colWatchedDate : colFallbackDate);
    const watchedDate = normalizeCalendarDate(watchedDateRaw);

    const rewatch = colRewatch !== -1 ? parseBooleanFlag(getCell(colRewatch)) : false;
    const liked = colLiked !== -1 ? parseBooleanFlag(getCell(colLiked)) : false;

    const directorsRaw = getCell(colDirectors);
    const directors = directorsRaw
      ? directorsRaw.split(',').map((d) => d.trim()).filter(Boolean)
      : [];

    const tagsRaw = getCell(colTags);
    const tags = tagsRaw
      ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const review = getCell(colReview);
    const imdbTitleType = colImdbTitleType !== -1 ? getCell(colImdbTitleType) : undefined;

    parsedRows.push({
      rowNumber: rIdx + 1,
      letterboxdUri: rawUri,
      tmdbId,
      imdbId,
      title: rawTitle,
      year: rawYear.slice(0, 4),
      directors,
      rating: finalRating,
      watchedDate,
      rewatch: watchedDate ? rewatch : false,
      liked,
      tags,
      review,
      imdbTitleType,
    });
  }

  if (parsedRows.length === 0) {
    return {
      ok: false,
      errorKey: 'cfg_no_valid_rows',
      errorMessage: 'No valid film rows found in the file.',
      rows: [],
    };
  }

  return {
    ok: true,
    format,
    rows: parsedRows,
    detectedListMeta,
  };
}

/**
 * Normaliza string para comparação tolerante a acentos, pontuação e caixa.
 */
function normalizeTextForMatch(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escolhe o melhor candidato ("best-guess match") considerando Title, Year e Directors.
 */
function scoreCandidateForImport(
  candidate: TMDBSearchResult,
  row: ParsedImportRow,
): number {
  let score = 0;
  const targetTitle = normalizeTextForMatch(row.title);
  const candTitle = normalizeTextForMatch(candidate.title);
  const candOrig = normalizeTextForMatch(candidate.original_title || '');
  const candAlts = (candidate.alternativeTitles || []).map(normalizeTextForMatch);

  if (targetTitle) {
    if (candTitle === targetTitle || candOrig === targetTitle) {
      score += 200;
    } else if (candAlts.includes(targetTitle)) {
      score += 175;
    } else if (
      candTitle.startsWith(targetTitle) ||
      candOrig.startsWith(targetTitle) ||
      targetTitle.startsWith(candTitle)
    ) {
      score += 95;
    }
  }

  // Comparação de Ano (Year)
  const targetYear = row.year ? parseInt(row.year, 10) : NaN;
  const candYear = candidate.release_date ? parseInt(candidate.release_date.slice(0, 4), 10) : NaN;
  if (Number.isFinite(targetYear) && Number.isFinite(candYear)) {
    const diff = Math.abs(targetYear - candYear);
    if (diff === 0) score += 150;
    else if (diff === 1) score += 75; // Diferença comum entre estreia em festival e circuito comercial
    else if (diff === 2) score += 20;
    else score -= Math.min(120, diff * 12);
  }

  // Comparação de Diretores (Directors)
  if (row.directors.length > 0 && candidate.directors.length > 0) {
    const rowDirs = row.directors.map(normalizeTextForMatch);
    const candDirs = candidate.directors.map(normalizeTextForMatch);
    const hasDirMatch = rowDirs.some((rd) =>
      candDirs.some((cd) => cd === rd || cd.includes(rd) || rd.includes(cd)),
    );
    if (hasDirMatch) {
      score += 180;
    } else {
      score -= 45;
    }
  }

  // Desempate por popularidade/relevância
  score += Math.min(35, Math.sqrt(Math.max(0, candidate.popularity || 0)) * 2);

  return score;
}

/**
 * Resolve uma linha do CSV no TMDB:
 * 1. Exact Match se houver tmdbID ou imdbID
 * 2. Best-Guess Match se houver Title (+ Year e Directors opcionais)
 */
async function matchSingleRow(row: ParsedImportRow): Promise<{
  matchedMovie: TMDBSearchResult | null;
  alternatives: TMDBSearchResult[];
  confidence: MatchConfidence;
}> {
  const isImdbTvType =
    row.imdbTitleType &&
    /tv|series|episode|mini/i.test(row.imdbTitleType) &&
    !/tvMovie/i.test(row.imdbTitleType);

  // 1. Exact Match por tmdbID
  if (row.tmdbId) {
    const exactTmdb = await tmdb.getMovieForImportById(row.tmdbId);
    if (exactTmdb) {
      return {
        matchedMovie: exactTmdb,
        alternatives: [],
        confidence: isImdbTvType ? 'tv_warning' : 'exact_id',
      };
    }
  }

  // 2. Exact Match por imdbID
  if (row.imdbId) {
    const imdbRes = await tmdb.findByImdbId(row.imdbId);
    if (imdbRes.match) {
      return {
        matchedMovie: imdbRes.match,
        alternatives: [],
        confidence: imdbRes.isTvMatch || isImdbTvType ? 'tv_warning' : 'exact_id',
      };
    }
  }

  // 3. Best-Guess Match por Title (+ Year + Directors)
  if (row.title) {
    const yearNum = row.year ? parseInt(row.year, 10) : undefined;
    const needDirectorEnrichment = row.directors.length > 0;
    const candidates = await tmdb.searchMoviesForImport(
      row.title,
      Number.isFinite(yearNum) ? yearNum : undefined,
      needDirectorEnrichment,
    );
    if (candidates.length > 0) {
      const scored = candidates
        .map((c) => ({ c, score: scoreCandidateForImport(c, row) }))
        .sort((a, b) => b.score - a.score);
      const best = scored[0].c;
      const alternatives = scored.slice(1, 6).map((x) => x.c);
      return {
        matchedMovie: best,
        alternatives,
        confidence: isImdbTvType ? 'tv_warning' : 'best_guess',
      };
    }
  }

  return {
    matchedMovie: null,
    alternatives: [],
    confidence: 'unmatched',
  };
}

/**
 * Executa o matching no TMDB para todas as linhas e aplica as regras do Letterboxd:
 * - Usa cache por filme único para evitar buscas repetidas no TMDB
 * - Combina linhas duplicadas do mesmo filme com a mesma WatchedDate num único registro
 * - Identifica quais entradas vão atualizar entradas existentes no Diário
 */
export async function matchImportRowsWithTmdb(
  rows: ParsedImportRow[],
  existingDiaryKeys: Set<string>, // formato `${movieId}:${watchedDate}`
  onProgress?: (completed: number, total: number) => void,
): Promise<MatchedImportItem[]> {
  const total = rows.length;
  let completed = 0;
  onProgress?.(0, total);

  const rawMatched: MatchedImportItem[] = new Array(total);
  const inflightMatchCache = new Map<
    string,
    Promise<{
      matchedMovie: TMDBSearchResult | null;
      alternatives: TMDBSearchResult[];
      confidence: MatchConfidence;
    }>
  >();

  const getRowCacheKey = (r: ParsedImportRow): string => {
    if (r.tmdbId) return `tmdb:${r.tmdbId}`;
    if (r.imdbId) return `imdb:${r.imdbId}`;
    return `title:${normalizeTextForMatch(r.title)}|year:${r.year}|dir:${r.directors.map(normalizeTextForMatch).join(',')}`;
  };

  const CONCURRENCY = 4;
  let cursor = 0;

  const worker = async () => {
    while (cursor < total) {
      const idx = cursor++;
      const row = rows[idx];
      const cacheKey = getRowCacheKey(row);
      let promise = inflightMatchCache.get(cacheKey);
      if (!promise) {
        promise = matchSingleRow(row);
        inflightMatchCache.set(cacheKey, promise);
      }
      const res = await promise;
      rawMatched[idx] = {
        id: `imp-${row.rowNumber}-${idx}`,
        raw: row,
        matchedMovie: res.matchedMovie,
        alternatives: res.alternatives,
        confidence: res.confidence,
        selected: res.matchedMovie !== null && res.confidence !== 'tv_warning',
        combinedCount: 1,
      };
      completed++;
      onProgress?.(completed, total);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()),
  );

  // Regra oficial do Letterboxd:
  // "Multiple lines containing the same film with the same WatchedDate will be combined
  // into a single entry when the imported data is saved."
  const combinedList: MatchedImportItem[] = [];
  const keyToIndex = new Map<string, number>();

  for (const item of rawMatched) {
    if (!item.matchedMovie) {
      combinedList.push(item);
      continue;
    }

    const movieId = item.matchedMovie.id;
    const wDate = item.raw.watchedDate;

    if (wDate) {
      const diaryKey = `${movieId}:${wDate}`;
      const existingIdx = keyToIndex.get(diaryKey);
      if (existingIdx !== undefined) {
        const target = combinedList[existingIdx];
        const mergedTags = Array.from(new Set([...target.raw.tags, ...item.raw.tags]));
        const mergedReview =
          target.raw.review && item.raw.review && target.raw.review !== item.raw.review
            ? `${target.raw.review}\n\n${item.raw.review}`
            : item.raw.review || target.raw.review;

        combinedList[existingIdx] = {
          ...target,
          combinedCount: target.combinedCount + 1,
          raw: {
            ...target.raw,
            rating: item.raw.rating > 0 ? item.raw.rating : target.raw.rating,
            rewatch: target.raw.rewatch || item.raw.rewatch,
            liked: target.raw.liked || item.raw.liked,
            tags: mergedTags,
            review: mergedReview,
          },
        };
        continue;
      }

      const newIndex = combinedList.length;
      keyToIndex.set(diaryKey, newIndex);
      combinedList.push({
        ...item,
        updatesExistingDiary: existingDiaryKeys.has(diaryKey),
      });
    } else {
      combinedList.push(item);
    }
  }

  return combinedList;
}

/**
 * Gera um CSV de exemplo no formato oficial do Letterboxd.
 */
export function generateSampleLetterboxdCsv(): string {
  return [
    'Title,Year,Directors,Rating,WatchedDate,Rewatch,Tags,Review',
    'Top Gun,1986,Tony Scott,5,2026-10-15,false,"action, 80s","An absolute classic."',
    'Gremlins,1984,Joe Dante,4.5,2026-10-18,true,"horror, comedy","Still fun on a rewatch!"',
    '"Paris, Texas",1984,Wim Wenders,5,2026-10-20,false,"drama, road movie","Unforgettable cinematography and score."',
  ].join('\n');
}

/**
 * Extrai todos os arquivos de texto (.csv) de dentro de um arquivo .zip no navegador
 * usando DataView + DecompressionStream('deflate-raw') nativo, sem dependências externas.
 */
export async function extractTextFilesFromZip(
  buffer: ArrayBuffer,
): Promise<Record<string, string>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder('utf-8');

  // Localiza End of Central Directory (EOCD) signature: 0x06054b50
  let eocdOffset = -1;
  const minSearch = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP file (End of Central Directory not found).');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  const files: Record<string, string> = {};
  let ptr = centralDirOffset;

  for (let idx = 0; idx < totalEntries; idx++) {
    if (ptr + 46 > bytes.length || view.getUint32(ptr, true) !== 0x02014b50) {
      break;
    }

    const compressionMethod = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const fileNameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const rawPath = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + fileNameLen));
    ptr += 46 + fileNameLen + extraLen + commentLen;

    const cleanPath = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanPath || cleanPath.endsWith('/')) continue;

    // Ignora pastas de itens deletados ou órfãos do export do Letterboxd
    const lowerPath = cleanPath.toLowerCase();
    if (
      lowerPath.startsWith('deleted/') ||
      lowerPath.includes('/deleted/') ||
      lowerPath.startsWith('orphaned/') ||
      lowerPath.includes('/orphaned/') ||
      !lowerPath.endsWith('.csv')
    ) {
      continue;
    }

    // Lê o Local File Header (0x04034b50)
    if (localHeaderOffset + 30 > bytes.length) continue;
    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) continue;

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);

    let uncompressedBytes: Uint8Array;
    if (compressionMethod === 0) {
      uncompressedBytes = compressedSlice;
    } else if (compressionMethod === 8) {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      void writer.write(compressedSlice);
      void writer.close();
      const ab = await new Response(ds.readable).arrayBuffer();
      uncompressedBytes = new Uint8Array(ab);
    } else {
      continue;
    }

    files[lowerPath] = decoder.decode(uncompressedBytes);
  }

  return files;
}

/**
 * Faz o parse completo de um arquivo .zip exportado do Letterboxd
 * (ex.: letterboxd-username-2026-10-25-16-03-utc.zip), combinando automaticamente
 * watched.csv, ratings.csv, diary.csv, reviews.csv, likes/films.csv, watchlist.csv e lists/*.csv.
 */
export async function parseLetterboxdZipArchive(
  buffer: ArrayBuffer,
  destination: ImportDestination,
): Promise<ParseFileResult> {
  const files = await extractTextFilesFromZip(buffer);
  const paths = Object.keys(files);

  const findCsv = (target: string): string | undefined => {
    const exact = files[target];
    if (exact) return exact;
    const suffixHit = paths.find((p) => p.endsWith(`/${target}`));
    return suffixHit ? files[suffixHit] : undefined;
  };

  const watchedCsv = findCsv('watched.csv');
  const ratingsCsv = findCsv('ratings.csv');
  const diaryCsv = findCsv('diary.csv');
  const reviewsCsv = findCsv('reviews.csv');
  const watchlistCsv = findCsv('watchlist.csv');
  const likesFilmsCsv = findCsv('likes/films.csv');

  const listPaths = paths.filter(
    (p) => p.startsWith('lists/') || p.includes('/lists/'),
  );

  const parsedWatched = watchedCsv
    ? parseImportFileContent(watchedCsv, 'watched.csv', 'profile').rows
    : [];
  const parsedRatings = ratingsCsv
    ? parseImportFileContent(ratingsCsv, 'ratings.csv', 'profile').rows
    : [];
  const parsedDiary = diaryCsv
    ? parseImportFileContent(diaryCsv, 'diary.csv', 'profile').rows
    : [];
  const parsedReviews = reviewsCsv
    ? parseImportFileContent(reviewsCsv, 'reviews.csv', 'profile').rows
    : [];
  const parsedLikes = likesFilmsCsv
    ? parseImportFileContent(likesFilmsCsv, 'likes/films.csv', 'profile').rows
    : [];
  const parsedWatchlist = watchlistCsv
    ? parseImportFileContent(watchlistCsv, 'watchlist.csv', 'watchlist').rows
    : [];

  const parsedLists: ParsedZipListBundle[] = [];
  for (const lp of listPaths) {
    const res = parseImportFileContent(files[lp], lp, 'list');
    if (res.ok && res.rows.length > 0) {
      const baseName =
        lp
          .split('/')
          .pop()
          ?.replace(/\.csv$/i, '')
          .replace(/[-_]+/g, ' ') || 'Imported List';
      parsedLists.push({
        fileName: lp,
        title: res.detectedListMeta?.title || baseName,
        description: res.detectedListMeta?.description || '',
        tags: res.detectedListMeta?.tags || [],
        rows: res.rows,
      });
    }
  }

  const zipExtras: ZipExtraBundles = {
    watchlistRows: parsedWatchlist,
    lists: parsedLists,
    fileCounts: {
      watched: parsedWatched.length,
      ratings: parsedRatings.length,
      diary: parsedDiary.length,
      reviews: parsedReviews.length,
      likes: parsedLikes.length,
      watchlist: parsedWatchlist.length,
      lists: parsedLists.length,
    },
  };

  // Se o destino selecionado for Watchlist, usa watchlist.csv diretamente
  if (destination === 'watchlist') {
    if (parsedWatchlist.length === 0) {
      return {
        ok: false,
        errorMessage: 'No films found in watchlist.csv inside the ZIP archive.',
        rows: [],
      };
    }
    return {
      ok: true,
      format: 'letterboxd_zip',
      rows: parsedWatchlist.map((r, i) => ({
        ...r,
        rowNumber: i + 1,
        sourceFile: 'watchlist.csv',
      })),
      zipExtras,
    };
  }

  // Se o destino selecionado for Lista, usa as listas em lists/*.csv
  if (destination === 'list') {
    if (parsedLists.length === 0) {
      return {
        ok: false,
        errorMessage: 'No list CSV files found inside the lists/ folder of the ZIP archive.',
        rows: [],
      };
    }
    const firstList = parsedLists[0];
    return {
      ok: true,
      format: 'letterboxd_zip',
      rows: firstList.rows.map((r, i) => ({
        ...r,
        rowNumber: i + 1,
        sourceFile: firstList.fileName,
      })),
      detectedListMeta: {
        title: firstList.title,
        description: firstList.description,
        tags: firstList.tags,
      },
      zipExtras,
    };
  }

  // Destino 'profile' (Conta / Filmes Assistidos + Diário + Avaliações + Reviews + Likes)
  const makeFilmKey = (r: ParsedImportRow): string => {
    if (r.letterboxdUri) return `uri:${r.letterboxdUri.toLowerCase()}`;
    return `ty:${normalizeTextForMatch(r.title)}:${r.year}`;
  };

  // 1. Mapa de filmes curtidos (likes/films.csv)
  const likedSet = new Set<string>();
  const likedTitleYearSet = new Set<string>();
  for (const l of parsedLikes) {
    likedSet.add(makeFilmKey(l));
    likedTitleYearSet.add(`ty:${normalizeTextForMatch(l.title)}:${l.year}`);
  }
  const isRowLiked = (r: ParsedImportRow): boolean =>
    r.liked ||
    likedSet.has(makeFilmKey(r)) ||
    likedTitleYearSet.has(`ty:${normalizeTextForMatch(r.title)}:${r.year}`);

  // 2. Mapa de notas gerais (ratings.csv)
  const ratingMap = new Map<string, number>();
  const ratingTitleYearMap = new Map<string, number>();
  for (const rt of parsedRatings) {
    if (rt.rating > 0) {
      ratingMap.set(makeFilmKey(rt), rt.rating);
      ratingTitleYearMap.set(`ty:${normalizeTextForMatch(rt.title)}:${rt.year}`, rt.rating);
    }
  }
  const getFallbackRating = (r: ParsedImportRow): number => {
    if (r.rating > 0) return r.rating;
    return (
      ratingMap.get(makeFilmKey(r)) ??
      ratingTitleYearMap.get(`ty:${normalizeTextForMatch(r.title)}:${r.year}`) ??
      0
    );
  };

  // 3. Mescla diary.csv + reviews.csv (ambos têm Watched Date ou reviews sem data)
  const mergedRows: ParsedImportRow[] = [];
  const diaryKeyMap = new Map<string, number>();
  const filmsCoveredByDiaryOrReviews = new Set<string>();

  for (const d of parsedDiary) {
    const fKey = makeFilmKey(d);
    const tyKey = `ty:${normalizeTextForMatch(d.title)}:${d.year}`;
    filmsCoveredByDiaryOrReviews.add(fKey);
    filmsCoveredByDiaryOrReviews.add(tyKey);

    const rowObj: ParsedImportRow = {
      ...d,
      rating: getFallbackRating(d),
      liked: isRowLiked(d),
      sourceFile: 'diary.csv',
    };
    const idx = mergedRows.length;
    mergedRows.push(rowObj);
    if (d.watchedDate) {
      diaryKeyMap.set(`${fKey}:${d.watchedDate}`, idx);
      diaryKeyMap.set(`${tyKey}:${d.watchedDate}`, idx);
    }
  }

  for (const rev of parsedReviews) {
    const fKey = makeFilmKey(rev);
    const tyKey = `ty:${normalizeTextForMatch(rev.title)}:${rev.year}`;
    filmsCoveredByDiaryOrReviews.add(fKey);
    filmsCoveredByDiaryOrReviews.add(tyKey);

    const existingIdx = rev.watchedDate
      ? (diaryKeyMap.get(`${fKey}:${rev.watchedDate}`) ??
        diaryKeyMap.get(`${tyKey}:${rev.watchedDate}`))
      : undefined;

    if (existingIdx !== undefined) {
      const target = mergedRows[existingIdx];
      mergedRows[existingIdx] = {
        ...target,
        rating: rev.rating > 0 ? rev.rating : target.rating,
        rewatch: target.rewatch || rev.rewatch,
        liked: target.liked || isRowLiked(rev),
        tags: Array.from(new Set([...target.tags, ...rev.tags])),
        review: rev.review || target.review,
        sourceFile: 'diary.csv + reviews.csv',
      };
    } else {
      mergedRows.push({
        ...rev,
        rating: getFallbackRating(rev),
        liked: isRowLiked(rev),
        sourceFile: 'reviews.csv',
      });
    }
  }

  // 4. Adiciona todos os filmes de watched.csv (e ratings.csv/likes/films.csv) que não estão no diário
  const seenWatchedOnly = new Set<string>(filmsCoveredByDiaryOrReviews);
  const allGeneralWatched = [...parsedWatched, ...parsedRatings, ...parsedLikes];

  for (const w of allGeneralWatched) {
    const fKey = makeFilmKey(w);
    const tyKey = `ty:${normalizeTextForMatch(w.title)}:${w.year}`;
    if (seenWatchedOnly.has(fKey) || seenWatchedOnly.has(tyKey)) continue;
    seenWatchedOnly.add(fKey);
    seenWatchedOnly.add(tyKey);

    mergedRows.push({
      ...w,
      watchedDate: '', // Filme assistido sem entrada datada no diário
      rating: getFallbackRating(w),
      rewatch: false,
      liked: isRowLiked(w),
      tags: [],
      review: '',
      sourceFile: 'watched.csv',
    });
  }

  if (mergedRows.length === 0) {
    return {
      ok: false,
      errorMessage: 'No watched films, diary entries, ratings, or reviews found in the ZIP archive.',
      rows: [],
      zipExtras,
    };
  }

  return {
    ok: true,
    format: 'letterboxd_zip',
    rows: mergedRows.map((r, idx) => ({ ...r, rowNumber: idx + 1 })),
    zipExtras,
  };
}

