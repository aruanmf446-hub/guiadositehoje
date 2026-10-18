'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {WatchTitle,WatchKind} from '@/lib/data';
import {mediaHref,mediaImage} from '@/lib/media';
function Cover({item,className=''}:{item:WatchTitle;className?:string}){
 const url=mediaImage(item);
 if(!url)return <div className={'media-no-photo '+className}><span>Imagem oficial não disponível</span></div>;
 return <figure className={'film-cover film-cover-real '+className} aria-label={'Fotografia de '+item.title}>
  <img src={url} alt={'Imagem da produção '+item.title} loading="lazy"/>
  <figcaption className="cover-caption">{item.posterCreditUrl?
   <a href={item.posterCreditUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>
    {item.posterCredit||'Crédito da imagem'} ↗</a>:
   item.posterCredit||'Imagem disponibilizada pela fonte'}</figcaption>
 </figure>;
}
export function WatchSection({titles}:{titles:WatchTitle[]}){
 const [kind,setKind]=useState<WatchKind>('Filmes');
 const items=titles.filter(t=>t.kind===kind).sort((a,b)=>Number(Boolean(mediaImage(b)))-Number(Boolean(mediaImage(a))));
 const [featured,...others]=items;
 return <section id="assistir" className="home-section watch-edit-section" aria-labelledby="watch-heading">
  <div className="editorial-section-head">
   <div><div className="section-eyebrow">CINEMA / SÉRIES / GUIA CULTURAL</div>
    <h2 id="watch-heading">Histórias para descobrir<span className="heading-dot">.</span></h2>
    <p>Escolhas da redação, com fichas individuais e informações de exibição identificadas.</p>
   </div>
   <Link className="text-link" href="/filmes-series">Abrir guia completo <span aria-hidden="true">↗</span></Link>
  </div>
  <div className="film-tabs" role="group" aria-label="Seleção de entretenimento">
   <button type="button" aria-pressed={kind==='Filmes'} onClick={()=>setKind('Filmes')}>Filmes</button>
   <button type="button" aria-pressed={kind==='Séries'} onClick={()=>setKind('Séries')}>Séries</button>
  </div>
  {!featured?<p className="no-games">A seleção de {kind.toLowerCase()} será atualizada em breve.</p>:
   <div className="watch-feature-layout">
    <Link className="watch-featured-link" href={mediaHref(featured)}>
     <Cover item={featured} className="watch-feature-cover"/>
     <div className="watch-feature-caption"><span>ESCOLHA DO GUIA · {kind.toUpperCase()}</span>
      <h3>{featured.title}</h3>
      <p>{featured.synopsis}</p>
      <strong>Conheça a produção <span aria-hidden="true">↗</span></strong></div>
    </Link>
    <div className="watch-small-grid">
     {others.slice(0,4).map((item,i)=><Link key={item.id} href={mediaHref(item)} className="watch-small-card">
       <Cover item={item}/>
       <div><span>0{i+2} / {item.kind==='Filmes'?'FILME':'SÉRIE'}</span>
        <h3>{item.title}</h3>
        <p>{item.synopsis}</p>
        <strong>Ver guia e onde assistir ↗</strong>
       </div>
      </Link>)}
     <Link href="/filmes-series" className="watch-all-card">Ver todos os títulos<span aria-hidden="true">↗</span></Link>
    </div>
   </div>}
 </section>;
}
