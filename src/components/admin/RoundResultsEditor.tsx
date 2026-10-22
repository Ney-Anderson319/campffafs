import { useMemo, useState } from 'react';
import type { Championship, Round, RoundResult, Team } from '../../types';
import { calcResultPoints, isResultComplete, validateRoundResults, type ValidationIssue } from '../../features/scoring/engine';
import { saveRoundResults, type ResultDraft } from '../../services/rounds/roundService';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Logo } from '../ui/Logo';
import { useToast } from '../ui/Feedback';
import { useAction } from '../../hooks/useAction';
import { friendlyError } from '../../utils/errors';
import { formatNumber } from '../../utils/format';

interface Row {
  participates: boolean;
  position: string;
  kills: string;
  extras: Record<string, string>;
}

const toNum = (s: string): number | null => (s.trim() === '' ? null : Number(s));
const str = (n: number | null | undefined) => (n == null ? '' : String(n));

interface Props {
  schoolId: string;
  round: Round;
  championship: Championship;
  teams: Team[];
  results: RoundResult[];
}

/** Tabela única para lançar posição, abates e extras de todas as equipes de uma queda. */
export function RoundResultsEditor({ schoolId, round, championship, teams, results }: Props) {
  const rules = championship.rules;
  const extras = rules.extras.filter((e) => e.enabled);
  const locked = round.status === 'finished';
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const byTeam = new Map(results.map((r) => [r.teamId, r]));
    const anyResult = results.length > 0;
    return Object.fromEntries(
      teams.map((t) => {
        const r = byTeam.get(t.id);
        return [t.id, { participates: anyResult ? !!r : true, position: str(r?.position), kills: str(r?.kills), extras: Object.fromEntries(extras.map((e) => [e.id, str(r?.extras?.[e.id])])) }];
      }),
    );
  });
  const [message, setMessage] = useState<string | null>(null);
  const toast = useToast();
  const { run, busy } = useAction();

  const drafts: ResultDraft[] = useMemo(
    () =>
      teams.filter((t) => rows[t.id]?.participates).map((t) => {
        const r = rows[t.id];
        const ex: Record<string, number> = {};
        for (const e of extras) {
          const v = toNum(r.extras[e.id] ?? '');
          if (v !== null) ex[e.id] = v;
        }
        return { teamId: t.id, position: toNum(r.position), kills: toNum(r.kills), extras: ex };
      }),
    [rows, teams, extras],
  );
  const validation = useMemo(() => validateRoundResults(rules, drafts, teams.map((t) => t.id)), [rules, drafts, teams]);
  const issuesFor = (teamId: string): ValidationIssue[] => [...validation.errors, ...validation.incomplete].filter((i) => i.teamId === teamId);

  const update = (teamId: string, patch: Partial<Row>) => {
    setMessage(null);
    setRows((p) => ({ ...p, [teamId]: { ...p[teamId], ...patch } }));
  };

  const save = () =>
    run(async () => {
      try {
        const removed = teams.filter((t) => !rows[t.id]?.participates).map((t) => t.id);
        const { incomplete } = await saveRoundResults(schoolId, round.id, rules, teams, drafts, removed);
        toast.success(incomplete > 0 ? `Salvo. ${incomplete} resultado(s) incompleto(s) não entram nos totais.` : 'Resultados salvos.');
        setMessage(null);
      } catch (e) {
        setMessage(friendlyError(e));
      }
    });

  const nParticipants = drafts.length;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Resultados — {round.name}</h2>
          <p className="muted small">{nParticipants} equipe(s) participando. Posições de 1 a {nParticipants}{rules.allowDuplicatePositions ? ' (repetidas permitidas)' : ', sem repetir'}.</p>
        </div>
        {locked && <Badge tone="success">Finalizada · reabra para editar</Badge>}
      </div>
      {teams.length === 0 ? (
        <p className="muted">Cadastre equipes para lançar resultados.</p>
      ) : (
        <div className="table-wrap" tabIndex={0}>
          <table className="editor">
            <thead>
              <tr>
                <th>Participa</th>
                <th>Equipe</th>
                <th>Posição</th>
                <th>Abates</th>
                {extras.map((e) => <th key={e.id}>{e.name}</th>)}
                <th className="num">Pontos</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const r = rows[t.id];
                const draft = drafts.find((d) => d.teamId === t.id);
                const issues = issuesFor(t.id);
                const invalid = issues.filter((i) => i.kind === 'invalid');
                const complete = !!draft && isResultComplete(rules, draft) && invalid.length === 0;
                const pts = draft && complete ? calcResultPoints(rules, draft).total : null;
                const bad = (f: string) => invalid.some((i) => i.field === f);
                return (
                  <tr key={t.id} className={r.participates ? '' : 'dim'}>
                    <td><input type="checkbox" aria-label={`${t.name} participa`} checked={r.participates} disabled={locked} onChange={(e) => update(t.id, { participates: e.target.checked })} /></td>
                    <td><span className="team-cell"><Logo url={t.logoUrl} name={t.name} size={26} />{t.name}</span></td>
                    <td><input className="num-input" inputMode="numeric" aria-label={`Posição de ${t.name}`} aria-invalid={bad('position')} disabled={locked || !r.participates} value={r.position} onChange={(e) => update(t.id, { position: e.target.value })} /></td>
                    <td><input className="num-input" inputMode="numeric" aria-label={`Abates de ${t.name}`} aria-invalid={bad('kills')} disabled={locked || !r.participates} value={r.kills} onChange={(e) => update(t.id, { kills: e.target.value })} /></td>
                    {extras.map((e) => (
                      <td key={e.id}><input className="num-input" inputMode="numeric" aria-label={`${e.name} de ${t.name}`} aria-invalid={bad(`extra:${e.id}`)} disabled={locked || !r.participates} value={r.extras[e.id] ?? ''} onChange={(ev) => update(t.id, { extras: { ...r.extras, [e.id]: ev.target.value } })} /></td>
                    ))}
                    <td className="num"><strong>{pts == null ? '—' : formatNumber(pts)}</strong></td>
                    <td className="small">
                      {!r.participates ? <span className="muted">Fora da queda</span> : invalid.length > 0 ? <span className="field-error">{invalid[0].message}</span> : complete ? <Badge tone="success">Completo</Badge> : <Badge tone="warn">Incompleto</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {message && <p className="field-error" role="alert">{message}</p>}
      {!locked && teams.length > 0 && (
        <div className="panel-foot">
          <Button busy={busy} disabled={validation.errors.length > 0} onClick={() => void save()}>Salvar resultados</Button>
          {validation.errors.length > 0 && <span className="field-error small">Corrija os campos destacados para salvar.</span>}
        </div>
      )}
    </section>
  );
}
