// Guia de Hoje — coletor autônomo de calendário e transmissões.
// Fonte pública não oficial: ESPN Site API. Não copia matérias nem imagens.
const LEAGUES: Record<string, string> = {
  "bra.1": "Brasileirão Série A",
  "bra.2": "Brasileirão Série B",
  "bra.copa_do_brazil": "Copa do Brasil",
  "uefa.champions": "Liga dos Campeões",
  "uefa.europa": "Liga Europa",
  "uefa.conference": "Liga Conferência",
  "eng.1": "Premier League",
  "esp.1": "La Liga",
  "ita.1": "Serie A (Itália)",
  "ger.1": "Bundesliga",
  "fra.1": "Ligue 1",
  "arg.1": "Campeonato Argentino",
  "fifa.world": "Copa do Mundo",
};
const HOST = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
const TZ = "America/Sao_Paulo";
type Obj = Record<string, any>;
function parts(date: Date): string {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date);
  const val = (t: string) => p.find(x => x.type === t)?.value || "";
  return [val("year"), val("month"), val("day")].join("-");
}
function dayStep(iso: string, add: number): string {
  const d = new Date(iso + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}
function brDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: TZ })
    .format(new Date(iso));
}
function brTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ, hour12: false })
    .format(new Date(iso));
}
function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
function statusOf(s: Obj): string {
  const code = String(s?.type?.name || "").toLowerCase();
  const state = String(s?.type?.state || "").toLowerCase();
  if (code.includes("postpon")) return "postponed";
  if (code.includes("cancel")) return "cancelled";
  if (state === "post") return "finished";
  if (state === "in") return "live";
  return "scheduled";
}
function score(val: unknown): number | null {
  const n = Number(val);
  return typeof val === "string" && val.trim() !== "" && Number.isInteger(n) && n >= 0 ? n : null;
}
function verifiedBroadcast(competition: Obj): string | null {
  // Não confundir direitos dos EUA/Portugal com direitos de exibição no Brasil.
  const sources = [
    ...(Array.isArray(competition?.geoBroadcasts) ? competition.geoBroadcasts : []),
    ...(Array.isArray(competition?.broadcasts) ? competition.broadcasts : []),
  ];
  const confirmed = sources
    .filter((x: Obj) => ["br", "bra", "brazil", "brasil"].includes(String(x.region || x.country || x.countryCode || "").toLowerCase()))
    .filter((x: Obj) => !String(x.type?.shortName || x.type?.name || "").toLowerCase().includes("radio"))
    .flatMap((x: Obj) => [
      ...(Array.isArray(x.names) ? x.names : []),
      x.media?.shortName, x.media?.name, x.name,
    ])
    .filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 1);
  return [...new Set(confirmed)].slice(0, 4).join(", ") || null;
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
Deno.serve(async req => {
  if (req.method !== "POST") return json({error:"method_not_allowed"},405);
  let db: ReturnType<typeof getAdmin>;
  try { db=getAdmin(); } catch(e) { console.error(String(e));return json({error:"config_error"},503); }
  try {
    const row: Obj[] = await db("agent_configuration?select=token&name=eq.fixtures_agent&limit=1");
    const received = req.headers.get("x-cron-token") || "";
    if (!received || !row?.[0]?.token || !eq(received,row[0].token)) return json({error:"unauthorized"},401);
  } catch(e) {console.error("Falha ao verificar cron",String(e));return json({error:"auth_error"},503);}
  const start = new Date();
  let runId: number | null=null;
  try {
    const created: Obj[] = await db("agent_runs?select=id","POST",[{status:"running"}],{"Prefer":"return=representation"});
    runId=created?.[0]?.id ?? null;
  } catch(e){console.error("Registro do agente",String(e));}
  const today = parts(start);
  const end = dayStep(today, 7);
  const beginDate = dayStep(today, -1);
  const from = beginDate.replaceAll("-", "");
  const until = end.replaceAll("-", "");
  let found=0,written=0,confirmed=0,successSources=0;
  const errors: string[]=[];
  const stored = new Set<string>();
  for (const [code, leagueName] of Object.entries(LEAGUES)) {
    try {
      const url = HOST + encodeURIComponent(code) + "/scoreboard?dates=" + from + "-" + until + "&limit=250";
      const controller = new AbortController();
      const kill = setTimeout(() => controller.abort(), 11000);
      let response: Response;
      try {response=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/json"}});}
      finally{clearTimeout(kill);}
      if (!response.ok) throw new Error("HTTP " + response.status);
      const body = await response.json() as Obj;
      if (!Array.isArray(body.events)) throw new Error("Resposta sem eventos");
      successSources++;
      const candidates: Obj[] = [];
      for (const event of body.events.slice(0,250)) {
        const game=event.competitions?.[0] || {};
        const competitors: Obj[] = Array.isArray(game.competitors) ? game.competitors : [];
        const home = competitors.find(x=>x.homeAway==="home");
        const away = competitors.find(x=>x.homeAway==="away");
        const matchDate = String(event.date || game.date || "");
        const eventId = String(event.id || "");
        const kickoff=new Date(matchDate);
        if (!home?.team?.displayName || !away?.team?.displayName || !eventId || !Number.isFinite(kickoff.valueOf())) continue;
        const gameDay=parts(kickoff);
        if (gameDay < today || gameDay > end) continue;
        const ref="espn:" + code + ":" + eventId;
        if (stored.has(ref)) continue;
        stored.add(ref);
        const channel=verifiedBroadcast(game);
        const homeName=String(home.team.displayName).slice(0,120);
        const awayName=String(away.team.displayName).slice(0,120);
        const slug=[slugify(homeName), "x", slugify(awayName), eventId].join("-").slice(0,220);
        const broadcastText=channel ? "Transmissão no Brasil: " + channel + "." : "Transmissão no Brasil ainda não confirmada.";
        const descriptor=homeName + " x " + awayName + ", " + leagueName + ", " + brDate(matchDate) +
          " às " + brTime(matchDate) + " (Brasília). " + broadcastText + " Consulte possíveis alterações.";
        const state=statusOf(event.status || game.status || {});
        const scoreVisible=state==="live"||state==="finished";
        const links: Obj[] = Array.isArray(event.links) ? event.links : [];
        const source=links.map(x=>String(x.href||"")).find(x=>/^https:\/\/(www\.)?espn\.com\//.test(x)) ||
          "https://www.espn.com/soccer/match/_/gameId/" + encodeURIComponent(eventId);
        const row: Obj={
          external_ref:ref,slug,game_date:gameDay,league:leagueName,
          kickoff_at:kickoff.toISOString(),home_team:homeName,
          home_abbr:String(home.team.abbreviation || homeName.slice(0,3)).slice(0,8),
          away_team:awayName,away_abbr:String(away.team.abbreviation || awayName.slice(0,3)).slice(0,8),
          home_score:scoreVisible ? score(home.score):null,
          away_score:scoreVisible ? score(away.score):null,
          status:state,is_published:true,source_url:source,
          seo_description:descriptor.slice(0,290),last_checked_at:start.toISOString(),
          data_provider:"espn",
        };
        if(channel) {row.broadcast=channel;row.broadcast_status="confirmed";row.broadcaster_source=source;}
        candidates.push(row);
      }
      found+=candidates.length;
      if(candidates.length) {
        const ids=candidates.map(x=>x.external_ref);
        const old:Obj[]=await db("matches?select=external_ref,slug,broadcast,broadcast_status,broadcaster_source&external_ref=in.("+ids.map(encodeURIComponent).join(",")+")");
        const previous=new Map(old.map(x=>[x.external_ref,x]));
        for(const item of candidates) {
          const prev=previous.get(item.external_ref);
          if(prev?.slug) item.slug=prev.slug;
          if(prev?.broadcast_status==="confirmed" && !item.broadcast){
            item.broadcast=prev.broadcast;item.broadcast_status="confirmed";item.broadcaster_source=prev.broadcaster_source;
          }
          if(prev?.broadcast_status==="confirmed" && prev.broadcaster_source && !prev.broadcaster_source.includes("espn.com")){
            item.broadcast=prev.broadcast;item.broadcast_status="confirmed";item.broadcaster_source=prev.broadcaster_source;
          }
          if(item.broadcast_status==="confirmed") confirmed++;
        }
        // Registro por registro evita falha de lote por nomes/confrontos anômalos.
        for(const item of candidates){
          try {
            await db("matches?on_conflict=external_ref","POST",[item],{"Prefer":"resolution=merge-duplicates,return=minimal"});
            written++;
          } catch(e){errors.push(leagueName + ": " + String(e).slice(0,120));}
        }
      }
    } catch(e){
      const message=leagueName+": "+String(e).slice(0,130);
      errors.push(message);console.warn("Fonte futebol indisponível",message);
    }
    await new Promise(done=>setTimeout(done,450));
  }
  const status=successSources===0||written===0&&found>0?"error":errors.length?"partial":"ok";
  const result={status,days:8,league_count:Object.keys(LEAGUES).length,source_ok:successSources,
    games_found:found,games_written:written,broadcasts_verified:confirmed,errors:errors.slice(0,30)};
  try{
    if(runId)await db("agent_runs?id=eq."+runId,"PATCH",
      {status,finished_at:new Date().toISOString(),games_found:found,games_written:written,
        broadcasts_verified:confirmed,errors:errors.slice(0,30)});
  }catch(e){console.error("Falha ao registrar conclusão",String(e));}
  return json(result,status==="error"?502:200);
});
