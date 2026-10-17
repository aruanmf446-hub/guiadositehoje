import Link from 'next/link';
export function SiteHeader(){
  return <header className="site-header">
    <div className="site-header-inner">
      <Link href="/" className="brand" aria-label="Guia de Hoje, página inicial">
        <span className="brand-mark" aria-hidden="true">G.</span>
        <span className="brand-name">guia<span>dehoje</span><b>.</b></span>
      </Link>
      <nav className="site-nav" aria-label="Navegação principal">
        <Link href="/#jogos">Jogos de hoje</Link>
        <Link href="/futebol">Futebol</Link>
        <Link href="/noticias">Notícias</Link>
        <Link href="/filmes-series">Filmes e séries</Link>
      </nav>
      <Link href="/buscar" className="nav-search" aria-label="Pesquisar no site"><span aria-hidden="true">⌕</span> Pesquisar</Link>
    </div>
  </header>;
}
