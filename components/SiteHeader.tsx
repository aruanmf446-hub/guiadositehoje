import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand" aria-label="Guia de Hoje, página inicial">
          <span className="brand-mark" aria-hidden="true">G</span>
          <span className="brand-name">Guia de Hoje</span>
        </Link>
        <nav aria-label="Seções" className="site-nav">
          <Link href="/#jogos">Jogos do dia</Link>
          <Link href="/noticias">Notícias</Link>
          <Link href="/#assistir">Onde assistir</Link>
        </nav>
      </div>
    </header>
  );
}
