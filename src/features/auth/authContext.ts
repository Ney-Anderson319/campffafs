import { createContext, useContext } from 'react';
import type { AdminUser } from '../../types';

export type AuthStatus = 'loading' | 'signed_out' | 'not_admin' | 'admin';

export interface AuthState {
  status: AuthStatus;
  user: AdminUser | null;
  /** Mensagem exibida no login (ex.: sessão expirada). */
  notice: string | null;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  /** Força a renovação do token (após receber a permissão de administrador). */
  refresh: () => Promise<void>;
  clearNotice: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return ctx;
}
