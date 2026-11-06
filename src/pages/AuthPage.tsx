import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react';

const GoogleIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
    <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.72 12 .72 7.44.72 3.5 3.34 1.68 7.26l3.66 2.84C6.24 7.12 8.88 5.04 12 5.04z" />
    <path fill="#4285F4" d="M23.28 12.26c0-.8-.07-1.57-.21-2.31H12v4.38h6.34c-.27 1.45-1.1 2.68-2.34 3.51l3.6 2.79c2.11-1.95 3.68-4.83 3.68-8.37z" />
    <path fill="#FBBC05" d="M5.34 14.3c-.26-.77-.4-1.6-.4-2.45s.15-1.68.39-2.45L1.68 7.26C.98 8.69.55 10.29.55 12s.43 3.31 1.13 4.74l3.66-2.44z" />
    <path fill="#34A853" d="M12 23.28c2.96 0 5.46-.98 7.28-2.66l-3.6-2.79c-.99.67-2.26 1.07-3.68 1.07-3.12 0-5.76-2.08-6.66-4.88l-3.66 2.84c1.82 3.92 5.76 6.42 10.32 6.42z" />
  </svg>
);
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export const AuthPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, resetPassword, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const isSignUpRoute = location.pathname === '/signup';
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(
    isSignUpRoute ? 'signup' : 'signin',
  );

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already logged in? Go to homepage.
  React.useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const switchMode = (next: 'signin' | 'signup' | 'forgot') => {
    setMode(next);
    setError(null);
    setInfo(null);
    if (next === 'signup') {
      navigate('/signup', { replace: true });
    } else if (next === 'signin') {
      navigate('/signin', { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === 'signup') {
      const usernameOk = /^[a-z0-9_]{3,20}$/.test(username);
      if (!usernameOk) {
        setError(t('auth_username_invalid'));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'forgot') {
        const { error: resetErr } = await resetPassword(email.trim());
        if (resetErr) setError(resetErr);
        else setInfo(t('auth_reset_sent'));
      } else if (mode === 'signin') {
        const { error: signInErr } = await signIn(email.trim(), password);
        if (signInErr) setError(signInErr);
        else navigate('/');
      } else {
        const { error: signUpErr } = await signUp(email.trim(), password, username.trim());
        if (signUpErr) setError(signUpErr);
        else setInfo(t('auth_created'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: googleErr } = await signInWithGoogle();
      if (googleErr) setError(googleErr);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-lb-surface border border-lb-elevated rounded-lg shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Heading */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {mode === 'forgot'
              ? t('auth_reset_title')
              : mode === 'signin'
                ? t('auth_sign_in_title')
                : t('auth_create_title')}
          </h1>
          <p className="text-xs text-lb-text">
            {mode === 'forgot'
              ? t('auth_reset_desc')
              : mode === 'signin'
                ? t('auth_welcome_back')
                : t('auth_join_text')}
          </p>
        </div>

        {mode !== 'forgot' && (
          <>
            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-lb-elevated hover:bg-lb-border-light border border-lb-elevated text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <GoogleIcon />
              <span>{t('auth_google')}</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 text-[11px] uppercase font-bold text-lb-muted">
              <div className="flex-1 h-px bg-lb-elevated" />
              <span>{t('auth_or_email')}</span>
              <div className="flex-1 h-px bg-lb-elevated" />
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="block text-[11px] uppercase font-bold text-lb-muted mb-1.5">
              {t('auth_email')}
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-lb-bg border border-lb-elevated focus:border-lb-green rounded px-3 py-2 text-sm text-white placeholder-lb-muted focus:outline-none"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-username" className="block text-[11px] uppercase font-bold text-lb-muted mb-1.5">
                {t('cfg_username')}
              </label>
              <input
                id="auth-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="johndoe"
                className="w-full bg-lb-bg border border-lb-elevated focus:border-lb-green rounded px-3 py-2 text-sm text-white placeholder-lb-muted focus:outline-none"
              />
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="auth-password" className="block text-[11px] uppercase font-bold text-lb-muted">
                  {t('auth_password')}
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] text-lb-green hover:underline font-semibold cursor-pointer"
                  >
                    {t('auth_forgot_password')}
                  </button>
                )}
              </div>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-lb-bg border border-lb-elevated focus:border-lb-green rounded px-3 py-2 text-sm text-white placeholder-lb-muted focus:outline-none"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/60 rounded px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-px" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
          {info && (
            <div className="bg-lb-green/10 border border-lb-green/30 rounded px-3 py-2.5">
              <p className="text-xs text-lb-green">{info}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-log-green w-full flex items-center justify-center gap-2 text-lb-bg font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'forgot' ? (
              <span>{t('auth_reset_btn')}</span>
            ) : mode === 'signin' ? (
              <>
                <LogIn className="w-4 h-4 stroke-[2.5]" />
                <span>{t('auth_btn_signin')}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 stroke-[2.5]" />
                <span>{t('auth_btn_create')}</span>
              </>
            )}
          </button>
        </form>

        {/* Terms & Privacy notice */}
        <p className="text-center text-[11px] text-lb-muted leading-relaxed">
          {t('auth_terms_agree_1')}{' '}
          <Link to="/terms" className="text-lb-text hover:text-white underline underline-offset-2">
            {t('footer_terms')}
          </Link>{' '}
          {t('auth_terms_agree_and')}{' '}
          <Link to="/privacy" className="text-lb-text hover:text-white underline underline-offset-2">
            {t('footer_privacy')}
          </Link>
          .
        </p>

        {/* Mode toggle */}
        <p className="text-center text-xs text-lb-text">
          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="text-lb-green hover:underline font-bold cursor-pointer"
            >
              {t('auth_back_to_signin')}
            </button>
          ) : mode === 'signin' ? (
            <>
              {t('auth_new_here')}{' '}
              <button type="button" onClick={() => switchMode('signup')} className="text-lb-green hover:underline font-bold cursor-pointer">
                {t('auth_create_link')}
              </button>
            </>
          ) : (
            <>
              {t('auth_have_account')}{' '}
              <button type="button" onClick={() => switchMode('signin')} className="text-lb-green hover:underline font-bold cursor-pointer">
                {t('auth_btn_signin')}
              </button>
            </>
          )}
        </p>

        {/* Anonymous fallback */}
        <p className="text-center text-[11px] text-lb-muted">
          {t('auth_prefer_not')}{' '}
          <Link to="/" className="text-lb-text hover:text-white underline underline-offset-2">
            {t('auth_continue_browsing')}
          </Link>
        </p>
      </div>
    </div>
  );
};
