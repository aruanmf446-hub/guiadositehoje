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
function pictogram(kind:string,title:string,accent:string):string{
 const t=title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 let art='';
 if(kind==='futebol')art='<circle cx="0" cy="0" r="156"/><path d="M0 -53L50 -17L31 44H-31L-50 -17Z"/><path d="M0 -53L0 -156M50 -17L144 -57M31 44L96 125M-31 44L-96 125M-50 -17L-144 -57"/>';
 else if(kind==='filme')art='<rect x="-165" y="-98" width="330" height="218" rx="19"/><path d="M-165 -100L160 -176L180 -113L-147 -38Z"/><path d="M-94 -116L-54 -54M-4 -140L38 -77M89 -162L130 -99"/><path d="M-115 10H114M-115 61H60"/>';
 else if(kind==='serie')art='<rect x="-181" y="-120" width="362" height="250" rx="33"/><rect x="-145" y="-85" width="290" height="174" rx="10"/><path d="M-87 158H87M0 130V158M-47 -158L0 -120L47 -158"/>';
 else if(/chuva|alagamento|tempestade|clima|deslizamento|enchente/.test(t))
  art='<path d="M-117 10Q-180 -86 -76 -113Q-21 -202 70 -134Q169 -150 166 -43Q233 42 140 74H-133Q-198 71 -177 8Z"/><path d="M-95 117L-114 169M4 117L-14 169M106 117L88 169"/>';
 else if(/elefant|animal|tubarao|baleia|natureza|fauna/.test(t))
  art='<path d="M-131 -32Q-132 -141 -19 -136Q109 -165 124 -51L145 76L104 114L69 68Q3 112 -61 62L-113 127L-154 99Z"/><circle cx="57" cy="-65" r="8"/><path d="M92 5Q162 40 153 100"/>';
 else if(/tecnolog|inteligencia artificial|celular|computador|meta |digital/.test(t))
  art='<rect x="-161" y="-117" width="324" height="235" rx="23"/><rect x="-118" y="-71" width="236" height="150" rx="5"/><path d="M-70 153H71M0 118V153M-59 -37H51M-59 -8H88M-59 21H12"/>';
 else if(/saude|sus|nhs|medic|hospital|vacin/.test(t))
  art='<path d="M-42 -147H42V-56H132V28H42V119H-42V28H-132V-56H-42Z"/>';
 else if(/educac|escola|estudant|olimpiada|professor|aprend/.test(t))
  art='<path d="M-178 -75L0 -154L178 -75L0 6Z"/><path d="M-112 -30V77Q0 156 111 77V-30M178 -75V75"/>';
 else art='<rect x="-151" y="-142" width="302" height="283" rx="15"/><path d="M-106 -88H106V-14H-106ZM-106 13H106M-106 50H106M-106 88H52"/>';
 return '<g transform="translate(979 338)" fill="none" stroke="'+accent+'" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" opacity=".33">'+art+'</g>';
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
 ${pictogram(kind,title,accent)}
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
