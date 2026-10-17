// Auditoria semanal visual REAL. Capturas do navegador, métricas de 10 telas e OIDC GitHub.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const BASE='https://guiadehoje.site';
const ENDPOINT='https://kffzngznzjgioabtqxju.supabase.co/functions/v1/milly-design-audit';
const AUDIENCE='guia-de-hoje-milly-design';
const pages=['/','/noticias','/filmes-series','/filmes-series/toy-story-5','/futebol'];
const viewports=[{width:390,height:844,label:'mobile'},{width:1440,height:900,label:'desktop'}];
const root='artifacts/milly-weekly';
const run=process.env.GITHUB_RUN_ID||'';
if(!/^\d+$/.test(run))throw Error('Executar em GitHub Actions, com token OIDC de workflow');
fs.mkdirSync(root,{recursive:true});
async function oidc(){
 const endpoint=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
 const bearer=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
 if(!endpoint||!bearer)throw Error('GitHub Actions OIDC indisponível');
 const url=new URL(endpoint);
 url.searchParams.set('audience',AUDIENCE);
 const res=await fetch(url,{headers:{Authorization:'Bearer '+bearer}});
 if(!res.ok)throw Error('GitHub OIDC HTTP '+res.status);
 const data=await res.json();
 assert.ok(data.value,'Token GitHub não gerado');
 return data.value;
}
async function post(action,fields={}){
 const token=await oidc();
 const res=await fetch(ENDPOINT,{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({action,...fields}),signal:AbortSignal.timeout(118000)
 });
 const out=await res.json().catch(()=>({error:'Resposta da função inválida'}));
 if(!res.ok)throw Error('Milly '+res.status+': '+JSON.stringify(out));
 return out;
}
async function audit(){
 const start=await post('start');
 if(start.status==='already_executed'||start.status==='already_completed'){
  console.log('Auditoria da semana já realizada; nenhuma nova inferência.');return;
 }
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const screenshots=[],checks=[];
 try{
  for(const vp of viewports){
   const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},
    deviceScaleFactor:1,isMobile:vp.width<700,hasTouch:vp.width<700});
   const tab=await context.newPage();
   for(const pagePath of pages){
    const errors=[];
    tab.on('pageerror',e=>errors.push(e.message));
    let status=0;
    try{
     const resp=await tab.goto(BASE+pagePath,{waitUntil:'domcontentloaded',timeout:45000});
     status=resp?.status()||0;
     await tab.evaluate(()=>document.fonts.ready).catch(()=>{});
     await tab.waitForTimeout(650);
     const metrics=await tab.evaluate(()=>{
      const headings=[...document.querySelectorAll('h1,h2')].slice(0,14);
      const missingImages=[...document.querySelectorAll('img')].filter(x=>
       x.getBoundingClientRect().width>0&&x.complete&&x.naturalWidth===0).length;
      const clippedHeadings=headings.filter(x=>x.scrollWidth>x.clientWidth+4).length;
      const smallTargets=[...document.querySelectorAll('header a,header button,nav a,nav button')]
       .filter(x=>{const b=x.getBoundingClientRect();
        return b.width>0&&b.height>0&&b.width<34&&b.height<34}).length;
      return {documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,
       missingImages,clippedHeadings,smallTargets};
     });
     const result={path:pagePath,viewport:vp.label+' '+vp.width+'px',status,
      horizontalOverflow:metrics.documentWidth>vp.width+2,pageError:errors.length>0,
      missingImages:metrics.missingImages,clippedHeadings:metrics.clippedHeadings,
      smallTargets:metrics.smallTargets,overlappingElements:0};
     checks.push(result);
     console.log('CHECK',JSON.stringify(result));
     if((pagePath==='/'&&vp.label==='desktop')||
        (pagePath==='/filmes-series'&&vp.label==='mobile')){
      const file=path.join(root,vp.label+(pagePath==='/'?'-inicio':'-filmes')+'.jpg');
      const buf=await tab.screenshot({type:'jpeg',quality:52,fullPage:false,animations:'disabled'});
      fs.writeFileSync(file,buf);
      screenshots.push({label:vp.label==='desktop'?'Página inicial (1440 px)':'Filmes e séries (390 px)',
       base64:buf.toString('base64')});
     }
    }catch(e){
     console.error('Erro verificando',pagePath,vp.label,String(e));
     checks.push({path:pagePath,viewport:vp.label+' '+vp.width+'px',status,
      horizontalOverflow:false,pageError:true,error:String(e).slice(0,180),overlappingElements:0});
    }
    tab.removeAllListeners('pageerror');
   }
   await context.close();
  }
 }finally{await browser.close();}
 const metrics=path.join(root,'medicoes.json');
 fs.writeFileSync(metrics,JSON.stringify(checks,null,2));
 assert.equal(checks.length,10,'Dez cenários devem ser verificados');
 assert.equal(screenshots.length,2,'Duas capturas reais obrigatórias');
 const result=await post('analyze',{screenshots,checks});
 if(result.status!=='completed')throw Error('Análise não concluída');
 console.log('Milly: relatório semanal registrado no Supabase.',result);
}
audit().catch(async e=>{
 console.error('Milly: erro verificável:',String(e));
 try{await post('failed',{message:String(e).slice(0,280)});}catch(err){console.error('Erro ao registrar falha:',String(err));}
 process.exitCode=1;
});
