import 'server-only';
import { getSupabase } from '@/lib/supabase';
import type { Game, NewsArticle, NewsItem, WatchKind, WatchTitle } from '@/lib/data';

type NewsRow = {
  id: string; slug: string; headline: string; summary: string; body?: string;
  category: string; image_url: string | null; image_alt: string | null;
  published_at: string; updated_at: string; source_name: string | null; source_url: string | null; is_aggregated: boolean; seo_title:string|null;seo_description:string|null;generated_by_ai:boolean;editorial_verification:string;
};

function mapNews(row: NewsRow): NewsItem {
  return {
    id: row.id, slug: row.slug, headline: row.headline, summary: row.summary,
    category: row.category, imageUrl: row.image_url || undefined,
    imageAlt: row.image_alt || undefined, publishedAt: row.published_at,
    updatedAt: row.updated_at, sourceName: row.source_name || undefined,
    sourceUrl: row.source_url || undefined, isAggregated: row.is_aggregated,
    seoTitle:row.seo_title||undefined,seoDescription:row.seo_description||undefined,
    generatedByAi:row.generated_by_ai,editorialVerification:row.editorial_verification,
  };
}

export async function getPublishedNews(limit = 8): Promise<NewsItem[]> {
  const { data, error } = await getSupabase().from('news_articles')
    .select('id,slug,headline,summary,category,image_url,image_alt,published_at,updated_at,source_name,source_url,is_aggregated,seo_title,seo_description,generated_by_ai,editorial_verification')
    .eq('status', 'published').lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false }).limit(limit);
  if (error) { console.error('Erro ao consultar notícias:', error.message); return []; }
  return ((data || []) as NewsRow[]).map(mapNews);
}

export async function getArticle(slug: string): Promise<NewsArticle | null> {
  const { data, error } = await getSupabase().from('news_articles')
    .select('id,slug,headline,summary,body,category,image_url,image_alt,published_at,updated_at,source_name,source_url,is_aggregated,seo_title,seo_description,generated_by_ai,editorial_verification')
    .eq('slug', slug).eq('status', 'published')
    .lte('published_at', new Date().toISOString()).maybeSingle();
  if (error) { console.error('Erro ao consultar artigo:', error.message); return null; }
  if (!data) return null;
  const row = data as NewsRow;
  return { ...mapNews(row), body: row.body || '' };
}

type MatchRow = {
  id: string; league: string; kickoff_at: string; home_team: string; home_abbr: string;
  home_score: number | null; away_team: string; away_abbr: string; away_score: number | null;
  status: string; broadcast: string | null;
};

export function todayInBrasilia() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export async function getTodaysGames(): Promise<Game[]> {
  const { data, error } = await getSupabase().from('matches')
    .select('id,league,kickoff_at,home_team,home_abbr,home_score,away_team,away_abbr,away_score,status,broadcast')
    .eq('game_date', todayInBrasilia()).eq('is_published', true)
    .order('kickoff_at', { ascending: true }).limit(50);
  if (error) { console.error('Erro ao consultar jogos:', error.message); return []; }
  return ((data || []) as MatchRow[]).map(row => ({
    id: row.id, league: row.league,
    time: new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(row.kickoff_at)),
    live: row.status === 'live', showScore: row.status === 'live' || row.status === 'finished',
    home: row.home_team, homeAbbr: row.home_abbr, homeScore: row.home_score ?? undefined,
    away: row.away_team, awayAbbr: row.away_abbr, awayScore: row.away_score ?? undefined,
    broadcast: row.broadcast || undefined,
  }));
}

type WatchRow = { id: string; kind: WatchKind; platform: string; title: string; poster_url: string | null; source_url:string | null; watch_url:string | null; availability_status:string; synopsis:string | null; };

export async function getWatchTitles(): Promise<WatchTitle[]> {
  const { data, error } = await getSupabase().from('watch_titles')
    .select('id,kind,platform,title,poster_url,source_url,watch_url,availability_status,synopsis').eq('is_published', true)
    .order('updated_at', { ascending: false }).limit(60);
  if (error) { console.error('Erro ao consultar onde assistir:', error.message); return []; }
  return ((data || []) as WatchRow[]).map(row => ({
    id: row.id, kind: row.kind, platform: row.platform, title: row.title,
    posterUrl: row.poster_url || undefined,
    sourceUrl: row.source_url || undefined,
    watchUrl: row.watch_url || undefined,
    availabilityStatus: row.availability_status,
    synopsis: row.synopsis || undefined,
  }));
}
