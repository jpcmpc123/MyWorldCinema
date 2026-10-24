import type { Weights5DModel } from './types';

let cachedWeights: Weights5DModel | null = null;
let loadingPromise: Promise<Weights5DModel | null> | null = null;

/**
 * Retorna os pesos já carregados em memória de forma síncrona (ou null se ainda não carregados).
 */
export function getLoadedLayaWeights(): Weights5DModel | null {
  return cachedWeights;
}

/**
 * Define manualmente os pesos em memória (útil em ambiente Node/SSR ou testes).
 */
export function setLoadedLayaWeights(model: Weights5DModel | null): void {
  cachedWeights = model;
}

/**
 * Carrega de forma assíncrona (lazy chunk) o modelo calibrado weights_5d.json
 * apenas quando solicitado pela página Cine IA, sem impactar o bundle inicial do app.
 */
export function preloadLayaWeights(): Promise<Weights5DModel | null> {
  if (cachedWeights) return Promise.resolve(cachedWeights);
  if (loadingPromise) return loadingPromise;

  loadingPromise = import(
    '../../tmdb_recommender/model_checkpoint/checkpoint_latest/weights_5d.json'
  )
    .then((mod) => {
      const data = (mod.default ?? mod) as Weights5DModel;
      cachedWeights = data;
      return data;
    })
    .catch(() => {
      loadingPromise = null;
      return null;
    });

  return loadingPromise;
}
