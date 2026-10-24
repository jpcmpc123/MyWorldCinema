import React, { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  TAB_PANEL_PATHS,
  tabPanelIndex,
  getProfileTabPaths,
  parseProfileTabRoute,
} from '../utils/tabRoutes';
import {
  emitTabSwipe,
  TAB_SWIPE_CLAIM_EVENT,
  TAB_SWIPE_FINISH_EVENT,
  TAB_SWIPE_MOVE_EVENT,
  type TabSwipeClaimDetail,
  type TabSwipeFinishDetail,
  type TabSwipeMoveDetail,
} from '../utils/tabSwipe';
import { tabDataCache } from '../services/tabDataCache';
import { ErrorBoundary } from './ErrorBoundary';

function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  namedExport?: string
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      const comp = (namedExport && mod[namedExport]) || mod.default || mod[Object.keys(mod)[0]];
      return { default: comp };
    } catch (err) {
      console.warn('Tab dynamic import failed, retrying once...', err);
      try {
        await new Promise((resolve) => setTimeout(resolve, 600));
        const mod = await factory();
        const comp = (namedExport && mod[namedExport]) || mod.default || mod[Object.keys(mod)[0]];
        return { default: comp };
      } catch (retryErr) {
        throw retryErr;
      }
    }
  });
}

/** Distância (px) a partir da qual o gesto deixa de ser "toque" e vira arrasto */
const DRAG_LOCK_PX = 8;
/**
 * Fração da largura de UM painel que o dedo precisa percorrer para a troca de
 * aba confirmar sem fling (13% da tela ≈ 50px no mobile).
 */
const COMMIT_RATIO = 0.13;
/**
 * Velocidade (px/ms) que troca de aba mesmo com arrasto curto (arremesso/fling).
 */
const FLING_VELOCITY = 0.20;
/**
 * Fling exige distância mínima intencional em px para evitar toques acidentais ou pulo de abas.
 */
const FLING_MIN_PX = 28;
/** Janela (ms) para engolir o click sintetizado pelo navegador após um swipe */
const SUPPRESS_CLICK_MS = 500;

interface DragPoint {
  x: number;
  t: number;
}

interface DragState {
  startIndex: number;
  startX: number;
  startY: number;
  startT: number;
  lastX: number;
  lastT: number;
  velocity: number;
  peakVel: number;
  history: DragPoint[];
  dx: number;
  axis: 'h' | 'v' | null;
  width: number;
  /** Carrossel horizontal interno onde o toque começou (se houver) */
  scrollerEl: HTMLElement | null;
  /** true quando o dedo encostou na FAIXA DE ABAS (gesto repassado) */
  fromBar: boolean;
  /** Garante que finishDrag execute no máximo 1x por gesto */
  finished: boolean;
  /** pointerId do gesto (para soltar a captura no fim) */
  pointerId: number | null;
  pointerType: string;
  /** Como capturar o ponteiro quando o arrasto se revela horizontal */
  attachCapture?: (pointerId: number | null) => void;
  /** Como liberar a captura no fim do gesto */
  releaseCapture?: (pointerId: number | null) => void;
}

import { HomePage } from '../pages/HomePage';
import { SeriesHubPage } from '../pages/SeriesHubPage';
import { DiaryPage } from '../pages/DiaryPage';
import { ListsPage } from '../pages/ListsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { WatchlistPage } from '../pages/WatchlistPage';

const MAIN_PANELS: {
  key: string;
  Component: React.ComponentType;
  preload?: () => void;
}[] = [
  { key: 'films', Component: HomePage },
  { key: 'series', Component: SeriesHubPage },
  { key: 'reviews', Component: DiaryPage },
  { key: 'lists', Component: ListsPage },
];

const PROFILE_PANELS: {
  key: string;
  Component: React.ComponentType;
  preload?: () => void;
}[] = [
  { key: 'profile', Component: ProfilePage },
  { key: 'diary', Component: DiaryPage },
  { key: 'lists', Component: ListsPage },
  { key: 'watchlist', Component: WatchlistPage },
];

/** Enquanto o chunk da aba carrega (primeira visita de perfil) */
function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-lb-green" />
    </div>
  );
}

interface PagerState {
  /** Aba visível agora */
  active: number;
  /** Intervalo [min, max] de abas em transição (mantém todas expandidas durante saltos rápidos) */
  leavingRange: [number, number] | null;
  /** Painéis já visitados (continuam montados) */
  mounted: boolean[];
}

export interface TabViewPagerProps {
  mode?: 'main' | 'profile';
  profileUsername?: string;
}

export const TabViewPager: React.FC<TabViewPagerProps> = ({
  mode = 'main',
  profileUsername = 'user',
}) => {
  const location = useLocation();
  const PANELS = mode === 'profile' ? PROFILE_PANELS : MAIN_PANELS;
  const panelPaths =
    mode === 'profile' ? getProfileTabPaths(profileUsername) : TAB_PANEL_PATHS;
  const rawIndex =
    mode === 'profile'
      ? (parseProfileTabRoute(location.pathname, profileUsername)?.index ?? -1)
      : tabPanelIndex(location.pathname);

  const [pager, setPager] = useState<PagerState>(() => {
    const initialActive = Math.max(0, rawIndex);
    return {
      active: initialActive,
      leavingRange: null,
      mounted: PANELS.map((_, i) => i === initialActive),
    };
  });

  const activeIndex = rawIndex >= 0 ? rawIndex : pager.active;

  if (pager.active !== activeIndex) {
    setPager((prev) => {
      const rangeMin = Math.min(
        prev.active,
        activeIndex,
        prev.leavingRange ? prev.leavingRange[0] : prev.active,
      );
      const rangeMax = Math.max(
        prev.active,
        activeIndex,
        prev.leavingRange ? prev.leavingRange[1] : prev.active,
      );
      return {
        active: activeIndex,
        leavingRange: [rangeMin, rangeMax],
        mounted: prev.mounted.map(
          (wasMounted, i) => wasMounted || (i >= rangeMin && i <= rangeMax),
        ),
      };
    });
  }

  // Aba VIZINHA revelada pelo arrasto em andamento (null = nenhuma).
  const [peek, setPeek] = useState<number | null>(null);
  const peekRef = useRef<number | null>(null);

  const updatePeek = (next: number | null) => {
    if (peekRef.current === next) return;
    peekRef.current = next;
    setPeek(next);
  };

  /** Monta e EXPANDE a aba vizinha na direção do arrasto apenas se ainda não
      estiver expandida/montada, evitando re-render do React no meio do gesto. */
  const peekNeighbor = (baseIndex: number, dir: 1 | -1) => {
    const neighbor = baseIndex + dir;
    if (neighbor < 0 || neighbor >= PANELS.length) {
      updatePeek(null);
      return;
    }
    const alreadyAdjacent =
      Math.abs(neighbor - pager.active) <= 1 || Math.abs(neighbor - activeIndex) <= 1;
    if (alreadyAdjacent && pager.mounted[neighbor]) {
      return;
    }
    if (peekRef.current === neighbor) return;
    updatePeek(neighbor);
    setPager((prev) =>
      prev.mounted[neighbor]
        ? prev
        : { ...prev, mounted: prev.mounted.map((wasMounted, i) => wasMounted || i === neighbor) },
    );
  };

  // Troca de aba volta ao topo e garante que a esteira anime até a aba ativa
  // mesmo se um gesto anterior tiver sido interrompido por clique rápido
  const prevActiveIndexRef = useRef(activeIndex);
  useLayoutEffect(() => {
    if (prevActiveIndexRef.current !== activeIndex) {
      window.scrollTo({ top: 0 });
      prevActiveIndexRef.current = activeIndex;
    }
    updatePeek(null);
    if (dragRef.current) {
      dragRef.current.finished = true;
      dragRef.current = null;
    }
    const track = trackRef.current;
    if (track) {
      if (track.style.transition === 'none') {
        void track.offsetWidth;
      }
      track.style.transition = '';
      track.style.transform = `translate3d(-${activeIndex * 100}%, 0, 0)`;
    }
  }, [activeIndex]);

  useLayoutEffect(() => {
    if (pager.leavingRange === null) return;
    const id = window.setTimeout(() => {
      setPager((prev) => (prev.leavingRange === null ? prev : { ...prev, leavingRange: null }));
    }, 300);
    return () => window.clearTimeout(id);
  }, [pager.leavingRange, pager.active]);

  const prefetchedRef = useRef(false);
  useEffect(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    let mountTimer: number | undefined;
    const run = () => {
      PANELS.forEach((panel) => {
        if ('preload' in panel && typeof panel.preload === 'function') {
          panel.preload();
        }
      });
      void tabDataCache.preloadAll();
      // Aguarda os pôsteres da aba ativa carregarem antes de montar as abas ocultas
      // em background (evita disputa de conexões HTTP por imagens no celular)
      mountTimer = window.setTimeout(() => {
        setPager((prev) =>
          prev.mounted.every(Boolean)
            ? prev
            : { ...prev, mounted: PANELS.map(() => true) },
        );
      }, 1800);
    };
    const idle = window.requestIdleCallback;
    if (typeof idle === 'function') {
      const id = idle(run, { timeout: 1200 });
      return () => {
        window.cancelIdleCallback?.(id);
        if (mountTimer) window.clearTimeout(mountTimer);
      };
    }
    const id = window.setTimeout(run, 1200);
    return () => {
      window.clearTimeout(id);
      if (mountTimer) window.clearTimeout(mountTimer);
    };
  }, []);

  const endSlide = () =>
    setPager((prev) => (prev.leavingRange === null ? prev : { ...prev, leavingRange: null }));

  // ---- Gesto de arrasto (swipe) lateral ------------------------------------
  const navigate = useNavigate();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  /** Guarda o índice alvo comprometido mais recente (evita race condition em swipes rápidos sucessivos) */
  const targetIndexRef = useRef<number>(activeIndex);
  targetIndexRef.current = activeIndex;

  /** Timestamp do último commit para evitar que gestos em sequência pulem abas antes do slide terminar */
  const lastCommitTimeRef = useRef<number>(0);

  /** Timestamp até o qual qualquer "click" residual após um arrasto é descartado */
  const suppressClickUntilRef = useRef<number>(0);

  const setTrackOffset = (px: number | null, overrideIndex?: number) => {
    const track = trackRef.current;
    if (!track) return;
    const index = overrideIndex ?? activeIndex;
    if (px === null) {
      if (track.style.transition === 'none') {
        void track.offsetWidth;
      }
      track.style.transition = '';
      track.style.transform = `translate3d(-${index * 100}%, 0, 0)`;
    } else {
      if (track.style.transition !== 'none') {
        track.style.transition = 'none';
      }
      track.style.transform = `translate3d(calc(-${index * 100}% + ${px}px), 0, 0)`;
    }
  };

  const findHorizontalScroller = (start: EventTarget | null): HTMLElement | null => {
    const el = start as HTMLElement | null;
    if (!el || typeof el.closest !== 'function') return null;
    return el.closest<HTMLElement>(
      '[data-h-scroll="true"], .no-scrollbar.overflow-x-auto, .similar-carousel, .person-tabs-container',
    );
  };

  const beginDrag = (
    x: number,
    y: number,
    pointerType: string,
    fromBar: boolean,
    scrollerEl: HTMLElement | null = null,
  ) => {
    const now = performance.now();
    // Bloqueia início de novo gesto se o slide anterior ainda estiver em curso (260ms)
    // Isso impede que um arremesso rápido ou toque acidental de saída dê um duplo salto de aba.
    if (now - lastCommitTimeRef.current < 260) {
      return;
    }

    if (dragRef.current?.releaseCapture) {
      try {
        dragRef.current.releaseCapture(dragRef.current.pointerId);
      } catch {
        /* ignore */
      }
    }
    // Inicia da aba alvo atual (mesmo que a transição de rota do react-router ainda esteja em trânsito)
    const baseIndex = targetIndexRef.current ?? activeIndex;
    dragRef.current = {
      startIndex: baseIndex,
      startX: x,
      startY: y,
      startT: now,
      lastX: x,
      lastT: now,
      velocity: 0,
      peakVel: 0,
      history: [{ x, t: now }],
      dx: 0,
      axis: null,
      width: viewportRef.current?.clientWidth ?? window.innerWidth,
      scrollerEl,
      fromBar,
      finished: false,
      pointerId: null,
      pointerType,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const scrollerEl = findHorizontalScroller(e.target);
    if (scrollerEl) return;
    beginDrag(e.clientX, e.clientY, e.pointerType, false, null);
    const d = dragRef.current;
    if (!d) return;
    d.pointerId = e.pointerId;
    const vp = viewportRef.current;
    d.attachCapture = (pointerId) => {
      if (vp && pointerId !== null) vp.setPointerCapture(pointerId);
    };
    d.releaseCapture = (pointerId) => {
      if (vp && pointerId !== null && vp.hasPointerCapture?.(pointerId)) {
        vp.releasePointerCapture(pointerId);
      }
    };
  };

  const applyDragMove = (
    clientX: number,
    clientY: number,
    pointerType: string,
    buttons: number,
  ) => {
    const d = dragRef.current;
    if (!d || d.finished) return;
    if (pointerType === 'mouse' && buttons === 0) {
      finishDrag(false);
      return;
    }
    const totalX = clientX - d.startX;
    const totalY = clientY - d.startY;
    const absX = Math.abs(totalX);
    const absY = Math.abs(totalY);

    if (d.axis === null) {
      if (Math.max(absX, absY) < DRAG_LOCK_PX) return;
      // Permite o arco natural do polegar mobile (gesto ligeiramente diagonal)
      if (absX >= DRAG_LOCK_PX && absX > absY * 0.85) {
        if (d.scrollerEl) {
          dragRef.current = null;
          updatePeek(null);
          return;
        }
        d.axis = 'h';
        suppressClickUntilRef.current = performance.now() + SUPPRESS_CLICK_MS;
        try {
          if (d.attachCapture) d.attachCapture(d.pointerId);
        } catch {
          /* captura indisponível: segue sem ela */
        }
      } else if (absY >= 12 && absY > absX * 1.25) {
        d.axis = 'v';
        dragRef.current = null;
        updatePeek(null);
        return;
      } else {
        return;
      }
    }
    if (d.axis === 'v') {
      dragRef.current = null;
      updatePeek(null);
      return;
    }

    const dir: 1 | -1 = totalX > 0 ? -1 : 1;
    peekNeighbor(d.startIndex, dir);
    const now = performance.now();
    suppressClickUntilRef.current = now + SUPPRESS_CLICK_MS;
    const dt = now - d.lastT;
    if (dt >= 4) {
      const instVel = (clientX - d.lastX) / dt;
      d.velocity = d.velocity === 0 ? instVel : d.velocity * 0.35 + instVel * 0.65;
      if (Math.abs(instVel) > Math.abs(d.peakVel)) {
        d.peakVel = instVel;
      }
      d.lastX = clientX;
      d.lastT = now;
      d.history.push({ x: clientX, t: now });
      if (d.history.length > 10) d.history.shift();
    }

    const atStart = d.startIndex === 0 && totalX > 0;
    const atEnd = d.startIndex === PANELS.length - 1 && totalX < 0;
    const dx = atStart || atEnd ? totalX * 0.3 : totalX;
    d.dx = dx;
    setTrackOffset(dx, d.startIndex);
    const neighbor = Math.min(
      PANELS.length - 1,
      Math.max(0, d.startIndex + (dx < 0 ? 1 : -1)),
    );
    emitTabSwipe({
      shift: dx,
      width: d.width,
      end: false,
      committed: false,
      fromIndex: d.startIndex,
      toIndex: neighbor,
    });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // No mobile, o onTouchMove cuida dos eventos de toque sem duplicar coordenadas
    if (e.pointerType === 'touch') return;
    applyDragMove(e.clientX, e.clientY, e.pointerType, e.buttons);
  };

  const finishDrag = (cancelled: boolean) => {
    const d = dragRef.current;
    if (!d || d.finished) return;

    d.finished = true;
    dragRef.current = null;

    const releaseCapture = () => {
      if (d.releaseCapture) {
        try {
          d.releaseCapture(d.pointerId);
        } catch {
          /* captura já liberada */
        }
      }
    };

    const now = performance.now();

    if (d.axis !== 'h' || cancelled) {
      releaseCapture();
      updatePeek(null);
      if (d.axis === 'h') {
        suppressClickUntilRef.current = now + SUPPRESS_CLICK_MS;
        setTrackOffset(null, d.startIndex);
        emitTabSwipe({
          shift: d.dx,
          width: d.width,
          end: true,
          committed: false,
          fromIndex: d.startIndex,
          toIndex: d.startIndex,
        });
      }
      return;
    }

    suppressClickUntilRef.current = now + SUPPRESS_CLICK_MS;

    // Calcula velocidade terminal confiável e velocidade média
    const recentPoints = d.history.filter((pt) => now - pt.t <= 150);
    let sampleVel = 0;
    if (recentPoints.length >= 2) {
      const oldest = recentPoints[0];
      const newest = recentPoints[recentPoints.length - 1];
      const sampleDt = Math.max(1, newest.t - oldest.t);
      sampleVel = (newest.x - oldest.x) / sampleDt;
    }
    const totalDt = Math.max(1, now - d.startT);
    const avgVelocity = d.dx / totalDt;

    // Distância mínima para confirmação por arraste contínuo
    const minCommitPx = d.fromBar ? 28 : Math.min(50, Math.max(30, d.width * COMMIT_RATIO));
    const passed = Math.abs(d.dx) >= minCommitPx;

    // Detecção direcional de fling (arremesso rápido):
    // Se o usuário puxou rápido para a esquerda (dx negativo), verifica se qualquer
    // métrica de velocidade confirma o movimento rápido para a esquerda sem sofrer
    // com desaceleração de lift-off ou micro-rebote.
    const isFastLeft =
      d.dx < -FLING_MIN_PX &&
      (avgVelocity < -FLING_VELOCITY ||
        sampleVel < -FLING_VELOCITY ||
        d.velocity < -FLING_VELOCITY ||
        d.peakVel < -0.24);

    const isFastRight =
      d.dx > FLING_MIN_PX &&
      (avgVelocity > FLING_VELOCITY ||
        sampleVel > FLING_VELOCITY ||
        d.velocity > FLING_VELOCITY ||
        d.peakVel > 0.24);

    const flung = isFastLeft || isFastRight;

    let target = d.startIndex;
    if (passed) {
      target = d.dx < 0 ? d.startIndex + 1 : d.startIndex - 1;
    } else if (flung) {
      target = isFastLeft ? d.startIndex + 1 : d.startIndex - 1;
    }
    target = Math.min(PANELS.length - 1, Math.max(0, target));

    releaseCapture();
    emitTabSwipe({
      shift: d.dx,
      width: d.width,
      end: true,
      committed: target !== d.startIndex,
      fromIndex: d.startIndex,
      toIndex: target,
    });

    if (target !== d.startIndex) {
      lastCommitTimeRef.current = now;
      targetIndexRef.current = target;
      setTrackOffset(null, target);
      navigate(panelPaths[target], { replace: true });
    } else {
      setTrackOffset(null, d.startIndex);
      updatePeek(null);
    }
  };

  // Click que sobrou de um arrasto não deve abrir link/botão embaixo do dedo
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (performance.now() < suppressClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handlersRef = useRef({ beginDrag, applyDragMove, finishDrag });
  handlersRef.current = { beginDrag, applyDragMove, finishDrag };

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onTouchMove = (e: TouchEvent) => {
      const d = dragRef.current;
      if (!d || d.finished || e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (d.axis === null) {
        const totalX = touch.clientX - d.startX;
        const totalY = touch.clientY - d.startY;
        const absX = Math.abs(totalX);
        const absY = Math.abs(totalY);
        if (absX >= 8 && absX > absY * 0.85 && !d.scrollerEl) {
          if (e.cancelable) e.preventDefault();
        }
        if (absX >= DRAG_LOCK_PX && absX > absY * 0.85 && !d.scrollerEl) {
          handlersRef.current.applyDragMove(touch.clientX, touch.clientY, 'touch', 1);
        }
      } else if (d.axis === 'h') {
        if (e.cancelable) e.preventDefault();
        handlersRef.current.applyDragMove(touch.clientX, touch.clientY, 'touch', 1);
      }
    };
    const onTouchEnd = () => {
      if (dragRef.current) {
        handlersRef.current.finishDrag(false);
      }
    };
    const onTouchCancel = () => {
      if (dragRef.current) {
        handlersRef.current.finishDrag(true);
      }
    };
    vp.addEventListener('touchmove', onTouchMove, { passive: false });
    vp.addEventListener('touchend', onTouchEnd, { passive: true });
    vp.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      vp.removeEventListener('touchmove', onTouchMove);
      vp.removeEventListener('touchend', onTouchEnd);
      vp.removeEventListener('touchcancel', onTouchCancel);
    };
  }, []);

  useEffect(() => {
    const onClaim = (event: Event) => {
      const detail = (event as CustomEvent<TabSwipeClaimDetail>).detail;
      if (!detail) return;
      handlersRef.current.beginDrag(
        detail.clientX,
        detail.clientY,
        detail.pointerType,
        true,
        null,
      );
      const d = dragRef.current;
      if (!d) return;
      d.pointerId = detail.pointerId;
      const target = detail.target as HTMLElement | null;
      d.attachCapture = (pointerId) => {
        if (target && pointerId !== null) target.setPointerCapture(pointerId);
      };
      d.releaseCapture = (pointerId) => {
        if (target && pointerId !== null && target.hasPointerCapture?.(pointerId)) {
          target.releasePointerCapture(pointerId);
        }
      };
    };

    const onMove = (event: Event) => {
      const detail = (event as CustomEvent<TabSwipeMoveDetail>).detail;
      const d = dragRef.current;
      if (!detail || !d || d.finished || d.pointerId !== detail.pointerId) return;
      handlersRef.current.applyDragMove(
        detail.clientX,
        detail.clientY,
        detail.pointerType,
        1,
      );
    };

    const onFinish = (event: Event) => {
      const detail = (event as CustomEvent<TabSwipeFinishDetail>).detail;
      if (!dragRef.current) return;
      handlersRef.current.finishDrag(!!detail?.cancelled);
    };

    const onWindowPointerUp = () => {
      if (!dragRef.current) return;
      handlersRef.current.finishDrag(false);
    };

    const onWindowBlur = () => {
      if (!dragRef.current) return;
      handlersRef.current.finishDrag(true);
    };

    window.addEventListener(TAB_SWIPE_CLAIM_EVENT, onClaim);
    window.addEventListener(TAB_SWIPE_MOVE_EVENT, onMove);
    window.addEventListener(TAB_SWIPE_FINISH_EVENT, onFinish);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener(TAB_SWIPE_CLAIM_EVENT, onClaim);
      window.removeEventListener(TAB_SWIPE_MOVE_EVENT, onMove);
      window.removeEventListener(TAB_SWIPE_FINISH_EVENT, onFinish);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, []);

  return (
    <div
      ref={viewportRef}
      className="tab-viewport mw-page-in"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finishDrag(false)}
      onPointerCancel={() => finishDrag(true)}
      onClickCapture={onClickCapture}
    >
      <div
        ref={trackRef}
        className="tab-slider-track tab-track"
        style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === 'transform') endSlide();
        }}
      >
        {PANELS.map((panel, i) => {
          const isActive = i === activeIndex;
          // As abas vizinhas imediatas (isAdjacent) e os painéis no intervalo de transição
          // (inLeavingRange) permanecem EXPANDIDOS o tempo todo para que o deslize lateral
          // seja contínuo. A aba ativa (i === activeIndex) NUNCA é colapsada.
          const isAdjacent =
            Math.abs(i - pager.active) <= 1 || Math.abs(i - activeIndex) <= 1;
          const inLeavingRange =
            pager.leavingRange !== null &&
            i >= pager.leavingRange[0] &&
            i <= pager.leavingRange[1];
          const expanded = isActive || isAdjacent || inLeavingRange || peek === i;
          const isMounted = pager.mounted[i] || isActive;
          return (
            <div
              key={panel.key}
              data-tab={panelPaths[i]}
              className={`tab-panel${expanded ? '' : ' tab-panel-collapsed'}`}
              aria-hidden={!isActive}
              inert={!isActive}
            >
              {isMounted && (
                <ErrorBoundary>
                  <Suspense fallback={<PanelLoader />}>
                    <panel.Component />
                  </Suspense>
                </ErrorBoundary>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TabViewPager;
