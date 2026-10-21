import { useCallback, useEffect, useRef } from 'react';

interface UseLongPressOptions {
  threshold?: number; // ms to hold before firing (default 500)
  moveTolerance?: number; // px of allowed pointer movement (default 10)
}

interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  onClickCapture: (e: React.MouseEvent<HTMLElement>) => void;
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
}

const MOVE_TOLERANCE = 10;

export function useLongPress(
  onLongPress: (e: React.PointerEvent<HTMLElement>) => void,
  options?: UseLongPressOptions
): LongPressHandlers {
  const threshold = options?.threshold ?? 500;
  const moveTolerance = options?.moveTolerance ?? MOVE_TOLERANCE;

  const timerRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const firedRef = useRef(false);
  const activeRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clean up any pending timer on unmount
  useEffect(() => clearTimer, [clearTimer]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Long press is exclusive to touch on mobile screens (< 768px)
      if (e.pointerType !== 'touch') return;
      if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
      firedRef.current = false;
      activeRef.current = true;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (!activeRef.current) return;
        firedRef.current = true;
        try {
          navigator.vibrate?.(35);
        } catch {
          /* vibrate unsupported — noop */
        }
        onLongPress(e);
      }, threshold);
    },
    [onLongPress, threshold, clearTimer]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!activeRef.current || firedRef.current) return;
      const dx = Math.abs(e.clientX - startXRef.current);
      const dy = Math.abs(e.clientY - startYRef.current);
      if (dx > moveTolerance || dy > moveTolerance) {
        clearTimer();
        activeRef.current = false;
      }
    },
    [clearTimer, moveTolerance]
  );

  const endPress = useCallback(() => {
    clearTimer();
    activeRef.current = false;
    // When the long-press fired, also swallow the subsequent context menu
  }, [clearTimer]);

  const onPointerUp = useCallback(
    (_e: React.PointerEvent<HTMLElement>) => {
      endPress();
    },
    [endPress]
  );

  const onPointerLeave = useCallback(
    (_e: React.PointerEvent<HTMLElement>) => {
      endPress();
    },
    [endPress]
  );

  const onPointerCancel = useCallback(
    (_e: React.PointerEvent<HTMLElement>) => {
      endPress();
    },
    [endPress]
  );

  // Swallow the synthetic click that follows a long-press so the normal
  // navigation/click of the underlying element does not fire.
  const onClickCapture = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (firedRef.current) {
      firedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // Prevent the native context menu from long-presses on touch devices
  const onContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
    onClickCapture,
    onContextMenu,
  };
}
