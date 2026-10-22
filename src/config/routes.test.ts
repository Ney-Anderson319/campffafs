import { describe, expect, it } from 'vitest';
import { ROUTES, ROUTE_PREFIXES } from './routes';

describe('rotas centralizadas', () => {
  it('usa os caminhos padrão pedidos', () => {
    expect(ROUTES.publicHome).toBe('/campeonato/visualizacao');
    expect(ROUTES.adminLogin).toBe('/campeonato/admin');
    expect(ROUTES.adminDashboard).toBe('/campeonato/admin/dashboard');
    expect(ROUTES.publicSchoolPattern).toBe('/campeonato/visualizacao/escola/:schoolId');
  });
  it('deriva todos os caminhos dos prefixos', () => {
    expect(ROUTES.publicSchool('abc')).toBe(`${ROUTE_PREFIXES.public}/escola/abc`);
    expect(ROUTES.adminSection('escolas')).toBe(`${ROUTE_PREFIXES.admin}/dashboard/escolas`);
  });
  it('escapa IDs na URL', () => {
    expect(ROUTES.publicSchool('a/b')).toContain('a%2Fb');
  });
});
