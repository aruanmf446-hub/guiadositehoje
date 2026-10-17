const assert=require('node:assert/strict');
const base='http://127.0.0.1:3000';
async function get(path){
 for(let n=0;n<25;n++){
  try{
   const r=await fetch(base+path,{signal:AbortSignal.timeout(6000)});
   if(!r.ok)throw Error('HTTP '+r.status+' '+path);
   const html=await r.text();
   const schemas=[...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map(x=>JSON.parse(x[1]));
   return {html,schemas};
  }catch(e){if(n===24)throw e;await new Promise(resolve=>setTimeout(resolve,1000));}
 }
}
(async()=>{
 const fixture=await get('/futebol/ceara-x-juventude-2431497');
 const event=fixture.schemas.find(s=>s['@type']==='SportsEvent');
 assert.ok(event,'SportsEvent obrigatório quando estádio e endereço estão confirmados');
 assert.equal(event.location['@type'],'Place');
 assert.equal(event.location.name,'Estádio Castelão');
 assert.equal(event.location.address['@type'],'PostalAddress');
 assert.equal(event.location.address.addressLocality,'Fortaleza');
 assert.equal(event.location.address.addressCountry,'BR');
 assert.match(event.location.address.streetAddress,/Alberto Craveiro/);
 assert.ok(event.startDate?.startsWith('2026-10-17'));
 assert.ok(!('offers' in event),'não inventar venda de ingressos');
 assert.ok(!('endDate' in event),'não inventar duração');
 assert.ok(!('organizer' in event),'não inventar organizador');
 assert.match(fixture.html,/Estádio Castelão/,'local também deve aparecer na página');

 const unknown=await get('/futebol/crb-x-londrina-2431510');
 assert.ok(unknown.schemas.some(s=>s['@type']==='WebPage'),'sem estádio verificado mantém WebPage');
 assert.ok(!unknown.schemas.some(s=>s['@type']==='SportsEvent'),
  'não gerar SportsEvent sem local completo');
 console.log('SEO futebol validado: evento com local real e página sem endereço sem evento falso.');
})().catch(e=>{console.error(e);process.exitCode=1});
