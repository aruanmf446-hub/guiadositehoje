import type {Metadata} from 'next';
import Link from 'next/link';
import {GamesSection} from '@/components/GamesSection';
import {NewsSection} from '@/components/NewsSection';
import {RecommendedGames} from '@/components/RecommendedGames';
import {WatchSection} from '@/components/WatchSection';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
import {getPublishedNews,getWatchTitles,todayInBrasilia} from '@/lib/content';
import {getUpcomingGames} from '@/lib/football';
import {siteName,siteUrl,siteDescription} from '@/lib/seo';

export const revalidate=60;
export const metadata:Metadata={
  title:'Guia de Hoje | Jogos de hoje, notícias, filmes e séries',
  description:'Jogos de futebol de hoje, últimas notícias, filmes em destaque, séries e onde assistir. Busque também partidas anteriores.',
  alternates:{canonical:'/'},
};
export default async function HomePage(){
  const [allGames,news,watchTitles]=await Promise.all([
    getUpcomingGames(500),getPublishedNews(7),getWatchTitles(),
  ]);
  const today=todayInBrasilia();
  const current=Date.now();
  const gamesToday=allGames.filter(g=>g.gameDate===today&&
    g.status!=='finished'&&g.status!=='cancelled'&&g.status!=='postponed'&&
    !!g.kickoffAt&&(
      new Date(g.kickoffAt).getTime()>=current ||
      (g.live&&new Date(g.kickoffAt).getTime()>current-3*3600_000)
    ));
  const recommended=allGames.filter(g=>g.gameDate!==today&&!!g.slug&&g.status!=='cancelled')
    .sort((a,b)=>{
      const priority=(g:typeof a)=>g.competitionSlug?.startsWith('brasileirao-serie-')?0:1;
      return priority(a)-priority(b)||(a.kickoffAt||'').localeCompare(b.kickoffAt||'');
    }).slice(0,4);
  const date=new Intl.DateTimeFormat('pt-BR',{
    weekday:'long',day:'numeric',month:'long',year:'numeric',
    timeZone:'America/Sao_Paulo',
  }).format(new Date());
  const jsonLD={'@context':'https://schema.org','@graph':[
    {'@type':'WebSite',name:siteName,url:siteUrl,inLanguage:'pt-BR',description:siteDescription,
      potentialAction:{'@type':'SearchAction',target:siteUrl+'/buscar?q={search_term_string}',
      'query-input':'required name=search_term_string'}},
    {'@type':'Organization',name:siteName,url:siteUrl},
  ]};
  return <div className="site" id="topo">
    <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html:JSON.stringify(jsonLD).replace(/</g,'\\u003c'),
    }}/>
    <SiteHeader/>
    <main className="container homepage">
      <section className="home-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="fresh-dot" aria-hidden="true"></span> {date}</div>
          <h1>Seu dia começa <em>bem informado.</em></h1>
          <p>O que acontece no futebol, as notícias mais recentes e boas ideias para assistir. Tudo no seu ritmo.</p>
          <form action="/buscar" method="get" role="search" className="search-box hero-search">
            <span className="search-symbol" aria-hidden="true">⌕</span>
            <input name="q" minLength={2} maxLength={70} required aria-label="Pesquisar no Guia de Hoje"
              placeholder="Busque times, notícias, filmes e séries"/>
            <button type="submit">Buscar <span aria-hidden="true">↗</span></button>
          </form>
          <div className="hero-hint">Jogos encerrados? <Link href="/buscar">Também estão na pesquisa ↗</Link></div>
        </div>
        <aside className="hero-panel editorial-hero-panel" aria-label="Matéria principal do dia">
          <div className="hero-panel-overline">DESTAQUE DA REDAÇÃO <span>·</span> GUIA DE HOJE</div>
          {news[0] ? <>
            <span className="hero-category">{news[0].category}</span>
            <strong>{news[0].headline}</strong>
            <p>{news[0].summary}</p>
            <Link href={'/noticias/'+news[0].slug}>Ler matéria completa <span aria-hidden="true">↗</span></Link>
          </> : <>
            <strong>Informação antes do ruído.</strong>
            <p>Os principais acontecimentos organizados para você entender o que importa.</p>
            <Link href="/noticias">Últimas matérias <span aria-hidden="true">↗</span></Link>
          </>}
        </aside>
      </section>
      <GamesSection games={gamesToday}/>
      <NewsSection news={news}/>
      <WatchSection titles={watchTitles}/>
      <RecommendedGames games={recommended}/>
    </main>
    <SiteFooter/>
  </div>;
}
