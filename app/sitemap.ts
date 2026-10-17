import type { MetadataRoute } from 'next';
import { getPublishedNews } from '@/lib/content';
import { getFootballSitemapEntries, getFootballCompetitions, getUpcomingGames } from '@/lib/football';
import { siteUrl } from '@/lib/seo';
export const revalidate=900;
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const [articles,games,competitions,upcoming]=await Promise.all([
    getPublishedNews(1000),getFootballSitemapEntries(),getFootballCompetitions(),getUpcomingGames(500),
  ]);
  return [
    {url:siteUrl,lastModified:new Date(),changeFrequency:'daily',priority:1},
    {url:siteUrl+'/noticias',lastModified:new Date(),changeFrequency:'daily',priority:.8},
    {url:siteUrl+'/futebol',lastModified:new Date(),changeFrequency:'daily',priority:.9},
    {url:siteUrl+'/futebol/onde-assistir',lastModified:new Date(),changeFrequency:'daily',priority:.8},
    ...competitions.filter(c=>upcoming.some(g=>g.competitionSlug===c.slug))
      .map(c=>({url:siteUrl+'/futebol/campeonatos/'+c.slug,lastModified:new Date(),
        changeFrequency:'daily' as const,priority:.8})),
    ...articles.map(x=>({url:siteUrl+'/noticias/'+x.slug,lastModified:new Date(x.updatedAt),
      changeFrequency:'weekly' as const,priority:.7})),
    ...games.map(g=>({url:siteUrl+'/futebol/'+g.slug,lastModified:new Date(g.date),
      changeFrequency:'daily' as const,priority:.7})),
  ];
}
