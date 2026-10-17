'use client';

import { useState } from 'react';
import { FilterGroup } from './FilterGroup';
import { games, leagues, type Game } from '@/lib/data';

const ALL_LEAGUES = 'Todos';

export function GamesSection() {
  const [league, setLeague] = useState<string>(ALL_LEAGUES);

  const visible = league === ALL_LEAGUES ? games : games.filter((g) => g.league === league);

  return (
    <section id="jogos" aria-labelledby="t-jogos" className="section">
      <div className="section-head">
        <div className="section-title-wrap">
          <h2 id="t-jogos" className="section-title">
            Jogos do dia
          </h2>
          <span className="section-sub">Horários de Brasília</span>
        </div>
        <FilterGroup
          label="Filtrar por campeonato"
          options={[ALL_LEAGUES, ...leagues]}
          value={league}
          onChange={setLeague}
        />
      </div>

      <div className="games-grid">
        {visible.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}

function GameCard({ game }: { game: Game }) {
  return (
    <article className="game-card">
      <div className="game-top">
        <span className="league">{game.league}</span>
        {game.live ? (
          <span className="live-badge">
            <span className="live-dot" aria-hidden="true" />
            AO VIVO
          </span>
        ) : (
          <span className="game-time">{game.time}</span>
        )}
      </div>

      <div className="teams">
        <TeamRow abbr={game.homeAbbr} name={game.home} score={game.live ? game.homeScore : undefined} />
        <TeamRow
          abbr={game.awayAbbr}
          name={game.away}
          score={game.live ? game.awayScore : undefined}
          away
        />
      </div>

      <div className="broadcast">Transmissão: [CANAL / STREAMING]</div>
    </article>
  );
}

function TeamRow({
  abbr,
  name,
  score,
  away = false,
}: {
  abbr: string;
  name: string;
  score?: number;
  away?: boolean;
}) {
  return (
    <div className="team">
      <span className={away ? 'crest away' : 'crest'}>{abbr}</span>
      <span className="team-name">{name}</span>
      {score !== undefined && <span className="team-score">{score}</span>}
    </div>
  );
}
