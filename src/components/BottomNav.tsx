import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layers, Search, Plus, Zap, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { isMainTabRoute, parseProfileTabRoute } from '../utils/tabRoutes';

/**
 * Bottom Navigation — visível apenas no mobile (< 768px, md:hidden).
 * Réplica do app Android do Letterboxd: 5 ícones sem rótulo, pill atrás do
 * ícone ativo e botão central de Log elevado em verde.
 */
export const BottomNav: React.FC = () => {
  const { user, openLogModal } = useApp();
  const { isAuthenticated, profile } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  // Se a foto falhar (rede/URL inválida) ou não existir, cai no ícone de usuário
  const [avatarError, setAvatarError] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const maxHeightRef = useRef<number>(
    typeof window !== 'undefined'
      ? Math.max(window.innerHeight, window.visualViewport?.height ?? 0)
      : 0,
  );

  // Detecta quando o teclado virtual do celular está aberto para impedir que a
  // barra inferior suba e fique flutuando em cima do teclado ao rolar a busca.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkKeyboard = () => {
      if (window.innerWidth >= 768) {
        setIsKeyboardOpen(false);
        return;
      }
      const vvHeight = window.visualViewport?.height ?? window.innerHeight;
      const winHeight = window.innerHeight;
      const currentHeight = Math.min(vvHeight, winHeight);
      const activeEl = document.activeElement as HTMLElement | null;
      const isInputFocused = Boolean(
        activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable),
      );

      if (!isInputFocused && currentHeight > maxHeightRef.current) {
        maxHeightRef.current = currentHeight;
      }

      const screenBaseline =
        isInputFocused && window.screen?.height ? window.screen.height * 0.8 : 0;
      const baselineHeight = Math.max(maxHeightRef.current, winHeight, screenBaseline);
      const heightDrop = baselineHeight - currentHeight;

      setIsKeyboardOpen(heightDrop > 110);
    };

    checkKeyboard();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', checkKeyboard);
    vv?.addEventListener('scroll', checkKeyboard);
    window.addEventListener('resize', checkKeyboard);
    document.addEventListener('focusin', checkKeyboard);
    document.addEventListener('focusout', checkKeyboard);

    return () => {
      vv?.removeEventListener('resize', checkKeyboard);
      vv?.removeEventListener('scroll', checkKeyboard);
      window.removeEventListener('resize', checkKeyboard);
      document.removeEventListener('focusin', checkKeyboard);
      document.removeEventListener('focusout', checkKeyboard);
    };
  }, []);

  // Bloqueia arrasto/puxão vertical ou horizontal sobre a barra inferior no celular
  // para que o navegador nunca aplique efeito de esticar (overscroll stretch) nela.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [pathname]);

  // Mesma lógica de exibição do Header
  const displayUsername = isAuthenticated && profile ? profile.username : user.username;
  const displayAvatar = (isAuthenticated && profile?.avatar_url) ? profile.avatar_url : user.avatarUrl;

  const iconCls = 'w-5 h-5';

  const profileActive =
    parseProfileTabRoute(pathname, displayUsername) !== null ||
    pathname === '/settings' ||
    pathname.startsWith('/list/');

  const isHomeActive =
    isMainTabRoute(pathname) ||
    pathname.startsWith('/films') ||
    pathname.startsWith('/series') ||
    pathname.startsWith('/tv') ||
    pathname.startsWith('/film/') ||
    pathname.startsWith('/browse/');
  const isSearchActive = pathname.startsWith('/search');
  const isActivityActive = pathname.startsWith('/activity');

  // Item ativo ganha a pílula azul-acinzentada com ícone azul-claro
  // (cores/dimensões no CSS .bottom-nav-item / .bottom-nav-item.active)
  const item = (active: boolean) => `bottom-nav-item${active ? ' active' : ''}`;

  if (pathname === '/list/new' || /^\/list\/[^/]+\/edit$/.test(pathname)) {
    return null;
  }

  return (
    <nav
      ref={navRef}
      aria-label={t('nav_main')}
      aria-hidden={isKeyboardOpen ? 'true' : undefined}
      className="bottom-nav fixed bottom-0 inset-x-0 z-50 md:hidden select-none"
      style={
        isKeyboardOpen
          ? {
              transform: 'translate3d(0, 120%, 0)',
              visibility: 'hidden',
              pointerEvents: 'none',
            }
          : undefined
      }
    >
      {/* 1. Home / Catálogo */}
      <Link to="/" aria-label={t('nav_home')} className={item(isHomeActive)}>
        <Layers className={iconCls} />
      </Link>

      {/* 2. Search / Browse */}
      <Link to="/search" aria-label={t('search_label')} className={item(isSearchActive)}>
        <Search className={iconCls} />
      </Link>

      {/* 3. Botão central de Log: círculo vazado com borda verde, alinhado na barra */}
      <button
        onClick={() => openLogModal()}
        aria-label={t('nav_log')}
        className="bottom-nav-add"
      >
        <span className="bottom-nav-add-btn">
          <Plus className="w-4 h-4 stroke-[3]" />
        </span>
      </button>

      {/* 4. Activity */}
      <Link to="/activity" aria-label={t('nav_activity')} className={item(isActivityActive)}>
        <Zap className={iconCls} />
      </Link>

      {/* 5. Profile (avatar com fallback para silhueta).
          Sem conta logada, o clique leva para /signin (tela de login), como no app Letterboxd */}
      <Link
        to={isAuthenticated ? `/${displayUsername}` : '/signin'}
        aria-label={isAuthenticated ? t('nav_profile') : t('nav_sign_in')}
        className={item(profileActive)}
      >
        {displayAvatar && !avatarError ? (
          <img
            src={displayAvatar}
            alt={displayUsername}
            onError={() => setAvatarError(true)}
            className="w-6 h-6 rounded-full object-cover border border-white/20"
          />
        ) : (
          <User className={iconCls} />
        )}
      </Link>
    </nav>
  );
};