// Tipos e identidade visual compartilhados com o cliente. Nenhum segredo aqui.
export const profiles=[
 {id:'futebol',name:'Bento',job:'Radar do futebol',desk:'01',color:'#f3a65c',hair:'#4a3735',skin:'#e5ae8b',mission:'Conferir jogos, campeonatos e transmissões'},
 {id:'noticias',name:'Nina',job:'Pesquisa de notícias',desk:'02',color:'#8b94e9',hair:'#353052',skin:'#e4aa85',mission:'Acompanhar fontes e atualizações editoriais'},
 {id:'filmes',name:'Theo',job:'Curadoria de filmes',desk:'03',color:'#ee8fa4',hair:'#815d3f',skin:'#f4c3a1',mission:'Organizar o catálogo de filmes'},
 {id:'series',name:'Luna',job:'Curadoria de séries',desk:'04',color:'#7dc5ad',hair:'#30384a',skin:'#bc8269',mission:'Conferir séries e a programação'},
 {id:'seo',name:'Otto',job:'Redação & SEO',desk:'05',color:'#e9c36e',hair:'#543e37',skin:'#dca77c',mission:'Preparar textos editoriais e SEO'},
 {id:'design',name:'Milly',job:'Designer do site',desk:'06',color:'#f78cbb',hair:'#211927',skin:'#814936',mission:'Auditar o visual e a experiência mobile do site semanalmente'},
 {id:'imagens',name:'Íris',job:'Imagens & créditos',desk:'07',color:'#75bed6',hair:'#232940',skin:'#c89070',mission:'Encontrar imagens licenciadas, identificar autores e preparar capas ilustrativas quando não houver foto segura'},
] as const;
export type AgentId=typeof profiles[number]['id'];
export type AgentState='working'|'recent'|'waiting'|'error'|'unconnected';
export type Delivery={id:string;agentId:AgentId;title:string;detail:string;time:string;href:string;origin?:'github'|'published'|'catalog'};
export type GitHubSummary={
 connected:boolean;
 lastCommit:{title:string;time:string;href:string}|null;
 activeChecks:{name:string;href:string;status:string}[];
 checkedAt:string;
};
export type OfficeStep={
 title:string;detail:string;status:'done'|'active'|'next'|'error';at:string|null;
};
export type OfficeMission={
 title:string;focus:string;windowLabel:string;stages:OfficeStep[];
 recordedAt:string|null;source:'executor'|'agendamento';processed:number;received:number;
 auditReport?:string|null;auditUrl?:string|null;
};
export type OfficeAgent={
 id:AgentId;state:AgentState;lastSeen:string|null;activity:string;
 deliveries:Delivery[];verifiedRun:boolean;
 nextAt:string|null;nextAction:string;queuedCount:number;
 lastOrigin:string;
 reportedPlan:string|null;mission:OfficeMission;
};
export type OfficeSnapshot={
 checkedAt:string;telemetry:boolean;agents:OfficeAgent[];
 deliveries:Delivery[];notice:string|null;github:GitHubSummary;
};
