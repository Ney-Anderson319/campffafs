import { describe, expect, it } from 'vitest';
import {
  calcResultPoints,
  computeStandings,
  computeTheoreticalMax,
  getChampion,
  getClosingStatus,
  isResultComplete,
  placementPointsFor,
  validateRoundResults,
  validateRules,
} from './engine';
import { createDefaultRules } from './defaults';
import type { RoundResult, ScoringRules } from '../../types';

const rules = (over: Partial<ScoringRules> = {}): ScoringRules => ({ ...createDefaultRules(), ...over });
const res = (teamId: string, position: number | null, kills: number | null, extras: Record<string, number> = {}): RoundResult => ({
  id: teamId,
  teamId,
  position,
  kills,
  extras,
  status: position != null && kills != null ? 'complete' : 'incomplete',
  updatedAt: null,
});
const teams = [
  { id: 'a', name: 'Alfa' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gama' },
];

describe('pontos por colocação', () => {
  it('usa a tabela configurada', () => {
    const r = rules();
    expect(placementPointsFor(r, 1)).toBe(12);
    expect(placementPointsFor(r, 2)).toBe(9);
  });
  it('posição fora da tabela vale zero e posição nula também', () => {
    expect(placementPointsFor(rules(), 50)).toBe(0);
    expect(placementPointsFor(rules(), null)).toBe(0);
  });
  it('respeita tabela personalizada e zero explícito', () => {
    const r = rules({ placement: { enabled: true, table: [{ position: 1, points: 20 }, { position: 2, points: 0 }] } });
    expect(placementPointsFor(r, 1)).toBe(20);
    expect(placementPointsFor(r, 2)).toBe(0);
  });
  it('componente desativado não soma', () => {
    const r = rules({ placement: { enabled: false, table: [{ position: 1, points: 12 }] } });
    expect(placementPointsFor(r, 1)).toBe(0);
  });
});

describe('pontos por abates e soma por queda', () => {
  it('multiplica abates pelo valor configurado', () => {
    const r = rules({ kills: { enabled: true, pointsPerKill: 2, maxPerRound: null } });
    expect(calcResultPoints(r, { position: 1, kills: 5, extras: {} }).kills).toBe(10);
  });
  it('total = colocação + abates + extras habilitados', () => {
    const r = rules({
      extras: [
        { id: 'x', name: 'Bônus', enabled: true, pointsPerUnit: 3, maxPerRound: 2 },
        { id: 'y', name: 'Desligado', enabled: false, pointsPerUnit: 100, maxPerRound: 1 },
      ],
    });
    const p = calcResultPoints(r, { position: 2, kills: 4, extras: { x: 2, y: 1 } });
    expect(p.placement).toBe(9);
    expect(p.kills).toBe(4);
    expect(p.extrasTotal).toBe(6);
    expect(p.total).toBe(19);
  });
  it('abates desativados não entram no total', () => {
    const r = rules({ kills: { enabled: false, pointsPerKill: 1, maxPerRound: null } });
    expect(calcResultPoints(r, { position: 1, kills: 9, extras: {} }).total).toBe(12);
  });
});

describe('validação de resultados', () => {
  const ids = ['a', 'b', 'c'];
  it('detecta posições duplicadas', () => {
    const v = validateRoundResults(rules(), [res('a', 1, 0), res('b', 1, 0), res('c', 3, 0)], ids);
    expect(v.errors.some((e) => e.message.includes('duplicada'))).toBe(true);
  });
  it('aceita duplicadas quando a regra permite', () => {
    const v = validateRoundResults(rules({ allowDuplicatePositions: true }), [res('a', 1, 0), res('b', 1, 0)], ids);
    expect(v.errors).toHaveLength(0);
  });
  it('rejeita abates negativos/fracionados e posição fora do intervalo', () => {
    const v = validateRoundResults(rules(), [res('a', 1, -1), res('b', 2, 1.5), res('c', 9, 0)], ids);
    expect(v.errors.length).toBeGreaterThanOrEqual(3);
  });
  it('marca resultados incompletos sem tratá-los como erro', () => {
    const v = validateRoundResults(rules(), [res('a', 1, null), res('b', null, 2)], ids);
    expect(v.errors).toHaveLength(0);
    expect(v.incomplete).toHaveLength(2);
  });
  it('rejeita equipe de outra escola', () => {
    const v = validateRoundResults(rules(), [res('zzz', 1, 0)], ids);
    expect(v.errors[0].message).toMatch(/não pertence/);
  });
  it('exige extras habilitados para completar', () => {
    const r = rules({ extras: [{ id: 'x', name: 'Bônus', enabled: true, pointsPerUnit: 1, maxPerRound: null }] });
    expect(isResultComplete(r, { position: 1, kills: 0, extras: {} })).toBe(false);
    expect(isResultComplete(r, { position: 1, kills: 0, extras: { x: 0 } })).toBe(true);
  });
});

describe('classificação', () => {
  it('acumula resultados entre quedas', () => {
    const rows = computeStandings({
      rules: rules(),
      teams,
      resultsByRound: {
        r1: [res('a', 1, 3), res('b', 2, 1), res('c', 3, 0)],
        r2: [res('a', 3, 0), res('b', 1, 2), res('c', 2, 5)],
      },
    });
    const by = Object.fromEntries(rows.map((r) => [r.teamId, r]));
    expect(by.a.totalPoints).toBe(12 + 3 + 8 + 0); // 23
    expect(by.b.totalPoints).toBe(9 + 1 + 12 + 2); // 24
    expect(by.c.totalPoints).toBe(8 + 0 + 9 + 5); // 22
    expect(rows.map((r) => r.teamId)).toEqual(['b', 'a', 'c']);
    expect(by.a.roundsPlayed).toBe(2);
    expect(by.b.firstPlaces).toBe(1);
  });
  it('ignora resultados incompletos e não conta equipe duas vezes na mesma queda', () => {
    const rows = computeStandings({
      rules: rules(),
      teams,
      resultsByRound: { r1: [res('a', 1, 3), res('a', 1, 3), res('b', null, 4)] },
    });
    expect(rows.find((r) => r.teamId === 'a')!.totalPoints).toBe(15);
    expect(rows.find((r) => r.teamId === 'b')!.totalPoints).toBe(0);
  });
  it('desempata por abates quando os pontos são iguais', () => {
    // a: 9 + 5 = 14, b: 12 + 2 = 14 -> a tem mais abates
    const rows = computeStandings({
      rules: rules(),
      teams: teams.slice(0, 2),
      resultsByRound: { r1: [res('a', 2, 5), res('b', 1, 2)] },
    });
    expect(rows[0].teamId).toBe('a');
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(2);
  });
  it('aplica os critérios na ordem configurada', () => {
    const r = rules({
      tiebreakers: [
        { key: 'totalPoints', enabled: true },
        { key: 'firstPlaces', enabled: true },
        { key: 'totalKills', enabled: true },
        { key: 'placementPoints', enabled: false },
        { key: 'bestRoundPoints', enabled: false },
      ],
    });
    const rows = computeStandings({
      rules: r,
      teams: teams.slice(0, 2),
      resultsByRound: { r1: [res('a', 2, 5), res('b', 1, 2)] },
    });
    expect(rows[0].teamId).toBe('b'); // mais 1º lugares vem antes dos abates
  });
  it('preserva empate quando nenhum critério desempata (posições iguais)', () => {
    const rows = computeStandings({
      rules: rules({ tiebreakers: [{ key: 'totalPoints', enabled: true }] }),
      teams: teams.slice(0, 3),
      resultsByRound: { r1: [res('a', 2, 3), res('b', 3, 4), res('c', 1, 0)] },
    });
    // a: 9+3=12, b: 8+4=12, c: 12+0=12 -> todos empatados
    expect(rows.every((r) => r.rank === 1 && r.tied)).toBe(true);
  });
  it('ranking de competição: 1,1,3', () => {
    const rows = computeStandings({
      rules: rules({ tiebreakers: [{ key: 'totalPoints', enabled: true }] }),
      teams,
      resultsByRound: { r1: [res('a', 1, 0), res('b', 1, 0), res('c', 3, 0)] },
    });
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
    expect(rows[2].tied).toBe(false);
  });
  it('equipes sem jogos aparecem com zero', () => {
    const rows = computeStandings({ rules: rules(), teams, resultsByRound: {} });
    expect(rows.every((r) => r.totalPoints === 0 && r.rank === 1)).toBe(true);
  });
  it('mudança de regra recalcula os totais (derivação)', () => {
    const input = { teams, resultsByRound: { r1: [res('a', 1, 2)] } };
    const before = computeStandings({ ...input, rules: rules() }).find((r) => r.teamId === 'a')!;
    const after = computeStandings({
      ...input,
      rules: rules({ kills: { enabled: true, pointsPerKill: 5, maxPerRound: null } }),
    }).find((r) => r.teamId === 'a')!;
    expect(before.totalPoints).toBe(14);
    expect(after.totalPoints).toBe(22);
  });
});

describe('máximo teórico, encerramento e campeão', () => {
  it('não calcula máximo sem limite de abates', () => {
    const m = computeTheoreticalMax(rules());
    expect(m.value).toBeNull();
  });
  it('calcula quando todos os limites são conhecidos', () => {
    const m = computeTheoreticalMax(rules({ plannedRounds: 4, kills: { enabled: true, pointsPerKill: 1, maxPerRound: 10 } }));
    expect(m.value).toBe((12 + 10) * 4);
  });
  it('não calcula com componente extra sem limite', () => {
    const m = computeTheoreticalMax(
      rules({
        kills: { enabled: false, pointsPerKill: 1, maxPerRound: null },
        extras: [{ id: 'x', name: 'Bônus', enabled: true, pointsPerUnit: 1, maxPerRound: null }],
      }),
    );
    expect(m.value).toBeNull();
  });
  it('pontuação-alvo apenas sinaliza; não define campeão', () => {
    const r = rules({ closing: { condition: 'targetScore', targetScore: 10, championRule: 'standings' } });
    const standings = computeStandings({ rules: r, teams, resultsByRound: { r1: [res('a', 1, 0)] } });
    expect(getClosingStatus(r, 1, standings).met).toBe(true);
    expect(getChampion(r, 'in_progress', standings, null)).toBeNull();
  });
  it('campeão pela classificação só com campeonato finalizado e preserva empate', () => {
    const r = rules({ tiebreakers: [{ key: 'totalPoints', enabled: true }] });
    const standings = computeStandings({ rules: r, teams, resultsByRound: { r1: [res('a', 1, 0), res('b', 1, 0), res('c', 3, 0)] } });
    const champ = getChampion(r, 'finished', standings, null)!;
    expect(champ.tie).toBe(true);
    expect(champ.teamIds.sort()).toEqual(['a', 'b']);
  });
  it('campeão manual usa o time escolhido', () => {
    const r = rules({ closing: { condition: 'manual', targetScore: null, championRule: 'manual' } });
    expect(getChampion(r, 'finished', [], 'c')).toEqual({ teamIds: ['c'], tie: false });
    expect(getChampion(r, 'finished', [], null)).toBeNull();
  });
});

describe('validação das regras', () => {
  it('aceita as regras padrão', () => {
    expect(validateRules(createDefaultRules())).toEqual([]);
  });
  it('rejeita posição duplicada, pontos negativos e quedas inválidas', () => {
    const r = rules({
      placement: { enabled: true, table: [{ position: 1, points: 5 }, { position: 1, points: -2 }] },
      plannedRounds: 0,
    });
    const errs = validateRules(r);
    expect(errs.length).toBeGreaterThanOrEqual(3);
  });
  it('exige ao menos um critério de classificação', () => {
    const r = rules({ tiebreakers: [{ key: 'totalPoints', enabled: false }] });
    expect(validateRules(r).some((e) => e.includes('critério'))).toBe(true);
  });
  it('exige pontuação-alvo quando é a condição de encerramento', () => {
    const r = rules({ closing: { condition: 'targetScore', targetScore: null, championRule: 'standings' } });
    expect(validateRules(r).some((e) => e.includes('pontuação-alvo'))).toBe(true);
  });
});
