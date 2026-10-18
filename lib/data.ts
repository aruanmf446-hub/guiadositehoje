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
  broadcastStatus?: 'confirmed' | 'unconfirmed';
  broadcastSource?: string;
  slug?: string;
  gameDate?: string;
  kickoffAt?: string;
  seoDescription?: string;
  competitionSlug?: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  venueRegion?: string;
  venueCountry?: string;
  sourceUrl?: string;
  status?: string;
};

export type NewsItem = {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  category: string;
  imageUrl?: string;
  imageAlt?: string;
  imageCredit?: string;
  imageCreditUrl?: string;
  isAggregated?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  generatedByAi?: boolean;
  editorialVerification?: string;
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
  posterCredit?: string;
  posterCreditUrl?: string;
  sourceUrl?: string;
  watchUrl?: string;
  availabilityStatus?: string;
  synopsis?: string;
  editorialBody?: string;
  seoTitle?: string;
  seoDescription?: string;
  updatedAt?: string;
};
