import type {Metadata} from 'next';
import Link from 'next/link';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
export const metadata:Metadata={title:'Política de privacidade',description:'Informações de privacidade e uso de dados no site Guia de Hoje.',alternates:{canonical:'/privacidade'}};
export default function Privacy(){
 return <div className="site"><SiteHeader/><main className="container trust-page">
  <nav className="article-breadcrumb"><Link href="/">Início</Link> / Privacidade</nav>
  <span className="section-eyebrow">PRIVACIDADE</span><h1>Transparência no acesso ao site.</h1>
  <p>O Guia de Hoje disponibiliza conteúdo informativo. Não é necessário criar conta para acessar as páginas públicas. As pesquisas feitas no site são processadas para exibir resultados correspondentes.</p>
  <h2>Infraestrutura e serviços de terceiros</h2><p>O site utiliza hospedagem e banco de dados de fornecedores externos, que podem receber dados técnicos indispensáveis ao funcionamento, como endereço IP e registros de acesso, de acordo com suas próprias políticas.</p>
  <h2>Publicidade</h2><p>O site poderá exibir publicidade no futuro. Se forem ativados serviços de anúncios ou mensuração que utilizem cookies, esta política e os mecanismos de consentimento necessários deverão ser atualizados antes da ativação.</p>
  <h2>Links externos</h2><p>Algumas páginas indicam fontes e outros serviços. O acesso a esses links está sujeito às condições de privacidade dos respectivos sites.</p>
  <p>Última atualização: outubro de 2026.</p>
 </main><SiteFooter/></div>;
}
