const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const number = new Intl.NumberFormat('pt-BR');

export const formatDateTime = (d: Date | null | undefined) => (d ? dateTime.format(d) : '—');
export const formatNumber = (n: number | null | undefined) => (n == null ? '—' : number.format(n));

export const FORMAT_LABEL = { knockout: 'Mata-mata', points: 'Pontuação por quedas' } as const;
export const STATUS_LABEL = {
  not_started: 'Não iniciado',
  in_progress: 'Em andamento',
  finished: 'Finalizado',
} as const;
export const MATCH_STATUS_LABEL = {
  waiting: 'Aguardando',
  in_progress: 'Em andamento',
  finished: 'Finalizado',
} as const;

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}
