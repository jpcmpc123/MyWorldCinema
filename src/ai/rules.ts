import type {
  LayaContentRating,
  LayaDecade,
  LayaGenre,
  LayaMood,
  LayaOrigin,
  LayaPacing,
  LayaViewingContext,
} from './types';

export interface CompiledRule<T extends string> {
  key: T;
  regex: RegExp;
}

/**
 * Remove acentos e converte para minúsculas em uma única passada.
 */
export function stripAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compila uma lista de termos em uma única expressão regular otimizada com
 * fronteira de palavra exata (impede que "animação" ou "ficção" deem match em "ação").
 * Executado apenas 1 vez no boot do módulo (O(1) em tempo de consulta).
 */
export function compileTermListRegex(terms: readonly string[]): RegExp {
  const alternatives = terms
    .map((t) => stripAccents(t).trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);

  return new RegExp(`(?:^|[^a-z0-9])(?:${alternatives.join('|')})(?:$|[^a-z0-9])`);
}

function compileRules<T extends string>(
  rawRules: ReadonlyArray< readonly [T, readonly string[]] >,
): CompiledRule<T>[] {
  return rawRules.map(([key, terms]) => ({
    key,
    regex: compileTermListRegex(terms),
  }));
}

export function matchFirstRule<T extends string>(
  qNorm: string,
  rules: readonly CompiledRule<T>[],
  fallback: T,
): T {
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].regex.test(qNorm)) {
      return rules[i].key;
    }
  }
  return fallback;
}

const RAW_GENRE_RULES: ReadonlyArray<readonly [LayaGenre, readonly string[]]> = [
  [
    'animation',
    [
      'animacao',
      'animacoes',
      'animation',
      'animated',
      'desenho',
      'desenhos',
      'pixar',
      'disney',
      'dreamworks',
      'anime',
      'animes',
      'toy story',
      'divertida mente',
      'inside out',
      'shrek',
      'chihiro',
      'spirited away',
      'your name',
      'rei leao',
      'procurando nemo',
      'ghibli',
    ],
  ],
  [
    'scifi',
    [
      'ficcao cientifica',
      'ficcao',
      'scifi',
      'sci-fi',
      'science fiction',
      'espaco',
      'space',
      'espacial',
      'futuro',
      'futurista',
      'alien',
      'alienigena',
      'robo',
      'robos',
      'matrix',
      'interestelar',
      'interstellar',
      'duna',
      'dune',
      'blade runner',
      'star wars',
      'viagem no tempo',
      'time travel',
      'buraco de minhoca',
      'planeta',
      'galaxia',
      'cyberpunk',
      'distopia',
      'distopico',
    ],
  ],
  [
    'horror',
    [
      'terror',
      'horror',
      'susto',
      'sustos',
      'assombrado',
      'assombrada',
      'demonio',
      'exorcismo',
      'exorcista',
      'macabro',
      'slasher',
      'invocacao do mal',
      'conjuring',
      'hereditario',
      'hereditary',
      'sobrenatural',
      'zumbi',
      'zumbis',
      'medo',
      'scary',
      'fantasma',
      'fantasmas',
      'assustador',
      'panico',
      'scream',
      'sexta-feira 13',
      'it a coisa',
    ],
  ],
  [
    'romance',
    [
      'romance',
      'amor',
      'love',
      'apaixonado',
      'apaixonada',
      'apaixonados',
      'casal',
      'romantica',
      'romantico',
      'romantic',
      'paixao',
      'diario de uma paixao',
      'notebook',
      'como eu era antes',
      'orgulho e preconceito',
      'culpa e das estrelas',
      'titanic',
      'namorados',
    ],
  ],
  [
    'comedy',
    [
      'comedia',
      'comedy',
      'rir',
      'laugh',
      'engracado',
      'engracada',
      'funny',
      'humor',
      'besteirol',
      'piada',
      'piadas',
      'as branquelas',
      'superbad',
      'se beber nao case',
      'hangover',
      'gargalhada',
      'gargalhadas',
      'divertido',
      'pastelao',
      'minha mae e uma peca',
      'auto da compadecida',
    ],
  ],
  [
    'thriller',
    [
      'suspense',
      'psicologico',
      'psychological',
      'tenso',
      'tensao',
      'serial killer',
      'psicopata',
      'seven',
      'se7en',
      'ilha do medo',
      'shutter island',
      'corra',
      'get out',
      'parasita',
      'parasite',
      'oldboy',
      'silencio dos inocentes',
      'garota exemplar',
      'gone girl',
      'paranoia',
      'thriller',
    ],
  ],
  [
    'crime',
    [
      'crime',
      'mafia',
      'assalto',
      'heist',
      'gangue',
      'trafico',
      'poderoso chefao',
      'godfather',
      'cidade de deus',
      'bons companheiros',
      'goodfellas',
      'pulp fiction',
      'scarface',
      'infiltrados',
      'policial',
    ],
  ],
  [
    'mystery',
    [
      'misterio',
      'mystery',
      'detetive',
      'detective',
      'enigma',
      'investigacao',
      'sherlock',
      'entre facas',
      'knives out',
      'contratempo',
      'zodiaco',
      'quem matou',
      'whodunit',
      'pistas',
    ],
  ],
  [
    'fantasy',
    [
      'fantasia',
      'fantasy',
      'magia',
      'magic',
      'feiticeiro',
      'bruxo',
      'bruxa',
      'bruxaria',
      'dragao',
      'dragoes',
      'harry potter',
      'senhor dos aneis',
      'lord of the rings',
      'hobbit',
      'medieval',
      'elfo',
    ],
  ],
  [
    'adventure',
    [
      'aventura',
      'adventure',
      'jornada',
      'exploracao',
      'tesouro',
      'selva',
      'indiana jones',
      'jumanji',
      'uncharted',
      'expedicao',
      'ilha misteriosa',
      'goonies',
    ],
  ],
  [
    'war',
    [
      'guerra',
      'war',
      'soldado',
      'soldados',
      'batalha',
      'trincheira',
      'militar',
      '1917',
      'resgate do soldado ryan',
      'dunkirk',
      'segunda guerra',
    ],
  ],
  [
    'western',
    [
      'faroeste',
      'western',
      'velho oeste',
      'cauboi',
      'cowboy',
      'pistoleiro',
      'django',
      'bang-bang',
      'xerife',
    ],
  ],
  [
    'history',
    [
      'historia',
      'historico',
      'historical',
      'epoca',
      'gladiador',
      'oppenheimer',
      'imperio',
      'realeza',
      'roma antiga',
      'biografia',
      'biopic',
    ],
  ],
  [
    'music',
    [
      'musica',
      'musical',
      'banda',
      'rock',
      'cantor',
      'cantora',
      'la la land',
      'whiplash',
      'bohemian',
    ],
  ],
  [
    'documentary',
    ['documentario', 'documentarios', 'documentary', 'vida real', 'fatos reais', 'natureza'],
  ],
  [
    'family',
    [
      'familia',
      'family',
      'infantil',
      'crianca',
      'criancas',
      'kids',
      'esqueceram de mim',
      'matilda',
      'extraordinario',
    ],
  ],
  [
    'action',
    [
      'acao',
      'action',
      'tiroteio',
      'luta',
      'lutas',
      'artes marciais',
      'adrenalina',
      'explosao',
      'explosoes',
      'john wick',
      'resgate',
      'velozes',
      'missao impossivel',
      'tropa de elite',
      'duro de matar',
      'mad max',
      'top gun',
      'pancadaria',
      'vingadores',
      'super-heroi',
    ],
  ],
  [
    'drama',
    ['drama', 'dramatico', 'chorar', 'emocionante', 'emotional', 'luto', 'superacao'],
  ],
];

const RAW_MOOD_RULES: ReadonlyArray<readonly [LayaMood, readonly string[]]> = [
  [
    'mindbending',
    [
      'mente explodindo',
      'mindbending',
      'mind-bending',
      'paradoxo',
      'no na cabeca',
      'confuso',
      'matrix',
      'a origem',
      'inception',
      'reviravolta',
      'plot twist',
      'twist',
    ],
  ],
  [
    'cozy',
    [
      'aconchegante',
      'cozy',
      'quentinho',
      'cobertor',
      'confortavel',
      'sessao da tarde',
      'fofo',
      'heartfelt',
    ],
  ],
  [
    'lighthearted',
    [
      'leve',
      'lighthearted',
      'rir',
      'laugh',
      'divertido',
      'divertida',
      'fun',
      'relaxar',
      'alegre',
      'comedia',
      'comedy',
      'alto-astral',
      'descontraido',
      'crianca',
      'criancas',
      'infantil',
    ],
  ],
  [
    'emotional',
    [
      'chorar',
      'cry',
      'emocionante',
      'emotional',
      'tocante',
      'sensivel',
      'amor',
      'luto',
      'romance',
      'apaixonado',
      'apaixonada',
    ],
  ],
  [
    'dark',
    [
      'sombrio',
      'dark',
      'macabro',
      'pesado',
      'perturbador',
      'assustador',
      'terror',
      'horror',
      'mafia',
      'melancolico',
    ],
  ],
  [
    'mysterious',
    [
      'misterio',
      'mystery',
      'enigma',
      'intrigante',
      'detetive',
      'espaco',
      'space',
      'ficcao',
      'nostalgico',
      'nostalgica',
    ],
  ],
];

const RAW_DECADE_RULES: ReadonlyArray<readonly [LayaDecade, readonly string[]]> = [
  [
    'classic',
    [
      'classico',
      'classicos',
      'classic',
      'antigo',
      'antigos',
      'anos 50',
      'anos 60',
      'anos 70',
      'preto e branco',
    ],
  ],
  ['80s', ['anos 80', '80s', '1980s', 'oitentista', '1980', 'retro']],
  ['90s', ['anos 90', '90s', '1990s', 'noventista', '1990', 'vhs']],
  ['2000s', ['anos 2000', '2000s', 'dos 2000']],
  [
    'modern',
    [
      'recente',
      'recentes',
      'recent',
      'atual',
      'atuais',
      'moderno',
      'moderna',
      'modern',
      'lancamento',
      'lancamentos',
      'novo',
      'novos',
    ],
  ],
];

const RAW_ORIGIN_RULES: ReadonlyArray<readonly [LayaOrigin, readonly string[]]> = [
  [
    'japanese',
    [
      'japones',
      'japonesa',
      'japanese',
      'japao',
      'japan',
      'anime',
      'animes',
      'ghibli',
      'shonen',
      'otaku',
    ],
  ],
  [
    'korean',
    [
      'coreano',
      'coreana',
      'korean',
      'coreia',
      'korea',
      'dorama',
      'k-drama',
      'kdrama',
      'parasita',
      'parasite',
      'oldboy',
      'invasao zumbi',
    ],
  ],
  [
    'national',
    [
      'brasileiro',
      'brasileira',
      'brasileiros',
      'brasileiras',
      'brazilian',
      'nacional',
      'nacionais',
      'brasil',
      'brazil',
      'cidade de deus',
      'tropa de elite',
      'central do brasil',
      'minha mae e uma peca',
      'auto da compadecida',
    ],
  ],
  [
    'european',
    [
      'europeu',
      'europeia',
      'european',
      'europa',
      'frances',
      'francesa',
      'french',
      'espanhol',
      'espanhola',
      'spanish',
      'italiano',
      'italiana',
      'italian',
      'britanico',
      'britanica',
      'british',
      'alemao',
      'german',
      'amelie',
      'contratempo',
    ],
  ],
  [
    'asian',
    ['asiatico', 'asiatica', 'asian', 'china', 'chines', 'tailandes', 'bollywood', 'indiano'],
  ],
  [
    'hollywood',
    ['hollywood', 'americano', 'americana', 'american', 'estados unidos'],
  ],
];

const RAW_PACING_RULES: ReadonlyArray<readonly [LayaPacing, readonly string[]]> = [
  [
    'slow',
    [
      'lento',
      'slow',
      'contemplativo',
      'paciente',
      'calmo',
      'parado',
      'filosofico',
      'profundo',
    ],
  ],
];

const RAW_CONTEXT_RULES: ReadonlyArray<readonly [LayaViewingContext, readonly string[]]> = [
  [
    'couple',
    ['namorado', 'namorada', 'namorados', 'casal', 'couple', 'a dois', 'esposa', 'marido', 'date'],
  ],
  [
    'family',
    [
      'familia',
      'family',
      'pais',
      'filhos',
      'filho',
      'filha',
      'crianca',
      'criancas',
      'infantil',
      'bebe',
    ],
  ],
  [
    'friends',
    ['amigos', 'amigo', 'amigas', 'friends', 'galera', 'turma', 'pessoal'],
  ],
];

export const COMPILED_GENRE_RULES = compileRules(RAW_GENRE_RULES);
export const COMPILED_MOOD_RULES = compileRules(RAW_MOOD_RULES);
export const COMPILED_DECADE_RULES = compileRules(RAW_DECADE_RULES);
export const COMPILED_ORIGIN_RULES = compileRules(RAW_ORIGIN_RULES);
export const COMPILED_PACING_RULES = compileRules(RAW_PACING_RULES);
export const COMPILED_CONTEXT_RULES = compileRules(RAW_CONTEXT_RULES);

export const RATING_ALL_AGES_REGEX = compileTermListRegex([
  'livre',
  'crianca',
  'criancas',
  'infantil',
  'familia',
  'desenho',
  'pixar',
  'disney',
  'bebe',
]);
export const RATING_10_REGEX = compileTermListRegex(['10 anos']);
export const RATING_12_REGEX = compileTermListRegex(['12 anos']);
export const RATING_18_REGEX = compileTermListRegex([
  '18 anos',
  'pesado',
  'sangrento',
  'extremo',
  'brutal',
]);

export const GENRES_12_PLUS = new Set<string>(['adventure', 'romance', 'scifi', 'fantasy']);
export const GENRES_16_PLUS = new Set<string>(['horror', 'crime', 'war', 'action', 'thriller']);

export function resolveContentRating(
  qNorm: string,
  genre: string,
  weightRating?: string,
): LayaContentRating | string {
  if (RATING_ALL_AGES_REGEX.test(qNorm)) return 'L';
  if (RATING_10_REGEX.test(qNorm)) return '10';
  if (RATING_12_REGEX.test(qNorm) || GENRES_12_PLUS.has(genre)) return '12';
  if (RATING_18_REGEX.test(qNorm)) return '18';
  if (GENRES_16_PLUS.has(genre)) return '16';
  return weightRating || '14';
}

export const REFERENCE_MOVIE_REGEX =
  /(?:estilo\s+(?:de\s+)?|tipo\s+|gosto\s+(?:muito\s+)?de\s+|parecido\s+com\s+|adorei\s+|amo\s+|como\s+|loved\s+|like\s+|similar\s+to\s+)([\w\s:\-'’À-ÿ]+?)(?:,|\.|!|\?|$|\se\s|\spara\s|\smas\s|\scom\s|\sque\s|\sno\s|\sna\s|\srecommend\s|\sin\s)/i;

export const REFERENCE_STOP_WORDS = new Set([
  'filme',
  'filmes',
  'cinema',
  'serie',
  'series',
  'dorama',
  'doramas',
  'anime',
  'animes',
  'algo',
  'rir',
  'chorar',
  'ghibli',
  'studio ghibli',
  'pixar',
  'disney',
  'dreamworks',
  'marvel',
  'dc',
  'a24',
  'netflix',
  'hbo',
  'tarantino',
  'nolan',
  'scorsese',
  'spielberg',
  'kubrick',
  'fincher',
  'hitchcock',
  'tim burton',
  'wes anderson',
]);
