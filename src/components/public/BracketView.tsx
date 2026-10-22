import type { BracketStage, Match, Team } from '../../types';
import { computeOutcome } from '../../features/matches/bracket';
import { MATCH_STATUS_LABEL } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { Logo } from '../ui/Logo';

interface Props {
  stages: BracketStage[];
  matches: Match[];
  teams: Team[];
}

export function BracketView({ stages, matches, teams }: Props) {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const visibleStages = stages.filter((s) => matches.some((m) => m.stageId === s.id));
  return (
    <div className="bracket">
      {visibleStages.map((stage) => (
        <section key={stage.id} className="stage" aria-labelledby={`stage-${stage.id}`}>
          <h3 id={`stage-${stage.id}`} className="stage-title">{stage.name}</h3>
          <div className="stage-matches">
            {matches
              .filter((m) => m.stageId === stage.id)
              .sort((a, b) => a.order - b.order)
              .map((m) => (
                <MatchCard key={m.id} match={m} teamById={teamById} matchById={matchById} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MatchCard({ match: m, teamById, matchById }: { match: Match; teamById: Map<string, Team>; matchById: Map<string, Match> }) {
  const outcome = computeOutcome(m);
  const finished = m.status === 'finished';
  const showScore = !m.isBye && (finished || m.games.length > 0);

  const slot = (teamId: string | null, sourceId: string | null, score: number | null, side: 'A' | 'B') => {
    const team = teamId ? teamById.get(teamId) : null;
    const isWinner = finished && !!teamId && m.winnerId === teamId;
    const isLoser = finished && !!m.winnerId && !!teamId && m.winnerId !== teamId;
    const placeholder = sourceId ? `Vencedor de ${matchById.get(sourceId)?.label ?? '—'}` : 'A definir';
    return (
      <div className={`slot ${isWinner ? 'is-winner' : ''} ${isLoser ? 'is-loser' : ''}`} data-side={side}>
        <span className="team-cell">
          {team ? <Logo url={team.logoUrl} name={team.name} size={30} /> : <span className="logo logo-placeholder" style={{ width: 30, height: 30 }} aria-hidden>?</span>}
          <span className={team ? '' : 'muted'}>{team ? team.name : placeholder}</span>
        </span>
        <span className="slot-end">
          {isWinner && <Badge tone="success">Avançou</Badge>}
          {showScore && <span className="score">{score ?? '—'}</span>}
        </span>
      </div>
    );
  };

  return (
    <article className={`match status-${m.status}`}>
      <header className="match-head">
        <strong>{m.label}</strong>
        <Badge tone={m.status === 'finished' ? 'success' : m.status === 'in_progress' ? 'accent' : 'neutral'}>
          {MATCH_STATUS_LABEL[m.status]}
        </Badge>
      </header>
      {slot(m.teamAId, m.sourceA, outcome.scoreA, 'A')}
      {m.isBye ? (
        <div className="slot bye"><span className="muted">Avanço direto (BYE)</span></div>
      ) : (
        slot(m.teamBId, m.sourceB, outcome.scoreB, 'B')
      )}
      {m.bestOf > 1 && m.games.length > 0 && (
        <footer className="match-games">
          <span className="muted">Melhor de {m.bestOf}:</span>
          {m.games.map((g, i) => (
            <span key={i} className="game-chip">{g.a}–{g.b}</span>
          ))}
        </footer>
      )}
    </article>
  );
}
