import { news } from '@/lib/data';

export function NewsSection() {
  const [featured, ...others] = news;

  return (
    <section id="noticias" aria-labelledby="t-noticias" className="section bordered">
      <div className="section-title-wrap">
        <h2 id="t-noticias" className="section-title">
          Notícias
        </h2>
        <span className="section-sub">As principais do dia, fora do placar.</span>
      </div>

      <div className="news-layout">
        <article className="news-feature">
          <div className="news-image">[IMAGEM DE DESTAQUE]</div>
          <div className="news-feature-body">
            <span className="kicker">[Categoria]</span>
            <h3 className="news-feature-title">[Manchete principal do dia]</h3>
            <p className="news-feature-text">
              [Resumo da notícia em até duas linhas, explicando o essencial para quem tem pouco tempo.]
            </p>
          </div>
        </article>

        <div className="news-list">
          {others.map((item) => (
            <article key={item.id} className="news-item">
              <span className="kicker news-item-kicker">{item.category}</span>
              <h3 className="news-item-title">{item.headline}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
