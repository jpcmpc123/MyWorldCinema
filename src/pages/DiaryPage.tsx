import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Heart, Trash2, Calendar, MessageSquare, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useProfileByUsername } from '../lib/useProfileByUsername';
import { tmdb } from '../services/tmdb';
import { smartImgRef, smartImgOnLoad } from '../components/PosterCard';
import { useLanguage } from '../i18n/LanguageContext';
import { parseProfileTabRoute } from '../utils/tabRoutes';

const INITIAL_DIARY_ROWS = 40;
const DIARY_BATCH_SIZE = 40;

interface DiaryRowProps {
  entry: ReturnType<typeof useApp>['logs'][number];
  formattedDate: string;
  isRemote: boolean;
  onDelete: (id: string) => void;
  deleteTitle: string;
  rewatchedTitle: string;
}

const DiaryMobileRow = React.memo<DiaryRowProps>(
  ({ entry, formattedDate, isRemote, onDelete, deleteTitle }) => {
    const p500 = tmdb.getImageUrl(entry.moviePoster, 'w500');
    const p780 = tmdb.getImageUrl(entry.moviePoster, 'w780');
    return (
      <div className="py-3 flex gap-3 items-start diary-row-optimized">
        <Link to={`/film/${entry.movieId}`} className="shrink-0 rounded-[4px] bg-lb-surface ring-1 ring-white/15 overflow-hidden">
          <img
            ref={smartImgRef}
            onLoad={smartImgOnLoad}
            loading="lazy"
            decoding="async"
            src={p500}
            srcSet={entry.moviePoster ? `${p500} 1x, ${p780} 2x` : undefined}
            alt={entry.movieTitle}
            className="w-14 aspect-[2/3] object-cover mw-img-fade"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/film/${entry.movieId}`}
              className="font-bold text-white text-sm leading-tight truncate hover:text-lb-green"
            >
              {entry.movieTitle}
              {entry.movieYear && (
                <span className="ml-1.5 text-xs font-normal text-lb-muted font-mono">
                  {entry.movieYear}
                </span>
              )}
            </Link>
            {!isRemote && (
              <button
                onClick={() => onDelete(entry.id)}
                title={deleteTitle}
                className="text-lb-muted hover:text-lb-red p-1 -mr-1 rounded transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs tabular-nums">
            {entry.rating > 0 && (
              <span className="text-lb-green font-bold tracking-tight">
                {'★'.repeat(Math.floor(entry.rating))}
                {entry.rating % 1 !== 0 ? '½' : ''}
              </span>
            )}
            {entry.liked && (
              <Heart className="w-3.5 h-3.5 fill-lb-orange text-lb-orange" />
            )}
            <span className="text-[11px] text-lb-muted">{formattedDate}</span>
          </div>

          {entry.reviewText && (
            <p className="text-xs text-lb-text mt-1.5 line-clamp-3 leading-relaxed">
              {entry.reviewText}
            </p>
          )}
        </div>
      </div>
    );
  },
);

const DiaryDesktopRow = React.memo<DiaryRowProps>(
  ({ entry, formattedDate, isRemote, onDelete, deleteTitle, rewatchedTitle }) => {
    const p500 = tmdb.getImageUrl(entry.moviePoster, 'w500');
    const p780 = tmdb.getImageUrl(entry.moviePoster, 'w780');
    return (
      <tr className="hover:bg-lb-elevated/40 transition-colors group diary-row-optimized">
        {/* Date */}
        <td className="py-3 px-4 text-lb-text font-medium whitespace-nowrap tabular-nums">
          {formattedDate}
        </td>

        {/* Poster */}
        <td className="py-3 px-3">
          <Link to={`/film/${entry.movieId}`} className="block w-9 aspect-[2/3] rounded shadow border border-white/10 group-hover:border-lb-green transition-colors bg-lb-surface overflow-hidden">
            <img
              ref={smartImgRef}
              onLoad={smartImgOnLoad}
              loading="lazy"
              decoding="async"
              src={p500}
              srcSet={entry.moviePoster ? `${p500} 1x, ${p780} 2x` : undefined}
              alt={entry.movieTitle}
              className="w-full h-full object-cover mw-img-fade"
            />
          </Link>
        </td>

        {/* Film Title */}
        <td className="py-3 px-4">
          <Link
            to={`/film/${entry.movieId}`}
            className="font-bold text-white text-sm hover:text-lb-green transition-colors line-clamp-1"
          >
            {entry.movieTitle}
          </Link>
          {entry.tags?.length > 0 && (
            <div className="flex gap-1 mt-1">
              {entry.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[10px] bg-lb-bg text-lb-muted px-1.5 py-0.5 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </td>

        {/* Released */}
        <td className="py-3 px-3 text-lb-muted font-mono tabular-nums">
          {entry.movieYear}
        </td>

        {/* Rating */}
        <td className="py-3 px-4 text-lb-green font-bold text-sm whitespace-nowrap tabular-nums">
          {entry.rating > 0 ? `${entry.rating} ★` : '—'}
        </td>

        {/* Like */}
        <td className="py-3 px-3 text-center">
          {entry.liked ? (
            <Heart className="w-4 h-4 fill-lb-orange text-lb-orange inline" />
          ) : (
            <span className="text-lb-muted">—</span>
          )}
        </td>

        {/* Rewatch */}
        <td className="py-3 px-3 text-center text-lb-text">
          {entry.isRewatch ? (
            <span title={rewatchedTitle} className="text-sm">🔄</span>
          ) : (
            <span className="text-lb-muted">—</span>
          )}
        </td>

        {/* Review */}
        <td className="py-3 px-3 text-center">
          {entry.reviewText ? (
            <span title={entry.reviewText} className="cursor-pointer">
              <MessageSquare className="w-4 h-4 text-lb-blue inline" />
            </span>
          ) : (
            <span className="text-lb-muted">—</span>
          )}
        </td>

        {/* Action */}
        <td className="py-3 px-4 text-right">
          {!isRemote && (
            <button
              onClick={() => onDelete(entry.id)}
              title={deleteTitle}
              className="text-lb-muted hover:text-lb-red p-1 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </td>
      </tr>
    );
  },
);

export const DiaryPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { username: paramUsername } = useParams<{ username: string }>();
  const location = useLocation();
  const { user, logs, deleteLog, openLogModal } = useApp();
  const username =
    paramUsername ?? parseProfileTabRoute(location.pathname, user.username)?.username;
  const remote = useProfileByUsername(username, user.username);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_DIARY_ROWS);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Logs efetivamente exibidos: remotos (Supabase) se for perfil de outro usuário
  const viewLogs = remote.isRemote ? remote.logs : logs;

  // Collect available years (memoized)
  const years = useMemo(
    () =>
      Array.from(new Set(viewLogs.map((l) => (l.watchedDate ?? '').slice(0, 4)).filter(Boolean)))
        .sort()
        .reverse(),
    [viewLogs],
  );

  const filteredLogs = useMemo(
    () =>
      viewLogs.filter((l) =>
        selectedYear === 'all' ? true : (l.watchedDate ?? '').startsWith(selectedYear),
      ),
    [viewLogs, selectedYear],
  );

  useEffect(() => {
    setVisibleCount(INITIAL_DIARY_ROWS);
  }, [selectedYear, username]);

  const visibleLogs = useMemo(
    () => filteredLogs.slice(0, visibleCount),
    [filteredLogs, visibleCount],
  );

  // Carrega mais linhas automaticamente ao rolar até o fim da tabela
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= filteredLogs.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(filteredLogs.length, prev + DIARY_BATCH_SIZE));
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, filteredLogs.length]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [language],
  );

  const formatWatchedDate = (raw?: string | null) => {
    if (!raw) return '—';
    const d = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
    if (Number.isNaN(d.getTime())) return raw || '—';
    try {
      return dateFormatter.format(d);
    } catch {
      return raw || '—';
    }
  };

  const deleteTitle = t('diary_delete');
  const rewatchedTitle = t('diary_rewatched');

  return (
    <div className="max-w-[950px] mx-auto px-4 pt-3 pb-4 md:py-8 space-y-4 md:space-y-6">
      {/* Mobile Header — padrão visual idêntico às seções de Filmes e Séries */}
      <div className="md:hidden space-y-2.5 border-b border-white/10 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[15px] font-bold text-white tracking-tight">
            {t('diary_title')}
          </h1>

          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-lb-surface border border-white/15 text-[11px] font-semibold text-white rounded px-2.5 py-1 focus:outline-none focus:border-lb-green"
            >
              <option value="all">{t('diary_all_years')}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              onClick={() => openLogModal()}
              className="flex items-center gap-1 bg-lb-green hover:bg-lb-green-hover text-lb-bg font-black text-[11px] uppercase px-2.5 py-1 rounded-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>{t('nav_log')}</span>
            </button>
          </div>
        </div>
        <p className="text-[11px] text-lb-muted leading-snug">
          {t('diary_desc')}
        </p>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex sm:flex-row sm:items-center justify-between gap-4 border-b border-lb-elevated pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {t('diary_title')}
          </h1>
          <p className="text-xs text-lb-text mt-1">
            {t('diary_desc')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-lb-surface border border-lb-elevated text-xs text-white rounded px-3 py-1.5 focus:outline-none focus:border-lb-green"
          >
            <option value="all">{t('diary_all_years')}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={() => openLogModal()}
            className="flex items-center gap-1.5 bg-lb-green hover:bg-lb-green-hover text-lb-bg font-black text-xs uppercase px-3.5 py-1.5 rounded-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>{t('diary_add_entry')}</span>
          </button>
        </div>
      </div>

      {/* Diary Entries: Mobile Native Cards + Desktop Table */}
      {filteredLogs.length > 0 ? (
        <>
          {/* Mobile Card Feed */}
          <div className="md:hidden divide-y divide-white/10">
            {visibleLogs.map((entry) => (
              <DiaryMobileRow
                key={entry.id}
                entry={entry}
                formattedDate={formatWatchedDate(entry.watchedDate)}
                isRemote={remote.isRemote}
                onDelete={deleteLog}
                deleteTitle={deleteTitle}
                rewatchedTitle={rewatchedTitle}
              />
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-lb-surface border border-lb-elevated rounded-lg overflow-hidden shadow-xl">
            <div data-h-scroll="true" className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-lb-bg border-b border-lb-elevated text-[11px] uppercase font-bold text-lb-muted">
                  <tr>
                    <th className="py-3 px-4 w-28">{t('diary_th_date')}</th>
                    <th className="py-3 px-3 w-14">{t('diary_th_poster')}</th>
                    <th className="py-3 px-4">{t('diary_th_title')}</th>
                    <th className="py-3 px-3 w-20">{t('filter_released')}</th>
                    <th className="py-3 px-4 w-28">{t('diary_th_rating')}</th>
                    <th className="py-3 px-3 text-center w-16">{t('diary_th_like')}</th>
                    <th className="py-3 px-3 text-center w-20">{t('diary_th_rewatch')}</th>
                    <th className="py-3 px-3 text-center w-16">{t('diary_th_review')}</th>
                    <th className="py-3 px-4 text-right w-16">{t('diary_th_action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lb-elevated/60">
                  {visibleLogs.map((entry) => (
                    <DiaryDesktopRow
                      key={entry.id}
                      entry={entry}
                      formattedDate={formatWatchedDate(entry.watchedDate)}
                      isRemote={remote.isRemote}
                      onDelete={deleteLog}
                      deleteTitle={deleteTitle}
                      rewatchedTitle={rewatchedTitle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {visibleCount < filteredLogs.length && (
            <div ref={sentinelRef} className="p-3 text-center border-t border-white/10">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => Math.min(filteredLogs.length, prev + DIARY_BATCH_SIZE))}
                className="text-xs font-bold uppercase tracking-wider text-lb-green hover:underline cursor-pointer"
              >
                {t('show_more')} ({filteredLogs.length - visibleCount})
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-lb-surface/70 border border-white/10 rounded-lg px-6 py-10 md:p-12 text-center space-y-3">
          <Calendar className="w-9 h-9 text-lb-muted mx-auto" />
          <h3 className="text-sm md:text-base font-bold text-white">{t('diary_empty_title')}</h3>
          <p className="text-xs text-lb-text max-w-sm mx-auto leading-relaxed">
            {t('diary_empty_desc')}
          </p>
          <button
            onClick={() => openLogModal()}
            className="mt-1 inline-flex items-center gap-1.5 bg-lb-green hover:bg-lb-green-hover text-lb-bg font-black text-xs uppercase px-4 py-2 rounded-sm cursor-pointer transition-colors"
          >
            {t('diary_log_first')}
          </button>
        </div>
      )}
    </div>
  );
};

