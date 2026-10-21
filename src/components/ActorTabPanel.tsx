import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { tmdb, type TMDBPersonMovieCredit } from '../services/tmdb';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { PersonRole } from '../utils/personNav';

/** Filmes renderizados antes do botão "ver mais" (evita listas gigantes). */
export const INITIAL_VISIBLE = 60;

export type ActorTabKey = 'Bio' | PersonRole;
export type ActorSortKey = 'popularity' | 'rating' | 'newest' | 'oldest';

interface ActorTabPanelProps {
  /** Aba dona deste painel: 'Bio' ou um cargo (Actor, Director, Writer, …) */
  tabKey: ActorTabKey;
  /** Filmografia DAQUELE cargo (vem do mesmo fetch da pessoa — sem API extra) */
  items: TMDBPersonMovieCredit[];
  personName: string;
  biography: string | null;
  profileImg: string | null;
  /* Filtros/ordenação/visualização compartilhados pela página */
  decadeFilter: string | null;
  genreFilter: number | null;
  sortBy: ActorSortKey;
  viewMode: 'grid' | 'list';
  showAllFilms: boolean;
  onShowMore: () => void;
}

/**
 * Conteúdo de UM painel da esteira horizontal (ViewPager) das abas do perfil de
 * pessoa — layout do app mobile:
 *   • aba Bio ....... foto 92x138 + biografia completa
 *   • demais abas ... N FILMS + % assistida, grade de 4 colunas (ou lista)
 *                     e o botão "ver mais"
 *
 * Cada painel calcula a SUA própria lista (filtros + ordenação aplicados sobre
 * a filmografia daquele cargo). Nenhuma chamada de API acontece aqui: os dados
 * já vieram no fetch único da pessoa.
 */
export const ActorTabPanel: React.FC<ActorTabPanelProps> = ({
  tabKey,
  items,
  personName,
  biography,
  profileImg,
  decadeFilter,
  genreFilter,
  sortBy,
  viewMode,
  showAllFilms,
  onShowMore,
}) => {
  const { isMovieWatched } = useApp();
  const { t } = useLanguage();

  // ---- Filtros + ordenação da filmografia desta aba ------------------------
  const visibleFilms = useMemo(() => {
    let list = items;
    if (genreFilter) list = list.filter((f) => f.genre_ids?.includes(genreFilter));
    if (decadeFilter) list = list.filter((f) => f.release_date?.startsWith(decadeFilter.slice(0, 3)));
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'rating') return b.vote_average - a.vote_average;
      if (sortBy === 'newest') return (b.release_date || '').localeCompare(a.release_date || '');
      if (sortBy === 'oldest') return (a.release_date || '').localeCompare(b.release_date || '');
      return b.popularity - a.popularity;
    });
    return sorted;
  }, [items, genreFilter, decadeFilter, sortBy]);

  const listed = showAllFilms ? visibleFilms : visibleFilms.slice(0, INITIAL_VISIBLE);

  // Quantos FILMES e quantas SÉRIES há nesta aba (o rótulo de contagem muda
  // quando a lista é só de séries — caso da aba "Criador").
  const seriesCount = visibleFilms.reduce((n, f) => n + (f.media_type === 'tv' ? 1 : 0), 0);
  const filmCount = visibleFilms.length - seriesCount;

  // ---- % assistida desta lista (ícone de olho azul da barra de status) -----
  const watchedPct = useMemo(() => {
    if (visibleFilms.length === 0) return 0;
    const watched = visibleFilms.reduce((n, f) => n + (isMovieWatched(f.id) ? 1 : 0), 0);
    return Math.round((watched / visibleFilms.length) * 100);
  }, [visibleFilms, isMovieWatched]);

  // Card de pôster (grade de 4 colunas e lista compacta).
  // Série (media_type 'tv') abre /tv/{id}; filme abre /film/{id}.
  const posterCard = (film: TMDBPersonMovieCredit, className = '') => (
    <Link
      key={film.id}
      to={`${film.media_type === 'tv' ? '/tv' : '/film'}/${film.id}`}
      className={`person-film-card relative block ${className}`}
    >
      {film.poster_path ? (
        <img
          src={tmdb.getImageUrl(film.poster_path, 'w342')}
          alt={film.title}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="w-full h-full flex items-center justify-center p-1 text-center text-[10px] leading-tight text-[#9ab]">
          {film.title}
        </span>
      )}
      {isMovieWatched(film.id) && (
        <span
          className="absolute bottom-1 right-1 bg-[#00e054] text-black rounded-full p-0.5 shadow"
          aria-hidden="true"
        >
          <Eye className="w-2.5 h-2.5" />
        </span>
      )}
    </Link>
  );

  // ---- Aba Bio: foto + biografia completa ---------------------------------
  if (tabKey === 'Bio') {
    return (
      <div
        className={
          profileImg
            ? 'px-3.5 py-4 grid grid-cols-[92px_1fr] gap-4 items-start'
            : 'px-3.5 py-4'
        }
      >
        {profileImg && (
          <img
            src={profileImg}
            alt={personName}
            loading="lazy"
            decoding="async"
            className="w-[92px] h-[138px] object-cover rounded-md border border-white/12 bg-[#1c2228]"
          />
        )}
        <p className="m-0 text-[#9ab] text-[0.92rem] leading-[1.55] whitespace-pre-line">
          {biography || t('person_bio_empty')}
        </p>
      </div>
    );
  }

  // ---- Aba de cargo sem filmes (após filtros) ------------------------------
  if (visibleFilms.length === 0) {
    return (
      <div className="py-16 px-4 text-center space-y-1.5">
        <p className="text-sm text-white font-semibold">{t('person_nothing')}</p>
        <p className="text-xs text-lb-muted">{t('person_no_films')}</p>
      </div>
    );
  }

  return (
    <>
      {/* Sub-barra de status: N FILMS/SÉRIES + % assistida */}
      <div className="flex items-center justify-between px-3 py-2.5 text-[0.78rem] text-[#9ab]">
        <span className="uppercase tracking-[0.05em]">
          {seriesCount > 0 && filmCount === 0
            ? `${seriesCount} ${t('person_series_label')}`
            : `${filmCount} ${t('person_films_label')}`}
          {filmCount > 0 && seriesCount > 0 ? ` + ${seriesCount} ${t('person_series_label')}` : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-[#40bcf4]" aria-hidden="true" />
          <span>{watchedPct}%</span>
        </span>
      </div>

      {viewMode === 'grid' ? (
        <div className="person-films-grid">{listed.map((f) => posterCard(f))}</div>
      ) : (
        <div className="person-films-list">
          {listed.map((f) => (
            <div key={f.id} className="person-film-row">
              {posterCard(f, 'w-16 flex-none')}
              <div className="min-w-0">
                <Link
                  to={`${f.media_type === 'tv' ? '/tv' : '/film'}/${f.id}`}
                  className="block text-sm font-semibold text-white truncate"
                >
                  {f.title}
                </Link>
                <span className="text-xs text-[#9ab]">
                  {f.release_date ? f.release_date.slice(0, 4) : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {visibleFilms.length > INITIAL_VISIBLE && !showAllFilms && (
        <div className="px-3 pb-8 -mt-1">
          <button
            onClick={onShowMore}
            className="w-full py-2.5 rounded border border-white/10 bg-[#1c2228] text-[11px] font-bold uppercase tracking-wider text-[#9ab] active:scale-[0.98] transition-transform cursor-pointer"
          >
            {t('show_more')} ({visibleFilms.length})
          </button>
        </div>
      )}
    </>
  );
};

export default ActorTabPanel;
