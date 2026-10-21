import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface PosterLightboxProps {
  open: boolean;
  src: string;
  srcSet?: string;
  alt: string;
  onClose: () => void;
}

const clamp = (min: number, max: number, val: number) => Math.min(max, Math.max(min, val));

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

  const gestureRef = useRef<{
    mode: 'none' | 'swipe-down' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    startDist: number;
    startScale: number;
    lastMoveY: number;
    lastMoveTime: number;
    velocityY: number;
    moved: boolean;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    startDist: 0,
    startScale: 1,
    lastMoveY: 0,
    lastMoveTime: 0,
    velocityY: 0,
    moved: false,
  });

  const lastTapRef = useRef<{ time: number; x: number; y: number }>({
    time: 0,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    if (open) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      setDragY(0);
      setIsAnimating(false);
      setClosing(false);
    }
  }, [open, src]);

  // Lock body scroll and listen for Escape
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  const getTouchDist = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const g = gestureRef.current;

    if (e.touches.length === 2) {
      setIsAnimating(false);
      g.mode = 'pinch';
      g.startDist = getTouchDist(e.touches[0], e.touches[1]);
      g.startScale = scale;
      g.moved = true;
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const now = performance.now();
      const dt = now - lastTapRef.current.time;
      const dist = Math.hypot(t.clientX - lastTapRef.current.x, t.clientY - lastTapRef.current.y);

      // Duplo toque (double-tap) alterna zoom 1x ↔ 2.5x no celular
      if (dt < 280 && dist < 36) {
        lastTapRef.current.time = 0;
        setIsAnimating(true);
        if (scale > 1.05) {
          setScale(1);
          setPan({ x: 0, y: 0 });
        } else {
          const rect = e.currentTarget.getBoundingClientRect();
          const offsetX = rect.width / 2 - (t.clientX - rect.left);
          const offsetY = rect.height / 2 - (t.clientY - rect.top);
          setScale(2.5);
          setPan({
            x: clamp(-rect.width * 0.6, rect.width * 0.6, offsetX * 1.1),
            y: clamp(-rect.height * 0.6, rect.height * 0.6, offsetY * 1.1),
          });
        }
        g.mode = 'none';
        return;
      }

      lastTapRef.current = { time: now, x: t.clientX, y: t.clientY };
      setIsAnimating(false);
      g.startX = t.clientX;
      g.startY = t.clientY;
      g.startPanX = pan.x;
      g.startPanY = pan.y;
      g.lastMoveY = t.clientY;
      g.lastMoveTime = now;
      g.velocityY = 0;
      g.moved = false;
      g.mode = scale > 1.02 ? 'pan' : 'swipe-down';
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;

    if (e.touches.length === 2 && g.mode === 'pinch') {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      if (g.startDist > 0) {
        const nextScale = clamp(1, 4, (dist / g.startDist) * g.startScale);
        setScale(nextScale);
        if (nextScale <= 1.02) {
          setPan({ x: 0, y: 0 });
        }
      }
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        g.moved = true;
      }

      if (g.mode === 'pan' && scale > 1.02) {
        e.preventDefault();
        const maxPanX = (window.innerWidth * (scale - 1)) / 2;
        const maxPanY = (window.innerWidth * 1.5 * (scale - 1)) / 2;
        setPan({
          x: clamp(-maxPanX, maxPanX, g.startPanX + dx),
          y: clamp(-maxPanY, maxPanY, g.startPanY + dy),
        });
        return;
      }

      if (g.mode === 'swipe-down') {
        const now = performance.now();
        const dt = Math.max(1, now - g.lastMoveTime);
        g.velocityY = (t.clientY - g.lastMoveY) / dt;
        g.lastMoveY = t.clientY;
        g.lastMoveTime = now;

        // Arrastar para baixo acompanha o dedo (com leve resistência se puxar para cima)
        const nextDragY = dy >= 0 ? dy : dy * 0.2;
        setDragY(nextDragY);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;

    if (e.touches.length > 0) {
      if (e.touches.length === 1 && scale > 1.02) {
        g.mode = 'pan';
        g.startX = e.touches[0].clientX;
        g.startY = e.touches[0].clientY;
        g.startPanX = pan.x;
        g.startPanY = pan.y;
      }
      return;
    }

    if (g.mode === 'pinch') {
      if (scale <= 1.05) {
        setIsAnimating(true);
        setScale(1);
        setPan({ x: 0, y: 0 });
      }
      g.mode = 'none';
      return;
    }

    if (g.mode === 'swipe-down') {
      const shouldClose = dragY > 85 || (dragY > 35 && g.velocityY > 0.65);
      setIsAnimating(true);
      if (shouldClose) {
        setClosing(true);
        setDragY(window.innerHeight);
        window.setTimeout(() => {
          onClose();
        }, 180);
      } else {
        setDragY(0);
      }
    }

    g.mode = 'none';
  };

  const backdropProgress = clamp(0, 1, Math.abs(dragY) / 320);
  const mobileBackdropOpacity = closing ? 0 : 1 - backdropProgress * 0.85;
  const mobilePosterScale = scale > 1 ? scale : 1 - backdropProgress * 0.08;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] flex items-center justify-center select-none touch-none"
      onClick={() => {
        if (scale <= 1.02) onClose();
      }}
    >
      {/* Fundo escuro: no PC usa blur suave sobre a página; no celular escurece mantendo topo/base visíveis */}
      <div
        className="absolute inset-0 bg-black/70 md:bg-[#14181c]/85 md:backdrop-blur-md transition-opacity duration-200"
        style={{ opacity: mobileBackdropOpacity }}
      />

      {/* Botão X redondo no canto superior direito — PC (md+) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="hidden md:flex fixed top-6 right-7 z-20 w-10 h-10 rounded-full bg-[#2c3440]/85 hover:bg-[#3a4550] text-[#99aabb] hover:text-white items-center justify-center shadow-lg transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Container do pôster no CELULAR (< 768px): largura total da tela, zoom + arrastar p/ baixo */}
      <div
        className="md:hidden relative z-10 w-full flex items-center justify-center overflow-visible"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <img
          src={src}
          srcSet={srcSet}
          sizes="100vw"
          alt={alt}
          draggable={false}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y + dragY}px, 0) scale(${mobilePosterScale})`,
            transition: isAnimating
              ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'none',
          }}
          className="w-full aspect-[2/3] object-cover shadow-2xl will-change-transform"
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
          className="max-h-[84vh] max-w-[88vw] aspect-[2/3] object-contain shadow-[0_25px_70px_rgba(0,0,0,0.85)]"
        />
      </div>
    </div>,
    document.body,
  );
};

export default PosterLightbox;
