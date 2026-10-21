import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Eye } from 'lucide-react';
import type { TMDBMovie } from '../../services/tmdb';
import { PosterCard } from '../PosterCard';
import { useLanguage } from '../../i18n/LanguageContext';

// ---------------------------------------------------------------------------
// MobileCatalogSections — SOMENTE mobile (md:hidden).
// Estrutura IDÊNTICA para a aba Films e a aba Series do app Android:
//   1. Popular this week    (4 pôsteres limpos)
//   2. Highest rated        (4 pôsteres + nota em estrelas/número abaixo)
//   3. Most watched         (4 pôsteres + olho verde + contagem)
//   4. Most anticipated     (4 pôsteres limpos — "Just reviewed" em séries)
// Cada cabeçalho navega para a grade completa de 4 colunas já filtrada.
//
// ESPAÇAMENTO VERTICAL COMPARTILHADO (as 4 abas usam este mesmo componente, logo
// as medidas abaixo são idênticas em FILMES, SÉRIES, CRÍTICAS e LISTAS):
//   • grade de pôsteres → divisória ......... 32px  (space-y-8 no root)
//   • divisória → título da próxima seção ... 25px  (1px border-t + pt-6 = 24px)
//   • total grade → título seguinte ......... 57px
//   • título da seção → carrossel ........... 16px  (space-y-3)
//   • respiro superior (aba → 1º título) .... 16px  (pt-4 no wrapper de cada página)
// ---------------------------------------------------------------------------

interface MobileCatalogSectionsProps {
  /** Caminho base da categoria: '/films' ou '/series' */
  basePath: '/films' | '/series';
  popular: TMDBMovie[];
  topRated: TMDBMovie[];
  /** Lista curada de "Most watched" (quando ausente, deriva de `popular`) */
  mostWatched?: TMDBMovie[];
  anticipated: TMDBMovie[];
  loading: boolean;
}

const SectionShell: React.FC<{
  title: string;
  to: string;
  /** Itens já carregados — navegação com state p/ ordem idêntica à Home */
  state?: { initialItems: TMDBMovie[] };
  divider?: boolean;
  children: React.ReactNode;
}> = ({ title, to, state, divider = true, children }) => (
  <section className={`space-y-3 ${divider ? 'border-t border-[#1f2937] pt-6' : ''}`}>
    {/* Título + seta abrem a tela de resultados (/browse/results) com a
        lista já carregada via state — ordem 100% idêntica ao carrossel */}
    <Link to={to} state={state} className="flex items-center justify-between group">
      <h2 className="text-lg font-bold text-white group-active:text-lb-green">{title}</h2>
      <ChevronRight className="w-5 h-5 text-lb-muted group-active:text-lb-green" />
    </Link>
    {children}
  </section>
);

const PosterShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-[4px] ring-1 ring-white/15 overflow-hidden">{children}</div>
);

// Largura exata de cada pôster no carrossel: cabem 4 inteiros na tela
// (100vw - px-4 dos dois lados (32px) - 3 gaps de 8px (24px)) / 4
const ITEM_W = 'w-[calc((100vw-32px-24px)/4)] shrink-0';

const SkeletonRow: React.FC = () => (
  <div data-h-scroll="true" className="flex gap-2 overflow-x-hidden -mx-4 px-4">
    {[...Array(4)].map((_, i) => (
      <div key={i} className={`${ITEM_W} aspect-[2/3] bg-lb-surface animate-pulse rounded-[4px] ring-1 ring-white/15`} />
    ))}
  </div>
);

// Carrossel horizontal com rolagem lateral (scroll-snap, sem scrollbar).
// Ocupa w-full da tela (-mx-4 cancela o padding do container), mas o px-4
// interno + scroll-px-4 fazem o 1º pôster nascer alinhado com o título da
// seção e, ao rolar, os pôsteres deslizam até a borda (edge-to-edge),
// com respiro à direita no final — igual ao app Android do Letterboxd.
const PosterRail: React.FC<{ movies: TMDBMovie[]; isSeries: boolean; children?: (m: TMDBMovie) => React.ReactNode }> = ({
  movies,
  isSeries,
  children,
}) => (
  <div
    data-h-scroll="true"
    className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 scroll-px-4 [contain:content]"
  >
    {movies.slice(0, 18).map((m) => (
      <div key={m.id} className={`${ITEM_W} snap-start`}>
        <PosterShell>
          <PosterCard movie={m} size="fluid" showDetails={false} tv={isSeries} enableLongPressActions />
        </PosterShell>
        {children?.(m)}
      </div>
    ))}
  </div>
);

/** Número compacto: 1234 → "1.2K", 1234567 → "1.2M" */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

export const MobileCatalogSections: React.FC<MobileCatalogSectionsProps> = ({
  basePath,
  popular,
  topRated,
  mostWatched: mostWatchedProp,
  anticipated,
  loading,
}) => {
  const isSeries = basePath === '/series';
  const { t } = useLanguage();

  // "Most watched": usa a lista curada do serviço quando disponível;
  // senão deriva dos populares ordenados por votos (proxy de visualizações)
  const mostWatched = (mostWatchedProp && mostWatchedProp.length > 0
    ? mostWatchedProp
    : [...popular].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
  ).slice(0, 18);

  // Rotas: abrem /browse/results (app) com preset + sort + título traduzido.
  // Desktop (telas md+) não usa este componente; /films e /series seguem intactas.
  const mediaType = isSeries ? 'tv' : 'movie';
  const browse = (preset: string, sort: string, title: string) =>
    `/browse/results?type=${mediaType}&preset=${preset}&sort=${sort}&title=${encodeURIComponent(title)}`;

  const routes = {
    popular: browse('popular_week', 'popularity.desc', t('sec_popular_week')),
    rated: browse('highest_rated', 'vote_average.desc', t('sec_highest_rated')),
    watched: browse('most_watched', 'vote_count.desc', t('sec_most_watched')),
    anticipated: browse('most_anticipated', 'popularity.desc', isSeries ? t('sec_just_reviewed') : t('sec_most_anticipated')),
  };

  return (
    <div className="md:hidden space-y-8">
      {/* 1. Popular this week — 4 pôsteres limpos (sem divisória: primeira seção) */}
      <SectionShell title={t('sec_popular_week')} to={routes.popular} state={{ initialItems: popular.slice(0, 18) }} divider={false}>
        {loading ? <SkeletonRow /> : <PosterRail movies={popular} isSeries={isSeries} />}
      </SectionShell>

      {/* 2. Highest rated — pôsteres + nota em estrelas abaixo */}
      <SectionShell title={t('sec_highest_rated')} to={routes.rated} state={{ initialItems: topRated.slice(0, 18) }}>
        {loading ? (
          <SkeletonRow />
        ) : (
          <PosterRail movies={topRated} isSeries={isSeries} />
        )}
      </SectionShell>

      {/* 3. Most watched — pôsteres + olho verde + contagem */}
      <SectionShell title={t('sec_most_watched')} to={routes.watched} state={{ initialItems: mostWatched.slice(0, 18) }}>
        {loading ? (
          <SkeletonRow />
        ) : (
          <PosterRail movies={mostWatched} isSeries={isSeries}>
            {(m) => (
              <div className="flex items-center gap-1 px-0.5 pt-1 text-[#00e054]">
                <Eye className="w-3 h-3" />
                <span className="text-[10px] text-[#9ab]">
                  {/* Votos escalados ≈ visualizações (mesma proporção da página de detalhe) */}
                  {compact(Math.max(35000, (m.vote_count || 100) * 350))}
                </span>
              </div>
            )}
          </PosterRail>
        )}
      </SectionShell>

      {/* 4. Most anticipated (films) / Just reviewed (series) — pôsteres limpos */}
      <SectionShell title={isSeries ? t('sec_just_reviewed') : t('sec_most_anticipated')} to={routes.anticipated} state={{ initialItems: anticipated.slice(0, 18) }}>
        {loading ? <SkeletonRow /> : <PosterRail movies={anticipated} isSeries={isSeries} />}
      </SectionShell>
    </div>
  );
};

export default MobileCatalogSections;
