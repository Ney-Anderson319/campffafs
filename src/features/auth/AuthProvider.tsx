import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onIdTokenChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { getAuthInstance } from '../../services/firebase/client';
import { AuthContext, type AuthState, type AuthStatus } from './authContext';
import type { AdminUser } from '../../types';

/**
 * Autorização: o usuário é administrador SOMENTE se o token contém a Custom Claim `admin: true`,
 * atribuída por script confiável (scripts/set-admin.mjs). O usuário não consegue alterar seu token.
 * Isto é só para a interface; quem protege os dados são as regras do Firestore/Storage.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const evaluate = useCallback(async (u: User | null, force = false) => {
    if (!u) {
      setUser(null);
      setStatus('signed_out');
      return;
    }
    try {
      const token = await u.getIdTokenResult(force);
      setUser({ uid: u.uid, email: u.email });
      setStatus(token.claims.admin === true ? 'admin' : 'not_admin');
    } catch {
      // Token não pôde ser renovado: sessão expirada/revogada.
      setNotice('Sua sessão expirou. Entre novamente.');
      await fbSignOut(getAuthInstance()).catch(() => undefined);
      setUser(null);
      setStatus('signed_out');
    }
  }, []);

  useEffect(() => {
    const unsub = onIdTokenChanged(getAuthInstance(), (u) => void evaluate(u), () => {
      setNotice('Não foi possível verificar sua sessão.');
      setStatus('signed_out');
    });
    return unsub;
  }, [evaluate]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      notice,
      clearNotice: () => setNotice(null),
      async signIn(email, password, remember) {
        const auth = getAuthInstance();
        await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email.trim(), password);
        setNotice(null);
      },
      async signOut() {
        await fbSignOut(getAuthInstance());
      },
      async refresh() {
        await evaluate(getAuthInstance().currentUser, true);
      },
    }),
    [status, user, notice, evaluate],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
