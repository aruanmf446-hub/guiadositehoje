import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getArticle } from '@/lib/content';
import { siteName, siteUrl } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Notícia não encontrada', robots: { index: false, follow: false } };
  return {
    title: article.headline,
    description: article.summary,
    robots: article.isAggregated ? {index:false,follow:true} : {index:true,follow:true},
    alternates: { canonical: `/noticias/${article.slug}` },
    openGraph: {
      type: 'article', locale: 'pt_BR',
      title: article.headline, description: article.summary,
      url: `/noticias/${article.slug}`,
      publishedTime: article.publishedAt, modifiedTime: article.updatedAt,
      images: article.imageUrl ? [{ url: article.imageUrl, alt: article.imageAlt || article.headline }] : undefined,
    },
    twitter: { card: 'summary_large_image', title: article.headline, description: article.summary },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();
  const url = `${siteUrl}/noticias/${article.slug}`;
  const schema = article.isAggregated ? null : {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.headline,
    description: article.summary,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: 'pt-BR',
    articleSection: article.category,
    author: { '@type': 'Organization', name: siteName, url: siteUrl },
    publisher: { '@type': 'Organization', name: siteName, url: siteUrl },
    ...(article.imageUrl ? { image: [article.imageUrl] } : {}),
  };
  return <div className="site">
    {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html:JSON.stringify(schema).replace(/</g, '\\u003c'),
    }}/>} 
    <SiteHeader />
    <main className="container article-container">
      <nav className="article-breadcrumb" aria-label="Localização">
        <Link href="/">Início</Link> / <Link href="/noticias">Notícias</Link> / {article.category}
      </nav>
      <article className="article-detail">
        <span className="kicker">{article.category}</span>
        <h1>{article.headline}</h1>
        <p className="article-summary">{article.summary}</p>
        <time dateTime={article.publishedAt}>
          Publicado em {new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short',
          }).format(new Date(article.publishedAt))}
        </time>
        {article.imageUrl && <figure className="article-figure">
          <img src={article.imageUrl} alt={article.imageAlt || article.headline} />
          {article.imageAlt && <figcaption>{article.imageAlt}</figcaption>}
        </figure>}
        <div className="article-content">{article.body.split(/\n{2,}/).map((paragraph, i) =>
          <p key={i}>{paragraph}</p>)}</div>
        {article.sourceUrl && <p className="article-source">
          Fonte: <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">
            {article.sourceName || 'Fonte original'} ↗
          </a>
        </p>}
      </article>
      <Link className="all-news-link" href="/noticias">← Ver mais notícias</Link>
    </main>
    <SiteFooter />
  </div>;
}
