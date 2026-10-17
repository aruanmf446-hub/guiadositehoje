import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {getSupabase} from '@/lib/supabase';

export const profiles=[
 {id:'futebol',name:'Bento',job:'Radar do futebol',desk:'01',color:'#f3a65c',hair:'#4a3735',skin:'#e5ae8b',mission:'Conferir jogos, campeonatos e transmissões'},
 {id:'noticias',name:'Nina',job:'Pesquisa de notícias',desk:'02',color:'#8b94e9',hair:'#353052',skin:'#e4aa85',mission:'Acompanhar fontes e atualizações editoriais'},
 {id:'filmes',name:'Theo',job:'Curadoria de filmes',desk:'03',color:'#ee8fa4',hair:'#815d3f',skin:'#f4c3a1',mission:'Organizar o catálogo de filmes'},
 {id:'series',name:'Luna',job:'Curadoria de séries',desk:'04',color:'#7dc5ad',hair:'#30384a',skin:'#bc8269',mission:'Conferir séries e a programação'},
 {id:'seo',name:'Otto',job:'Redação & SEO',desk:'05',color:'#e9c36e',hair:'#543e37',skin:'#dca77c',mission:'Preparar textos editoriais e SEO'},
] as const;
export type AgentId=typeof profiles[number]['id'];
export type AgentState='working'|'recent'|'waiting'|'error'|'unconnected';
export type Delivery={id:string;agentId:AgentId;title:string;detail:string;time:string;href:string};
export type OfficeAgent={id:AgentId;state:AgentState;lastSeen:string|null;activity:string;deliveries:Delivery[];verifiedRun:boolean};
export type OfficeSnapshot={checkedAt:string;telemetry:boolean;agents:OfficeAgent[];deliveries:Delivery[];notice:string|null};
type NewsRow={id:string;slug:string;headline:string;category:string;updated_at:string};
type MatchRow={id:string;home_team:string;away_team:string;league:string;updated_at:string};
type WatchRow={id:string;title:string;kind:string;platform:string;updated_at:string};
type Run={agentId:AgentId;time:string;doneAt:string|null;status:string;count:number};
const isRecent=(time:string|null|undefined,mins:number,now:number)=>Boolean(time&&!Number.isNaN(Date.parse(time))&&now-Date.parse(time)>=-60000&&now-Date.parse(time)<mins*60000);
const latest=(a:string|null,b:string|null)=>!a?b:!b?a:Date.parse(a)>Date.parse(b)?a:b;
function classify(id:AgentId,items:Delivery[],runs:Run[],telemetry:boolean,now:number):OfficeAgent{
 const run=runs.slice().sort((a,b)=>Date.parse(b.time)-Date.parse(a.time))[0];
 const published=items[0]?.time||null;
 const lastSeen=latest(run?.doneAt||run?.time||null,published);
 let state:AgentState='waiting',activity='Aguardando próxima coleta';
 if(id==='seo'&&!run&&!items.length){state='unconnected';activity='Nenhuma execução de redação registrada';}
 else if(telemetry&&run?.status==='pending'&&isRecent(run.time,35,now)){state='working';activity='Solicitação em processamento';}
 else if(telemetry&&run?.status==='error'&&isRecent(run.doneAt||run.time,120,now)){state='error';activity='Última solicitação registrou falha';}
 else if(telemetry&&run?.status==='ok'&&isRecent(run.doneAt||run.time,90,now)){state='recent';activity=run.count>0?'Coleta concluída com '+run.count+' registro(s)':'Coleta concluída, sem novos registros';}
 else if(isRecent(published,180,now)){state='recent';activity='Publicação recente no Guia de Hoje';}
 else if(run){activity='Última coleta concluída, aguardando nova tarefa';}
 else if(items.length){activity='Últimos trabalhos disponíveis no histórico';}
 return {id,state,lastSeen,activity,deliveries:items,verifiedRun:Boolean(telemetry&&run)};
}
export async function getOfficeSnapshot():Promise<OfficeSnapshot>{
 const db=getSupabase(),checkedAt=new Date().toISOString(),now=Date.parse(checkedAt);
 const [n,m,w]=await Promise.all([
  db.from('news_articles').select('id,slug,headline,category,updated_at').eq('status','published').order('updated_at',{ascending:false}).limit(12),
  db.from('matches').select('id,home_team,away_team,league,updated_at').eq('is_published',true).order('updated_at',{ascending:false}).limit(12),
  db.from('watch_titles').select('id,title,kind,platform,updated_at').eq('is_published',true).order('updated_at',{ascending:false}).limit(60),
 ]);
 const news=(n.data||[]) as NewsRow[],matches=(m.data||[]) as MatchRow[],titles=(w.data||[]) as WatchRow[];
 const deliveries:Delivery[]=[
  ...news.map(x=>({id:'n-'+x.id,agentId:'noticias' as const,title:x.headline,detail:x.category||'Notícia',time:x.updated_at,href:'/noticias/'+encodeURIComponent(x.slug)})),
  ...matches.map(x=>({id:'m-'+x.id,agentId:'futebol' as const,title:x.home_team+' × '+x.away_team,detail:x.league,time:x.updated_at,href:'/futebol'})),
  ...titles.map(x=>({id:'w-'+x.id,agentId:(x.kind==='Filmes'?'filmes':'series') as AgentId,title:x.title,detail:x.platform||x.kind,time:x.updated_at,href:'/filmes-series'}))
 ].filter(x=>x.time&&!Number.isNaN(Date.parse(x.time))).sort((a,b)=>Date.parse(b.time)-Date.parse(a.time)).slice(0,60);
 const runs:Run[]=[];
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 let telemetry=false;
 if(secret){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://kffzngznzjgioabtqxju.supabase.co';
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const [f,e,s]=await Promise.all([
   admin.from('agent_fixture_requests').select('requested_at,processed_at,status,items_written').order('requested_at',{ascending:false}).limit(15),
   admin.from('agent_editorial_requests').select('kind,requested_at,processed_at,status,result_count').order('requested_at',{ascending:false}).limit(24),
   admin.from('editorial_writer_requests').select('created_at,processed_at,state').order('created_at',{ascending:false}).limit(8)
  ]);
  telemetry=!f.error&&!e.error&&!s.error;
  if(!f.error)for(const x of f.data||[])runs.push({agentId:'futebol',time:x.requested_at,doneAt:x.processed_at,status:x.status,count:x.items_written||0});
  if(!e.error)for(const x of e.data||[]){
   const agentId:AgentId=x.kind==='filmes'?'filmes':x.kind==='tv_br'||x.kind==='tv_web'?'series':'noticias';
   runs.push({agentId,time:x.requested_at,doneAt:x.processed_at,status:x.status,count:x.result_count||0});
  }
  if(!s.error)for(const x of s.data||[]){
   const status=['ok','done','completed'].includes(x.state)?'ok':['error','failed'].includes(x.state)?'error':'pending';
   runs.push({agentId:'seo',time:x.created_at,doneAt:x.processed_at,status,count:0});
  }
 }
 const agents=profiles.map(x=>classify(x.id,deliveries.filter(d=>d.agentId===x.id).slice(0,8),runs.filter(r=>r.agentId===x.id),telemetry,now));
 return {checkedAt,telemetry,agents,deliveries,notice:n.error||m.error||w.error?'Algumas fontes não responderam nesta atualização.':null};
}
