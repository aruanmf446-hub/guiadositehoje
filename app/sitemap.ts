import type { MetadataRoute } from 'next';
import { getPublishedNews,getWatchTitles } from '@/lib/content';
import { mediaSlug } from '@/lib/media';
import { getFootballSitemapEntries, getFootballCompetitions, getUpcomingGames } from '@/lib/football';
import { siteUrl } from '@/lib/seo';
export const revalidate=900;
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const [articles,games,competitions,upcoming,media]=await Promise.all([
    getPublishedNews(1000),getFootballSitemapEntries(),getFootballCompetitions(),getUpcomingGames(500),getWatchTitles(),
  ]);
  return [
    {url:siteUrl,lastModified:new Date(),changeFrequency:'daily',priority:1},
    {url:siteUrl+'/noticias',lastModified:new Date(),changeFrequency:'daily',priority:.8},
    {url:siteUrl+'/sobre',lastModified:new Date(),changeFrequency:'monthly',priority:.3},
    {url:siteUrl+'/politica-editorial',lastModified:new Date(),changeFrequency:'monthly',priority:.3},
    {url:siteUrl+'/privacidade',lastModified:new Date(),changeFrequency:'monthly',priority:.3},
    {url:siteUrl+'/futebol',lastModified:new Date(),changeFrequency:'daily',priority:.9},
    {url:siteUrl+'/filmes-series',lastModified:new Date(),changeFrequency:'daily',priority:.8},
    {url:siteUrl+'/futebol/onde-assistir',lastModified:new Date(),changeFrequency:'daily',priority:.8},
    ...competitions.filter(c=>upcoming.some(g=>g.competitionSlug===c.slug))
      .map(c=>({url:siteUrl+'/futebol/campeonatos/'+c.slug,lastModified:new Date(),
        changeFrequency:'daily' as const,priority:.8})),
    ...articles.filter(x=>!x.isAggregated).map(x=>({url:siteUrl+'/noticias/'+x.slug,lastModified:new Date(x.updatedAt),
      changeFrequency:'weekly' as const,priority:.7})),
    ...media.filter(m=>m.editorialBody&&m.editorialBody.length>=350&&m.sourceUrl)
      .map(m=>({url:siteUrl+'/filmes-series/'+mediaSlug(m.title),lastModified:new Date(m.updatedAt||Date.now()),
        changeFrequency:'weekly' as const,priority:.65})),
    ...games.map(g=>({url:siteUrl+'/futebol/'+g.slug,lastModified:new Date(g.date),
      changeFrequency:'daily' as const,priority:.7})),
  ];
}
