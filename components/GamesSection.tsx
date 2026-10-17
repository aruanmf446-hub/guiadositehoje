'use client';
import { useState } from 'react';
import Link from 'next/link';
import { FilterGroup } from './FilterGroup';
import type { Game } from '@/lib/data';
const ALL_LEAGUES='Todos';
export function GamesSection({games}:{games:Game[]}){
  const [league,setLeague]=useState(ALL_LEAGUES);
  const leagues=[...new Set(games.map(g=>g.league))];
  const visible=league===ALL_LEAGUES?games:games.filter(g=>g.league===league);
  return <section id="jogos" aria-labelledby="t-jogos" className="section">
    <div className="section-head">
      <div className="section-title-wrap">
        <h2 id="t-jogos" className="section-title">Próximos jogos de futebol</h2>
        <span className="section-sub">Até 7 dias de antecedência • Horários de Brasília</span>
      </div>
      {leagues.length>1 && <FilterGroup label="Filtrar por campeonato" options={[ALL_LEAGUES,...leagues]} value={league} onChange={setLeague}/>}
    </div>
    {visible.length===0?<p className="empty" style={{marginTop:24}}>Nenhum jogo confirmado na base até o momento.</p>:
      <div className="games-grid">{visible.slice(0,18).map(game=>
        <article className="game-card" key={game.id}>
          <div className="game-top">
            <span className="league">{game.league}</span>
            {game.live?<span className="live-badge">AO VIVO</span>:
              <span className="game-time">{game.time}</span>}
          </div>
          <p className="game-day">{game.gameDate?.split('-').reverse().join('/')} • Brasília</p>
          <div className="teams">
            <TeamRow abbr={game.homeAbbr} name={game.home} score={game.showScore?game.homeScore:undefined}/>
            <TeamRow abbr={game.awayAbbr} name={game.away} score={game.showScore?game.awayScore:undefined} away/>
          </div>
          <div className="broadcast">{game.broadcast ? `Onde assistir: ${game.broadcast}`:'Transmissão a confirmar'}</div>
          {game.slug && <Link className="all-news-link" href={`/futebol/${game.slug}`}>Detalhes do jogo →</Link>}
        </article>)}</div>}
    <Link className="all-news-link" href="/futebol">Ver todos os jogos dos próximos dias →</Link>
  </section>;
}
function TeamRow({abbr,name,score,away=false}:{abbr:string;name:string;score?:number;away?:boolean}){
  return <div className="team">
    <span className={away?'crest away':'crest'}>{abbr}</span>
    <span className="team-name">{name}</span>
    {score!==undefined&&<span className="team-score">{score}</span>}
  </div>;
}
