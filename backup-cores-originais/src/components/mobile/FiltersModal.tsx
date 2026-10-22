import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { tmdb } from '../../services/tmdb';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';

/**
 * FiltersModal — full-screen filters sheet used by BrowseResultsPage.
 *
 * Contract:
 *   <FiltersModal
 *     open={filtersOpen}
 *     initial={currentParamsAsRecord}   // Record<string,string> from useSearchParams entries
 *     onClose={() => setFiltersOpen(false)}
 *     onApply={(draft) => { setSearchParams(draft); setFiltersOpen(false); }}
 *   />
 *
 * The modal owns a DRAFT copy of the URL filters. ✓ commits via onApply,
 * ✕ and the back arrow close without applying. Reset clears everything to Any.
 */

// ---- Shared option lists (also imported by BrowseDrilldownPage) ----
export interface FilterOption {
  id: string;
  /** Chave i18n (opções fixas) ou texto literal (gêneros/serviços vindos da API). */
  label: string;
}

// Os rótulos são chaves i18n (TranslationKey) — traduzidos em tempo de render.
export const COUNTRY_OPTIONS: FilterOption[] = [
  { id: 'US', label: 'flt_country_us' },
  { id: 'GB', label: 'flt_country_gb' },
  { id: 'BR', label: 'flt_country_br' },
  { id: 'FR', label: 'flt_country_fr' },
  { id: 'JP', label: 'flt_country_jp' },
  { id: 'KR', label: 'flt_country_kr' },
  { id: 'DE', label: 'flt_country_de' },
  { id: 'IT', label: 'flt_country_it' },
  { id: 'ES', label: 'flt_country_es' },
  { id: 'IN', label: 'flt_country_in' },
  { id: 'CA', label: 'flt_country_ca' },
  { id: 'AU', label: 'flt_country_au' },
  { id: 'MX', label: 'flt_country_mx' },
  { id: 'AR', label: 'flt_country_ar' },
  { id: 'PT', label: 'flt_country_pt' },
  { id: 'CN', label: 'flt_country_cn' },
  { id: 'SE', label: 'flt_country_se' },
  { id: 'DK', label: 'flt_country_dk' },
  { id: 'NL', label: 'flt_country_nl' },
  { id: 'PL', label: 'flt_country_pl' },
];

export const LANGUAGE_OPTIONS: FilterOption[] = [
  { id: 'en', label: 'flt_lang_en' },
  { id: 'pt', label: 'flt_lang_pt' },
  { id: 'es', label: 'flt_lang_es' },
  { id: 'fr', label: 'flt_lang_fr' },
  { id: 'ja', label: 'flt_lang_ja' },
  { id: 'ko', label: 'flt_lang_ko' },
  { id: 'de', label: 'flt_lang_de' },
  { id: 'it', label: 'flt_lang_it' },
  { id: 'zh', label: 'flt_lang_zh' },
  { id: 'hi', label: 'flt_lang_hi' },
  { id: 'ru', label: 'flt_lang_ru' },
  { id: 'sv', label: 'flt_lang_sv' },
];

export const SORT_OPTIONS: FilterOption[] = [
  { id: 'popularity.desc', label: 'flt_sort_popularity' },
  { id: 'vote_average.desc', label: 'flt_sort_highest' },
  { id: 'vote_average.asc', label: 'flt_sort_lowest' },
  { id: 'primary_release_date.desc', label: 'flt_sort_newest' },
  { id: 'primary_release_date.asc', label: 'flt_sort_oldest' },
  { id: 'original_title.asc', label: 'flt_sort_title' },
];

export const DECADE_OPTIONS: string[] = [
  '2020s', '2010s', '2000s', '1990s', '1980s', '1970s', '1960s', '1950s',
  '1940s', '1930s', '1920s', '1910s', '1900s', '1890s', '1880s', '1870s',
];

export type FiltersDraft = Record<string, string>;

type PickerId =
  | 'sort'
  | 'year'
  | 'genre'
  | 'country'
  | 'language'
  | 'service'
  | 'released'
  | 'length'
  | 'type'
  | 'watched'
  | 'watchlist'
  | 'backdrop'
  | null;

interface FiltersModalProps {
  open: boolean;
  initial: FiltersDraft;
  onClose: () => void;
  onApply: (draft: FiltersDraft) => void;
}

const SIMPLE_PICKERS: Record<string, { title: TranslationKey; key: string; options: FilterOption[] }> = {
  released: {
    title: 'flt_released',
    key: 'released',
    options: [
      { id: 'any', label: 'flt_any' },
      { id: 'released', label: 'flt_released' },
      { id: 'upcoming', label: 'flt_upcoming' },
    ],
  },
  length: {
    title: 'flt_length',
    key: 'length',
    options: [
      { id: 'any', label: 'flt_any' },
      { id: 'short', label: 'flt_len_short' },
      { id: 'medium', label: 'flt_len_medium' },
      { id: 'long', label: 'flt_len_long' },
    ],
  },
  type: {
    title: 'flt_film_tv',
    key: 'type',
    options: [
      { id: 'any', label: 'flt_any' },
      { id: 'movie', label: 'flt_films_only' },
      { id: 'tv', label: 'flt_tv_only' },
    ],
  },
  watched: {
    title: 'flt_watched',
    key: 'watched',
    options: [
      { id: 'any', label: 'flt_any' },
      { id: 'watched', label: 'flt_watched' },
      { id: 'not-watched', label: 'flt_not_watched' },
    ],
  },
  watchlist: {
    title: 'flt_watchlist',
    key: 'watchlist',
    options: [
      { id: 'any', label: 'flt_any' },
      { id: 'in', label: 'flt_in_watchlist' },
      { id: 'not-in', label: 'flt_not_in_watchlist' },
    ],
  },
  backdrop: {
    title: 'flt_backdrops',
    key: 'backdrop',
    options: [
      { id: 'any', label: 'flt_any' },
      { id: 'with', label: 'flt_with_backdrop' },
    ],
  },
};

export const FiltersModal: React.FC<FiltersModalProps> = ({ open, initial, onClose, onApply }) => {
  const { t } = useLanguage();
  // Rótulo de opção: chave i18n quando conhecida; senão texto literal (API).
  const L = (label: string): string => (label.startsWith('flt_') || label.startsWith('filter_') || label.startsWith('wl_') ? t(label as TranslationKey) : label);
  const [draft, setDraft] = useState<FiltersDraft>({});
  const [picker, setPicker] = useState<PickerId>(null);
  const [yearDecade, setYearDecade] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);

  // Sync draft each time the modal opens (fresh copy of URL params)
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft({ ...initial });
      setPicker(null);
      setYearDecade(null);
    }
  }

  const setParam = (key: string, value: string) => {
    setDraft((d) => {
      const next = { ...d };
      if (!value || value === 'any') delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const valueLabel = useMemo(() => {
    const genreName = (id?: string) => tmdb.genres.find((g) => String(g.id) === id)?.name;
    const serviceName = (id?: string) => tmdb.streamingServices.find((s) => String(s.id) === id)?.name;
    const optLabel = (list: FilterOption[], id?: string) => list.find((o) => o.id === id)?.label;
    const any = t('flt_any');
    return {
      sort: L(SORT_OPTIONS.find((o) => o.id === (draft.sort || 'popularity.desc'))?.label ?? 'flt_sort_popularity'),
      year: draft.year || draft.decade || any,
      genre: genreName(draft.genre) || any,
      country: (optLabel(COUNTRY_OPTIONS, draft.country) && L(optLabel(COUNTRY_OPTIONS, draft.country)!)) || any,
      language: (optLabel(LANGUAGE_OPTIONS, draft.language) && L(optLabel(LANGUAGE_OPTIONS, draft.language)!)) || any,
      service: serviceName(draft.service) || any,
      released: L(optLabel(SIMPLE_PICKERS.released.options, draft.released) ?? 'flt_any'),
      length:
        draft.length === 'short'
          ? t('flt_len_short')
          : draft.length === 'medium'
            ? t('flt_len_medium')
            : draft.length === 'long'
              ? t('flt_len_long')
              : any,
      type:
        draft.type === 'movie' ? t('flt_films_only') : draft.type === 'tv' ? t('flt_tv_only') : any,
      watched:
        draft.watched === 'watched'
          ? t('flt_watched')
          : draft.watched === 'not-watched'
            ? t('flt_not_watched')
            : any,
      watchlist:
        draft.watchlist === 'in'
          ? t('flt_in_watchlist')
          : draft.watchlist === 'not-in'
            ? t('flt_not_in_watchlist')
            : any,
      backdrop: draft.backdrop === 'with' ? t('flt_with_backdrop') : any,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, t]);

  if (!open) return null;

  const fade = draft.fade === '1';
  const toggleFade = () => setParam('fade', fade ? '' : '1');

  const reset = () => setDraft({});

  const Row: React.FC<{ label: string; value: string; onClick?: () => void }> = ({
    label,
    value,
    onClick,
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-4 py-3.5 flex items-center justify-between text-left"
    >
      <span className="text-[15px] text-[#ccd6e0]">{label}</span>
      <span className="text-[15px] text-[#789] flex items-center gap-1">{value} ›</span>
    </button>
  );

  const PickerRow: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
    label,
    active,
    onClick,
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-3.5 flex items-center justify-between text-left text-[15px] border-b border-white/5 ${
        active ? 'text-white' : 'text-[#9ab]'
      }`}
    >
      <span>{label}</span>
      {active && <Check className="w-4 h-4 text-[#00e054]" />}
    </button>
  );

  const pickerHeader = (title: string, back: () => void) => (
    <div className="bg-black h-14 px-4 flex items-center gap-4 border-b border-white/10 shrink-0">
      <button onClick={back} aria-label={t('film_back')} className="text-white">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h2 className="text-lg font-bold text-white">{title}</h2>
    </div>
  );

  // ---- Picker sub-screens ----
  const renderPicker = () => {
    if (!picker) return null;

    if (picker === 'sort') {
      return (
        <>
          {pickerHeader(t('flt_sort_by'), () => setPicker(null))}
          <div className="flex-1 overflow-y-auto pb-24">
            {SORT_OPTIONS.map((o) => (
              <PickerRow
                key={o.id}
                label={L(o.label)}
                active={(draft.sort || 'popularity.desc') === o.id}
                onClick={() => {
                  setParam('sort', o.id);
                  setPicker(null);
                }}
              />
            ))}
          </div>
        </>
      );
    }

    if (picker === 'year') {
      if (yearDecade) {
        const start = parseInt(yearDecade.replace('s', ''), 10) || 2020;
        const years = Array.from({ length: 10 }, (_, i) => start + 9 - i);
        return (
          <>
            {pickerHeader(yearDecade, () => setYearDecade(null))}
            <div className="flex-1 overflow-y-auto pb-24">
              <PickerRow
                label={t('flt_any')}
                active={draft.decade === yearDecade && !draft.year}
                onClick={() => {
                  setDraft((d) => {
                    const n = { ...d };
                    delete n.year;
                    n.decade = yearDecade;
                    return n;
                  });
                  setPicker(null);
                  setYearDecade(null);
                }}
              />
              {years.map((y) => (
                <PickerRow
                  key={y}
                  label={String(y)}
                  active={draft.year === String(y)}
                  onClick={() => {
                    setDraft((d) => {
                      const n = { ...d };
                      n.year = String(y);
                      // keep the decade for context but year takes precedence in the results page
                      n.decade = yearDecade;
                      return n;
                    });
                    setPicker(null);
                    setYearDecade(null);
                  }}
                />
              ))}
            </div>
          </>
        );
      }
      return (
        <>
          {pickerHeader('Year', () => setPicker(null))}
          <div className="flex-1 overflow-y-auto pb-24">
            <PickerRow
              label={t('flt_any')}
              active={!draft.year && !draft.decade}
              onClick={() => {
                setDraft((d) => {
                  const n = { ...d };
                  delete n.year;
                  delete n.decade;
                  return n;
                });
                setPicker(null);
              }}
            />
            {DECADE_OPTIONS.map((dec) => (
              <PickerRow key={dec} label={dec} active={false} onClick={() => setYearDecade(dec)} />
            ))}
          </div>
        </>
      );
    }

    if (picker === 'genre' || picker === 'country' || picker === 'language' || picker === 'service') {
      const config: Record<string, { title: string; key: string; options: FilterOption[] }> = {
        genre: {
          title: 'filter_genre',
          key: 'genre',
          options: tmdb.genres.map((g) => ({ id: String(g.id), label: g.name })),
        },
        country: { title: 'filter_country', key: 'country', options: COUNTRY_OPTIONS },
        language: { title: 'filter_language', key: 'language', options: LANGUAGE_OPTIONS },
        service: {
          title: 'filter_service',
          key: 'service',
          options: tmdb.streamingServices.map((s) => ({ id: String(s.id), label: s.name })),
        },
      };
      const { title, key, options } = config[picker];
      return (
        <>
          {pickerHeader(t(title as TranslationKey), () => setPicker(null))}
          <div className="flex-1 overflow-y-auto pb-24">
            <PickerRow
              label={t('flt_any')}
              active={!draft[key]}
              onClick={() => {
                setParam(key, '');
                setPicker(null);
              }}
            />
            {options.map((o) => (
              <PickerRow
                key={o.id}
                label={L(o.label)}
                active={draft[key] === o.id}
                onClick={() => {
                  setParam(key, o.id);
                  setPicker(null);
                }}
              />
            ))}
          </div>
        </>
      );
    }

    // Simple radio pickers (released/length/type/watched/watchlist/backdrop)
    const cfg = SIMPLE_PICKERS[picker];
    if (cfg) {
      return (
        <>
          {pickerHeader(t(cfg.title), () => setPicker(null))}
          <div className="flex-1 overflow-y-auto pb-24">
            {cfg.options.map((o) => (
              <PickerRow
                key={o.id}
                label={L(o.label)}
                active={(draft[cfg.key] || 'any') === o.id}
                onClick={() => {
                  setParam(cfg.key, o.id);
                  setPicker(null);
                }}
              />
            ))}
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[#14181c] mw-sheet-up"
      role="dialog"
      aria-modal="true"
    >

      {picker ? (
        renderPicker()
      ) : (
        <>
          {/* Header */}
          <div className="bg-black h-14 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
            <button onClick={onClose} aria-label={t('flt_close')} className="text-white">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-white font-bold">{t('flt_filters')}</h2>
            <button
              onClick={() => onApply(draft)}
              aria-label={t('flt_apply')}
              className="text-[#00e054]"
            >
              <Check className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-white/10">
              <Row label={t('flt_sort_by')} value={valueLabel.sort} onClick={() => setPicker('sort')} />

              <div>
                <h3 className="text-[11px] uppercase tracking-wider text-lb-muted px-4 pt-4 pb-1">
                  {t('flt_appearance')}
                </h3>
                <div className="divide-y divide-white/10">
                  <div className="px-4 py-3.5 flex items-center justify-between">
                    <span className="text-[15px] text-[#ccd6e0]">{t('flt_fade_watched')}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={fade}
                      onClick={toggleFade}
                      className="w-10 h-6 rounded-full bg-[#2c3440] relative transition-colors"
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
                          fade ? 'bg-[#ff8000] left-[18px]' : 'bg-[#9ab] left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  {/* Stub: custom posters are always applied site-wide via movieOverrides */}
                  <div className="px-4 py-3.5 flex items-center justify-between">
                    <span className="text-[15px] text-[#ccd6e0]">{t('flt_custom_posters')}</span>
                    <span className="text-[15px] text-[#789]">{t('flt_enabled')} ›</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[11px] uppercase tracking-wider text-lb-muted px-4 pt-4 pb-1">
                  {t('flt_content')}
                </h3>
                <div className="divide-y divide-white/10">
                  <Row label={t('filter_year')} value={valueLabel.year} onClick={() => setPicker('year')} />
                  <Row label={t('filter_genre')} value={valueLabel.genre} onClick={() => setPicker('genre')} />
                  <Row
                    label={t('filter_country')}
                    value={valueLabel.country}
                    onClick={() => setPicker('country')}
                  />
                  <Row
                    label={t('filter_language')}
                    value={valueLabel.language}
                    onClick={() => setPicker('language')}
                  />
                  <Row
                    label={t('filter_service')}
                    value={valueLabel.service}
                    onClick={() => setPicker('service')}
                  />
                  <Row
                    label={t('filter_released')}
                    value={valueLabel.released}
                    onClick={() => setPicker('released')}
                  />
                  <Row label={t('flt_length')} value={valueLabel.length} onClick={() => setPicker('length')} />
                  <Row label={t('flt_film_tv')} value={valueLabel.type} onClick={() => setPicker('type')} />
                </div>
              </div>

              <div>
                <h3 className="text-[11px] uppercase tracking-wider text-lb-muted px-4 pt-4 pb-1">
                  {t('flt_your_account')}
                </h3>
                <div className="divide-y divide-white/10">
                  <Row label={t('flt_watched')} value={valueLabel.watched} onClick={() => setPicker('watched')} />
                  <Row
                    label={t('flt_watchlist')}
                    value={valueLabel.watchlist}
                    onClick={() => setPicker('watchlist')}
                  />
                  <Row
                    label={t('flt_backdrops')}
                    value={valueLabel.backdrop}
                    onClick={() => setPicker('backdrop')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-4 shrink-0">
            <button
              type="button"
              onClick={reset}
              className="text-[#ff8000] font-medium text-[15px]"
            >
              {t('flt_reset')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
