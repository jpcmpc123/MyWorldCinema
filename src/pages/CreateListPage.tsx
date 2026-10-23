import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ChevronDown,
  X,
  Check,
  Globe,
  GripVertical,
  Film,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { tmdb, type TMDBSearchResult } from '../services/tmdb';
import { useLanguage } from '../i18n/LanguageContext';

const RECENT_SEARCHES_KEY = 'mw_list_recent_searches';

interface SelectedListItem {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  notes: string;
  director?: string;
}

export const CreateListPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: editListId } = useParams<{ id?: string }>();
  const { lists, createList, updateList, user } = useApp();
  const { isAuthenticated, profile } = useAuth();
  const { t } = useLanguage();

  const existingList = editListId ? lists.find((l) => l.id === editListId) : undefined;
  const isEditing = Boolean(existingList);

  const displayUsername = isAuthenticated && profile ? profile.username : user.username;

  const [title, setTitle] = useState(() => existingList?.title ?? '');
  const [description, setDescription] = useState(() => existingList?.description ?? '');
  const [isRanked, setIsRanked] = useState(() => existingList?.isRanked ?? false);
  // Por padrão a lista fica privada ('private'), e ao tocar em Public vira 'public'
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>(() =>
    existingList ? (existingList.isPrivate ? 'private' : 'public') : 'private',
  );
  const [tags, setTags] = useState<string[]>(() => existingList?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [showHtmlHint, setShowHtmlHint] = useState(false);
  const [items, setItems] = useState<SelectedListItem[]>(() =>
    existingList
      ? existingList.movies.map((m) => ({
          id: m.id,
          title: m.title,
          poster_path: m.poster_path,
          release_date: m.release_date || '',
          notes: m.notes || '',
        }))
      : [],
  );

  // Mobile 3-screen state ('form' = New List, 'films' = Films list, 'search' = Name of film...)
  const [mobileScreen, setMobileScreen] = useState<'form' | 'films' | 'search'>('form');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string');
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Desktop toolbar states
  const [desktopView, setDesktopView] = useState<'list' | 'grid'>('grid');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [isAddFocused, setIsAddFocused] = useState(false);
  const [activeResultIdx, setActiveResultIdx] = useState(0);

  // Search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [, setIsSearching] = useState(false);

  const addInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownWrapperRef = useRef<HTMLDivElement | null>(null);
  const sortWrapperRef = useRef<HTMLDivElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (mobileScreen === 'search') {
      const id = window.setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(id);
    }
  }, [mobileScreen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setActiveResultIdx(0);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // 1) Resposta rápida inicial para abrir o dropdown imediatamente
        const baseRes = await tmdb.searchMovies(trimmed, 1);
        if (cancelled) return;
        const quickItems: TMDBSearchResult[] = (baseRes.results || []).slice(0, 8).map((m) => ({
          id: m.id,
          media_type: 'movie',
          title: m.title,
          original_title: m.original_title || m.title,
          release_date: m.release_date || '',
          poster_path: m.poster_path,
          overview: m.overview || '',
          vote_average: m.vote_average || 0,
          popularity: m.popularity || 0,
          directors: [],
          alternativeTitles: [],
        }));
        setResults(quickItems);
        setActiveResultIdx(0);

        // 2) Enriquecimento com diretores (ex.: "Michael (2026) Antoine Fuqua")
        const enriched = await tmdb.searchEnriched(trimmed, 'movie', 1);
        if (cancelled) return;
        setResults(enriched.slice(0, 8));
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownWrapperRef.current &&
        !dropdownWrapperRef.current.contains(e.target as Node)
      ) {
        setIsAddFocused(false);
      }
      if (
        sortWrapperRef.current &&
        !sortWrapperRef.current.contains(e.target as Node)
      ) {
        setSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addMovie = (movie: TMDBSearchResult) => {
    if (items.some((i) => i.id === movie.id)) {
      setQuery('');
      setResults([]);
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        release_date: movie.release_date || '',
        notes: '',
        director: movie.directors?.[0] || undefined,
      },
    ]);
    setQuery('');
    setResults([]);
    setActiveResultIdx(0);
  };

  const removeMovie = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const next = [...items];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setItems(next);
  };

  const updateNotes = (id: number, notes: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, notes } : i)));
  };

  const commitTag = () => {
    const clean = tagInput.trim().replace(/,+$/, '').trim();
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      if (tagInput.trim()) {
        e.preventDefault();
        commitTag();
      }
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((tItem) => tItem !== tagToRemove));
  };

  const handleAddInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveResultIdx((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveResultIdx((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[activeResultIdx] || results[0];
      if (chosen) addMovie(chosen);
    } else if (e.key === 'Escape') {
      setResults([]);
      setIsAddFocused(false);
    }
  };

  const sortItems = (mode: 'reverse' | 'shuffle' | 'name' | 'newest' | 'oldest') => {
    setItems((prev) => {
      const copy = [...prev];
      if (mode === 'reverse') return copy.reverse();
      if (mode === 'shuffle') {
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      }
      if (mode === 'name') {
        return copy.sort((a, b) => a.title.localeCompare(b.title));
      }
      if (mode === 'newest') {
        return copy.sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
      }
      if (mode === 'oldest') {
        return copy.sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''));
      }
      return copy;
    });
    setSortDropdownOpen(false);
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const nameIdx = headers.findIndex((h) => h === 'name' || h === 'title' || h === 'film');
      const colIdx = nameIdx >= 0 ? nameIdx : 0;

      const titlesToFetch = lines
        .slice(1, 16)
        .map((line) => {
          const cols = line.split(',');
          return cols[colIdx]?.replace(/^["']|["']$/g, '').trim();
        })
        .filter(Boolean);

      for (const filmTitle of titlesToFetch) {
        if (!filmTitle) continue;
        const searchRes = await tmdb.searchMovies(filmTitle, 1);
        const top = searchRes.results?.[0];
        if (top) {
          setItems((prev) => {
            if (prev.some((i) => i.id === top.id)) return prev;
            return [
              ...prev,
              {
                id: top.id,
                title: top.title,
                poster_path: top.poster_path,
                release_date: top.release_date || '',
                notes: '',
              },
            ];
          });
        }
      }
    } catch (err) {
      console.error('CSV import error:', err);
    } finally {
      e.target.value = '';
    }
  };

  const saveRecentSearch = (term: string) => {
    const clean = term.trim().toLowerCase();
    if (!clean) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((s) => s.toLowerCase() !== clean)].slice(0, 12);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSelectMovieMobile = (movie: TMDBSearchResult) => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
    }
    addMovie(movie);
    setMobileScreen('films');
  };

  const reorderItems = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= items.length ||
      toIndex >= items.length
    ) {
      return;
    }
    setItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const handleTouchMoveGrip = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dragIdx === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = el?.closest('[data-film-row-idx]');
    if (!row) return;
    const overIdx = Number(row.getAttribute('data-film-row-idx'));
    if (!Number.isNaN(overIdx) && overIdx !== dragIdx) {
      reorderItems(dragIdx, overIdx);
      setDragIdx(overIdx);
    }
  };

  const saveListAndNavigate = (targetPath?: string) => {
    if (!title.trim() || items.length === 0) return;

    const finalTags = [...tags];
    if (tagInput.trim() && !finalTags.includes(tagInput.trim())) {
      finalTags.push(tagInput.trim());
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      isRanked,
      isPrivate: visibility === 'private',
      tags: finalTags.length > 0 ? finalTags : undefined,
      movies: items,
    };

    if (isEditing && editListId) {
      updateList(editListId, payload);
      navigate(targetPath || `/list/${editListId}`, { replace: true });
      return;
    }

    const newListId = createList(payload);
    navigate(targetPath || `/list/${newListId}`, { replace: true });
  };

  const isInputWhite = isAddFocused || query.trim().length > 0;
  const canSave = title.trim().length > 0 && items.length > 0;

  return (
    <>
      {/* =====================================================================
          MOBILE LAYOUT (< 768px) — Fluxo nativo Letterboxd (New/Edit List / Films / Search)
          ===================================================================== */}
      <div className="md:hidden fixed inset-0 z-50 bg-[#14181c] flex flex-col">
        {mobileScreen === 'form' && (
          <>
            {/* Top Bar Preta: ✕ | New List / Edit List | ✓ */}
            <header className="bg-black h-[56px] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center">
                <button
                  type="button"
                  aria-label={t('btn_cancel')}
                  onClick={() => navigate(-1)}
                  className="min-w-[44px] min-h-[44px] -ml-2.5 flex items-center justify-center text-white active:opacity-70 cursor-pointer"
                >
                  <X className="w-6 h-6 stroke-[2.25]" />
                </button>
                <h1 className="text-[19px] font-bold text-white tracking-tight ml-3">
                  {isEditing ? 'Edit List' : 'New List'}
                </h1>
              </div>

              <button
                type="button"
                aria-label={t('btn_save')}
                disabled={!canSave}
                onClick={() => saveListAndNavigate()}
                className={`min-w-[44px] min-h-[44px] -mr-2.5 flex items-center justify-center transition-opacity ${
                  canSave
                    ? 'text-white active:opacity-70 cursor-pointer'
                    : 'text-white/30 cursor-not-allowed'
                }`}
              >
                <Check className="w-6 h-6 stroke-[2.25]" />
              </button>
            </header>

            {/* Corpo Rolável: List name + Add description... + Add/Edit entries... */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* List name */}
              <div className="px-4 pt-3.5 pb-1">
                <input
                  type="text"
                  placeholder="List name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#2c3440] rounded-[3px] px-3.5 py-2.5 text-[16px] text-white placeholder-[#778899] focus:outline-none"
                />
              </div>

              {/* Add description... */}
              <div className="px-4 py-3 border-b border-white/10">
                <textarea
                  rows={2}
                  placeholder="Add description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-[#ccddee] placeholder-[#667788] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Add entries... / Edit entries... */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setMobileScreen(items.length === 0 ? 'search' : 'films')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setMobileScreen(items.length === 0 ? 'search' : 'films');
                  }
                }}
                className="flex-1 px-4 py-3.5 flex flex-col cursor-pointer active:bg-white/[0.02] transition-colors"
              >
                <span className="text-[14px] text-[#667788] mb-3">
                  {items.length === 0 ? 'Add entries...' : 'Edit entries...'}
                </span>

                {items.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 pb-4">
                    {items.map((item, idx) => {
                      const posterUrl = item.poster_path
                        ? tmdb.getImageUrl(item.poster_path, 'w185')
                        : null;
                      return (
                        <div key={item.id} className="relative aspect-[2/3]">
                          <div className="w-full h-full rounded-[4px] overflow-hidden border border-white/15 bg-[#1c2228]">
                            {posterUrl ? (
                              <img
                                loading="lazy"
                                decoding="async"
                                src={posterUrl}
                                alt={item.title}
                                className="w-full h-full object-cover block"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#556677]">
                                <Film className="w-5 h-5" />
                              </div>
                            )}
                          </div>

                          {isRanked && (
                            <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 min-w-[20px] h-[20px] px-1 rounded-full bg-[#2c3440] border border-[#445566] text-[11px] font-bold text-[#ccddee] flex items-center justify-center shadow-md tabular-nums">
                              {idx + 1}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé Fixo: Add tags... + Public / Ranked toggles */}
            <div className="shrink-0 bg-[#14181c]">
              {/* Add tags... */}
              <div className="border-t border-b border-white/10 px-4 py-2.5 flex flex-wrap items-center gap-1.5 min-h-[46px]">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-[#2c3440] text-[#ccddee] text-[12px] px-2 py-0.5 rounded-[3px]"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-[#778899] hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={commitTag}
                  placeholder={tags.length === 0 ? 'Add tags...' : ''}
                  className="flex-1 min-w-[110px] bg-transparent text-[14px] text-[#ccddee] placeholder-[#667788] focus:outline-none"
                />
              </div>

              {/* Barra inferior: Public | Ranked */}
              <div className="grid grid-cols-2 h-[64px] bg-[#181e24] pb-[env(safe-area-inset-bottom,0px)]">
                {/* Toggle Public (por padrão desativado = lista privada; ativado = pública) */}
                <button
                  type="button"
                  onClick={() =>
                    setVisibility((v) => (v === 'public' ? 'private' : 'public'))
                  }
                  className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                    visibility === 'public' ? 'text-[#cceeff]' : 'text-[#99aabb]'
                  }`}
                >
                  <div className="relative inline-flex items-center justify-center">
                    {visibility === 'public' && (
                      <span className="absolute -top-1 -left-2 w-3.5 h-3.5 rounded-full bg-[#99ccff] text-[#14181c] flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 stroke-[3.5]" />
                      </span>
                    )}
                    <Globe className="w-5 h-5" />
                  </div>
                  <span className="text-[12px] font-normal">Public</span>
                </button>

                {/* Toggle Ranked */}
                <button
                  type="button"
                  onClick={() => setIsRanked((v) => !v)}
                  className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                    isRanked ? 'text-[#cceeff]' : 'text-[#99aabb]'
                  }`}
                >
                  <div className="relative inline-flex items-center justify-center">
                    {isRanked && (
                      <span className="absolute -top-1 -left-2 w-3.5 h-3.5 rounded-full bg-[#99ccff] text-[#14181c] flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 stroke-[3.5]" />
                      </span>
                    )}
                    {/* Trophy with Star SVG */}
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1zm-7-2.3 1.09 2.21 2.44.35-1.77 1.72.42 2.43L12 11.26l-2.18 1.15.42-2.43-1.77-1.72 2.44-.35L12 5.7z" />
                    </svg>
                  </div>
                  <span className="text-[12px] font-normal">Ranked</span>
                </button>
              </div>
            </div>
          </>
        )}

        {mobileScreen === 'films' && (
          <>
            {/* Top Bar Preta: ← | Films */}
            <header className="bg-black h-[56px] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center">
                <button
                  type="button"
                  aria-label="Back"
                  onClick={() => setMobileScreen('form')}
                  className="min-w-[44px] min-h-[44px] -ml-2.5 flex items-center justify-center text-white active:opacity-70 cursor-pointer"
                >
                  <ArrowLeft className="w-6 h-6 stroke-[2.25]" />
                </button>
                <h1 className="text-[19px] font-bold text-white tracking-tight ml-3">
                  Films
                </h1>
              </div>
            </header>

            {/* Lista de Filmes Adicionados com Reordenação */}
            <div
              className="flex-1 overflow-y-auto divide-y divide-white/10 border-b border-white/10 pb-24"
              onTouchMove={handleTouchMoveGrip}
              onTouchEnd={() => setDragIdx(null)}
            >
              {items.map((item, idx) => {
                const year = item.release_date?.slice(0, 4) || '';
                const posterUrl = item.poster_path
                  ? tmdb.getImageUrl(item.poster_path, 'w185')
                  : null;
                return (
                  <div
                    key={item.id}
                    data-film-row-idx={idx}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragIdx !== null && dragIdx !== idx) {
                        reorderItems(dragIdx, idx);
                        setDragIdx(idx);
                      }
                    }}
                    onDragEnd={() => setDragIdx(null)}
                    className={`px-4 py-3 flex items-center gap-3.5 bg-[#14181c] transition-colors ${
                      dragIdx === idx ? 'bg-white/[0.06]' : ''
                    }`}
                  >
                    {/* Pôster com badge numérico apenas quando Ranked está ativo */}
                    <div className="relative w-[42px] aspect-[2/3] shrink-0">
                      <div className="w-full h-full rounded-[3px] overflow-hidden border border-white/15 bg-[#1c2228]">
                        {posterUrl ? (
                          <img
                            loading="lazy"
                            decoding="async"
                            src={posterUrl}
                            alt={item.title}
                            className="w-full h-full object-cover block"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#556677]">
                            <Film className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      {isRanked && (
                        <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-[#1c2228] border border-white/25 text-[11px] font-bold text-white flex items-center justify-center shadow tabular-nums">
                          {idx + 1}
                        </span>
                      )}
                    </div>

                    {/* Título + Ano */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[15px] font-bold text-white leading-snug">
                          {item.title}
                        </span>
                        {year && (
                          <span className="text-[13px] font-normal text-[#778899] tabular-nums">
                            {year}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Remover + Grip de 6 pontos para arrastar */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label="Remove film"
                        onClick={() => removeMovie(item.id)}
                        className="w-9 h-9 flex items-center justify-center text-[#556677] hover:text-[#ff4455] active:opacity-70 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Reorder film"
                        onTouchStart={() => setDragIdx(idx)}
                        className="w-9 h-11 flex items-center justify-center text-[#778899] touch-none cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botão Flutuante Verde '+' */}
            <button
              type="button"
              aria-label="Add film"
              onClick={() => setMobileScreen('search')}
              className="fixed right-4 bottom-6 z-50 w-[52px] h-[52px] rounded-[16px] bg-[#00e054] hover:bg-[#00c84a] active:scale-95 text-[#14181c] shadow-[0_6px_20px_rgba(0,0,0,0.65)] flex items-center justify-center transition-transform cursor-pointer"
            >
              <Plus className="w-6 h-6 stroke-[2.75]" />
            </button>
          </>
        )}

        {mobileScreen === 'search' && (
          <>
            {/* Top Bar Preta de Busca: ← | Name of film... */}
            <header className="bg-black h-[56px] px-4 flex items-center gap-3 shrink-0">
              <button
                type="button"
                aria-label="Back"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setMobileScreen(items.length > 0 ? 'films' : 'form');
                }}
                className="min-w-[44px] min-h-[44px] -ml-2.5 flex items-center justify-center text-white active:opacity-70 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.25]" />
              </button>

              <input
                ref={mobileSearchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim()) {
                    saveRecentSearch(query.trim());
                  }
                }}
                placeholder="Name of film..."
                className="flex-1 bg-transparent text-[17px] text-white placeholder-[#778899] focus:outline-none"
              />

              {query.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    mobileSearchInputRef.current?.focus();
                  }}
                  className="min-w-[40px] min-h-[40px] -mr-2 flex items-center justify-center text-[#778899] hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </header>

            {/* Corpo: RECENT SEARCHES (quando vazio) ou Resultados em Tempo Real */}
            <div className="flex-1 overflow-y-auto bg-[#14181c]">
              {query.trim().length < 2 ? (
                <div>
                  <div className="px-4 py-3 border-b border-white/10">
                    <span className="text-[12px] font-normal uppercase tracking-wider text-[#99aabb]">
                      RECENT SEARCHES
                    </span>
                  </div>
                  {recentSearches.length > 0 && (
                    <div className="divide-y divide-white/5">
                      {recentSearches.map((term) => (
                        <button
                          type="button"
                          key={term}
                          onClick={() => setQuery(term)}
                          className="w-full text-left px-4 py-3.5 text-[15px] text-[#778899] hover:text-white active:bg-white/5 block cursor-pointer"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {results.map((m) => {
                    const year = m.release_date?.slice(0, 4) || '';
                    const directorText =
                      m.directors && m.directors.length > 0
                        ? m.directors.slice(0, 2).join(', ')
                        : '';
                    const posterUrl = m.poster_path
                      ? tmdb.getImageUrl(m.poster_path, 'w185')
                      : null;

                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => handleSelectMovieMobile(m)}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-3.5 active:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="w-[40px] aspect-[2/3] rounded-[3px] overflow-hidden border border-white/15 bg-[#1c2228] shrink-0">
                          {posterUrl ? (
                            <img
                              loading="lazy"
                              decoding="async"
                              src={posterUrl}
                              alt={m.title}
                              className="w-full h-full object-cover block"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#556677]">
                              <Film className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-[15px] font-bold text-white leading-snug">
                              {m.title}
                            </span>
                            {year && (
                              <span className="text-[13px] font-normal text-[#778899] tabular-nums">
                                {year}
                              </span>
                            )}
                          </div>
                          {directorText && (
                            <p className="text-[12px] text-[#667788] truncate mt-0.5">
                              {directorText}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* =====================================================================
          DESKTOP LAYOUT (>= 768px) — Layout fiel ao Letterboxd (New List)
          ===================================================================== */}
      <div className="hidden md:block">
        {/* Top Metadata Form Section */}
        <div className="max-w-[950px] mx-auto px-4 pt-8 pb-8">
          <div className="border-b border-[#303844] pb-2.5 mb-7">
            <h1 className="text-[26px] font-light text-[#99aabb] tracking-normal leading-tight">
              {t('create_list_title')}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-12 items-start">
            {/* Left Column: Name, Tags, Who can view, Ranked list */}
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-normal text-white mb-1.5">
                  <span className="w-[7px] h-[7px] rounded-full bg-[#00e054] inline-block shadow-[0_0_6px_rgba(0,224,84,0.65)]" />
                  <span>{t('create_list_lbl_name')}</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-[36px] bg-[#2c3440] border border-[#384250] rounded-[3px] px-3 text-[14px] text-[#ccddee] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] focus:bg-white focus:text-[#14181c] focus:border-white focus:outline-none transition-colors"
                />
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="text-[13px] font-normal text-white">
                    {t('create_list_lbl_tags')}
                  </label>
                  <span className="text-[11px] text-[#667788]">
                    {t('create_list_tags_hint')}
                  </span>
                </div>
                <div className="w-full min-h-[36px] bg-[#2c3440] border border-[#384250] rounded-[3px] px-2.5 py-1 flex flex-wrap items-center gap-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] focus-within:bg-white focus-within:text-[#14181c] focus-within:border-white transition-colors">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 bg-[#445566] text-white text-[11px] font-medium px-2 py-0.5 rounded-[2px]"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-[#ff8000] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={commitTag}
                    placeholder={tags.length === 0 ? t('create_list_tags_ph') : ''}
                    className="flex-1 min-w-[90px] bg-transparent text-[13px] placeholder-[#556677] focus:outline-none"
                  />
                </div>
              </div>

              {/* Who can view */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[13px] font-normal text-white">
                    {t('create_list_lbl_who_can_view')}
                  </label>
                  <span
                    title="Control whether your list is visible to everyone or only to you."
                    className="w-[14px] h-[14px] rounded-full bg-[#556677] text-[#14181c] text-[10px] font-extrabold inline-flex items-center justify-center cursor-help select-none"
                  >
                    ?
                  </span>
                </div>
                <div className="relative">
                  <select
                    value={visibility}
                    onChange={(e) =>
                      setVisibility(e.target.value as 'public' | 'friends' | 'private')
                    }
                    className="w-full h-[36px] appearance-none bg-[#2c3440] hover:bg-[#323b48] border border-[#384250] rounded-[3px] px-3 pr-8 text-[13px] text-[#99aabb] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] focus:outline-none focus:border-[#556677] cursor-pointer transition-colors"
                  >
                    <option value="public">{t('create_list_view_public')}</option>
                    <option value="friends">{t('create_list_view_friends')}</option>
                    <option value="private">{t('create_list_view_private')}</option>
                  </select>
                  {/* Double up/down triangles icon like native Letterboxd select */}
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-[#778899]">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 10 14" fill="currentColor">
                      <path d="M5 1L9 5.5H1L5 1Z" />
                      <path d="M5 13L1 8.5H9L5 13Z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Ranked list */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isRanked}
                    onClick={() => setIsRanked((v) => !v)}
                    className={`w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-colors cursor-pointer ${
                      isRanked
                        ? 'bg-[#00e054] border-[#00e054] text-[#14181c]'
                        : 'bg-[#2c3440] border-[#384250] hover:border-[#556677]'
                    }`}
                  >
                    {isRanked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                  <span className="text-[13px] font-normal text-white">
                    {t('create_list_lbl_ranked')}
                  </span>
                </label>
                <span className="text-[11px] text-[#667788]">
                  {t('create_list_ranked_hint')}
                </span>
              </div>
            </div>

            {/* Right Column: Description */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-[13px] font-normal text-white">
                  {t('create_list_description')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowHtmlHint((v) => !v)}
                  className="text-[11px] text-[#667788] hover:text-[#99aabb] transition-colors cursor-pointer"
                >
                  {t('create_list_show_html')}
                </button>
              </div>
              {showHtmlHint && (
                <div className="mb-2 p-2.5 rounded-[3px] bg-[#202830] border border-[#303844] text-[11px] text-[#8899aa] leading-relaxed">
                  You can use{' '}
                  <code className="text-white">&lt;b&gt;</code>,{' '}
                  <code className="text-white">&lt;i&gt;</code>,{' '}
                  <code className="text-white">&lt;a href=&quot;...&quot;&gt;</code>,{' '}
                  <code className="text-white">&lt;blockquote&gt;</code> and{' '}
                  <code className="text-white">&lt;ul&gt;/&lt;li&gt;</code> in your description.
                </div>
              )}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-[222px] bg-[#2c3440] border border-[#384250] rounded-[3px] p-3 text-[13px] text-[#ccddee] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] focus:bg-white focus:text-[#14181c] focus:border-white focus:outline-none resize-y transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Lower Darker Full-Bleed Band: Toolbar + Film Items Area */}
        <div className="w-full bg-[#14181c] border-t border-[#202830] pt-6 pb-20 min-h-[380px]">
          <div className="max-w-[950px] mx-auto px-4">
            {/* Toolbar Row */}
            <div className="flex items-center justify-between gap-4 mb-5">
              {/* Left: Add + Search Input + Autocomplete + or + Import */}
              <div className="flex items-center">
                <div ref={dropdownWrapperRef} className="relative flex items-stretch">
                  <button
                    type="button"
                    onClick={() => addInputRef.current?.focus()}
                    className="bg-[#00b020] hover:bg-[#00c424] text-white font-bold text-[13px] px-3.5 h-[32px] rounded-l-[3px] flex items-center justify-center cursor-pointer select-none shrink-0 transition-colors"
                  >
                    {t('create_list_btn_add')}
                  </button>
                  <input
                    ref={addInputRef}
                    type="text"
                    value={query}
                    onFocus={() => setIsAddFocused(true)}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setIsAddFocused(true);
                    }}
                    onKeyDown={handleAddInputKeyDown}
                    placeholder={isInputWhite ? '' : t('create_list_add_film_ph')}
                    className={`w-[255px] h-[32px] px-2.5 text-[13px] rounded-r-[3px] border border-l-0 focus:outline-none transition-colors ${
                      isInputWhite
                        ? 'bg-white text-[#14181c] border-white placeholder-[#778899]'
                        : 'bg-[#2c3440] text-[#ccddee] border-[#384250] placeholder-[#667788]'
                    }`}
                  />

                  {/* Autocomplete Dropdown (Letterboxd style directly under input) */}
                  {isAddFocused && results.length > 0 && (
                    <div className="absolute left-[46px] top-[32px] w-[255px] z-50 bg-[#667788] rounded-b-[3px] shadow-[0_10px_28px_rgba(0,0,0,0.75)] max-h-[218px] overflow-y-auto divide-y divide-white/10">
                      {results.map((m, idx) => {
                        const year = m.release_date?.slice(0, 4) || '';
                        const hasAltOriginal =
                          m.original_title &&
                          m.original_title.trim().toLowerCase() !== m.title.trim().toLowerCase();
                        const yearParen = year
                          ? `(${year}${hasAltOriginal ? `, ${m.original_title}` : ''})`
                          : '';
                        const directorText =
                          m.directors && m.directors.length > 0
                            ? m.directors.slice(0, 2).join(', ')
                            : '';
                        const isHighlighted = idx === activeResultIdx;

                        return (
                          <button
                            type="button"
                            key={m.id}
                            onMouseEnter={() => setActiveResultIdx(idx)}
                            onMouseDown={(e) => {
                              // Prevent input blur before addMovie fires
                              e.preventDefault();
                              addMovie(m);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 transition-colors cursor-pointer block leading-snug ${
                              isHighlighted
                                ? 'bg-[#00b820] text-white'
                                : 'bg-[#667788] text-white hover:bg-[#00b820]'
                            }`}
                          >
                            <span className="text-[12.5px] font-semibold">
                              {m.title}
                              {yearParen ? ` ${yearParen}` : ''}
                            </span>
                            {directorText && (
                              <span className="text-[11px] font-normal text-white/85 ml-1">
                                {directorText}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <span className="text-[12px] text-[#667788] mx-2.5 select-none">
                  {t('create_list_or')}
                </span>

                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportCsv}
                />
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  className="h-[32px] px-3.5 bg-[#445566] hover:bg-[#556677] text-[#ccddee] hover:text-white font-bold text-[12px] rounded-[3px] transition-colors cursor-pointer"
                >
                  {t('create_list_btn_import')}
                </button>
              </div>

              {/* Right: View Toggle + Sort By + Cancel + Save */}
              <div className="flex items-center gap-2">
                {/* List / Grid View Mode Switcher */}
                <div className="flex items-center h-[32px] rounded-[3px] overflow-hidden border border-[#303844] bg-[#202830]">
                  <button
                    type="button"
                    onClick={() => setDesktopView('list')}
                    title={t('common_list_view')}
                    className={`w-[32px] h-full flex items-center justify-center transition-colors cursor-pointer ${
                      desktopView === 'list'
                        ? 'bg-[#556677] text-white'
                        : 'text-[#667788] hover:text-[#99aabb]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="1" y="2" width="2.5" height="2.5" rx="0.4" />
                      <rect x="5" y="2.5" width="10" height="1.5" rx="0.4" />
                      <rect x="1" y="6.75" width="2.5" height="2.5" rx="0.4" />
                      <rect x="5" y="7.25" width="10" height="1.5" rx="0.4" />
                      <rect x="1" y="11.5" width="2.5" height="2.5" rx="0.4" />
                      <rect x="5" y="12" width="10" height="1.5" rx="0.4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDesktopView('grid')}
                    title={t('common_grid_view')}
                    className={`w-[32px] h-full flex items-center justify-center border-l border-[#303844] transition-colors cursor-pointer ${
                      desktopView === 'grid'
                        ? 'bg-[#556677] text-white'
                        : 'text-[#667788] hover:text-[#99aabb]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M2 2H7V7H2V2ZM3.5 3.5V5.5H5.5V3.5H3.5ZM9 2H14V7H9V2ZM10.5 3.5V5.5H12.5V3.5H10.5ZM2 9H7V14H2V9ZM3.5 10.5V12.5H5.5V10.5H3.5ZM9 9H14V14H9V9ZM10.5 10.5V12.5H12.5V10.5H10.5Z"
                      />
                    </svg>
                  </button>
                </div>

                {/* Sort by dropdown */}
                <div ref={sortWrapperRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setSortDropdownOpen((v) => !v)}
                    className="h-[32px] px-3 bg-[#1c2228] hover:bg-[#242c34] border border-[#303844] text-[#99aabb] hover:text-white text-[12px] font-semibold rounded-[3px] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{t('create_list_sort_by')}</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {sortDropdownOpen && (
                    <div className="absolute right-0 top-[36px] w-52 bg-[#2c3440] border border-[#445566] rounded-[3px] shadow-xl py-1 z-40 text-[12px] text-[#ccddee]">
                      <button
                        type="button"
                        onClick={() => sortItems('reverse')}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#445566] hover:text-white cursor-pointer"
                      >
                        {t('create_list_sort_reverse')}
                      </button>
                      <button
                        type="button"
                        onClick={() => sortItems('shuffle')}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#445566] hover:text-white cursor-pointer"
                      >
                        {t('create_list_sort_shuffle')}
                      </button>
                      <button
                        type="button"
                        onClick={() => sortItems('name')}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#445566] hover:text-white cursor-pointer"
                      >
                        {t('create_list_sort_name')}
                      </button>
                      <button
                        type="button"
                        onClick={() => sortItems('newest')}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#445566] hover:text-white cursor-pointer"
                      >
                        {t('create_list_sort_newest')}
                      </button>
                      <button
                        type="button"
                        onClick={() => sortItems('oldest')}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#445566] hover:text-white cursor-pointer"
                      >
                        {t('create_list_sort_oldest')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Cancel */}
                <button
                  type="button"
                  onClick={() => navigate('/lists')}
                  className="h-[32px] px-3.5 bg-[#556677] hover:bg-[#667788] text-white font-bold text-[13px] rounded-[3px] transition-colors cursor-pointer"
                >
                  {t('btn_cancel')}
                </button>

                {/* Save */}
                <button
                  type="button"
                  onClick={() => saveListAndNavigate('/lists')}
                  disabled={!title.trim() || items.length === 0}
                  className={`h-[32px] px-4 font-bold text-[13px] rounded-[3px] transition-colors ${
                    title.trim() && items.length > 0
                      ? 'bg-[#009d1a] hover:bg-[#00b820] text-white cursor-pointer'
                      : 'bg-[#009d1a]/60 text-white/70 cursor-not-allowed'
                  }`}
                >
                  {t('btn_save')}
                </button>
              </div>
            </div>

            {/* List Items Content Area */}
            {items.length === 0 ? (
              <div className="border border-[#2c3440] rounded-[4px] py-14 px-6 text-center">
                <h3 className="text-[16px] font-bold text-white mb-1.5">
                  {t('create_list_empty_heading')}
                </h3>
                <p className="text-[12px] text-[#778899]">
                  {t('create_list_empty_sub_1')}{' '}
                  <button
                    type="button"
                    onClick={() => addInputRef.current?.focus()}
                    className="font-bold text-[#99aabb] hover:text-white cursor-pointer"
                  >
                    {t('create_list_empty_sub_bold')}
                  </button>{' '}
                  {t('create_list_empty_sub_2')}
                </p>
              </div>
            ) : desktopView === 'grid' ? (
              /* Grid View */
              <div className="grid grid-cols-6 gap-3.5">
                {items.map((item, idx) => (
                  <div key={item.id} className="group relative">
                    <div className="relative aspect-[2/3] rounded-[3px] overflow-hidden border border-white/15 bg-[#1c2228] shadow">
                      {item.poster_path ? (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={tmdb.getImageUrl(item.poster_path, 'w342')}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#556677]">
                          <Film className="w-6 h-6" />
                        </div>
                      )}
                      {/* Hover overlay with move / remove actions */}
                      <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeMovie(item.id)}
                            title="Remove"
                            className="w-6 h-6 rounded-full bg-black/70 text-[#99aabb] hover:text-[#ff3344] flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-white leading-tight line-clamp-2">
                            {item.title}
                          </p>
                          <div className="flex items-center justify-between pt-1 border-t border-white/15">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveItem(idx, 'up')}
                              className="p-1 text-[#99aabb] hover:text-white disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5 -rotate-90" />
                            </button>
                            <span className="text-[10px] text-[#99aabb]">
                              {item.release_date?.slice(0, 4)}
                            </span>
                            <button
                              type="button"
                              disabled={idx === items.length - 1}
                              onClick={() => moveItem(idx, 'down')}
                              className="p-1 text-[#99aabb] hover:text-white disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5 -rotate-90" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {isRanked && (
                      <div className="mt-1.5 text-center font-mono text-[12px] font-bold text-[#99aabb]">
                        {idx + 1}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* List View */
              <div className="divide-y divide-[#242c34] border border-[#2c3440] rounded-[4px] overflow-hidden">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="bg-[#181e24] hover:bg-[#1c2228] p-3.5 flex items-center gap-4 transition-colors"
                  >
                    {isRanked && (
                      <span className="font-mono font-bold text-sm text-[#99aabb] w-7 text-center">
                        {idx + 1}
                      </span>
                    )}

                    {item.poster_path ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={tmdb.getImageUrl(item.poster_path, 'w92')}
                        alt={item.title}
                        className="w-11 aspect-[2/3] object-cover rounded-[2px] border border-white/10 shadow"
                      />
                    ) : (
                      <div className="w-11 aspect-[2/3] rounded-[2px] border border-white/10 bg-[#1c2228] flex items-center justify-center text-[#556677]">
                        <Film className="w-4 h-4" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[15px] font-bold text-white truncate">
                          {item.title}
                        </span>
                        <span className="text-[12px] text-[#778899]">
                          {item.release_date?.slice(0, 4)}
                        </span>
                        {item.director && (
                          <span className="text-[12px] text-[#667788]">
                            • {item.director}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder={t('create_list_note_ph')}
                        value={item.notes}
                        onChange={(e) => updateNotes(item.id, e.target.value)}
                        className="w-full max-w-xl bg-[#2c3440] border border-[#384250] rounded-[3px] px-2.5 py-1 text-[12px] text-[#ccddee] focus:bg-white focus:text-[#14181c] focus:outline-none transition-colors"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, 'up')}
                        className="p-1.5 text-[#778899] hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === items.length - 1}
                        onClick={() => moveItem(idx, 'down')}
                        className="p-1.5 text-[#778899] hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMovie(item.id)}
                        className="p-1.5 text-[#778899] hover:text-[#ff3344] ml-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
