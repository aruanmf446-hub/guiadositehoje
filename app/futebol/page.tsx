import type { Metadata } from 'next';
import Link from 'next/link';
import { getUpcomingGames } from '@/lib/football';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Jogos de futebol dos próximos 7 dias: horários e transmissões',
  description: 'Veja os jogos de futebol de hoje e dos próximos 7 dias. Confira campeonatos, datas, horários de Brasília e onde assistir quando houver transmissão confirmada.',
  alternates: { canonical: '/futebol' },
  openGraph: { title: 'Próximos jogos de futebol | Guia de Hoje', url: '/futebol' },
};
const dateLabel=(day:string)=>new Intl.DateTimeFormat('pt-BR',{
  day:'2-digit',month:'long',weekday:'long',timeZone:'UTC'
}).format(new Date(day+'T12:00:00Z'));

export default async function FootballPage() {
  const games=await getUpcomingGames();
  const grouped = Object.entries(Object.groupBy(games, g => g.gameDate || ''));
  return <div className="site">
    <SiteHeader />
    <main className="container article-container">
      <p className="eyebrow"><Link href="/">Início</Link> / Futebol</p>
      <h1 className="archive-title">Futebol nos próximos dias</h1>
      <p className="lead">Confrontos e horários de Brasília com até sete dias de antecedência. Transmissões identificadas para o Brasil aparecem como confirmadas; canais ainda não divulgados ficam pendentes.</p>
      <p style={{marginTop:16}}><Link className="all-news-link" href="/futebol/onde-assistir">Jogos com transmissão confirmada →</Link></p>
      {games.length===0 ? <p className="empty archive-empty">Ainda não há partidas confirmadas na base. O coletor automático fará novas verificações.</p> :
      grouped.map(([day, items]) => <section key={day} className="football-day" aria-label={dateLabel(day)}>
        <h2>{dateLabel(day)}</h2>
        <div className="football-grid">{items?.map(game=>
          <article className="football-tile" key={game.id}>
            <span className="kicker">{game.league}</span>
            <h3><Link href={`/futebol/${game.slug}`}>{game.home} x {game.away}</Link></h3>
            <p><time dateTime={game.kickoffAt}>{game.time} — horário de Brasília</time></p>
            <p className={game.broadcast ? 'broadcast-confirmed' : 'broadcast-pending'}>
              {game.broadcast ? `Onde assistir: ${game.broadcast}` : 'Transmissão a confirmar'}
            </p>
            <Link className="all-news-link" href={`/futebol/${game.slug}`}>Detalhes da partida →</Link>
          </article>)}</div>
      </section>)}
      <p className="football-disclaimer">Dados sujeitos a mudanças de calendário e direitos de transmissão. Consulte também as fontes oficiais antes da partida.</p>
    </main>
    <SiteFooter />
  </div>;
}
