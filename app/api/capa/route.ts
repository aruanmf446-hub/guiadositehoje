// Capas editoriais ilustrativas para todas as publicações sem foto licenciada.
import type {NextRequest} from 'next/server';
export const runtime='nodejs';
const palette:Record<string,[string,string,string,string]>={
 noticia:['#121a29','#1d3446','#b7edff','EDITORIAL / NOTÍCIAS'],
 filme:['#271826','#5e2a44','#ffdf9b','GUIA / CINEMA'],
 serie:['#1b2438','#414775','#e7b8f6','GUIA / SÉRIES'],
 futebol:['#11352c','#1f6550','#ebf7bf','AGENDA / FUTEBOL']
};
function esc(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function lines(s:string,limit=24):string[]{
 const tokens=s.split(/\s+/),out:string[]=[];let row='';
 for(const word of tokens){if((row+' '+word).trim().length>limit&&row){
   out.push(row);row=word;}else row=(row+' '+word).trim();}
 if(row)out.push(row);
 return out.slice(0,3).map((x,i)=>i===2&&out.length>3?x.replace(/.{3}$/,'...'):x);
}
export async function GET(req:NextRequest){
 const query=req.nextUrl.searchParams;
 const kind=query.get('tipo')||'noticia';
 const [base,end,accent,section]=palette[kind]||palette.noticia;
 const title=(query.get('titulo')||'Guia de Hoje').trim().replace(/[\x00-\x1f]/g,' ').slice(0,140);
 const text=lines(title,kind==='futebol'?26:27);
 const height=text.length>2?63:72;
 const items=text.map((line,i)=>'<text x="76" y="'+(310+i*height)+'" font-family="Arial,sans-serif" font-weight="800" font-size="'+(kind==='futebol'?58:60)+'" letter-spacing="-2" fill="#fff">'+esc(line)+'</text>').join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
 <defs><linearGradient id="a" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${base}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs>
 <rect width="1200" height="675" fill="url(#a)"/>
 <g opacity=".12" stroke="${accent}" fill="none"><circle cx="995" cy="330" r="315" stroke-width="2"/><circle cx="995" cy="330" r="236" stroke-width="2"/><circle cx="995" cy="330" r="157" stroke-width="2"/></g>
 <path d="M720 0L1200 0L1200 420L1060 490Z" fill="${accent}" opacity=".07"/>
 <rect x="75" y="75" width="62" height="7" rx="3" fill="${accent}"/>
 <text x="76" y="123" font-family="Arial,sans-serif" font-weight="700" font-size="24" letter-spacing="5" fill="${accent}">${esc(section)}</text>
 <text x="76" y="204" font-family="Arial,sans-serif" font-size="29" fill="#f1e9e2" opacity=".83">${kind==='futebol'?'CONFRONTO CONFIRMADO':'CONTEÚDO EM DESTAQUE'}</text>
 ${items}
 <rect x="75" y="597" width="1050" height="1" fill="#ffffff" opacity=".3"/>
 <text x="76" y="636" font-family="Arial,sans-serif" font-size="22" letter-spacing="3" font-weight="700" fill="${accent}">GUIA DE HOJE</text>
 <text x="1124" y="636" text-anchor="end" font-family="Arial,sans-serif" font-size="19" fill="#ffffff" opacity=".8">ARTE EDITORIAL ILUSTRATIVA</text>
 </svg>`;
 return new Response(svg,{headers:{'Content-Type':'image/svg+xml; charset=utf-8',
  'Cache-Control':'public, max-age=3600, s-maxage=86400','X-Content-Type-Options':'nosniff'}});
}
