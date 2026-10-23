import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { supabase } from '../lib/supabase';

// Deep link de retorno do OAuth dentro do APK (esquema registrado no AndroidManifest)
const NATIVE_OAUTH_REDIRECT = 'com.myworld.app://auth/callback';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInAsTestUser: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TEST_PROFILE: Profile = {
  id: '34a15833-20a6-4c77-9d89-1bccbb4a0339',
  username: 'teste',
  display_name: 'Usuário de Teste',
  avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  bio: 'Conta de teste local no MyWorld. Explore listas, diário e avaliações!',
};

const TEST_USER = {
  id: '34a15833-20a6-4c77-9d89-1bccbb4a0339',
  email: 'teste.dev.myworld@example.com',
  user_metadata: { username: 'teste', display_name: 'Usuário de Teste' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
} as unknown as User;

const TEST_SESSION = {
  access_token: 'local-test-token',
  token_type: 'bearer',
  user: TEST_USER,
} as unknown as Session;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const signInAsTestUser = useCallback(() => {
    localStorage.setItem('mw_test_user_active', '1');
    localStorage.removeItem('mw_test_user_logged_out');
    setSession(TEST_SESSION);
    setProfile(TEST_PROFILE);
  }, []);

  const loadProfile = useCallback(async (userId: string, fallbackEmail?: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
      return;
    }

    // Perfil ainda não existe (trigger pode ter falhado): cria via upsert mínimo
    const baseUsername = (fallbackEmail ? fallbackEmail.split('@')[0] : 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20) || 'user';
    const { data: created } = await supabase
      .from('profiles')
      .upsert({ id: userId, username: baseUsername, display_name: baseUsername }, { onConflict: 'id' })
      .select('id, username, display_name, avatar_url, bio')
      .maybeSingle();
    if (created) setProfile(created as Profile);
  }, []);

  useEffect(() => {
    // 1. Verifica se a conta de teste local está ativada (ou pré-carrega por padrão na primeira visita)
    const isExplicitlyLoggedOut = localStorage.getItem('mw_test_user_logged_out') === '1';
    const isTestActive = localStorage.getItem('mw_test_user_active') === '1';

    if (isTestActive || (!isExplicitlyLoggedOut && !supabase)) {
      setSession(TEST_SESSION);
      setProfile(TEST_PROFILE);
      setLoading(false);
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    // DESENVOLVIMENTO APENAS: autologin conta de teste (.env.development.local).
    // import.meta.env.DEV é false no build de produção e no APK, então nada disso entra lá.
    const devAutoLogin = async () => {
      if (!import.meta.env.DEV || import.meta.env.VITE_DEV_AUTOLOGIN !== '1') return;
      const email = import.meta.env.VITE_DEV_EMAIL as string | undefined;
      const password = import.meta.env.VITE_DEV_PASSWORD as string | undefined;
      if (!email || !password) return;
      const { data } = await supabase!.auth.getSession();
      if (data.session) return;
      await supabase!.auth.signInWithPassword({ email, password });
    };

    devAutoLogin().then(() => supabase!.auth.getSession()).then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        // Aguarda o PERFIL (não só a sessão) antes de liberar o primeiro render,
        // senão páginas como /:username renderizam 1 frame com o fallback local
        // (username de demo) antes do perfil chegar.
        await loadProfile(data.session.user.id, data.session.user.email);
      }
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        void loadProfile(newSession.user.id, newSession.user.email);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    if (!supabase) {
      signInAsTestUser();
      return { error: null };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: username } },
    });
    return { error: error ? error.message : null };
  }, [signInAsTestUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (email.toLowerCase().includes('teste') || !supabase) {
      signInAsTestUser();
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }, [signInAsTestUser]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: 'Supabase is not configured.' };

    // ---------------------------------------------------------------
    // APK (Capacitor nativo): o OAuth roda em Custom Tab via @capacitor/browser
    // e retorna ao app pelo deep link com.myworld.app://auth/callback?code=...
    // Assim a sessão é criada DENTRO do apk, sem jogar o usuário pro site.
    // ---------------------------------------------------------------
    if (Capacitor.isNativePlatform()) {
      const client = supabase;
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true },
      });
      if (error || !data.url) return { error: error?.message ?? 'OAuth failed to start.' };

      // Listener único para o retorno do fluxo OAuth
      const authPromise = new Promise<{ error: string | null }>((resolve) => {
        const sub = App.addListener('appUrlOpen', async ({ url }) => {
          if (!url.startsWith(NATIVE_OAUTH_REDIRECT)) return;
          (await sub).remove();
          await Browser.close().catch(() => undefined);
          try {
            const parsed = new URL(url);
            const code = parsed.searchParams.get('code');
            if (code) {
              // Fluxo PKCE (code na query)
              const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
              resolve({ error: exchangeError ? exchangeError.message : null });
              return;
            }
            // Fluxo implícito (padrão do supabase-js 2.x): os tokens voltam no
            // FRAGMENTO (#access_token=...&refresh_token=...), não na query.
            const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
            const accessToken = hash.get('access_token');
            const refreshToken = hash.get('refresh_token');
            if (accessToken && refreshToken) {
              const { error: sessionError } = await client.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              resolve({ error: sessionError ? sessionError.message : null });
              return;
            }
            const errDesc = hash.get('error_description') || parsed.searchParams.get('error_description');
            resolve({ error: errDesc ?? 'Google sign-in was cancelled or failed.' });
          } catch (e) {
            resolve({ error: e instanceof Error ? e.message : 'OAuth callback failed.' });
          }
        });
      });

      await Browser.open({ url: data.url });
      return authPromise;
    }

    // Web/PWA: fluxo normal com redirecionamento para a própria origem
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          window.location.origin +
          (window.location.pathname.match(/^\/[^/]*\//)?.[0] ?? '/'),
      },
    });
    return { error: error ? error.message : null };
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem('mw_test_user_active');
    localStorage.setItem('mw_test_user_logged_out', '1');
    setSession(null);
    setProfile(null);
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAuthenticated: !!session?.user,
      signUp,
      signIn,
      signInWithGoogle,
      signInAsTestUser,
      signOut,
    }),
    [session, profile, loading, signUp, signIn, signInWithGoogle, signInAsTestUser, signOut]
  );

  // Bloqueia o primeiro render até a sessão do Supabase ser resolvida:
  // evita "flash" dos dados locais/demonstração em páginas que dependem da conta.
  if (loading) {
    return (
      <div className="min-h-screen bg-[#14181c] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#00e054] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
