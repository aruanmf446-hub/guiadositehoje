/* Regressão da auditoria Milly (layout real renderizado no Next + Supabase). */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root='artifacts/milly-fixes';
const origin=process.env.LAYOUT_BASE_URL||'http://127.0.0.1:3000';
const urls=['/','/filmes-series','/filmes-series/toy-story-5','/filmes-series/the-last-of-us'];
const dimensions=[320,375,390,430,768,1024,1440];
(async()=>{
 fs.mkdirSync(root,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const errors=[];
 try{
  for(const width of dimensions){
   const context=await browser.newContext({viewport:{width,height:width===1440?900:width===768?1024:844},deviceScaleFactor:1,
    hasTouch:width<=430,isMobile:width<=430});
   const page=await context.newPage();page.setDefaultTimeout(25000);
   for(const url of urls){
    try{
     const nav=await page.goto(origin+url,{waitUntil:'domcontentloaded',timeout:45000});
     assert.equal(nav?.status(),200,'HTTP '+url+' at '+width);
     await page.evaluate(()=>document.fonts.ready);
     const result=await page.evaluate(()=>{
      const rect=e=>e.getBoundingClientRect();
      const vw=document.documentElement.clientWidth;
      const site=document.querySelector('.site');
      const body=document.body;
      const html=document.documentElement;
      const offenders=[...document.querySelectorAll('body *')].filter(e=>{
       const r=rect(e),style=getComputedStyle(e);
       return style.position!=='fixed'&&r.width>0&&r.height>0&&(r.right>vw+3||r.left<-3)
         &&style.visibility!=='hidden'&&style.display!=='none'
      }).slice(0,8).map(e=>({
       tag:e.tagName.toLowerCase(),className:typeof e.className==='string'?e.className.slice(0,70):'',
       right:Math.round(rect(e).right),left:Math.round(rect(e).left),width:Math.round(rect(e).width)
      }));
      const jumps=[...document.querySelectorAll('.media-archive-jump a')].map(e=>({
       left:Math.round(rect(e).left),height:Math.round(rect(e).height)
      }));
      const ctas=[...document.querySelectorAll('.search-box button')].map(e=>({
       height:Math.round(rect(e).height),layout:getComputedStyle(e).display
      }));
      return {pageWidth:Math.max(html.scrollWidth,body.scrollWidth),
       screen:vw,innerWidth:window.innerWidth,offenders,jumps,ctas,
       heroLeft:site?.querySelector('.media-archive-hero h1')?Math.round(rect(site.querySelector('.media-archive-hero h1')).left):null};
     });
     console.log('LAYOUT',width,url,JSON.stringify(result));
     assert.ok(result.pageWidth<=width+2,
      width+'px '+url+' horizontal overflow: '+JSON.stringify(result));
     if(url==='/filmes-series'){
      assert.equal(result.jumps.length,2,'jump links present');
      assert.ok(result.jumps.every(x=>x.height>=40),'anchor touch height');
      assert.ok(result.jumps.every(x=>Math.abs(x.left-result.heroLeft)<=4||
        x.left>result.heroLeft),'jump links stay left aligned');
     }
     if(url==='/'&&result.ctas.length)assert.ok(result.ctas[0].height>=44,'search CTA >=44px');
     if((width===390||width===1440)&&(url==='/'||url.includes('toy-story-5')||url==='/filmes-series')){
      await page.screenshot({path:root+'/'+width+'-'+url.replaceAll('/','-').replace(/^-/, '')+'.png',fullPage:true});
     }
    }catch(e){errors.push(String(e));console.error('FAIL',width,url,e);}
   }
   await context.close();
  }
 }finally{await browser.close();}
 if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
 else console.log('Milly: 28 cenários de layout aprovados.');
})().catch(e=>{console.error(e);process.exitCode=1});
