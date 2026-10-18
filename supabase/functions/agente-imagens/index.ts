// Novo agente de imagens: procura acervos autorizados, verifica crédito e persiste evidências.
// Não utiliza imagem do Google, foto aleatória, marca ou cartaz sem licença identificável.
type Row=Record<string,any>;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const words=(s:string)=>normalize(s).split(' ').filter(w=>w.length>=4&&![
 'para','sobre','entre','como','depois','antes','noticia','brasil','serie','filme','movie','series'
].includes(w));
const strip=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ')
 .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/\s+/g,' ').trim();
function dbClient(){
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)throw Error('Supabase não configurado');
 return async (path:string,method='GET',body?:unknown,prefer='')=>{
  const res=await fetch(url+'/rest/v1/'+path,{method,
   headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',
    ...(prefer?{Prefer:prefer}:{})},
   body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const text=await res.text();
  if(!res.ok)throw Error('Supabase HTTP '+res.status+': '+text.slice(0,180));
  return text?JSON.parse(text):null;
 };
}
type Asset={url:string;credit:string;creditUrl:string;alt:string};
async function tvmaze(item:Row):Promise<Asset|null>{
 const match=/^tvmaze:(\d+)$/.exec(String(item.external_ref||''));
 if(!match)return null;
 const resp=await fetch('https://api.tvmaze.com/shows/'+match[1],{
  headers:{Accept:'application/json'},signal:AbortSignal.timeout(13000)});
 if(!resp.ok)throw Error('TVmaze HTTP '+resp.status);
 const show:Row=await resp.json();
 if(String(show.id)!==match[1]||normalize(String(show.name||''))!==normalize(String(item.title||'')))
  return null;
 const url=String(show.image?.medium||show.image?.original||'');
 if(!/^https:\/\/static\.tvmaze\.com\/uploads\/images\/.+\.(jpg|jpeg|png|webp)$/i.test(url))
  return null;
 const creditUrl=String(show.url||'');
 return {url,credit:'Imagem disponibilizada via TVmaze; direitos dos respectivos titulares',
  creditUrl:creditUrl.startsWith('https://www.tvmaze.com/')?creditUrl:'https://www.tvmaze.com/',
  alt:'Imagem de divulgação da produção '+String(show.name)};
}
async function commons(title:string,kind:'noticia'|'midia'):Promise<Asset|null>{
 const terms=words(title).slice(0,kind==='noticia'?7:8);
 if(terms.length<2)return null;
 // Busca conservadora: não associar fotografia de outro evento ou produção.
 const search=kind==='midia'?'"'+title.slice(0,100).replace(/"/g,'')+'"':
  terms.slice(0,5).join(' ');
 const query=new URLSearchParams({action:'query',format:'json',generator:'search',
  gsrsearch:search,gsrnamespace:'6',gsrlimit:'8',prop:'imageinfo',
  iiprop:'url|extmetadata',iiurlwidth:'1000'});
 const res=await fetch('https://commons.wikimedia.org/w/api.php?'+query.toString(),{
  headers:{Accept:'application/json','User-Agent':'GuiaDeHojeEditorial/1.0 (https://guiadehoje.site)'},
  signal:AbortSignal.timeout(14000)});
 if(!res.ok)throw Error('Wikimedia HTTP '+res.status);
 const result:Row=await res.json();
 const pages:Row[]=Object.values(result.query?.pages||{});
 for(const page of pages){
  const info=page.imageinfo?.[0];
  if(!info)continue;
  const metadata=info.extmetadata||{};
  const license=String(metadata.LicenseShortName?.value||'').trim();
  // Apenas licenças reutilizáveis explicitamente reconhecidas.
  if(!/^(CC0|CC BY(?:-SA)?(?: [1-4]\.0)?|Public domain|PD-)/i.test(license)
   ||/\b(?:NC|ND)\b/i.test(license))continue;
  const mime=String(info.mime||'');
  const url=String(info.thumburl||info.url||'');
  if(!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(url)||
    !/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url))continue;
  const fileName=String(page.title||'').replace(/^File:/i,'').replace(/[_-]/g,' ');
  const matched=new Set(words(fileName));
  const hits=terms.filter(t=>matched.has(t)).length;
  if(hits<Math.min(3,terms.length))continue;
  const pageUrl=String(info.descriptionurl||'');
  if(!pageUrl.startsWith('https://commons.wikimedia.org/wiki/File:'))continue;
  const artist=strip(String(metadata.Artist?.value||'')).slice(0,100);
  const attribution=artist||'autor informado no Wikimedia Commons';
  return {url,alt:'Imagem relacionada a '+title.slice(0,130),
   credit:'Imagem: '+attribution+' / Wikimedia Commons ('+license+')',creditUrl:pageUrl};
 }
 return null;
}
// Cada nova publicação pode solicitar sua imagem imediatamente. A fila no banco
// permite recuperação, claim exclusivo e processamento idempotente.
type Kind='noticia'|'midia'|'jogo';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const restId=(kind:Kind,id:string)=>'agent_image_runs?kind=eq.'+kind+'&item_id=eq.'+id;

// Fotografias originais da Agência Brasil: reproduzidas para fins jornalísticos
// com autoria identificada. Rejeita conteúdo de agências parceiras e direitos reservados.
// O banco guarda apenas URL, texto alternativo, autor e link da fonte (nunca os bytes).
async function agencyBrasilAsset(row:Row):Promise<Asset|null>{
 const url=String(row.source_url||'').replace(/&amp;/g,'&');
 let location:URL;
 try{location=new URL(url);}catch{return null;}
 if(location.protocol!=='https:'||location.hostname!=='agenciabrasil.ebc.com.br'||
  !location.pathname.includes('/noticia/'))return null;
 const response=await fetch(location.toString(),{
  headers:{'Accept':'text/html','User-Agent':'GuiaDeHoje/1.0 (+https://guiadehoje.site)'},
  signal:AbortSignal.timeout(16000)});
 if(!response.ok)throw Error('Agência Brasil HTTP '+response.status);
 const html=(await response.text()).slice(0,300000);
 const tags=[...html.matchAll(/<meta\b[^>]*>/gi)].map(x=>x[0]);
 function meta(key:string):string{
  for(const tag of tags){
   const attrs:Record<string,string>={};
   for(const m of tag.matchAll(/([\w:-]+)\s*=\s*("|')([\s\S]*?)\2/g))
    attrs[m[1].toLowerCase()]=m[3];
   if(attrs.property===key||attrs.name===key)return String(attrs.content||'')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim();
  }
  return '';
 }
 const image=meta('og:image'),imageAlt=meta('twitter:image:alt');
 let parsed:URL;
 try{parsed=new URL(image);}catch{return null;}
 if(parsed.protocol!=='https:'||parsed.hostname!=='imagens.ebc.com.br'||
  !parsed.pathname.includes('agenciabrasil.ebc.com.br/sites/default/files/')||
  !/\.(jpg|jpeg|png|webp)(?:\?|$)/i.test(image))return null;
 const candidate=(imageAlt.match(/(?:Foto|Crédito|Créditos|©)\s*:?\s*([^\n]{4,120})$/i)||[])[1]||'';
 // Somente fotógrafos da Agência Brasil ou produções próprias da TV Brasil/EBC.
 if(!/(?:\/\s*Agência Brasil|\/\s*TV Brasil|\/\s*EBC|^TV Brasil\b|^EBC\b)/i.test(candidate)||
  /reuters|associated press|afp|ap photo|direitos reservados|shutterstock|getty|alamy/i.test(candidate))
  return null;
 const credit=candidate.trim().replace(/\s*[\\"']+$/,'').slice(0,120);
 return {url:image,alt:strip(imageAlt).slice(0,300)||'Fotografia da Agência Brasil',
  credit:'Foto: '+credit,creditUrl:location.origin+location.pathname};
}

Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 let db:ReturnType<typeof dbClient>;
 try{db=dbClient();}catch{return json({error:'db_unavailable'},503);}
 try{
  const cfg:Row[]=await db('agent_configuration?name=eq.images_editor&select=token');
  const secret=req.headers.get('x-image-cron')||'';
  if(!secret||!cfg.length||cfg[0].token!==secret)return json({error:'unauthorized'},401);
 }catch{return json({error:'auth_unavailable'},503);}
 const payload:Row=await req.json().catch(()=>({}));
 const eventKind=String(payload.kind||''),eventId=String(payload.item_id||'');
 const targeted=Boolean(eventKind||eventId);
 if(targeted&&(!['noticia','midia','jogo'].includes(eventKind)||!uuid.test(eventId)))
  return json({error:'invalid_target'},400);
 try{
  // A chamada do gatilho só pode processar o item específico que foi publicado.
  // Crons processam a fila e, na ausência de eventos, completam o acervo antigo.
  const events:Row[]=targeted?
   await db(restId(eventKind as Kind,eventId)+'&select=kind,item_id,title,status,attempts,attempted_at'):
   await db('agent_image_runs?select=kind,item_id,title,status,attempts,attempted_at&status=eq.queued&order=attempted_at.asc&limit=25');
  const candidates:Array<{kind:Kind;id:string;title:string;queued:boolean}>=[];
  for(const e of events)if(e.status==='queued')candidates.push({
   kind:e.kind as Kind,id:e.item_id,title:String(e.title||''),queued:true
  });
  if(!targeted&&candidates.length<25){
   // Reposição limitada para itens antigos ou falhas transitórias.
   const [news,media,old]:[Row[],Row[],Row[]]=await Promise.all([
    db('news_articles?select=id,headline&status=eq.published&image_url=is.null&order=published_at.desc&limit=12'),
    db('watch_titles?select=id,title&is_published=eq.true&poster_url=is.null&order=updated_at.desc&limit=18'),
    db('agent_image_runs?select=kind,item_id,status,attempts,attempted_at&order=attempted_at.desc&limit=500')
   ]);
   for(const item of [...news.map(x=>({...x,kindImage:'noticia'})),
     ...media.map(x=>({...x,kindImage:'midia'}))]){
    if(candidates.length>=25)break;
    const kind=item.kindImage as Kind,id=String(item.id);
    if(candidates.some(c=>c.kind===kind&&c.id===id))continue;
    const prior=old.find(e=>e.kind===kind&&e.item_id===id);
    const age=prior?Date.now()-Date.parse(prior.attempted_at):Infinity;
    if(prior&&(prior.status==='done'||prior.attempts>=3||
      prior.status==='queued'||prior.status==='processing'&&age<50*60000||
      prior.status==='not_found'&&age<7*86400000||
      prior.status==='error'&&age<2*3600000))continue;
    // Um status processing expirado não é recuperado enquanto o worker anterior
    // ainda pode estar ativo. Reclassifica só depois do limite de 50 minutos.
    if(prior){
     const reopened:Row[]=await db(restId(kind,id)+'&status=eq.'+prior.status,
      'PATCH',{status:'queued',detail:'Reaberto para recuperação programada'},'return=representation');
     if(!reopened?.length)continue;
    }else{
     await db('agent_image_runs?on_conflict=kind,item_id','POST',[{
      kind,item_id:id,title:String(item.headline||item.title).slice(0,220),
      status:'queued',attempts:0,detail:'Item do acervo aguardando imagens'
     }],'resolution=ignore-duplicates');
    }
    candidates.push({kind,id,title:String(item.headline||item.title),queued:true});
   }
  }
  let checked=0,done=0,notFound=0,failed=0,skipped=0;
  for(const item of candidates.slice(0,targeted?1:25)){
   const {kind,id}=item;
   // O PATCH condicional é o lock: apenas uma execução recebe a linha.
   const existing:Row[]=await db(restId(kind,id)+'&select=attempts,status,title');
   const previous=existing[0];
   if(!previous||previous.status!=='queued'){skipped++;continue;}
   const attempt=(Number(previous.attempts)||0)+1;
   const claimed:Row[]=await db(restId(kind,id)+'&status=eq.queued',
    'PATCH',{status:'processing',attempts:attempt,attempted_at:new Date().toISOString(),
      detail:'Íris iniciou a tarefa disparada pela publicação'},'return=representation');
   if(!claimed?.length){skipped++;continue;}
   checked++;
   try{
    let row:Row|undefined;
    if(kind==='noticia'){
     const entries:Row[]=await db('news_articles?id=eq.'+id+'&status=eq.published&select=id,headline,source_url,source_name,image_url,image_credit');
     row=entries[0];
    }else if(kind==='midia'){
     const entries:Row[]=await db('watch_titles?id=eq.'+id+'&is_published=eq.true&select=id,title,kind,external_ref,source_url,poster_url,poster_credit');
     row=entries[0];
    }else{
     const entries:Row[]=await db('matches?id=eq.'+id+'&is_published=eq.true&select=id,home_team,away_team');
     row=entries[0];
    }
    if(!row){
     await db(restId(kind,id),'PATCH',{status:'not_found',detail:'Publicação retirada antes de processar imagem'});
     notFound++;continue;
    }
    const title=String(row.headline||row.title||[row.home_team,row.away_team].join(' x '));
    if(kind==='jogo'){
     await db(restId(kind,id),'PATCH',{status:'not_found',image_url:null,
      credit:null,credit_url:null,detail:'Partida registrada; aguarda foto oficial reutilizável dos clubes'});
     notFound++;continue;
    }
    const imageUrl=kind==='noticia'?row.image_url:row.poster_url;
    const credit=kind==='noticia'?row.image_credit:row.poster_credit;
    if(imageUrl){
     if(credit){
      await db(restId(kind,id),'PATCH',{status:'done',image_url:imageUrl,
       credit,detail:'Imagem e crédito já fornecidos na publicação'});
      done++;
     }else{
      await db(restId(kind,id),'PATCH',{status:'not_found',
       detail:'Imagem original já existente sem crédito verificado; requer revisão humana'});
      notFound++;
     }
     continue;
    }
    const asset=kind==='noticia'
     ?(await agencyBrasilAsset(row))||(await commons(title,'noticia'))
     :kind==='midia'&&row.kind==='Séries'
      ?(await tvmaze(row))||(await commons(title,'midia'))
      :await commons(title,'midia');
    if(!asset){
     notFound++;
     await db(restId(kind,id),'PATCH',{status:'not_found',
      detail:'Sem fotografia licenciada identificada; conteúdo sem imagem fictícia'});
     continue;
    }
    const path=kind==='noticia'?'news_articles':'watch_titles';
    const patch=kind==='noticia'?
     {image_url:asset.url,image_alt:asset.alt,image_credit:asset.credit,image_credit_url:asset.creditUrl}:
     {poster_url:asset.url,poster_credit:asset.credit,poster_credit_url:asset.creditUrl};
    const updated:Row[]=await db(path+'?id=eq.'+id,'PATCH',patch,'return=representation');
    if(!updated?.length)throw Error('Conteúdo não atualizado');
    await db(restId(kind,id),'PATCH',{status:'done',image_url:asset.url,
      credit:asset.credit,credit_url:asset.creditUrl,detail:'Imagem licenciada e crédito incluídos'});
    done++;
   }catch(error){
    failed++;
    try{await db(restId(kind,id),'PATCH',{status:'error',detail:String(error).slice(0,240)});}catch{}
   }
  }
  return json({status:'finished',mode:targeted?'new_publication':'scheduled_recovery',
   checked,images_added_or_verified:done,without_licensed_photo:notFound,
   errors:failed,already_handled:skipped});
 }catch(error){return json({status:'error',detail:String(error).slice(0,200)},500);}
});
