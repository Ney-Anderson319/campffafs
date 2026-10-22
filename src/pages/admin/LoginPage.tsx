import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../features/auth/authContext';
import { Button } from '../../components/ui/Button';
import { LoadingBlock } from '../../components/ui/StateBlock';
import { AppFooter } from '../../components/ui/AppFooter';
import { authErrorMessage } from '../../utils/errors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  if (auth.status === 'loading') {
    return (
      <div className="login-page">
        <main className="login-wrap"><LoadingBlock label="Verificando sessão…" /></main>
        <AppFooter />
      </div>
    );
  }
  if (auth.status === 'admin' || auth.status === 'not_admin') {
    // not_admin é tratado pelo RequireAdmin (mensagem de acesso negado)
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from?.startsWith(ROUTES.adminLogin) ? from : ROUTES.adminDashboard} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Informe um e-mail válido.';
    if (password.length < 6) next.password = 'A senha deve ter pelo menos 6 caracteres.';
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    try {
      await auth.signIn(email, password, remember);
    } catch (err) {
      setErrors({ form: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <main className="login-wrap">
        <form className="login-card" onSubmit={submit} noValidate>
          <ShieldCheck size={32} aria-hidden className="login-icon" />
          <h1 className="h2">Acesso administrativo</h1>
          {auth.notice && <p className="notice" role="alert">{auth.notice}</p>}
          {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
          <label className="field">
            <span>E-mail</span>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
            {errors.email && <small className="field-error">{errors.email}</small>}
          </label>
          <label className="field">
            <span>Senha</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
            {errors.password && <small className="field-error">{errors.password}</small>}
          </label>
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Manter conectado neste dispositivo
          </label>
          <Button type="submit" busy={busy}>Entrar</Button>
        </form>
      </main>
      <AppFooter />
    </div>
  );
}
