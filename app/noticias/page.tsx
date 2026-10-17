import type {Metadata} from 'next';
import Link from 'next/link';
import {SiteFooter} from '@/components/SiteFooter';
import {SiteHeader} from '@/components/SiteHeader';
import {getPublishedNews} from '@/lib/content';
import type {NewsItem} from '@/lib/data';
export const revalidate=120;
export const metadata:Metadata={
 title:'Notícias e análises do Brasil e do mundo',
 description:'Cobertura editorial do Guia de Hoje com notícias explicadas, contexto, leitura clara e referências às fontes de cada matéria.',
 alternates:{canonical:'/noticias'},
};
const date=(iso:string)=>new Intl.DateTimeFormat('pt-BR',{
 day:'numeric',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'
}).format(new Date(iso));
function Lead({item}:{item:NewsItem}){
 return <article className="archive-feature">
  <div className="archive-feature-top">EM DESTAQUE <span>·</span> {item.category}</div>
  <h2><Link href={'/noticias/'+item.slug}>{item.headline}</Link></h2>
  <p>{item.summary}</p>
  <div className="archive-feature-bottom"><span>{date(item.publishedAt)} · Leitura no Guia de Hoje</span>
  <Link href={'/noticias/'+item.slug}>Ler matéria <span aria-hidden="true">↗</span></Link></div>
 </article>;
}
export default async function NewsArchivePage(){
 const articles=await getPublishedNews(80);
 const [lead,...others]=articles;
 return <div className="site"><SiteHeader/>
  <main className="container editorial-archive">
   <nav className="article-breadcrumb"><Link href="/">Início</Link> / Notícias</nav>
   <div className="archive-title-row"><div><span className="section-eyebrow">NOTICIÁRIO / GUIA DE HOJE</span>
    <h1>Histórias que<br/><em>merecem atenção.</em></h1></div>
    <p>Informação com contexto, escrita própria e fontes identificadas. Sem confundir o noticiário com uma lista de links.</p>
   </div>
   {lead?<><Lead item={lead}/><section className="news-index">
    <div className="news-index-title"><h2>Outras notícias</h2><span>Arquivo editorial</span></div>
    {others.map((item,i)=><article className="news-index-row" key={item.id}>
      <span className="index-number">{String(i+2).padStart(2,'0')}</span>
      <div className="index-copy"><span className="story-kicker">{item.category} · {date(item.publishedAt)}</span>
        <h3><Link href={'/noticias/'+item.slug}>{item.headline}</Link></h3>
        <p>{item.summary}</p></div>
      <Link href={'/noticias/'+item.slug} aria-label={'Ler '+item.headline} className="index-arrow">↗</Link>
    </article>)}
   </section></>:<p className="archive-empty">Novas matérias estão sendo preparadas pela redação.</p>}
  </main><SiteFooter/>
 </div>;
}
