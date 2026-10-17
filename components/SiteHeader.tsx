import Link from 'next/link';
export function SiteHeader(){
  return <header className="site-header">
    <div className="site-header-inner">
      <Link href="/" className="brand" aria-label="Guia de Hoje, página inicial">
        <span className="brand-mark" aria-hidden="true">G</span>
        <span className="brand-name">Guia de Hoje</span>
      </Link>
      <nav aria-label="Seções" className="site-nav">
        <Link href="/futebol">Futebol</Link>
        <Link href="/futebol/onde-assistir">Onde assistir futebol</Link>
        <Link href="/noticias">Notícias</Link>
        <Link href="/#assistir">Filmes e séries</Link>
      </nav>
    </div>
  </header>;
}
