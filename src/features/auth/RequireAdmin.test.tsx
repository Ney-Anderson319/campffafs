import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type AuthState } from './authContext';
import { RequireAdmin } from './RequireAdmin';
import { ROUTES } from '../../config/routes';

function renderAt(state: Partial<AuthState>) {
  const value: AuthState = {
    status: 'signed_out',
    user: null,
    notice: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
    clearNotice: vi.fn(),
    ...state,
  };
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[ROUTES.adminDashboard]}>
        <Routes>
          <Route path={ROUTES.adminLogin} element={<div>Tela de login</div>} />
          <Route element={<RequireAdmin />}>
            <Route path={ROUTES.adminDashboard} element={<div>Painel secreto</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('proteção das rotas administrativas', () => {
  it('redireciona visitante não autenticado para o login', () => {
    renderAt({ status: 'signed_out' });
    expect(screen.getByText('Tela de login')).toBeInTheDocument();
    expect(screen.queryByText('Painel secreto')).not.toBeInTheDocument();
  });
  it('mostra carregamento enquanto verifica a sessão (sem vazar o painel)', () => {
    renderAt({ status: 'loading' });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Painel secreto')).not.toBeInTheDocument();
  });
  it('bloqueia usuário autenticado sem permissão de administrador', () => {
    renderAt({ status: 'not_admin', user: { uid: 'u1', email: 'aluno@escola.com' } });
    expect(screen.getByText(/sem permissão de administrador/i)).toBeInTheDocument();
    expect(screen.queryByText('Painel secreto')).not.toBeInTheDocument();
  });
  it('libera o painel apenas para administradores', () => {
    renderAt({ status: 'admin', user: { uid: 'u2', email: 'admin@escola.com' } });
    expect(screen.getByText('Painel secreto')).toBeInTheDocument();
  });
});
