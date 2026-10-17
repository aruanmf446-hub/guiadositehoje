'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import type {AgentId,AgentState,Delivery,OfficeAgent,OfficeSnapshot} from '@/lib/office-shared';
import {profiles} from '@/lib/office-shared';

type View='escritorio'|'equipe'|'entregas';
const stateLabels:Record<AgentState,string>={
 working:'Trabalhando agora',recent:'Atividade recente',waiting:'Aguardando',
 error:'Precisa de atenção',unconnected:'Sem execução registrada'
};
const idLabels:Record<AgentId,string>={
 futebol:'Futebol',noticias:'Notícias',filmes:'Filmes',series:'Séries',seo:'Redação SEO'
};
function clock(iso:string|null){
 if(!iso)return 'Sem registro';
 const time=Date.parse(iso);
 return Number.isFinite(time)?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(time)):'Sem registro';
}
function Sprite({id}:{id:AgentId}){
 const p=profiles.find(x=>x.id===id)!;
 return <svg className="office-sprite" viewBox="0 0 82 93" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={'Personagem de '+p.name}>
  <ellipse cx="41" cy="88" rx="26" ry="5" fill="#2c3446" opacity=".13"/>
  <path d="M28 65h12v20H27zM44 65h12v20H43z" fill="#3a4969"/>
  <rect x="25" y="79" width="17" height="8" rx="4" fill="#3b3237"/><rect x="42" y="79" width="17" height="8" rx="4" fill="#3b3237"/>
  <path d="M25 42h32l8 29H17z" fill={p.color}/>
  <rect x="13" y="45" width="13" height="23" rx="6" fill={p.skin}/><rect x="56" y="45" width="13" height="23" rx="6" fill={p.skin}/>
  <rect x="33" y="35" width="16" height="13" rx="4" fill={p.skin}/>
  <rect x="18" y="10" width="46" height="35" rx="16" fill={p.skin}/>
  <path d="M17 29V20Q18 4 39 4h11q18 2 17 21l-4 3-4-12-11 1-11-5-11 8-2 9z" fill={p.hair}/>
  <rect x="26" y="29" width="5" height="5" rx="2" fill="#353345"/><rect x="51" y="29" width="5" height="5" rx="2" fill="#353345"/>
  <path d="M37 38q5 4 10 0" stroke="#8f5550" strokeWidth="2" fill="none" strokeLinecap="round"/>
  <path d="M34 46l7 5 7-5" stroke="#fff" strokeWidth="3" fill="none" opacity=".55"/>
  <rect x="36" y="58" width="10" height="7" rx="3" fill="#fff" opacity=".3"/>
 </svg>;
}
function Status({state}:{state:AgentState}){
 return <span className={'office-status status-'+state}><span className="office-status-dot"/>{stateLabels[state]}</span>;
}
function Station({agent,selected,onSelect}:{agent:OfficeAgent;selected:boolean;onSelect:()=>void}){
 const p=profiles.find(x=>x.id===agent.id)!;
 return <button type="button" className={'office-station station-'+agent.id+(selected?' station-selected':'')}
  onClick={onSelect} aria-pressed={selected} aria-label={'Selecionar '+p.name+', '+stateLabels[agent.state]}
  style={{'--agent-accent':p.color} as CSSProperties}>
  <span className="station-bubble">{agent.state==='working'?'Em ação!':agent.state==='recent'?'Entreguei!':agent.state==='error'?'Ops!':'Na minha mesa'}</span>
  <span className="station-desk">
   <span className="station-monitor"><span className="station-screen"><i/><i/><i/><b/></span></span>
   <span className="station-keyboard"/>
   <span className="station-cup"/>
  </span>
  <span className="station-chair"/>
  <span className="station-sprite"><Sprite id={agent.id}/></span>
  <span className="station-nameplate"><strong>{p.name}</strong><small>{p.job}</small></span>
 </button>;
}
function Deliveries({items,emptyLabel}:{items:Delivery[];emptyLabel:string}){
 return <div className="office-delivery-list">
 {items.length===0?<div className="office-empty"><span>✳</span><strong>Nenhuma entrega por aqui.</strong><p>{emptyLabel}</p></div>:
 items.map(item=><a className="office-delivery" key={item.id} href={item.href} target="_blank" rel="noreferrer">
  <span className={'delivery-icon delivery-'+item.agentId}>{item.origin==='github'?'⌘':item.agentId==='futebol'?'⚽':item.agentId==='noticias'?'✎':item.agentId==='filmes'?'◩':'▷'}</span>
  <span className="delivery-copy"><strong>{item.title}</strong><small>{item.origin==='github'?'GitHub · alteração de código':idLabels[item.agentId]+' · publicação'} · {clock(item.time)}</small></span>
  <span className="delivery-arrow" aria-hidden="true">↗</span>
 </a>)}
 </div>;
}
export default function OfficeExperience({initial}:{initial:OfficeSnapshot}){
 const [snapshot,setSnapshot]=useState(initial);
 const [selected,setSelected]=useState<AgentId>('seo');
 const [view,setView]=useState<View>('escritorio');
 const [filter,setFilter]=useState<AgentId|'todos'>('todos');
 const [loading,setLoading]=useState(false);
 const [refreshError,setRefreshError]=useState('');
 const [detailsOpen,setDetailsOpen]=useState(false);
 const [mobileSheet,setMobileSheet]=useState(false);
 const sheetRef=useRef<HTMLElement|null>(null);
 const closeButtonRef=useRef<HTMLButtonElement|null>(null);
 const lastTriggerRef=useRef<HTMLElement|null>(null);
 const refresh=useCallback(async()=>{
  try {
   const response=await fetch('/api/escritorio/status',{cache:'no-store'});
   if(!response.ok)throw new Error('Falha de conexão');
   const data=await response.json() as OfficeSnapshot;
   setSnapshot(data);setRefreshError('');
  } catch {setRefreshError('Não foi possível atualizar agora. Os últimos dados foram mantidos.');}
 },[]);
 useEffect(()=>{
  const timer=window.setInterval(()=>{void refresh();},45000);
  return ()=>window.clearInterval(timer);
 },[refresh]);
 useEffect(()=>{
  const media=window.matchMedia('(max-width: 700px)');
  const update=()=>setMobileSheet(media.matches);
  update();
  media.addEventListener('change',update);
  return ()=>media.removeEventListener('change',update);
 },[]);
 const closeDetails=useCallback(()=>{
  setDetailsOpen(false);
  if(typeof window!=='undefined'&&window.matchMedia('(max-width: 700px)').matches){
   window.requestAnimationFrame(()=>lastTriggerRef.current?.focus());
  }
 },[]);
 const openDetails=useCallback((id:AgentId)=>{
  if(typeof document!=='undefined'&&document.activeElement instanceof HTMLElement){
   lastTriggerRef.current=document.activeElement;
  }
  setSelected(id);setView('escritorio');setDetailsOpen(true);
 },[]);
 useEffect(()=>{
  if(!detailsOpen||!mobileSheet)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  closeButtonRef.current?.focus();
  const keys=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();closeDetails();return;}
   if(event.key!=='Tab'||!sheetRef.current)return;
   const focusables=Array.from(sheetRef.current.querySelectorAll<HTMLElement>(
    'button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])'
   )).filter(el=>el.getClientRects().length>0);
   if(!focusables.length)return;
   const first=focusables[0],last=focusables[focusables.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',keys);
  return ()=>{
   document.removeEventListener('keydown',keys);
   document.body.style.overflow=previousOverflow;
   if(lastTriggerRef.current?.isConnected)lastTriggerRef.current.focus();
   else previous?.focus();
  };
 },[detailsOpen,mobileSheet,closeDetails]);
 const selectedAgent=snapshot.agents.find(a=>a.id===selected)||snapshot.agents[0];
 const selectedProfile=profiles.find(p=>p.id===selectedAgent.id)!;
 const displayed=filter==='todos'?snapshot.deliveries:snapshot.deliveries.filter(x=>x.agentId===filter);
 const recentDeliveries=selectedAgent.deliveries.slice(0,4);
 async function refreshNow(){setLoading(true);await refresh();setLoading(false);}
 const working=snapshot.agents.filter(a=>a.state==='working').length;
 return <div className="office-shell">
  <aside className="office-side">
   <a className="office-logo" href="/escritorio" onClick={e=>{e.preventDefault();setView('escritorio');}}>
    <span className="office-logo-mark">G<span>✳</span></span>
    <span><strong>guia de hoje</strong><small>STUDIO DOS AGENTES</small></span>
   </a>
   <div className="office-nav-overline">ESPAÇO DE TRABALHO</div>
   <nav className="office-menu" aria-label="Áreas do escritório">
    {([['escritorio','⌂','Escritório'],['equipe','♧','Meu time'],['entregas','▤','Entregas']] as const).map(([key,ico,label])=>
     <button key={key} type="button" className={view===key?'nav-current':''} aria-label={label} title={label} aria-current={view===key?'page':undefined} onClick={()=>{setView(key);closeDetails();}}>
      <span>{ico}</span>{label}{view===key&&<i aria-hidden="true"/>}
     </button>)}
   </nav>
   <div className="office-side-team">
    <div className="office-nav-overline">SUA EQUIPE</div>
    {profiles.map(p=>{
     const a=snapshot.agents.find(x=>x.id===p.id)!;
     return <button key={p.id} type="button" className={'side-member'+(selected===p.id&&view==='escritorio'?' side-member-active':'')}
       onClick={()=>openDetails(p.id)}>
       <span className="side-member-dot" style={{background:p.color}}>{p.name.slice(0,1)}</span>
       <span>{p.name}<small>{p.job}</small></span>
       <i className={'member-light light-'+a.state}/>
      </button>;
    })}
   </div>
   <div className="office-side-bottom"><span className="side-sparkle">✦</span><strong>Pequenas tarefas.<br/>Grandes entregas.</strong>
    <p>Uma janela para a rotina dos seus agentes.</p></div>
   <a href="/" className="office-back">← Voltar ao Guia de Hoje</a>
  </aside>

  <div className="office-main">
   <header className="office-topbar">
    <div className="office-breadcrumb">WORKSPACE <span>/</span> <strong>{view==='escritorio'?'Escritório':view==='equipe'?'Meu time':'Entregas'}</strong></div>
    <div className="office-top-actions">
     <span className="office-observed"><span className="observed-dot"/>{working>0?working+' execução(ões) confirmada(s)':'Agentes monitorados'}</span><a className="office-github-chip" href="https://github.com/aruanmf446-hub/guiadositehoje/actions" target="_blank" rel="noreferrer"><span>⌘</span> {snapshot.github.connected?snapshot.github.activeChecks.length?snapshot.github.activeChecks.length+' verificação(ões) no GitHub':'GitHub conectado':'GitHub indisponível'} ↗</a>
     <button type="button" className="office-refresh" onClick={()=>{void refreshNow();}} disabled={loading} title="Atualizar dados">
      <span aria-hidden="true" className={loading?'spin':' '}>↻</span> Atualizar
     </button>
     <span className="office-avatar">G</span>
    </div>
   </header>
   <div className="office-content">
    <div className="office-heading">
     <div><p className="office-eyebrow"><span>✳</span> CENTRAL DE OBSERVAÇÃO</p>
     <h1><span className="office-title-desktop">{view==='escritorio'?'Bem-vindo ao escritório.':view==='equipe'?'Conheça a equipe.':'O que já saiu daqui.'}</span><span className="office-title-mobile">{view==='escritorio'?'Escritório':view==='equipe'?'Meu time':'Entregas'}</span><span className="title-sparkle">✦</span></h1>
     <p className="office-subtitle">{view==='escritorio'?'Seu time, as últimas entregas e a próxima execução — tudo ligado ao GitHub e ao Supabase.':
      view==='equipe'?'Cada agente tem uma especialidade, uma mesa e uma história de entregas.':
      'Os últimos registros publicados pelos coletores, organizados para você explorar.'}</p></div>
     <div className="office-check"><span className="check-icon">◷</span><span>ÚLTIMA CONSULTA<strong>{clock(snapshot.checkedAt)}</strong></span></div>
    </div>
    {refreshError&&<div className="office-alert" role="status">{refreshError}</div>}
    {snapshot.notice&&<div className="office-alert" role="status">{snapshot.notice}</div>}
    {view==='escritorio'&&<div className="office-dashboard">
     <section className="office-scene-wrap" aria-label="Escritório gamificado interativo">
      <div className="scene-title"><div><span className="scene-dot"/> <strong>O escritório</strong><small>SELECIONE UM PERSONAGEM PARA VER O TRABALHO</small></div><span className="scene-floor-label">ANDAR 01 ↗</span></div>
      <p className="office-mobile-hint">Toque em um agente para ver suas tarefas <span aria-hidden="true">↗</span></p>
      <div className="office-scene">
       <div className="scene-wall">
        <span className="scene-sign">GUIA <b>✳</b> HOJE</span>
        <div className="scene-windows"><div/><div/><div/></div>
        <span className="scene-clock">◷</span>
       </div>
       <div className="scene-floor">
        <div className="scene-rug"/><div className="scene-cabinet"><i/><i/><i/></div>
        <div className="scene-plant plant-a"><span/><i/></div>
        <div className="scene-plant plant-b"><span/><i/></div>
        <div className="scene-water">▥<small>água</small></div>
        <div className="scene-stations">
         {snapshot.agents.map(agent=><Station key={agent.id} agent={agent} selected={selected===agent.id} onSelect={()=>openDetails(agent.id)}/>)}
        </div>
       </div>
      </div>
      <div className="scene-foot"><span><span className="legend-working"/> Só exibe execução com evidência</span><span>↻ Atualização automática a cada 45 segundos</span></div>
     </section>

     <button type="button" className={'office-sheet-backdrop'+(detailsOpen?' sheet-active':'')} onClick={closeDetails} aria-label="Fechar detalhes do agente" tabIndex={detailsOpen?0:-1}/>
     <aside ref={sheetRef} className={'office-inspector'+(detailsOpen?' sheet-open':'')}
      role={mobileSheet&&detailsOpen?'dialog':undefined} aria-modal={mobileSheet&&detailsOpen?true:undefined}
      aria-labelledby="office-agent-title" aria-label={mobileSheet&&detailsOpen?undefined:'Detalhes de '+selectedProfile.name}>
      <div className="office-sheet-handle" aria-hidden="true"/><div className="inspector-heading"><span>✦</span> FICHA DO AGENTE <small>0{profiles.findIndex(p=>p.id===selected)+1} / 05</small><button ref={closeButtonRef} type="button" className="office-sheet-close" onClick={closeDetails} aria-label="Fechar ficha do agente">×</button></div>
      <div className="inspector-person" style={{'--agent-accent':selectedProfile.color} as CSSProperties}>
       <div className="inspector-portrait"><Sprite id={selectedAgent.id}/></div>
       <div><div className="inspector-hello">Olá, eu sou</div><h2 id="office-agent-title">{selectedProfile.name}<span>.</span></h2><p>{selectedProfile.job}</p></div>
      </div>
      <Status state={selectedAgent.state}/>
      <div className="inspector-divider"/>
      <span className="inspector-caption">MINHA MISSÃO</span>
      <p className="inspector-mission">{selectedProfile.mission}</p>
      <span className="inspector-caption">SITUAÇÃO COMPROVADA</span>
      <p className="inspector-activity">{selectedAgent.activity}</p>
      <div className="office-task-summary">
       <div><small>ÚLTIMO TRABALHO · {selectedAgent.lastOrigin}</small>
         <strong>{selectedAgent.deliveries[0]?.title||selectedAgent.activity}</strong>
         <span className="office-record-time">{clock(selectedAgent.lastSeen)}</span></div>
       <div><small>PRÓXIMA TAREFA</small><strong>{selectedAgent.nextAction}</strong>
         <span className="office-record-time">{selectedAgent.nextAt?clock(selectedAgent.nextAt)+' (Brasília)':'Sem previsão confirmada'}</span></div>
       {selectedAgent.id==='seo'&&selectedAgent.queuedCount>0&&<div className="office-queue">◈ {selectedAgent.queuedCount} pauta(s) com fonte aguardando redação</div>}
       {selectedAgent.reportedPlan&&<div className="office-executor-plan"><small>PLANO INFORMADO PELO AGENTE</small><strong>{selectedAgent.reportedPlan}</strong></div>}
      </div>
      <div className="inspector-divider"/>
      <div className="inspector-recent-title"><strong>Meus últimos trabalhos</strong><span>{recentDeliveries.length} recentes</span></div>
      <Deliveries items={recentDeliveries} emptyLabel="Ainda não há publicação nem commit associado a esta especialidade."/>
      {!selectedAgent.verifiedRun&&<p className="inspector-note">Os commits são associados pela descrição da alteração; não identificam qual conversa ou modelo fez o trabalho. Só o Supabase confirma execução.</p>}
     </aside>
    </div>}

    {view==='equipe'&&<div className="office-team-grid">
     {snapshot.agents.map(agent=>{
      const p=profiles.find(x=>x.id===agent.id)!;
      return <button className="team-card" type="button" key={agent.id} onClick={()=>openDetails(agent.id)}
        style={{'--agent-accent':p.color} as CSSProperties}>
       <span className="team-card-art"><Sprite id={agent.id}/></span>
       <span className="team-card-content"><small>MESA {p.desk} / AGENTE</small><strong>{p.name}</strong><span>{p.job}</span><Status state={agent.state}/><em>Ver estação ↗</em></span>
      </button>;
     })}
    </div>}
    {view==='entregas'&&<div className="office-history">
     <div className="history-head"><div><strong>Arquivo de entregas</strong><p>Publicações do portal e alterações do repositório, com data, fonte e links verificáveis.</p></div><span>ÚLTIMOS REGISTROS</span></div>
     <div className="history-filters">
      <button type="button" onClick={()=>setFilter('todos')} className={filter==='todos'?'filter-active':''}>Todos</button>
      {profiles.map(p=><button type="button" key={p.id} onClick={()=>setFilter(p.id)} className={filter===p.id?'filter-active':''}>{idLabels[p.id]}</button>)}
     </div>
     <Deliveries items={displayed} emptyLabel="Nenhum registro publicado nesta categoria."/>
    </div>}
    <footer className="office-footer"><span>✳ GitHub: {snapshot.github.connected?'conectado':'indisponível'} · Supabase: {snapshot.telemetry?'agendamentos verificados':'sem telemetria interna'}</span><span>O trabalho dentro de outra conversa só aparece quando gerar um evento, commit ou registro verificável.</span></footer>
   </div>
  </div>
 </div>;
}
