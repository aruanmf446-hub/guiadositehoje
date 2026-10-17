import type {Metadata} from 'next';
import Link from 'next/link';
import {searchAll} from '@/lib/search';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
export const revalidate=0;
export const metadata:Metadata={
  title:'Pesquisar jogos, notícias, filmes e séries',
  description:'Busque partidas anteriores, próximas partidas, notícias e títulos no Guia de Hoje.',
  robots:{index:false,follow:true},
};
type Props={searchParams:Promise<{q?:string}>};
export default async function SearchPage({searchParams}:Props){
  const {q=''}=await searchParams;
  const query=typeof q==='string'?q.slice(0,90):'';
  const result=await searchAll(query);
  const total=result.matches.length+result.articles.length+result.titles.length;
  return <div className="site"><SiteHeader/>
    <main className="container search-page">
      <p className="eyebrow"><Link href="/">Início</Link> / Pesquisa</p>
      <h1>Encontre o que procura.</h1>
      <form action="/buscar" method="get" className="search-box search-box-large" role="search">
        <span aria-hidden="true">⌕</span>
        <input name="q" defaultValue={query} placeholder="Busque um time, notícia, filme ou série" minLength={2} required maxLength={70} aria-label="Termo de pesquisa"/>
        <button type="submit">Pesquisar <span aria-hidden="true">↗</span></button>
      </form>
      {!query.trim()?<p className="search-hint">Pesquise por um time, campeonato, manchete, filme ou série. Jogos encerrados também ficam disponíveis aqui.</p>:
      <p className="search-hint">{total} resultados para <strong>“{query}”</strong> {total===0?'— tente outro termo.':''}</p>}
      {result.matches.length>0&&<section className="search-results"><h2>Futebol <span>{result.matches.length}</span></h2>
        {result.matches.map(m=><Link className="result-row" href={'/futebol/'+m.slug} key={m.slug}>
          <div><small>{m.league}</small><strong>{m.home} x {m.away}</strong></div>
          <span>{new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(m.at))} <span aria-hidden="true">↗</span></span>
        </Link>)}</section>}
      {result.articles.length>0&&<section className="search-results"><h2>Notícias <span>{result.articles.length}</span></h2>
        {result.articles.map(a=><a className="result-row" key={a.id} href={a.isAggregated&&a.sourceUrl?a.sourceUrl:'/noticias/'+a.slug}
          {...(a.isAggregated&&a.sourceUrl?{target:'_blank',rel:'noopener noreferrer'}:{})}>
          <div><small>{a.sourceName||a.category}</small><strong>{a.headline}</strong></div><span aria-hidden="true">↗</span>
        </a>)}</section>}
      {result.titles.length>0&&<section className="search-results"><h2>Filmes e séries <span>{result.titles.length}</span></h2>
        {result.titles.map(t=><a className="result-row" key={t.id} href={t.watchUrl||t.sourceUrl||'/filmes-series'} target="_blank" rel="noopener noreferrer">
          <div><small>{t.kind} · {t.availabilityStatus==='schedule_br'?'Programação brasileira':'Disponibilidade a confirmar'}</small><strong>{t.title}</strong></div><span aria-hidden="true">↗</span>
        </a>)}</section>}
    </main><SiteFooter/>
  </div>;
}
