import Link from 'next/link';
import type {NewsItem} from '@/lib/data';

function NewsLink({item,children,className}:{item:NewsItem;children:React.ReactNode;className?:string}){
  if(item.isAggregated&&item.sourceUrl)return <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  return <Link className={className} href={'/noticias/'+item.slug}>{children}</Link>;
}
const shortDate=(iso:string)=>new Intl.DateTimeFormat('pt-BR',{
  day:'2-digit',month:'short',timeZone:'America/Sao_Paulo'
}).format(new Date(iso));
export function NewsSection({news}:{news:NewsItem[]}){
  const [featured,...others]=news;
  return <section id="noticias" className="home-section home-news" aria-labelledby="news-heading">
    <div className="editorial-section-head">
      <div><div className="section-eyebrow">INFORMAÇÃO EM DIA</div>
        <h2 id="news-heading">Últimas notícias<span className="heading-dot">.</span></h2>
        <p>Atualizações de fontes identificadas. Leia a reportagem completa na origem.</p>
      </div>
      <Link href="/noticias" className="text-link">Todas as notícias <span aria-hidden="true">↗</span></Link>
    </div>
    {!featured?<p className="no-games">A seleção de notícias será exibida após a próxima coleta das fontes.</p>:
    <div className="editorial-grid">
      <article className="lead-story">
        <div className="lead-story-visual" aria-hidden="true"><span>01</span><i>ATUALIDADE</i></div>
        <div className="lead-story-copy">
          <div className="story-kicker"><span>{featured.sourceName||featured.category}</span> · {shortDate(featured.publishedAt)}</div>
          <h3><NewsLink item={featured}>{featured.headline}</NewsLink></h3>
          <p>{featured.summary}</p>
          <NewsLink className="text-link" item={featured}>Ler na fonte <span aria-hidden="true">↗</span></NewsLink>
        </div>
      </article>
      <div className="news-briefs">
        {others.slice(0,5).map((item,i)=><article key={item.id} className="news-brief">
          <span className="brief-num">{String(i+2).padStart(2,'0')}</span>
          <div><span className="story-kicker">{item.sourceName||item.category} · {shortDate(item.publishedAt)}</span>
            <h3><NewsLink item={item}>{item.headline}</NewsLink></h3>
          </div>
          <NewsLink item={item} className="news-arrow"><span aria-hidden="true">↗</span></NewsLink>
        </article>)}
      </div>
    </div>}
  </section>;
}
