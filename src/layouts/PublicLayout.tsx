import { Link, Outlet } from 'react-router-dom';
import { Swords } from 'lucide-react';
import { ROUTES } from '../config/routes';
import { AppFooter } from '../components/ui/AppFooter';

export function PublicLayout() {
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link to={ROUTES.publicHome} className="brand">
          <Swords size={20} aria-hidden />
          <span>Campeonato de Free Fire AFS</span>
        </Link>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  );
}
