import type {Metadata} from 'next';
import Link from 'next/link';
import {getWatchTitles} from '@/lib/content';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
export const revalidate=600;
export const metadata:Metadata={
  title:'Filmes em destaque, séries e onde assistir',
  description:'Confira filmes em catálogo, séries e programação de TV. Veja fontes e informações de disponibilidade para o Brasil.',
  alternates:{canonical:'/filmes-series'},
};
export default async function MediaArchive(){
  const titles=await getWatchTitles();
  const movies=titles.filter(t=>t.kind==='Filmes');
  const shows=titles.filter(t=>t.kind!=='Filmes');
  return <div className="site"><SiteHeader/>
    <main className="container catalog-page">
      <p className="eyebrow"><Link href="/">Início</Link> / Filmes e séries</p>
      <h1>Um bom título para <em>o seu tempo.</em></h1>
      <p className="lead">Filmes em destaque e séries na programação. Indicações de plataformas só quando a fonte confirma disponibilidade brasileira.</p>
      {([{label:'Filmes em destaque',id:'filmes',items:movies},
        {label:'Séries e programas',id:'series',items:shows}]).map(group=>
      <section key={group.id} className="catalog-group" id={group.id}>
        <h2>{group.label}<span className="heading-dot">.</span></h2>
        {group.items.length===0?<p className="empty">Sem títulos cadastrados por enquanto.</p>:
        <div className="catalog-grid">{group.items.map((item,i)=><article key={item.id} className="catalog-item">
          <div className={'media-art art-'+i%6}><span className="media-art-icon">{group.id==='filmes'?'◧':'▷'}</span>
            <span className="media-art-title">{item.title.replace(/\s*\(2026 film\)$/i,'')}</span>
          </div>
          <div className="media-card-content">
            <span className="media-status">{item.availabilityStatus==='schedule_br'?'Programação brasileira':'Onde assistir: a confirmar'}</span>
            <h3>{item.title.replace(/\s*\(2026 film\)$/i,'')}</h3>
            <p>{item.availabilityStatus==='schedule_br'?item.platform:
              'Consulte disponibilidade de exibição na sua região.'}</p>
            {item.watchUrl&&<a className="text-link" href={item.watchUrl} target="_blank" rel="noopener noreferrer">
              Ver fonte <span aria-hidden="true">↗</span></a>}
          </div>
        </article>)}</div>}
      </section>)}
    </main><SiteFooter/>
  </div>;
}
