import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const output='work/capture-checks', url='http://127.0.0.1:5181/damas-spanish/', key='damas-spanish.game.v1';
await mkdir(output,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5181','--strictPort'],{stdio:['ignore','pipe','pipe']});
let log='',browser; server.stdout.on('data',v=>{log+=v;});server.stderr.on('data',v=>{log+=v;});
const checks=[],errors=[];
async function ready(){for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error(log);}
async function fresh(reduced='no-preference',record=false){
 const context=await browser.newContext({viewport:{width:820,height:1180},reducedMotion:reduced,serviceWorkers:'block',...(record?{recordVideo:{dir:output,size:{width:820,height:1180}}}:{})});
 await context.addInitScript(()=>{
  Math.random=()=>0;window.captureTrace={events:[],flights:[]};window.pauseCapture=false;
  const original=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
   const role=this.classList.contains('captured-travelling')?'victim':this.classList.contains('moving')?'attacker':'other';
   const layer=this.closest('.capture-layer'), from=role==='victim'?Number(layer.dataset.capturedFrom):Number(this.parentElement.dataset.square);
   const animation=original.call(this,frames,options);
   window.captureTrace.events.push({role,phase:'start',from,time:performance.now()});
   animation.finished.then(()=>window.captureTrace.events.push({role,phase:'finish',from,time:performance.now()}),()=>{});
   if(role==='victim'){
    const token=this, origin=token.getBoundingClientRect().toJSON(), target=document.querySelector('.capture-placeholder').getBoundingClientRect().toJSON(), board=document.querySelector('#board').getBoundingClientRect().toJSON();
    const flight={from,origin,target,samples:[]};window.captureTrace.flights.push(flight);
    function sample(){
     if(!token.isConnected)return;
     const r=token.getBoundingClientRect(),style=getComputedStyle(token);
     flight.samples.push({x:r.x,y:r.y,width:r.width,height:r.height,opacity:style.opacity,visibility:style.visibility});
     if(window.pauseCapture&&!window.captureMiddle&&r.y+r.height/2>board.bottom+2&&r.y+r.height/2<target.y+target.height/2-1){
      animation.pause();window.currentCapture=animation;
      window.captureMiddle={origin,target,rect:r.toJSON(),board,samples:flight.samples.slice(),
       visibleBlack:[...document.querySelectorAll('#board .piece.black,#captured .piece.black,.capture-layer .piece.black')].filter(e=>getComputedStyle(e).visibility!=='hidden').length,
       sameNode:token===window.originalVictim};
     }
     if(animation.playState!=='finished')requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
   }
   return animation;
  };
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);return{page,context};
}
async function fixture(page,pieces,turn='white'){
 await page.evaluate(({pieces,turn,key})=>{const board=Array(64).fill(null);for(const[i,[color,king]]of Object.entries(pieces))board[Number(i)]={color,king};
  const position=turn+':'+board.map(p=>p?(p.color==='white'?(p.king?'W':'w'):(p.king?'B':'b')):'.').join('');
  localStorage.setItem(key,JSON.stringify({version:1,game:{board,turn,positions:[position]},from:null,path:[]}));
 },{pieces,turn,key});await page.reload();
}
async function state(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);}
async function capture(page){await page.locator('[data-square="36"]').click();await page.locator('[data-square="18"]').click();}
async function flight(page){await page.waitForFunction(()=>document.querySelector('.captured-travelling'));}
async function settled(page){await page.waitForFunction(()=>!document.querySelector('.capture-layer')&&document.querySelector('#board').getAttribute('aria-busy')==='false');}
const regular={36:['white',false],27:['black',false],2:['black',false]};
try{
 await ready();browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 {
  const{page,context}=await fresh('no-preference',true);await fixture(page,regular);
  await page.locator('[data-square="36"]').click();
  await page.evaluate(()=>{window.pauseCapture=true;window.originalVictim=document.querySelector('[data-square="27"] .piece');});
  await page.locator('[data-square="18"]').click();await page.waitForFunction(()=>window.captureMiddle);
  const mid=await page.evaluate(()=>window.captureMiddle);
  const pngBytes=await page.screenshot({path:output+'/over-board-frame.png'});
  await page.evaluate(()=>window.currentCapture.play());
  assert.ok(mid.sameNode);assert.equal(mid.visibleBlack,2);
  assert.ok(mid.rect.y+mid.rect.height/2>mid.board.bottom,'La ficha debe cruzar el marco, no quedar recortada.');
  assert.ok(mid.rect.width<mid.origin.width);assert.ok(mid.rect.width>=mid.target.width-.5);
  assert.ok(new Set(mid.samples.map(p=>p.y.toFixed(1))).size>4,'Deben existir posiciones intermedias reales.');
  assert.ok(mid.samples.every(p=>p.opacity==='1'&&p.visibility==='visible'));
  const png=PNG.sync.read(pngBytes), x=Math.round(mid.rect.x+mid.rect.width/2),y=Math.round(mid.rect.y+mid.rect.height/2),offset=(y*png.width+x)*4;
  assert.ok(png.data[offset]<90&&png.data[offset+1]<80&&png.data[offset+2]<70,'Debe pintarse la ficha oscura fuera del borde del tablero.');
  await settled(page);
  const target=await page.locator('[data-captured-slot="black-0"] .piece').boundingBox();
  assert.ok(Math.abs(target.width-mid.target.width)<1);assert.ok(Math.abs(target.x-mid.target.x)<1);
  const trace=await page.evaluate(()=>window.captureTrace);
  assert.ok(trace.events.findIndex(e=>e.role==='victim'&&e.phase==='start')>trace.events.findIndex(e=>e.role==='attacker'&&e.phase==='finish'));
  assert.equal((await state(page)).captured.length,1);
  await page.screenshot({path:output+'/collected.png'});
  await page.locator('#restart').click();await page.getByRole('button',{name:'Empezar de nuevo'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#captured [role="listitem"]').length===0);
  checks.push('Salto primero; misma víctima visible en posiciones intermedias, píxeles pintados sobre el marco, reducción y aterrizaje exacto sin duplicados.');
  await writeFile(output+'/samples.json',JSON.stringify({mid,trace},null,2));
  const video=page.video();await context.close();if(video){await video.saveAs(output+'/capture.webm');await video.delete();}
 }
 {
  const{page,context}=await fresh();await fixture(page,{18:['black',false],27:['white',true],45:['white',false],63:['white',false]},'black');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('damas-spanish.game.v1')).game.turn==='white'&&document.querySelector('#board').getAttribute('aria-busy')==='false');
  const events=await page.evaluate(()=>window.captureTrace.events);
  assert.deepEqual(events.map(e=>e.role+':'+e.phase+':'+e.from),[
   'attacker:start:18','attacker:finish:18','victim:start:27','victim:finish:27',
   'attacker:start:36','attacker:finish:36','victim:start:45','victim:finish:45']);
  assert.deepEqual((await state(page)).captured,[{color:'white',king:true},{color:'white',king:false}]);
  assert.equal(await page.locator('#captured [role="listitem"]').count(),2);
  await page.reload();assert.equal(await page.locator('#captured [role="listitem"]').count(),2);
  assert.equal((await page.evaluate(()=>window.captureTrace.flights)).length,0);
  checks.push('Captura múltiple del iPad: cada salto y cada víctima en orden; damas conservadas y restauración sin repetir traslados.');await context.close();
 }
 {
  const{page,context}=await fresh();await fixture(page,{36:['white',false],27:['black',false]});
  const source=await page.locator('[data-square="36"]').boundingBox(),target=await page.locator('[data-square="18"]').boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
  await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:10});await page.mouse.up();await flight(page);
  assert.equal(await page.locator('#result').isVisible(),false);assert.equal(await page.locator('#restart').isDisabled(),true);
  const attacker=await page.locator('.capture-layer .piece.white').boundingBox();assert.ok(Math.abs(attacker.x+attacker.width/2-target.x-target.width/2)<2);
  const saved=JSON.stringify(await state(page));await page.evaluate(()=>document.querySelector('[data-square="29"]').click());assert.equal(JSON.stringify(await state(page)),saved);
  await page.waitForFunction(()=>!document.querySelector('#result').hidden);
  assert.equal(await page.locator('#result-title').textContent(),'¡Has ganado!');
  assert.equal((await page.evaluate(()=>window.captureTrace.events)).filter(e=>e.role==='attacker').length,0);
  checks.push('Arrastre: atacante retenido en destino sin salto repetido; traslado real de la víctima, entrada bloqueada y victoria solo al finalizar.');await context.close();
 }
 {
  const{page,context}=await fresh('reduce');await fixture(page,regular);await capture(page);await settled(page);
  assert.equal((await state(page)).captured.length,1);assert.equal((await page.evaluate(()=>window.captureTrace.events)).length,0);
  assert.equal(await page.locator('[data-captured-slot="black-0"] .piece').count(),1);
  checks.push('Reducir movimiento: tablero y colección se actualizan instantáneamente.');await context.close();
 }
 {
  const{page,context}=await fresh();await fixture(page,regular);await capture(page);await flight(page);
  const durable=await state(page);assert.equal(durable.captured.length,1);assert.equal(durable.game.board[27],null);
  await page.reload();assert.equal(await page.locator('[data-captured-slot="black-0"] .piece').count(),1);
  await page.waitForTimeout(1200);assert.equal((await state(page)).captured.length,1);
  assert.equal((await page.evaluate(()=>window.captureTrace.flights)).length,0);
  await fixture(page,regular);await capture(page);await flight(page);await page.setViewportSize({width:820,height:1100});await settled(page);
  assert.equal((await state(page)).captured.length,1);assert.equal(await page.locator('.capture-layer').count(),0);
  checks.push('Recarga durante el vuelo y cambio de orientación: guardado adelantado restaurado, sin duplicar víctimas ni dejar capas bloqueadas.');await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(output+'/checks.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{if(browser)await browser.close();server.kill();await writeFile(output+'/server.log',log);}
