import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGameBySlug } from '@/lib/football';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { siteName, siteUrl } from '@/lib/seo';

type Props={params:Promise<{slug:string}>};
export const revalidate=300;
const dateText=(iso:string)=>new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',dateStyle:'full',timeStyle:'short'
}).format(new Date(iso));

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {slug}=await params;
  const game=await getGameBySlug(slug);
  if(!game || !game.kickoffAt) return {title:'Partida não encontrada',robots:{index:false,follow:false}};
  const title=`${game.home} x ${game.away}: horário, data e onde assistir`;
  const desc=game.seoDescription ||
    `${game.home} x ${game.away} pela ${game.league} em ${dateText(game.kickoffAt)}. ${game.broadcast ? 'Onde assistir: '+game.broadcast : 'Transmissão a confirmar'}.`;
  return {
    title,description:desc.slice(0,290),
    alternates:{canonical:`/futebol/${slug}`},
    openGraph:{type:'article',title,description:desc.slice(0,290),url:`/futebol/${slug}`,locale:'pt_BR',siteName},
    twitter:{card:'summary',title,description:desc.slice(0,200)},
  };
}
export default async function FootballMatchPage({params}:Props){
  const {slug}=await params;const game=await getGameBySlug(slug);
  if(!game || !game.kickoffAt)notFound();
  const sourceIsSafe=game.broadcastSource && game.broadcastSource.startsWith('https://');
  const matchUrl=`${siteUrl}/futebol/${slug}`;
  const schema={
    '@context':'https://schema.org','@type':'SportsEvent','@id':matchUrl,
    name:`${game.home} x ${game.away} - ${game.league}`,
    description:game.seoDescription || `Confronto de futebol válido por ${game.league}`,
    url:matchUrl,startDate:game.kickoffAt,
    eventStatus:game.status==='cancelled'?'https://schema.org/EventCancelled':
      game.status==='postponed'?'https://schema.org/EventPostponed':'https://schema.org/EventScheduled',
    competitor:[
      {'@type':'SportsTeam',name:game.home},
      {'@type':'SportsTeam',name:game.away},
    ],
    sport:'Futebol',
    ...(game.broadcast ? {subjectOf:{
      '@type':'BroadcastEvent',broadcastOfEvent:{'@id':matchUrl},
      broadcastService:{'@type':'BroadcastService',name:game.broadcast},
    }} : {}),
  };
  return <div className="site">
    <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html:JSON.stringify(schema).replace(/</g,'\\u003c'),
    }}/>
    <SiteHeader/>
    <main className="container article-container">
      <nav className="article-breadcrumb" aria-label="Localização">
        <Link href="/">Início</Link> / <Link href="/futebol">Futebol</Link> / {game.league}
      </nav>
      <article className="article-detail">
        <span className="kicker">{game.league}</span>
        <h1>{game.home} x {game.away}</h1>
        <p className="article-summary">Data, horário e transmissão no Brasil</p>
        <div className="football-details">
          <p><strong>Data e hora:</strong> <time dateTime={game.kickoffAt}>{dateText(game.kickoffAt)} (horário de Brasília)</time></p>
          <p><strong>Campeonato:</strong> {game.league}</p>
          <p><strong>Onde assistir:</strong> {game.broadcast || 'Transmissão a confirmar'}</p>
          {game.showScore && game.homeScore!==undefined && game.awayScore!==undefined &&
            <p><strong>Placar:</strong> {game.homeScore} x {game.awayScore}</p>}
          {game.status==='postponed' && <p>Partida adiada. O calendário pode mudar.</p>}
          {game.status==='cancelled' && <p>Partida cancelada.</p>}
        </div>
        <p className="article-content">{game.seoDescription ||
          `Confira ${game.home} x ${game.away} pela ${game.league}.`}</p>
        <p className="football-disclaimer">As informações são atualizadas automaticamente. Horários e canais podem mudar. Transmissões de outros países não são consideradas confirmações para o Brasil.</p>
        {sourceIsSafe && <p className="article-source">Programação informada por <a href={game.broadcastSource} target="_blank" rel="noopener noreferrer">fonte consultada ↗</a></p>}
        {game.sourceUrl?.startsWith('https://') && <p className="article-source">
          <a href={game.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar calendário da partida ↗</a>
        </p>}
      </article>
      <Link href="/futebol" className="all-news-link">← Todos os jogos</Link>
    </main>
    <SiteFooter/>
  </div>;
}
