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
