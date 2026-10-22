/** Converte erros do Firebase/JS em mensagens compreensíveis em português. */
export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'permission-denied') {
    return 'Sem permissão para esta operação. Sua sessão pode ter expirado: saia e entre novamente como administrador.';
  }
  if (code === 'unavailable' || code === 'auth/network-request-failed') {
    return 'Sem conexão com o servidor. Verifique a internet e tente novamente.';
  }
  if (code === 'not-found') return 'Registro não encontrado. Ele pode ter sido removido.';
  if (code === 'resource-exhausted') return 'Limite de uso do Firebase atingido. Tente novamente mais tarde.';
  if (e instanceof Error && e.message) return e.message;
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

export function isPermissionDenied(e: unknown): boolean {
  return (e as { code?: string })?.code === 'permission-denied';
}

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'E-mail ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/network-request-failed':
      return 'Sem conexão com o servidor. Verifique a internet.';
    default:
      return 'Não foi possível entrar. Tente novamente.';
  }
}
