import 'server-only';
import {getSupabase} from '@/lib/supabase';
import type {Game, NewsItem,WatchTitle} from '@/lib/data';
import {getPublishedNews,getWatchTitles} from '@/lib/content';
import {getGameBySlug} from '@/lib/football';

type MatchSearchRow={
  slug:string;home_team:string;away_team:string;league:string;
  kickoff_at:string;status:string;
};
export type SearchResult={
  matches:{slug:string;home:string;away:string;league:string;at:string;status:string}[];
  articles:NewsItem[];
  titles:WatchTitle[];
};
export async function searchAll(raw:string):Promise<SearchResult>{
  const term=raw.trim().replace(/[^a-zA-ZÀ-ÿ0-9 \-]/g,'').slice(0,70);
  if(term.length<2)return {matches:[],articles:[],titles:[]};
  const db=getSupabase();
  const [games,news,watch]=await Promise.all([
    db.rpc('search_guia_matches',{term}),
    db.from('news_articles').select('id,slug,headline,summary,category,published_at,updated_at,source_name,source_url,is_aggregated')
      .eq('status','published').ilike('headline','%'+term+'%')
      .order('published_at',{ascending:false}).limit(20),
    db.from('watch_titles').select('id,kind,platform,title,source_url,watch_url,availability_status,synopsis')
      .eq('is_published',true).ilike('title','%'+term+'%').limit(20),
  ]);
  if(games.error)console.error('Busca jogos:',games.error.message);
  if(news.error)console.error('Busca notícias:',news.error.message);
  if(watch.error)console.error('Busca catálogo:',watch.error.message);
  return {
    matches:((games.data||[]) as MatchSearchRow[]).filter(g=>!!g.slug).map(g=>({
      slug:g.slug,home:g.home_team,away:g.away_team,league:g.league,
      at:g.kickoff_at,status:g.status,
    })),
    articles:(news.data||[]).map(n=>({
      id:n.id,slug:n.slug,headline:n.headline,summary:n.summary,category:n.category,
      publishedAt:n.published_at,updatedAt:n.updated_at,
      sourceName:n.source_name||undefined,sourceUrl:n.source_url||undefined,
      isAggregated:n.is_aggregated,
    })),
    titles:(watch.data||[]).map(t=>({
      id:t.id,kind:t.kind,platform:t.platform,title:t.title,
      sourceUrl:t.source_url||undefined,watchUrl:t.watch_url||undefined,
      availabilityStatus:t.availability_status,synopsis:t.synopsis||undefined,
    })),
  };
}
