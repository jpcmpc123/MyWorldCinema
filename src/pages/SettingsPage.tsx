import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Film, Upload, Download, ImageIcon, X, Check, XCircle, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES } from '../i18n/translations';
import type { TranslationKey } from '../i18n/translations';
import { supabase } from '../lib/supabase';
import { tmdb } from '../services/tmdb';

type TabKey = 'profile' | 'avatar' | 'data';

const TABS: { key: TabKey; label: TranslationKey }[] = [
  { key: 'profile', label: 'nav_profile' },
  { key: 'avatar', label: 'cfg_tab_avatar' },
  { key: 'data', label: 'cfg_tab_data' },
];

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const inputClass =
  'w-full bg-lb-bg border border-lb-elevated focus:border-lb-green rounded px-3 py-2 text-sm text-white placeholder-lb-muted focus:outline-none transition-colors';

const FieldLabel: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <label className="block mb-1.5">
    <span className="text-[10px] font-bold uppercase tracking-widest text-lb-muted">{children}</span>
    {hint && <span className="ml-2 text-[10px] text-lb-muted/70 normal-case font-normal">{hint}</span>}
  </label>
);

const Notice: React.FC<{ kind: 'success' | 'error' | 'info'; message: string }> = ({ kind, message }) => (
  <div
    className={`flex items-start gap-2 rounded border px-3 py-2 text-xs mb-4 ${
      kind === 'success'
        ? 'border-lb-green/40 bg-lb-green/10 text-lb-green'
        : kind === 'error'
          ? 'border-red-500/40 bg-red-500/10 text-red-400'
          : 'border-lb-blue/40 bg-lb-blue/10 text-lb-blue'
    }`}
  >
    {kind === 'success' ? (
      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
    ) : (
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
    )}
    <span>{message}</span>
  </div>
);

// Seletor de idioma — EXCLUSIVO das configurações para usuários logados
// (visitantes usam o botão de globo no Header).
const LanguageBlock: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="mb-6 rounded border border-lb-elevated bg-lb-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-lb-green" />
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-lb-muted">
          {t('filter_language')}
        </h2>
      </div>
      <div className="flex gap-2">
        {LANGUAGES.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLanguage(l.id)}
            className={`flex-1 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
              language === l.id
                ? 'bg-lb-green text-lb-bg border-lb-green'
                : 'bg-lb-bg text-lb-text border-lb-elevated hover:border-lb-green hover:text-white'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : 'profile';
  const setTab = (tab: TabKey) => setSearchParams({ tab });

  if (!loading && !isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-lb-muted text-sm">{t('cfg_loading')}</div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 md:py-10">
      <h1 className="max-md:hidden text-3xl md:text-4xl font-light text-white tracking-tight mb-6">{t('cfg_title')}</h1>

      {/* Horizontal green tab bar */}
      <div className="max-md:hidden border-b border-lb-elevated mb-8">
        <nav className="flex gap-6 -mb-px">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`pb-2.5 text-xs font-bold uppercase tracking-widest cursor-pointer border-b-2 transition-colors ${
                activeTab === tb.key
                  ? 'border-lb-green text-lb-green'
                  : 'border-transparent text-lb-muted hover:text-white'
              }`}
            >
              {t(tb.label)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'profile' && (
        <>
          {/* Troca de idioma (PT / EN) — desktop e mobile */}
          <LanguageBlock />
          {/* Mobile "Profile Settings" screen */}
          <div className="md:hidden">
            <MobileProfileSettings />
          </div>
          <div className="max-md:hidden">
            <ProfileTab />
          </div>
        </>
      )}
      {activeTab === 'avatar' && <AvatarTab />}
      {activeTab === 'data' && <DataTab />}
    </div>
  );
};

/* ─────────────────────────────── Profile ─────────────────────────────── */

interface ProfileForm {
  username: string;
  location: string;
  website: string;
  bio: string;
}

const ProfileTab: React.FC = () => {
  const { user: authUser, session, profile } = useAuth();
  const { updateUser, top4MovieIds, openTop4Picker } = useApp();
  const { t } = useLanguage();

  const [form, setForm] = useState<ProfileForm>({
    username: profile?.username ?? '',
    location: '',
    website: '',
    bio: profile?.bio ?? '',
  });
  const [extraFieldsAvailable, setExtraFieldsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [top4Meta, setTop4Meta] = useState<Record<number, { title: string; poster: string | null }>>({});

  // Load extended fields (location/website) — tolerant if migration not applied yet
  useEffect(() => {
    const loadExtended = async () => {
      if (!supabase || !authUser) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('username, bio, location, website')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        setExtraFieldsAvailable(false);
        return;
      }
      if (data) {
        const row = data as Record<string, string | null>;
        setForm({
          username: row.username ?? '',
          location: row.location ?? '',
          website: row.website ?? '',
          bio: row.bio ?? '',
        });
      }
    };
    void loadExtended();
  }, [authUser]);

  // Load Top 4 posters for the right-hand "FAVORITE FILMS" panel
  useEffect(() => {
    const load = async () => {
      const results = await Promise.all(
        top4MovieIds
          .filter((id) => id > 0)
          .map(async (id) => {
            try {
              const d = await tmdb.getMovieDetails(id);
              return [id, { title: d.title, poster: d.poster_path }] as const;
            } catch {
              return null;
            }
          })
      );
      setTop4Meta(Object.fromEntries(results.filter(Boolean) as NonNullable<(typeof results)[number]>[]));
    };
    void load();
  }, [top4MovieIds]);

  const set = (key: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!USERNAME_RE.test(form.username)) {
      setNotice({
        kind: 'error',
        message: t('cfg_username_invalid'),
      });
      return;
    }
    if (!supabase || !authUser) {
      setNotice({ kind: 'error', message: t('cfg_supabase_missing') });
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      username: form.username,
      bio: form.bio,
      location: form.location,
      website: form.website,
    };

    let { error } = await supabase.from('profiles').update(payload).eq('id', authUser.id);

    // If location/website columns don't exist yet, retry without them
    if (error && /location|website/i.test(error.message)) {
      setExtraFieldsAvailable(false);
      delete payload.location;
      delete payload.website;
      ({ error } = await supabase.from('profiles').update(payload).eq('id', authUser.id));
    }

    setSaving(false);

    if (error) {
      const isUnique = error.code === '23505' || /duplicate key|unique/i.test(error.message);
      setNotice({
        kind: 'error',
        message: isUnique ? `${t('cfg_username')} "${form.username}" ${t('cfg_is_taken')}` : error.message,
      });
      return;
    }

    updateUser({
      username: form.username,
      bio: form.bio,
      location: form.location,
      website: form.website,
    });
    setNotice({ kind: 'success', message: t('cfg_profile_updated') });
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col lg:flex-row gap-10">
      {/* Left column: form fields */}
      <div className="flex-1 min-w-0 space-y-5">
        {!extraFieldsAvailable && (
          <Notice
            kind="info"
            message={t('cfg_ext_migration')}
          />
        )}
        {notice && <Notice kind={notice.kind} message={notice.message} />}

        <div>
          <FieldLabel hint={t('cfg_username_hint')}>{t('cfg_username')}</FieldLabel>
          <input type="text" value={form.username} onChange={set('username')} className={inputClass} />
        </div>

        <div>
          <FieldLabel hint={t('cfg_email_hint')}>{t('cfg_email')}</FieldLabel>
          <input
            type="email"
            value={session?.user?.email ?? ''}
            readOnly
            disabled
            className={`${inputClass} opacity-60 cursor-not-allowed`}
          />
        </div>

        <div>
          <FieldLabel>{t('cfg_location')}</FieldLabel>
          <input
            type="text"
            value={form.location}
            onChange={set('location')}
            placeholder={t('cfg_location_ph')}
            className={inputClass}
            disabled={!extraFieldsAvailable}
          />
        </div>

        <div>
          <FieldLabel>{t('cfg_website')}</FieldLabel>
          <input
            type="text"
            value={form.website}
            onChange={set('website')}
            placeholder={t('cfg_website_ph')}
            className={inputClass}
            disabled={!extraFieldsAvailable}
          />
        </div>

        <div>
          <FieldLabel>{t('cfg_bio')}</FieldLabel>
          <textarea
            value={form.bio}
            onChange={set('bio')}
            rows={5}
            placeholder={t('cfg_bio_ph')}
            className={`${inputClass} resize-y`}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-log-green text-lb-bg font-black text-sm px-8 py-3 rounded uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('cfg_saving') : t('cfg_save_changes')}
        </button>
      </div>

      {/* Right column: FAVORITE FILMS panel */}
      <aside className="lg:w-64 shrink-0">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-lb-muted border-b border-lb-elevated pb-2 mb-3">
          {t('cfg_favorite_films')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((slot) => {
            const id = top4MovieIds[slot];
            const movie = id ? top4Meta[id] : undefined;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => openTop4Picker(slot)}
                title={movie ? `${movie.title} ${t('cfg_click_change')}` : t('cfg_pick_film')}
                className="aspect-[2/3] rounded overflow-hidden bg-lb-bg border border-lb-elevated hover:border-lb-green transition-colors cursor-pointer relative group"
              >
                {id && movie?.poster ? (
                  <img loading="lazy" decoding="async"
                    src={tmdb.getImageUrl(movie.poster, 'w185')}
                    alt={movie.title}
                    className="w-full h-full object-cover group-hover:opacity-60 transition-opacity"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lb-muted group-hover:text-lb-green">
                    <Film className="w-6 h-6" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-lb-muted mt-3">{t('cfg_drag_reorder')}</p>
      </aside>
    </form>
  );
};

/* ─────────────────────── Mobile "Profile Settings" ─────────────────────── */

const mobileInputClass =
  'w-full bg-[#2c3440] rounded-md px-3 py-2.5 text-sm text-white placeholder:text-lb-muted/70 focus:outline-none focus:ring-1 focus:ring-lb-green transition-shadow';

const MobileField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <span className="block mb-1 text-[10px] font-bold uppercase tracking-widest text-lb-muted">
      {label}
    </span>
    {children}
  </div>
);

const MobileProfileSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user: authUser, session, signOut } = useAuth();
  const { user: appUser, updateUser, top4MovieIds, setTop4Movie } = useApp();

  // Barra preta do Header (✕ / ✓) dispara estes eventos
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    const onCancel = () => navigate(-1);
    const onSave = () => void handleSaveRef.current();
    window.addEventListener('settings:cancel', onCancel);
    window.addEventListener('settings:save', onSave);
    return () => {
      window.removeEventListener('settings:cancel', onCancel);
      window.removeEventListener('settings:save', onSave);
    };
  }, [navigate]);

  const nameParts = (appUser.displayName || '').split(' ');
  const [form, setForm] = useState({
    givenName: nameParts[0] ?? '',
    familyName: nameParts.slice(1).join(' ') ?? '',
    location: appUser.location ?? '',
    website: appUser.website ?? '',
    bio: appUser.bio ?? '',
    pronoun: '',
  });
  const [customPosters, setCustomPosters] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [top4Meta, setTop4Meta] = useState<Record<number, { title: string; poster: string | null }>>({});

  // Load Top 4 posters for the FAVORITE FILMS grid
  useEffect(() => {
    const load = async () => {
      const results = await Promise.all(
        top4MovieIds
          .filter((id) => id > 0)
          .map(async (id) => {
            try {
              const d = await tmdb.getMovieDetails(id);
              return [id, { title: d.title, poster: d.poster_path }] as const;
            } catch {
              return null;
            }
          })
      );
      setTop4Meta(Object.fromEntries(results.filter(Boolean) as NonNullable<(typeof results)[number]>[]));
    };
    void load();
  }, [top4MovieIds]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    setNotice(null);
    setSaving(true);
    const displayName = [form.givenName, form.familyName].filter(Boolean).join(' ');
    updateUser({
      displayName,
      bio: form.bio,
      location: form.location,
      website: form.website,
    });
    // Best-effort persist to Supabase (same fields as the desktop form)
    if (supabase && authUser) {
      await supabase
        .from('profiles')
        .update({ bio: form.bio, location: form.location, website: form.website })
        .eq('id', authUser.id);
    }
    setSaving(false);
    navigate(-1);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  // Mantém a ref da barra apontando para o save mais recente (com o form atual)
  handleSaveRef.current = handleSave;

  return (
    <div className="space-y-5 pb-24 -mx-4 px-4">
      {/* ✕ / título / ✓ ficam na barra preta do Header (ver Header.tsx, isSettingsRoute) */}

      {notice && <Notice kind={notice.kind} message={notice.message} />}

      {/* Sign out */}
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="w-full bg-orange-500 text-white rounded-md py-2.5 font-bold text-sm cursor-pointer hover:bg-orange-600 transition-colors"
      >
        {t('nav_sign_out')}
      </button>

      {/* Dark input rows */}
      <div className="space-y-4">
        <MobileField label={t('cfg_given_name')}>
          <input type="text" value={form.givenName} onChange={set('givenName')} className={mobileInputClass} />
        </MobileField>
        <MobileField label={t('cfg_family_name')}>
          <input type="text" value={form.familyName} onChange={set('familyName')} className={mobileInputClass} />
        </MobileField>
        <MobileField label={t('cfg_email')}>
          <input
            type="email"
            value={session?.user?.email ?? ''}
            readOnly
            disabled
            className={`${mobileInputClass} opacity-60 cursor-not-allowed`}
          />
        </MobileField>
        <MobileField label={t('cfg_location')}>
          <input type="text" value={form.location} onChange={set('location')} className={mobileInputClass} />
        </MobileField>
        <MobileField label={t('cfg_website')}>
          <input type="text" value={form.website} onChange={set('website')} className={mobileInputClass} />
        </MobileField>
        <MobileField label={t('cfg_bio')}>
          <textarea rows={3} value={form.bio} onChange={set('bio')} className={`${mobileInputClass} resize-y`} />
        </MobileField>
        <MobileField label={t('cfg_pronoun')}>
          <input
            type="text"
            value={form.pronoun}
            onChange={set('pronoun')}
            placeholder={t('cfg_pronoun_ph')}
            className={mobileInputClass}
          />
        </MobileField>

        {/* Alternância de pôsteres personalizados */}
        <div className="flex items-center justify-between bg-[#2c3440] rounded-md px-3 py-2.5">
          <span className="text-sm text-white">{t('cfg_custom_posters')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={customPosters}
            onClick={() => setCustomPosters((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
              customPosters ? 'bg-lb-green' : 'bg-lb-elevated'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                customPosters ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* FAVORITE FILMS — tap ⊗ to remove a poster from the slot */}
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-widest text-lb-muted font-bold">{t('cfg_favorite_films')}</h3>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((slot) => {
            const id = top4MovieIds[slot];
            const movie = id ? top4Meta[id] : undefined;
            return (
              <div
                key={`mob-top4-${slot}`}
                className="relative aspect-[2/3] rounded-md overflow-hidden bg-[#2c3440] border border-white/10"
              >
                {id && movie?.poster ? (
                  <img loading="lazy" decoding="async"
                    src={tmdb.getImageUrl(movie.poster, 'w185')}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lb-muted">
                    <Film className="w-5 h-5" />
                  </div>
                )}
                {id > 0 && (
                  <button
                    type="button"
                    aria-label={t('cfg_remove_favorite')}
                    onClick={() => setTop4Movie(slot, 0)}
                    className="absolute top-1 right-1 z-10 text-orange-500 bg-black/60 rounded-full cursor-pointer hover:scale-110 transition-transform"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FAVORITE SERIES — no series top-4 exists in AppContext yet; removal is a stub */}
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-widest text-lb-muted font-bold">{t('cfg_favorite_series')}</h3>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((slot) => (
            <div
              key={`mob-top4tv-${slot}`}
              className="relative aspect-[2/3] rounded-md overflow-hidden bg-[#2c3440] border border-white/10 flex items-center justify-center text-lb-muted"
            >
              <Film className="w-5 h-5" />
              <button
                type="button"
                aria-label={t('cfg_remove_fav_series')}
                onClick={() => {
                  /* stub: wire to a series top-4 list when it exists in AppContext */
                }}
                className="absolute top-1 right-1 z-10 text-orange-500 bg-black/60 rounded-full cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

/* ─────────────────────────────── Avatar ─────────────────────────────── */

const AvatarTab: React.FC = () => {
  const { user: authUser, profile } = useAuth();
  const { user: appUser, updateUser } = useApp();
  const { t } = useLanguage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentAvatar = profile?.avatar_url || appUser.avatarUrl;

  const [avatarUrlInput, setAvatarUrlInput] = useState(profile?.avatar_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);

  const avatarSrc = avatarUrlInput || currentAvatar;

  const applyAvatarToProfile = async (url: string) => {
    if (!supabase || !authUser) {
      setNotice({ kind: 'error', message: t('cfg_supabase_missing') });
      return false;
    }
    const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', authUser.id);
    if (error) {
      setNotice({ kind: 'error', message: error.message });
      return false;
    }
    updateUser({ avatarUrl: url });
    setAvatarUrlInput(url);
    return true;
  };

  const handleUploadFile = async (file: File) => {
    setNotice(null);
    if (!file.type.startsWith('image/')) {
      setNotice({ kind: 'error', message: 'Please choose an image file (PNG, JPG, WebP…).' });
      return;
    }
    if (!supabase || !authUser) {
      setNotice({ kind: 'error', message: t('cfg_supabase_missing') });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${authUser.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setUploading(false);
      setNotice({
        kind: 'error',
        message: `${t('cfg_upload_failed')}: ${uploadError.message}. ${t('cfg_bucket_hint')}`,
      });
      return;
    }

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    // Bust cache: append timestamp so the new avatar shows immediately
    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const ok = await applyAvatarToProfile(publicUrl);
    setUploading(false);
    if (ok) setNotice({ kind: 'success', message: t('cfg_avatar_updated') });
  };

  const handleSaveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!avatarUrlInput.trim()) {
      setNotice({ kind: 'error', message: t('cfg_paste_url_first') });
      return;
    }
    setSavingUrl(true);
    const ok = await applyAvatarToProfile(avatarUrlInput.trim());
    setSavingUrl(false);
    if (ok) setNotice({ kind: 'success', message: t('cfg_avatar_updated') });
  };

  return (
    <div className="flex flex-col md:flex-row gap-10 items-start">
      {/* Pré-visualização do avatar atual */}
      <div className="flex flex-col items-center gap-3">
        <img loading="lazy" decoding="async"
          src={avatarSrc}
          alt={t('cfg_current_avatar')}
          className="w-40 h-40 rounded-full object-cover border-2 border-lb-elevated bg-lb-bg shadow-xl"
        />
        <span className="text-[10px] uppercase font-bold tracking-widest text-lb-muted">{t('cfg_current_avatar')}</span>
      </div>

      <div className="flex-1 min-w-0 space-y-6 w-full">
        {notice && <Notice kind={notice.kind} message={notice.message} />}

        {/* Upload */}
        <section className="bg-lb-surface border border-lb-elevated rounded p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-lb-muted mb-3">{t('cfg_upload_avatar')}</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUploadFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-log-green text-lb-bg font-black text-xs px-5 py-2.5 rounded uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
            {uploading ? t('cfg_uploading') : t('cfg_choose_image')}
          </button>
          <p className="text-[11px] text-lb-muted mt-3">
            {t('cfg_avatar_hint_1')} <code className="text-lb-blue">avatars</code> {t('cfg_avatar_hint_2')}
          </p>
        </section>

        {/* URL fallback */}
        <section className="bg-lb-surface border border-lb-elevated rounded p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-lb-muted mb-3">
            {t('cfg_or_paste_url')}
          </h2>
          <form onSubmit={handleSaveUrl} className="flex gap-2">
            <input
              type="url"
              value={avatarUrlInput}
              onChange={(e) => setAvatarUrlInput(e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={savingUrl}
              className="shrink-0 btn-log-green text-lb-bg font-black text-xs px-5 py-2 rounded uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {savingUrl ? t('cfg_saving') : t('cfg_save')}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

/* ─────────────────────────────── Data ─────────────────────────────── */

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
}

interface PendingImport {
  name: string;
  year: string;
}

const DataTab: React.FC = () => {
  const { user: authUser, isAuthenticated } = useAuth();
  const { logs, watchlist, saveLog } = useApp();
  const { t } = useLanguage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [pendingImports, setPendingImports] = useState<PendingImport[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('lb_pending_imports') ?? '[]');
    } catch {
      return [];
    }
  });

  const handleImportFile = async (file: File) => {
    setNotice(null);
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());

      if (lines.length < 2) {
        setNotice({ kind: 'error', message: t('cfg_csv_empty') });
        return;
      }

      // Parse (simple CSV; handles quoted cells)
      const splitCsvLine = (line: string): string[] => {
        const out: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') inQuotes = false;
            else cur += ch;
          } else if (ch === '"') {
            inQuotes = true;
          } else if (ch === ',') {
            out.push(cur);
            cur = '';
          } else {
            cur += ch;
          }
        }
        out.push(cur);
        return out.map((s) => s.trim());
      };

      const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
      const idx = (name: string) => header.indexOf(name);

      const hasFilmId = idx('film_id') !== -1;
      const hasName = idx('name') !== -1;

      if (!hasFilmId && !hasName) {
        setNotice({
          kind: 'error',
          message: t('cfg_csv_unrecognized'),
        });
        return;
      }

      let count = 0;
      const newPending: PendingImport[] = [];

      for (const line of lines.slice(1)) {
        const cols = splitCsvLine(line);
        if (hasFilmId) {
          const filmId = parseInt(cols[idx('film_id')], 10);
          if (!Number.isFinite(filmId)) continue;
          const rating = idx('rating') !== -1 ? parseFloat(cols[idx('rating')]) || 0 : 0;
          const liked = idx('liked') !== -1 ? ['true', '1', 'yes'].includes((cols[idx('liked')] ?? '').toLowerCase()) : false;
          const watchedOn = idx('watched_on') !== -1 ? cols[idx('watched_on')] : '';
          saveLog({
            movieId: filmId,
            movieTitle: hasName ? cols[idx('name')] : `Film #${filmId}`,
            moviePoster: null,
            movieYear: idx('year') !== -1 ? cols[idx('year')] : '',
            watchedDate: watchedOn,
            rating,
            isRewatch: false,
            liked,
            reviewText: '',
            containsSpoilers: false,
            tags: ['imported'],
          });
          count++;
        } else {
          // CSV in Name/Year format (no film ids): we can't resolve TMDB ids simply — stash pending
          const name = cols[idx('name')];
          const year = idx('year') !== -1 ? cols[idx('year')] : '';
          if (name) newPending.push({ name, year });
        }
      }

      if (hasFilmId) {
        setNotice({ kind: 'success', message: `${count} ${t('cfg_films_imported')}` });
      } else if (newPending.length > 0) {
        const merged = [...pendingImports, ...newPending];
        setPendingImports(merged);
        localStorage.setItem('lb_pending_imports', JSON.stringify(merged));
        setNotice({
          kind: 'info',
          message: `${newPending.length} ${t('cfg_pending_saved')}`,
        });
      } else {
        setNotice({ kind: 'error', message: t('cfg_no_valid_rows') });
      }
    } catch (err) {
      setNotice({ kind: 'error', message: err instanceof Error ? err.message : t('cfg_import_failed') });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setNotice(null);
    setExporting(true);
    try {
      let logsCsv = '';
      let watchlistCsv = '';

      if (supabase && isAuthenticated && authUser) {
        const [logsRes, watchlistRes] = await Promise.all([
          supabase.from('film_logs').select('*').eq('user_id', authUser.id),
          supabase.from('watchlist').select('*').eq('user_id', authUser.id),
        ]);
        if (logsRes.error) throw new Error(logsRes.error.message);
        if (watchlistRes.error) throw new Error(watchlistRes.error.message);

        const logRows = (logsRes.data ?? []) as Record<string, unknown>[];
        logsCsv = toCsv(
          ['film_id', 'name', 'year', 'watched_on', 'rating', 'liked', 'review_text', 'contains_spoilers', 'created_at'],
          logRows.map((r) => [
            r.film_id, r.film_title, r.film_year, r.watched_on, r.rating, r.liked, r.review_text, r.contains_spoilers, r.created_at,
          ])
        );
        watchlistCsv = toCsv(
          ['film_id', 'name', 'year'],
          ((watchlistRes.data ?? []) as Record<string, unknown>[]).map((r) => [r.film_id, r.film_title, r.film_year])
        );
      } else {
        // Offline fallback: local state
        logsCsv = toCsv(
          ['film_id', 'name', 'year', 'watched_on', 'rating', 'liked', 'review_text', 'contains_spoilers', 'created_at'],
          logs.map((l) => [l.movieId, l.movieTitle, l.movieYear, l.watchedDate, l.rating, l.liked, l.reviewText, l.containsSpoilers, l.createdAt])
        );
        watchlistCsv = toCsv(
          ['film_id', 'name', 'year'],
          watchlist.map((m) => [m.id, m.title, m.release_date.slice(0, 4)])
        );
      }

      const content = `# Diary\n${logsCsv}\n\n# Watchlist\n${watchlistCsv}\n`;
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'myworld-export.csv';
      a.click();
      URL.revokeObjectURL(url);
      setNotice({ kind: 'success', message: t('cfg_export_done') });
    } catch (err) {
      setNotice({ kind: 'error', message: err instanceof Error ? err.message : t('cfg_export_failed') });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {notice && <Notice kind={notice.kind} message={notice.message} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Import */}
        <section className="bg-lb-surface border border-lb-elevated rounded p-5 flex flex-col">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white mb-2">{t('cfg_import_title')}</h2>
          <p className="text-xs text-lb-muted mb-4 flex-1">
            {t('cfg_import_desc_1')} <code className="text-lb-blue">film_id,rating,liked,watched_on</code> {t('cfg_import_desc_2')}{' '}
            <code className="text-lb-blue">Name,Year</code> {t('cfg_import_desc_3')}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="btn-log-green text-lb-bg font-black text-xs px-4 py-2.5 rounded uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
            {importing ? t('cfg_importing') : t('cfg_import_title')}
          </button>
        </section>

        {/* Export */}
        <section className="bg-lb-surface border border-lb-elevated rounded p-5 flex flex-col">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white mb-2">{t('cfg_export_title')}</h2>
          <p className="text-xs text-lb-muted mb-4 flex-1">
            {t('cfg_export_desc_1')}
            {isAuthenticated ? t('cfg_export_cloud') : t('cfg_export_local')}.
          </p>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="btn-log-green text-lb-bg font-black text-xs px-4 py-2.5 rounded uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            {exporting ? t('cfg_exporting') : t('cfg_export_title')}
          </button>
        </section>
      </div>

      {pendingImports.length > 0 && (
        <section className="bg-lb-surface border border-lb-elevated rounded p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">
              {t('cfg_pending_title')} <span className="text-lb-muted font-normal">({pendingImports.length} {t('cfg_saved_locally')})</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                setPendingImports([]);
                localStorage.removeItem('lb_pending_imports');
              }}
              className="text-[10px] uppercase font-bold text-lb-muted hover:text-red-400 cursor-pointer"
            >
              {t('cfg_clear')}
            </button>
          </div>
          <p className="text-[11px] text-lb-muted mb-2">
            {t('cfg_pending_desc')}
          </p>
          <ul className="text-xs text-lb-text max-h-40 overflow-y-auto divide-y divide-lb-elevated/60">
            {pendingImports.slice(0, 50).map((p, i) => (
              <li key={i} className="py-1.5 flex justify-between gap-3">
                <span className="truncate text-white">{p.name}</span>
                <span className="text-lb-muted shrink-0">{p.year}</span>
              </li>
            ))}
            {pendingImports.length > 50 && (
              <li className="py-1.5 text-lb-muted">…and {pendingImports.length - 50} more</li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
};
