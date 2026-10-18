import Link from 'next/link';
import type {NewsItem} from '@/lib/data';
import {editorialCover,editorialCoverCredit} from '@/lib/capas';

const date=(iso:string)=>new Intl.DateTimeFormat('pt-BR',{
  day:'numeric',month:'short',timeZone:'America/Sao_Paulo'
}).format(new Date(iso));
export function NewsSection({news}:{news:NewsItem[]}){
  const [featured,...others]=news;
  return <section id="noticias" className="home-section news-edit-section" aria-labelledby="news-heading">
    <div className="editorial-section-head">
      <div><div className="section-eyebrow">EDITORIA / NOTICIÁRIO</div>
        <h2 id="news-heading">O que está acontecendo<span className="heading-dot">.</span></h2>
        <p>Matérias e análises do Guia de Hoje, com fonte e informação conferida.</p>
      </div>
      <Link className="text-link" href="/noticias">Ver o noticiário <span aria-hidden="true">↗</span></Link>
    </div>
    {!featured?<div className="no-games">A redação está preparando as próximas matérias.</div>:
    <div className="news-magazine">
      <article className="magazine-lead">
        <figure className="magazine-cover">
         <img src={featured.imageUrl||editorialCover('noticia',featured.headline)}
          alt={featured.imageAlt||'Capa ilustrativa de '+featured.headline} loading="lazy"/>
         <figcaption>{featured.imageUrl?featured.imageCredit||'Imagem: fonte consultada':editorialCoverCredit}</figcaption>
        </figure>
        <div className="magazine-lead-meta"><span>EM DESTAQUE</span> / {featured.category} · {date(featured.publishedAt)}</div>
        <h3><Link href={'/noticias/'+featured.slug}>{featured.headline}</Link></h3>
        <p>{featured.summary}</p>
        <div className="magazine-lead-footer"><span>Guia de Hoje · Fonte identificada na matéria</span>
          <Link href={'/noticias/'+featured.slug}>Ler notícia <span aria-hidden="true">↗</span></Link>
        </div>
      </article>
      <div className="magazine-feed">
        <div className="magazine-feed-title">MAIS DO DIA <span>{String(others.length).padStart(2,'0')}</span></div>
        {others.slice(0,4).map((a,i)=><article key={a.id} className="magazine-brief">
          <span className="brief-number">{String(i+2).padStart(2,'0')}</span>
          <div><img className="news-list-cover" src={a.imageUrl||editorialCover('noticia',a.headline)}
           alt={a.imageAlt||'Capa editorial de '+a.headline} loading="lazy"/>
           <span className="story-kicker">{a.category} · {date(a.publishedAt)}</span>
            <h3><Link href={'/noticias/'+a.slug}>{a.headline}</Link></h3>
            <p>{a.summary}</p>
          </div>
          <Link className="brief-arrow" href={'/noticias/'+a.slug} aria-label={'Ler '+a.headline}>↗</Link>
        </article>)}
      </div>
    </div>}
  </section>;
}
