import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useAuth } from './authContext';
import { LoadingBlock } from '../../components/ui/StateBlock';
import { Button } from '../../components/ui/Button';

/** Protege todas as rotas administrativas (a segurança real está nas regras do Firebase). */
export function RequireAdmin() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') return <LoadingBlock label="Verificando sessão…" />;
  if (auth.status === 'signed_out') {
    return <Navigate to={ROUTES.adminLogin} replace state={{ from: location.pathname }} />;
  }
  if (auth.status === 'not_admin') {
    return (
      <div className="state-block" role="alert">
        <h2>Conta sem permissão de administrador</h2>
        <p>
          A conta <strong>{auth.user?.email}</strong> não tem acesso ao painel. Se você acabou de receber a
          permissão, use “Verificar novamente”.
        </p>
        <div className="row">
          <Button onClick={() => void auth.refresh()}>Verificar novamente</Button>
          <Button variant="ghost" onClick={() => void auth.signOut()}>Sair</Button>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
