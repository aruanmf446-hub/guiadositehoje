import type {Metadata} from 'next';
import Link from 'next/link';
import {getWatchTitles} from '@/lib/content';
import type {WatchTitle} from '@/lib/data';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
export const revalidate=600;
export const metadata:Metadata={
 title:'Filmes de 2026 e séries em destaque',
 description:'Veja seleções de filmes, estreias e séries com fichas e programação identificadas. A disponibilidade de streaming no Brasil é indicada somente com confirmação.',
 alternates:{canonical:'/filmes-series'},
};
function Group({title,id,items}:{title:string;id:string;items:WatchTitle[]}){
 return <section className="catalog-editorial-group" id={id}>
  <div className="catalog-editorial-heading"><div><span className="section-eyebrow">CATÁLOGO / GUIA DE HOJE</span><h2>{title}</h2></div>
  <span>{items.length} TÍTULOS</span></div>
  {!items.length?<p>Nenhum título verificado.</p>:<div className="catalog-editorial-list">{items.map((item,i)=>
   <article key={item.id} className="catalog-editorial-item">
     <span className="catalog-index">{String(i+1).padStart(2,'0')}</span>
     <div><h3>{item.title.replace(/\s*\(\d{4} film\)$/i,'')}</h3>
       <p>{item.synopsis||'Consulte a ficha e informações de lançamento na fonte identificada.'}</p>
       <div className="catalog-tags"><span>{item.kind}</span>
         <span>{item.availabilityStatus==='schedule_br'?'Programação no Brasil':'Streaming no Brasil não confirmado'}</span></div>
     </div>
     {item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="catalog-source" aria-label={'Consultar ficha de '+item.title}>Ver ficha ↗</a>}
   </article>)}</div>}
 </section>;
}
export default async function MediaArchive(){
 const data=await getWatchTitles();
 return <div className="site"><SiteHeader/><main className="container catalog-editorial">
  <nav className="article-breadcrumb"><Link href="/">Início</Link> / Cultura e entretenimento</nav>
  <div className="catalog-intro"><span className="section-eyebrow">CULTURA / FILMES E SÉRIES</span>
    <h1>Uma história de cada vez<span className="heading-dot">.</span></h1>
    <p>Uma seleção de produções para descobrir e acompanhar. Consulte as fichas, sinopses e atualizações da programação, sem confundir lançamento com disponibilidade no streaming brasileiro.</p>
  </div>
  <Group id="filmes" title="Filmes em destaque" items={data.filter(x=>x.kind==='Filmes')}/>
  <Group id="series" title="Séries e programas" items={data.filter(x=>x.kind!=='Filmes')}/>
 </main><SiteFooter/></div>;
}
