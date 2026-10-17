import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {getSupabase} from '@/lib/supabase';
import {getGitHubOffice} from '@/lib/office-github';
import {profiles} from '@/lib/office-shared';
import type {AgentId,AgentState,Delivery,OfficeAgent,OfficeSnapshot,OfficeMission,OfficeStep} from '@/lib/office-shared';

type NewsRow={id:string;slug:string;headline:string;category:string;updated_at:string};
type MatchRow={id:string;home_team:string;away_team:string;league:string;updated_at:string};
type WatchRow={id:string;title:string;kind:string;platform:string;updated_at:string};
type Run={agentId:AgentId;time:string;doneAt:string|null;status:string;count:number;kind?:string;subject?:string;error?:string|null};
type Job={jobname:string;schedule:string;active:boolean;last_run:string|null;last_status:string|null};
type DesignAudit={run_id:number;status:string;started_at:string;finished_at:string|null;report:string|null;artifact_url:string|null;error_message:string|null;observations:unknown};
type Heartbeat={agent_id:string;status:'working'|'waiting'|'completed'|'error';task:string;next_task:string|null;updated_at:string;expires_at:string|null;evidence_url:string|null};

const recent=(time:string|null|undefined,minutes:number,now:number)=>
 Boolean(time&&!Number.isNaN(Date.parse(time))&&now-Date.parse(time)>=-60000&&now-Date.parse(time)<minutes*60000);
const newer=(a:string|null,b:string|null)=>!a?b:!b?a:Date.parse(a)>=Date.parse(b)?a:b;
const jobName:Record<AgentId,string>={
 futebol:'guia-de-hoje-coletor-sql',noticias:'guia-de-hoje-editorial',
 filmes:'guia-de-hoje-editorial',series:'guia-de-hoje-editorial',
 seo:'guia-de-hoje-redator-seo',design:'milly-semanal'
};
const taskName:Record<AgentId,string>={
 futebol:'Próxima checagem do coletor',noticias:'Próxima checagem editorial',
 filmes:'Próxima checagem editorial',series:'Próxima checagem editorial',
 seo:'Próxima tentativa do redator SEO',design:'Próxima auditoria visual semanal'
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
 for(let minutes=0;minutes<=10080;minutes++){
  const d=new Date(origin+minutes*60000);
  if(cronMatches(parts[0],d.getUTCMinutes())&&cronMatches(parts[1],d.getUTCHours())&&
    cronMatches(parts[2],d.getUTCDate())&&cronMatches(parts[3],d.getUTCMonth()+1)&&
    cronMatches(parts[4],d.getUTCDay()))return d.toISOString();
 }
 return null;
}
const focusFor:Record<AgentId,string>={
 futebol:'Conferir jogos das séries brasileiras, datas e transmissões verificadas',
 noticias:'Recolher manchetes e preparar pautas a partir das fontes identificadas',
 filmes:'Pesquisar fichas de filmes e organizar referências para o catálogo',
 series:'Conferir a programação de séries e atualizar informações disponíveis',
 seo:'Selecionar pautas, gerar matéria com IA e validar texto antes da publicação',
 design:'Revisar capturas reais do site e sugerir melhorias de UX/UI'
};
function missionFor(id:AgentId,runs:Run[],nextAt:string|null,queue:number,now:number,jobs:Job[]):OfficeMission{
 const sorted=[...runs].sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
 const first=sorted[0];
 const fresh=first&&recent(first.time,14*60,now);
 const active=Boolean(fresh&&sorted.some(r=>r.status==='running'&&recent(r.time,25,now)
   ||r.status==='pending'&&recent(r.time,25,now)));
 const todayRuns=fresh?sorted.filter(r=>Math.abs(Date.parse(r.time)-Date.parse(first.time))<35*60000):[];
 const completed=todayRuns.filter(r=>Boolean(r.doneAt)&&['ok','published','needs_review','error','failed'].includes(r.status));
 const failed=todayRuns.filter(r=>['error','failed'].includes(r.status));
 const processed=completed.reduce((sum,r)=>sum+(r.count||0),0);
 const label=(when:string|null)=>when?new Intl.DateTimeFormat('pt-BR',
  {timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date(when)):'Sem horário';
 const latestEnd=completed.map(r=>r.doneAt).filter((t):t is string=>Boolean(t))
  .sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
 const hasRequests=todayRuns.length>0;
 const stage=(title:string,detail:string,status:OfficeStep['status'],at:string|null=null):OfficeStep=>
  ({title,detail,status,at});
 const nextTime=nextAt?label(nextAt):'a definir';
 const stageJob=jobs.find(j=>j.jobname===(id==='futebol'?
   'guia-de-hoje-coletor-processar':'guia-de-hoje-editorial-processar'));
 const processAt=id==='seo'?null:hasRequests&&stageJob?.active?
   nextCron(stageJob.schedule,Date.parse(first.time)):null;
 const processNote=processAt?
   'Próxima etapa marcada para '+label(processAt)+' (Brasília)':
   'Aguardando processamento registrado';
 const title=id==='design'?'Revisão visual semanal da Milly':id==='futebol'?'Rodada de atualização do futebol':
  id==='noticias'?'Rodada de pesquisa editorial':id==='filmes'?'Pesquisa de filmes':
  id==='series'?'Pesquisa de séries':'Produção editorial com IA';
 const workDescription=active?(id==='seo'?'Texto em processamento pelo redator':
   'Consultas externas enviadas; aguardando retorno real'):
   hasRequests?(failed.length?'Algumas solicitações falharam; verifique a próxima rodada':
     'Último processamento registrado; sem trabalho contínuo em segundo plano'):
     'Aguardando a próxima execução programada';
 const stages:OfficeStep[]=[
  stage(id==='seo'?'Selecionar pauta com fonte':'Solicitar informações nas fontes',
   hasRequests?todayRuns.length+' solicitação(ões) no Supabase':
     id==='seo'?queue+' pauta(s) com evidências na fila':'Agendado para '+nextTime,
   hasRequests?'done':'next',hasRequests?first.time:nextAt),
  stage(id==='seo'?'Gerar texto por IA':'Receber e processar respostas',
   active?workDescription:completed.length?
    completed.length+' de '+todayRuns.length+' solicitações processadas':
    hasRequests?processNote:'Nenhuma execução registrada nesta rodada',
   active?'active':failed.length&&!completed.length?'error':completed.length?'done':'next',
   active?first.time:latestEnd||processAt),
  stage(id==='seo'?'Checar qualidade e publicação':'Registrar resultados no portal',
   hasRequests?(failed.length?failed.length+' falha(s) confirmada(s). ':
    '')+(processed>0?processed+' registro(s) confirmado(s)':'Nenhuma nova entrega confirmada'):
    'Disponível após o processamento',
   active?'next':failed.length?'error':completed.length?'done':'next',latestEnd),
  stage('Próxima rodada agendada',
   nextAt?'Nova janela às '+nextTime+' (horário de Brasília)':'Ainda sem próxima data confirmada',
   'next',nextAt)
 ];
 return {title,focus:active?workDescription:focusFor[id],
  windowLabel:active?'Execução confirmada':hasRequests?'Rodada registrada':'Próximo ciclo',
  stages,recordedAt:latestEnd||first?.time||null,source:hasRequests?'executor':'agendamento',
  processed,received:todayRuns.length};
}
function classify(id:AgentId,items:Delivery[],runs:Run[],jobs:Job[],queue:number,heartbeat:Heartbeat|undefined,telemetry:boolean,now:number):OfficeAgent{
 const run=runs.slice().sort((a,b)=>Date.parse(b.time)-Date.parse(a.time))[0];
 const last=items[0]||null;
 let lastSeen=newer(run?.doneAt||run?.time||null,last?.time||null);
 const job=jobs.find(x=>x.jobname===jobName[id]);
 const nextAt=id==='design'?nextCron('20 13 * * 1',now):job?.active?nextCron(job.schedule,now):null;
 const nextAction=!telemetry?'Aguardando conexão da telemetria':
  id==='design'?'Auditar visual do site e registrar relatório':
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
 if(state==='waiting'&&run?.status==='pending'&&recent(run.time,25,now)){
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

 const mission=missionFor(id,runs,nextAt,queue,now,jobs);
 if(state==='working'){
  const active=runs.slice().sort((a,b)=>Date.parse(b.time)-Date.parse(a.time))
    .find(r=>['pending','running','processing','in_progress'].includes(r.status)&&recent(r.time,25,now));
  if(active)activity=active.subject?'Executando: '+active.subject:'Processando solicitações da rodada atual';
 } else if(state==='waiting'&&mission.recordedAt){
  activity='Próxima execução agendada; última rodada registrada às '+
   new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})
    .format(new Date(mission.recordedAt));
 }
 return {id,state,lastSeen,activity,deliveries:items.slice(0,8),verifiedRun:Boolean(telemetry&&run),
  nextAt,nextAction,queuedCount:id==='seo'?queue:0,lastOrigin,reportedPlan:heartbeatFresh?heartbeat?.next_task||null:null,mission};
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

 const runs:Run[]=[],jobs:Job[]=[],designAudits:DesignAudit[]=[];
 let telemetry=false,queue=0;
 const heartbeats:Heartbeat[]=[];
 // A telemetria privilegiada é habilitada apenas atrás da autenticação do escritório.
 const secret=process.env.OFFICE_PASSWORD?process.env.SUPABASE_SERVICE_ROLE_KEY:undefined;
 if(secret){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://kffzngznzjgioabtqxju.supabase.co';
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const [fixture,editorial,writer,ai,schedule,evidence,drafts,activity,design]=await Promise.all([
   admin.from('agent_fixture_requests').select('requested_at,processed_at,status,items_written,query_date,league_id,error_text').order('requested_at',{ascending:false}).limit(80),
   admin.from('agent_editorial_requests').select('kind,requested_at,processed_at,status,result_count,error_message').order('requested_at',{ascending:false}).limit(35),
   admin.from('editorial_writer_requests').select('created_at,processed_at,state').order('created_at',{ascending:false}).limit(20),
   admin.from('editorial_ai_runs').select('created_at,finished_at,state,word_count,detail,article_id').order('created_at',{ascending:false}).limit(20),
   admin.rpc('office_schedule_status'),
   admin.from('editorial_evidence').select('article_id').limit(80),
   admin.from('news_articles').select('id,headline').eq('status','draft').limit(150),
   admin.from('office_agent_activity').select('agent_id,status,task,next_task,updated_at,expires_at,evidence_url').limit(20),
   admin.from('design_audits').select('run_id,status,started_at,finished_at,report,artifact_url,error_message,observations').order('started_at',{ascending:false}).limit(8)
  ]);
  telemetry=!fixture.error&&!editorial.error&&!writer.error&&!ai.error&&!schedule.error;
  if(!fixture.error)for(const x of fixture.data||[]){
   runs.push({agentId:'futebol',time:x.requested_at,doneAt:x.processed_at,status:x.status,count:x.items_written||0,
   subject:x.query_date?'Conferindo jogos de '+x.query_date+(x.league_id?' (liga '+x.league_id+')':''):'Agenda do futebol',
   error:x.error_text||null});
  }
  if(!editorial.error)for(const x of editorial.data||[]){
   const agentId:AgentId=x.kind==='filmes'?'filmes':x.kind==='tv_br'||x.kind==='tv_web'?'series':'noticias';
   runs.push({agentId,time:x.requested_at,doneAt:x.processed_at,status:x.status,count:x.result_count||0,
   kind:x.kind,subject:x.kind==='agencia'?'Pesquisar Agência Brasil':x.kind==='bbc'?'Pesquisar BBC Brasil':
   x.kind==='filmes'?'Atualizar catálogo de filmes':'Consultar programação de séries',
   error:x.error_message||null});
  }
  if(!writer.error)for(const x of writer.data||[]){
   const original=String(x.state).toLowerCase();
   const status=['ok','done','completed','success'].includes(original)?'ok':
    ['error','failed'].includes(original)?'error':
    ['needs_review'].includes(original)?'needs_review':
    ['running','processing','in_progress'].includes(original)?'running':'pending';
   runs.push({agentId:'seo',time:x.created_at,doneAt:x.processed_at,status,count:0});
  }
  if(!ai.error)for(const x of ai.data||[]){
   const original=String(x.state).toLowerCase();
   const status=['ok','done','completed','success','succeeded','published'].includes(original)?'ok':
    ['error','failed'].includes(original)?'error':
    ['needs_review'].includes(original)?'needs_review':
    ['running','processing','in_progress'].includes(original)?'running':'pending';
   runs.push({agentId:'seo',time:x.created_at,doneAt:x.finished_at,status,count:x.word_count||0,
   subject:'Redigir e validar pauta '+String(x.article_id||'').slice(0,8),error:x.detail||null});
  }
  if(!schedule.error&&Array.isArray(schedule.data)){
   for(const x of schedule.data as Job[])if(x&&typeof x.jobname==='string')jobs.push(x);
  }
  if(!activity.error)for(const row of (activity.data||[]) as Heartbeat[])heartbeats.push(row);
  if(!design.error)for(const audit of (design.data||[]) as DesignAudit[]){
   designAudits.push(audit);
   const status=audit.status==='completed'?'ok':audit.status==='error'?'error':
    audit.status==='capturing'||audit.status==='analyzing'?'running':'pending';
   runs.push({agentId:'design',time:audit.started_at,doneAt:audit.finished_at,status,
    count:Array.isArray(audit.observations)?audit.observations.length:0,
    subject:audit.status==='capturing'?'Capturar telas e medir layout':
     audit.status==='analyzing'?'Analisar capturas com IA':'Revisão visual semanal',
    error:audit.error_message});
   if(audit.status==='completed'&&audit.artifact_url)deliveries.push({
    id:'milly-'+audit.run_id,agentId:'design',title:'Relatório visual semanal da Milly',
    detail:(audit.report||'Auditoria visual').slice(0,200),
    time:audit.finished_at||audit.started_at,href:audit.artifact_url,origin:'github'});
  }
  if(!evidence.error&&!drafts.error){
   const draftIds=new Set((drafts.data||[]).map(x=>x.id));
   queue=(evidence.data||[]).filter(x=>draftIds.has(x.article_id)).length;
  }
 }
 deliveries.sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
 const agents=profiles.map(p=>{
  const agent=classify(p.id,deliveries.filter(x=>x.agentId===p.id),
   runs.filter(x=>x.agentId===p.id),jobs,queue,heartbeats.find(x=>x.agent_id===p.id),telemetry,now);
  if(p.id==='design'&&designAudits.length){
   const audit=designAudits[0];
   agent.mission.auditReport=audit.report||null;
   agent.mission.auditUrl=audit.artifact_url||null;
   agent.lastOrigin='GitHub Actions / revisão de design';
   if(audit.status==='completed'){
    agent.activity='Revisão visual concluída: relatório e capturas disponíveis';
    agent.mission.windowLabel='Relatório entregue';
   }else if(audit.status==='error'){
    agent.activity='Auditoria interrompida: '+(audit.error_message||'falha registrada');
   }
  }
  return agent;
 });
 const failures=[n.error,m.error,w.error].filter(Boolean);
 return {checkedAt,telemetry,agents,deliveries,github:git.summary,
  notice:failures.length?'Algumas publicações não puderam ser consultadas.':null};
}
