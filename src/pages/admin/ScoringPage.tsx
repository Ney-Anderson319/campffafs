import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { SchoolPicker, useSelectedSchool } from '../../layouts/AdminLayout';
import { useChampionshipData } from '../../hooks/useChampionshipData';
import { saveRules } from '../../services/championships/championshipService';
import type { Championship, ScoringRules } from '../../types';
import { computeTheoreticalMax, validateRules } from '../../features/scoring/engine';
import { TIEBREAKER_LABELS } from '../../features/scoring/defaults';
import { Button } from '../../components/ui/Button';
import { PromptModal } from '../../components/admin/PromptModal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ui/StateBlock';
import { useConfirm, useToast } from '../../components/ui/Feedback';
import { useAction } from '../../hooks/useAction';
import { friendlyError } from '../../utils/errors';
import { formatNumber } from '../../utils/format';

export function ScoringPage() {
  const { schoolId, school, schools } = useSelectedSchool();
  const data = useChampionshipData(schoolId, 'admin');
  if (schools.length === 0) return <EmptyBlock title="Cadastre uma escola primeiro" />;
  const c = data.championship;
  return (
    <>
      <div className="page-head"><h1>Configurações de pontuação</h1><SchoolPicker /></div>
      {data.loading && <LoadingBlock />}
      {!data.loading && data.error != null && <ErrorBlock message={friendlyError(data.error)} />}
      {!data.loading && !data.error && school && !c && <EmptyBlock title="Campeonato ainda não criado" message="Crie o campeonato em “Campeonatos” para configurar a pontuação." />}
      {!data.loading && !data.error && c && c.format === 'knockout' && (
        <EmptyBlock title="Este campeonato é mata-mata" message="As regras de pontuação valem apenas para o formato por pontos. No mata-mata, o formato da série (melhor de 1, 3, 5 ou 7) é definido em cada confronto." />
      )}
      {!data.loading && !data.error && c && c.format === 'points' && schoolId && (
        <RulesForm key={`${schoolId}-${c.updatedAt?.getTime() ?? 0}`} schoolId={schoolId} championship={c} hasResults={Object.values(data.resultsByRound).some((r) => r.length > 0)} />
      )}
    </>
  );
}

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s));
const show = (n: number | null) => (n == null ? '' : String(n));

function RulesForm({ schoolId, championship, hasResults }: { schoolId: string; championship: Championship; hasResults: boolean }) {
  const [rules, setRules] = useState<ScoringRules>(() => structuredClone(championship.rules));
  const [message, setMessage] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const { run, busy } = useAction();
  const errors = useMemo(() => validateRules(rules), [rules]);
  const max = useMemo(() => computeTheoreticalMax(rules), [rules]);
  const set = (fn: (r: ScoringRules) => void) => {
    setMessage(null);
    setRules((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  const save = () =>
    run(async () => {
      if (errors.length) return setMessage(errors[0]);
      if (hasResults) {
        const ok = await confirm({
          title: 'Recalcular pontuações publicadas?',
          confirmLabel: 'Salvar e recalcular',
          tone: 'danger',
          message: 'Já existem resultados lançados. Ao salvar, TODOS os totais e a classificação (inclusive os publicados) serão recalculados imediatamente com as novas regras. Os resultados em si (posições e abates) não mudam.',
        });
        if (!ok) return;
      }
      try {
        await saveRules(schoolId, rules);
        toast.success('Regras salvas.');
      } catch (e) {
        setMessage(friendlyError(e));
      }
    });

  const [askCount, setAskCount] = useState(false);
  const fillTable = async (value: string) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('Informe um número inteiro de 1 a 100.');
    set((r) => {
      const old = new Map(r.placement.table.map((e) => [e.position, e.points]));
      r.placement.table = Array.from({ length: n }, (_, i) => ({ position: i + 1, points: old.get(i + 1) ?? 0 }));
    });
  };

  return (
    <form className="stack-lg" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {hasResults && <p className="notice">Há resultados lançados: alterar as regras recalcula a classificação, inclusive a pública.</p>}

      <section className="panel">
        <div className="panel-head">
          <h2>Pontos por colocação</h2>
          <label className="check"><input type="checkbox" checked={rules.placement.enabled} onChange={(e) => set((r) => { r.placement.enabled = e.target.checked; })} />Ativado</label>
        </div>
        {rules.placement.enabled && (
          <>
            <div className="placement-grid">
              {rules.placement.table.map((entry, i) => (
                <div key={i} className="placement-row">
                  <label><span className="muted small">Posição</span>
                    <input className="num-input" inputMode="numeric" value={entry.position} onChange={(e) => set((r) => { r.placement.table[i].position = Number(e.target.value); })} /></label>
                  <label><span className="muted small">Pontos</span>
                    <input className="num-input" inputMode="decimal" value={entry.points} onChange={(e) => set((r) => { r.placement.table[i].points = Number(e.target.value); })} /></label>
                  <button type="button" className="icon-btn" aria-label={`Remover posição ${entry.position}`} onClick={() => set((r) => { r.placement.table.splice(i, 1); })}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <div className="row-actions">
              <Button size="sm" variant="subtle" icon={<Plus size={16} />} onClick={() => set((r) => { const next = r.placement.table.reduce((m, e) => Math.max(m, e.position), 0) + 1; r.placement.table.push({ position: next, points: 0 }); })}>Adicionar posição</Button>
              <Button size="sm" variant="ghost" onClick={() => setAskCount(true)}>Definir quantidade de posições</Button>
            </div>
            <p className="muted small">Posições que não estiverem na tabela valem 0 ponto.</p>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Pontos por abates</h2>
          <label className="check"><input type="checkbox" checked={rules.kills.enabled} onChange={(e) => set((r) => { r.kills.enabled = e.target.checked; })} />Ativado</label>
        </div>
        {rules.kills.enabled && (
          <div className="grid-2">
            <label className="field"><span>Pontos por abate</span>
              <input inputMode="decimal" value={rules.kills.pointsPerKill} onChange={(e) => set((r) => { r.kills.pointsPerKill = Number(e.target.value); })} /></label>
            <label className="field"><span>Máximo de abates por queda (opcional)</span>
              <input inputMode="numeric" value={show(rules.kills.maxPerRound)} onChange={(e) => set((r) => { r.kills.maxPerRound = numOrNull(e.target.value); })} /></label>
          </div>
        )}
        <p className="muted small">Os abates são sempre registrados; esta opção define se valem pontos no total.</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Componentes adicionais</h2>
          <Button size="sm" variant="subtle" icon={<Plus size={16} />} onClick={() => set((r) => { r.extras.push({ id: `extra_${Date.now().toString(36)}`, name: 'Novo componente', enabled: true, pointsPerUnit: 1, maxPerRound: null }); })}>Adicionar</Button>
        </div>
        {rules.extras.length === 0 && <p className="muted">Nenhum componente adicional. Use para bônus como “Booyah” ou “Dano”.</p>}
        {rules.extras.map((x, i) => (
          <div key={x.id} className="extra-row">
            <label className="check"><input type="checkbox" checked={x.enabled} onChange={(e) => set((r) => { r.extras[i].enabled = e.target.checked; })} />Ativo</label>
            <label className="field"><span>Nome</span><input value={x.name} maxLength={40} onChange={(e) => set((r) => { r.extras[i].name = e.target.value; })} /></label>
            <label className="field"><span>Pontos por unidade</span><input inputMode="decimal" value={x.pointsPerUnit} onChange={(e) => set((r) => { r.extras[i].pointsPerUnit = Number(e.target.value); })} /></label>
            <label className="field"><span>Máx. por queda</span><input inputMode="numeric" value={show(x.maxPerRound)} onChange={(e) => set((r) => { r.extras[i].maxPerRound = numOrNull(e.target.value); })} /></label>
            <button type="button" className="icon-btn" aria-label={`Remover ${x.name}`} onClick={() => set((r) => { r.extras.splice(i, 1); })}><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Classificação e desempate</h2>
        <p className="muted small">A ordem é a prioridade. Desative o que não quiser usar. Se ainda houver empate, ele é mantido (mesma posição).</p>
        <ol className="tiebreakers">
          {rules.tiebreakers.map((t, i) => (
            <li key={t.key}>
              <label className="check"><input type="checkbox" checked={t.enabled} onChange={(e) => set((r) => { r.tiebreakers[i].enabled = e.target.checked; })} />{TIEBREAKER_LABELS[t.key]}</label>
              <span className="row-actions">
                <button type="button" className="icon-btn" disabled={i === 0} aria-label="Subir prioridade" onClick={() => set((r) => { [r.tiebreakers[i - 1], r.tiebreakers[i]] = [r.tiebreakers[i], r.tiebreakers[i - 1]]; })}><ArrowUp size={16} /></button>
                <button type="button" className="icon-btn" disabled={i === rules.tiebreakers.length - 1} aria-label="Descer prioridade" onClick={() => set((r) => { [r.tiebreakers[i + 1], r.tiebreakers[i]] = [r.tiebreakers[i], r.tiebreakers[i + 1]]; })}><ArrowDown size={16} /></button>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <h2>Quedas, encerramento e campeão</h2>
        <div className="grid-2">
          <label className="field"><span>Quedas planejadas</span>
            <input inputMode="numeric" value={rules.plannedRounds} onChange={(e) => set((r) => { r.plannedRounds = Number(e.target.value); })} /></label>
          <label className="field"><span>Condição de encerramento</span>
            <select value={rules.closing.condition} onChange={(e) => set((r) => { r.closing.condition = e.target.value as ScoringRules['closing']['condition']; })}>
              <option value="manual">Manual (o administrador finaliza)</option>
              <option value="plannedRounds">Ao finalizar todas as quedas planejadas</option>
              <option value="targetScore">Quando alguém atingir a pontuação-alvo</option>
            </select></label>
          {rules.closing.condition === 'targetScore' && (
            <label className="field"><span>Pontuação-alvo</span>
              <input inputMode="numeric" value={show(rules.closing.targetScore)} onChange={(e) => set((r) => { r.closing.targetScore = numOrNull(e.target.value); })} /></label>
          )}
          <label className="field"><span>Quem é o campeão</span>
            <select value={rules.closing.championRule} onChange={(e) => set((r) => { r.closing.championRule = e.target.value as ScoringRules['closing']['championRule']; })}>
              <option value="standings">Líder da classificação final</option>
              <option value="manual">Definido manualmente</option>
            </select></label>
        </div>
        <p className="muted small">A condição de encerramento apenas sinaliza; o campeonato só termina quando você o finaliza, e o campeão sai da regra escolhida (atingir a pontuação-alvo não coroa ninguém sozinho).</p>
        <label className="check"><input type="checkbox" checked={rules.allowDuplicatePositions} onChange={(e) => set((r) => { r.allowDuplicatePositions = e.target.checked; })} />Permitir posições repetidas numa queda</label>
        <p className="max-box">
          {max.value != null ? <>Pontuação máxima teórica: <strong>{formatNumber(max.value)}</strong> pontos.</> : <>Pontuação máxima teórica indisponível: {max.reason}</>}
        </p>
      </section>

      {(errors.length > 0 || message) && <ul className="field-error" role="alert">{(message ? [message] : errors).map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="panel-foot"><Button type="submit" busy={busy} disabled={errors.length > 0}>Salvar regras</Button></div>
      {askCount && <PromptModal title="Quantidade de posições" label="Quantas posições a tabela deve ter?" initial={String(rules.placement.table.length || 12)} confirmLabel="Aplicar" onSubmit={fillTable} onClose={() => setAskCount(false)} />}
    </form>
  );
}
