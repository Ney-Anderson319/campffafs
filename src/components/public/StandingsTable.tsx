import type { ScoringRules } from '../../types';
import type { StandingRow } from '../../features/scoring/engine';
import { formatNumber } from '../../utils/format';
import { Logo } from '../ui/Logo';

interface Props {
  rules: ScoringRules;
  rows: StandingRow[];
  logos: Record<string, string | null>;
}

export function StandingsTable({ rules, rows, logos }: Props) {
  const extras = rules.extras.filter((e) => e.enabled);
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabela de classificação">
      <table className="standings">
        <thead>
          <tr>
            <th className="col-rank">Pos.</th>
            <th className="col-team">Equipe</th>
            <th className="num">Colocação</th>
            <th className="num">Pts. abates</th>
            {extras.map((e) => (
              <th key={e.id} className="num">{e.name}</th>
            ))}
            <th className="num">Abates</th>
            <th className="num">Quedas</th>
            <th className="num col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.teamId} className={r.rank === 1 && r.roundsPlayed > 0 ? 'leader' : ''}>
              <td className="col-rank">
                <span className={`rank rank-${Math.min(r.rank, 4)}`} title={r.tied ? 'Empate' : undefined}>
                  {r.rank}{r.tied ? '=' : ''}
                </span>
              </td>
              <td className="col-team">
                <span className="team-cell">
                  <Logo url={logos[r.teamId]} name={r.teamName} size={32} />
                  {r.teamName}
                </span>
              </td>
              <td className="num">{formatNumber(r.placementPoints)}</td>
              <td className="num">{formatNumber(r.killPoints)}</td>
              {extras.map((e) => (
                <td key={e.id} className="num">{formatNumber(r.extraPoints[e.id] ?? 0)}</td>
              ))}
              <td className="num">{formatNumber(r.totalKills)}</td>
              <td className="num">{formatNumber(r.roundsPlayed)}</td>
              <td className="num col-total"><strong>{formatNumber(r.totalPoints)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
