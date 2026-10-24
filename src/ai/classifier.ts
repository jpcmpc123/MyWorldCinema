import type { LayaDecisions, Weights5DModel } from './types';
import {
  COMPILED_CONTEXT_RULES,
  COMPILED_DECADE_RULES,
  COMPILED_GENRE_RULES,
  COMPILED_MOOD_RULES,
  COMPILED_ORIGIN_RULES,
  COMPILED_PACING_RULES,
  REFERENCE_MOVIE_REGEX,
  REFERENCE_STOP_WORDS,
  matchFirstRule,
  resolveContentRating,
  stripAccents,
} from './rules';
import { getLoadedLayaWeights, preloadLayaWeights } from './weightsLoader';

/**
 * Tokenizador n-grama (1-gram, 2-gram, 3-gram) para o modelo linear 5D do Laya.
 */
export function tokenizeLayaQuery(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9à-ÿ]+/g);
  if (!words || words.length === 0) return [];

  const len = words.length;
  const feats: string[] = new Array(len + Math.max(0, len - 1) + Math.max(0, len - 2));
  let idx = 0;

  for (let i = 0; i < len; i++) {
    feats[idx++] = words[i];
  }
  for (let i = 0; i < len - 1; i++) {
    feats[idx++] = `${words[i]}_${words[i + 1]}`;
  }
  for (let i = 0; i < len - 2; i++) {
    feats[idx++] = `${words[i]}_${words[i + 1]}_${words[i + 2]}`;
  }
  return feats;
}

/**
 * Executa a inferência linear 5D a partir dos pesos calibrados do checkpoint.
 */
function inferWeights5D(rawQuery: string, model: Weights5DModel | null): Record<string, string> {
  const weightPreds: Record<string, string> = {};
  if (!model) return weightPreds;

  const feats = tokenizeLayaQuery(rawQuery);
  const featLen = feats.length;

  for (const d of model.dims) {
    const priorsD = model.priors[d] || {};
    const weightsD = model.weights[d] || {};
    let bestChoice = '';
    let bestScore = -Infinity;

    for (const [choice, wMap] of Object.entries(weightsD)) {
      let score = priorsD[choice] ?? 0;
      for (let i = 0; i < featLen; i++) {
        const w = wMap[feats[i]];
        if (w !== undefined) {
          score += w;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestChoice = choice;
      }
    }
    if (bestChoice) {
      weightPreds[d] = bestChoice;
    }
  }
  return weightPreds;
}

/**
 * Classifica instantaneamente (< 1ms) um pedido em linguagem natural nas 7 dimensões do Laya.
 * Combina inferência neural linear 5D + regras léxicas pré-compiladas de alta precisão.
 */
export function classifyLaya7D(
  rawQuery: string,
  explicitModel?: Weights5DModel | null,
): LayaDecisions {
  const qNorm = stripAccents(rawQuery);
  const model = explicitModel !== undefined ? explicitModel : getLoadedLayaWeights();
  const weightPreds = inferWeights5D(rawQuery, model);

  const genre = matchFirstRule(
    qNorm,
    COMPILED_GENRE_RULES,
    (weightPreds.genre as any) || 'drama',
  );

  const mood = matchFirstRule(
    qNorm,
    COMPILED_MOOD_RULES,
    (weightPreds.mood as any) || 'intense',
  );

  const decade = matchFirstRule(
    qNorm,
    COMPILED_DECADE_RULES,
    (weightPreds.decade as any) || 'modern',
  );

  const origin = matchFirstRule(
    qNorm,
    COMPILED_ORIGIN_RULES,
    (weightPreds.origin as any) || 'hollywood',
  );

  const content_rating = resolveContentRating(qNorm, genre, weightPreds.content_rating);

  const pacing = matchFirstRule(qNorm, COMPILED_PACING_RULES, 'fast');

  const viewing_context = matchFirstRule(qNorm, COMPILED_CONTEXT_RULES, 'solo');

  return {
    genre,
    mood,
    content_rating,
    decade,
    origin,
    pacing,
    viewing_context,
  };
}

/**
 * Versão assíncrona que garante que os pesos `weights_5d.json` estejam carregados
 * antes de rodar a classificação 7D.
 */
export async function classifyLaya7DAsync(rawQuery: string): Promise<LayaDecisions> {
  const model = await preloadLayaWeights();
  return classifyLaya7D(rawQuery, model);
}

/**
 * Detecta se o usuário citou um filme de referência no pedido
 * (ex: "Adorei Interestelar...", "Estilo John Wick", "Parecido com Parasita").
 */
export function extractReferenceMovieTitle(userPrompt: string): string | null {
  const match = userPrompt.match(REFERENCE_MOVIE_REGEX);
  if (!match) return null;

  const candidate = match[1]
    .trim()
    .replace(/^(o|a|os|as|um|uma|the|an)\s+/i, '')
    .trim();

  const candNorm = stripAccents(candidate);
  if (candidate.length <= 2 || REFERENCE_STOP_WORDS.has(candNorm)) {
    return null;
  }
  return candidate;
}
