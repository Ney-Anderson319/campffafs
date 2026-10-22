import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, School as SchoolIcon, Users, Trophy, SlidersHorizontal, LogOut, ExternalLink } from 'lucide-react';
import { ADMIN_SECTIONS, ROUTES } from '../config/routes';
import { useAuth } from '../features/auth/authContext';
import { subscribeSchools } from '../services/schools/schoolService';
import { useSubscription } from '../hooks/useSubscription';
import type { School } from '../types';
import { friendlyError } from '../utils/errors';
import { ErrorBlock, LoadingBlock } from '../components/ui/StateBlock';
import { Button } from '../components/ui/Button';
import { AppFooter } from '../components/ui/AppFooter';

interface Ctx {
  schools: School[];
  schoolId: string | null;
  school: School | null;
  setSchoolId: (id: string) => void;
}
const SchoolCtx = createContext<Ctx | null>(null);
export function useSelectedSchool(): Ctx {
  const c = useContext(SchoolCtx);
  if (!c) throw new Error('useSelectedSchool requer AdminLayout');
  return c;
}

const NAV = [
  { to: ROUTES.adminSection(ADMIN_SECTIONS.overview), label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: ROUTES.adminSection(ADMIN_SECTIONS.schools), label: 'Escolas', icon: SchoolIcon },
  { to: ROUTES.adminSection(ADMIN_SECTIONS.teams), label: 'Equipes', icon: Users },
  { to: ROUTES.adminSection(ADMIN_SECTIONS.championships), label: 'Campeonatos', icon: Trophy },
  { to: ROUTES.adminSection(ADMIN_SECTIONS.scoring), label: 'Pontuação', icon: SlidersHorizontal },
];

export function AdminLayout() {
  const auth = useAuth();
  const { data, loading, error } = useSubscription<School[]>((e, f) => subscribeSchools({ publishedOnly: false }, e, f), []);
  const [selected, setSelected] = useState<string | null>(null);
  const schools = data ?? [];

  // Mantém a seleção válida (ex.: escola excluída) e escolhe a primeira por padrão.
  useEffect(() => {
    if (!data) return;
    if (!selected || !data.some((s) => s.id === selected)) setSelected(data[0]?.id ?? null);
  }, [data, selected]);

  const value = useMemo<Ctx>(
    () => ({ schools, schoolId: selected, school: schools.find((s) => s.id === selected) ?? null, setSchoolId: setSelected }),
    [schools, selected],
  );

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand">Painel do campeonato</div>
        <nav aria-label="Navegação administrativa">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin-side-foot">
          <a className="nav-link" href={ROUTES.publicHome} target="_blank" rel="noreferrer">
            <ExternalLink size={18} aria-hidden /><span>Ver site público</span>
          </a>
          <span className="muted small user-email">{auth.user?.email}</span>
          <Button variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={() => void auth.signOut()}>Sair</Button>
        </div>
      </aside>
      <main className="admin-main">
        {loading && <LoadingBlock label="Carregando painel…" />}
        {!loading && error != null && <ErrorBlock message={friendlyError(error)} />}
        {!loading && !error && (
          <SchoolCtx.Provider value={value}>
            <Outlet />
          </SchoolCtx.Provider>
        )}
      </main>
      <AppFooter />
    </div>
  );
}

/** Seletor de escola reutilizado nas telas que operam sobre uma escola. */
export function SchoolPicker() {
  const { schools, schoolId, setSchoolId } = useSelectedSchool();
  if (schools.length === 0) return null;
  return (
    <label className="field inline">
      <span>Escola</span>
      <select value={schoolId ?? ''} onChange={(e) => setSchoolId(e.target.value)}>
        {schools.map((s) => (
          <option key={s.id} value={s.id}>{s.name}{s.published ? '' : ' (oculta)'}</option>
        ))}
      </select>
    </label>
  );
}
