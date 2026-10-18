import Link from 'next/link';
import type {Game} from '@/lib/data';
export function GamesSection({games}:{games:Game[]}){
 return <section id="jogos" className="home-section games-section games-editorial" aria-labelledby="games-heading">
  <div className="editorial-section-head">
   <div><div className="section-eyebrow">ESPORTES / PROGRAMAÇÃO</div>
    <h2 id="games-heading">Em campo hoje<span className="heading-dot">.</span></h2>
    <p>Os próximos confrontos, no horário de Brasília. Jogos encerrados ficam no arquivo.</p>
   </div>
   <Link href="/futebol" className="text-link">Calendário completo <span aria-hidden="true">↗</span></Link>
  </div>
  {!games.length?<div className="no-games games-no-events">
   <strong>Os próximos jogos estão no calendário.</strong>
   <p>Não há partidas confirmadas por começar neste momento. Os resultados anteriores continuam disponíveis na pesquisa e nas páginas de cada jogo.</p>
   <Link href="/futebol">Explorar os próximos sete dias ↗</Link>
  </div>:<div className="game-paper">
   <div className="game-paper-top"><span>GUIA DE HOJE · AGENDA DO FUTEBOL</span>
    <span>{String(games.length).padStart(2,'0')} {games.length===1?'JOGO':'JOGOS'} NA AGENDA</span></div>
   {games.slice(0,12).map((g,i)=><Link key={g.id} className="game-paper-row" href={g.slug?'/futebol/'+g.slug:'/futebol'}>
    <span className="game-paper-number">{String(i+1).padStart(2,'0')}</span>
    <span className="game-paper-when"><small>{g.league}</small><strong>{g.live?'AO VIVO':g.time}</strong></span>
    <span className="game-paper-versus"><span>{g.home}</span>
     <b aria-label="contra">×</b><span>{g.away}</span></span>
    <span className="game-paper-channel">{g.broadcast||'Canal a confirmar'} <b aria-hidden="true">↗</b></span>
   </Link>)}
  </div>}
 </section>;
}
