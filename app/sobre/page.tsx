import type {Metadata} from 'next';
import Link from 'next/link';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
export const metadata:Metadata={title:'Sobre o Guia de Hoje',description:'Conheça a proposta editorial, os conteúdos e o funcionamento das informações do Guia de Hoje.',alternates:{canonical:'/sobre'}};
export default function About(){
 return <div className="site"><SiteHeader/><main className="container trust-page">
  <nav className="article-breadcrumb"><Link href="/">Início</Link> / Sobre</nav>
  <span className="section-eyebrow">QUEM SOMOS</span><h1>Informação que ajuda a entender o dia.</h1>
  <p>O Guia de Hoje é um portal brasileiro dedicado a facilitar a consulta de partidas de futebol, notícias e entretenimento. Organizamos calendários, informações verificáveis e matérias explicativas com referências.</p>
  <h2>Como trabalhamos</h2><p>Usamos fontes públicas, integrações de dados e ferramentas de automação. Alguns conteúdos são elaborados com apoio de inteligência artificial e trazem a fonte consultada. Procuramos não atribuir canais de transmissão sem evidência.</p>
  <p>Publicações podem ser atualizadas quando a origem corrige dados ou divulga novas informações. Veja nossos <Link href="/politica-editorial">critérios editoriais</Link> e a <Link href="/privacidade">política de privacidade</Link>.</p>
 </main><SiteFooter/></div>;
}
