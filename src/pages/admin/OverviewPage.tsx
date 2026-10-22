import { Link } from 'react-router-dom';
import { ADMIN_SECTIONS, ROUTES } from '../../config/routes';
import { SchoolPicker, useSelectedSchool } from '../../layouts/AdminLayout';
import { useChampionshipData } from '../../hooks/useChampionshipData';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ui/StateBlock';
import { Badge } from '../../components/ui/Badge';
import { FORMAT_LABEL, STATUS_LABEL, formatDateTime } from '../../utils/format';
import { friendlyError } from '../../utils/errors';

export function OverviewPage() {
  const { schools, schoolId, school } = useSelectedSchool();
  const data = useChampionshipData(schoolId, 'admin');
  const published = schools.filter((s) => s.published).length;

  return (
    <>
      <h1>Visão geral</h1>
      <div className="stat-grid">
        <div className="stat"><strong>{schools.length}</strong><span>Escolas cadastradas</span></div>
        <div className="stat"><strong>{published}</strong><span>Publicadas</span></div>
        <div className="stat"><strong>{schools.length - published}</strong><span>Ocultas</span></div>
      </div>

      {schools.length === 0 ? (
        <EmptyBlock
          title="Comece cadastrando uma escola"
          message="Depois crie as equipes, escolha o formato do campeonato e publique."
          action={<Link className="btn btn-primary btn-md" to={ROUTES.adminSection(ADMIN_SECTIONS.schools)}>Cadastrar escola</Link>}
        />
      ) : (
        <section className="panel">
          <div className="panel-head"><h2>Situação da escola</h2><SchoolPicker /></div>
          {data.loading && <LoadingBlock />}
          {!data.loading && data.error != null && <ErrorBlock message={friendlyError(data.error)} />}
          {!data.loading && !data.error && school && (
            <ul className="summary-list">
              <li><span>Publicação</span><Badge tone={school.published ? 'success' : 'neutral'}>{school.published ? 'Publicada' : 'Oculta'}</Badge></li>
              <li><span>Equipes</span><strong>{data.teams.length}</strong></li>
              <li><span>Campeonato</span>{data.championship ? <span>{FORMAT_LABEL[data.championship.format]} · {STATUS_LABEL[data.championship.status]}</span> : <span className="muted">Não configurado</span>}</li>
              {data.championship?.format === 'points' && <li><span>Quedas</span><strong>{data.rounds.length} ({data.rounds.filter((r) => r.published).length} publicadas)</strong></li>}
              {data.championship?.format === 'knockout' && <li><span>Confrontos</span><strong>{data.matches.length}</strong></li>}
              <li><span>Última atualização</span><span>{formatDateTime(data.championship?.updatedAt ?? school.updatedAt)}</span></li>
            </ul>
          )}
        </section>
      )}
    </>
  );
}
