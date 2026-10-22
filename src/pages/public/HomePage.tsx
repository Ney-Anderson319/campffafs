import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { subscribeSchools } from '../../services/schools/schoolService';
import { useSubscription } from '../../hooks/useSubscription';
import type { School } from '../../types';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ui/StateBlock';
import { Logo } from '../../components/ui/Logo';
import { friendlyError } from '../../utils/errors';

export function HomePage() {
  const { data, loading, error } = useSubscription<School[]>((emit, fail) => subscribeSchools({ publishedOnly: true }, emit, fail), []);
  return (
    <>
      <section className="hero">
        <h1>Campeonato Escolar de Free Fire</h1>
        <p>Acompanhe placares, classificações e confrontos de cada escola da cidade.</p>
      </section>
      <section aria-labelledby="escolas">
        <h2 id="escolas" className="section-title">Escolas Participantes</h2>
        {loading && <LoadingBlock label="Carregando escolas…" />}
        {!loading && error != null && <ErrorBlock message={`${friendlyError(error)} Atualize a página para tentar de novo.`} />}
        {!loading && !error && data && data.length === 0 && (
          <EmptyBlock title="Nenhuma escola publicada ainda" message="Volte em breve: os resultados aparecem aqui assim que forem publicados." />
        )}
        {!loading && !error && data && data.length > 0 && (
          <ul className="school-grid">
            {data.map((s) => (
              <li key={s.id}>
                <Link to={ROUTES.publicSchool(s.id)} className="school-card">
                  <Logo url={s.logoUrl} name={s.name} size={64} />
                  <span className="school-card-body">
                    <strong>{s.name}</strong>
                    <span className="muted">Ver resultados</span>
                  </span>
                  <ChevronRight size={20} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
