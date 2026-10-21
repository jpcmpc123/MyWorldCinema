import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';

interface PosterLightboxProps {
  open: boolean;
  src: string;
  srcSet?: string;
  alt: string;
  onClose: () => void;
}

const clamp = (min: number, max: number, val: number) => Math.min(max, Math.max(min, val));

interface TouchSample {
  y: number;
  t: number;
}

export const PosterLightbox: React.FC<PosterLightboxProps> = ({
  open,
  src,
  srcSet,
  alt,
  onClose,
}) => {
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragY, setDragY] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [closing, setClosing] = useState<boolean>(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const imgContainerRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Controla se o fechamento já foi disparado (evita duplo history.back / duplo onClose)
  const closedRef = useRef<boolean>(false);
  const closeTimerRef = useRef<number | null>(null);

  const gestureRef = useRef<{
    mode: 'none' | 'swipe' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    startT: number;
    startPanX: number;
    startPanY: number;
     currentPanX: number;
    currentPanY: number;
    startDist: number;
    startScale: number;
    currentScale: number;
    currentDragY: number;
    lastMoveY: number;
    lastMoveTime: number;
    velocityY: number;
    peakVelY: number;
    history: TouchSample[];
    moved: boolean;
    pointerId: number | null;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startT: 0,
    startPanX: 0,
    startPanY: 0,
    currentPanX: 0,
    currentPanY: 0,
    startDist: 0,
    startScale: 1,
    currentScale: 1,
    currentDragY: 0,
    lastMoveY: 0,
    lastMoveTime: 0,
    velocityY: 0,
    peakVelY: 0,
    history: [],
    moved: false,
    pointerId: null,
  });

  const lastTapRef = useRef<{ time: number; x: number; y: number }>({
    time: 0,
    x: 0,
    y: 0,
  });

  // Fecha o pôster pela UI (arraste p/ cima ou p/ baixo, toque fora, botão X, tecla Esc)
  // e remove a entrada sintética do histórico para manter a pilha limpa.
  const closeFromUI = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (typeof window !== 'undefined' && window.history.state?.__posterLightbox) {
      window.history.back();
    }
    onCloseRef.current();
  };

  useEffect(() => {
    if (open && src) {
      closedRef.current = false;
      setScale(1);
      setPan({ x: 0, y: 0 });
      setDragY(0);
      setIsAnimating(false);
      setClosing(false);
      const g = gestureRef.current;
      g.mode = 'none';
      g.currentScale = 1;
      g.currentPanX = 0;
      g.currentPanY = 0;
      g.currentDragY = 0;
      g.velocityY = 0;
      g.peakVelY = 0;
      g.history = [];
      g.moved = false;
      g.pointerId = null;
    }
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, src]);

  // Integração com o botão Voltar do celular (barra de navegação Android / gesto voltar)
  // e bloqueio de scroll da página enquanto o pôster ampliado está aberto.
  useEffect(() => {
    if (!open || !src) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Empilha um estado no histórico na mesma URL (preservando usr/key/idx do React Router)
    // para que o botão Voltar do celular feche apenas o pôster grande e continue na página do filme/série.
    if (!window.history.state?.__posterLightbox) {
      const prevState =
        window.history.state && typeof window.history.state === 'object'
          ? window.history.state
          : {};
      window.history.pushState(
        { ...prevState, __posterLightbox: true },
        '',
        window.location.href,
      );
    }

    const onPopState = () => {
      if (closedRef.current) return;
      closedRef.current = true;
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      onCloseRef.current();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeFromUI();
      }
    };

    window.addEventListener('popstate', onPopState, true);
    window.addEventListener('keydown', onKeyDown);

    // Suporte adicional ao botão físico Voltar no APK Capacitor Android
    let capListener: { remove: () => Promise<void> } | null = null;
    let unmounted = false;
    CapApp.addListener('backButton', () => {
      if (!closedRef.current) {
        closeFromUI();
      }
    })
      .then((handle) => {
        if (unmounted) {
          void handle.remove();
        } else {
          capListener = handle;
        }
      })
      .catch(() => {
        /* ambiente web padrão */
      });

    return () => {
      unmounted = true;
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('popstate', onPopState, true);
      window.removeEventListener('keydown', onKeyDown);
      if (capListener) {
        void capListener.remove();
      }
    };
  }, [open, Boolean(src)]);

  // Listener nativo touchmove com { passive: false } para impedir que o navegador mobile
  // (Chrome Android / Safari iOS) intercepte o puxão vertical como pull-to-refresh ou scroll.
  useEffect(() => {
    if (!open || !src) return;
    const el = overlayRef.current;
    if (!el) return;

    const preventNativeScroll = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    el.addEventListener('touchmove', preventNativeScroll, { passive: false });
    return () => {
      el.removeEventListener('touchmove', preventNativeScroll);
    };
  }, [open, Boolean(src)]);

  if (!open || !src) return null;

  const getTouchDist = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  };

  const beginSinglePoint = (clientX: number, clientY: number) => {
    const g = gestureRef.current;
    const now = performance.now();
    setIsAnimating(false);
    g.startX = clientX;
    g.startY = clientY;
    g.startT = now;
    g.startPanX = g.currentPanX;
    g.startPanY = g.currentPanY;
    g.currentDragY = 0;
    g.lastMoveY = clientY;
    g.lastMoveTime = now;
    g.velocityY = 0;
    g.peakVelY = 0;
    g.history = [{ y: clientY, t: now }];
    g.moved = false;
    g.mode = g.currentScale > 1.02 ? 'pan' : 'swipe';
  };

  const moveSinglePoint = (clientX: number, clientY: number) => {
    const g = gestureRef.current;
    if (g.mode === 'none' || closing) return;

    const dx = clientX - g.startX;
    const dy = clientY - g.startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      g.moved = true;
    }

    if (g.mode === 'pan' && g.currentScale > 1.02) {
      const maxPanX = (window.innerWidth * (g.currentScale - 1)) / 2;
      const maxPanY = (window.innerWidth * 1.5 * (g.currentScale - 1)) / 2;
      const nextX = clamp(-maxPanX, maxPanX, g.startPanX + dx);
      const nextY = clamp(-maxPanY, maxPanY, g.startPanY + dy);
      g.currentPanX = nextX;
      g.currentPanY = nextY;
      setPan({ x: nextX, y: nextY });
      return;
    }

    if (g.mode === 'swipe') {
      const now = performance.now();
      const dt = now - g.lastMoveTime;
      if (dt >= 4) {
        const instVel = (clientY - g.lastMoveY) / dt;
        g.velocityY = g.velocityY === 0 ? instVel : g.velocityY * 0.35 + instVel * 0.65;
        if (Math.abs(instVel) > Math.abs(g.peakVelY)) {
          g.peakVelY = instVel;
        }
        g.lastMoveY = clientY;
        g.lastMoveTime = now;
        g.history.push({ y: clientY, t: now });
        if (g.history.length > 10) g.history.shift();
      }

      // Arrastar tanto para CIMA (dy < 0) quanto para BAIXO (dy > 0) acompanha o dedo 1:1
      g.currentDragY = dy;
      setDragY(dy);
    }
  };

  const finishSinglePoint = (clientX: number, clientY: number, target: EventTarget | null) => {
    const g = gestureRef.current;
    const now = performance.now();

    // Toque simples sem arrastar
    if (!g.moved) {
      g.mode = 'none';
      g.currentDragY = 0;
      setDragY(0);

      const dt = now - lastTapRef.current.time;
      const dist = Math.hypot(clientX - lastTapRef.current.x, clientY - lastTapRef.current.y);

      const tappedInsidePoster =
        imgContainerRef.current && target instanceof Node
          ? imgContainerRef.current.contains(target)
          : false;

      // Duplo toque no pôster alterna zoom 1x ↔ 2.5x
      if (tappedInsidePoster && dt < 300 && dist < 40) {
        lastTapRef.current.time = 0;
        setIsAnimating(true);
        if (g.currentScale > 1.05) {
          g.currentScale = 1;
          g.currentPanX = 0;
          g.currentPanY = 0;
          setScale(1);
          setPan({ x: 0, y: 0 });
        } else {
          const rect = imgContainerRef.current!.getBoundingClientRect();
          const offsetX = rect.width / 2 - (clientX - rect.left);
          const offsetY = rect.height / 2 - (clientY - rect.top);
          const nextX = clamp(-rect.width * 0.6, rect.width * 0.6, offsetX * 1.1);
          const nextY = clamp(-rect.height * 0.6, rect.height * 0.6, offsetY * 1.1);
          g.currentScale = 2.5;
          g.currentPanX = nextX;
          g.currentPanY = nextY;
          setScale(2.5);
          setPan({ x: nextX, y: nextY });
        }
        return;
      }

      lastTapRef.current = { time: now, x: clientX, y: clientY };

      // Toque simples fora do pôster (no fundo escuro) fecha quando sem zoom
      if (!tappedInsidePoster && g.currentScale <= 1.02) {
        closeFromUI();
      }
      return;
    }

    if (g.mode === 'swipe') {
      const curY = g.currentDragY;
      const absY = Math.abs(curY);

      // Velocidade terminal nas últimas amostras (imune à desaceleração de soltar o dedo)
      const recent = g.history.filter((pt) => now - pt.t <= 150);
      let sampleVelY = 0;
      if (recent.length >= 2) {
        const oldest = recent[0];
        const newest = recent[recent.length - 1];
        const sampleDt = Math.max(1, newest.t - oldest.t);
        sampleVelY = (newest.y - oldest.y) / sampleDt;
      }
      const totalDt = Math.max(1, now - g.startT);
      const avgVelY = curY / totalDt;

      // Confirma fechamento puxando para CIMA (curY < 0) ou para BAIXO (curY > 0)
      const isFastPullUp =
        curY < -18 &&
        (avgVelY < -0.22 || sampleVelY < -0.22 || g.velocityY < -0.22 || g.peakVelY < -0.28);
      const isFastPullDown =
        curY > 18 &&
        (avgVelY > 0.22 || sampleVelY > 0.22 || g.velocityY > 0.22 || g.peakVelY > 0.28);

      const shouldClose = absY >= 45 || isFastPullUp || isFastPullDown;

      setIsAnimating(true);
      if (shouldClose) {
        setClosing(true);
        const exitY = curY < 0 ? -window.innerHeight : window.innerHeight;
        g.currentDragY = exitY;
        setDragY(exitY);
        closeTimerRef.current = window.setTimeout(() => {
          closeTimerRef.current = null;
          closeFromUI();
        }, 180);
      } else {
        g.currentDragY = 0;
        setDragY(0);
      }
    }

    g.mode = 'none';
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (closing) return;
    const g = gestureRef.current;

    if (e.touches.length === 2) {
      setIsAnimating(false);
      g.mode = 'pinch';
      g.startDist = getTouchDist(e.touches[0], e.touches[1]);
      g.startScale = g.currentScale;
      g.currentDragY = 0;
      setDragY(0);
      g.moved = true;
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      beginSinglePoint(t.clientX, t.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (closing) return;
    const g = gestureRef.current;

    if (e.touches.length === 2 && g.mode === 'pinch') {
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      if (g.startDist > 0) {
        const nextScale = clamp(1, 4, (dist / g.startDist) * g.startScale);
        g.currentScale = nextScale;
        setScale(nextScale);
        if (nextScale <= 1.02) {
          g.currentPanX = 0;
          g.currentPanY = 0;
          setPan({ x: 0, y: 0 });
        }
      }
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      moveSinglePoint(t.clientX, t.clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (closing) return;
    const g = gestureRef.current;

    if (e.touches.length > 0) {
      if (e.touches.length === 1 && g.currentScale > 1.02) {
        g.mode = 'pan';
        g.startX = e.touches[0].clientX;
        g.startY = e.touches[0].clientY;
        g.startPanX = g.currentPanX;
        g.startPanY = g.currentPanY;
      }
      return;
    }

    if (g.mode === 'pinch') {
      if (g.currentScale <= 1.05) {
        setIsAnimating(true);
        g.currentScale = 1;
        g.currentPanX = 0;
        g.currentPanY = 0;
        setScale(1);
        setPan({ x: 0, y: 0 });
      }
      g.mode = 'none';
      return;
    }

    const t = e.changedTouches[0];
    finishSinglePoint(
      t ? t.clientX : g.startX,
      t ? t.clientY : g.lastMoveY,
      e.target,
    );
  };

  // Suporte também a arraste por PointerEvents (quando não for touch, ex. emulação/mouse)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || !e.isPrimary || closing) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gestureRef.current.pointerId = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    beginSinglePoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || closing) return;
    if (gestureRef.current.pointerId !== e.pointerId) return;
    moveSinglePoint(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || closing) return;
    if (gestureRef.current.pointerId !== e.pointerId) return;
    gestureRef.current.pointerId = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
    finishSinglePoint(e.clientX, e.clientY, e.target);
  };

  const backdropProgress = clamp(0, 1, Math.abs(dragY) / 300);
  const mobileBackdropOpacity = closing ? 0 : 1 - backdropProgress * 0.85;
  const mobilePosterScale = scale > 1 ? scale : 1 - backdropProgress * 0.08;

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      style={{ touchAction: 'none' }}
      className="fixed inset-0 z-[100] flex items-center justify-center select-none touch-none overscroll-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Fundo escuro: no PC usa blur suave sobre a página; no celular escurece mantendo topo/base visíveis */}
      <div
        className="absolute inset-0 bg-black/70 md:bg-[#14181c]/85 md:backdrop-blur-md transition-opacity duration-200 pointer-events-none"
        style={{ opacity: mobileBackdropOpacity }}
      />

      {/* Botão X redondo no canto superior direito — PC (md+) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          closeFromUI();
        }}
        aria-label="Close"
        className="hidden md:flex fixed top-6 right-7 z-20 w-10 h-10 rounded-full bg-[#2c3440]/85 hover:bg-[#3a4550] text-[#99aabb] hover:text-white items-center justify-center shadow-lg transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Container do pôster no CELULAR (< 768px): largura total da tela, zoom + arrastar p/ cima e p/ baixo */}
      <div
        ref={imgContainerRef}
        style={{ touchAction: 'none' }}
        className="md:hidden relative z-10 w-full flex items-center justify-center overflow-visible touch-none select-none"
      >
        <img
          src={src}
          srcSet={srcSet}
          sizes="100vw"
          alt={alt}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            transform: `translate3d(${pan.x}px, ${pan.y + dragY}px, 0) scale(${mobilePosterScale})`,
            transition: isAnimating
              ? 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'none',
          }}
          className="w-full aspect-[2/3] object-cover shadow-2xl will-change-transform touch-none select-none pointer-events-none"
        />
      </div>

      {/* Container do pôster no PC (md+): centralizado em alta definição */}
      <div
        className="hidden md:flex relative z-10 items-center justify-center mw-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          srcSet={srcSet}
          sizes="(min-width: 768px) 600px, 100vw"
          alt={alt}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="max-h-[84vh] max-w-[88vw] aspect-[2/3] object-contain shadow-[0_25px_70px_rgba(0,0,0,0.85)]"
        />
      </div>
    </div>,
    document.body,
  );
};

export default PosterLightbox;

