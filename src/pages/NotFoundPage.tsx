import { Link } from 'react-router-dom';
import { ROUTES } from '../config/routes';

export function NotFoundPage({ message = 'A página que você procura não existe.' }: { message?: string }) {
  return (
    <div className="state-block" role="alert">
      <h1 className="h2">Página não encontrada</h1>
      <p>{message}</p>
      <Link className="btn btn-primary btn-md" to={ROUTES.publicHome}>Voltar ao início</Link>
    </div>
  );
}
