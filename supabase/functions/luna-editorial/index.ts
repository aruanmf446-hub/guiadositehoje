// Luna: uma publicação editorial verificada por turno; jamais finge que catálogo é SEO.
type Row=Record<string,any>;
const ACCOUNT='5070a936fccb62cf5e8f0e89dab12554';
const MODEL='@cf/mistralai/mistral-small-3.1-24b-instruct';
const reply=(data:Row,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function strip(x:string){return x.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();}
function parse(x:string):Row{
 const a=x.indexOf('{'),b=x.lastIndexOf('}');
 if(a<0||b<a)throw Error('JSON ausente na IA');
 const raw=x.slice(a,b+1);
 try{return JSON.parse(raw);}catch{}
 let s='',quoted=false,escaped=false;
 for(const c of raw){
  if(escaped){s+=c;escaped=false;continue;}
  if(c==='\\'){s+=c;escaped=true;continue;}
  if(c==='"'){s+=c;quoted=!quoted;continue;}
  if(quoted&&c==='\n')s+='\\n';
  else if(quoted&&c==='\r')s+='\\r';
  else if(quoted&&c==='\t')s+='\\t';
  else if(quoted&&c.charCodeAt(0)<32)s+=' ';
  else s+=c;
 }
 return JSON.parse(s);
}
function localParts(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const val=(p:string)=>parts.find(x=>x.type===p)?.value||'';
 return {day:val('year')+'-'+val('month')+'-'+val('day'),hour:Number(val('hour'))};
}
function client(){
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)throw Error('Banco indisponível');
 return async(path:string,method='GET',payload?:unknown,prefer='')=>{
  const r=await fetch(url+'/rest/v1/'+path,{method,
   headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',
    ...(prefer?{Prefer:prefer}:{})},
   body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(18000)});
  const body=await r.text();
  if(!r.ok)throw Error('DB HTTP '+r.status+': '+body.slice(0,150));
  return body?JSON.parse(body):null;
 };
}
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'method'},405);
 let db:ReturnType<typeof client>;
 try{db=client();}catch{return reply({error:'db_configuration'},503);}
 try{
  const config:Row[]=await db('agent_configuration?select=token&name=eq.luna_editor');
  const token=req.headers.get('x-luna-cron')||'';
  if(!token||config[0]?.token!==token)return reply({error:'unauthorized'},401);
 }catch{return reply({error:'auth_failure'},503);}
 const aiToken=Deno.env.get('CLOUDFLARE_AI_TOKEN');
 if(!aiToken)return reply({error:'cloudflare_token_missing'},503);
 const {day,hour}=localParts(),baseSlot=day+'/'+(hour<12?'manha':'noite');
 const past:Row[]=await db('luna_editorial_runs?select=title_id,slot_key,state,started_at&order=started_at.desc&limit=150');
 const primary=past.find(r=>r.slot_key===baseSlot);
 const slot=primary&&['error','needs_review'].includes(primary.state)?baseSlot+'/retry':baseSlot;
 if(past.some(r=>r.slot_key===slot)||['published','running'].includes(primary?.state||''))
   return reply({status:'slot_already_checked',slot});
 if(past.filter(r=>r.slot_key.startsWith(day+'/')&&r.state==='published').length>=2)
  return reply({status:'daily_limit',slot});
 const items:Row[]=await db('watch_titles?select=id,title,synopsis,source_url,external_ref,editorial_body,availability_status&kind=eq.S%C3%A9ries&is_published=eq.true&order=updated_at.desc&limit=100');
 const seen=new Set(past.filter(r=>Date.now()-Date.parse(r.started_at)<86400000).map(r=>r.title_id));
 const candidates=items.filter(r=>!seen.has(r.id)&&!r.editorial_body
  &&/^tvmaze:\d+$/.test(r.external_ref||'')
  &&/^https:\/\/www\.tvmaze\.com\//.test(r.source_url||'')
  &&typeof r.synopsis==='string'&&r.synopsis.length>=210);
 candidates.sort((a,b)=>(b.availability_status==='schedule_br'?1:0)-(a.availability_status==='schedule_br'?1:0)
  ||(b.synopsis||'').length-(a.synopsis||'').length);
 const item=candidates[0];
 if(!item)return reply({status:'no_suitable_verified_source',slot});
 const rows:Row[]=await db('luna_editorial_runs','POST',[{
  title_id:item.id,slot_key:slot,state:'running',source_url:item.source_url,model:MODEL}],
  'resolution=ignore-duplicates,return=representation');
 if(!rows.length)return reply({status:'locked',slot});
 const runId=rows[0].id;
 const finish=async(state:string,detail:string,words=0)=>{
  await db('luna_editorial_runs?id=eq.'+runId,'PATCH',{
   state,detail:detail.slice(0,400),word_count:words||null,finished_at:new Date().toISOString()});
 };
 try{
  const id=item.external_ref.split(':')[1];
  const source=await fetch('https://api.tvmaze.com/shows/'+id,{signal:AbortSignal.timeout(15000)});
  if(!source.ok)throw Error('TVmaze HTTP '+source.status);
  const show:Row=await source.json();
  if(String(show.id)!==id||!String(show.url||'').startsWith('https://www.tvmaze.com/'))
   throw Error('Fonte da série não corresponde');
  const synopsis=strip(String(show.summary||''));
  if(synopsis.length<210){await finish('needs_review','Sinopse insuficiente');return reply({status:'needs_review',slot});}
  const facts={name:show.name,synopsis:synopsis.slice(0,1600),
   genres:Array.isArray(show.genres)?show.genres.slice(0,5):[],
   language:show.language||null,premiered:show.premiered||null,
   channel:show.network?.name||show.webChannel?.name||null,
   brazil: item.availability_status==='schedule_br'?'grade brasileira confirmada':'não confirmada',
   source:show.url};
  const instruction='Redija uma ficha ORIGINAL em português do Brasil com fatos EXCLUSIVAMENTE dos dados JSON. Não invente elenco, episódios, temporadas, premiações, ano, streaming no Brasil, opinião ou audiência. Parafraseie a sinopse sem copiar frases longas. Se informação insuficiente, retorne {"insufficient":true}. Responda APENAS JSON {"seo_title":"...","seo_description":"...","body":"..."}: SEO title até 90 caracteres, descrição entre 100 e 160 caracteres, body de 480 a 1000 caracteres dividido em três parágrafos (quebras escapadas como \\n\\n), contando premissa, gênero e informações verificadas. Não repita ideias para atingir tamanho. Não afirme disponibilidade no Brasil se não confirmada.';
  const resp=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/ai/run/'+MODEL,{
   method:'POST',headers:{Authorization:'Bearer '+aiToken,'Content-Type':'application/json'},
   body:JSON.stringify({messages:[{role:'system',content:instruction},
    {role:'user',content:JSON.stringify(facts)}],temperature:0.15,max_tokens:1400}),
   signal:AbortSignal.timeout(85000)});
  if(!resp.ok)throw Error('Cloudflare HTTP '+resp.status);
  const data:Row=await resp.json();
  const outputText=String(data.result?.response||data.result?.choices?.[0]?.message?.content||'');
  const generated=parse(outputText);
  if(generated.insufficient){await finish('needs_review','Fonte insuficiente segundo a IA');return reply({status:'needs_review',slot});}
  const body=String(generated.body||'').trim(),seoTitle=String(generated.seo_title||'').trim(),
   description=String(generated.seo_description||'').trim();
  const words=body.split(/\s+/).length;
  const normalized=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .replace(/\s+/g,' ').trim();
  const main=normalized(body),original=normalized(synopsis);
  let copy=false;
  for(let i=0;i+100<main.length;i+=50)if(original.includes(main.slice(i,i+100))){copy=true;break;}
  const unsupported=(body.match(/\b(?:19|20)\d{2}\b/g)||[]).some(y=>!JSON.stringify(facts).includes(y));
  const invalid=body.length<380||body.length>1450||words<55||seoTitle.length<15||
   seoTitle.length>105||description.length<85||description.length>190||
   copy||unsupported||/obra-prima|imperdível|efeitos visuais impressionantes|trilha sonora|aclamad[oa]|premiad[oa]/i.test(body)||
   /disponível no brasil|assista no brasil/i.test(body)&&facts.brazil==='não confirmada';
  if(invalid){await finish('needs_review','Falha nos filtros de texto, fatos ou originalidade',words);
   return reply({status:'needs_review',slot,words});}
  const saved:Row[]=await db('watch_titles?id=eq.'+item.id,'PATCH',{
   editorial_body:body,seo_title:seoTitle.slice(0,100),
   seo_description:description.slice(0,190),updated_at:new Date().toISOString()},
   'return=representation');
  if(!saved?.length)throw Error('Ficha não foi persistida');
  await finish('published','Guia original revisado e gravado no Supabase',words);
  return reply({status:'published',slot,title:item.title,words});
 }catch(e){
  try{await finish('error',String(e));}catch{}
  return reply({status:'error',slot,message:String(e).slice(0,190)},500);
 }
});
