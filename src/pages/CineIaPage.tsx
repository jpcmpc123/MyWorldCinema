import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Send, RotateCcw, Sparkles, Star, ChevronRight, Compass, Wand2 } from 'lucide-react';
import { PosterCard } from '../components/PosterCard';
import { useLanguage } from '../i18n/LanguageContext';
import {
  COMPILED_CONTEXT_RULES,
  COMPILED_DECADE_RULES,
  COMPILED_GENRE_RULES,
  COMPILED_MOOD_RULES,
  COMPILED_ORIGIN_RULES,
  COMPILED_PACING_RULES,
  GENRE_LABELS_PT,
  ORIGIN_LABELS_PT,
  formatDecisionLine,
  matchAkinatorProfile,
  matchFirstRule,
  recommendMovies,
  stripAccents,
  type AiMovie,
  type ChatTurn,
  type LayaDecisions,
  type RecommendResponse,
} from '../ai';

export type { LayaDecisions };

type CineIaMode = 'discover' | 'guess';

const CINE_IA_API_URL = 'https://vercelcineia.vercel.app/api/recommend';

const DISCOVER_SUGGESTIONS_PT: readonly string[] = [
  'Eu quero filme de anime francês',
  'Comédia nacional dos anos 80',
  'Terror psicológico sombrio recente',
  'Dorama coreano de romance emocionante lançamento recente',
  'Suspense psicológico tenso dos anos 90 com reviravolta',
  'Ficção científica no espaço dos anos 80',
];

const DISCOVER_SUGGESTIONS_EN: readonly string[] = [
  'I want a French animated film',
  'Brazilian comedy from the 80s',
  'Dark recent psychological horror',
  'Emotional recent Korean romance drama',
  'Intense 90s psychological thriller with mind-bending twist',
  '80s space sci-fi film',
];

const GUESS_SUGGESTIONS_PT: readonly string[] = [
  'Dois policiais do FBI se vestem de patricinhas loiras',
  'Pai fala com a filha pelo relógio no buraco negro',
  'Escolha da pílula vermelha ou azul e balas em câmera lenta',
  'Homem descobre que toda a sua cidade e vida é um reality show',
  'Navio transatlântico gigante que bate no iceberg e afunda',
  'Menino que vê gente morta andando e o psicólogo descobre que estava morto',
];

const GUESS_SUGGESTIONS_EN: readonly string[] = [
  'Two FBI agents disguise themselves as rich blonde girls',
  'Father communicates with his daughter through a watch in a black hole',
  'Red or blue pill choice and dodging bullets in slow motion',
  'Man discovers his entire town and life is a live TV reality show',
  'Giant ocean liner hits an iceberg and sinks in the freezing ocean',
  'Boy who sees dead people walking around',
];

function extractTmdbPath(urlOrPath?: string | null): string | null {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith('/')) return urlOrPath;
  const match = urlOrPath.match(/\/t\/p\/[^/]+(\/.+)$/);
  return match ? match[1] : urlOrPath;
}

function normalizeApiMovie(raw: any): AiMovie {
  const posterPath = extractTmdbPath(raw.poster_path || raw.poster_url);
  const backdropPath = extractTmdbPath(raw.backdrop_path || raw.backdrop_url);
  const posterUrl =
    raw.poster_url ||
    (posterPath
      ? posterPath.startsWith('http')
        ? posterPath
        : `https://image.tmdb.org/t/p/w500${posterPath}`
      : null);
  const backdropUrl =
    raw.backdrop_url ||
    (backdropPath
      ? backdropPath.startsWith('http')
        ? backdropPath
        : `https://image.tmdb.org/t/p/w1280${backdropPath}`
      : null);

  return {
    id: Number(raw.id),
    title: raw.title || raw.name || 'Sem título',
    original_title: raw.original_title || raw.title || '',
    poster_path: posterPath,
    backdrop_path: backdropPath,
    overview: raw.overview || '',
    release_date: raw.release_date || raw.first_air_date || '',
    vote_average: typeof raw.vote_average === 'number' ? raw.vote_average : 0,
    vote_count: typeof raw.vote_count === 'number' ? raw.vote_count : 0,
    popularity: typeof raw.popularity === 'number' ? raw.popularity : 0,
    genre_ids: Array.isArray(raw.genre_ids) ? raw.genre_ids : [],
    poster_url: posterUrl,
    backdrop_url: backdropUrl,
  };
}

export const CineIaPage: React.FC = () => {
  const { language } = useLanguage();
  const { pathname } = useLocation();
  const isPt = language === 'pt-BR';
  const isActiveRoute = pathname === '/cine-ia';

  const [mode, setMode] = useState<CineIaMode>('discover');
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxHeightRef = useRef<number>(
    typeof window !== 'undefined'
      ? Math.max(window.innerHeight, window.visualViewport?.height ?? 0)
      : 0,
  );

  // Detecta abertura do teclado virtual no celular (mesma regra da BottomNav)
  // para colar o campo de digitação em bottom: 0 quando a BottomNav se esconde
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkKeyboard = () => {
      if (window.innerWidth >= 768) {
        setIsKeyboardOpen(false);
        return;
      }
      const vvHeight = window.visualViewport?.height ?? window.innerHeight;
      const winHeight = window.innerHeight;
      const currentHeight = Math.min(vvHeight, winHeight);
      const activeEl = document.activeElement as HTMLElement | null;
      const isInputFocused = Boolean(
        activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable),
      );
      if (!isInputFocused && currentHeight > maxHeightRef.current) {
        maxHeightRef.current = currentHeight;
      }
      const screenBaseline =
        isInputFocused && window.screen?.height ? window.screen.height * 0.8 : 0;
      const baselineHeight = Math.max(maxHeightRef.current, winHeight, screenBaseline);
      const heightDrop = baselineHeight - currentHeight;
      setIsKeyboardOpen(heightDrop > 110);
    };

    checkKeyboard();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', checkKeyboard);
    vv?.addEventListener('scroll', checkKeyboard);
    window.addEventListener('resize', checkKeyboard);
    document.addEventListener('focusin', checkKeyboard);
    document.addEventListener('focusout', checkKeyboard);
    return () => {
      vv?.removeEventListener('resize', checkKeyboard);
      vv?.removeEventListener('scroll', checkKeyboard);
      window.removeEventListener('resize', checkKeyboard);
      document.removeEventListener('focusin', checkKeyboard);
      document.removeEventListener('focusout', checkKeyboard);
    };
  }, []);

  useEffect(() => {
    if (turns.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [turns]);

  const askRecommendation = async (rawText: string) => {
    const q = rawText.trim();
    if (!q) return;

    const currentMode = mode;
    const turnId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setInput('');
    setTurns((prev) => [
      ...prev,
      { id: turnId, query: q, mode: currentMode, loading: true },
    ]);

    try {
      const lang = isPt ? 'pt-BR' : 'en-US';
      const qNorm = stripAccents(q);
      const akinatorMatch = matchAkinatorProfile(qNorm);

      // Remove "filme " duplicado do início (ex: "filme onde..." -> "Qual é o nome daquele filme onde...")
      const cleanedGuessPrompt = q.replace(/^(?:um\s+|o\s+)?filme\s+/i, '');
      const apiQuery =
        currentMode === 'guess' &&
        !/^(qual\s+|aquele\s+filme|esqueci\s+o\s+nome|lembro\s+de)/i.test(q)
          ? `Qual é o nome daquele filme ${cleanedGuessPrompt}`
          : q;

      const response = await fetch(
        `${CINE_IA_API_URL}?q=${encodeURIComponent(apiQuery)}`,
      );
      if (!response.ok) {
        throw new Error(`API HTTP ${response.status}`);
      }
      const data: RecommendResponse = await response.json();

      const isGuessing = Boolean(
        currentMode === 'guess' ||
          data.is_guessing_movie ||
          data.decisions?.is_guessing_movie === 'yes' ||
          akinatorMatch,
      );
      let guessedMovie = data.guessed_movie
        ? normalizeApiMovie(data.guessed_movie)
        : null;
      const guessedTitle =
        data.guessed_title ||
        (data.decisions?.guess_title && data.decisions.guess_title !== 'none'
          ? data.decisions.guess_title
          : null) ||
        guessedMovie?.title ||
        (isGuessing && akinatorMatch ? akinatorMatch.title : null);

      let rawMovies = Array.isArray(data.movies)
        ? data.movies
            .filter((m) => m && m.title && m.title !== 'NULL' && (m.poster_path || m.poster_url))
            .map(normalizeApiMovie)
        : [];

      // Se estamos no modo Adivinhar (ou a pista Akinator casou) mas a API não trouxe o objeto guessed_movie,
      // busca os dados completos do filme identificado + 3 similares para renderizar o Card de Destaque
      if (isGuessing && !guessedMovie && guessedTitle) {
        const tmdbKey = '756b66f23e97ca70dba67363ba4e3b21';
        const searchRes = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&language=${lang}&query=${encodeURIComponent(
            guessedTitle,
          )}`,
        );
        if (searchRes.ok) {
          const searchJson = await searchRes.json();
          const topHit = (searchJson?.results || []).find(
            (m: any) => m && m.id && m.poster_path,
          );
          if (topHit) {
            guessedMovie = normalizeApiMovie(topHit);
            const simRes = await fetch(
              `https://api.themoviedb.org/3/movie/${topHit.id}/recommendations?api_key=${tmdbKey}&language=${lang}&page=1`,
            );
            if (simRes.ok) {
              const simJson = await simRes.json();
              const simMovies = (simJson?.results || [])
                .filter((m: any) => m && m.id && m.poster_path)
                .slice(0, 3)
                .map(normalizeApiMovie);
              if (simMovies.length > 0) {
                rawMovies = simMovies;
              }
            }
          }
        }
      }

      // Validação estrita de origem e dimensões para Descoberta 7D:
      // 1) Se o usuário especificou país explícito (ex: "francês", "coreano", "nacional"), respeita.
      // 2) Se o usuário NÃO especificou país (ex: "Terror psicológico sombrio recente"),
      //    a origem padrão DEVE ser 'hollywood' (internacional) e NUNCA 'national' (Brasil).
      const explicitOrigin = matchFirstRule(qNorm, COMPILED_ORIGIN_RULES, '' as any);
      const explicitGenre = matchFirstRule(qNorm, COMPILED_GENRE_RULES, '' as any);
      const explicitMood = matchFirstRule(qNorm, COMPILED_MOOD_RULES, '' as any);
      const explicitDecade = matchFirstRule(qNorm, COMPILED_DECADE_RULES, '' as any);
      const explicitPacing = matchFirstRule(qNorm, COMPILED_PACING_RULES, '' as any);
      const explicitContext = matchFirstRule(qNorm, COMPILED_CONTEXT_RULES, '' as any);

      const apiOrigin = data.decisions?.origin || 'hollywood';
      const resolvedOrigin = explicitOrigin
        ? explicitOrigin
        : apiOrigin === 'national'
          ? 'hollywood'
          : apiOrigin;

      const resolvedGenre = explicitGenre || data.decisions?.genre || 'drama';
      const resolvedMood = explicitMood || data.decisions?.mood || 'intense';
      const resolvedDecade = explicitDecade || data.decisions?.decade || 'modern';
      const resolvedPacing = explicitPacing || data.decisions?.pacing || 'fast';
      const resolvedContext =
        explicitContext || data.decisions?.context || data.decisions?.viewing_context || 'solo';

      const finalDecisions: LayaDecisions = {
        ...data.decisions,
        genre: resolvedGenre,
        genre_label: GENRE_LABELS_PT[resolvedGenre] || data.decisions?.genre_label,
        mood: resolvedMood,
        decade: resolvedDecade,
        origin: resolvedOrigin,
        origin_label: ORIGIN_LABELS_PT[resolvedOrigin] || data.decisions?.origin_label,
        pacing: resolvedPacing,
        context: resolvedContext,
      };

      const needsCatalogRefresh =
        !isGuessing &&
        (resolvedOrigin !== apiOrigin ||
          resolvedGenre !== data.decisions?.genre ||
          resolvedDecade !== data.decisions?.decade ||
          rawMovies.length < 4);

      if (needsCatalogRefresh) {
        const refined = await recommendMovies(q, {
          language: lang,
          bypassCache: true,
        });
        if (refined.movies && refined.movies.length > 0) {
          rawMovies = refined.movies.map(normalizeApiMovie);
        }
      }

      const movies =
        isGuessing && guessedMovie
          ? rawMovies.filter((m) => m.id !== guessedMovie.id).slice(0, 4)
          : rawMovies.slice(0, 4);

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                loading: false,
                mode: currentMode,
                isGuessingMovie: Boolean(isGuessing && guessedMovie),
                guessedTitle,
                guessedMovie,
                decisions: finalDecisions,
                referenceMovie: data.reference_movie,
                movies,
              }
            : t,
        ),
      );
    } catch {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                loading: false,
                error: isPt
                  ? 'Não foi possível conectar à API do CINE IA agora. Tente novamente.'
                  : 'Could not connect to the CINE IA API right now. Please try again.',
              }
            : t,
        ),
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void askRecommendation(input);
  };

  const suggestions =
    mode === 'guess'
      ? isPt
        ? GUESS_SUGGESTIONS_PT
        : GUESS_SUGGESTIONS_EN
      : isPt
        ? DISCOVER_SUGGESTIONS_PT
        : DISCOVER_SUGGESTIONS_EN;

  const chatInputBar = (
    <div
      data-h-scroll="true"
      className={`fixed inset-x-0 z-40 bg-[#14181c] border-t border-[#1f2937] ${
        isKeyboardOpen
          ? 'bottom-0'
          : 'bottom-[calc(60px+env(safe-area-inset-bottom,0px))] md:bottom-0'
      }`}
    >
      <div className="max-w-[950px] w-full mx-auto px-3 py-2 md:px-4 md:py-3">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 bg-[#1b2228] border border-white/15 focus-within:border-lb-green rounded-[6px] p-1.5 shadow-lg"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'guess'
                ? isPt
                  ? 'Descreva uma cena, personagem ou enredo para adivinhar o filme...'
                  : 'Describe a scene, character, or plot to guess the film...'
                : isPt
                  ? 'Peça 4 filmes (ex: anime francês, comédia anos 80, terror recente...)'
                  : 'Ask for 4 films (e.g. French anime, 80s comedy, recent horror...)'
            }
            className="flex-1 min-w-0 bg-transparent px-2.5 py-2 text-sm text-white placeholder-[#678] outline-none border-0"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label={isPt ? 'Enviar pedido' : 'Send request'}
            className="h-9 px-3.5 rounded-[4px] bg-lb-green hover:bg-lb-green-hover disabled:opacity-40 text-lb-bg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isPt ? 'Enviar' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="max-w-[950px] w-full mx-auto px-4 pt-4 md:pt-8 pb-24 md:pb-28 flex-1 flex flex-col">
      {/* Barra superior com os 2 botões para alternar entre Descobrir e Adivinhar */}
      <div className="flex items-center justify-between gap-3 border-b border-[#1f2937] pb-3 mb-6">
        <div className="inline-flex items-center p-1 rounded-[6px] bg-[#1b2228] border border-white/10">
          <button
            type="button"
            onClick={() => setMode('discover')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              mode === 'discover'
                ? 'bg-lb-green text-lb-bg shadow-sm'
                : 'text-[#99aabb] hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{isPt ? 'Descobrir' : 'Discover'}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('guess')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              mode === 'guess'
                ? 'bg-lb-green text-lb-bg shadow-sm'
                : 'text-[#99aabb] hover:text-white'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>{isPt ? 'Adivinhar' : 'Guess Film'}</span>
          </button>
        </div>

        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => setTurns([])}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#99aabb] hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isPt ? 'Limpar conversa' : 'Clear chat'}</span>
          </button>
        )}
      </div>

      {/* Área de mensagens / Estado inicial */}
      <div className="space-y-8">
        {turns.length === 0 ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-lg md:text-2xl font-bold text-white tracking-tight">
                {mode === 'guess'
                  ? isPt
                    ? 'Qual é o nome daquele filme?'
                    : 'What is the name of that film?'
                  : isPt
                    ? 'O que você quer assistir hoje?'
                    : 'What do you want to watch today?'}
              </h1>
              <p className="text-xs md:text-sm text-[#99aabb] max-w-2xl leading-relaxed">
                {mode === 'guess'
                  ? isPt
                    ? 'Descreva uma cena marcante, detalhe do enredo ou memória vaga. Nossa IA identifica o filme exato e ainda sugere títulos parecidos.'
                    : 'Describe a memorable scene, plot detail, or vague memory. Our AI identifies the exact film and suggests similar titles.'
                  : isPt
                    ? 'Combine gênero, nacionalidade, época ou estilo. Nossa IA analisa seu pedido em 7 dimensões e recomenda 4 filmes na hora.'
                    : 'Combine genre, nationality, era, or style. Our AI analyzes your request across 7 dimensions and recommends 4 films instantly.'}
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="text-[11px] uppercase tracking-wider font-bold text-[#99aabb]">
                {mode === 'guess'
                  ? isPt
                    ? 'Exemplos para adivinhar'
                    : 'Examples to guess'
                  : isPt
                    ? 'Sugestões para descobrir'
                    : 'Suggestions to discover'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestions.map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => void askRecommendation(text)}
                    className="text-left px-3.5 py-3 rounded-[4px] bg-[#1b2228] hover:bg-[#232c34] active:bg-[#28323c] border border-white/10 text-xs md:text-sm text-[#ddeeff] transition-colors cursor-pointer"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">

            {turns.map((turn) => {
              const decisionLine = formatDecisionLine(
                turn.decisions,
                turn.referenceMovie,
                isPt,
              );
              const guessedYear = turn.guessedMovie?.release_date
                ? turn.guessedMovie.release_date.slice(0, 4)
                : '';

              return (
                <div key={turn.id} className="space-y-4">
                  {/* Mensagem do Usuário */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] sm:max-w-[70%] bg-[#242c34] border border-white/10 text-white text-sm px-3.5 py-2.5 rounded-[6px]">
                      {turn.query}
                    </div>
                  </div>

                  {/* Resposta da IA */}
                  {turn.loading ? (
                    turn.mode === 'guess' ? (
                      <section className="rounded-[6px] bg-[#1b2228] border border-lb-green/25 p-4 flex gap-4 items-start animate-pulse">
                        <div className="w-24 sm:w-32 aspect-[2/3] bg-lb-surface rounded-[4px] shrink-0" />
                        <div className="flex-1 space-y-3 py-1">
                          <div className="h-4 w-32 bg-lb-surface rounded" />
                          <div className="h-6 w-56 bg-lb-surface rounded" />
                          <div className="h-3 w-full bg-lb-surface rounded" />
                          <div className="h-3 w-4/5 bg-lb-surface rounded" />
                        </div>
                      </section>
                    ) : (
                      <section className="space-y-3">
                        <div className="h-5 w-48 bg-lb-surface animate-pulse rounded-[4px]" />
                        <div className="grid grid-cols-4 gap-2 md:gap-2.5">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="aspect-[2/3] bg-lb-surface animate-pulse rounded-[4px] ring-1 ring-white/15"
                            />
                          ))}
                        </div>
                      </section>
                    )
                  ) : turn.error ? (
                    <p className="text-xs text-red-400 py-2">{turn.error}</p>
                  ) : (turn.isGuessingMovie || turn.mode === 'guess') && turn.guessedMovie ? (
                    <div className="space-y-5">
                      {/* Card de Destaque do Filme Adivinhado (Modo Akinator) */}
                      <div className="relative overflow-hidden rounded-[6px] bg-[#1b2228] border border-lb-green/35 shadow-xl">
                        {turn.guessedMovie.backdrop_url && (
                          <div className="absolute inset-0 pointer-events-none">
                            <img
                              src={turn.guessedMovie.backdrop_url}
                              alt=""
                              className="w-full h-full object-cover opacity-20"
                              loading="eager"
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-[#14181c] via-[#1b2228]/95 to-[#1b2228]/75" />
                          </div>
                        )}

                        <div className="relative z-10 p-3.5 sm:p-5 flex gap-3.5 sm:gap-5 items-start">
                          <div className="w-24 sm:w-32 md:w-36 shrink-0 rounded-[4px] ring-1 ring-lb-green/50 overflow-hidden shadow-lg">
                            <PosterCard
                              movie={turn.guessedMovie}
                              size="fluid"
                              showDetails={false}
                              disableHoverActions
                              eager
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] bg-lb-green/15 border border-lb-green/30 text-lb-green text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                              <Sparkles className="w-3 h-3" />
                              <span>
                                {isPt ? 'Filme Identificado' : 'Identified Film'}
                              </span>
                            </div>

                            <div>
                              <Link
                                to={`/film/${turn.guessedMovie.id}`}
                                className="text-base sm:text-lg md:text-xl font-bold text-white hover:text-lb-green transition-colors leading-snug inline-block"
                              >
                                {turn.guessedMovie.title || turn.guessedTitle}
                              </Link>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#99aabb]">
                                {guessedYear && <span>{guessedYear}</span>}
                                {turn.guessedMovie.vote_average > 0 && (
                                  <span className="inline-flex items-center gap-1 text-lb-green font-semibold">
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                    {turn.guessedMovie.vote_average.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {turn.guessExplanation && (
                              <p className="text-xs sm:text-sm text-lb-green/95 bg-lb-green/10 border border-lb-green/25 rounded-[4px] px-2.5 py-1.5 leading-relaxed">
                                {turn.guessExplanation}
                              </p>
                            )}

                            {turn.guessedMovie.overview && (
                              <p className="text-xs sm:text-sm text-[#bbccdd] line-clamp-3 sm:line-clamp-4 leading-relaxed">
                                {turn.guessedMovie.overview}
                              </p>
                            )}

                            <div className="pt-1">
                              <Link
                                to={`/film/${turn.guessedMovie.id}`}
                                className="inline-flex items-center gap-1 text-xs font-bold text-lb-green hover:underline"
                              >
                                <span>
                                  {isPt ? 'Ver página do filme' : 'View film page'}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Filmes similares retornados no array movies */}
                      {turn.movies && turn.movies.length > 0 && (
                        <section className="space-y-2.5">
                          <div className="flex flex-col gap-0.5">
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#99aabb]">
                              {isPt
                                ? `Filmes similares a ${turn.guessedMovie.title || turn.guessedTitle}`
                                : `Films similar to ${turn.guessedMovie.title || turn.guessedTitle}`}
                            </h3>
                          </div>
                          <div
                            className={`grid gap-2 md:gap-2.5 ${
                              turn.movies.length === 3 ? 'grid-cols-3' : 'grid-cols-4'
                            }`}
                          >
                            {turn.movies.slice(0, 4).map((movie) => (
                              <div
                                key={movie.id}
                                className="rounded-[4px] ring-1 ring-white/15 overflow-hidden"
                              >
                                <PosterCard
                                  movie={movie}
                                  size="fluid"
                                  showDetails={false}
                                  disableHoverActions
                                  eager
                                />
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  ) : turn.mode === 'guess' ? (
                    <div className="rounded-[6px] bg-[#1b2228] border border-white/10 p-4 space-y-1.5">
                      <p className="text-sm font-bold text-white">
                        {isPt
                          ? 'Não conseguimos cravar o filme apenas com essa pista'
                          : 'Could not pinpoint the exact film from this clue alone'}
                      </p>
                      <p className="text-xs text-[#99aabb] leading-relaxed">
                        {isPt
                          ? 'Tente acrescentar mais um detalhe da história (como um personagem, ator, final do filme ou época aproximada) para identificarmos o título exato.'
                          : 'Try adding one more plot detail (such as a character, actor, ending, or approximate era) so we can identify the exact title.'}
                      </p>
                    </div>
                  ) : (
                    /* Descoberta de Catálogo 7D: 4 Pôsteres */
                    <section className="space-y-3">
                      <div className="flex flex-col gap-0.5">
                        <h2 className="text-sm md:text-base font-bold text-white">
                          {turn.referenceMovie
                            ? isPt
                              ? `Recomendações similares a ${turn.referenceMovie}`
                              : `Recommendations similar to ${turn.referenceMovie}`
                            : isPt
                              ? '4 filmes recomendados para você'
                              : '4 films recommended for you'}
                        </h2>
                        {decisionLine && (
                          <p className="text-xs text-[#99aabb]">{decisionLine}</p>
                        )}
                      </div>

                      {turn.movies && turn.movies.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2 md:gap-2.5">
                          {turn.movies.slice(0, 4).map((movie) => (
                            <div
                              key={movie.id}
                              className="rounded-[4px] ring-1 ring-white/15 overflow-hidden"
                            >
                              <PosterCard
                                movie={movie}
                                size="fluid"
                                showDetails={false}
                                disableHoverActions
                                eager
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#99aabb] py-2">
                          {isPt
                            ? 'Nenhum filme encontrado para esses critérios. Tente descrever de outra forma.'
                            : 'No films found for these criteria. Try phrasing your request differently.'}
                        </p>
                      )}
                    </section>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Barra de digitação grudada na parte de baixo da tela */}
      {isActiveRoute && typeof document !== 'undefined'
        ? createPortal(chatInputBar, document.body)
        : null}
    </div>
  );
};

export default CineIaPage;
