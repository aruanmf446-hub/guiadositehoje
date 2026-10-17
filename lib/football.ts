import 'server-only';
import { getSupabase } from '@/lib/supabase';
import type { Game } from '@/lib/data';
import { todayInBrasilia } from '@/lib/content';

type Match = {
  id: string; league: string; kickoff_at: string; home_team: string;
  home_abbr: string; home_score: number | null; away_team: string;
  away_abbr: string; away_score: number | null; status: string;
  broadcast: string | null; broadcast_status: string;
  broadcaster_source: string | null; slug: string | null;
  game_date: string; seo_description: string | null; source_url: string | null;
  competition_slug: string | null;
};
const columns = 'id,league,kickoff_at,home_team,home_abbr,home_score,away_team,away_abbr,away_score,status,broadcast,broadcast_status,broadcaster_source,slug,game_date,seo_description,source_url,competition_slug';

function toGame(m: Match): Game {
  const score = m.status === 'live' || m.status === 'finished';
  const broadcastIsConfirmed = m.broadcast_status === 'confirmed' && !!m.broadcast;
  return {
    id: m.id, league: m.league,
    time: new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit',
      minute: '2-digit', hour12: false,
    }).format(new Date(m.kickoff_at)),
    live: m.status === 'live', showScore: score,
    home: m.home_team, homeAbbr: m.home_abbr,
    homeScore: score ? m.home_score ?? undefined : undefined,
    away: m.away_team, awayAbbr: m.away_abbr,
    awayScore: score ? m.away_score ?? undefined : undefined,
    broadcast: broadcastIsConfirmed ? m.broadcast ?? undefined : undefined,
    broadcastStatus: broadcastIsConfirmed ? 'confirmed' : 'unconfirmed',
    broadcastSource: broadcastIsConfirmed ? m.broadcaster_source ?? undefined : undefined,
    slug: m.slug ?? undefined, gameDate: m.game_date,
    kickoffAt: m.kickoff_at,
    seoDescription: m.seo_description ?? undefined,
    sourceUrl: m.source_url ?? undefined, status: m.status,
    competitionSlug: m.competition_slug ?? undefined,
  };
}
function addDays(iso: string, increment: number) {
  const date = new Date(iso + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + increment);
  return date.toISOString().slice(0, 10);
}
export async function getUpcomingGames(limit = 180): Promise<Game[]> {
  const today = todayInBrasilia();
  const { data, error } = await getSupabase().from('matches')
    .select(columns).eq('is_published', true)
    .gte('game_date', today).lte('game_date', addDays(today, 7))
    .order('kickoff_at', { ascending: true }).limit(limit);
  if (error) {
    console.error('Falha ao ler próximos jogos:', error.message);
    return [];
  }
  return ((data || []) as Match[]).map(toGame);
}
export async function getGameBySlug(slug: string): Promise<Game | null> {
  if (!/^[a-z0-9-]{1,240}$/.test(slug)) return null;
  const { data, error } = await getSupabase().from('matches')
    .select(columns).eq('is_published', true)
    .eq('slug', slug).maybeSingle();
  if (error) { console.error('Falha ao ler partida:', error.message); return null; }
  return data ? toGame(data as Match) : null;
}
export async function getFootballSitemapEntries(): Promise<{slug:string;date:string}[]> {
  const today=todayInBrasilia();
  const { data, error } = await getSupabase().from('matches')
    .select('slug,updated_at').eq('is_published',true).not('slug','is',null)
    .gte('game_date',addDays(today,-14)).order('kickoff_at',{ascending:true})
    .limit(1500);
  if (error) { console.error('Falha ao gerar sitemap do futebol:',error.message); return []; }
  return (data||[]).filter(row=>!!row.slug).map(row=>({slug:row.slug,date:row.updated_at}));
}

export type FootballCompetition = {
  slug: string;
  leagueId: string;
  name: string;
  description: string;
  displayOrder: number;
};
export async function getFootballCompetitions(): Promise<FootballCompetition[]> {
  const {data,error}=await getSupabase().from('football_competitions')
    .select('slug,league_id,name,description,display_order')
    .eq('enabled',true).order('display_order',{ascending:true});
  if(error){console.error('Erro ao consultar competições:',error.message);return [];}
  return (data||[]).map(row=>({
    slug:row.slug,leagueId:row.league_id,name:row.name,
    description:row.description,displayOrder:row.display_order,
  }));
}
export async function getCompetitionGames(slug:string,limit=150):Promise<Game[]> {
  const today=todayInBrasilia();
  const {data,error}=await getSupabase().from('matches').select(columns)
    .eq('is_published',true).eq('competition_slug',slug)
    .gte('game_date',today).lte('game_date',addDays(today,7))
    .order('kickoff_at',{ascending:true}).limit(limit);
  if(error){console.error('Erro ao consultar divisão',error.message);return [];}
  return ((data||[]) as Match[]).map(toGame);
}
