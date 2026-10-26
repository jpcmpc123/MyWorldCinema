import type {
  LayaContentRating,
  LayaDecade,
  LayaGenre,
  LayaGuessTitle,
  LayaMood,
  LayaOrigin,
  LayaPacing,
  LayaViewingContext,
} from './types';

export interface CompiledRule<T extends string> {
  key: T;
  regex: RegExp;
}

export interface AkinatorMovieProfile {
  title: LayaGuessTitle;
  genre: LayaGenre;
  mood: LayaMood;
  content_rating: LayaContentRating;
  decade: LayaDecade;
  origin: LayaOrigin;
  pacing: LayaPacing;
  viewing_context: LayaViewingContext;
  regex: RegExp;
  keywordGroups?: ReadonlyArray<RegExp>;
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
  rawRules: ReadonlyArray<readonly [T, readonly string[]]>,
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

/**
 * Base calibrada cirurgicamente dos filmes do Akinator Laya (Jpcm/laya-filmes-tmdb)
 * com perfil 7D sem ruído e suporte a grupos de palavras-chave combinadas.
 */
const RAW_AKINATOR_PROFILES: ReadonlyArray<{
  title: LayaGuessTitle;
  genre: LayaGenre;
  mood: LayaMood;
  content_rating: LayaContentRating;
  decade: LayaDecade;
  origin: LayaOrigin;
  pacing: LayaPacing;
  viewing_context: LayaViewingContext;
  clues: readonly string[];
  keywordGroups?: ReadonlyArray<readonly string[]>;
}> = [
  {
    title: 'As Branquelas',
    genre: 'comedy',
    mood: 'lighthearted',
    content_rating: '12',
    decade: '2000s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'friends',
    clues: [
      'policiais negros',
      'policiais do fbi',
      'agentes do fbi',
      'peruca loira',
      'patricinhas brancas',
      'patricinhas loiras',
      'vestem de patricinhas',
      'fantasiam de patricinhas',
      'disfarcam de duas',
      'disfarcados de mulheres',
      'irmas wilson',
      'thousand miles',
      'socialites',
    ],
  },
  {
    title: 'Tropa de Elite',
    genre: 'action',
    mood: 'intense',
    content_rating: '18',
    decade: '2000s',
    origin: 'national',
    pacing: 'fast',
    viewing_context: 'friends',
    clues: [
      'capitao nascimento',
      'pede pra sair',
      'saco na cabeca',
      'botando saco',
      'bota na conta do papa',
      'na cara nao',
      'treinamento rigido',
      'bope no morro',
      'caveira preta',
    ],
  },
  {
    title: 'Vingadores: Ultimato',
    genre: 'action',
    mood: 'intense',
    content_rating: '12',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'friends',
    clues: [
      'joias do infinito',
      'recuperar joias',
      'derrotar o thanos',
      'thanos',
      'estalo de dedos',
      'metade do universo virou po',
      'martelo do thor',
      'reino quantico',
    ],
  },
  {
    title: 'Brilho Eterno de uma Mente sem Lembranças',
    genre: 'romance',
    mood: 'emotional',
    content_rating: '14',
    decade: '2000s',
    origin: 'hollywood',
    pacing: 'slow',
    viewing_context: 'couple',
    clues: [
      'apagando memorias',
      'apagar as memorias',
      'apagar memorias',
      'memorias do cerebro',
      'clinica especializada',
      'cabelo colorido',
      'kate winslet de cabelo',
      'esquecer o relacionamento',
    ],
  },
  {
    title: 'Interestelar',
    genre: 'scifi',
    mood: 'emotional',
    content_rating: '12',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'slow',
    viewing_context: 'solo',
    clues: [
      'gargantua',
      'buraco negro',
      'fala com a filha pelo relogio',
      'pelo relogio no buraco negro',
      'dilatacao temporal',
      'planeta de agua',
      'planeta de ondas',
      'relogio da murph',
      'murph',
      'tesserato',
      'estante de livros',
      'poeira na terra',
    ],
  },
  {
    title: 'A Origem',
    genre: 'scifi',
    mood: 'mindbending',
    content_rating: '14',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'invasao de sonhos',
      'invadir os sonhos',
      'entra dentro do sonho',
      'sonho dentro de um sonho',
      'piao girando',
      'piao que gira',
      'arquiteto de sonhos',
      'gravidade zero no hotel',
      'totem',
    ],
  },
  {
    title: 'Matrix',
    genre: 'scifi',
    mood: 'mindbending',
    content_rating: '14',
    decade: '90s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'pilula vermelha',
      'pilula azul',
      'desviando de balas',
      'balas em camera lenta',
      'realidade simulada',
      'codigo verde',
      'keanu reeves neo',
      'morpheus',
      'agente smith',
    ],
  },
  {
    title: 'Clube da Luta',
    genre: 'drama',
    mood: 'mindbending',
    content_rating: '18',
    decade: '90s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'narrador insone',
      'porrada no porao',
      'luta no porao',
      'sabao feito de gordura',
      'gordura humana',
      'sabao rosa',
      'tyler durden',
      'primeira regra e nao falar',
    ],
  },
  {
    title: 'Parasita',
    genre: 'thriller',
    mood: 'dark',
    content_rating: '16',
    decade: 'modern',
    origin: 'korean',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'familia pobre coreana',
      'infiltra trabalhando na casa',
      'casa da familia rica',
      'bunker secreto no porao',
      'porao secreto da mansao',
      'codigo morse',
      'falsifica diploma',
    ],
  },
  {
    title: 'Cidade de Deus',
    genre: 'crime',
    mood: 'intense',
    content_rating: '18',
    decade: '2000s',
    origin: 'national',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'buscape',
      'ze pequeno',
      'dadinho',
      'mane galinha',
      'querendo ser fotografo',
      'domina a favela',
      'tiro na mao ou no pe',
    ],
  },
  {
    title: 'O Sexto Sentido',
    genre: 'mystery',
    mood: 'mindbending',
    content_rating: '14',
    decade: '90s',
    origin: 'hollywood',
    pacing: 'slow',
    viewing_context: 'solo',
    clues: [
      'menino que ve gente morta',
      've gente morta',
      'vejo pessoas mortas',
      'psicologo descobre que ele mesmo estava morto',
      'ele mesmo estava morto',
    ],
  },
  {
    title: 'Titanic',
    genre: 'romance',
    mood: 'emotional',
    content_rating: '12',
    decade: '90s',
    origin: 'hollywood',
    pacing: 'slow',
    viewing_context: 'couple',
    clues: [
      'transatlantico gigante',
      'bate no iceberg',
      'jack desenhando a rose',
      'porta no oceano congelado',
      'coracao do oceano',
      'navio que afundou',
      'proa do navio',
    ],
  },
  {
    title: 'Ilha do Medo',
    genre: 'thriller',
    mood: 'mindbending',
    content_rating: '16',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'slow',
    viewing_context: 'solo',
    clues: [
      'investigando manicomio',
      'manicomio numa ilha',
      'hospital psiquiatrico de criminosos',
      'paciente 67',
      'teddy daniels',
    ],
  },
  {
    title: 'O Show de Truman',
    genre: 'drama',
    mood: 'mindbending',
    content_rating: '12',
    decade: '90s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'toda a sua cidade e vida e um reality',
      'reality show televisivo falso',
      'transmitido ao vivo',
      'parede pintada de ceu',
      'refletor cai do ceu',
      'ilha cenografica',
    ],
  },
  {
    title: 'O Silêncio dos Inocentes',
    genre: 'thriller',
    mood: 'dark',
    content_rating: '18',
    decade: '90s',
    origin: 'hollywood',
    pacing: 'slow',
    viewing_context: 'solo',
    clues: [
      'clarice starling',
      'hannibal lecter',
      'canibal preso em cela',
      'cela de vidro',
      'buffalo bill',
      'psiquiatra assassino canibal',
    ],
  },
  {
    title: 'Pulp Fiction',
    genre: 'crime',
    mood: 'intense',
    content_rating: '18',
    decade: '90s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'friends',
    clues: [
      'danca classica na lanchonete',
      'maleta brilhante dourada',
      'jules e vincent',
      'relogio de ouro',
      'milkshake de 5 dolares',
      'injecao de adrenalina no coracao',
      'quarto de libra',
    ],
  },
  {
    title: 'O Auto da Compadecida',
    genre: 'comedy',
    mood: 'lighthearted',
    content_rating: '12',
    decade: '2000s',
    origin: 'national',
    pacing: 'fast',
    viewing_context: 'family',
    clues: [
      'joao grilo',
      'chico no sertao',
      'joao grilo e chico',
      'enganando padre e padeiro',
      'julgamento no ceu',
      'nossa senhora e jesus',
      'cachorra enterrada em latim',
      'nao sei so sei que foi assim',
    ],
  },
  {
    title: 'John Wick',
    genre: 'action',
    mood: 'intense',
    content_rating: '16',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'assassino aposentado de terno preto',
      'matando a mafia toda por causa do cachorro',
      'por causa do cachorro',
      'cachorro deixado pela esposa',
      'matam o cachorrinho',
      'baba yaga',
      'hotel continental',
    ],
  },
  {
    title: 'Bastardos Inglórios',
    genre: 'war',
    mood: 'intense',
    content_rating: '18',
    decade: '2000s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'friends',
    clues: [
      'soldados judeus cacando',
      'escalpelando nazistas',
      'franca ocupada',
      'cinema em chamas',
      'hans landa',
      'metralhando hitler no cinema',
    ],
  },
  {
    title: 'Gladiador',
    genre: 'history',
    mood: 'inspirational',
    content_rating: '16',
    decade: '2000s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'general romano maximus',
      'maximus traido',
      'vira escravo gladiador',
      'escravo gladiador no coliseu',
      'imperador comodo',
      'voces nao estao entretidos',
    ],
  },
  {
    title: 'O Senhor dos Anéis',
    genre: 'fantasy',
    mood: 'inspirational',
    content_rating: '12',
    decade: '2000s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'family',
    clues: [
      'hobbit com pes peludos',
      'sociedade do anel',
      'anel de poder',
      'montanha da perdicao',
      'frodo',
      'gollum',
      'meu precioso',
      'terra media',
      'olho de sauron',
    ],
  },
  {
    title: 'Coringa',
    genre: 'drama',
    mood: 'dark',
    content_rating: '16',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'slow',
    viewing_context: 'solo',
    clues: [
      'arthur fleck',
      'palhaco pobre',
      'transtorno de riso',
      'riso incontrolavel',
      'protestos na tv',
      'dancando na escadaria',
      'doenca do riso',
    ],
  },
  {
    title: 'De Volta para o Futuro',
    genre: 'scifi',
    mood: 'lighthearted',
    content_rating: 'L',
    decade: '80s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'family',
    clues: [
      'marty mcfly',
      'dr brown',
      'delorean',
      '88 milhas por hora',
      'capacitor de fluxo',
      'viajando pros anos 50',
      'torre do relogio atingida por um raio',
    ],
  },
  {
    title: 'O Rei Leão',
    genre: 'animation',
    mood: 'emotional',
    content_rating: 'L',
    decade: '90s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'family',
    clues: [
      'filhote leao simba',
      'simba',
      'mufasa',
      'debandada armada pelo tio scar',
      'tio scar',
      'hakuna matata',
      'timao e pumba',
      'pedra do reino',
    ],
  },
  {
    title: 'O Castelo de Vidro',
    genre: 'drama',
    mood: 'emotional',
    content_rating: '14',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'slow',
    viewing_context: 'solo',
    clues: [
      'castelo de vidro',
      'glass castle',
      'jeannette walls',
      'rex walls',
      'casa de vidro transparente',
      'construir um castelo de vidro',
      'construir algo transparente',
      'construir aogo tranparente',
      'pais nomades',
    ],
    keywordGroups: [
      ['pai', 'pais', 'mae', 'mao', 'familia', 'filhos'],
      ['construir', 'desejo', 'desenjo', 'sonho', 'planta', 'projeto'],
      ['transparente', 'tranparente', 'vidro', 'castelo'],
    ],
  },
  {
    title: '13 Fantasmas',
    genre: 'horror',
    mood: 'dark',
    content_rating: '18',
    decade: '2000s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'friends',
    clues: [
      '13 fantasmas',
      'treze fantasmas',
      'thirteen ghosts',
      'mansao de vidro com fantasmas',
      'oculos especiais para ver fantasmas',
    ],
    keywordGroups: [
      ['casa', 'mansao'],
      ['vidro', 'transparente', 'tranparente'],
      ['fantasma', 'fantasmas', 'espiritos'],
    ],
  },
  {
    title: 'A Casa de Vidro',
    genre: 'thriller',
    mood: 'dark',
    content_rating: '14',
    decade: '2000s',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'casa de vidro',
      'the glass house',
      'irmaos orfaos adotados por casal',
      'adotados pelos vizinhos ricos numa mansao de vidro',
    ],
    keywordGroups: [
      ['orfaos', 'adotivos', 'adotados', 'tutores'],
      ['mansao', 'casa'],
      ['vidro', 'transparente'],
    ],
  },
  {
    title: 'Dente Canino',
    genre: 'drama',
    mood: 'dark',
    content_rating: '18',
    decade: '2000s',
    origin: 'european',
    pacing: 'slow',
    viewing_context: 'solo',
    clues: [
      'dente canino',
      'dogtooth',
      'kynodontas',
      'pais trancam os filhos em casa',
      'so podem sair quando o dente canino cair',
      'ensinam palavras erradas aos filhos',
    ],
  },
  {
    title: 'O Quarto de Jack',
    genre: 'drama',
    mood: 'emotional',
    content_rating: '14',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'slow',
    viewing_context: 'solo',
    clues: [
      'quarto de jack',
      'mae e filho presos num cativeiro',
      'menino nasceu num quarto fechado',
      'nunca viu o mundo la fora',
      'enrolado no tapete para fugir',
    ],
  },
  {
    title: 'Capitão Fantástico',
    genre: 'drama',
    mood: 'inspirational',
    content_rating: '14',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'slow',
    viewing_context: 'family',
    clues: [
      'capitao fantastico',
      'captain fantastic',
      'pai cria os seis filhos na floresta',
      'pai cria os filhos isolados no mato',
    ],
  },
  {
    title: 'Corra!',
    genre: 'horror',
    mood: 'dark',
    content_rating: '16',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'conhecer os pais da namorada branca',
      'hipnose com xicara de cha',
      'zona de afundamento',
      'transplante de cerebro na familia',
    ],
  },
  {
    title: 'Hereditário',
    genre: 'horror',
    mood: 'dark',
    content_rating: '18',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'slow',
    viewing_context: 'solo',
    clues: [
      'menina perde a cabeca no poste',
      'estalo com a lingua',
      'maquetes em miniatura',
      'rei paimon',
      'seita da avo morta',
    ],
  },
  {
    title: 'Garota Exemplar',
    genre: 'thriller',
    mood: 'dark',
    content_rating: '16',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'couple',
    clues: [
      'esposa forja o proprio desaparecimento',
      'forja o proprio sequestro e morte',
      'incriminar o marido infiel',
      'amy dunne',
    ],
  },
  {
    title: 'O Poço',
    genre: 'thriller',
    mood: 'dark',
    content_rating: '18',
    decade: 'modern',
    origin: 'spanish',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'prisao vertical com plataforma de comida',
      'mesa de comida que desce pelos andares',
      'quem esta em cima come tudo',
      'el hoyo',
    ],
  },
  {
    title: 'Whiplash: Em Busca da Perfeição',
    genre: 'music',
    mood: 'intense',
    content_rating: '14',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'baterista de jazz',
      'professor de musica abusivo careca',
      'joga cadeira no baterista',
      'nao e o meu tempo',
      'maos sangrando na bateria',
    ],
  },
  {
    title: 'Tudo em Todo o Lugar ao Mesmo Tempo',
    genre: 'scifi',
    mood: 'mindbending',
    content_rating: '14',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'family',
    clues: [
      'dona de lavanderia no multiverso',
      'dedos de salsicha',
      'bagel preto com tudo dentro',
      'declarando imposto de renda no multiverso',
    ],
  },
  {
    title: 'A Substância',
    genre: 'horror',
    mood: 'dark',
    content_rating: '18',
    decade: 'modern',
    origin: 'hollywood',
    pacing: 'fast',
    viewing_context: 'solo',
    clues: [
      'soro verde do mercado negro',
      'versao mais jovem sai das costas',
      'revezar a cada sete dias',
      'apresentadora de ginastica demitida',
    ],
  },
];

export const COMPILED_AKINATOR_PROFILES: readonly AkinatorMovieProfile[] =
  RAW_AKINATOR_PROFILES.map((item) => ({
    title: item.title,
    genre: item.genre,
    mood: item.mood,
    content_rating: item.content_rating,
    decade: item.decade,
    origin: item.origin,
    pacing: item.pacing,
    viewing_context: item.viewing_context,
    regex: compileTermListRegex(item.clues),
    keywordGroups: item.keywordGroups
      ? item.keywordGroups.map((group) => compileTermListRegex(group))
      : undefined,
  }));

export const GUESSING_INTENT_REGEX = compileTermListRegex([
  'qual e o filme',
  'qual o filme',
  'qual o nome do filme',
  'esqueci o nome do filme',
  'esqueci o filme',
  'lembro de um filme',
  'lembro de uma cena',
  'aquele filme que',
  'aquele filme onde',
  'aquele filme do',
  'aquele filme da',
  'aquele filme dos',
  'filme onde',
  'filme em que',
  'filme sobre um',
  'filme sobre uma',
  'como chama o filme',
  'me ajuda a lembrar',
  'tentando lembrar',
  'descobrir o nome do filme',
  'adivinhar o filme',
  'what is the movie',
  'forgot the name of the movie',
  'movie where',
]);

export function normalizeGuessTypos(qNorm: string): string {
  return qNorm
    .replace(/\btranparente\b/g, 'transparente')
    .replace(/\bdesenjo\b/g, 'desejo')
    .replace(/\baogo\b/g, 'algo')
    .replace(/\buma mao\b/g, 'uma mae');
}

export function matchAkinatorProfile(qNorm: string): AkinatorMovieProfile | null {
  const cleaned = normalizeGuessTypos(qNorm);
  for (let i = 0; i < COMPILED_AKINATOR_PROFILES.length; i++) {
    const profile = COMPILED_AKINATOR_PROFILES[i];
    if (profile.regex.test(cleaned)) {
      return profile;
    }
    if (
      profile.keywordGroups &&
      profile.keywordGroups.length > 0 &&
      profile.keywordGroups.every((groupRegex) => groupRegex.test(cleaned))
    ) {
      return profile;
    }
  }
  return null;
}

export function getAkinatorProfileByTitle(title?: string | null): AkinatorMovieProfile | null {
  if (!title || title === 'none') return null;
  const norm = stripAccents(title);
  for (let i = 0; i < COMPILED_AKINATOR_PROFILES.length; i++) {
    if (stripAccents(COMPILED_AKINATOR_PROFILES[i].title) === norm) {
      return COMPILED_AKINATOR_PROFILES[i];
    }
  }
  return null;
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
      'brilho eterno',
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
      'sexto sentido',
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
      'bastardos inglorios',
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
    'inspirational',
    [
      'inspirador',
      'inspiradora',
      'inspirational',
      'inspiring',
      'motivacional',
      'superacao de vida',
      'superacao',
      'edificante',
      'vitorioso',
      'gladiador',
    ],
  ],
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
      'clube da luta',
      'show de truman',
      'sexto sentido',
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
      'classico antigo',
      'classicos antigos',
      'antes de 1980',
      'anos 50',
      'anos 60',
      'anos 70',
      'preto e branco',
      'cinema de ouro',
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
    'french',
    ['frances', 'francesa', 'franceses', 'francesas', 'franca', 'french', 'france', 'amelie'],
  ],
  [
    'spanish',
    ['espanhol', 'espanhola', 'espanha', 'spanish', 'spain', 'contratempo'],
  ],
  [
    'italian',
    ['italiano', 'italiana', 'italia', 'italian', 'italy'],
  ],
  [
    'british',
    ['britanico', 'britanica', 'reino unido', 'inglaterra', 'british'],
  ],
  [
    'german',
    ['alemao', 'alema', 'alemanha', 'german', 'germany'],
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
      'do brasil',
      'no brasil',
      'filme br',
      'filmes br',
      'cinema br',
      'cinema nacional',
    ],
  ],
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
    'european',
    ['europeu', 'europeia', 'european', 'europa'],
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
  [
    'fast',
    [
      'rapido',
      'frenetico',
      'dinamico',
      'acao sem parar',
      'direto ao ponto',
      'acelerado',
      'eletrizante',
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
