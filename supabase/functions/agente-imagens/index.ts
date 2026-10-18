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
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 let db:ReturnType<typeof dbClient>;
 try{db=dbClient();}catch{return json({error:'db_unavailable'},503);}
 try{
  const cfg:Row[]=await db('agent_configuration?name=eq.images_editor&select=token');
  const secret=req.headers.get('x-image-cron')||'';
  if(!secret||!cfg.length||cfg[0].token!==secret)return json({error:'unauthorized'},401);
 }catch{return json({error:'auth_unavailable'},503);}
 try{
  const [news,media,old]:[Row[],Row[],Row[]]=await Promise.all([
   db('news_articles?select=id,headline,category&status=eq.published&image_url=is.null&order=published_at.desc&limit=12'),
   db('watch_titles?select=id,title,kind,external_ref,source_url&is_published=eq.true&poster_url=is.null&order=updated_at.desc&limit=18'),
   db('agent_image_runs?select=kind,item_id,status,attempts,attempted_at&order=attempted_at.desc&limit=400')
  ]);
  let checked=0,done=0,notFound=0,failed=0;
  for(const item of [...news.map(x=>({...x,kindImage:'noticia'})),
   ...media.map(x=>({...x,kindImage:'midia'}))].slice(0,25)){
   const kind=item.kindImage as 'noticia'|'midia',title=String(item.headline||item.title||'');
   const previous=old.find(r=>r.kind===kind&&r.item_id===item.id);
   const age=previous?Date.now()-Date.parse(previous.attempted_at):Infinity;
   if(previous&&(previous.status==='done'||previous.attempts>=3||
    previous.status==='not_found'&&age<7*86400000||
    previous.status==='processing'&&age<50*60000||
    previous.status==='error'&&age<2*3600000))continue;
   checked++;
   await db('agent_image_runs?on_conflict=kind,item_id','POST',[{
    kind,item_id:item.id,title:title.slice(0,220),status:'processing',
    attempts:(previous?.attempts||0)+1,attempted_at:new Date().toISOString(),
    detail:'Busca em fontes autorizadas'}],'resolution=merge-duplicates');
   try{
    const asset=kind==='midia'&&item.kind==='Séries'
      ?(await tvmaze(item))||(await commons(title,kind))
      :await commons(title,kind);
    if(!asset){
     notFound++;
     await db('agent_image_runs?kind=eq.'+kind+'&item_id=eq.'+item.id,'PATCH',
      {status:'not_found',detail:'Sem fotografia com licença e identificação suficientes'});
     continue;
    }
    const target=kind==='noticia'?'news_articles':'watch_titles';
    const patch=kind==='noticia'?
     {image_url:asset.url,image_alt:asset.alt,image_credit:asset.credit,image_credit_url:asset.creditUrl}:
     {poster_url:asset.url,poster_credit:asset.credit,poster_credit_url:asset.creditUrl};
    const updated:Row[]=await db(target+'?id=eq.'+item.id,'PATCH',patch,'return=representation');
    if(!updated?.length)throw Error('Publicação não atualizada');
    await db('agent_image_runs?kind=eq.'+kind+'&item_id=eq.'+item.id,'PATCH',
     {status:'done',image_url:asset.url,credit:asset.credit,credit_url:asset.creditUrl,
      detail:'Imagem vinculada e créditos registrados'});
    done++;
   }catch(err){
    failed++;
    await db('agent_image_runs?kind=eq.'+kind+'&item_id=eq.'+item.id,'PATCH',
     {status:'error',detail:String(err).slice(0,240)});
   }
  }
  return json({status:'finished',checked,images_added:done,without_verified_license:notFound,errors:failed});
 }catch(err){return json({status:'error',message:String(err).slice(0,220)},500);}
});
