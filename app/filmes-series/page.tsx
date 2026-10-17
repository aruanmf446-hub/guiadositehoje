import type {Metadata} from 'next';
import Link from 'next/link';
import {getWatchTitles} from '@/lib/content';
import type {WatchTitle} from '@/lib/data';
import {mediaHref,mediaImage} from '@/lib/media';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
export const revalidate=600;
export const metadata:Metadata={
 title:'Filmes e séries: sinopses, lançamentos e onde assistir',
 description:'Confira o guia de filmes e séries: páginas próprias com informações das obras, referências e disponibilidade de exibição no Brasil quando confirmada.',
 alternates:{canonical:'/filmes-series'},
};
function Group({title,id,items}:{title:string;id:string;items:WatchTitle[]}){
 return <section className="media-archive-section" id={id}>
  <div className="media-archive-section-heading">
   <div><span className="section-eyebrow">GUIA DE HOJE / ENTRETENIMENTO</span><h2>{title}</h2></div>
   <span>{items.length} SELECIONADOS</span>
  </div>
  {items.length===0?<p>Novas fichas estão em preparação.</p>:
   <div className="media-archive-grid">{items.map((item,i)=><Link href={mediaHref(item)} className="media-archive-card" key={item.id}>
    <div className={'media-archive-art '+(mediaImage(item)?'has-cover':'')}>
     {mediaImage(item)?<img src={mediaImage(item)} alt={'Imagem de '+item.title} loading="lazy"/>:
     <><span className="media-archive-symbol">✳</span><span className="media-archive-art-title">{item.title}</span>
      <span className="media-archive-art-bottom">CINEMA / GUIA DE HOJE</span></>}
    </div>
    <div className="media-archive-info"><span className="media-archive-number">{String(i+1).padStart(2,'0')} · {item.kind==='Filmes'?'FILME':'SÉRIE'}</span>
     <h3>{item.title}</h3><p>{item.synopsis||'Conheça a ficha e as informações de produção.'}</p>
     <span className="media-archive-link">Ler guia completo <span aria-hidden="true">↗</span></span>
    </div>
   </Link>)}</div>}
 </section>;
}
export default async function MediaArchive(){
 const data=await getWatchTitles();
 return <div className="site"><SiteHeader/><main className="container media-archive-page">
  <nav className="article-breadcrumb"><Link href="/">Início</Link> / Cultura e entretenimento</nav>
  <header className="media-archive-hero"><div><span className="section-eyebrow">CULTURA / GUIA DE HOJE</span>
   <h1>O que vale<br/><em>assistir.</em></h1></div>
   <p>Filmes, séries e histórias para descobrir. Cada título tem uma página própria com sinopse, contexto e referência. Indicamos streaming no Brasil somente quando houver confirmação.</p>
  </header>
  <nav className="media-archive-jump" aria-label="Ir para categoria">
   <a href="#filmes">Explorar filmes ↗</a><a href="#series">Explorar séries ↗</a>
  </nav>
  <Group id="filmes" title="Na tela grande" items={data.filter(x=>x.kind==='Filmes')}/>
  <Group id="series" title="Para maratonar" items={data.filter(x=>x.kind!=='Filmes')}/>
 </main><SiteFooter/></div>;
}
