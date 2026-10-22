/**
 * ÚNICO lugar para alterar os caminhos da aplicação.
 * Para trocar os prefixos, edite ROUTE_PREFIXES. O restante do projeto usa apenas ROUTES.
 * (Se mudar os prefixos, o fallback de SPA da hospedagem continua valendo: tudo cai em /index.html.)
 */
export const ROUTE_PREFIXES = {
  public: '/campeonato/visualizacao',
  admin: '/campeonato/admin',
} as const;

export const ADMIN_SECTIONS = {
  overview: '',
  schools: 'escolas',
  teams: 'equipes',
  championships: 'campeonatos',
  scoring: 'pontuacao',
} as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[keyof typeof ADMIN_SECTIONS];

const dashboard = `${ROUTE_PREFIXES.admin}/dashboard`;

export const ROUTES = {
  root: '/',
  publicHome: ROUTE_PREFIXES.public,
  publicSchoolPattern: `${ROUTE_PREFIXES.public}/escola/:schoolId`,
  publicSchool: (schoolId: string) => `${ROUTE_PREFIXES.public}/escola/${encodeURIComponent(schoolId)}`,
  adminLogin: ROUTE_PREFIXES.admin,
  adminDashboard: dashboard,
  adminSection: (section: AdminSection) => (section ? `${dashboard}/${section}` : dashboard),
} as const;
