import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {getSupabase} from '@/lib/supabase';
import {getGitHubOffice} from '@/lib/office-github';
import {profiles} from '@/lib/office-shared';
import type {AgentId,AgentState,Delivery,OfficeAgent,OfficeSnapshot} from '@/lib/office-shared';

type NewsRow={id:string;slug:string;headline:string;category:string;updated_at:string};
type MatchRow={id:string;home_team:string;away_team:string;league:string;updated_at:string};
type WatchRow={id:string;title:string;kind:string;platform:string;updated_at:string};
type Run={agentId:AgentId;time:string;doneAt:string|null;status:string;count:number};
type Job={jobname:string;schedule:string;active:boolean;last_run:string|null;last_status:string|null};
type Heartbeat={agent_id:string;status:'working'|'waiting'|'completed'|'error';task:string;next_task:string|null;updated_at:string;expires_at:string|null;evidence_url:string|null};

const recent=(time:string|null|undefined,minutes:number,now:number)=>
 Boolean(time&&!Number.isNaN(Date.parse(time))&&now-Date.parse(time)>=-60000&&now-Date.parse(time)<minutes*60000);
const newer=(a:string|null,b:string|null)=>!a?b:!b?a:Date.parse(a)>=Date.parse(b)?a:b;
const jobName:Record<AgentId,string>={
 futebol:'guia-de-hoje-coletor-sql',noticias:'guia-de-hoje-editorial',
 filmes:'guia-de-hoje-editorial',series:'guia-de-hoje-editorial',
 seo:'guia-de-hoje-redator-seo'
};
const taskName:Record<AgentId,string>={
 futebol:'Próxima checagem do coletor',noticias:'Próxima checagem editorial',
 filmes:'Próxima checagem editorial',series:'Próxima checagem editorial',
 seo:'Próxima tentativa do redator SEO'
};
function cronMatches(token:string,n:number){
 if(token==='*')return true;
 if(token.startsWith('*/')){const step=Number(token.slice(2));return Number.isInteger(step)&&step>0&&n%step===0;}
 return token.split(',').some(part=>Number(part)===n);
}
function nextCron(schedule:string,now:number):string|null{
 const parts=schedule.trim().split(/\s+/);
 if(parts.length!==5)return null;
 // pg_cron do projeto usa UTC; localizar a próxima ocorrência a partir do horário real.
 const origin=Math.floor(now/60000)*60000+60000;
 for(let minutes=0;minutes<=2880;minutes++){
  const d=new Date(origin+minutes*60000);
  if(cronMatches(parts[0],d.getUTCMinutes())&&cronMatches(parts[1],d.getUTCHours())&&
    cronMatches(parts[2],d.getUTCDate())&&cronMatches(parts[3],d.getUTCMonth()+1)&&
    cronMatches(parts[4],d.getUTCDay()))return d.toISOString();
 }
 return null;
}
function classify(id:AgentId,items:Delivery[],runs:Run[],jobs:Job[],queue:number,heartbeat:Heartbeat|undefined,telemetry:boolean,now:number):OfficeAgent{
 const run=runs.slice().sort((a,b)=>Date.parse(b.time)-Date.parse(a.time))[0];
 const last=items[0]||null;
 let lastSeen=newer(run?.doneAt||run?.time||null,last?.time||null);
 const job=jobs.find(x=>x.jobname===jobName[id]);
 const nextAt=job?.active?nextCron(job.schedule,now):null;
 const nextAction=!telemetry?'Aguardando conexão da telemetria':
  !job?'Agendamento não encontrado':
  !job.active?'Agendamento desativado':taskName[id];
 let state:AgentState='waiting',activity='Aguardando próxima tarefa';
 const heartbeatFresh=Boolean(heartbeat&&recent(heartbeat.updated_at,10,now)&&(!heartbeat.expires_at||Date.parse(heartbeat.expires_at)>now));
 let lastOrigin='Nenhuma atividade confirmada';

 if(run?.status==='running'||run?.status==='processing'||run?.status==='in_progress'){
  if(recent(run.time,20,now)){state='working';activity='Execução em andamento, registrada no banco';}
 }
 if(state!=='working'&&run?.status==='error'&&recent(run.doneAt||run.time,120,now)){
  state='error';activity='Última execução registrou erro';
 }
 if(state==='waiting'&&run?.status==='pending'&&recent(run.time,20,now)){
  activity='Solicitação na fila aguardando conclusão';
 }
 if(state==='waiting'&&run?.status==='ok'&&recent(run.doneAt||run.time,90,now)){
  state='recent';activity=id==='seo'?(run.count>0?'Redação com '+run.count+' palavras registrada no banco':'Etapa de redação concluída'):run.count>0?'Coleta concluída: '+run.count+' registro(s)':'Coleta concluída, sem registros novos';
 }
 if(state==='waiting'&&last?.origin==='github'&&recent(last.time,240,now)){
  state='recent';activity='Alteração de código relacionada a '+(id==='seo'?'SEO':profiles.find(p=>p.id===id)?.job);
 }
 if(state==='waiting'&&recent(items.find(x=>x.origin!=='github')?.time,180,now)){
  state='recent';activity='Publicação recente no Guia de Hoje';
 }
 if(state==='waiting'&&last&&!run)activity='Último trabalho disponível no histórico';
 if(id==='seo'&&queue>0&&state==='waiting')activity=queue+' pauta(s) com evidências aguardando o redator';
 if(id==='seo'&&!run&&!last&&queue===0){
  state='unconnected';activity='Ainda sem execução ou entrega registrada';
 }
 // Estado emitido pelo executor autorizado. Sem heartbeat recente, não inventamos processamento.
 if(heartbeatFresh&&heartbeat){
  if(heartbeat.status==='working'){state='working';activity='Informado pelo agente: '+heartbeat.task;}
  else if(heartbeat.status==='completed'){state='recent';activity='Concluído pelo agente: '+heartbeat.task;}
  else if(heartbeat.status==='error'){state='error';activity='Agente relatou problema: '+heartbeat.task;}
  else if(state!=='working'){state='waiting';activity='Agente aguarda: '+heartbeat.task;}
  lastSeen=newer(lastSeen,heartbeat.updated_at);
 }

 const recentRun=run?.doneAt||run?.time;
 lastOrigin=last&&(!recentRun||Date.parse(last.time)>Date.parse(recentRun))?
  last.origin==='github'?'Commit no GitHub':'Publicação no site':
  run?'Execução no Supabase':last?'Publicação ou commit':'Nenhuma atividade confirmada';
 if(heartbeatFresh&&heartbeat)lastOrigin='Registro do agente no Supabase';

 return {id,state,lastSeen,activity,deliveries:items.slice(0,8),verifiedRun:Boolean(telemetry&&run),
  nextAt,nextAction,queuedCount:id==='seo'?queue:0,lastOrigin,reportedPlan:heartbeatFresh?heartbeat?.next_task||null:null};
}

export async function getOfficeSnapshot():Promise<OfficeSnapshot>{
 const checkedAt=new Date().toISOString(),now=Date.parse(checkedAt);
 const db=getSupabase();
 const [n,m,w,git]=await Promise.all([
  db.from('news_articles').select('id,slug,headline,category,updated_at').eq('status','published').order('updated_at',{ascending:false}).limit(15),
  db.from('matches').select('id,home_team,away_team,league,updated_at').eq('is_published',true).order('updated_at',{ascending:false}).limit(15),
  db.from('watch_titles').select('id,title,kind,platform,updated_at').eq('is_published',true).order('updated_at',{ascending:false}).limit(60),
  getGitHubOffice()
 ]);
 const news=(n.data||[]) as NewsRow[],matches=(m.data||[]) as MatchRow[],titles=(w.data||[]) as WatchRow[];
 const publications:Delivery[]=[
  ...news.map(x=>({id:'n-'+x.id,agentId:'noticias' as const,title:x.headline,detail:x.category||'Notícia',
   time:x.updated_at,href:'/noticias/'+encodeURIComponent(x.slug),origin:'published' as const})),
  ...matches.map(x=>({id:'m-'+x.id,agentId:'futebol' as const,title:x.home_team+' × '+x.away_team,
   detail:x.league,time:x.updated_at,href:'/futebol',origin:'published' as const})),
  ...titles.map(x=>({id:'w-'+x.id,agentId:(x.kind==='Filmes'?'filmes':'series') as AgentId,
   title:x.title,detail:x.platform||x.kind,time:x.updated_at,href:'/filmes-series',origin:'published' as const}))
 ];
 const deliveries=[...publications,...git.deliveries]
  .filter(x=>x.time&&!Number.isNaN(Date.parse(x.time)))
  .sort((a,b)=>Date.parse(b.time)-Date.parse(a.time)).slice(0,90);

 const runs:Run[]=[],jobs:Job[]=[];
 let telemetry=false,queue=0;
 const heartbeats:Heartbeat[]=[];
 // A telemetria privilegiada é habilitada apenas atrás da autenticação do escritório.
 const secret=process.env.OFFICE_PASSWORD?process.env.SUPABASE_SERVICE_ROLE_KEY:undefined;
 if(secret){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://kffzngznzjgioabtqxju.supabase.co';
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const [fixture,editorial,writer,ai,schedule,evidence,drafts,activity]=await Promise.all([
   admin.from('agent_fixture_requests').select('requested_at,processed_at,status,items_written').order('requested_at',{ascending:false}).limit(20),
   admin.from('agent_editorial_requests').select('kind,requested_at,processed_at,status,result_count').order('requested_at',{ascending:false}).limit(30),
   admin.from('editorial_writer_requests').select('created_at,processed_at,state').order('created_at',{ascending:false}).limit(20),
   admin.from('editorial_ai_runs').select('created_at,finished_at,state,word_count').order('created_at',{ascending:false}).limit(20),
   admin.rpc('office_schedule_status'),
   admin.from('editorial_evidence').select('article_id').limit(80),
   admin.from('news_articles').select('id').eq('status','draft').limit(150),
   admin.from('office_agent_activity').select('agent_id,status,task,next_task,updated_at,expires_at,evidence_url').limit(20)
  ]);
  telemetry=!fixture.error&&!editorial.error&&!writer.error&&!ai.error&&!schedule.error;
  if(!fixture.error)for(const x of fixture.data||[]){
   runs.push({agentId:'futebol',time:x.requested_at,doneAt:x.processed_at,status:x.status,count:x.items_written||0});
  }
  if(!editorial.error)for(const x of editorial.data||[]){
   const agentId:AgentId=x.kind==='filmes'?'filmes':x.kind==='tv_br'||x.kind==='tv_web'?'series':'noticias';
   runs.push({agentId,time:x.requested_at,doneAt:x.processed_at,status:x.status,count:x.result_count||0});
  }
  if(!writer.error)for(const x of writer.data||[]){
   const original=String(x.state).toLowerCase();
   const status=['ok','done','completed','success'].includes(original)?'ok':
    ['error','failed'].includes(original)?'error':
    ['running','processing','in_progress'].includes(original)?'running':'pending';
   runs.push({agentId:'seo',time:x.created_at,doneAt:x.processed_at,status,count:0});
  }
  if(!ai.error)for(const x of ai.data||[]){
   const original=String(x.state).toLowerCase();
   const status=['ok','done','completed','success','succeeded'].includes(original)?'ok':
    ['error','failed'].includes(original)?'error':
    ['running','processing','in_progress'].includes(original)?'running':'pending';
   runs.push({agentId:'seo',time:x.created_at,doneAt:x.finished_at,status,count:x.word_count||0});
  }
  if(!schedule.error&&Array.isArray(schedule.data)){
   for(const x of schedule.data as Job[])if(x&&typeof x.jobname==='string')jobs.push(x);
  }
  if(!activity.error)for(const row of (activity.data||[]) as Heartbeat[])heartbeats.push(row);
  if(!evidence.error&&!drafts.error){
   const draftIds=new Set((drafts.data||[]).map(x=>x.id));
   queue=(evidence.data||[]).filter(x=>draftIds.has(x.article_id)).length;
  }
 }
 const agents=profiles.map(p=>classify(p.id,deliveries.filter(x=>x.agentId===p.id),
  runs.filter(x=>x.agentId===p.id),jobs,queue,heartbeats.find(x=>x.agent_id===p.id),telemetry,now));
 const failures=[n.error,m.error,w.error].filter(Boolean);
 return {checkedAt,telemetry,agents,deliveries,github:git.summary,
  notice:failures.length?'Algumas publicações não puderam ser consultadas.':null};
}
