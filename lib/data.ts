export type Game = {
  id: string;
  league: string;
  time: string;
  live: boolean;
  showScore: boolean;
  home: string;
  homeAbbr: string;
  homeScore?: number;
  away: string;
  awayAbbr: string;
  awayScore?: number;
  broadcast?: string;
};

export type NewsItem = {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  category: string;
  imageUrl?: string;
  imageAlt?: string;
  publishedAt: string;
  updatedAt: string;
  sourceName?: string;
  sourceUrl?: string;
};

export type NewsArticle = NewsItem & { body: string };

export const watchKinds = ['Filmes', 'Séries', 'Programas'] as const;
export type WatchKind = (typeof watchKinds)[number];

export type WatchTitle = {
  id: string;
  kind: WatchKind;
  platform: string;
  title: string;
  posterUrl?: string;
};
