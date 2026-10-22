import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { subscribeSchool } from '../../services/schools/schoolService';
import { useSubscription } from '../../hooks/useSubscription';
import { useChampionshipData } from '../../hooks/useChampionshipData';
import type { School } from '../../types';
import { computeStandings, getChampion } from '../../features/scoring/engine';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ui/StateBlock';
import { Logo } from '../../components/ui/Logo';
import { Badge } from '../../components/ui/Badge';
import { StandingsTable } from '../../components/public/StandingsTable';
import { RoundResultsList } from '../../components/public/RoundResultsList';
import { BracketView } from '../../components/public/BracketView';
import { FORMAT_LABEL, STATUS_LABEL, formatDateTime } from '../../utils/format';
import { friendlyError, isPermissionDenied } from '../../utils/errors';
import { NotFoundPage } from '../NotFoundPage';

export function SchoolPage() {
  const { schoolId = '' } = useParams();
  const school = useSubscription<School | null>((e, f) => subscribeSchool(schoolId, e, f), [schoolId]);
  const notVisible = school.error != null ? isPermissionDenied(school.error) : school.data === null && !school.loading;
  const data = useChampionshipData(school.data ? schoolId : null, 'public');

  const standings = useMemo(() => {
    if (!data.championship || data.championship.format !== 'points') return [];
    return computeStandings({ rules: data.championship.rules, teams: data.teams, resultsByRound: data.resultsByRound });
  }, [data.championship, data.teams, data.resultsByRound]);

  if (school.loading) return <LoadingBlock label="Carregando escola…" />;
  if (notVisible) return <NotFoundPage message="Escola não encontrada ou ainda não publicada." />;
  if (school.error != null) return <ErrorBlock message={friendlyError(school.error)} />;
  const s = school.data!;
  const c = data.championship;
  const logos = Object.fromEntries(data.teams.map((t) => [t.id, t.logoUrl]));
  const champion = c && c.format === 'points' ? getChampion(c.rules, c.status, standings, c.championTeamId) : null;
  const finalMatchWinner = c?.format === 'knockout' && c.status === 'finished' ? lastWinner(data.stages, data.matches) : null;
  const teamName = (id: string) => data.teams.find((t) => t.id === id)?.name ?? '—';
  const provisional = c?.format === 'points' && c.status !== 'finished';

  return (
    <>
      <Link to={ROUTES.publicHome} className="back-link"><ArrowLeft size={16} aria-hidden /> Todas as escolas</Link>
      <header className="school-head">
        <Logo url={s.logoUrl} name={s.name} size={84} />
        <div>
          <h1>{s.name}</h1>
          {s.description && <p className="muted">{s.description}</p>}
          {c && (
            <div className="chips">
              <Badge tone="accent">{FORMAT_LABEL[c.format]}</Badge>
              <Badge tone={c.status === 'finished' ? 'success' : c.status === 'in_progress' ? 'warn' : 'neutral'}>{STATUS_LABEL[c.status]}</Badge>
              <span className="muted small">Atualizado em {formatDateTime(c.updatedAt)}</span>
            </div>
          )}
        </div>
      </header>

      {data.loading && <LoadingBlock label="Carregando resultados…" />}
      {!data.loading && data.error != null && <ErrorBlock message={friendlyError(data.error)} />}

      {!data.loading && !data.error && !c && (
        <EmptyBlock title="Campeonato ainda não configurado" message="Esta escola ainda não tem campeonato publicado." />
      )}

      {!data.loading && !data.error && c && (
        <>
          {(champion || finalMatchWinner) && (
            <div className="champion" role="status">
              <Trophy size={22} aria-hidden />
              <span>
                {champion
                  ? champion.tie
                    ? `Empate no 1º lugar: ${champion.teamIds.map(teamName).join(' e ')}`
                    : `Campeã: ${teamName(champion.teamIds[0])}`
                  : `Campeã: ${teamName(finalMatchWinner!)}`}
              </span>
            </div>
          )}

          <section aria-labelledby="equipes">
            <h2 id="equipes" className="section-title">Equipes participantes</h2>
            {data.teams.length === 0 ? (
              <p className="muted">Nenhuma equipe cadastrada.</p>
            ) : (
              <ul className="team-list">
                {data.teams.map((t) => (
                  <li key={t.id} className="team-pill"><Logo url={t.logoUrl} name={t.name} size={28} />{t.name}</li>
                ))}
              </ul>
            )}
          </section>

          {c.format === 'points' && (
            <>
              <section aria-labelledby="classificacao">
                <h2 id="classificacao" className="section-title">
                  Classificação {provisional && <Badge tone="warn">Parcial</Badge>}
                </h2>
                {data.rounds.length === 0 ? (
                  <EmptyBlock title="Sem resultados publicados" message="A classificação aparece assim que a primeira queda for publicada." />
                ) : (
                  <StandingsTable rules={c.rules} rows={standings} logos={logos} />
                )}
              </section>
              <section aria-labelledby="quedas">
                <h2 id="quedas" className="section-title">Resultados por queda</h2>
                <RoundResultsList rules={c.rules} rounds={data.rounds} resultsByRound={data.resultsByRound} teams={data.teams} />
              </section>
            </>
          )}

          {c.format === 'knockout' && (
            <section aria-labelledby="chaveamento">
              <h2 id="chaveamento" className="section-title">Chaveamento</h2>
              {data.matches.length === 0 ? (
                <EmptyBlock title="Sem confrontos cadastrados" message="Os confrontos aparecem aqui assim que forem definidos." />
              ) : (
                <BracketView stages={data.stages} matches={data.matches} teams={data.teams} />
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

/** Vencedor do confronto da última fase (final), se houver exatamente um e estiver finalizado. */
function lastWinner(stages: { id: string; order: number }[], matches: { stageId: string; status: string; winnerId: string | null }[]) {
  const last = [...stages].sort((a, b) => b.order - a.order).find((s) => matches.some((m) => m.stageId === s.id));
  if (!last) return null;
  const ms = matches.filter((m) => m.stageId === last.id);
  return ms.length === 1 && ms[0].status === 'finished' ? ms[0].winnerId : null;
}
