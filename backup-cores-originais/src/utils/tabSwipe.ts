/**
 * Barramento unificado do ARRASTO entre abas (swipe lateral) no mobile.
 *
 * Centraliza em um único módulo:
 * 1. O canal de progresso/finalização (`TAB_SWIPE_EVENT`): emitido pelo
 *    `TabViewPager` a cada frame do arrasto e ao soltar o dedo, permitindo que
 *    o `Header` mova e encaixe a barra verde (`.tab-indicator`) em sincronia
 *    com o trilho de conteúdo a 60fps.
 * 2. O canal de comando da faixa de abas (`CLAIM` / `MOVE` / `FINISH`):
 *    repassa gestos iniciados diretamente sobre a barra de abas do `Header`
 *    para o `TabViewPager`, mantendo uma única fonte da verdade para os
 *    índices de origem (`fromIndex`) e destino (`toIndex`).
 */

export const TAB_SWIPE_EVENT = 'mw:tab-swipe';
export const TAB_SWIPE_CLAIM_EVENT = 'mw:tab-swipe-claim';
export const TAB_SWIPE_MOVE_EVENT = 'mw:tab-swipe-move';
export const TAB_SWIPE_FINISH_EVENT = 'mw:tab-swipe-finish';

export interface TabSwipeDetail {
  /** Deslocamento horizontal do dedo/trilho em px (negativo = arrasto para a esquerda / próxima aba) */
  shift: number;
  /** Largura de um painel de conteúdo (viewport) usada como régua de progresso (0..1) */
  width: number;
  /** true quando o gesto terminou (dedo solto ou cancelado) */
  end: boolean;
  /** No evento final: true quando o arrasto confirmou troca para `toIndex` */
  committed: boolean;
  /** Índice canônico da aba de origem no momento em que o gesto começou */
  fromIndex: number;
  /** Índice canônico da aba alvo (vizinha durante o arrasto ou destino final no encerramento) */
  toIndex: number;
}

/** Dados iniciais do toque que começou sobre a faixa de abas do Header */
export interface TabSwipeClaimDetail {
  pointerId: number;
  clientX: number;
  clientY: number;
  pointerType: string;
  target: Element | null;
}

/** Movimento contínuo do ponteiro iniciado na faixa de abas */
export interface TabSwipeMoveDetail {
  pointerId: number;
  clientX: number;
  clientY: number;
  timeStamp: number;
  pointerType: string;
}

/** Finalização do gesto iniciado na faixa de abas */
export interface TabSwipeFinishDetail {
  cancelled: boolean;
}

export function emitTabSwipe(detail: TabSwipeDetail): void {
  window.dispatchEvent(new CustomEvent<TabSwipeDetail>(TAB_SWIPE_EVENT, { detail }));
}

export function emitTabSwipeClaim(detail: TabSwipeClaimDetail): void {
  window.dispatchEvent(new CustomEvent<TabSwipeClaimDetail>(TAB_SWIPE_CLAIM_EVENT, { detail }));
}

export function emitTabSwipeMove(detail: TabSwipeMoveDetail): void {
  window.dispatchEvent(new CustomEvent<TabSwipeMoveDetail>(TAB_SWIPE_MOVE_EVENT, { detail }));
}

export function emitTabSwipeFinish(detail: TabSwipeFinishDetail): void {
  window.dispatchEvent(new CustomEvent<TabSwipeFinishDetail>(TAB_SWIPE_FINISH_EVENT, { detail }));
}
