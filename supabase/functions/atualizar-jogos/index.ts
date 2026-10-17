// Coletor gratuito Guia de Hoje. Fonte documentada: TheSportsDB v1 API.
// Importa agenda para 8 dias; direitos de transmissão apenas se país Brasil.
const HOST="https://www.thesportsdb.com/api/v1/json/123/";
const TZ="America/Sao_Paulo";
const LEAGUES:Record<string,string>={
  "4351":"Brasileirão Série A",
  "4725":"Copa do Brasil",
  "4328":"Premier League",
  "4335":"La Liga",
  "4331":"Bundesliga",
  "4332":"Serie A (Itália)",
  "4334":"Ligue 1",
  "4337":"Liga dos Campeões",
  "4406":"Campeonato Argentino",
  "4346":"MLS",
};
type Obj=Record<string,any>;
function parts(date:Date):string {
  const data = new Intl.DateTimeFormat("en-US",{
    timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(date);
  const piece=(v:string)=>data.find(p=>p.type===v)?.value||"";
  return [piece("year"),piece("month"),piece("day")].join("-");
}
function dayStep(iso:string,number:number):string {
  const d=new Date(iso+"T12:00:00Z");
  d.setUTCDate(d.getUTCDate()+number);
  return d.toISOString().slice(0,10);
}
function dateTime(row:Obj):Date|null {
  let raw=String(row.strTimestamp||row.strTimeStamp||"");
  if(!raw) {
    if(!row.dateEvent || !row.strTime)return null;
    raw=String(row.dateEvent)+"T"+String(row.strTime);
  }
  raw=raw.trim().replace(" ","T");
  if(!/[zZ]|[+-]\d\d:\d\d$/.test(raw))raw+="Z"; // TheSportsDB publica horários em UTC
  const d=new Date(raw);
  return Number.isFinite(d.getTime())?d:null;
}
function brDate(iso:string):string {
  return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"long",year:"numeric",timeZone:TZ}).format(new Date(iso));
}
function brTime(iso:string):string {
  return new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:TZ}).format(new Date(iso));
}
function slugify(s:string){
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);
}
function statusOf(row:Obj):string {
  const status=String(row.strStatus||"").toLowerCase();
  if(status.includes("cancel"))return "cancelled";
  if(status.includes("postpon"))return "postponed";
  if(status.includes("finish")||status.includes("full time"))return "finished";
  if(status.includes("live")||status.includes("in progress"))return "live";
  return "scheduled";
}
function score(x:unknown):number|null {
  if(x===null||x===undefined||x==="")return null;
  const n=Number(x);
  return Number.isInteger(n)&&n>=0?n:null;
}
let nextAllowedRequest=0;
async function sourceJson(path:string):Promise<Obj> {
  // Limitação deliberada para respeitar os limites do serviço gratuito.
  const wait=Math.max(0,nextAllowedRequest-Date.now());
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  nextAllowedRequest=Date.now()+1800;
  const controller=new AbortController();
  const kill=setTimeout(()=>controller.abort(),11000);
  try{
    const res=await fetch(HOST+path,{signal:controller.signal,headers:{"Accept":"application/json"}});
    if(res.status===429)nextAllowedRequest=Math.max(nextAllowedRequest,Date.now()+12000);
    if(!res.ok)throw Error("HTTP "+res.status);
    return await res.json();
  } finally {clearTimeout(kill);}
}
function makeMatch(row:Obj,leagueName:string,channel?:string):Obj|null {
  const eventId=String(row.idEvent||"");
  const time=dateTime(row);
  const home=String(row.strHomeTeam||"").trim().slice(0,120);
  const away=String(row.strAwayTeam||"").trim().slice(0,120);
  if(!eventId||!time||home.length<2||away.length<2)return null;
  const date=time.toISOString();
  const broadcast=channel||null;
  const summary=home+" x "+away+", "+leagueName+", "+brDate(date)+
    " às "+brTime(date)+" (Brasília). "+(broadcast?
    "Transmissão brasileira identificada: "+broadcast+".":"Transmissão no Brasil a confirmar.")+
    " Programação sujeita a alterações.";
  const state=statusOf(row);
  const showScore=state==="live"||state==="finished";
  const item:Obj={
    external_ref:"thesportsdb:"+eventId,
    slug:[slugify(home),"x",slugify(away),eventId].join("-").slice(0,220),
    game_date:parts(time),league:leagueName,kickoff_at:date,
    home_team:home,home_abbr:home.slice(0,3).toUpperCase(),
    away_team:away,away_abbr:away.slice(0,3).toUpperCase(),
    home_score:showScore?score(row.intHomeScore):null,
    away_score:showScore?score(row.intAwayScore):null,
    status:state,is_published:true,
    source_url:"https://www.thesportsdb.com/event/"+encodeURIComponent(eventId),
    seo_description:summary.slice(0,290),
    last_checked_at:new Date().toISOString(),
    data_provider:"thesportsdb",
  };
  if(broadcast){
    item.broadcast=broadcast;
    item.broadcast_status="confirmed";
    item.broadcaster_source="https://www.thesportsdb.com/docs/api";
  }
  return item;
}
function eq(a: string,b: string): boolean {
  if(a.length!==b.length) return false;
  let difference=0;
  for(let i=0;i<a.length;i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference===0;
}
function json(data: Obj, status=200): Response {
  return Response.json(data, {status, headers: {"Cache-Control":"no-store"}});
}
function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) {
    try { key = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default; } catch { /* missing */ }
  }
  if (!url || !key) throw new Error("Supabase: credencial administrativa indisponível");
  return async (endpoint: string, method="GET", payload?: unknown, extra: Record<string,string>={}) => {
    const res = await fetch(url + "/rest/v1/" + endpoint, {
      method, headers: {
        "apikey": key!, "Authorization": "Bearer " + key!,
        "Content-Type": "application/json", ...extra,
      }, body: payload===undefined ? undefined : JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Banco " + method + " " + endpoint.split("?")[0] + ": HTTP " + res.status + " " + (await res.text()).slice(0,170));
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };
}

Deno.serve(async (req:Request)=>{
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  let db:ReturnType<typeof getAdmin>;
  try{db=getAdmin();}catch(e){console.error(String(e));return json({error:"config_error"},503);}
  try{
    const rows:Obj[]=await db("agent_configuration?select=token&name=eq.fixtures_agent&limit=1");
    const token=req.headers.get("x-cron-token")||"";
    if(!token||!rows?.[0]?.token||!eq(token,rows[0].token))return json({error:"unauthorized"},401);
  }catch(e){console.error("Auth",String(e));return json({error:"auth_error"},503);}
  let runId:number|null=null;
  try{
    const rows:Obj[]=await db("agent_runs?select=id","POST",[{status:"running"}],{"Prefer":"return=representation"});
    runId=rows?.[0]?.id??null;
  }catch(e){console.error("Log inicial",String(e));}
  let found=0,written=0,confirmed=0,sourceOK=0;
  const errors:string[]=[];
  const dates:string[]=[];
  const today=parts(new Date());
  for(let n=-1;n<=8;n++)dates.push(dayStep(today,n));
  const records=new Map<string,Obj>();
  const tvByEvent=new Map<string,string>();
  const tvRecords=new Map<string,Obj>();
  // O plano gratuito limita a 1 transmissão por consulta/dia.
  // Nunca deduzir canal a partir de direitos de outro país.
  for(const date of dates) {
    try{
      const payload=await sourceJson("eventstv.php?d="+date+"&a=Brazil&s=Soccer");
      sourceOK++;
      for(const tv of (Array.isArray(payload.tvevents)?payload.tvevents:[]) as Obj[]){
        if(!["brazil","brasil","br"].includes(String(tv.strCountry||"").toLowerCase()))continue;
        if(String(tv.strSport||"").toLowerCase()!=="soccer")continue;
        const id=String(tv.idEvent||"");
        const channel=String(tv.strChannel||"").trim();
        if(!id || !channel)continue;
        tvByEvent.set(id,channel);
        tvRecords.set(id,tv);
      }
    }catch(e){errors.push("TV "+date+": "+String(e).slice(0,110));}
    await new Promise(done=>setTimeout(done,160));
  }
  // A camada gratuita retorna no máximo 3 partidas por data. Consultamos
  // o calendário geral e o próximo jogo de cada competição, poupando a cota.
  for(const date of dates){
    if(date<today || date>dayStep(today,7))continue;
    try{
      const response=await sourceJson("eventsday.php?d="+date+"&s=Soccer");
      sourceOK++;
      for(const event of (Array.isArray(response.events)?response.events:[]) as Obj[]){
        const entry=makeMatch(event,String(event.strLeague||"Futebol"),tvByEvent.get(String(event.idEvent||"")));
        if(entry && entry.game_date>=today && entry.game_date<=dayStep(today,7))
          records.set(entry.external_ref,entry);
      }
    }catch(e){errors.push("Agenda "+date+": "+String(e).slice(0,90));}
  }
  for(const [leagueId,leagueName] of Object.entries(LEAGUES)){
    try{
      const response=await sourceJson("eventsnextleague.php?id="+leagueId);
      sourceOK++;
      for(const event of (Array.isArray(response.events)?response.events:[]) as Obj[]){
        const entry=makeMatch(event,leagueName,tvByEvent.get(String(event.idEvent||"")));
        if(entry && entry.game_date>=today && entry.game_date<=dayStep(today,7))
          records.set(entry.external_ref,entry);
      }
    }catch(e){errors.push(leagueName+": "+String(e).slice(0,90));}
  }
  // Os anúncios oficiais de TV no Brasil podem existir sem presença no
  // recorte de 3 eventos da API gratuita. Consultamos o jogo pelo ID.
  for(const [id,tv] of tvRecords) {
    const key="thesportsdb:"+id;
    if(records.has(key))continue;
    try{
      const event=await sourceJson("lookupevent.php?id="+encodeURIComponent(id));
      sourceOK++;
      const match=Array.isArray(event.events)?event.events[0]:null;
      if(!match)continue;
      const item=makeMatch(match,String(match.strLeague||"Futebol"),tvByEvent.get(id));
      if(item && item.game_date>=today && item.game_date<=dayStep(today,7))records.set(key,item);
    }catch(e){errors.push("TV jogo "+id+": "+String(e).slice(0,90));}
  }
  found=records.size;
  const candidates=[...records.values()].slice(0,280);
  if(candidates.length) {
    // Preservar slugs indexados e transmissões verificadas manualmente.
    for(let i=0;i<candidates.length;i+=35){
      const batch=candidates.slice(i,i+35);
      try{
        const refs=batch.map(x=>encodeURIComponent(x.external_ref)).join(",");
        const existing:Obj[]=await db("matches?select=external_ref,slug,broadcast,broadcast_status,broadcaster_source&external_ref=in.("+refs+")");
        const previous=new Map(existing.map(x=>[x.external_ref,x]));
        for(const item of batch){
          const prev=previous.get(item.external_ref);
          if(prev?.slug)item.slug=prev.slug;
          if(prev?.broadcast_status==="confirmed" && !item.broadcast){
            item.broadcast=prev.broadcast;item.broadcast_status="confirmed";item.broadcaster_source=prev.broadcaster_source;
          }
          if(prev?.broadcast_status==="confirmed" && prev.broadcaster_source &&
            !prev.broadcaster_source.includes("thesportsdb.com")){
            item.broadcast=prev.broadcast;item.broadcast_status="confirmed";item.broadcaster_source=prev.broadcaster_source;
          }
          if(item.broadcast_status==="confirmed")confirmed++;
          try{
            await db("matches?on_conflict=external_ref","POST",[item],{"Prefer":"resolution=merge-duplicates,return=minimal"});
            written++;
          }catch(e){errors.push("Salvando "+item.external_ref+": "+String(e).slice(0,120));}
        }
      }catch(e){errors.push("Consulta existentes: "+String(e).slice(0,125));}
    }
  }
  const status=sourceOK===0 || (found>0&&written===0)?"error":errors.length?"partial":"ok";
  const result={status,provider:"TheSportsDB",days:8,competitions:Object.keys(LEAGUES).length,
    source_ok:sourceOK,games_found:found,games_written:written,broadcasts_verified:confirmed,
    errors:errors.slice(0,24)};
  try{if(runId)await db("agent_runs?id=eq."+runId,"PATCH",{
    status,finished_at:new Date().toISOString(),
    games_found:found,games_written:written,broadcasts_verified:confirmed,
    errors:errors.slice(0,24),
  });}catch(e){console.error("Log final",String(e));}
  return json(result,status==="error"?502:200);
});
