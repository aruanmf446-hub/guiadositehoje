'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {WatchTitle,WatchKind} from '@/lib/data';
export function WatchSection({titles}:{titles:WatchTitle[]}){
  const [kind,setKind]=useState<WatchKind>('Filmes');
  const choices=(titles||[]).filter(x=>x.kind===kind).slice(0,6);
  return <section id="assistir" className="home-section entertainment-section" aria-labelledby="watch-heading">
    <div className="editorial-section-head">
      <div><div className="section-eyebrow">TEMPO LIVRE</div>
        <h2 id="watch-heading">Para ver hoje<span className="heading-dot">.</span></h2>
        <p>Filmes em destaque e programação de séries. Consulte a disponibilidade no Brasil.</p>
      </div>
      <Link href="/filmes-series" className="text-link">Explorar catálogo <span aria-hidden="true">↗</span></Link>
    </div>
    <div className="media-tabs" role="group" aria-label="Tipo de conteúdo">
      <button type="button" aria-pressed={kind==='Filmes'} onClick={()=>setKind('Filmes')}>Filmes</button>
      <button type="button" aria-pressed={kind==='Séries'} onClick={()=>setKind('Séries')}>Séries e programas</button>
    </div>
    {choices.length===0?<p className="no-games">Ainda não há títulos cadastrados nesta seção.</p>:
    <div className="media-grid">
      {choices.map((item,i)=><article key={item.id} className="media-card">
        <div className={'media-art art-'+i%6}>
          <span className="media-art-icon" aria-hidden="true">{kind==='Filmes'?'◧':'▷'}</span>
          <span className="media-art-title">{item.title.replace(/\s*\(2026 film\)$/i,'')}</span>
          <span className="media-art-type">{kind==='Filmes'?'CINEMA':'SÉRIES · TV'}</span>
        </div>
        <div className="media-card-content">
          <span className="media-status">{item.availabilityStatus==='schedule_br'?'Programação brasileira':'Disponibilidade a confirmar'}</span>
          <h3>{item.title.replace(/\s*\(2026 film\)$/i,'')}</h3>
          <p>{item.availabilityStatus==='schedule_br'?item.platform:'Veja a ficha e confira onde assistir na sua região.'}</p>
          {item.watchUrl&&<a href={item.watchUrl} rel="noopener noreferrer" target="_blank" className="text-link">
            Consultar fonte <span aria-hidden="true">↗</span></a>}
        </div>
      </article>)}
    </div>}
  </section>;
}
