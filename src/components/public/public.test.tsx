import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StandingsTable } from './StandingsTable';
import { BracketView } from './BracketView';
import { computeStandings } from '../../features/scoring/engine';
import { createDefaultRules } from '../../features/scoring/defaults';
import type { Match, RoundResult, Team } from '../../types';

const team = (id: string, name: string): Team => ({ id, schoolId: 's', name, logoUrl: null, logoPath: null, createdAt: null, updatedAt: null });
const teams = [team('a', 'Águias'), team('b', 'Lobos')];
const res = (teamId: string, position: number, kills: number): RoundResult => ({ id: teamId, teamId, position, kills, extras: {}, status: 'complete', updatedAt: null });

describe('tabela de classificação pública', () => {
  it('exibe colunas conforme a configuração e os totais calculados', () => {
    const rules = createDefaultRules();
    const rows = computeStandings({ rules, teams, resultsByRound: { r1: [res('a', 1, 4), res('b', 2, 1)] } });
    render(<StandingsTable rules={rules} rows={rows} logos={{}} />);
    expect(screen.getByText('Colocação')).toBeInTheDocument();
    expect(screen.getByText('Pts. abates')).toBeInTheDocument();
    const row = screen.getByText('Águias').closest('tr')!;
    expect(within(row).getByText('16')).toBeInTheDocument(); // 12 + 4
  });
  it('mantém as colunas de totais mesmo quando um componente de pontuação está desativado', () => {
    const rules = { ...createDefaultRules(), kills: { enabled: false, pointsPerKill: 1, maxPerRound: null } };
    const rows = computeStandings({ rules, teams, resultsByRound: {} });
    render(<StandingsTable rules={rules} rows={rows} logos={{}} />);
    expect(screen.getByText('Colocação')).toBeInTheDocument();
    expect(screen.getByText('Pts. abates')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    const row = screen.getByText('Águias').closest('tr')!;
    expect(within(row).getAllByText('0').length).toBeGreaterThan(0);
  });
});

describe('chaveamento público', () => {
  const m = (over: Partial<Match> & { id: string }): Match => ({ schoolId: 's', stageId: 'f', label: over.id, order: 1, teamAId: null, teamBId: null, sourceA: null, sourceB: null, bestOf: 1, games: [], scoreA: null, scoreB: null, status: 'waiting', winnerId: null, isBye: false, createdAt: null, updatedAt: null, ...over });
  it('mostra vencedor, placar e não cria fases inexistentes', () => {
    render(
      <BracketView
        stages={[{ id: 'f', schoolId: 's', name: 'Final', order: 1, createdAt: null }, { id: 'vazia', schoolId: 's', name: 'Oitavas', order: 0, createdAt: null }]}
        teams={teams}
        matches={[m({ id: 'Final', teamAId: 'a', teamBId: 'b', games: [{ a: 20, b: 10 }], status: 'finished', winnerId: 'a' })]}
      />,
    );
    expect(screen.getByText('Avançou')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.queryByText('Oitavas')).not.toBeInTheDocument();
  });
  it('mostra slot a definir e BYE explícito', () => {
    render(
      <BracketView
        stages={[{ id: 'f', schoolId: 's', name: 'Quartas', order: 1, createdAt: null }]}
        teams={teams}
        matches={[m({ id: 'Q1', label: 'Q1', isBye: true, teamAId: 'a', status: 'finished', winnerId: 'a' }), m({ id: 'Q2', label: 'Q2', order: 2 })]}
      />,
    );
    expect(screen.getByText(/BYE/)).toBeInTheDocument();
    expect(screen.getAllByText('A definir').length).toBe(2);
  });
});
