'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {WatchTitle,WatchKind} from '@/lib/data';
export function WatchSection({titles}:{titles:WatchTitle[]}){
  const [kind,setKind]=useState<WatchKind>('Filmes');
  const items=titles.filter(t=>t.kind===kind);
  const [featured,...others]=items;
  return <section id="assistir" className="home-section watch-edit-section" aria-labelledby="watch-heading">
    <div className="editorial-section-head">
      <div><div className="section-eyebrow">CULTURA / ENTRETENIMENTO</div>
        <h2 id="watch-heading">Vale a sessão<span className="heading-dot">.</span></h2>
        <p>Filmes em destaque e séries na programação, sem inventar serviços disponíveis no Brasil.</p>
      </div>
      <Link className="text-link" href="/filmes-series">Explorar títulos <span aria-hidden="true">↗</span></Link>
    </div>
    <div className="film-tabs" role="group" aria-label="Seleção de entretenimento">
      <button type="button" aria-pressed={kind==='Filmes'} onClick={()=>setKind('Filmes')}>Filmes</button>
      <button type="button" aria-pressed={kind==='Séries'} onClick={()=>setKind('Séries')}>Séries</button>
    </div>
    {!featured?<p className="no-games">Nossa seleção de títulos será atualizada em breve.</p>:
    <div className="cinema-editorial">
      <article className="cinema-feature">
        <span className="cinema-feature-top">01 / SELEÇÃO DO GUIA</span>
        <div className="cinema-feature-copy">
          <span>{kind==='Filmes'?'CINEMA · 2026':'SÉRIES · PROGRAMAÇÃO'}</span>
          <h3>{featured.title.replace(/\s*\(\d{4} film\)$/i,'')}</h3>
          <p>{featured.synopsis||'Confira a ficha desta produção e acompanhe onde assistir.'}</p>
        </div>
        {featured.sourceUrl?<a href={featured.sourceUrl} target="_blank" rel="noopener noreferrer">
          Consultar a ficha oficial <span aria-hidden="true">↗</span></a>:null}
      </article>
      <div className="cinema-list">
        {others.slice(0,5).map((item,i)=><article key={item.id} className="cinema-list-item">
          <span className="cinema-list-n">{String(i+2).padStart(2,'0')}</span>
          <div><span className="cinema-list-status">{item.availabilityStatus==='schedule_br'?'TV brasileira identificada':'Disponibilidade no Brasil a confirmar'}</span>
            <h3>{item.title.replace(/\s*\(\d{4} film\)$/i,'')}</h3>
            <p>{item.synopsis||'Informações e ficha de referência.'}</p>
          </div>
          {item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={'Consultar '+item.title}>↗</a>}
        </article>)}
      </div>
    </div>}
  </section>;
}
