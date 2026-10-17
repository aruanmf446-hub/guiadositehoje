import type {Metadata} from 'next';
import Link from 'next/link';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
export const metadata:Metadata={title:'Política editorial e transparência',description:'Saiba como o Guia de Hoje utiliza fontes, IA, dados de partidas, correções e critérios de qualidade.',alternates:{canonical:'/politica-editorial'}};
export default function Editorial(){
 return <div className="site"><SiteHeader/><main className="container trust-page">
  <nav className="article-breadcrumb"><Link href="/">Início</Link> / Política editorial</nav>
  <span className="section-eyebrow">TRANSPARÊNCIA</span><h1>O que publicamos, como verificamos.</h1>
  <h2>Fontes identificadas</h2><p>Informações de notícias apresentam referências consultadas e acesso à fonte de origem. Nossos textos não substituem as reportagens citadas, e não apresentamos textos de terceiros como apuração própria.</p>
  <h2>Automação e inteligência artificial</h2><p>Usamos automações para preparar pautas, coletar calendários e estruturar conteúdo. Quando houver assistência de inteligência artificial na elaboração de uma matéria, indicaremos isso na página. Materiais sem base suficiente não devem ser publicados como notícias originais.</p>
  <h2>Futebol e entretenimento</h2><p>Horários, confrontos e canais podem mudar. Transmissões e catálogos só são exibidos como confirmados quando houver dado específico para o Brasil. A ausência de informação não significa que o jogo ou filme não esteja disponível.</p>
  <h2>Correções</h2><p>Quando houver divergência com a fonte, a prioridade é corrigir a página e manter a referência verificável. O histórico de notícias e jogos pode ser conservado para fins de consulta.</p>
 </main><SiteFooter/></div>;
}
