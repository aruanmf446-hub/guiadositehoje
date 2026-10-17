import Link from 'next/link';
import type {Game} from '@/lib/data';
const d=(g:Game)=>g.kickoffAt?new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',day:'2-digit',month:'short'
}).format(new Date(g.kickoffAt)):'';
export function RecommendedGames({games}:{games:Game[]}){
  if(!games.length)return null;
  return <section className="home-section recommendations" aria-labelledby="recommend-heading">
    <div className="editorial-section-head">
      <div><div className="section-eyebrow">FICA DE OLHO</div>
        <h2 id="recommend-heading">Jogos que podem interessar<span className="heading-dot">.</span></h2>
        <p>Próximos confrontos selecionados da agenda, com destaque para o futebol brasileiro.</p>
      </div>
      <Link href="/futebol" className="text-link">Calendário completo <span aria-hidden="true">↗</span></Link>
    </div>
    <div className="recommend-grid">{games.slice(0,4).map(g=><Link className="recommend-match" href={'/futebol/'+g.slug} key={g.id}>
      <div className="recommend-top"><span>{g.league}</span><strong>{d(g)} · {g.time}</strong></div>
      <h3>{g.home}<span> x </span>{g.away}</h3>
      <p>{g.broadcast?'Onde assistir: '+g.broadcast:'Transmissão a confirmar'} <span aria-hidden="true">↗</span></p>
    </Link>)}</div>
  </section>;
}
