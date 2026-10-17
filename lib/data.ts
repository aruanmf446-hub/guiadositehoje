export type League = 'Premier League' | 'La Liga';

export type Game = {
  id: string;
  league: League;
  time: string;
  live?: boolean;
  home: string;
  homeAbbr: string;
  homeScore?: number;
  away: string;
  awayAbbr: string;
  awayScore?: number;
};

export type NewsItem = {
  id: string;
  category: string;
  headline: string;
};

export type WatchKind = 'Filmes' | 'Séries' | 'Programas';

export type WatchTitle = {
  id: string;
  kind: WatchKind;
  platform: string;
  title: string;
};

// Jogos de 17/10/2026, horário de Brasília (dados de exemplo até o Supabase entrar).
export const games: Game[] = [
  { id: 'g1', league: 'Premier League', time: '08:30', live: true, home: 'Everton', homeAbbr: 'EVE', homeScore: 0, away: 'Chelsea', awayAbbr: 'CFC', awayScore: 0 },
  { id: 'g2', league: 'La Liga', time: '09:00', home: 'Espanyol', homeAbbr: 'ESP', away: 'Atlético de Madrid', awayAbbr: 'ATM' },
  { id: 'g3', league: 'Premier League', time: '11:00', home: 'Brentford', homeAbbr: 'BRE', away: 'Liverpool', awayAbbr: 'LFC' },
  { id: 'g4', league: 'Premier League', time: '11:00', home: 'Fulham', homeAbbr: 'FUL', away: 'Hull City', awayAbbr: 'HUL' },
  { id: 'g5', league: 'Premier League', time: '11:00', home: 'Manchester City', homeAbbr: 'MCI', away: 'Ipswich Town', awayAbbr: 'IPS' },
  { id: 'g6', league: 'La Liga', time: '11:15', home: 'Villarreal', homeAbbr: 'VIL', away: 'Elche', awayAbbr: 'ELC' },
  { id: 'g7', league: 'Premier League', time: '13:30', home: 'Newcastle', homeAbbr: 'NEW', away: 'Aston Villa', awayAbbr: 'AVL' },
  { id: 'g8', league: 'La Liga', time: '13:30', home: 'Real Betis', homeAbbr: 'RBB', away: 'Barcelona', awayAbbr: 'BAR' },
  { id: 'g9', league: 'La Liga', time: '16:00', home: 'Valencia', homeAbbr: 'VCF', away: 'Athletic Bilbao', awayAbbr: 'ATH' },
];

export const leagues: League[] = ['Premier League', 'La Liga'];

export const news: NewsItem[] = [
  { id: 'n1', category: 'Brasil', headline: '[Manchete da notícia]' },
  { id: 'n2', category: 'Mundo', headline: '[Manchete da notícia]' },
  { id: 'n3', category: 'Economia', headline: '[Manchete da notícia]' },
  { id: 'n4', category: 'Tecnologia', headline: '[Manchete da notícia]' },
  { id: 'n5', category: 'Entretenimento', headline: '[Manchete da notícia]' },
];

export const watchKinds: WatchKind[] = ['Filmes', 'Séries', 'Programas'];

export const platforms = ['Netflix', 'Prime Video', 'Max', 'Disney+', 'Globoplay', 'Apple TV+'];

const titleLabel: Record<WatchKind, string> = {
  Filmes: '[Título do filme]',
  Séries: '[Título da série]',
  Programas: '[Título do programa]',
};

export const watchTitles: WatchTitle[] = watchKinds.flatMap((kind) =>
  platforms.map((platform) => ({
    id: `${kind}-${platform}`,
    kind,
    platform,
    title: titleLabel[kind],
  })),
);
