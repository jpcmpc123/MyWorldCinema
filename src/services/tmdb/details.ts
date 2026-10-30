import {
  collectionDetailsCache,
  curatedBackdropCache,
  curatedPosterCache,
  mediaDetailsCache,
  personDetailsCache,
  similarProfileCache,
} from './cache';
import {
  fetchFromTMDB,
  getTmdbLanguage,
  itemDate,
  normalizeMediaItem,
  TMDB_TODAY,
  TV_EXCLUDED_GENRE_IDS,
} from './client';
import {
  filterAndRankBackdrops,
  filterAndRankPosters,
  pickBestBackdropPath,
  pickBestPosterPath,
} from './posterFilter';
import { curateSimilarForDetails, rankSimilarCandidates } from './similar';
import type {
  TMDBCollectionDetails,
  TMDBMovie,
  TMDBMovieDetails,
  TMDBMovieImages,
  TMDBPerson,
  TMDBPersonDetails,
  TMDBPersonMovieCredit,
  TMDBPersonMovieCredits,
  TMDBRawMediaPayload,
  TMDBResponse,
} from './types';

const IMAGE_LANGUAGES_PARAM = 'en,pt,ja,ko,fr,es,it,de,null';

export async function getMovieDetails(id: number): Promise<TMDBMovieDetails> {
  const lang = getTmdbLanguage();
  const cacheKey = `movie:${id}:${lang}`;
  const cached = mediaDetailsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let movie: TMDBMovieDetails;
  try {
    movie = await fetchFromTMDB<TMDBMovieDetails>(`/movie/${id}`, {
      append_to_response:
        'credits,similar,recommendations,watch/providers,videos,release_dates,external_ids,alternative_titles,images',
      include_image_language: IMAGE_LANGUAGES_PARAM,
    });
  } catch {
    movie = await fetchFromTMDB<TMDBMovieDetails>(`/movie/${id}`, {
      append_to_response: 'credits,videos,release_dates,similar,images',
      include_image_language: IMAGE_LANGUAGES_PARAM,
    });
  }

  const cachedCanonicalPoster = curatedPosterCache.get(id);
  if (cachedCanonicalPoster) {
    movie.poster_path = cachedCanonicalPoster;
  }

  const needsEnFallback =
    (lang !== 'en-US' && !cachedCanonicalPoster) ||
    !movie.overview ||
    !movie.backdrop_path ||
    (!movie.credits?.cast?.length && !movie.credits?.crew?.length);
  if (needsEnFallback) {
    try {
      const en = await fetchFromTMDB<TMDBMovieDetails>(`/movie/${id}`, {
        language: 'en-US',
        append_to_response: 'credits,videos,release_dates',
      });
      if (!movie.overview && en.overview) movie.overview = en.overview;
      if (!movie.tagline && en.tagline) movie.tagline = en.tagline;
      if (!movie.runtime && en.runtime) movie.runtime = en.runtime;
      if (!movie.backdrop_path && en.backdrop_path) movie.backdrop_path = en.backdrop_path;
      if (!cachedCanonicalPoster && en.poster_path) movie.poster_path = en.poster_path;
      if (!movie.credits?.cast?.length && en.credits?.cast?.length) {
        movie.credits = {
          cast: en.credits.cast,
          crew: movie.credits?.crew?.length ? movie.credits.crew : (en.credits.crew || []),
        };
      } else if (!movie.credits?.crew?.length && en.credits?.crew?.length) {
        movie.credits = {
          cast: movie.credits?.cast || [],
          crew: en.credits.crew,
        };
      }
    } catch {
      /* mantém dados atuais */
    }
  }

  // Mantém o pôster padrão oficial (100% igual ao das abas Filmes/Séries)
  const bestPoster =
    cachedCanonicalPoster ||
    pickBestPosterPath(movie.images?.posters, movie.poster_path, {
      originalLanguage: movie.original_language,
      uiLanguage: lang,
    });
  if (bestPoster) {
    movie.poster_path = bestPoster;
    curatedPosterCache.set(movie.id, bestPoster);
  }

  if (!movie.credits) {
    movie.credits = { cast: [], crew: [] };
  }

  if (!movie.backdrop_path) {
    movie.backdrop_path = movie.poster_path || null;
  }

  const [similarRanked, collectionDetails] = await Promise.all([
    curateSimilarForDetails(movie, 'movie', true),
    movie.belongs_to_collection?.id
      ? getCollectionDetails(movie.belongs_to_collection.id).catch(() => null)
      : Promise.resolve(null),
  ]);
  movie.similar = { results: similarRanked };
  if (collectionDetails) {
    if (movie.belongs_to_collection && collectionDetails.name) {
      movie.belongs_to_collection.name = collectionDetails.name;
    }
    movie.collection_parts = collectionDetails.parts;
  }
  mediaDetailsCache.set(cacheKey, movie);
  return movie;
}

export async function getTVDetails(id: number): Promise<TMDBMovieDetails> {
  const lang = getTmdbLanguage();
  const cacheKey = `tv:${id}:${lang}`;
  const cached = mediaDetailsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let show: TMDBMovieDetails & Partial<TMDBRawMediaPayload>;
  try {
    show = await fetchFromTMDB<TMDBMovieDetails & Partial<TMDBRawMediaPayload>>(`/tv/${id}`, {
      append_to_response:
        'credits,aggregate_credits,similar,recommendations,watch/providers,videos,content_ratings,external_ids,alternative_titles,images',
      include_image_language: IMAGE_LANGUAGES_PARAM,
    });
  } catch {
    show = await fetchFromTMDB<TMDBMovieDetails & Partial<TMDBRawMediaPayload>>(`/tv/${id}`, {
      append_to_response: 'credits,aggregate_credits,videos,content_ratings,similar,images',
      include_image_language: IMAGE_LANGUAGES_PARAM,
    });
  }

  const cachedCanonicalPoster = curatedPosterCache.get(id);
  if (cachedCanonicalPoster) {
    show.poster_path = cachedCanonicalPoster;
  }

  const needsEnFallback =
    (lang !== 'en-US' && !cachedCanonicalPoster) ||
    !show.overview ||
    !show.backdrop_path ||
    (!show.credits?.cast?.length && !show.credits?.crew?.length);
  if (needsEnFallback) {
    try {
      const en = await fetchFromTMDB<TMDBMovieDetails>(`/tv/${id}`, {
        language: 'en-US',
        append_to_response: 'credits,aggregate_credits',
      });
      if (!show.overview && en.overview) show.overview = en.overview;
      if (!show.tagline && en.tagline) show.tagline = en.tagline;
      if (!show.backdrop_path && en.backdrop_path) show.backdrop_path = en.backdrop_path;
      if (!cachedCanonicalPoster && en.poster_path) show.poster_path = en.poster_path;
      if (!show.credits?.cast?.length && en.credits?.cast?.length) {
        show.credits = {
          cast: en.credits.cast,
          crew: show.credits?.crew?.length ? show.credits.crew : (en.credits.crew || []),
        };
      }
    } catch {
      /* mantém vazio */
    }
  }

  // Mantém o pôster padrão oficial (100% igual ao das abas Filmes/Séries)
  const bestPoster =
    cachedCanonicalPoster ||
    pickBestPosterPath(show.images?.posters, show.poster_path, {
      originalLanguage: show.original_language,
      uiLanguage: lang,
    });
  if (bestPoster) {
    show.poster_path = bestPoster;
    curatedPosterCache.set(show.id, bestPoster);
  }

  if (!show.backdrop_path) {
    show.backdrop_path = show.poster_path || null;
  }
  show.title = show.name || show.title || '';
  show.original_title = show.original_name || show.title;
  show.release_date = show.first_air_date || show.release_date || '';
  const ert = show.episode_run_time;
  const lastEp = show.last_episode_to_air;
  const nextEp = show.next_episode_to_air;
  show.runtime =
    (Array.isArray(ert) && ert.length ? ert[0] : 0) ||
    lastEp?.runtime ||
    nextEp?.runtime ||
    show.runtime ||
    0;

  if (!show.credits) {
    show.credits = { cast: [], crew: [] };
  }

  const aggCredits = show.aggregate_credits;
  if (aggCredits?.cast?.length) {
    const existingById = new Map(show.credits.cast.map((c) => [c.id, c]));
    for (let idx = 0; idx < aggCredits.cast.length; idx++) {
      const ac = aggCredits.cast[idx];
      const roleNames = Array.from(
        new Set(
          (ac.roles ?? [])
            .map((r) => r.character?.trim())
            .filter((ch): ch is string => Boolean(ch)),
        ),
      );
      const characterStr = roleNames.join(' / ');
      const existing = existingById.get(ac.id);
      if (existing) {
        if (!existing.character && characterStr) {
          existing.character = characterStr;
        }
        if (!existing.profile_path && ac.profile_path) {
          existing.profile_path = ac.profile_path;
        }
      } else {
        const entry = {
          id: ac.id,
          name: ac.name,
          character: characterStr,
          profile_path: ac.profile_path ?? null,
          order: ac.order ?? show.credits.cast.length + idx,
        };
        show.credits.cast.push(entry);
        existingById.set(ac.id, entry);
      }
    }
  }

  if (aggCredits?.crew?.length) {
    for (const ac of aggCredits.crew) {
      for (const j of ac.jobs ?? []) {
        const normalizedJob = j.job === 'Series Director' ? 'Director' : j.job;
        const alreadyExists = show.credits.crew.some(
          (m) => m.id === ac.id && (m.job === normalizedJob || m.job === j.job),
        );
        if (!alreadyExists) {
          show.credits.crew.push({
            id: ac.id,
            name: ac.name,
            job: normalizedJob,
            department: ac.department || 'Directing',
            profile_path: ac.profile_path ?? null,
          });
        }
      }
    }
  }

  const createdBy = show.created_by || [];
  if (createdBy.length > 0) {
    for (const c of createdBy) {
      const existente = show.credits.crew.find((m) => m.id === c.id);
      if (existente) existente.job = 'Creator';
      else
        show.credits.crew.unshift({
          id: c.id,
          name: c.name,
          job: 'Creator',
          department: 'Production',
          profile_path: c.profile_path ?? null,
        });
    }
  } else if (!show.credits.crew.some((m) => m.job === 'Creator')) {
    const ORIGINAL_CREATOR_JOBS = [
      'Original Creator',
      'Original Series Creator',
      'Original Story',
      'Original Concept',
      'Graphic Novel',
      'Comic Book',
      'Manga',
      'Novel',
      'Author',
    ];
    const fallbackCreator =
      show.credits.crew.find((m) => ORIGINAL_CREATOR_JOBS.includes(m.job)) ||
      show.credits.crew.find((m) => m.job === 'Series Director' || m.job === 'Director') ||
      show.credits.crew.find((m) =>
        ['Series Composition', 'Writer', 'Screenplay', 'Script'].includes(m.job),
      ) ||
      show.credits.crew.find((m) => m.job === 'Executive Producer' || m.job === 'Producer');
    if (fallbackCreator && fallbackCreator.job !== 'Director') {
      show.credits.crew.unshift({
        ...fallbackCreator,
        job: 'Creator',
      });
    }
  }

  if (show.similar) show.similar.results = show.similar.results.map(normalizeMediaItem);
  if (show.recommendations) {
    show.recommendations.results = show.recommendations.results.map(normalizeMediaItem);
  }
  const similarRanked = await curateSimilarForDetails(show, 'tv', true);
  show.similar = { results: similarRanked };
  mediaDetailsCache.set(cacheKey, show);
  return show;
}

export async function getMovieImages(
  id: number,
  mediaType: 'movie' | 'tv' = 'movie',
): Promise<TMDBMovieImages> {
  const lang = getTmdbLanguage();
  const cachedDetails = mediaDetailsCache.get(`${mediaType}:${id}:${lang}`);
  const raw = await fetchFromTMDB<TMDBMovieImages>(`/${mediaType}/${id}/images`, {
    include_image_language: IMAGE_LANGUAGES_PARAM,
  });
  return {
    id: raw.id,
    posters: filterAndRankPosters(raw.posters, {
      originalLanguage: cachedDetails?.original_language,
      uiLanguage: lang,
    }),
    backdrops: filterAndRankBackdrops(raw.backdrops),
  };
}

export async function getCollectionDetails(collectionId: number): Promise<TMDBCollectionDetails> {
  const lang = getTmdbLanguage();
  const cacheKey = `collection:${collectionId}:${lang}`;
  const cached = collectionDetailsCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const col = await fetchFromTMDB<TMDBCollectionDetails>(`/collection/${collectionId}`);
  let rawParts = (col.parts || []).map(normalizeMediaItem);

  if (lang !== 'en-US') {
    try {
      const enCol = await fetchFromTMDB<TMDBCollectionDetails>(`/collection/${collectionId}`, {
        language: 'en-US',
      });
      if (enCol.poster_path) col.poster_path = enCol.poster_path;
      if (enCol.backdrop_path) col.backdrop_path = enCol.backdrop_path;
      const enById = new Map((enCol.parts || []).map((p) => [p.id, normalizeMediaItem(p)]));
      rawParts = rawParts.map((part) => {
        const enPart = enById.get(part.id);
        if (!enPart) return part;
        const bestPoster =
          curatedPosterCache.get(part.id) || enPart.poster_path || part.poster_path || null;
        return {
          ...part,
          poster_path: bestPoster,
          backdrop_path: part.backdrop_path || enPart.backdrop_path || null,
          overview: part.overview || enPart.overview || '',
          release_date: part.release_date || enPart.release_date || '',
        };
      });
    } catch {
      /* mantém partes atuais */
    }
  }

  const parts = rawParts
    .filter((m) => Boolean(m.id && (m.title || m.original_title)))
    .sort((a, b) => {
      const da = itemDate(a) || '9999-12-31';
      const db = itemDate(b) || '9999-12-31';
      return da.localeCompare(db);
    });
  const result: TMDBCollectionDetails = {
    ...col,
    parts,
  };
  collectionDetailsCache.set(cacheKey, result);
  return result;
}

export async function getSimilarMedia(
  type: 'movie' | 'tv',
  id: number,
  page = 1,
): Promise<TMDBResponse<TMDBMovie>> {
  const lang = getTmdbLanguage();
  const cacheKey = `${type}:${id}:${lang}`;
  let profile = similarProfileCache.get(cacheKey);

  if (!profile) {
    const details = type === 'tv' ? await getTVDetails(id) : await getMovieDetails(id);
    profile = similarProfileCache.get(cacheKey);
    if (!profile) {
      return {
        page: 1,
        results: details.similar?.results || [],
        total_pages: 1,
        total_results: (details.similar?.results || []).length,
      };
    }
  }

  if (page === 1) {
    return {
      page: 1,
      results: profile.rankedPool,
      total_pages: 5,
      total_results: Math.max(profile.rankedPool.length, 80),
    };
  }

  const recPage = page + 1;
  const [recRes, kwRes, simRes] = await Promise.allSettled([
    fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/${type}/${id}/recommendations`, { page: recPage }),
    profile.genreIds.length > 0
      ? fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/discover/${type}`, {
          with_genres: profile.genreIds.slice(0, 2).join(','),
          ...(profile.keywordIds.length > 0
            ? { with_keywords: profile.keywordIds.slice(0, 4).join('|') }
            : {}),
          sort_by: 'vote_count.desc',
          'vote_count.gte': type === 'tv' ? 40 : 120,
          page,
        })
      : Promise.resolve({ results: [] as TMDBMovie[], page, total_pages: 1, total_results: 0 }),
    fetchFromTMDB<TMDBResponse<TMDBMovie>>(`/${type}/${id}/similar`, { page }),
  ]);

  const rankedPage = rankSimilarCandidates(profile, {
    recommendations: recRes.status === 'fulfilled' ? recRes.value.results || [] : [],
    keywordDiscover: kwRes.status === 'fulfilled' ? kwRes.value.results || [] : [],
    similar: simRes.status === 'fulfilled' ? simRes.value.results || [] : [],
  });

  return {
    page,
    results: rankedPage,
    total_pages: 5,
    total_results: 100,
  };
}

export async function getPerson(id: number): Promise<TMDBPerson> {
  return fetchFromTMDB<TMDBPerson>(`/person/${id}`);
}

export async function getPersonMovieCredits(id: number): Promise<TMDBPersonMovieCredits> {
  return fetchFromTMDB<TMDBPersonMovieCredits>(`/person/${id}/movie_credits`);
}

export async function getPersonDetails(id: number): Promise<TMDBPersonDetails> {
  const lang = getTmdbLanguage();
  const cacheKey = `person:${id}:${lang}`;
  const cached = personDetailsCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const person = await fetchFromTMDB<TMDBPersonDetails>(`/person/${id}`, {
    append_to_response: 'movie_credits,tv_credits,external_ids',
  });
  const enPosterById = new Map<number, string>();
  if (lang !== 'en-US') {
    try {
      const en = await fetchFromTMDB<TMDBPersonDetails>(`/person/${id}`, {
        language: 'en-US',
        append_to_response: 'movie_credits,tv_credits,external_ids',
      });
      if (!person.biography?.trim() && en.biography?.trim()) person.biography = en.biography;
      if (!person.movie_credits && en.movie_credits) person.movie_credits = en.movie_credits;
      if (!person.tv_credits && en.tv_credits) person.tv_credits = en.tv_credits;
      if (!person.external_ids && en.external_ids) person.external_ids = en.external_ids;
      for (const list of [
        en.movie_credits?.cast,
        en.movie_credits?.crew,
        en.tv_credits?.cast,
        en.tv_credits?.crew,
      ]) {
        for (const item of list ?? []) {
          if (item?.id && item.poster_path) {
            enPosterById.set(item.id, item.poster_path);
          }
        }
      }
    } catch {
      /* fallback para Wikipedia logo abaixo */
    }
  }

  const defaultWikiLang = lang === 'pt-BR' ? 'pt' : 'en';
  person.wikipedia_url = `https://${defaultWikiLang}.wikipedia.org/wiki/${encodeURIComponent(
    (person.name || '').trim().replace(/\s+/g, '_'),
  )}`;

  if (!person.biography?.trim() && person.name) {
    const wikiLangs = lang === 'pt-BR' ? ['pt', 'en'] : ['en', 'pt'];
    const slug = encodeURIComponent(person.name.trim().replace(/\s+/g, '_'));
    for (const wLang of wikiLangs) {
      try {
        const res = await fetch(`https://${wLang}.wikipedia.org/api/rest_v1/page/summary/${slug}`);
        if (!res.ok) continue;
        const data = (await res.json()) as {
          type?: string;
          extract?: string;
          content_urls?: { desktop?: { page?: string } };
        };
        if (data && data.type !== 'disambiguation' && data.extract?.trim()) {
          person.biography = data.extract.trim();
          if (data.content_urls?.desktop?.page) {
            person.wikipedia_url = data.content_urls.desktop.page;
          }
          break;
        }
      } catch {
        /* tenta próximo idioma */
      }
    }
  }

  const SELF_GUEST_RE =
    /^(self|himself|herself|ele mesmo|ela mesma|archive footage)(\b|\s*[-–—(])/i;

  const resolveCreditPoster = (c: TMDBPersonMovieCredit): string | null =>
    curatedPosterCache.get(c.id) || enPosterById.get(c.id) || c.poster_path || null;

  const normalizeTv = (
    list?: (TMDBPersonMovieCredit & Partial<TMDBRawMediaPayload>)[],
    isCast = false,
  ): TMDBPersonMovieCredit[] =>
    (list ?? [])
      .map((c) => ({
        ...c,
        poster_path: resolveCreditPoster(c),
      }))
      .filter((c) => {
        if (!c.poster_path) return false;
        if (c.genre_ids?.some((g) => TV_EXCLUDED_GENRE_IDS.has(g))) return false;
        if (isCast && c.character && SELF_GUEST_RE.test(c.character.trim())) return false;
        return true;
      })
      .map((c) => ({
        ...c,
        title: c.title || c.name || '',
        original_title: c.original_title || c.original_name || c.name || '',
        release_date: c.release_date || c.first_air_date || '',
        media_type: 'tv' as const,
      }));

  const normalizeMovie = (list?: TMDBPersonMovieCredit[]): TMDBPersonMovieCredit[] =>
    (list ?? [])
      .map((c) => ({
        ...c,
        poster_path: resolveCreditPoster(c),
      }))
      .filter((c) => Boolean(c.poster_path))
      .map((c) => ({
        ...c,
        media_type: 'movie' as const,
      }));

  if (person.movie_credits) {
    person.movie_credits.cast = normalizeMovie(person.movie_credits.cast);
    person.movie_credits.crew = normalizeMovie(person.movie_credits.crew);
  }
  if (person.tv_credits) {
    person.tv_credits.cast = normalizeTv(person.tv_credits.cast, true);
    person.tv_credits.crew = normalizeTv(person.tv_credits.crew, false);
  }
  personDetailsCache.set(cacheKey, person);
  return person;
}

export async function getPersonProviderMediaKeys(
  personId: number,
  providerId: number,
  credits: TMDBPersonMovieCredit[],
): Promise<Set<string>> {
  const matched = new Set<string>();
  try {
    const [usMovies, brMovies] = await Promise.allSettled([
      fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
        with_people: personId,
        with_watch_providers: providerId,
        watch_region: 'US',
        page: 1,
      }),
      fetchFromTMDB<TMDBResponse<TMDBMovie>>('/discover/movie', {
        with_people: personId,
        with_watch_providers: providerId,
        watch_region: 'BR',
        page: 1,
      }),
    ]);
    if (usMovies.status === 'fulfilled') {
      usMovies.value.results?.forEach((m) => matched.add(`movie:${m.id}`));
    }
    if (brMovies.status === 'fulfilled') {
      brMovies.value.results?.forEach((m) => matched.add(`movie:${m.id}`));
    }

    const topToVerify = credits
      .filter((c) => !matched.has(`${c.media_type ?? 'movie'}:${c.id}`))
      .slice(0, 24);

    await Promise.allSettled(
      topToVerify.map(async (item) => {
        const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
        const wp = await fetchFromTMDB<{
          results?: Record<
            string,
            {
              flatrate?: { provider_id: number }[];
              rent?: { provider_id: number }[];
              buy?: { provider_id: number }[];
            }
          >;
        }>(`/${mediaType}/${item.id}/watch/providers`);
        const regions = wp?.results ?? {};
        for (const reg of ['BR', 'US', 'GB']) {
          const r = regions[reg];
          if (!r) continue;
          const all = [...(r.flatrate ?? []), ...(r.rent ?? []), ...(r.buy ?? [])];
          if (all.some((p) => p.provider_id === providerId)) {
            matched.add(`${mediaType}:${item.id}`);
            break;
          }
        }
      }),
    );
  } catch {
    /* mantém o que já coletou */
  }
  return matched;
}
