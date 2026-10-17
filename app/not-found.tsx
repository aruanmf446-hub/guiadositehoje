import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
export default function NotFound() {
  return <div className="site">
    <SiteHeader />
    <main className="container article-container">
      <h1 className="archive-title">Página não encontrada</h1>
      <p className="lead">Este conteúdo não existe ou ainda não está publicado.</p>
      <p><Link className="all-news-link" href="/">Voltar ao início →</Link></p>
    </main>
    <SiteFooter />
  </div>;
}
