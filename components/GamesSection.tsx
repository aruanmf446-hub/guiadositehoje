import Link from 'next/link';
import type {Game} from '@/lib/data';
export function GamesSection({games}:{games:Game[]}){
  return <section id="jogos" className="home-section games-section" aria-labelledby="games-heading">
    <div className="section-head editorial-section-head">
      <div><div className="section-eyebrow">AGENDA DO DIA</div>
        <h2 id="games-heading">A bola rola hoje<span className="heading-dot">.</span></h2>
        <p>Somente jogos que ainda não começaram ou estão em andamento. Horário de Brasília.</p>
      </div>
      <Link href="/futebol" className="text-link">Agenda dos próximos 7 dias <span aria-hidden="true">↗</span></Link>
    </div>
    {games.length===0?<div className="no-games">
      <strong>Sem partidas a seguir hoje.</strong>
      <p>Os jogos encerrados saem desta capa, mas continuam disponíveis na pesquisa e no calendário.</p>
      <Link href="/futebol">Conferir próximos jogos <span aria-hidden="true">↗</span></Link>
    </div>:<div className="today-list">
      {games.slice(0,12).map(game=><Link key={game.id} className="today-match" href={'/futebol/'+game.slug}>
        <div className="match-meta"><span>{game.league}</span><strong>{game.live?'AO VIVO':game.time}</strong></div>
        <div className="match-teams">
          <span className="team-monogram">{game.homeAbbr.slice(0,3)}</span>
          <strong>{game.home}</strong><span className="match-vs">vs.</span><strong>{game.away}</strong>
          <span className="team-monogram dark">{game.awayAbbr.slice(0,3)}</span>
        </div>
        <div className="match-broadcast">{game.broadcast||'Transmissão a confirmar'} <span aria-hidden="true">↗</span></div>
      </Link>)}
    </div>}
  </section>;
}
