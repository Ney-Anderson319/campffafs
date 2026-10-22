import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_SECTIONS, ROUTES } from '../config/routes';
import { AuthProvider } from '../features/auth/AuthProvider';
import { RequireAdmin } from '../features/auth/RequireAdmin';
import { FeedbackProvider } from '../components/ui/Feedback';
import { PublicLayout } from '../layouts/PublicLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { HomePage } from '../pages/public/HomePage';
import { SchoolPage } from '../pages/public/SchoolPage';
import { LoginPage } from '../pages/admin/LoginPage';
import { OverviewPage } from '../pages/admin/OverviewPage';
import { SchoolsPage } from '../pages/admin/SchoolsPage';
import { TeamsPage } from '../pages/admin/TeamsPage';
import { ChampionshipPage } from '../pages/admin/ChampionshipPage';
import { ScoringPage } from '../pages/admin/ScoringPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { isFirebaseConfigured, missingEnvVars } from '../services/firebase/client';

function ConfigError() {
  return (
    <div className="state-block state-error" role="alert">
      <h1 className="h2">Firebase não configurado</h1>
      <p>Crie o arquivo <code>.env</code> a partir de <code>.env.example</code> e preencha:</p>
      <ul>{missingEnvVars.map((v) => <li key={v}><code>{v}</code></li>)}</ul>
      <p>Depois reinicie o servidor (<code>npm run dev</code>) ou gere o build novamente.</p>
    </div>
  );
}

export function App() {
  if (!isFirebaseConfigured) return <ConfigError />;
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <AuthProvider>
          <Routes>
            <Route path={ROUTES.root} element={<Navigate to={ROUTES.publicHome} replace />} />
            <Route element={<PublicLayout />}>
              <Route path={ROUTES.publicHome} element={<HomePage />} />
              <Route path={ROUTES.publicSchoolPattern} element={<SchoolPage />} />
            </Route>
            <Route path={ROUTES.adminLogin} element={<LoginPage />} />
            <Route element={<RequireAdmin />}>
              <Route path={ROUTES.adminDashboard} element={<AdminLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path={ADMIN_SECTIONS.schools} element={<SchoolsPage />} />
                <Route path={ADMIN_SECTIONS.teams} element={<TeamsPage />} />
                <Route path={ADMIN_SECTIONS.championships} element={<ChampionshipPage />} />
                <Route path={ADMIN_SECTIONS.scoring} element={<ScoringPage />} />
              </Route>
            </Route>
            <Route path="*" element={<div className="public-shell"><main className="public-main"><NotFoundPage /></main></div>} />
          </Routes>
        </AuthProvider>
      </FeedbackProvider>
    </BrowserRouter>
  );
}
