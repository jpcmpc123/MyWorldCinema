/**
 * Indicador elástico (Elastic / Rubber-band Indicator) das barras de abas em 60/120fps.
 *
 * Reproduz o comportamento do app do Letterboxd: ao trocar de aba a barra verde
 * se ESTICA na direção da nova aba e em seguida a cauda alcança o destino,
 * ENCOLHENDO suavemente:
 *
 *   → indo para a direita: a ponta DIREITA avança até o fim da nova aba
 *     (a barra fica esticada), depois a ponta ESQUERDA corre atrás e a largura
 *     volta ao tamanho da coluna.
 *   ← indo para a esquerda: a ponta ESQUERDA avança até o início da nova aba
 *     (barra esticada), depois a ponta DIREITA encolhe até o destino.
 *
 * Para garantir 60/120fps reais sem engasgos na thread principal:
 * - O movimento de 2 fases roda como uma ÚNICA animação contínua no compositor
 *   da GPU via Web Animations API (`Element.animate`), sem `setTimeout` no meio
 *   da transição e sem queda de velocidade entre esticar e recolher.
 * - Durante o arrasto com o dedo (`followTabIndicator`), aplica apenas
 *   `translate3d(...) scaleX(...)` direto na camada da GPU, sem reflow síncrono.
 */

export interface IndicatorPos {
  /** translateX atual (offsetLeft da aba ativa) */
  left: number;
  /** largura atual (offsetWidth da aba ativa) */
  width: number;
}

interface SettledRecord {
  left: number;
  width: number;
  timestamp: number;
}

/** Animação WAAPI ativa no compositor da GPU por elemento */
const activeAnimations = new WeakMap<HTMLElement, Animation>();
/** Registro temporal do último settleTabIndicator (fim de swipe) para não reiniciar estiramento redundante */
const recentSettles = new WeakMap<HTMLElement, SettledRecord>();

/** Duração total do movimento elástico (85ms stretch + 195ms tail shrink = 280ms) */
const ELASTIC_TOTAL_MS = 280;
/** Fração do tempo em que o estiramento máximo é atingido (~90ms de 280ms) */
const STRETCH_OFFSET = 0.32;
/** Duração do encaixe direto quando o dedo já levou a ponta até a aba de destino */
const DIRECT_SETTLE_MS = 210;

/** Curva da fase de estiramento — saída rápida e contínua sem parar no pico */
const EASE_STRETCH_KEYFRAME = 'cubic-bezier(0.12, 0.82, 0.32, 1)';
/** Curva da fase de recolhimento da cauda — desaceleração nativa do iOS até o encaixe final */
const EASE_TAIL_KEYFRAME = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** Limite máximo de estiramento (fração da largura da aba) para cliques rápidos/saltos longos */
const MAX_STRETCH_FACTOR = 1.85;

const INDICATOR_BASE_WIDTH = 100;

function makeTransformString(left: number, width: number): string {
  const scale = Math.max(0.005, width / INDICATOR_BASE_WIDTH);
  return `translate3d(${left}px, 0, 0) scaleX(${scale})`;
}

function writeIndicatorTransform(indicator: HTMLElement, left: number, width: number): void {
  if (indicator.style.width !== `${INDICATOR_BASE_WIDTH}px`) {
    indicator.style.width = `${INDICATOR_BASE_WIDTH}px`;
  }
  indicator.style.transform = makeTransformString(left, width);
}

function cancelActiveAnimation(indicator: HTMLElement): void {
  const anim = activeAnimations.get(indicator);
  if (anim) {
    activeAnimations.delete(indicator);
    try {
      anim.cancel();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Lê a posição e largura reais pintadas na GPU neste exato frame via DOMMatrix.
 * Quando uma animação é interrompida no meio (clique rápido em outra aba),
 * garante que a próxima animação parta de onde a barra REALMENTE está na tela,
 * nunca de uma coordenada futura ou passada que causaria teletransporte.
 */
export function readVisualIndicatorPos(indicator: HTMLElement, fallback: IndicatorPos): IndicatorPos {
  if (typeof window === 'undefined') {
    return fallback;
  }
  // Se não há animação em andamento e já temos prevPos válido, evita getComputedStyle desnecessário
  if (!activeAnimations.has(indicator) && fallback.width > 0) {
    return { left: fallback.left, width: fallback.width };
  }
  if (indicator.style.transform === '') {
    return fallback;
  }
  try {
    const computed = window.getComputedStyle(indicator).transform;
    if (!computed || computed === 'none') return fallback;
    const matrix = new DOMMatrixReadOnly(computed);
    const visualLeft = matrix.m41;
    const visualWidth = matrix.a * INDICATOR_BASE_WIDTH;
    if (Number.isFinite(visualLeft) && Number.isFinite(visualWidth) && visualWidth > 0) {
      return { left: visualLeft, width: visualWidth };
    }
  } catch {
    /* fallback se DOMMatrix não estiver disponível */
  }
  return fallback;
}

/**
 * Executa uma animação contínua no compositor da GPU via Web Animations API,
 * mantendo o estilo inline final já cravado no destino para nunca piscar ao concluir.
 */
function runCompositorAnimation(
  indicator: HTMLElement,
  keyframes: Keyframe[],
  durationMs: number,
  targetLeft: number,
  targetWidth: number,
  prevPos: IndicatorPos,
): void {
  cancelActiveAnimation(indicator);
  if (indicator.style.transition !== 'none') {
    indicator.style.transition = 'none';
  }
  writeIndicatorTransform(indicator, targetLeft, targetWidth);
  prevPos.left = targetLeft;
  prevPos.width = targetWidth;

  if (typeof indicator.animate === 'function') {
    try {
      const anim = indicator.animate(keyframes, {
        duration: durationMs,
        easing: 'linear',
      });
      activeAnimations.set(indicator, anim);
      const cleanup = () => {
        if (activeAnimations.get(indicator) === anim) {
          activeAnimations.delete(indicator);
        }
      };
      anim.onfinish = cleanup;
      anim.oncancel = cleanup;
      return;
    } catch {
      /* fallback CSS abaixo se WAAPI falhar */
    }
  }
}

/**
 * Posiciona a barra SEM animação (1º carregamento, resize real, rotação de tela,
 * troca de idioma ou troca de breakpoint, quando só as MEDIDAS mudam).
 */
export function placeTabIndicator(
  indicator: HTMLElement,
  left: number,
  width: number,
  prevPos?: IndicatorPos,
): void {
  if (width <= 0) return;
  cancelActiveAnimation(indicator);
  recentSettles.delete(indicator);
  if (indicator.style.transition !== 'none') {
    indicator.style.transition = 'none';
  }
  writeIndicatorTransform(indicator, left, width);
  if (prevPos) {
    prevPos.left = left;
    prevPos.width = width;
  }
}

/**
 * Garante que a barra verde esteja alinhada ao botão ativo quando nenhuma animação
 * elástica está em andamento (auto-correção pós-render, carregamento de fontes ou resize).
 */
export function syncTabIndicatorToButton(
  targetBtn: HTMLElement | null,
  indicator: HTMLElement | null,
  prevPos: IndicatorPos,
): void {
  if (!targetBtn || !indicator) return;
  if (activeAnimations.has(indicator)) return;
  const targetLeft = targetBtn.offsetLeft;
  const targetWidth = targetBtn.offsetWidth;
  if (targetWidth <= 0) return;

  if (
    indicator.style.transform === '' ||
    prevPos.width <= 0 ||
    Math.abs(prevPos.left - targetLeft) > 0.5 ||
    Math.abs(prevPos.width - targetWidth) > 0.5
  ) {
    placeTabIndicator(indicator, targetLeft, targetWidth, prevPos);
  }
}

/**
 * Faz a barra verde ACOMPANHAR o dedo durante o arrasto horizontal entre abas,
 * com o mesmo efeito elástico do clique: a ponta da frente avança mais rápido
 * (`leadT`) e a cauda demora a largar a aba de origem (`trailT`), então no
 * meio do gesto a barra está esticada cobrindo parte das duas abas.
 *
 * Opera com zero reflow e zero alocação desnecessária para manter 60/120fps.
 *
 * @param progress fração `0..1` do arrasto rumo à aba vizinha (`|dx| / width`).
 */
export function followTabIndicator(
  indicator: HTMLElement,
  from: IndicatorPos,
  to: IndicatorPos,
  progress: number,
  prevPos: IndicatorPos,
): void {
  const t = progress < 0 ? 0 : progress > 1 ? 1 : progress;

  if (prevPos.width <= 0 && from.width > 0) {
    placeTabIndicator(indicator, from.left, from.width, prevPos);
  }

  // Curvas opostas: a frente dispara na saída (1 - (1-t)^2.25) e a cauda
  // segura na origem (t^2.05) — no meio do swipe (t=0.5) a frente já percorreu
  // ~79% do caminho e a cauda só ~24%, esticando a barra entre as duas abas.
  const leadT = 1 - Math.pow(1 - t, 2.25);
  const trailT = Math.pow(t, 2.05);

  const fromRight = from.left + from.width;
  const toRight = to.left + to.width;

  let left: number;
  let right: number;

  if (to.left >= from.left) {
    // Arrastando para a aba da DIREITA
    left = from.left + (to.left - from.left) * trailT;
    right = fromRight + (toRight - fromRight) * leadT;
  } else {
    // Arrastando para a aba da ESQUERDA
    left = from.left + (to.left - from.left) * leadT;
    right = fromRight + (toRight - fromRight) * trailT;
  }

  const width = Math.max(1, right - left);

  if (activeAnimations.has(indicator)) {
    cancelActiveAnimation(indicator);
  }
  recentSettles.delete(indicator);
  if (indicator.style.transition !== 'none') {
    indicator.style.transition = 'none';
  }
  writeIndicatorTransform(indicator, left, width);
  prevPos.left = left;
  prevPos.width = width;
}

/**
 * Ao soltar o dedo (commit ou cancelamento do swipe), encaixa suavemente a
 * barra verde até a aba de destino a partir do ponto exato onde o dedo a deixou.
 * Se foi um swipe rápido (fling) e a ponta da frente ainda não alcançou a aba
 * de destino, aplica o estiramento elástico contínuo na GPU antes de recolher a cauda.
 */
export function settleTabIndicator(
  indicator: HTMLElement,
  targetLeft: number,
  targetWidth: number,
  prevPos: IndicatorPos,
): void {
  if (targetWidth <= 0) return;

  const visualPos = readVisualIndicatorPos(indicator, prevPos);
  const oldLeft = visualPos.width > 0 ? visualPos.left : targetLeft;
  const oldWidth = visualPos.width > 0 ? visualPos.width : targetWidth;
  const oldRight = oldLeft + oldWidth;
  const targetRight = targetLeft + targetWidth;

  recentSettles.set(indicator, {
    left: targetLeft,
    width: targetWidth,
    timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
  });

  if (Math.abs(oldLeft - targetLeft) < 0.5 && Math.abs(oldWidth - targetWidth) < 0.5) {
    placeTabIndicator(indicator, targetLeft, targetWidth, prevPos);
    return;
  }

  const oldCenter = oldLeft + oldWidth / 2;
  const targetCenter = targetLeft + targetWidth / 2;
  const movingRight = targetCenter >= oldCenter;
  const maxStretch = Math.max(targetWidth, oldWidth) * MAX_STRETCH_FACTOR;

  // Se o usuário deu um "fling" rápido e a ponta líder ainda está longe da
  // borda final da aba de destino (> 25% da largura), estica e recolhe a cauda
  // em uma única animação contínua no compositor da GPU.
  if (movingRight && targetRight - oldRight > targetWidth * 0.25) {
    const rawStretchLeft = oldLeft + Math.max(0, targetLeft - oldLeft) * 0.25;
    const minStretchLeft = targetRight - maxStretch;
    const stretchLeft = Math.min(targetLeft, Math.max(rawStretchLeft, minStretchLeft));
    const stretchedWidth = Math.max(targetWidth, targetRight - stretchLeft);

    runCompositorAnimation(
      indicator,
      [
        {
          offset: 0,
          transform: makeTransformString(oldLeft, oldWidth),
          easing: EASE_STRETCH_KEYFRAME,
        },
        {
          offset: STRETCH_OFFSET,
          transform: makeTransformString(stretchLeft, stretchedWidth),
          easing: EASE_TAIL_KEYFRAME,
        },
        {
          offset: 1,
          transform: makeTransformString(targetLeft, targetWidth),
        },
      ],
      ELASTIC_TOTAL_MS,
      targetLeft,
      targetWidth,
      prevPos,
    );
  } else if (!movingRight && oldLeft - targetLeft > targetWidth * 0.25) {
    const rawStretchRight = oldRight - Math.max(0, oldRight - targetRight) * 0.25;
    const maxStretchRight = targetLeft + maxStretch;
    const stretchRight = Math.max(targetRight, Math.min(rawStretchRight, maxStretchRight));
    const stretchedWidth = Math.max(targetWidth, stretchRight - targetLeft);

    runCompositorAnimation(
      indicator,
      [
        {
          offset: 0,
          transform: makeTransformString(oldLeft, oldWidth),
          easing: EASE_STRETCH_KEYFRAME,
        },
        {
          offset: STRETCH_OFFSET,
          transform: makeTransformString(targetLeft, stretchedWidth),
          easing: EASE_TAIL_KEYFRAME,
        },
        {
          offset: 1,
          transform: makeTransformString(targetLeft, targetWidth),
        },
      ],
      ELASTIC_TOTAL_MS,
      targetLeft,
      targetWidth,
      prevPos,
    );
  } else {
    runCompositorAnimation(
      indicator,
      [
        {
          offset: 0,
          transform: makeTransformString(oldLeft, oldWidth),
          easing: EASE_TAIL_KEYFRAME,
        },
        {
          offset: 1,
          transform: makeTransformString(targetLeft, targetWidth),
        },
      ],
      DIRECT_SETTLE_MS,
      targetLeft,
      targetWidth,
      prevPos,
    );
  }
}

/**
 * Move a barra até `targetBtn` com o efeito elástico contínuo na GPU (usado ao tocar/clicar
 * na aba).
 *
 * @param immediate quando true, apenas posiciona (sem estirar) — usado quando
 *                  a mudança vem de medida (resize/idioma/montagem) e não de troca de aba.
 */
export function animateElasticIndicator(
  targetBtn: HTMLElement | IndicatorPos,
  indicator: HTMLElement,
  prevPos: IndicatorPos,
  immediate = false,
): void {
  const newLeft = 'left' in targetBtn ? targetBtn.left : targetBtn.offsetLeft;
  const newWidth = 'width' in targetBtn ? targetBtn.width : targetBtn.offsetWidth;

  if (newWidth <= 0) return;

  // Primeiro carregamento (largura 0), elemento recém-montado (sem estilo
  // inline ainda) ou reposicionamento sem animação: apenas posiciona, sem estirar.
  if (immediate || indicator.style.transform === '' || prevPos.width <= 0) {
    placeTabIndicator(indicator, newLeft, newWidth, prevPos);
    return;
  }

  // Se `settleTabIndicator` acabou de ser chamado no encerramento de um swipe
  // para exatamente este mesmo botão, preserva a animação de encaixe já em curso na GPU.
  const settled = recentSettles.get(indicator);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (
    settled &&
    now - settled.timestamp < 260 &&
    Math.abs(settled.left - newLeft) < 0.5 &&
    Math.abs(settled.width - newWidth) < 0.5
  ) {
    recentSettles.delete(indicator);
    return;
  }
  recentSettles.delete(indicator);

  // Lê a posição visual real pintada na GPU caso uma animação anterior estivesse em curso.
  const visualPos = readVisualIndicatorPos(indicator, prevPos);
  const oldLeft = visualPos.left;
  const oldWidth = visualPos.width;
  const oldRight = oldLeft + oldWidth;
  const newRight = newLeft + newWidth;

  if (
    !activeAnimations.has(indicator) &&
    Math.abs(oldLeft - newLeft) < 0.5 &&
    Math.abs(oldWidth - newWidth) < 0.5
  ) {
    placeTabIndicator(indicator, newLeft, newWidth, prevPos);
    return;
  }

  // Usa o centro visual (e não apenas oldLeft) para determinar a direção real,
  // evitando inversão quando o usuário reverte a aba no meio do movimento.
  const oldCenter = oldLeft + oldWidth / 2;
  const newCenter = newLeft + newWidth / 2;
  const movingRight = newCenter >= oldCenter;
  const maxStretch = Math.max(newWidth, oldWidth) * MAX_STRETCH_FACTOR;

  if (movingRight) {
    if (newRight - oldRight <= 2) {
      runCompositorAnimation(
        indicator,
        [
          {
            offset: 0,
            transform: makeTransformString(oldLeft, oldWidth),
            easing: EASE_TAIL_KEYFRAME,
          },
          {
            offset: 1,
            transform: makeTransformString(newLeft, newWidth),
          },
        ],
        DIRECT_SETTLE_MS,
        newLeft,
        newWidth,
        prevPos,
      );
    } else {
      const rawStretchLeft = oldLeft + Math.max(0, newLeft - oldLeft) * 0.25;
      const minStretchLeft = newRight - maxStretch;
      const stretchLeft = Math.min(newLeft, Math.max(rawStretchLeft, minStretchLeft));
      const stretchedWidth = Math.max(newWidth, newRight - stretchLeft);

      runCompositorAnimation(
        indicator,
        [
          {
            offset: 0,
            transform: makeTransformString(oldLeft, oldWidth),
            easing: EASE_STRETCH_KEYFRAME,
          },
          {
            offset: STRETCH_OFFSET,
            transform: makeTransformString(stretchLeft, stretchedWidth),
            easing: EASE_TAIL_KEYFRAME,
          },
          {
            offset: 1,
            transform: makeTransformString(newLeft, newWidth),
          },
        ],
        ELASTIC_TOTAL_MS,
        newLeft,
        newWidth,
        prevPos,
      );
    }
  } else {
    if (oldLeft - newLeft <= 2) {
      runCompositorAnimation(
        indicator,
        [
          {
            offset: 0,
            transform: makeTransformString(oldLeft, oldWidth),
            easing: EASE_TAIL_KEYFRAME,
          },
          {
            offset: 1,
            transform: makeTransformString(newLeft, newWidth),
          },
        ],
        DIRECT_SETTLE_MS,
        newLeft,
        newWidth,
        prevPos,
      );
    } else {
      const rawStretchRight = oldRight - Math.max(0, oldRight - newRight) * 0.25;
      const maxStretchRight = newLeft + maxStretch;
      const stretchRight = Math.max(newRight, Math.min(rawStretchRight, maxStretchRight));
      const stretchedWidth = Math.max(newWidth, stretchRight - newLeft);

      runCompositorAnimation(
        indicator,
        [
          {
            offset: 0,
            transform: makeTransformString(oldLeft, oldWidth),
            easing: EASE_STRETCH_KEYFRAME,
          },
          {
            offset: STRETCH_OFFSET,
            transform: makeTransformString(newLeft, stretchedWidth),
            easing: EASE_TAIL_KEYFRAME,
          },
          {
            offset: 1,
            transform: makeTransformString(newLeft, newWidth),
          },
        ],
        ELASTIC_TOTAL_MS,
        newLeft,
        newWidth,
        prevPos,
      );
    }
  }
}
