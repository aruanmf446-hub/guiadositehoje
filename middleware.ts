import {NextRequest,NextResponse} from 'next/server';

// Opcional: configure OFFICE_PASSWORD e OFFICE_USER na Vercel.
// Na ausência de senha, a rota só exibe dados já publicados.
export function middleware(request:NextRequest){
 const password=process.env.OFFICE_PASSWORD;
 if(!password)return NextResponse.next();
 let credentials='';
 const auth=request.headers.get('authorization')||'';
 if(auth.startsWith('Basic ')){
  try{credentials=atob(auth.slice(6));}catch{credentials='';}
 }
 const colon=credentials.indexOf(':');
 const user=colon>=0?credentials.slice(0,colon):'';
 const provided=colon>=0?credentials.slice(colon+1):'';
 if(user===(process.env.OFFICE_USER||'admin')&&provided===password)return NextResponse.next();
 return new NextResponse('Acesso restrito ao escritório',{status:401,headers:{
  'WWW-Authenticate':'Basic realm="Escritorio dos Agentes", charset="UTF-8"',
  'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'
 }});
}
export const config={matcher:['/escritorio/:path*','/api/escritorio/status']};
