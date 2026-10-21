// ---------------------------------------------------------------------------
// Navegação para o PERFIL DE PESSOA (/actor/:id) com ABERTURA CONTEXTUAL.
//
// O cargo de onde o clique partiu vira a aba inicial da página:
//   elenco (Cast)      → 'Actor'
//   Direção            → 'Director'
//   Roteiro            → 'Writer'
//   Produção           → 'Producer'
// Se a pessoa não tiver filmes naquela função, a página cai na primeira
// aba de função disponível (e, sem nenhuma, na aba Bio).
//
// O cargo viaja em DOIS canais:
//   • router state  ("initialRole") — caminho normal de clique
//   • querystring   (?role=Director) — sobrevive a refresh / deep link no APK
// ---------------------------------------------------------------------------

/** Funções suportadas como aba no perfil de pessoa. */
export type PersonRole =
  | 'Actor'
  | 'Creator'
  | 'Producer'
  | 'Writer'
  | 'Director'
  | 'Executive Producer'
  | 'Composer'
  | 'Cinematography'
  | 'Editor';

/** Ordem de prioridade das abas de função (a aba Bio vem sempre antes). */
export const PERSON_ROLE_ORDER: PersonRole[] = [
  'Actor',
  'Creator',
  'Producer',
  'Writer',
  'Director',
  'Executive Producer',
  'Composer',
  'Cinematography',
  'Editor',
];

/** Jobs do TMDB que pertencem a cada aba de equipe. */
export const PERSON_ROLE_JOBS: Record<Exclude<PersonRole, 'Actor'>, string[]> = {
  /** Criador de série (job injetado por getTVDetails e autores de obra original) */
  Creator: [
    'Creator',
    'Series Creator',
    'Co-Creator',
    'Created By',
    'Original Creator',
    'Original Series Creator',
    'Original Story',
    'Original Concept',
    'Graphic Novel',
    'Comic Book',
    'Manga',
  ],
  Producer: [
    'Producer',
    'Co-Producer',
    'Associate Producer',
    'Line Producer',
    'Supervising Producer',
    'Consulting Producer',
  ],
  Writer: [
    'Writer',
    'Series Writer',
    'Screenplay',
    'Story',
    'Series Composition',
    'Script',
    'Novel',
    'Author',
    'Characters',
    'Teleplay',
    'Staff Writer',
    'Story Editor',
    'Book',
    'Short Story',
    'Adaptation',
  ],
  Director: ['Director', 'Series Director', 'Co-Director', 'Action Director'],
  'Executive Producer': ['Executive Producer', 'Co-Executive Producer'],
  Composer: [
    'Original Music Composer',
    'Composer',
    'Music',
    'Theme Song Performance',
    'Main Title Theme Composer',
  ],
  Cinematography: ['Director of Photography', 'Cinematography'],
  Editor: ['Editor', 'Film Editor', 'Lead Editor'],
};

const ROLE_SET = new Set<string>(PERSON_ROLE_ORDER);

/** Valida uma string vinda da URL/state como cargo conhecido. */
export function isPersonRole(value: unknown): value is PersonRole {
  return typeof value === 'string' && ROLE_SET.has(value);
}

/** Job do TMDB → aba (ou null quando o cargo não tem aba própria). */
export function personRoleFromJob(job?: string | null): PersonRole | null {
  if (!job) return null;
  const found = (Object.keys(PERSON_ROLE_JOBS) as Exclude<PersonRole, 'Actor'>[]).find((role) =>
    PERSON_ROLE_JOBS[role].includes(job),
  );
  return found ?? null;
}

/**
 * Verifica se os genre_ids de um filme ou série batem com o filtro de gênero
 * (mapeando também os IDs compostos de TV do TMDB: Action & Adventure 10759,
 * Sci-Fi & Fantasy 10765 e War & Politics 10768).
 */
export function matchesPersonGenreFilter(
  genreIds: number[] | undefined,
  filterId: number,
): boolean {
  if (!genreIds || genreIds.length === 0) return false;
  if (genreIds.includes(filterId)) return true;
  if ((filterId === 28 || filterId === 12) && genreIds.includes(10759)) return true;
  if ((filterId === 878 || filterId === 14) && genreIds.includes(10765)) return true;
  if (filterId === 10752 && genreIds.includes(10768)) return true;
  return false;
}

/**
 * Departamento principal da pessoa (TMDB `known_for_department`) → cargo.
 * Serve de fallback quando não há cargo explícito (busca, link direto).
 */
export function personRoleFromDepartment(department?: string | null): PersonRole {
  switch (department) {
    case 'Directing':
      return 'Director';
    case 'Writing':
      return 'Writer';
    case 'Creator':
      return 'Creator';
    case 'Production':
      return 'Producer';
    case 'Sound':
      return 'Composer';
    case 'Camera':
      return 'Cinematography';
    case 'Editing':
      return 'Editor';
    case 'Acting':
    default:
      return 'Actor';
  }
}

/**
 * Rota canônica do perfil de pessoa já com a aba contextual.
 *
 *   <Link to={openPersonProfile(actor.id)}>            // Cast → Actor
 *   <Link to={openPersonProfile(director.id, 'Director')}>
 */
export function openPersonProfile(
  personId: number | string,
  initialRole: PersonRole = 'Actor',
): { pathname: string; search: string; state: { initialRole: PersonRole } } {
  return {
    pathname: `/actor/${personId}`,
    search: `?role=${encodeURIComponent(initialRole)}`,
    state: { initialRole },
  };
}
