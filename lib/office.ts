import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {getSupabase} from '@/lib/supabase';
import {getGitHubOffice} from '@/lib/office-github';
import {profiles} from '@/lib/office-shared';
import type {AgentId,AgentState,Delivery,OfficeAgent,OfficeSnapshot,OfficeMission,OfficeStep} from '@/lib/office-shared';

type NewsRow={id:string;slug:string;headline:string;category:string;updated_at:string;published_at:string;generated_by_ai:boolean};
type MatchRow={id:string;home_team:string;away_team:string;league:string;updated_at:string};
type WatchRow={id:string;title:string;kind:string;platform:string;updated_at:string;editorial_body:string|null;source_url:string|null};
type Run={agentId:AgentId;time:string;doneAt:string|null;status:string;count:number;kind?:string;subject?:string;error?:string|null};
type Job={jobname:string;schedule:string;active:boolean;last_run:string|null;last_status:string|null};
type DesignAudit={run_id:number;status:string;started_at:string;finished_at:string|null;report:string|null;artifact_url:string|null;error_message:string|null;observations:unknown};
type Heartbeat={agent_id:string;status:'working'|'waiting'|'completed'|'error';task:string;next_task:string|null;updated_at:string;expires_at:string|null;evidence_url:string|null};
type AgentHealth={agent_id:string;slot_key:string;phase:string;status:string;detail:string;checked_at:string};

const recent=(time:string|null|undefined,minutes:number,now:number)=>
 Boolean(time&&!Number.isNaN(Date.parse(time))&&now-Date.parse(time)>=-60000&&now-Date.parse(time)<minutes*60000);
const newer=(a:string|null,b:string|null)=>!a?b:!b?a:Date.parse(a)>=Date.parse(b)?a:b;
const jobName:Record<AgentId,string>={
 futebol:'guia-de-hoje-coletor-sql',noticias:'guia-de-hoje-editorial',
 filmes:'guia-de-hoje-editorial',series:'guia-de-hoje-luna-editorial',
 seo:'guia-de-hoje-otto-redacao',design:'milly-semanal',imagens:'guia-de-hoje-imagens'
};
const taskName:Record<AgentId,string>={
 futebol:'Próxima checagem do coletor',noticias:'Próxima checagem editorial',
 filmes:'Próxima checagem editorial',series:'Próxima publicação SEO da Luna',
 seo:'Próxima pauta com fonte verificada — fila contínua',design:'Próxima auditoria visual semanal',
 imagens:'Próxima busca de imagens e créditos'
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
 design:'Revisar capturas reais do site e sugerir melhorias de UX/UI',
 imagens:'Buscar imagens com licença reutilizável e registrar autor e fonte; manter capa editorial segura como alternativa'
};
function missionFor(id:AgentId,runs:Run[],nextAt:string|null,queue:number,now:number,jobs:Job[]):OfficeMission{
 const sorted=[...runs].sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
 const first=sorted[0];
 const fresh=first&&recent(first.time,14*60,now);
 const active=Boolean(fresh&&sorted.some(r=>r.status==='running'&&recent(r.time,25,now)
   ||r.status==='pending'&&recent(r.time,25,now)));
 const todayRuns=fresh?sorted.filter(r=>Math.abs(Date.parse(r.time)-Date.parse(first.time))<35*60000):[];
 const finished=todayRuns.filter(r=>Boolean(r.doneAt)&&['ok','published','needs_review','error','failed'].includes(r.status));
 const completed=finished.filter(r=>['ok','published'].includes(r.status));
 const failed=todayRuns.filter(r=>['error','failed','needs_review'].includes(r.status));
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
 const processAt=(id==='seo'||id==='imagens')?null:hasRequests&&stageJob?.active?
   nextCron(stageJob.schedule,Date.parse(first.time)):null;
 const processNote=processAt?
   'Próxima etapa marcada para '+label(processAt)+' (Brasília)':
   'Aguardando processamento registrado';
 const title=id==='design'?'Revisão visual semanal da Milly':id==='futebol'?'Rodada de atualização do futebol':
  id==='noticias'?'Rodada de pesquisa editorial':id==='filmes'?'Pesquisa de filmes':
  id==='series'?'Pesquisa de séries':id==='imagens'?'Busca de imagens e créditos':'Produção editorial com IA';
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
    finished.length+' de '+todayRuns.length+' tentativas finalizadas':
    hasRequests?processNote:'Nenhuma execução registrada nesta rodada',
   active?'active':failed.length?'error':completed.length?'done':'next',
   active?first.time:latestEnd||processAt),
  stage(id==='seo'?'Checar qualidade e publicação':'Registrar resultados no portal',
   hasRequests?(failed.length?failed.length+' item(ns) pendente(s) de revisão. ':
    '')+(processed>0?processed+' registro(s) concluído(s)':'Nenhuma entrega confirmada'):
    'Disponível após o processamento',
   active?'next':completed.length?'done':failed.length?'error':'next',latestEnd),
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
 // Um erro em outra pauta não apaga uma publicação real feita nesta janela.
 // Revisões pendentes seguem visíveis nas etapas, sem inventar sucesso integral.
 const recentEditorial=items.find(d=>d.origin==='published'&&recent(d.time,240,now));
 const successfulRun=runs.find(r=>['published','ok'].includes(r.status)&&recent(r.doneAt||r.time,240,now));
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
 if(state!=='working'&&['error','failed','needs_review'].includes(run?.status||'')){
  if(recentEditorial||successfulRun){
   state='recent';
   activity=recentEditorial?
    'Publicação confirmada; existem outras pautas em revisão':
    'Rodada com entregas confirmadas e pendências de revisão';
  }else{
   state='error';
   activity=run?.status==='needs_review'?
    'Matéria em revisão: publicação ainda não concluída':
    'Última tentativa falhou; sem publicação confirmada neste turno';
  }
 }
 if(state==='waiting'&&run?.status==='pending'&&recent(run.time,25,now)){
  activity='Solicitação na fila aguardando conclusão';
 }
 if(state==='waiting'&&['ok','published'].includes(run?.status||'')&&recent(run.doneAt||run.time,90,now)){
  state='recent';activity=id==='seo'?(run.status==='published'?'Matéria publicada com '+run.count+' palavras':'Etapa de redação registrada'):
 run.count>0?'Coleta processada: '+run.count+' registro(s)':'Coleta processada, sem registros novos';
 }
 // Commits são apenas manutenção técnica, não publicações dos agentes.
 if(state==='waiting'&&recent(items.find(x=>x.origin==='published')?.time,180,now)){
  state='recent';activity='Publicação editorial confirmada no site';
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
  last.origin==='catalog'?'Atualização do catálogo':'Publicação editorial no site':
  run?'Execução no Supabase':last?'Entrega no site':'Nenhuma atividade confirmada';
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
  db.from('news_articles').select('id,slug,headline,category,updated_at,published_at,generated_by_ai').eq('status','published').order('published_at',{ascending:false}).limit(15),
  db.from('matches').select('id,home_team,away_team,league,updated_at').eq('is_published',true).order('updated_at',{ascending:false}).limit(15),
  db.from('watch_titles').select('id,title,kind,platform,updated_at,editorial_body,source_url').eq('is_published',true).order('updated_at',{ascending:false}).limit(60),
  getGitHubOffice()
 ]);
 const news=(n.data||[]) as NewsRow[],matches=(m.data||[]) as MatchRow[],titles=(w.data||[]) as WatchRow[];
 const publications:Delivery[]=[
  ...news.map(x=>({id:'n-'+x.id,agentId:(x.generated_by_ai?'seo':'noticias') as AgentId,
   title:'Matéria publicada: '+x.headline,detail:x.category||'Notícia',
   time:x.published_at,href:'/noticias/'+encodeURIComponent(x.slug),origin:'published' as const})),
  ...matches.map(x=>({id:'m-'+x.id,agentId:'futebol' as const,title:x.home_team+' × '+x.away_team,
   detail:x.league,time:x.updated_at,href:'/futebol',origin:'published' as const})),
  ...titles.map(x=>{
   const indexed=Boolean(x.source_url&&x.editorial_body&&x.editorial_body.length>=350);
   return {id:'w-'+x.id,agentId:(x.kind==='Filmes'?'filmes':'series') as AgentId,
    title:(indexed?'Guia SEO publicado: ':'Catálogo atualizado: ')+x.title,
    detail:indexed?'Ficha editorial pronta para indexação':
     'Título coletado; matéria SEO ainda não publicada',
    time:x.updated_at,href:'/filmes-series',origin:indexed?'published' as const:'catalog' as const};
  })
 ];
 const deliveries=[...publications]
  .filter(x=>x.time&&!Number.isNaN(Date.parse(x.time)))
  .sort((a,b)=>Date.parse(b.time)-Date.parse(a.time)).slice(0,90);

 const runs:Run[]=[],jobs:Job[]=[],designAudits:DesignAudit[]=[];
 let telemetry=false,queue=0;
 const agentHealth:AgentHealth[]=[];
 const heartbeats:Heartbeat[]=[];
 // A telemetria privilegiada é habilitada apenas atrás da autenticação do escritório.
 const secret=process.env.OFFICE_PASSWORD?process.env.SUPABASE_SERVICE_ROLE_KEY:undefined;
 if(secret){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://kffzngznzjgioabtqxju.supabase.co';
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const [fixture,editorial,writer,ai,schedule,evidence,drafts,activity,design,luna,backfill,health,imageRuns]=await Promise.all([
   admin.from('agent_fixture_requests').select('requested_at,processed_at,status,items_written,query_date,league_id,error_text').order('requested_at',{ascending:false}).limit(80),
   admin.from('agent_editorial_requests').select('kind,requested_at,processed_at,status,result_count,error_message').order('requested_at',{ascending:false}).limit(35),
   admin.from('editorial_writer_requests').select('created_at,processed_at,state').order('created_at',{ascending:false}).limit(20),
   admin.from('editorial_ai_runs').select('created_at,finished_at,state,word_count,detail,article_id').order('created_at',{ascending:false}).limit(20),
   admin.rpc('office_schedule_status'),
   admin.from('editorial_evidence').select('article_id').limit(80),
   admin.from('news_articles').select('id,headline').eq('status','draft').limit(150),
   admin.from('office_agent_activity').select('agent_id,status,task,next_task,updated_at,expires_at,evidence_url').limit(20),
   admin.from('design_audits').select('run_id,status,started_at,finished_at,report,artifact_url,error_message,observations').order('started_at',{ascending:false}).limit(8),
   admin.from('luna_editorial_runs').select('title_id,slot_key,state,started_at,finished_at,word_count,detail').order('started_at',{ascending:false}).limit(15),
   admin.from('news_backfill_publications').select('article_id,state,attempts,detail,last_attempt_at,finished_at,word_count').order('last_attempt_at',{ascending:false}).limit(25),
   admin.from('office_agent_health').select('agent_id,slot_key,phase,status,detail,checked_at').order('checked_at',{ascending:false}).limit(40),
   admin.from('agent_image_runs').select('kind,item_id,title,status,attempts,attempted_at,credit').order('attempted_at',{ascending:false}).limit(50)
  ]);
  telemetry=!fixture.error&&!editorial.error&&!writer.error&&!ai.error&&!schedule.error;
  if(!health.error)for(const h of health.data||[])agentHealth.push(h as AgentHealth);
  if(!imageRuns.error)for(const x of imageRuns.data||[]){
   const completed=x.status==='done'||x.status==='not_found';
   runs.push({agentId:'imagens',time:x.attempted_at,doneAt:completed?x.attempted_at:null,
    status:x.status==='done'||x.status==='not_found'?'ok':
     x.status==='error'?'error':'pending',
    count:x.status==='done'?1:0,
    subject:x.status==='not_found'?'Sem imagem licenciada; usar capa editorial: '+x.title:
     'Verificar imagem e direitos: '+x.title});
   if(x.status==='done')deliveries.push({
    id:'image-'+x.kind+'-'+x.item_id,agentId:'imagens',
    title:'Imagem e crédito validados: '+x.title,detail:x.credit||'Crédito registrado',
    time:x.attempted_at,href:x.kind==='noticia'?'/noticias':'/filmes-series',origin:'catalog'
   });
  }
  deliveries.sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
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
  if(!backfill.error)for(const x of backfill.data||[]){
   const status=x.state==='published'?'published':
    x.state==='error'?'error':x.state==='running'?'running':'needs_review';
   runs.push({agentId:'seo',time:x.last_attempt_at,doneAt:x.finished_at,
    status,count:x.state==='published'?x.word_count||0:0,
    subject:x.state==='published'?'Publicar notícia recuperada com fonte verificada':
     'Recuperar rascunho: tentativa '+x.attempts,
    error:x.state==='published'?null:x.detail||null});
  }
  if(!luna.error)for(const x of luna.data||[]){
   const status=x.state==='published'?'ok':
    x.state==='error'?'error':x.state==='running'?'running':'needs_review';
   runs.push({agentId:'series',time:x.started_at,doneAt:x.finished_at,
    status,count:x.state==='published'?x.word_count||0:0,
    subject:x.state==='published'?'Publicar ficha original SEO da série':
      'Preparar e revisar a matéria SEO com fonte TVmaze',error:x.detail||null});
  }
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
 const lastNewsTime=news[0]?.published_at?Date.parse(news[0].published_at):NaN;
 const editorialDelayed=Number.isNaN(lastNewsTime)||now-lastNewsTime>24*60*60*1000;
 // Somente o relatório MAIS RECENTE por agente/fase: não ressuscitar alertas
 // de turnos antigos quando uma recuperação posterior foi concluída.
 const checked=new Set<string>();
 const healthWarnings:string[]=[];
 for(const row of agentHealth){
  if(!recent(row.checked_at,26*60,now))continue;
  const key=row.agent_id+'/'+row.phase;
  if(checked.has(key))continue;
  checked.add(key);
  // Não manter o alarme antigo do Otto depois de uma publicação real mais recente.
  if(row.agent_id==='seo'&&(
    deliveries.some(d=>d.agentId==='seo'&&d.origin==='published'&&
      Date.parse(d.time)>Date.parse(row.checked_at))||
    runs.some(r=>r.agentId==='seo'&&['ok','published'].includes(r.status)&&
      Date.parse(r.doneAt||r.time)>Date.parse(row.checked_at))
   ))continue;
  if(['missed','retrying','not_published','needs_review','error'].includes(row.status)){
   const name=({futebol:'Bento',noticias:'Nina',filmes:'Theo',series:'Luna',
    seo:'Otto',design:'Milly',imagens:'Íris'} as Record<string,string>)[row.agent_id]||row.agent_id;
   healthWarnings.push(name+' ('+row.phase+'): '+row.status.replaceAll('_',' '));
  }
 }
 const notice=failures.length?'Algumas publicações não puderam ser consultadas.':
  healthWarnings.length?
   'ALERTA DE AGENTES: '+healthWarnings.slice(0,3).join('; ')+
    '. Consulte as pendências da rodada; recuperações e publicações posteriores são verificadas automaticamente.':
  editorialDelayed&&queue>0?
   'ALERTA EDITORIAL: nenhuma notícia nova foi publicada nas últimas 24 horas. Há '+queue+
   ' pauta(s) com fonte esperando a redação. Coleta concluída não é publicação.':null;
 return {checkedAt,telemetry,agents,deliveries,github:git.summary,notice};
}
