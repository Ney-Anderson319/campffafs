import { useRef, useState } from 'react';
import { BarChart3, Pencil, Plus, Trash2 } from 'lucide-react';
import { SchoolPicker, useSelectedSchool } from '../../layouts/AdminLayout';
import { useChampionshipData } from '../../hooks/useChampionshipData';
import type { Team } from '../../types';
import { deleteTeam, newTeamId, saveTeam } from '../../services/teams/teamService';
import { computeStandings } from '../../features/scoring/engine';
import { computeOutcome } from '../../features/matches/bracket';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Logo } from '../../components/ui/Logo';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ui/StateBlock';
import { LogoInput } from '../../components/admin/LogoInput';
import { useConfirm, useToast } from '../../components/ui/Feedback';
import { useAction } from '../../hooks/useAction';
import { friendlyError } from '../../utils/errors';
import { formatNumber } from '../../utils/format';

export function TeamsPage() {
  const { schoolId, school, schools } = useSelectedSchool();
  const data = useChampionshipData(schoolId, 'admin');
  const [editing, setEditing] = useState<Team | 'new' | null>(null);
  const [viewing, setViewing] = useState<Team | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const { run, busy } = useAction();

  if (schools.length === 0) return <EmptyBlock title="Cadastre uma escola primeiro" message="As equipes pertencem a uma escola." />;

  const remove = (t: Team) =>
    run(async () => {
      const ok = await confirm({ title: `Excluir "${t.name}"?`, tone: 'danger', confirmLabel: 'Excluir equipe', message: 'A equipe e seu logo serão removidos. Equipes com resultados ou confrontos não podem ser excluídas.' });
      if (!ok) return;
      try {
        await deleteTeam(t);
        toast.success('Equipe excluída.');
      } catch (e) {
        toast.error(friendlyError(e));
      }
    });

  return (
    <>
      <div className="page-head">
        <h1>Equipes</h1>
        <SchoolPicker />
      </div>
      {data.loading && <LoadingBlock />}
      {!data.loading && data.error != null && <ErrorBlock message={friendlyError(data.error)} />}
      {!data.loading && !data.error && school && (
        <>
          <div className="page-head sub">
            <p className="muted">{data.teams.length} equipe(s) em {school.name}</p>
            <Button icon={<Plus size={16} />} onClick={() => setEditing('new')}>Nova equipe</Button>
          </div>
          {data.teams.length === 0 ? (
            <EmptyBlock title="Nenhuma equipe nesta escola" message="Adicione as equipes que vão disputar o campeonato." />
          ) : (
            <ul className="row-list">
              {data.teams.map((t) => (
                <li key={t.id} className="row-item">
                  <Logo url={t.logoUrl} name={t.name} size={44} />
                  <div className="row-main"><strong>{t.name}</strong></div>
                  <div className="row-actions">
                    <Button size="sm" variant="subtle" icon={<BarChart3 size={16} />} onClick={() => setViewing(t)}>Resultados</Button>
                    <Button size="sm" variant="subtle" icon={<Pencil size={16} />} onClick={() => setEditing(t)}>Editar</Button>
                    <Button size="sm" variant="danger" disabled={busy} icon={<Trash2 size={16} />} onClick={() => void remove(t)}>Excluir</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editing && schoolId && <TeamForm schoolId={schoolId} team={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
          {viewing && <TeamResults team={viewing} data={data} onClose={() => setViewing(null)} />}
        </>
      )}
    </>
  );
}

function TeamForm({ schoolId, team, onClose }: { schoolId: string; team: Team | null; onClose: () => void }) {
  const id = useRef(team?.id ?? newTeamId(schoolId)).current;
  const [name, setName] = useState(team?.name ?? '');
  const [image, setImage] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const { run, busy } = useAction();

  const submit = () =>
    run(async () => {
      if (!name.trim()) return setError('Informe o nome da equipe.');
      try {
        await saveTeam({ id, schoolId, isNew: !team, name, logoDataUrl: image ?? undefined, removeLogo: remove, existing: team });
        toast.success(team ? 'Equipe atualizada.' : 'Equipe criada.');
        onClose();
      } catch (e) {
        setError(friendlyError(e));
      }
    });

  return (
    <Modal title={team ? 'Editar equipe' : 'Nova equipe'} onClose={onClose}
      footer={<><Button variant="ghost" disabled={busy || processing} onClick={onClose}>Cancelar</Button><Button busy={busy} disabled={processing} onClick={() => void submit()}>Salvar equipe</Button></>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className="field">
          <span>Nome da equipe</span>
          <input value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setError(null); }} />
        </label>
        <LogoInput name={name} currentUrl={team?.logoUrl ?? null} image={image} remove={remove} onChange={(value, r) => { setImage(value); setRemove(r); }} onError={setError} onProcessingChange={setProcessing} />
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

function TeamResults({ team, data, onClose }: { team: Team; data: ReturnType<typeof useChampionshipData>; onClose: () => void }) {
  const c = data.championship;
  const name = (id: string | null) => data.teams.find((t) => t.id === id)?.name ?? 'A definir';
  return (
    <Modal title={`Resultados — ${team.name}`} onClose={onClose} wide footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      {!c && <p className="muted">A escola ainda não tem campeonato configurado.</p>}
      {c?.format === 'points' && (() => {
        const rows = computeStandings({ rules: c.rules, teams: data.teams, resultsByRound: data.resultsByRound });
        const me = rows.find((r) => r.teamId === team.id);
        return (
          <>
            <p>Classificação atual (todas as quedas lançadas): <strong>{me ? `${me.rank}º` : '—'}</strong> com <strong>{formatNumber(me?.totalPoints ?? 0)}</strong> pontos e {formatNumber(me?.totalKills ?? 0)} abates.</p>
            {data.rounds.length === 0 && <p className="muted">Nenhuma queda cadastrada.</p>}
            <ul className="summary-list">
              {data.rounds.map((r) => {
                const res = data.resultsByRound[r.id]?.find((x) => x.teamId === team.id);
                return <li key={r.id}><span>{r.name}</span><span>{res ? `${res.position ?? '—'}º lugar · ${res.kills ?? '—'} abates${res.status === 'incomplete' ? ' (incompleto)' : ''}` : 'Não participou'}</span></li>;
              })}
            </ul>
          </>
        );
      })()}
      {c?.format === 'knockout' && (
        <ul className="summary-list">
          {data.matches.filter((m) => m.teamAId === team.id || m.teamBId === team.id).map((m) => {
            const o = computeOutcome(m);
            return <li key={m.id}><span>{m.label}</span><span>{name(m.teamAId)} {o.scoreA ?? ''} × {o.scoreB ?? ''} {m.isBye ? '(BYE)' : name(m.teamBId)}{m.winnerId === team.id ? ' · avançou' : ''}</span></li>;
          })}
          {data.matches.every((m) => m.teamAId !== team.id && m.teamBId !== team.id) && <li><span className="muted">Nenhum confronto.</span></li>}
        </ul>
      )}
    </Modal>
  );
}
