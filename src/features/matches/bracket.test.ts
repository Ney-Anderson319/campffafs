import { describe, expect, it } from 'vitest';
import { computeOutcome, planFinish, planReopen, validateMatchDraft } from './bracket';
import type { Match } from '../../types';

const m = (over: Partial<Match> & { id: string }): Match => ({
  schoolId: 's',
  stageId: 'qf',
  label: over.id,
  order: 1,
  teamAId: null,
  teamBId: null,
  sourceA: null,
  sourceB: null,
  bestOf: 1,
  games: [],
  scoreA: null,
  scoreB: null,
  status: 'waiting',
  winnerId: null,
  isBye: false,
  createdAt: null,
  updatedAt: null,
  ...over,
});

const stages = [
  { id: 'qf', order: 1 },
  { id: 'sf', order: 2 },
  { id: 'f', order: 3 },
];

describe('resultado do confronto', () => {
  it('melhor de 1: vence quem tem mais pontos', () => {
    const o = computeOutcome(m({ id: 'x', teamAId: 'a', teamBId: 'b', games: [{ a: 20, b: 31 }] }));
    expect(o).toMatchObject({ decided: true, winnerId: 'b', scoreA: 20, scoreB: 31 });
  });
  it('empate não define vencedor automaticamente', () => {
    const o = computeOutcome(m({ id: 'x', teamAId: 'a', teamBId: 'b', games: [{ a: 10, b: 10 }] }));
    expect(o.decided).toBe(false);
    expect(o.winnerId).toBeNull();
    expect(o.error).toMatch(/Empate/);
  });
  it('melhor de 3: série decidida em 2 vitórias', () => {
    const o = computeOutcome(
      m({ id: 'x', bestOf: 3, teamAId: 'a', teamBId: 'b', games: [{ a: 5, b: 1 }, { a: 2, b: 9 }, { a: 7, b: 3 }] }),
    );
    expect(o).toMatchObject({ decided: true, winnerId: 'a', scoreA: 2, scoreB: 1 });
  });
  it('série incompleta e partidas após o fim são inválidas', () => {
    const base = { id: 'x', bestOf: 3, teamAId: 'a', teamBId: 'b' };
    expect(computeOutcome(m({ ...base, games: [{ a: 5, b: 1 }] })).decided).toBe(false);
    expect(computeOutcome(m({ ...base, games: [{ a: 5, b: 1 }, { a: 5, b: 1 }, { a: 1, b: 5 }] })).decided).toBe(false);
  });
  it('placares inválidos e sem times', () => {
    expect(computeOutcome(m({ id: 'x', teamAId: 'a', teamBId: 'b', games: [{ a: -1, b: 2 }] })).decided).toBe(false);
    expect(computeOutcome(m({ id: 'x', teamAId: 'a', games: [{ a: 1, b: 2 }] })).decided).toBe(false);
  });
  it('BYE explícito avança o time sem adversário', () => {
    expect(computeOutcome(m({ id: 'x', isBye: true, teamAId: 'a' }))).toMatchObject({ decided: true, winnerId: 'a' });
    expect(computeOutcome(m({ id: 'x', isBye: true, teamAId: 'a', teamBId: 'b' })).decided).toBe(false);
  });
});

describe('validação de estrutura', () => {
  const others = [
    m({ id: 'q1', teamAId: 'a', teamBId: 'b' }),
    m({ id: 'q2', teamAId: 'c', teamBId: 'd' }),
    m({ id: 's1', stageId: 'sf', sourceA: 'q1' }),
  ];
  it('impede time repetido na mesma fase', () => {
    const errs = validateMatchDraft(m({ id: 'q3', teamAId: 'a', teamBId: 'e' }), others, stages);
    expect(errs.some((e) => e.includes('já está'))).toBe(true);
  });
  it('impede avançar o mesmo confronto duas vezes', () => {
    const errs = validateMatchDraft(m({ id: 's2', stageId: 'sf', sourceA: 'q1' }), others, stages);
    expect(errs.some((e) => e.includes('já avança'))).toBe(true);
  });
  it('exige origem em fase anterior', () => {
    const errs = validateMatchDraft(m({ id: 'q9', stageId: 'qf', sourceA: 'q1' }), others, stages);
    expect(errs.some((e) => e.includes('fase anterior'))).toBe(true);
  });
  it('impede time contra si mesmo e BYE com adversário', () => {
    expect(validateMatchDraft(m({ id: 'z', teamAId: 'x', teamBId: 'x' }), [], stages).length).toBeGreaterThan(0);
    expect(validateMatchDraft(m({ id: 'z', isBye: true, teamAId: 'x', teamBId: 'y' }), [], stages).length).toBeGreaterThan(0);
  });
});

describe('avanço de fase', () => {
  const tree = (): Match[] => [
    m({ id: 'q1', teamAId: 'a', teamBId: 'b', games: [{ a: 3, b: 1 }] }),
    m({ id: 'q2', teamAId: 'c', teamBId: 'd', games: [{ a: 0, b: 4 }] }),
    m({ id: 's1', stageId: 'sf', sourceA: 'q1', sourceB: 'q2' }),
    m({ id: 'f1', stageId: 'f', sourceA: 's1' }),
  ];

  it('rejeita finalizar resultado inválido', () => {
    const t = tree();
    t[0].games = [{ a: 2, b: 2 }];
    const r = planFinish(t, 'q1');
    expect(r.ok).toBe(false);
  });

  it('finaliza e preenche o próximo confronto', () => {
    const r = planFinish(tree(), 'q1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.updates.q1).toMatchObject({ status: 'finished', winnerId: 'a' });
    expect(r.updates.s1).toMatchObject({ teamAId: 'a' });
  });

  it('final (sem próximo) apenas registra o campeão', () => {
    const t = tree();
    t[3] = { ...t[3], teamAId: 'a', teamBId: 'd', games: [{ a: 1, b: 0 }] };
    const r = planFinish(t, 'f1');
    expect(r.ok && Object.keys(r.updates)).toEqual(['f1']);
  });

  function advancedTree(): Match[] {
    const t = tree();
    t[0] = { ...t[0], status: 'finished', winnerId: 'a', scoreA: 3, scoreB: 1 };
    t[1] = { ...t[1], status: 'finished', winnerId: 'd', scoreA: 0, scoreB: 4 };
    t[2] = { ...t[2], teamAId: 'a', teamBId: 'd', games: [{ a: 9, b: 2 }], status: 'finished', winnerId: 'a', scoreA: 9, scoreB: 2 };
    t[3] = { ...t[3], teamAId: 'a' };
    return t;
  }

  it('corrigir placar sem trocar o vencedor preserva fases seguintes', () => {
    const t = advancedTree();
    t[0] = { ...t[0], games: [{ a: 10, b: 1 }] };
    const r = planFinish(t, 'q1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.updates)).toEqual(['q1']);
  });

  it('trocar o vencedor depois da próxima fase preenchida exige confirmação', () => {
    const t = advancedTree();
    t[0] = { ...t[0], games: [{ a: 1, b: 8 }] }; // agora b vence q1
    const r = planFinish(t, 'q1');
    expect(r.ok).toBe(false);
    if (r.ok || !r.needsConfirmation) throw new Error('esperava confirmação');
    expect(r.affected.map((x) => x.id)).toContain('s1');
  });

  it('com confirmação, reinicia dependentes de forma consistente', () => {
    const t = advancedTree();
    t[0] = { ...t[0], games: [{ a: 1, b: 8 }] };
    const r = planFinish(t, 'q1', { confirmReset: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.updates.q1).toMatchObject({ winnerId: 'b' });
    expect(r.updates.s1).toMatchObject({ teamAId: 'b', status: 'waiting', winnerId: null, games: [] });
    expect(r.updates.f1).toMatchObject({ teamAId: null });
  });

  it('impede o mesmo time em dois confrontos da mesma fase', () => {
    const t = tree();
    t.push(m({ id: 's2', stageId: 'sf', teamAId: 'a', teamBId: 'z' }));
    const r = planFinish(t, 'q1');
    expect(r.ok).toBe(false);
  });

  it('reabrir limpa o slot seguinte (com confirmação quando há progresso)', () => {
    const t = advancedTree();
    const need = planReopen(t, 'q1');
    expect(need.ok).toBe(false);
    const ok = planReopen(t, 'q1', { confirmReset: true });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.updates.q1).toMatchObject({ status: 'in_progress', winnerId: null });
    expect(ok.updates.s1).toMatchObject({ teamAId: null, status: 'waiting' });
  });

  it('reabrir confronto não finalizado é erro', () => {
    expect(planReopen(tree(), 'q1').ok).toBe(false);
  });
});
