import { GamesSection } from '@/components/GamesSection';
import { NewsSection } from '@/components/NewsSection';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { WatchSection } from '@/components/WatchSection';

const today = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
}).format(new Date());

export default function HomePage() {
  return (
    <div className="site" id="topo">
      <SiteHeader />

      <main className="container">
        <section className="intro">
          <span className="eyebrow">{today}</span>
          <h1 className="hero-title">Tudo o que importa hoje, num só lugar.</h1>
          <p className="lead">
            Os jogos do dia, as notícias e onde assistir aos melhores filmes, séries e programas.
          </p>
        </section>

        <GamesSection />
        <NewsSection />
        <WatchSection />
      </main>

      <SiteFooter />
    </div>
  );
}
