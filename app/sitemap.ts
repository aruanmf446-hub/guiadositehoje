import type { MetadataRoute } from 'next';
import { getPublishedNews } from '@/lib/content';
import { siteUrl } from '@/lib/seo';

export const revalidate = 900;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getPublishedNews(1000);
  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/noticias`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    ...articles.map(article => ({
      url: `${siteUrl}/noticias/${article.slug}`,
      lastModified: new Date(article.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
