import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { LogEntry } from '../types';

export interface RemoteProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
}

interface UseProfileByUsernameResult {
  /** Perfil encontrado no Supabase (null enquanto carrega ou se é o próprio usuário local) */
  profile: RemoteProfile | null;
  /** Logs reais do perfil remoto */
  logs: LogEntry[];
  /** 'idle' | 'loading' | 'ready' | 'not-found' */
  status: 'idle' | 'loading' | 'ready' | 'not-found';
  /** true quando estamos vendo o perfil de outra pessoa via Supabase */
  isRemote: boolean;
}

/**
 * Resolve um :username da URL para um perfil público do Supabase.
 * Se o username pertence ao usuário local/anônimo, retorna isRemote=false
 * e a página segue usando o estado local como antes.
 */
export function useProfileByUsername(
  username: string | undefined,
  localUsername: string
): UseProfileByUsernameResult {
  const [profile, setProfile] = useState<RemoteProfile | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'not-found'>('idle');

  const isOwnProfile = !username || username.toLowerCase() === localUsername.toLowerCase();

  useEffect(() => {
    if (isOwnProfile) {
      setProfile(null);
      setLogs([]);
      setStatus('idle');
      return;
    }
    const client = supabase;
    if (!client) {
      // Sem Supabase não há como resolver outros perfis
      setStatus('not-found');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    const load = async () => {
      const { data: profileData } = await client
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio')
        .eq('username', username)
        .maybeSingle();

      if (cancelled) return;
      if (!profileData) {
        setStatus('not-found');
        return;
      }

      setProfile(profileData as RemoteProfile);

      const { data: logsData } = await client
        .from('film_logs')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      setLogs(
        (logsData ?? []).map((row) => ({
          id: row.id,
          movieId: row.film_id,
          movieTitle: row.film_title,
          moviePoster: row.film_poster,
          movieYear: row.film_year ? String(row.film_year) : '',
          watchedDate: row.watched_on ?? '',
          rating: row.rating ?? 0,
          isRewatch: false,
          liked: row.liked,
          reviewText: row.review_text ?? '',
          containsSpoilers: row.contains_spoilers,
          tags: [],
          createdAt: row.created_at,
        }))
      );
      setStatus('ready');
    };

    void load();
    const onPullToRefresh = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ registerPromise?: (p: Promise<unknown>) => void }>;
      customEvt.detail?.registerPromise?.(load());
    };
    window.addEventListener('mw:pull-to-refresh', onPullToRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('mw:pull-to-refresh', onPullToRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, isOwnProfile]);

  return { profile, logs, status, isRemote: !isOwnProfile && status === 'ready' };
}
