import Link from 'next/link';
export function SiteFooter(){
 return <footer className="site-footer"><div className="site-footer-inner">
   <div><Link href="/" className="footer-brand">guia<span>dehoje.</span></Link>
     <p>Esporte, informação e entretenimento com fontes identificadas.</p></div>
   <div className="footer-links"><Link href="/futebol">Futebol</Link><Link href="/noticias">Notícias</Link>
     <Link href="/filmes-series">Filmes e séries</Link><Link href="/buscar">Pesquisar</Link>
     <Link href="/sobre">Sobre</Link><Link href="/politica-editorial">Editorial</Link><Link href="/privacidade">Privacidade</Link></div>
   <small>Horários de Brasília. Datas, direitos de transmissão e catálogos podem mudar.
     Links externos levam às fontes originais.</small>
 </div></footer>;
}
