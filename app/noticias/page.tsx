import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getPublishedNews } from '@/lib/content';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Últimas notícias',
  description: 'Últimas notícias e destaques de fontes reconhecidas, com acesso à reportagem original e horário de publicação.',
  alternates: { canonical: '/noticias' },
  openGraph: { title: 'Últimas notícias | Guia de Hoje', url: '/noticias', type: 'website' },
};

export default async function NewsArchivePage() {
  const articles = await getPublishedNews(60);
  return <div className="site">
    <SiteHeader />
    <main className="container article-container">
      <p className="eyebrow"><Link href="/">Início</Link> / Notícias</p>
      <h1 className="archive-title">Últimas notícias</h1>
      <p className="lead">Notícias recentes selecionadas de fontes identificadas. Acesse a cobertura completa nas publicações originais.</p>
      {!articles.length ? <p className="empty archive-empty">Ainda não há notícias publicadas.</p> : (
        <div className="archive-grid">{articles.map(article =>
          <article key={article.id} className="archive-card">
            <span className="kicker">{article.sourceName||article.category}</span>
            <h2>{article.isAggregated&&article.sourceUrl?
              <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">{article.headline} ↗</a>:
              <Link href={`/noticias/${article.slug}`}>{article.headline}</Link>}</h2>
            <p>{article.summary}</p>
            <time dateTime={article.publishedAt}>
              {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(article.publishedAt))}
            </time>
          </article>)}</div>
      )}
    </main>
    <SiteFooter />
  </div>;
}
