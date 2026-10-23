import React, { useState } from 'react';
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
      aria-label={t('nav_main')}
      className="bottom-nav fixed bottom-0 inset-x-0 z-50 md:hidden"
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