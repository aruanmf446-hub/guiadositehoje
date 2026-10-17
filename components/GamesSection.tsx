'use client';

import { useState } from 'react';
import { FilterGroup } from './FilterGroup';
import type { Game } from '@/lib/data';

const ALL_LEAGUES = 'Todos';

export function GamesSection({ games }: { games: Game[] }) {
  const [league, setLeague] = useState<string>(ALL_LEAGUES);
  const leagues = [...new Set(games.map(g => g.league))];
  const visible = league === ALL_LEAGUES ? games : games.filter(g => g.league === league);
  return (
    <section id="jogos" aria-labelledby="t-jogos" className="section">
      <div className="section-head">
        <div className="section-title-wrap">
          <h2 id="t-jogos" className="section-title">Jogos do dia</h2>
          <span className="section-sub">Horários de Brasília</span>
        </div>
        {leagues.length > 1 && <FilterGroup
          label="Filtrar por campeonato" options={[ALL_LEAGUES, ...leagues]}
          value={league} onChange={setLeague}
        />}
      </div>
      {visible.length === 0 ? (
        <p className="empty" style={{ marginTop: 24 }}>Nenhum jogo confirmado para exibição hoje.</p>
      ) : (
        <div className="games-grid">{visible.map(game => <GameCard key={game.id} game={game} />)}</div>
      )}
    </section>
  );
}

function GameCard({ game }: { game: Game }) {
  return (
    <article className="game-card">
      <div className="game-top">
        <span className="league">{game.league}</span>
        {game.live ? <span className="live-badge">
          <span className="live-dot" aria-hidden="true" />AO VIVO
        </span> : <span className="game-time">{game.time}</span>}
      </div>
      <div className="teams">
        <TeamRow abbr={game.homeAbbr} name={game.home} score={game.showScore ? game.homeScore : undefined} />
        <TeamRow abbr={game.awayAbbr} name={game.away} score={game.showScore ? game.awayScore : undefined} away />
      </div>
      {game.broadcast && <div className="broadcast">Transmissão: {game.broadcast}</div>}
    </article>
  );
}
function TeamRow({ abbr, name, score, away = false }: {
  abbr: string; name: string; score?: number; away?: boolean;
}) {
  return <div className="team">
    <span className={away ? 'crest away' : 'crest'}>{abbr}</span>
    <span className="team-name">{name}</span>
    {score !== undefined && <span className="team-score">{score}</span>}
  </div>;
}
