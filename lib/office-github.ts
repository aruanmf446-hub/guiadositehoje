import 'server-only';
import type {AgentId,Delivery,GitHubSummary} from '@/lib/office-shared';

type RawCommit={sha:string;html_url:string;commit:{message:string;committer:{date:string}|null;author:{date:string}|null}};
type RawRun={id:number;name:string;status:string;conclusion:string|null;html_url:string;created_at:string;head_sha:string};
const base='https://api.github.com/repos/aruanmf446-hub/guiadositehoje';
const commitAgent=(message:string):AgentId|null=>{
 const s=message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/seo|redator|escrita|indexacao|sitemap|metadad|writer/.test(s))return 'seo';
 if(/serie|programacao|tvmaze/.test(s))return 'series';
 if(/filme|catalogo/.test(s))return 'filmes';
 if(/futebol|partida|jogos|campeonato|coletor/.test(s))return 'futebol';
 if(/noticia|reportagem|rss|editoria/.test(s))return 'noticias';
 return null;
};
async function githubGet<T>(path:string):Promise<T>{
 const token=process.env.GITHUB_MONITOR_TOKEN;
 const response=await fetch(base+path,{
  next:{revalidate:600},
  headers:{
   'Accept':'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28',
   ...(token?{Authorization:'Bearer '+token}:{}),
  }
 });
 if(!response.ok)throw new Error('GitHub '+response.status);
 return response.json() as Promise<T>;
}
export async function getGitHubOffice():Promise<{deliveries:Delivery[];summary:GitHubSummary}>{
 try{
  const [commits,runResponse]=await Promise.all([
   githubGet<RawCommit[]>('/commits?per_page=25'),
   githubGet<{workflow_runs:RawRun[]}>('/actions/runs?per_page=12')
  ]);
  const deliveries:Delivery[]=commits.flatMap(c=>{
   const title=c.commit.message.trim().split('\n')[0].slice(0,180);
   const agentId=commitAgent(title);
   const time=c.commit.committer?.date||c.commit.author?.date;
   if(!agentId||!time||!c.html_url)return [];
   return [{id:'git-'+c.sha,agentId,title,detail:'Alteração no GitHub · '+c.sha.slice(0,7),time,href:c.html_url,origin:'github' as const}];
  });
  const running=(runResponse.workflow_runs||[]).filter(r=>r.status==='in_progress'||r.status==='queued'||r.status==='waiting');
  const last=commits[0];
  return {
   deliveries:[], // Commits de programadores não são entregas dos agentes.
   summary:{
    connected:true,
    lastCommit:last?{title:last.commit.message.trim().split('\n')[0],time:last.commit.committer?.date||last.commit.author?.date||'',href:last.html_url}:null,
    activeChecks:running.map(r=>({name:r.name||'Validação',href:r.html_url,status:r.status})),
    checkedAt:new Date().toISOString()
   }
  };
 }catch{
  return {deliveries:[],summary:{connected:false,lastCommit:null,activeChecks:[],checkedAt:new Date().toISOString()}};
 }
}
