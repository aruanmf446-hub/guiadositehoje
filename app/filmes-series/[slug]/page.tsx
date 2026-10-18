import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getWatchTitles} from '@/lib/content';
import {mediaSlug,mediaHref,mediaHasEditorial,mediaImage} from '@/lib/media';
import {siteUrl,siteName} from '@/lib/seo';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
type Props={params:Promise<{slug:string}>};
export const revalidate=600;
const validSource=(url:string|undefined)=>url?.startsWith('https://')?url:null;
async function getMedia(slug:string){
 const list=await getWatchTitles();
 const item=list.find(x=>mediaSlug(x.title)===slug)||null;
 return {item,related:item?list.filter(x=>x.kind===item.kind&&x.id!==item.id).slice(0,4):[]};
}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug}=await params;
 const {item}=await getMedia(slug);
 if(!item)return {title:'Título não encontrado',robots:{index:false,follow:false}};
 const desc=item.seoDescription||item.synopsis||'Ficha do Guia de Hoje';
 const image=mediaImage(item);
 return {
  title:item.seoTitle||item.title,
  description:desc,
  robots:{index:mediaHasEditorial(item),follow:true},
  alternates:{canonical:mediaHref(item)},
  openGraph:{type:'article',locale:'pt_BR',siteName,title:item.seoTitle||item.title,description:desc,
   url:mediaHref(item),images:image?[{url:image,alt:item.title}]:undefined},
  twitter:{card:image?'summary_large_image':'summary',title:item.title,description:desc}
 };
}
export default async function MediaDetail({params}:Props){
 const {slug}=await params;
 const {item,related}=await getMedia(slug);
 if(!item)notFound();
 const source=validSource(item.sourceUrl);
 const image=mediaImage(item);
 const isSeries=item.kind!=='Filmes';
 const url=siteUrl+mediaHref(item);
 const schema={
  '@context':'https://schema.org','@type':isSeries?'TVSeries':'Movie',
  '@id':url,url,name:item.title,inLanguage:'pt-BR',
  description:item.synopsis||item.seoDescription||item.title,
  mainEntityOfPage:{'@type':'WebPage','@id':url},
  ...(image?{image}:{})
 };
 return <div className="site">
  {mediaHasEditorial(item)&&<script type="application/ld+json"
   dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/>}
  <SiteHeader/>
  <main className="container media-detail-page">
   <nav className="article-breadcrumb" aria-label="Localização"><Link href="/">Início</Link> / <Link href="/filmes-series">Filmes e séries</Link> / {item.title}</nav>
   <header className="media-detail-header">
    <div className="media-detail-copy">
     <span className="section-eyebrow">{isSeries?'SÉRIES':'CINEMA'} / GUIA DE HOJE</span>
     <h1>{item.title}</h1>
     <p className="media-detail-summary">{item.synopsis||'Acompanhe as informações desta produção.'}</p>
     <div className="media-detail-check"><span className="media-detail-check-icon">✓</span><div>
      <strong>Onde assistir no Brasil?</strong>
      <p>{item.availabilityStatus==='schedule_br'?'Programação brasileira identificada; confira a fonte.':
        'Transmissão ou streaming no Brasil ainda não confirmado por fonte verificável.'}</p>
     </div></div>
     <a href="#sobre" className="media-detail-anchor">Conheça esta produção <span aria-hidden="true">↓</span></a>
    </div>
    {image?<figure className="media-detail-visual has-image">
     <img src={image} alt={'Imagem da produção '+item.title}/>
     <figcaption className="visual-credit">{item.posterCreditUrl?.startsWith('https://')?
       <a href={item.posterCreditUrl} target="_blank" rel="noopener noreferrer">{item.posterCredit||'Crédito da imagem'} ↗</a>:
       item.posterCredit||'Imagem disponibilizada pela fonte'}</figcaption>
    </figure>:<div className="media-detail-visual media-no-photo"><span>Imagem oficial não disponível</span></div>}
   </header>
   <div className="media-detail-layout">
    <article className="media-detail-article" id="sobre">
     <span className="section-eyebrow">SOBRE A PRODUÇÃO</span>
     <h2>{isSeries?'Conheça a série':'O que saber sobre o filme'}</h2>
     {(item.editorialBody||'As informações disponíveis estão sendo verificadas.').split(/\n\n+/).map((p,i)=><p key={i}>{p}</p>)}
     <h2>Quando e onde assistir?</h2>
     <p>O Guia de Hoje acompanha informações públicas sobre esta obra. Só exibimos uma plataforma brasileira quando ela tiver sido confirmada. Sem essa confirmação, não presumimos que uma produção esteja disponível em serviços de assinatura, aluguel ou cinemas no país.</p>
     <div className="media-source-box"><span>FONTE E TRANSPARÊNCIA</span>
      <p>Os dados de identificação da produção foram organizados pelo Guia de Hoje a partir de uma referência pública. As informações de distribuição podem mudar.</p>
      {source&&<a href={source} target="_blank" rel="noopener noreferrer">Consultar {isSeries?'ficha da série':'ficha da produção'} na fonte original ↗</a>}
     </div>
    </article>
    <aside className="media-related" aria-label="Você também pode gostar">
     <h2>Descubra também<span>.</span></h2>
     {related.map((x,i)=><Link key={x.id} href={mediaHref(x)}>
      <span>{String(i+1).padStart(2,'0')} / {x.kind==='Filmes'?'CINEMA':'SÉRIES'}</span>
      <strong>{x.title}</strong><span className="media-related-arrow">↗</span>
     </Link>)}
     <Link className="media-related-all" href="/filmes-series">Ver todos os filmes e séries ↗</Link>
    </aside>
   </div>
  </main><SiteFooter/>
 </div>;
}
