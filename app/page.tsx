import type { Metadata } from 'next';
import { GamesSection } from '@/components/GamesSection';
import { NewsSection } from '@/components/NewsSection';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { WatchSection } from '@/components/WatchSection';
import { getPublishedNews, getTodaysGames, getWatchTitles } from '@/lib/content';
import { siteDescription, siteName, siteUrl } from '@/lib/seo';

export const revalidate = 300;
export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
  const [games, news, watchTitles] = await Promise.all([
    getTodaysGames(), getPublishedNews(6), getWatchTitles(),
  ]);
  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: siteName, url: siteUrl, inLanguage: 'pt-BR', description: siteDescription },
      { '@type': 'Organization', name: siteName, url: siteUrl },
    ],
  };

  return (
    <div className="site" id="topo">
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
      }} />
      <SiteHeader />
      <main className="container">
        <section className="intro">
          <span className="eyebrow">{today}</span>
          <h1 className="hero-title">Tudo o que importa hoje, num só lugar.</h1>
          <p className="lead">
            Os jogos do dia, as notícias e onde assistir aos melhores filmes, séries e programas.
          </p>
        </section>
        <GamesSection games={games} />
        <NewsSection news={news} />
        <WatchSection titles={watchTitles} />
      </main>
      <SiteFooter />
    </div>
  );
}
