export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="#topo" className="brand" aria-label="Guia de Hoje, voltar ao topo">
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <span className="brand-name">Guia de Hoje</span>
        </a>
        <nav aria-label="Seções" className="site-nav">
          <a href="#jogos">Jogos do dia</a>
          <a href="#noticias">Notícias</a>
          <a href="#assistir">Onde assistir</a>
        </nav>
      </div>
    </header>
  );
}
