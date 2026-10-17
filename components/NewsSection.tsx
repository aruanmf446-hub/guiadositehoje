import Link from 'next/link';
import type { NewsItem } from '@/lib/data';

export function NewsSection({ news }: { news: NewsItem[] }) {
  const [featured, ...others] = news;
  return (
    <section id="noticias" aria-labelledby="t-noticias" className="section bordered">
      <div className="section-title-wrap">
        <h2 id="t-noticias" className="section-title">Notícias</h2>
        <span className="section-sub">As principais do dia, fora do placar.</span>
      </div>
      {!featured ? <p className="empty" style={{ marginTop: 24 }}>
        Notícias verificadas aparecerão aqui assim que forem publicadas.
      </p> : (
        <div className="news-layout">
          <article className="news-feature">
            <Link href={`/noticias/${featured.slug}`} aria-label={featured.headline}>
              <div className="news-image">
                {featured.imageUrl ? (
                  <img src={featured.imageUrl} alt={featured.imageAlt || featured.headline} loading="lazy" />
                ) : <span>Guia de Hoje</span>}
              </div>
            </Link>
            <div className="news-feature-body">
              <span className="kicker">{featured.category}</span>
              <h3 className="news-feature-title">
                <Link href={`/noticias/${featured.slug}`}>{featured.headline}</Link>
              </h3>
              <p className="news-feature-text">{featured.summary}</p>
            </div>
          </article>
          <div className="news-list">
            {others.map(item => (
              <article key={item.id} className="news-item">
                <span className="kicker news-item-kicker">{item.category}</span>
                <h3 className="news-item-title">
                  <Link href={`/noticias/${item.slug}`}>{item.headline}</Link>
                </h3>
              </article>
            ))}
            <Link className="all-news-link" href="/noticias">Ver todas as notícias →</Link>
          </div>
        </div>
      )}
    </section>
  );
}
