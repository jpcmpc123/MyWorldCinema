import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Send, RotateCcw } from 'lucide-react';
import { PosterCard } from '../components/PosterCard';
import { tmdb } from '../services/tmdb';
import { useLanguage } from '../i18n/LanguageContext';
import {
  SUGGESTIONS_EN,
  SUGGESTIONS_PT,
  formatDecisionLine,
  preloadLayaWeights,
  recommendMovies,
  type ChatTurn,
  type LayaDecisions,
} from '../ai';

export type { LayaDecisions };

export const CineIaPage: React.FC = () => {
  const { language } = useLanguage();
  const { pathname } = useLocation();
  const isPt = language === 'pt-BR';
  const isActiveRoute = pathname === '/cine-ia';

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

  // Pré-aquece os pesos neurais (weights_5d.json) em background ao entrar na página
  useEffect(() => {
    if (isActiveRoute) {
      void preloadLayaWeights();
    }
  }, [isActiveRoute]);

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

  // Coleta IDs já exibidos na conversa para priorizar filmes inéditos em novos pedidos
  const seenMovieIds = useMemo(() => {
    const ids = new Set<number>();
    for (const t of turns) {
      if (t.movies) {
        for (const m of t.movies) {
          ids.add(m.id);
        }
      }
    }
    return ids;
  }, [turns]);

  const askRecommendation = async (rawText: string) => {
    const q = rawText.trim();
    if (!q) return;

    const turnId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setInput('');
    setTurns((prev) => [...prev, { id: turnId, query: q, loading: true }]);

    try {
      // Executa o motor unificado Laya 7D + TMDB diretamente com cache em memória
      const data = await recommendMovies(q, {
        language: isPt ? 'pt-BR' : 'en-US',
        excludeIds: seenMovieIds,
      });

      const movies = (data.movies || []).slice(0, 4);
      if (movies.length === 0) {
        throw new Error('Empty recommendation list');
      }

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                loading: false,
                decisions: data.decisions,
                referenceMovie: data.reference_movie,
                movies,
              }
            : t,
        ),
      );
    } catch {
      // Fallback secundário caso a rede falhe na busca específica
      try {
        const hub = await tmdb.getFilmsHubSections();
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  loading: false,
                  movies: hub.popular.slice(0, 4),
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
                    ? 'Não foi possível buscar recomendações agora. Tente novamente.'
                    : 'Could not fetch recommendations right now. Please try again.',
                }
              : t,
          ),
        );
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void askRecommendation(input);
  };

  const suggestions = isPt ? SUGGESTIONS_PT : SUGGESTIONS_EN;

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
              isPt
                ? 'Peça 4 filmes (ex: suspense coreano recente, sci-fi anos 80...)'
                : 'Ask for 4 films (e.g. recent Korean thriller, 80s sci-fi...)'
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
      {/* Área de mensagens / Estado inicial */}
      <div className="space-y-8">
        {turns.length === 0 ? (
          <div className="pt-2 md:pt-6 space-y-6">
            <div className="space-y-2 border-b border-[#1f2937] pb-4">
              <h1 className="text-lg md:text-2xl font-bold text-white tracking-tight">
                {isPt ? 'O que você quer assistir hoje?' : 'What do you want to watch today?'}
              </h1>
              <p className="text-xs md:text-sm text-[#99aabb] max-w-xl leading-relaxed">
                {isPt
                  ? 'Descreva o gênero, clima, época, país ou cite um filme que você gosta. Nossa IA analisa seu pedido e recomenda 4 filmes na hora.'
                  : 'Describe the genre, mood, decade, country, or mention a film you love. Our AI analyzes your request and recommends 4 films instantly.'}
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="text-[11px] uppercase tracking-wider font-bold text-[#99aabb]">
                {isPt ? 'Sugestões rápidas' : 'Quick prompts'}
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
            <div className="flex items-center justify-between border-b border-[#1f2937] pb-2.5">
              <span className="text-xs uppercase tracking-widest font-bold text-[#99aabb]">
                CINE IA
              </span>
              <button
                type="button"
                onClick={() => setTurns([])}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#99aabb] hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isPt ? 'Limpar conversa' : 'Clear chat'}</span>
              </button>
            </div>

            {turns.map((turn) => (
              <div key={turn.id} className="space-y-4">
                {/* Mensagem do Usuário */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[70%] bg-[#242c34] border border-white/10 text-white text-sm px-3.5 py-2.5 rounded-[6px]">
                    {turn.query}
                  </div>
                </div>

                {/* Resposta da IA + 4 Pôsteres no mesmo layout da página inicial */}
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
                    {turn.decisions && (
                      <p className="text-xs text-[#99aabb]">
                        {formatDecisionLine(turn.decisions, turn.referenceMovie, isPt)}
                      </p>
                    )}
                  </div>

                  {turn.loading ? (
                    <div className="grid grid-cols-4 gap-2 md:gap-2.5">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="aspect-[2/3] bg-lb-surface animate-pulse rounded-[4px] ring-1 ring-white/15"
                        />
                      ))}
                    </div>
                  ) : turn.error ? (
                    <p className="text-xs text-red-400 py-2">{turn.error}</p>
                  ) : turn.movies && turn.movies.length > 0 ? (
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
              </div>
            ))}
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
