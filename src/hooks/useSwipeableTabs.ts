import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  animateElasticIndicator,
  followTabIndicator,
  settleTabIndicator,
  syncTabIndicatorToButton,
  type IndicatorPos,
} from '../utils/tabIndicator';

/** Distância (px) a partir da qual o gesto deixa de ser "toque" e vira arrasto */
const DRAG_LOCK_PX = 8;
/** Fração da largura de UM painel para confirmar a troca */
const COMMIT_RATIO = 0.13;
/** Velocidade (px/ms) que troca de aba mesmo com arrasto curto (arremesso/fling) */
const FLING_VELOCITY = 0.20;
/** Fling exige distância mínima em px para evitar toques acidentais ou pulo de abas */
const FLING_MIN_PX = 28;
/** Janela (ms) para engolir o click sintetizado pelo navegador após um swipe */
const SUPPRESS_CLICK_MS = 500;

interface InternalDragPoint {
  x: number;
  t: number;
}

interface InternalDragState {
  startIndex: number;
  startX: number;
  startY: number;
  startT: number;
  lastX: number;
  lastT: number;
  velocity: number;
  peakVel: number;
  history: InternalDragPoint[];
  dx: number;
  axis: 'h' | 'v' | null;
  width: number;
  scrollerEl: HTMLElement | null;
  fromBar: boolean;
  finished: boolean;
  pointerId: number | null;
  pointerType: string;
  captureEl: HTMLElement | null;
}

export interface UseSwipeableTabsOptions {
  /** Quantidade total de abas */
  count: number;
  /** Índice ativo atual (0 .. count - 1) */
  activeIndex: number;
  /** Callback disparado quando o swipe/puxar confirma a troca para outra aba */
  onChangeIndex: (nextIndex: number) => void;
  /** Chave que muda quando os textos/larguras das abas mudam (ex: idioma ou conjunto de abas) */
  labelsKey?: string;
  /** Se a barra de abas tem scroll horizontal e deve centralizar a aba ativa */
  centerActiveInBar?: boolean;
  /** Quando false (ex.: página ainda carregando cargo inicial), posiciona sem animar */
  ready?: boolean;
  /** Rolar a janela para o topo ao confirmar troca por swipe */
  scrollToTopOnChange?: boolean;
  /** Callback opcional disparado assim que o arrasto começa a revelar a aba vizinha */
  onPeekIndex?: (neighborIndex: number) => void;
}

export function useSwipeableTabs({
  count,
  activeIndex,
  onChangeIndex,
  labelsKey = '',
  centerActiveInBar = true,
  ready = true,
  scrollToTopOnChange = false,
  onPeekIndex,
}: UseSwipeableTabsOptions) {
  const safeIndex = Math.max(0, Math.min(Math.max(0, count - 1), activeIndex));
  const safeIndexRef = useRef<number>(safeIndex);
  safeIndexRef.current = safeIndex;

  const tabsContainerRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const prevPosRef = useRef<IndicatorPos>({ left: 0, width: 0 });
  const layoutKey = `${labelsKey}|${count}|${ready ? '1' : '0'}`;
  const prevLayoutKeyRef = useRef<string>(layoutKey);
  const lastContainerSizeRef = useRef<{ clientWidth: number; scrollWidth: number }>({
    clientWidth: 0,
    scrollWidth: 0,
  });
  const suppressViewportClickUntilRef = useRef<number>(0);
  const suppressBarClickUntilRef = useRef<number>(0);
  const dragRef = useRef<InternalDragState | null>(null);
  const lastCommitTimeRef = useRef<number>(0);

  // Estado dos painéis na esteira: ativo, intervalo em transição (leavingRange) e já visitados (visited)
  const [pager, setPager] = useState<{
    active: number;
    leavingRange: [number, number] | null;
    visited: Set<number>;
  }>(() => ({
    active: safeIndex,
    leavingRange: null,
    visited: new Set([safeIndex]),
  }));

  if (pager.active !== safeIndex) {
    const rangeMin = Math.min(
      pager.active,
      safeIndex,
      pager.leavingRange ? pager.leavingRange[0] : pager.active,
    );
    const rangeMax = Math.max(
      pager.active,
      safeIndex,
      pager.leavingRange ? pager.leavingRange[1] : pager.active,
    );
    const nextVisited = new Set(pager.visited);
    for (let i = rangeMin; i <= rangeMax; i++) {
      nextVisited.add(i);
    }
    setPager({
      active: safeIndex,
      leavingRange: ready ? [rangeMin, rangeMax] : null,
      visited: nextVisited,
    });
  }

  const [peekIndex, setPeekIndex] = useState<number | null>(null);
  const peekRef = useRef<number | null>(null);

  const updatePeek = (next: number | null) => {
    if (peekRef.current === next) return;
    peekRef.current = next;
    setPeekIndex(next);
  };

  const getTabButtons = (): HTMLElement[] => {
    const container = tabsContainerRef.current;
    if (!container) return [];
    const marked = Array.from(container.querySelectorAll<HTMLElement>('[data-swipe-tab]'));
    if (marked.length > 0) return marked;
    return Array.from(container.querySelectorAll<HTMLElement>('button'));
  };

  const centerTabButton = (btn: HTMLElement | null, smooth = true) => {
    const container = tabsContainerRef.current;
    if (!centerActiveInBar || !container || !btn) return;
    if (container.scrollWidth <= container.clientWidth) return;
    const targetScrollLeft = btn.offsetLeft - container.clientWidth / 2 + btn.clientWidth / 2;
    container.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  const syncTabButtonsHighlight = (tabBtns: HTMLElement[], highlightedIndex: number) => {
    tabBtns.forEach((btn, idx) => {
      const isHighlighted = idx === highlightedIndex;
      btn.classList.toggle('active', isHighlighted);
      if (btn.classList.contains('text-white') || btn.classList.contains('text-[#9ab]')) {
        btn.classList.toggle('text-white', isHighlighted);
        btn.classList.toggle('text-[#9ab]', !isHighlighted);
      }
    });
  };

  // Único efeito síncrono para posicionar ou animar a barra verde elástica:
  // - Em mudanças de idioma/quantidade de abas ou enquanto ready=false: posiciona sem animar.
  // - Em trocas de aba (clique ou confirmação de swipe): anima com o efeito elástico de 2 fases.
  useLayoutEffect(() => {
    const layoutChanged = prevLayoutKeyRef.current !== layoutKey;
    prevLayoutKeyRef.current = layoutKey;

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
      track.style.transform = `translateX(-${safeIndex * 100}%)`;
    }

    const buttons = getTabButtons();
    const indicator = indicatorRef.current;
    const btn = buttons[safeIndex] ?? null;
    if (!indicator || !btn) return;

    syncTabButtonsHighlight(buttons, safeIndex);

    const container = tabsContainerRef.current;
    const wasHidden = lastContainerSizeRef.current.clientWidth <= 0;
    if (container && container.clientWidth > 0) {
      lastContainerSizeRef.current = {
        clientWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
      };
    }

    const immediate = !ready || layoutChanged || wasHidden;
    centerTabButton(btn, !immediate);
    animateElasticIndicator(btn, indicator, prevPosRef.current, immediate);

    const rafId = window.requestAnimationFrame(() => {
      if (dragRef.current?.axis === 'h') return;
      const curButtons = getTabButtons();
      const curBtn = curButtons[safeIndexRef.current] ?? null;
      const curInd = indicatorRef.current;
      if (!curInd || !curBtn) return;
      syncTabButtonsHighlight(curButtons, safeIndexRef.current);
      syncTabIndicatorToButton(curBtn, curInd, prevPosRef.current);
    });

    const verifyTimerId = window.setTimeout(() => {
      if (dragRef.current?.axis === 'h') return;
      const curButtons = getTabButtons();
      const curBtn = curButtons[safeIndexRef.current] ?? null;
      const curInd = indicatorRef.current;
      if (!curInd || !curBtn) return;
      syncTabButtonsHighlight(curButtons, safeIndexRef.current);
      syncTabIndicatorToButton(curBtn, curInd, prevPosRef.current);
    }, 400);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(verifyTimerId);
    };
  }, [safeIndex, ready, layoutKey]);

  // Redimensionamento REAL da janela ou container: reposiciona sem animar
  // somente quando as dimensões do container mudarem (> 1px), sem depender de safeIndex
  // para nunca disparar no frame seguinte à troca de aba e cortar a animação.
  useEffect(() => {
    const navEl = tabsContainerRef.current;
    if (navEl) {
      lastContainerSizeRef.current = {
        clientWidth: navEl.clientWidth,
        scrollWidth: navEl.scrollWidth,
      };
    }

    const remeasureIfSizeChanged = () => {
      if (dragRef.current?.axis === 'h') return;
      const container = tabsContainerRef.current;
      const indicator = indicatorRef.current;
      if (!container || !indicator) return;
      const cw = container.clientWidth;
      const sw = container.scrollWidth;
      if (cw <= 0) {
        lastContainerSizeRef.current = { clientWidth: 0, scrollWidth: 0 };
        return;
      }
      const prev = lastContainerSizeRef.current;
      if (
        prev.clientWidth > 0 &&
        Math.abs(cw - prev.clientWidth) <= 1 &&
        Math.abs(sw - prev.scrollWidth) <= 1
      ) {
        return;
      }
      lastContainerSizeRef.current = { clientWidth: cw, scrollWidth: sw };
      const buttons = getTabButtons();
      const idx = safeIndexRef.current;
      const btn = buttons[idx] ?? null;
      if (btn) {
        syncTabButtonsHighlight(buttons, idx);
        animateElasticIndicator(btn, indicator, prevPosRef.current, true);
      }
    };

    window.addEventListener('resize', remeasureIfSizeChanged);
    window.addEventListener('orientationchange', remeasureIfSizeChanged);
    let ro: ResizeObserver | null = null;
    if (navEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(remeasureIfSizeChanged);
      ro.observe(navEl);
    }
    return () => {
      window.removeEventListener('resize', remeasureIfSizeChanged);
      window.removeEventListener('orientationchange', remeasureIfSizeChanged);
      ro?.disconnect();
    };
  }, [count, labelsKey, ready]);

  // Limpa peek quando a aba ativa muda
  useLayoutEffect(() => {
    updatePeek(null);
  }, [safeIndex]);

  // Fallback para encerrar leavingRange após a transição
  useLayoutEffect(() => {
    if (pager.leavingRange === null) return;
    const timer = window.setTimeout(() => {
      setPager((prev) => (prev.leavingRange === null ? prev : { ...prev, leavingRange: null }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pager.leavingRange, pager.active]);

  const endSlide = () => {
    setPager((prev) => (prev.leavingRange === null ? prev : { ...prev, leavingRange: null }));
  };

  const setTrackOffset = (px: number | null, overrideIndex?: number) => {
    const track = trackRef.current;
    if (!track) return;
    const index = overrideIndex ?? safeIndex;
    if (px === null) {
      if (track.style.transition === 'none') {
        void track.offsetWidth;
      }
      track.style.transition = '';
      track.style.transform = `translateX(-${index * 100}%)`;
    } else {
      track.style.transition = 'none';
      track.style.transform = `translateX(calc(-${index * 100}% + ${px}px))`;
    }
  };

  const peekNeighbor = (baseIndex: number, dir: 1 | -1) => {
    const neighbor = baseIndex + dir;
    if (neighbor < 0 || neighbor >= count) {
      updatePeek(null);
      return;
    }
    if (peekRef.current === neighbor) return;
    updatePeek(neighbor);
    setPager((prev) => {
      if (prev.visited.has(neighbor)) return prev;
      const nextVisited = new Set(prev.visited);
      nextVisited.add(neighbor);
      return { ...prev, visited: nextVisited };
    });
    onPeekIndex?.(neighbor);
  };

  const findNestedHorizontalScroller = (start: EventTarget | null): HTMLElement | null => {
    const el = start as HTMLElement | null;
    if (!el || typeof el.closest !== 'function') return null;
    if (tabsContainerRef.current && tabsContainerRef.current.contains(el)) {
      return null;
    }
    return el.closest<HTMLElement>(
      '[data-h-scroll="true"], .no-scrollbar.overflow-x-auto, .similar-carousel',
    );
  };

  const startDrag = (
    e: React.PointerEvent<HTMLElement>,
    fromBar: boolean,
  ) => {
    if (!e.isPrimary || count <= 1) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const scrollerEl = fromBar ? null : findNestedHorizontalScroller(e.target);
    if (scrollerEl) return;

    if (dragRef.current?.captureEl && dragRef.current.pointerId !== null) {
      try {
        if (dragRef.current.captureEl.hasPointerCapture?.(dragRef.current.pointerId)) {
          dragRef.current.captureEl.releasePointerCapture(dragRef.current.pointerId);
        }
      } catch {
        /* ignore */
      }
    }

    const now = performance.now();
    if (now - lastCommitTimeRef.current < 260) {
      return;
    }

    dragRef.current = {
      startIndex: safeIndex,
      startX: e.clientX,
      startY: e.clientY,
      startT: now,
      lastX: e.clientX,
      lastT: now,
      velocity: 0,
      peakVel: 0,
      history: [{ x: e.clientX, t: now }],
      dx: 0,
      axis: null,
      width: viewportRef.current?.clientWidth || tabsContainerRef.current?.clientWidth || window.innerWidth,
      scrollerEl: null,
      fromBar,
      finished: false,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      captureEl: e.currentTarget as HTMLElement,
    };
  };

  const markSuppressClick = (fromBar: boolean, now: number) => {
    if (fromBar) {
      suppressBarClickUntilRef.current = now + SUPPRESS_CLICK_MS;
    } else {
      suppressViewportClickUntilRef.current = now + SUPPRESS_CLICK_MS;
    }
  };

  const applyMoveCoords = (
    clientX: number,
    clientY: number,
    pointerType: string,
    buttons: number,
    pointerId: number | null,
  ) => {
    const d = dragRef.current;
    if (!d || d.finished) return;
    if (pointerId !== null && d.pointerId !== null && d.pointerId !== pointerId) return;
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
      if (absX >= DRAG_LOCK_PX && absX > absY * 0.85) {
        if (d.scrollerEl) {
          dragRef.current = null;
          updatePeek(null);
          return;
        }
        d.axis = 'h';
        markSuppressClick(d.fromBar, performance.now());
        try {
          if (d.pointerId !== null) d.captureEl?.setPointerCapture(d.pointerId);
        } catch {
          /* ignore */
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
    markSuppressClick(d.fromBar, now);

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
    const atEnd = d.startIndex === count - 1 && totalX < 0;
    const dx = atStart || atEnd ? totalX * 0.3 : totalX;
    d.dx = dx;
    setTrackOffset(dx, d.startIndex);

    // Barra verde acompanha o movimento do dedo em tempo real e acende a nova aba
    // ao atingir o limiar de troca (apagando a anterior)
    const indicator = indicatorRef.current;
    const tabButtons = getTabButtons();
    const fromBtn = tabButtons[d.startIndex] ?? null;
    if (indicator && fromBtn) {
      const neighborIdx = Math.min(
        count - 1,
        Math.max(0, d.startIndex + (dx < 0 ? 1 : -1)),
      );
      const toBtn = tabButtons[neighborIdx] ?? fromBtn;
      const progress =
        neighborIdx === d.startIndex || d.width <= 0
          ? 0
          : Math.min(1, Math.abs(dx) / d.width);
      const highlightIdx =
        progress >= COMMIT_RATIO && neighborIdx !== d.startIndex
          ? neighborIdx
          : d.startIndex;
      syncTabButtonsHighlight(tabButtons, highlightIdx);
      followTabIndicator(
        indicator,
        { left: fromBtn.offsetLeft, width: fromBtn.offsetWidth },
        { left: toBtn.offsetLeft, width: toBtn.offsetWidth },
        progress,
        prevPosRef.current,
      );
    }
  };

  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return;
    applyMoveCoords(e.clientX, e.clientY, e.pointerType, e.buttons, e.pointerId);
  };

  const settleIndicatorAt = (index: number) => {
    const indicator = indicatorRef.current;
    const buttons = getTabButtons();
    syncTabButtonsHighlight(buttons, index);
    const btn = buttons[index] ?? null;
    if (!indicator || !btn) return;
    settleTabIndicator(indicator, btn.offsetLeft, btn.offsetWidth, prevPosRef.current);
  };

  const finishDrag = (cancelled: boolean) => {
    const d = dragRef.current;
    if (!d || d.finished) return;
    d.finished = true;
    dragRef.current = null;

    if (d.captureEl && d.pointerId !== null) {
      try {
        if (d.captureEl.hasPointerCapture?.(d.pointerId)) {
          d.captureEl.releasePointerCapture(d.pointerId);
        }
      } catch {
        /* ignore */
      }
    }

    const now = performance.now();

    if (d.axis !== 'h' || cancelled) {
      updatePeek(null);
      if (d.axis === 'h') {
        markSuppressClick(d.fromBar, now);
        setTrackOffset(null, d.startIndex);
        settleIndicatorAt(d.startIndex);
      }
      return;
    }

    markSuppressClick(d.fromBar, now);

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

    const minCommitPx = d.fromBar ? 28 : Math.min(50, Math.max(30, d.width * COMMIT_RATIO));
    const passed = Math.abs(d.dx) >= minCommitPx;

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
    target = Math.min(count - 1, Math.max(0, target));

    settleIndicatorAt(target);

    if (target !== d.startIndex) {
      lastCommitTimeRef.current = now;
      setTrackOffset(null, target);
      onChangeIndex(target);
      if (scrollToTopOnChange) {
        window.scrollTo({ top: 0 });
      }
    } else {
      setTrackOffset(null, d.startIndex);
      updatePeek(null);
    }
  };

  const handlersRef = useRef({ applyMoveCoords, finishDrag });
  handlersRef.current = { applyMoveCoords, finishDrag };

  useEffect(() => {
    const vp = viewportRef.current;
    const bar = tabsContainerRef.current;
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
          handlersRef.current.applyMoveCoords(touch.clientX, touch.clientY, 'touch', 1, null);
        }
      } else if (d.axis === 'h') {
        if (e.cancelable) e.preventDefault();
        if (Math.abs(touch.clientX - d.lastX) > 0.5) {
          handlersRef.current.applyMoveCoords(touch.clientX, touch.clientY, 'touch', 1, null);
        }
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
    const onWindowPointerUp = () => {
      if (dragRef.current) {
        handlersRef.current.finishDrag(false);
      }
    };
    const onWindowPointerCancel = () => {
      if (dragRef.current) {
        handlersRef.current.finishDrag(true);
      }
    };
    vp?.addEventListener('touchmove', onTouchMove, { passive: false });
    vp?.addEventListener('touchend', onTouchEnd);
    vp?.addEventListener('touchcancel', onTouchCancel);
    bar?.addEventListener('touchmove', onTouchMove, { passive: false });
    bar?.addEventListener('touchend', onTouchEnd);
    bar?.addEventListener('touchcancel', onTouchCancel);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);
    window.addEventListener('blur', onWindowPointerCancel);
    return () => {
      vp?.removeEventListener('touchmove', onTouchMove);
      vp?.removeEventListener('touchend', onTouchEnd);
      vp?.removeEventListener('touchcancel', onTouchCancel);
      bar?.removeEventListener('touchmove', onTouchMove);
      bar?.removeEventListener('touchend', onTouchEnd);
      bar?.removeEventListener('touchcancel', onTouchCancel);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerCancel);
      window.removeEventListener('blur', onWindowPointerCancel);
    };
  }, [ready, count]);

  const onBarClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (performance.now() < suppressBarClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onViewportClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (performance.now() < suppressViewportClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const barHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => startDrag(e, true),
    onPointerMove: moveDrag,
    onPointerUp: () => finishDrag(false),
    onPointerCancel: () => finishDrag(true),
    onClickCapture: onBarClickCapture,
  };

  const viewportHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => startDrag(e, false),
    onPointerMove: moveDrag,
    onPointerUp: () => finishDrag(false),
    onPointerCancel: () => finishDrag(true),
    onClickCapture: onViewportClickCapture,
  };

  const trackHandlers = {
    onTransitionEnd: (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && e.propertyName === 'transform') {
        endSlide();
      }
    },
  };

  const isPanelExpanded = (index: number) => {
    const isAdjacent =
      Math.abs(index - safeIndex) <= 1 ||
      Math.abs(index - pager.active) <= 1;
    const inLeavingRange =
      pager.leavingRange !== null &&
      index >= pager.leavingRange[0] &&
      index <= pager.leavingRange[1];
    return index === safeIndex || isAdjacent || inLeavingRange || peekIndex === index;
  };

  const isPanelMounted = (index: number) =>
    index === safeIndex || pager.visited.has(index) || peekIndex === index;

  return {
    tabsContainerRef,
    indicatorRef,
    viewportRef,
    trackRef,
    barHandlers,
    viewportHandlers,
    trackHandlers,
    isPanelExpanded,
    isPanelMounted,
    activeIndex: safeIndex,
    leavingIndex: pager.leavingRange ? pager.leavingRange[0] : null,
    peekIndex,
  };
}

