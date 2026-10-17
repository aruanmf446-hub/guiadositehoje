import type { Metadata } from 'next';
import Link from 'next/link';
import { getUpcomingGames } from '@/lib/football';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

export const revalidate=300;
export const metadata: Metadata = {
  title: 'Onde assistir futebol: jogos e transmissões confirmadas',
  description: 'Encontre jogos dos próximos dias com transmissão anunciada para o Brasil, horário de Brasília e links para cada partida.',
  alternates: { canonical: '/futebol/onde-assistir' },
};
export default async function BroadcastPage() {
  const games=(await getUpcomingGames()).filter(x=>x.broadcast && x.broadcastStatus==='confirmed');
  return <div className="site">
    <SiteHeader />
    <main className="container article-container">
      <p className="eyebrow"><Link href="/">Início</Link> / <Link href="/futebol">Futebol</Link> / Onde assistir</p>
      <h1 className="archive-title">Onde assistir futebol</h1>
      <p className="lead">Somente transmissões confirmadas para o público brasileiro. Canais de outros países não são apresentados como disponíveis no Brasil.</p>
      {games.length ? <div className="football-grid" style={{marginTop:28}}>{games.map(g=>
        <article key={g.id} className="football-tile">
          <span className="kicker">{g.league}</span>
          <h2><Link href={`/futebol/${g.slug}`}>{g.home} x {g.away}</Link></h2>
          <p><time dateTime={g.kickoffAt}>{g.gameDate?.split('-').reverse().join('/')} às {g.time} (Brasília)</time></p>
          <p className="broadcast-confirmed">{g.broadcast}</p>
          <Link href={`/futebol/${g.slug}`} className="all-news-link">Detalhes e fonte →</Link>
        </article>)}</div> :
        <p className="empty archive-empty">Não há transmissões brasileiras confirmadas na base neste momento. <Link className="all-news-link" href="/futebol">Veja os jogos programados.</Link></p>}
      <p className="football-disclaimer">A programação das emissoras pode sofrer alterações.</p>
    </main>
    <SiteFooter />
  </div>;
}
