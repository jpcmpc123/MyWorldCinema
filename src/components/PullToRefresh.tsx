import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import { isMainTabRoute, parseProfileTabRoute } from '../utils/tabRoutes';
import { tabDataCache } from '../services/tabDataCache';
import { tmdb } from '../services/tmdb';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

type PtrPhase = 'idle' | 'pulling' | 'refreshing' | 'retracting';

const DISC_SIZE = 40;
const INITIAL_OFFSET_Y = -44; // Escondido logo acima da borda inferior da barra preta
const RESTING_REFRESH_Y = 16; // Posição suspensa durante o carregamento (Screenshot 3)
const MAX_TRANSLATE_Y = 28;   // Deslocamento máximo abaixo da barra ao puxar (Screenshot 2)
const TRIGGER_PULL_PX = 68;   // Distância amortecida necessária para disparar o refresh

function isPullToRefreshEnabled(pathname: string, username: string): boolean {
  if (
    pathname.startsWith('/search') ||
    pathname.startsWith('/browse') ||
    /^\/(film|tv|actor|collection)\/\d+/.test(pathname)
  ) {
    return false;
  }
  return (
    isMainTabRoute(pathname) ||
    parseProfileTabRoute(pathname, username) !== null ||
    pathname === '/activity'
  );
}

function computeDefaultHeaderOffset(): number {
  return 110;
}

function measureActiveHeaderBottom(fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const headers = Array.from(document.querySelectorAll<HTMLElement>('header'));
  let maxBottom = -1;
  for (const h of headers) {
    const style = window.getComputedStyle(h);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      continue;
    }
    const rect = h.getBoundingClientRect();
    // Considera barras de topo coladas na parte superior da tela
    if (rect.height > 0 && rect.top >= -4 && rect.top <= 16 && rect.bottom <= 180) {
      if (rect.bottom > maxBottom) {
        maxBottom = Math.round(rect.bottom);
      }
    }
  }
  return maxBottom >= 0 ? maxBottom : fallback;
}

function hasScrolledAncestor(target: EventTarget | null): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.scrollTop > 1) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

export const PullToRefresh: React.FC = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { user } = useApp();
  const { isAuthenticated, profile } = useAuth();
  const displayUsername = isAuthenticated && profile ? profile.username : user.username;
  const isEnabledRoute = isPullToRefreshEnabled(location.pathname, displayUsername);

  const [phase, setPhase] = useState<PtrPhase>('idle');
  const [pullPx, setPullPx] = useState<number>(0);
  const [topOffset, setTopOffset] = useState<number>(() => computeDefaultHeaderOffset());

  const phaseRef = useRef<PtrPhase>('idle');
  phaseRef.current = phase;
  const pullPxRef = useRef<number>(0);
  pullPxRef.current = pullPx;

  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const trackingRef = useRef<boolean>(false);
  const gestureClaimedRef = useRef<boolean>(false);
  const gestureRejectedRef = useRef<boolean>(false);

  // Atualiza a altura da barra preta do topo ao trocar de rota (e oculta na busca/detalhes)
  useEffect(() => {
    if (!isEnabledRoute) {
      trackingRef.current = false;
      gestureClaimedRef.current = false;
      setPhase('idle');
      setPullPx(0);
      return;
    }
    if (!isMobile) return;
    setTopOffset(measureActiveHeaderBottom(computeDefaultHeaderOffset()));
  }, [isMobile, isEnabledRoute, location.pathname, location.search]);

  useEffect(() => {
    if (!isMobile || !isEnabledRoute) return;

    const triggerRefresh = async () => {
      setPhase('refreshing');
      setPullPx(TRIGGER_PULL_PX);

      const minSpinPromise = new Promise<void>((resolve) => {
        window.setTimeout(resolve, 900);
      });

      const dataRefreshPromise = (async () => {
        try {
          tabDataCache.invalidateAll();
          window.dispatchEvent(new CustomEvent('mw:pull-to-refresh'));
          await Promise.allSettled([
            tmdb.getFilmsHubSections().then((hub) => tabDataCache.setFilmsHub(hub)),
            tmdb.getSeriesHubSections().then((hub) => tabDataCache.setSeriesHub(hub)),
          ]);
        } catch {
          /* ignore network errors during pull-to-refresh */
        }
      })();

      await Promise.all([minSpinPromise, dataRefreshPromise]);

      setPhase('retracting');
      setPullPx(0);
      window.setTimeout(() => {
        if (phaseRef.current === 'retracting') {
          setPhase('idle');
        }
      }, 220);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!isPullToRefreshEnabled(window.location.pathname, displayUsername)) {
        trackingRef.current = false;
        return;
      }
      if (phaseRef.current === 'refreshing' || phaseRef.current === 'retracting') return;
      if (e.touches.length !== 1) return;

      const target = e.target as HTMLElement | null;
      if (
        target?.closest('.bottom-nav') ||
        target?.closest('[role="dialog"]') ||
        target?.closest('input, textarea, select')
      ) {
        trackingRef.current = false;
        return;
      }

      if (window.scrollY > 1 || hasScrolledAncestor(e.target)) {
        trackingRef.current = false;
        return;
      }

      setTopOffset(measureActiveHeaderBottom(computeDefaultHeaderOffset()));

      const touch = e.touches[0];
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      trackingRef.current = true;
      gestureClaimedRef.current = false;
      gestureRejectedRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current || gestureRejectedRef.current) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startXRef.current;
      const dy = touch.clientY - startYRef.current;

      if (!gestureClaimedRef.current) {
        // Se rolou a página para baixo ou puxou para cima/lados, aborta o pull-to-refresh
        if (window.scrollY > 1 || dy < -4) {
          gestureRejectedRef.current = true;
          trackingRef.current = false;
          return;
        }
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx > 8 && absDx > absDy * 0.85) {
          // Swipe horizontal de abas: não interfere
          gestureRejectedRef.current = true;
          trackingRef.current = false;
          return;
        }
        if (dy > 9 && dy > absDx * 1.35) {
          gestureClaimedRef.current = true;
          startYRef.current = touch.clientY;
          setPhase('pulling');
          setPullPx(0);
        } else {
          return;
        }
      }

      const rawPull = Math.max(0, touch.clientY - startYRef.current);
      if (rawPull > 0 && e.cancelable) {
        e.preventDefault();
      }
      // Amortecimento elástico estilo Android SwipeRefreshLayout
      const damped = Math.min(96, rawPull * 0.5);
      setPullPx(damped);
    };

    const finishGesture = () => {
      if (!trackingRef.current) return;
      trackingRef.current = false;

      if (!gestureClaimedRef.current) return;
      gestureClaimedRef.current = false;

      if (pullPxRef.current >= TRIGGER_PULL_PX) {
        void triggerRefresh();
      } else {
        setPhase('retracting');
        setPullPx(0);
        window.setTimeout(() => {
          if (phaseRef.current === 'retracting') {
            setPhase('idle');
          }
        }, 200);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', finishGesture, { passive: true });
    window.addEventListener('touchcancel', finishGesture, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', finishGesture);
      window.removeEventListener('touchcancel', finishGesture);
    };
  }, [isMobile, isEnabledRoute, displayUsername]);

  if (!isMobile || !isEnabledRoute || phase === 'idle') return null;

  // Cálculo da posição vertical:
  // - Em 'pulling': sai de -44px (escondido atrás da barra preta) até +28px abaixo da barra.
  //   Nos primeiros ~44px de curso, o círculo branco fica parcialmente cortado pela borda
  //   inferior da barra preta (exatamente como na Screenshot 1).
  // - Em 'refreshing': estabiliza em +16px abaixo da barra preta (Screenshot 3).
  // - Em 'retracting': recolhe de volta para -44px.
  const pullRatio = Math.min(1, pullPx / TRIGGER_PULL_PX);
  const extraPull = Math.max(0, pullPx - TRIGGER_PULL_PX);

  let translateY = INITIAL_OFFSET_Y;
  if (phase === 'pulling') {
    const travel = pullRatio * (RESTING_REFRESH_Y - INITIAL_OFFSET_Y) + extraPull * 0.4;
    translateY = Math.min(MAX_TRANSLATE_Y, INITIAL_OFFSET_Y + travel);
  } else if (phase === 'refreshing') {
    translateY = RESTING_REFRESH_Y;
  } else if (phase === 'retracting') {
    translateY = INITIAL_OFFSET_Y;
  }

  // Geometria do ícone CircularProgressDrawable (Screenshots 2 e 3)
  const radius = 8.75;
  const circumference = 2 * Math.PI * radius;
  // Durante o pull, o arco cresce de 18° até 275°
  const sweepDeg = phase === 'refreshing' ? 265 : Math.max(18, pullRatio * 275);
  const arcLength = (sweepDeg / 360) * circumference;
  // Rotação progressiva conforme o dedo puxa para baixo
  const pullRotationDeg = -90 + pullRatio * 215 + extraPull * 1.6;
  const arrowScale = Math.min(1, 0.55 + pullRatio * 0.45);
  const strokeOpacity = phase === 'refreshing' ? 1 : Math.min(1, 0.55 + pullRatio * 0.45);

  return (
    <div
      className="fixed inset-x-0 pointer-events-none z-[45] overflow-hidden md:hidden"
      style={{
        top: `${topOffset}px`,
        height: '110px',
      }}
      aria-hidden="true"
    >
      <div
        className="mx-auto flex items-center justify-center rounded-full bg-white"
        style={{
          width: `${DISC_SIZE}px`,
          height: `${DISC_SIZE}px`,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)',
          transform: `translate3d(0, ${translateY}px, 0) scale(${
            phase === 'retracting' ? 0.85 : 1
          })`,
          transition:
            phase === 'pulling'
              ? 'none'
              : 'transform 210ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <svg
          viewBox="0 0 40 40"
          className={`w-full h-full ${phase === 'refreshing' ? 'animate-spin' : ''}`}
          style={
            phase === 'refreshing'
              ? { animationDuration: '780ms' }
              : { transform: `rotate(${pullRotationDeg}deg)` }
          }
        >
          {/* Arco circular escuro (#14181c) */}
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="#14181c"
            strokeWidth={phase === 'refreshing' ? 2.65 : 2.5}
            strokeLinecap="butt"
            strokeDasharray={`${arcLength} ${circumference}`}
            transform="rotate(-90 20 20)"
            style={{ opacity: strokeOpacity }}
          />

          {/* Ponta de seta triangular na extremidade do arco durante o pull (Screenshot 2) */}
          {phase !== 'refreshing' && (
            <g
              transform={`rotate(${sweepDeg} 20 20)`}
              style={{ opacity: strokeOpacity }}
            >
              <g transform={`translate(20, ${20 - radius}) scale(${arrowScale})`}>
                <polygon points="3.9,0.5 -1.3,-3.3 -1.3,3.5" fill="#14181c" />
              </g>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
