/**
 * Indicador elástico (Elastic / Rubber-band Indicator) das barras de abas.
 *
 * Reproduz o comportamento do app do Letterboxd: ao trocar de aba a barra verde
 * NÃO translada/redimensiona como um bloco rígido. Ela se ESTICA na direção da
 * nova aba (fase 1, ~85ms) e só então a cauda alcança o destino, ENCOLHENDO
 * suavemente (fase 2, ~195ms):
 *
 *   → indo para a direita: a ponta DIREITA avança até o fim da nova aba
 *     (a barra fica esticada), depois a ponta ESQUERDA corre atrás e a largura
 *     volta ao tamanho da coluna.
 *   ← indo para a esquerda: a ponta ESQUERDA pula na frente até o início da
 *     nova aba (barra esticada), depois a ponta DIREITA encolhe até o destino.
 *
 * A transição é escrita no `style` do elemento em cada fase (o CSS do
 * `.tab-indicator` NÃO define transition, senão o bloco rígido voltaria).
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

/** Timer da Fase 2 em andamento, por elemento — evita duas caudas concorrentes em cliques rápidos */
const phaseTimers = new WeakMap<HTMLElement, number>();
/** Timer de verificação pós-transição para garantir encaixe exato no destino final */
const verifyTimers = new WeakMap<HTMLElement, number>();
/** Registro temporal do último settleTabIndicator (fim de swipe) para não reiniciar estiramento redundante */
const recentSettles = new WeakMap<HTMLElement, SettledRecord>();

/** Estica até a nova aba (fase 1) — chegada rápida, sem "overshoot" */
const EASE_STRETCH = 'cubic-bezier(0, 0, 0.2, 1)';
/** Cauda alcançando o destino (fase 2) — começa suave e desacelera no fim */
const EASE_ELASTIC = 'cubic-bezier(0.4, 0, 0.2, 1)';

/** Duração da fase de estiramento antes da cauda entrar (ms) */
const STRETCH_MS = 85;
/** Delay da fase 2 — igual ao STRETCH_MS: a cauda entra quando o estiramento terminou */
const CATCH_UP_DELAY_MS = 85;
/** Duração da fase 2 (recolhimento da cauda) em ms e string CSS */
const TAIL_SHRINK_MS = 195;
const TAIL_SHRINK_S = '0.195s';
/** Limite máximo de estiramento (fração da largura da aba) para cliques rápidos/saltos longos */
const MAX_STRETCH_FACTOR = 1.85;

const INDICATOR_BASE_WIDTH = 100;

function clearIndicatorTimers(indicator: HTMLElement): void {
  const phaseId = phaseTimers.get(indicator);
  if (phaseId !== undefined) {
    clearTimeout(phaseId);
    phaseTimers.delete(indicator);
  }
  const verifyId = verifyTimers.get(indicator);
  if (verifyId !== undefined) {
    clearTimeout(verifyId);
    verifyTimers.delete(indicator);
  }
}

function writeIndicatorTransform(indicator: HTMLElement, left: number, width: number): void {
  const scale = Math.max(0.005, width / INDICATOR_BASE_WIDTH);
  if (indicator.style.width !== `${INDICATOR_BASE_WIDTH}px`) {
    indicator.style.width = `${INDICATOR_BASE_WIDTH}px`;
  }
  indicator.style.transform = `translate3d(${left}px, 0, 0) scaleX(${scale})`;
}

function flushIndicatorStyle(indicator: HTMLElement): void {
  void indicator.offsetWidth;
  if (typeof window !== 'undefined') {
    void window.getComputedStyle(indicator).transform;
  }
}

/**
 * Lê a posição e largura reais pintadas na GPU neste exato frame via DOMMatrix.
 * Quando uma animação é interrompida no meio (clique rápido em outra aba),
 * garante que a próxima animação parta de onde a barra REALMENTE está na tela,
 * nunca de uma coordenada futura ou passada que causaria teletransporte.
 */
export function readVisualIndicatorPos(indicator: HTMLElement, fallback: IndicatorPos): IndicatorPos {
  if (typeof window === 'undefined' || indicator.style.transform === '') {
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

function scheduleFinalCommit(
  indicator: HTMLElement,
  targetLeft: number,
  targetWidth: number,
  prevPos: IndicatorPos,
  delayMs: number,
): void {
  const prevVerify = verifyTimers.get(indicator);
  if (prevVerify !== undefined) {
    clearTimeout(prevVerify);
  }
  verifyTimers.set(
    indicator,
    window.setTimeout(() => {
      verifyTimers.delete(indicator);
      if (phaseTimers.has(indicator)) return;
      indicator.style.transition = 'none';
      writeIndicatorTransform(indicator, targetLeft, targetWidth);
      prevPos.left = targetLeft;
      prevPos.width = targetWidth;
    }, delayMs),
  );
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
  clearIndicatorTimers(indicator);
  recentSettles.delete(indicator);
  indicator.style.transition = 'none';
  writeIndicatorTransform(indicator, left, width);
  flushIndicatorStyle(indicator);
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
  if (phaseTimers.has(indicator) || verifyTimers.has(indicator)) return;
  const targetLeft = targetBtn.offsetLeft;
  const targetWidth = targetBtn.offsetWidth;
  if (targetWidth <= 0) return;

  const visual = readVisualIndicatorPos(indicator, prevPos);
  if (
    indicator.style.transform === '' ||
    prevPos.width <= 0 ||
    Math.abs(visual.left - targetLeft) > 0.5 ||
    Math.abs(visual.width - targetWidth) > 0.5 ||
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
  // ~79% do caminho e a cauda só ~24%, esticando a pílula entre as duas abas.
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

  clearIndicatorTimers(indicator);
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
 * de destino, aplica o estiramento elástico em 2 fases antes de recolher a cauda.
 */
export function settleTabIndicator(
  indicator: HTMLElement,
  targetLeft: number,
  targetWidth: number,
  prevPos: IndicatorPos,
): void {
  if (targetWidth <= 0) return;
  clearIndicatorTimers(indicator);

  const visualPos = readVisualIndicatorPos(indicator, prevPos);
  const oldLeft = visualPos.width > 0 ? visualPos.left : targetLeft;
  const oldWidth = visualPos.width > 0 ? visualPos.width : targetWidth;
  const oldRight = oldLeft + oldWidth;
  const targetRight = targetLeft + targetWidth;

  // Fixa a posição visual atual antes de iniciar a transição de encaixe
  indicator.style.transition = 'none';
  writeIndicatorTransform(indicator, oldLeft, oldWidth);
  flushIndicatorStyle(indicator);

  recentSettles.set(indicator, {
    left: targetLeft,
    width: targetWidth,
    timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
  });

  const oldCenter = oldLeft + oldWidth / 2;
  const targetCenter = targetLeft + targetWidth / 2;
  const movingRight = targetCenter >= oldCenter;
  const maxStretch = Math.max(targetWidth, oldWidth) * MAX_STRETCH_FACTOR;

  // Se o usuário deu um "fling" rápido e a ponta líder ainda está longe da
  // borda final da aba de destino (> 25% da largura), estica primeiro (Fase 1)
  // e recolhe a cauda em seguida (Fase 2), preservando o efeito elástico.
  if (movingRight && targetRight - oldRight > targetWidth * 0.25) {
    const rawStretchLeft = oldLeft + Math.max(0, targetLeft - oldLeft) * 0.25;
    const minStretchLeft = targetRight - maxStretch;
    const stretchLeft = Math.min(targetLeft, Math.max(rawStretchLeft, minStretchLeft));
    const stretchedWidth = Math.max(targetWidth, targetRight - stretchLeft);
    indicator.style.transition = `transform ${STRETCH_MS}ms ${EASE_STRETCH}`;
    writeIndicatorTransform(indicator, stretchLeft, stretchedWidth);
    prevPos.left = stretchLeft;
    prevPos.width = stretchedWidth;

    phaseTimers.set(
      indicator,
      window.setTimeout(() => {
        phaseTimers.delete(indicator);
        indicator.style.transition = `transform ${TAIL_SHRINK_S} ${EASE_ELASTIC}`;
        writeIndicatorTransform(indicator, targetLeft, targetWidth);
        prevPos.left = targetLeft;
        prevPos.width = targetWidth;
      }, CATCH_UP_DELAY_MS),
    );
    scheduleFinalCommit(indicator, targetLeft, targetWidth, prevPos, CATCH_UP_DELAY_MS + TAIL_SHRINK_MS + 30);
  } else if (!movingRight && oldLeft - targetLeft > targetWidth * 0.25) {
    const rawStretchRight = oldRight - Math.max(0, oldRight - targetRight) * 0.25;
    const maxStretchRight = targetLeft + maxStretch;
    const stretchRight = Math.max(targetRight, Math.min(rawStretchRight, maxStretchRight));
    const stretchedWidth = Math.max(targetWidth, stretchRight - targetLeft);
    indicator.style.transition = `transform ${STRETCH_MS}ms ${EASE_STRETCH}`;
    writeIndicatorTransform(indicator, targetLeft, stretchedWidth);
    prevPos.left = targetLeft;
    prevPos.width = stretchedWidth;

    phaseTimers.set(
      indicator,
      window.setTimeout(() => {
        phaseTimers.delete(indicator);
        indicator.style.transition = `transform ${TAIL_SHRINK_S} ${EASE_ELASTIC}`;
        writeIndicatorTransform(indicator, targetLeft, targetWidth);
        prevPos.left = targetLeft;
        prevPos.width = targetWidth;
      }, CATCH_UP_DELAY_MS),
    );
    scheduleFinalCommit(indicator, targetLeft, targetWidth, prevPos, CATCH_UP_DELAY_MS + TAIL_SHRINK_MS + 30);
  } else {
    indicator.style.transition = `transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)`;
    writeIndicatorTransform(indicator, targetLeft, targetWidth);
    prevPos.left = targetLeft;
    prevPos.width = targetWidth;
    scheduleFinalCommit(indicator, targetLeft, targetWidth, prevPos, 240);
  }
}

/**
 * Move a barra até `targetBtn` com o efeito elástico de 2 fases (usado ao tocar/clicar
 * na aba).
 *
 * @param immediate quando true, apenas posiciona (sem estirar) — usado quando
 *                  a mudança vem de medida (resize/idioma/montagem) e não de troca de aba.
 */
export function animateElasticIndicator(
  targetBtn: HTMLElement,
  indicator: HTMLElement,
  prevPos: IndicatorPos,
  immediate = false,
): void {
  const newLeft = targetBtn.offsetLeft;
  const newWidth = targetBtn.offsetWidth;

  if (newWidth <= 0) return;

  // Primeiro carregamento (largura 0), elemento recém-montado (sem estilo
  // inline ainda) ou reposicionamento sem animação: apenas posiciona, sem estirar.
  if (immediate || indicator.style.transform === '' || prevPos.width <= 0) {
    placeTabIndicator(indicator, newLeft, newWidth, prevPos);
    return;
  }

  // Se `settleTabIndicator` acabou de ser chamado há poucos ms no encerramento
  // de um swipe para exatamente este mesmo botão, não reinicia o estiramento
  // para não cortar o encaixe suave em andamento.
  const settled = recentSettles.get(indicator);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (
    settled &&
    now - settled.timestamp < 140 &&
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
    !phaseTimers.has(indicator) &&
    Math.abs(oldLeft - newLeft) < 0.5 &&
    Math.abs(oldWidth - newWidth) < 0.5
  ) {
    placeTabIndicator(indicator, newLeft, newWidth, prevPos);
    return;
  }

  // Uma nova animação cancela a cauda pendente da anterior.
  clearIndicatorTimers(indicator);

  // Fixa a posição visual atual no DOM com transition: none e força flush síncrono
  // antes de iniciar a Fase 1, evitando qualquer salto ou teletransporte.
  indicator.style.transition = 'none';
  writeIndicatorTransform(indicator, oldLeft, oldWidth);
  flushIndicatorStyle(indicator);

  // Usa o centro visual (e não apenas oldLeft) para determinar a direção real,
  // evitando inversão quando o usuário reverte a aba no meio da Fase 1.
  const oldCenter = oldLeft + oldWidth / 2;
  const newCenter = newLeft + newWidth / 2;
  const movingRight = newCenter >= oldCenter;
  const maxStretch = Math.max(newWidth, oldWidth) * MAX_STRETCH_FACTOR;

  if (movingRight) {
    // Se a ponta direita já alcançou ou passou de newRight (ex.: reversão rápida
    // no meio de um estiramento), recolhe a cauda direto sem esperar a Fase 1.
    if (newRight - oldRight <= 2) {
      indicator.style.transition = `transform ${TAIL_SHRINK_S} ${EASE_ELASTIC}`;
      writeIndicatorTransform(indicator, newLeft, newWidth);
      prevPos.left = newLeft;
      prevPos.width = newWidth;
      scheduleFinalCommit(indicator, newLeft, newWidth, prevPos, TAIL_SHRINK_MS + 30);
    } else {
      // FASE 1 (estica para a direita): a ponta direita avança até newRight e
      // a cauda já adianta 25% (limitando o comprimento máximo a MAX_STRETCH_FACTOR
      // para que cliques rápidos em sequência nunca prendam a cauda na 1ª aba).
      const rawStretchLeft = oldLeft + Math.max(0, newLeft - oldLeft) * 0.25;
      const minStretchLeft = newRight - maxStretch;
      const stretchLeft = Math.min(newLeft, Math.max(rawStretchLeft, minStretchLeft));
      const stretchedWidth = Math.max(newWidth, newRight - stretchLeft);
      indicator.style.transition = `transform ${STRETCH_MS}ms ${EASE_STRETCH}`;
      writeIndicatorTransform(indicator, stretchLeft, stretchedWidth);
      prevPos.left = stretchLeft;
      prevPos.width = stretchedWidth;

      // FASE 2 (encolhe a cauda): a ponta esquerda encaixa no tamanho final da coluna.
      phaseTimers.set(
        indicator,
        window.setTimeout(() => {
          phaseTimers.delete(indicator);
          indicator.style.transition = `transform ${TAIL_SHRINK_S} ${EASE_ELASTIC}`;
          writeIndicatorTransform(indicator, newLeft, newWidth);
          prevPos.left = newLeft;
          prevPos.width = newWidth;
        }, CATCH_UP_DELAY_MS),
      );
      scheduleFinalCommit(indicator, newLeft, newWidth, prevPos, CATCH_UP_DELAY_MS + TAIL_SHRINK_MS + 30);
    }
  } else {
    // Se a ponta esquerda já alcançou ou passou de newLeft (ex.: reversão rápida
    // de volta para a aba da esquerda durante a Fase 1), recolhe a cauda direita direto.
    if (oldLeft - newLeft <= 2) {
      indicator.style.transition = `transform ${TAIL_SHRINK_S} ${EASE_ELASTIC}`;
      writeIndicatorTransform(indicator, newLeft, newWidth);
      prevPos.left = newLeft;
      prevPos.width = newWidth;
      scheduleFinalCommit(indicator, newLeft, newWidth, prevPos, TAIL_SHRINK_MS + 30);
    } else {
      // FASE 1 (estica para a esquerda): a ponta esquerda avança até newLeft e
      // a cauda direita já adianta 25% (limitada a MAX_STRETCH_FACTOR).
      const rawStretchRight = oldRight - Math.max(0, oldRight - newRight) * 0.25;
      const maxStretchRight = newLeft + maxStretch;
      const stretchRight = Math.max(newRight, Math.min(rawStretchRight, maxStretchRight));
      const stretchedWidth = Math.max(newWidth, stretchRight - newLeft);
      indicator.style.transition = `transform ${STRETCH_MS}ms ${EASE_STRETCH}`;
      writeIndicatorTransform(indicator, newLeft, stretchedWidth);
      prevPos.left = newLeft;
      prevPos.width = stretchedWidth;

      // FASE 2 (encolhe a cauda direita): só a largura encaixa no tamanho final.
      phaseTimers.set(
        indicator,
        window.setTimeout(() => {
          phaseTimers.delete(indicator);
          indicator.style.transition = `transform ${TAIL_SHRINK_S} ${EASE_ELASTIC}`;
          writeIndicatorTransform(indicator, newLeft, newWidth);
          prevPos.left = newLeft;
          prevPos.width = newWidth;
        }, CATCH_UP_DELAY_MS),
      );
      scheduleFinalCommit(indicator, newLeft, newWidth, prevPos, CATCH_UP_DELAY_MS + TAIL_SHRINK_MS + 30);
    }
  }
}
