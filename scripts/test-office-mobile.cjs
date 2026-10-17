/* Validação end-to-end da experiência existente; não usa mocks de estado dos agentes. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');

const base=process.env.OFFICE_TEST_BASE_URL||'http://127.0.0.1:3000';
const sizes=[
 {width:320,height:568},{width:375,height:667},{width:390,height:844},
 {width:430,height:932},{width:768,height:1024},{width:1024,height:768},
 {width:667,height:375,orientation:'landscape'}
];
function check(ok,detail){assert.ok(ok,detail);}
(async()=>{
 fs.mkdirSync('artifacts/office-mobile',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const failures=[];
 try{
  for(const size of sizes){
   const label=size.width+'x'+size.height;
   const context=await browser.newContext({
    viewport:{width:size.width,height:size.height},
    isMobile:size.width<=700,hasTouch:true,deviceScaleFactor:1
   });
   const page=await context.newPage();
   page.setDefaultTimeout(30000);
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   try{
    const navigation=await page.goto(base+'/escritorio',{waitUntil:'domcontentloaded',timeout:55000});
    check(navigation&&navigation.status()===200,label+': route HTTP '+navigation?.status());
    await page.locator('.office-station').first().waitFor({state:'visible'});
    check(await page.locator('.office-station').count()===5,label+': five agents missing');
    const initial=await page.evaluate(()=>{
     const scene=document.querySelector('.office-scene');
     const buttons=[...document.querySelectorAll('.office-station')];
     return {
      viewport:innerWidth,document:document.documentElement.scrollWidth,
      body:document.body.scrollWidth,sceneClient:scene?.clientWidth,
      sceneScroll:scene?.scrollWidth,
      station:buttons.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}),
      nav:[...document.querySelectorAll('.office-menu button')].map(b=>({
       name:b.getAttribute('aria-label'),rect:b.getBoundingClientRect().toJSON(),
       text:getComputedStyle(b).fontSize
      }))
     };
    });
    check(initial.document<=size.width+2,label+': horizontal document overflow '+JSON.stringify(initial));
    check(initial.body<=size.width+2,label+': horizontal body overflow');
    check(initial.sceneScroll<=initial.sceneClient+2,label+': horizontal scene overflow');
    check(initial.nav.length===3,label+': navigation tabs not three');
    if(size.width<=700){
     const tabs=initial.nav;
     check(tabs.every(t=>t.rect.width>=60&&t.rect.height>=40),label+': tabs not comfortably touchable');
     check(initial.station.every(s=>s.w>=70&&s.h>=100),label+': miniature station not touchable');
     for(let i=0;i<initial.station.length;i++)for(let j=i+1;j<initial.station.length;j++){
      const a=initial.station[i],b=initial.station[j];
      const ix=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
      const iy=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
      check(ix*iy<10,label+': station overlap '+i+' '+j+' '+ix+'x'+iy);
     }
    }
    for(const name of ['Bento','Nina','Theo','Luna','Otto']){
     const station=page.getByRole('button',{name:new RegExp('Selecionar '+name)});
     await station.scrollIntoViewIfNeeded();
     if(size.width<=700)await station.tap();else await station.click();
     if(size.width<=700){
      const sheet=page.getByRole('dialog');
      await sheet.waitFor({state:'visible'});
      check(await sheet.locator('#office-agent-title').innerText()===name,label+': wrong bottom-sheet agent '+name);
      check(await sheet.getByText('SITUAÇÃO COMPROVADA').isVisible(),label+': activity missing');
      check(await sheet.getByText('PRÓXIMA TAREFA').isVisible(),label+': next task missing');
      check(await sheet.getByText('Meus últimos trabalhos').isVisible(),label+': deliveries missing');
      if(name==='Bento')await page.screenshot({path:'artifacts/office-mobile/sheet-'+label+'.png'});
      await sheet.getByRole('button',{name:'Fechar ficha do agente'}).click();
      check(await page.getByRole('dialog').count()===0,label+': sheet not closed');
     }else{
      check(await page.locator('.inspector-person h2').innerText()===name+'.',label+': details not updated');
     }
    }
    await page.screenshot({path:'artifacts/office-mobile/office-'+label+'.png',fullPage:true});
    await page.getByRole('button',{name:'Meu time'}).click();
    check(await page.locator('.team-card').count()===5,label+': team count');
    await page.getByRole('button',{name:'Entregas'}).click();
    await page.locator('.office-history').waitFor({state:'visible'});
    await page.getByRole('button',{name:'Escritório'}).click();
    check(await page.locator('.office-station').count()===5,label+': return to scene');
    if(size.width<=700){
      await page.locator('.office-station').first().tap();
      await page.keyboard.press('Escape');
      check(await page.getByRole('dialog').count()===0,label+': escape did not dismiss');
    }
    check(errors.length===0,label+': browser errors '+errors.join(' / '));
    console.log('PASS '+label+': no overflow; five desks; five sheets; tabs; accessible dismissal');
   }catch(e){failures.push(label+': '+String(e));console.error('FAIL '+label+': '+String(e));}
   finally{await context.close();}
  }
 }finally{await browser.close();}
 if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
 else console.log('All office breakpoints validated.');
})().catch(e=>{console.error(e);process.exitCode=1;});
