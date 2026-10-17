import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getCompetitionGames,getFootballCompetitions } from '@/lib/football';
import { siteName,siteUrl } from '@/lib/seo';

type Props={params:Promise<{slug:string}>};
export const revalidate=300;
const dateText=(iso:string)=>new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',weekday:'long',day:'2-digit',month:'long'
}).format(new Date(iso));
async function findCompetition(slug:string){
  const comps=await getFootballCompetitions();
  return comps.find(c=>c.slug===slug);
}
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {slug}=await params;
  const comp=await findCompetition(slug);
  if(!comp)return {title:'Competição não encontrada',robots:{index:false,follow:false}};
  const games=await getCompetitionGames(slug);
  const name=comp.name;
  const year=new Intl.DateTimeFormat('en-US',{year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date());
  return {
    title:`${name} ${year}: próximos jogos, horários e transmissões`,
    description:comp.description,
    alternates:{canonical:`/futebol/campeonatos/${comp.slug}`},
    robots:games.length?{index:true,follow:true}:{index:false,follow:true},
    openGraph:{title:`${name} — jogos e onde assistir | ${siteName}`,
      description:comp.description,url:`/futebol/campeonatos/${comp.slug}`,type:'website',locale:'pt_BR'},
  };
}
export default async function CompetitionPage({params}:Props){
  const {slug}=await params;
  const comp=await findCompetition(slug);
  if(!comp)notFound();
  const games=await getCompetitionGames(slug);
  const pageUrl=`${siteUrl}/futebol/campeonatos/${slug}`;
  const schema={
    '@context':'https://schema.org','@type':'CollectionPage',
    name:`${comp.name}: próximos jogos e transmissões`,
    description:comp.description,url:pageUrl,
    isPartOf:{'@type':'WebSite',name:siteName,url:siteUrl},
    mainEntity:{'@type':'ItemList',
      itemListElement:games.slice(0,80).map((g,i)=>({
        '@type':'ListItem',position:i+1,name:`${g.home} x ${g.away}`,
        url:`${siteUrl}/futebol/${g.slug}`,
      })),
    },
  };
  return <div className="site">
    <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html:JSON.stringify(schema).replace(/</g,'\\u003c'),
    }}/>
    <SiteHeader/>
    <main className="container article-container">
      <nav className="article-breadcrumb" aria-label="Localização">
        <Link href="/">Início</Link> / <Link href="/futebol">Futebol</Link> / {comp.name}
      </nav>
      <span className="kicker">Campeonato Brasileiro</span>
      <h1 className="archive-title">{comp.name}</h1>
      <p className="lead">{comp.description}</p>
      <p className="football-disclaimer">Jogos dos próximos sete dias, em horário de Brasília.
        A programação e os canais podem ser alterados. Só exibimos emissoras brasileiras quando identificadas pela fonte.</p>
      {games.length?<div className="football-grid" style={{marginTop:28}}>
        {games.map(g=><article className="football-tile" key={g.id}>
          <span className="kicker">{dateText(g.kickoffAt||'')}</span>
          <h2><Link href={`/futebol/${g.slug}`}>{g.home} x {g.away}</Link></h2>
          <p><time dateTime={g.kickoffAt}>{g.time} (Brasília)</time></p>
          <p className={g.broadcast?'broadcast-confirmed':'broadcast-pending'}>
            {g.broadcast?'Onde assistir: '+g.broadcast:'Transmissão a confirmar'}
          </p>
          <Link className="all-news-link" href={`/futebol/${g.slug}`}>Informações e fonte →</Link>
        </article>)}
      </div>:<p className="empty archive-empty">
        Nenhuma partida confirmada desta competição nos próximos sete dias.
        O calendário será atualizado quando a fonte disponibilizar jogos.</p>}
      <p><Link className="all-news-link" href="/futebol">← Ver todos os campeonatos</Link></p>
    </main>
    <SiteFooter/>
  </div>;
}
