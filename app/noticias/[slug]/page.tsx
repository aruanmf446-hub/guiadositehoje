import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getArticle } from '@/lib/content';
import {editorialCover,editorialCoverCredit} from '@/lib/capas';
import { siteName, siteUrl } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Notícia não encontrada', robots: { index: false, follow: false } };
  return {
    title: article.seoTitle||article.headline,
    description: article.seoDescription||article.summary,
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
    description: article.seoDescription||article.summary,
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
      <article className="article-detail news-article">
        <div className="news-article-kicker"><span>{article.category}</span><span>Redação Guia de Hoje</span></div>
        <h1>{article.headline}</h1>
        <p className="article-summary">{article.summary}</p>
        <time className="news-article-date" dateTime={article.publishedAt}>
          Publicado em {new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short',
          }).format(new Date(article.publishedAt))}
        </time>
        <figure className="article-figure editorial-figure">
          <img src={article.imageUrl||editorialCover('noticia',article.headline)}
            alt={article.imageAlt||'Capa editorial ilustrativa de '+article.headline}/>
          <figcaption>{article.imageUrl?
            (article.imageCreditUrl?.startsWith('https://')?
              <a href={article.imageCreditUrl} target="_blank" rel="noopener noreferrer">{article.imageCredit||'Crédito da imagem na fonte'} ↗</a>:
              article.imageCredit||'Imagem de origem identificada'):
            editorialCoverCredit}</figcaption>
        </figure>
        <div className="article-content editorial-article-body">{article.body.split(/\n{2,}/).map((paragraph, i) =>
          paragraph.startsWith('## ')?<h2 key={i}>{paragraph.slice(3)}</h2>:
          <p key={i}>{paragraph}</p>)}</div>
        {article.generatedByAi&&<p className="editorial-transparency">
          Conteúdo elaborado com apoio de IA, com base em material da fonte identificada abaixo.
          Informações sujeitas a atualização.
        </p>}
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
