import React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { tmdb } from '../services/tmdb';
import {
  COUNTRY_OPTIONS,
  DECADE_OPTIONS,
  LANGUAGE_OPTIONS,
} from '../components/mobile/FiltersModal';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';

/**
 * BrowseDrilldownPage — cascade browse menus (Release date / Genre / Country /
 * Language / Service). App-style full screen, mobile-first; degrades to a
 * centered 950px column on desktop.
 */
interface Row {
  label: string;
  to: string;
}

type Kind = 'decades' | 'years' | 'genre' | 'country' | 'language' | 'service';

export const BrowseDrilldownPage: React.FC<{ kind: Kind }> = ({ kind }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { decade: decadeParam } = useParams<{ decade?: string }>();
  const [searchParams] = useSearchParams();
  // Tipo escolhido na busca (?type=movie|tv); qualquer outro valor = sem filtro.
  // Deve ser propagado a TODOS os links gerados, senão a grade mistura filmes e séries.
  const rawType = searchParams.get('type');
  const type = rawType === 'movie' || rawType === 'tv' ? rawType : '';
  const withType = (path: string) => (type ? `${path}${path.includes('?') ? '&' : '?'}type=${type}` : path);

  let title = '';
  let rows: Row[] = [];

  if (kind === 'decades') {
    title = t('filter_released');
    rows = [
      { label: t('flt_upcoming'), to: '/browse/results?released=upcoming&title=Upcoming' },
      ...DECADE_OPTIONS.map((d) => ({ label: d, to: `/browse/release-date/${d}` })),
    ];
  } else if (kind === 'years') {
    const decade = decadeParam && /^\d{4}s$/.test(decadeParam) ? decadeParam : '2020s';
    const start = parseInt(decade.replace('s', ''), 10);
    title = decade;
    rows = [
      { label: t('flt_any'), to: `/browse/results?decade=${decade}&title=${decade}` },
    ];
    for (let y = start + 9; y >= start; y--) {
      rows.push({ label: String(y), to: `/browse/results?year=${y}&title=${y}` });
    }
  } else if (kind === 'genre') {
    title = t('filter_genre');
    // Séries usam IDs próprios (ex.: "Action & Adventure" = 10759); filmes usam tmdb.genres.
    // Talk/News/Reality ficam de fora nas séries, como no resto do app.
    const TV_EXCLUDED = new Set([10763, 10764, 10767]);
    const genreList =
      type === 'tv'
        ? tmdb.tvGenres.filter((g) => !TV_EXCLUDED.has(g.id))
        : tmdb.genres;
    rows = genreList.map((g) => ({
      label: g.name,
      to: `/browse/results?genre=${g.id}&title=${encodeURIComponent(g.name)}`,
    }));
  } else if (kind === 'country') {
    title = t('filter_country');
    rows = COUNTRY_OPTIONS.map((c) => ({
      label: t(c.label as TranslationKey),
      to: `/browse/results?country=${c.id}&title=${encodeURIComponent(t(c.label as TranslationKey))}`,
    }));
  } else if (kind === 'language') {
    title = t('filter_language');
    rows = LANGUAGE_OPTIONS.map((l) => ({
      label: t(l.label as TranslationKey),
      to: `/browse/results?language=${l.id}&title=${encodeURIComponent(t(l.label as TranslationKey))}`,
    }));
  } else if (kind === 'service') {
    title = t('filter_service');
    rows = tmdb.streamingServices.map((s) => ({
      label: s.name,
      to: `/browse/results?service=${s.id}&title=${encodeURIComponent(s.name)}`,
    }));
  }

  // Propaga o type em todas as linhas (sub-níveis de década/ano incluídos)
  rows = rows.map((row) => ({ ...row, to: withType(row.to) }));

  return (
    <div className="min-h-screen bg-[#14181c] md:bg-transparent">
      <div className="max-w-[950px] mx-auto">
        <div className="bg-black h-14 px-4 flex items-center gap-4 fixed md:sticky top-0 inset-x-0 z-40">
          <button onClick={() => navigate(-1)} aria-label={t('film_back')} className="text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-white">{title}</h1>
        </div>
        <div className="h-14 md:hidden shrink-0" aria-hidden="true" />

        <nav className="flex flex-col pb-24">
          {rows.map((row) => (
            <Link
              key={row.label}
              to={row.to}
              className="px-4 py-3.5 text-[15px] text-[#9ab] flex justify-between items-center border-b border-white/5 hover:text-white transition-colors"
            >
              <span>{row.label}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};
