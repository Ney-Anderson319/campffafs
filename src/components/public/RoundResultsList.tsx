import type { Round, RoundResult, ScoringRules, Team } from '../../types';
import { calcResultPoints, isResultComplete } from '../../features/scoring/engine';
import { Badge } from '../ui/Badge';
import { Logo } from '../ui/Logo';
import { formatNumber } from '../../utils/format';

interface Props {
  rules: ScoringRules;
  rounds: Round[];
  resultsByRound: Record<string, RoundResult[]>;
  teams: Team[];
}

export function RoundResultsList({ rules, rounds, resultsByRound, teams }: Props) {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const extras = rules.extras.filter((e) => e.enabled);
  if (rounds.length === 0) return null;
  return (
    <div className="rounds">
      {rounds.map((round, i) => {
        const results = [...(resultsByRound[round.id] ?? [])].sort(
          (a, b) => (a.position ?? 999) - (b.position ?? 999),
        );
        return (
          <details key={round.id} className="round-card" open={i === rounds.length - 1}>
            <summary>
              <span className="round-name">{round.name}</span>
              <Badge tone={round.status === 'finished' ? 'success' : 'warn'}>
                {round.status === 'finished' ? 'Finalizada' : 'Em andamento'}
              </Badge>
            </summary>
            {results.length === 0 ? (
              <p className="muted pad">Nenhum resultado lançado nesta queda.</p>
            ) : (
              <div className="table-wrap" tabIndex={0}>
                <table className="standings compact">
                  <thead>
                    <tr>
                      <th className="col-rank">Pos.</th>
                      <th className="col-team">Equipe</th>
                      <th className="num">Abates</th>
                      {rules.placement.enabled && <th className="num">Colocação</th>}
                      {rules.kills.enabled && <th className="num">Pts. abates</th>}
                      {extras.map((e) => <th key={e.id} className="num">{e.name}</th>)}
                      <th className="num col-total">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => {
                      const team = byId.get(r.teamId);
                      const complete = r.status === 'complete' && isResultComplete(rules, r);
                      const p = calcResultPoints(rules, r);
                      return (
                        <tr key={r.id}>
                          <td className="col-rank">{r.position ?? '—'}</td>
                          <td className="col-team">
                            <span className="team-cell">
                              <Logo url={team?.logoUrl} name={team?.name ?? '?'} size={28} />
                              {team?.name ?? 'Equipe removida'}
                              {!complete && <Badge tone="warn">Incompleto</Badge>}
                            </span>
                          </td>
                          <td className="num">{formatNumber(r.kills)}</td>
                          {rules.placement.enabled && <td className="num">{complete ? formatNumber(p.placement) : '—'}</td>}
                          {rules.kills.enabled && <td className="num">{complete ? formatNumber(p.kills) : '—'}</td>}
                          {extras.map((e) => <td key={e.id} className="num">{complete ? formatNumber(p.extras[e.id] ?? 0) : '—'}</td>)}
                          <td className="num col-total"><strong>{complete ? formatNumber(p.total) : '—'}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
