import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const output = 'work/destination-checks', url = 'http://127.0.0.1:5182/damas-spanish/', key = 'damas-spanish.game.v1';
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5182', '--strictPort'], { stdio: ['ignore','pipe','pipe'] });
let log = '', browser;
server.stdout.on('data', v => { log += v; }); server.stderr.on('data', v => { log += v; });
const checks = [], errors = [];
async function ready() {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(log);
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw Error(log);
}
async function fresh({ white = [45,27,9], source = 54, king = false, reduced = false, video = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, serviceWorkers: 'block', hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference',
    ...(video ? { recordVideo: { dir: output, size: { width: 820, height: 1180 } } } : {}) });
  await context.addInitScript(() => {
    Math.random = () => 0;
    window.trace = { events: [], motion: [] };
    const original = Element.prototype.animate;
    Element.prototype.animate = function(frames, options) {
      const role = this.classList.contains('captured-travelling') ? 'victim' : this.classList.contains('moving') ? 'jump' : this.classList.contains('dragging') ? 'return' : 'other';
      const from = role === 'victim' ? this.closest('.capture-layer').dataset.capturedFrom : this.parentElement.dataset.square;
      const animation = original.call(this, frames, options), token = this;
      window.trace.events.push({ role, from, phase: 'start' });
      animation.finished.then(() => window.trace.events.push({ role, from, phase: 'finish' }), () => {});
      const samples = []; window.trace.motion.push({ role, from, samples });
      function sample() {
        if (!token.isConnected) return;
        const r = token.getBoundingClientRect(); samples.push({ x: r.x, y: r.y, width: r.width, visibility: getComputedStyle(token).visibility });
        if (animation.playState === 'running') requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
      return animation;
    };
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(({ white, source, king, key }) => {
    const board = Array(64).fill(null); board[source] = { color: 'black', king };
    for (const i of white) board[i] = { color: 'white', king: false };
    const position = 'black:' + board.map(p => p ? p.color === 'black' ? p.king ? 'B' : 'b' : 'w' : '.').join('');
    localStorage.setItem(key, JSON.stringify({ version: 2, game: { board, turn: 'black', positions: [position] }, from: null, path: [] }));
  }, { white, source, king, key });
  await page.reload(); return { page, context };
}
const cell = (page, i) => page.locator(`[data-square="${i}"]`);
const state = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const idle = page => page.waitForFunction(() => document.querySelector('#board').getAttribute('aria-busy') !== 'true' && !document.querySelector('.drag-layer'));
const finished = page => page.waitForFunction(() => !document.querySelector('#result').hidden);
async function drag(page, from, to) {
  const a = await cell(page, from).boundingBox(), b = await cell(page, to).boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{ steps: 12 }); await page.mouse.up();
}
function ordered(events, from = ['54','36','18'], victims = ['45','27','9']) {
  assert.deepEqual(events.filter(e => e.role !== 'return').map(e => `${e.role}:${e.phase}:${e.from}`), from.flatMap((source,i) => [
    `jump:start:${source}`, `jump:finish:${source}`, `victim:start:${victims[i]}`, `victim:finish:${victims[i]}`
  ]));
}
try {
  await ready(); browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  {
    const context=await browser.newContext({viewport:{width:1100,height:1180},serviceWorkers:'block'});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
    const initial=await state(page);assert.equal(initial.version,2);assert.equal(initial.game.turn,'black');
    assert.equal(initial.game.board.slice(0,24).filter(p=>p?.color==='white').length,12);
    assert.equal(initial.game.board.slice(40).filter(p=>p?.color==='black').length,12);
    assert.equal(await page.locator('#status').textContent(),'Tu turno · negras');
    const bytes=await page.screenshot({path:output+'/dark-full-page.png',fullPage:true});const png=PNG.sync.read(bytes);
    const panel=await page.locator('.game').boundingBox();
    for(const [x,y]of [[2,2],[png.width-3,Math.floor(png.height/2)],[2,png.height-3],[Math.round(panel.x+8),Math.round(panel.y+10)]]){
      const at=(y*png.width+x)*4;assert.ok(png.data[at]<90&&png.data[at+1]<90&&png.data[at+2]<90,'El exterior completo debe ser nogal oscuro.');
    }
    await cell(page,41).click();await cell(page,32).click();
    await page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='false'&&JSON.parse(localStorage.getItem('damas-spanish.game.v1')).game.turn==='black');
    const response=await state(page);assert.ok(response.game.board[32]?.color==='black');
    assert.notDeepEqual(response.game.board.slice(0,32),initial.game.board.slice(0,32));
    await page.locator('#restart').click();await page.getByRole('button',{name:'Empezar de nuevo',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('damas-spanish.game.v1')).game.board.filter(Boolean).length===24);
    assert.equal((await state(page)).game.turn,'black');await page.reload();assert.equal((await state(page)).game.turn,'black');
    checks.push('Inicio, reinicio y restauración con humano negro abajo; respuesta automática blanca y fondo exterior oscuro comprobado en píxeles alrededor y debajo.');await context.close();
  }
  {
    const {page,context}=await fresh();
    await page.evaluate(key=>{
      const board=Array(64).fill(null);board[54]={color:'white',king:false};board[45]={color:'black',king:true};board[27]={color:'black',king:false};
      const position='white:'+board.map(p=>p?p.color==='white'?'w':p.king?'B':'b':'.').join('');
      localStorage.setItem(key,JSON.stringify({version:1,game:{board,turn:'white',positions:[position]},from:54,path:[36],captured:[{color:'black',king:true}]}));
    },key);await page.reload();
    const migrated=await state(page);assert.equal(migrated.version,2);assert.equal(migrated.game.turn,'black');
    assert.deepEqual(migrated.captured,[{color:'white',king:true}]);assert.deepEqual(migrated.path,[36]);
    assert.equal(await cell(page,36).locator('.piece.black').count(),1);
    assert.equal(await page.locator('#captured .piece.white').count(),1);
    await page.reload();assert.deepEqual(await state(page),migrated);
    checks.push('Guardado v1 real migrado una sola vez: dueño humano conservado como negro, casilla intermedia, dama capturada e historial válidos.');await context.close();
  }
  {
    const { page, context } = await fresh({ video: true });
    await cell(page,54).click();
    for (const i of [36,18,0]) assert.match(await cell(page,i).getAttribute('class'), /destination/);
    await cell(page,0).click();
    await page.waitForFunction(() => document.querySelector('.captured-travelling'));
    assert.equal(await page.locator('#restart').isDisabled(), true);
    assert.equal(await page.locator('#result').isVisible(), false);
    const durable = await state(page); assert.equal(durable.captured.length,3); assert.deepEqual(durable.game.board[0],{ color:'black',king:true });
    await page.evaluate(() => document.querySelector('[data-square="36"]').click());
    assert.deepEqual(await state(page), durable);
    await page.screenshot({ path: output+'/triple-in-progress.png' });
    await finished(page); assert.equal(await page.locator('#result-title').textContent(),'¡Has ganado!');
    const trace = await page.evaluate(() => window.trace); ordered(trace.events);
    for (const motion of trace.motion) {
      assert.ok(new Set(motion.samples.map(r => `${r.x.toFixed(1)},${r.y.toFixed(1)}`)).size > 3, 'Cada salto y traslado recorre posiciones intermedias reales.');
      assert.ok(motion.samples.every(r => r.visibility === 'visible'));
    }
    await writeFile(output+'/triple-samples.json',JSON.stringify(trace,null,2));
    await page.screenshot({ path: output+'/victory.png' });
    checks.push('Dos pulsaciones al destino triple: tres saltos reales y tres traslados visibles en orden; guardado final previo, entrada bloqueada y victoria aplazada.');
    const video = page.video(); await context.close(); if (video) { await video.saveAs(output+'/triple.webm'); await video.delete(); }
  }
  {
    const { page, context } = await fresh(); await drag(page,54,0);
    await page.waitForFunction(() => window.trace.events.some(e => e.role === 'return'));
    assert.equal(await page.locator('#restart').isDisabled(),true);
    await finished(page); const trace = await page.evaluate(() => window.trace); ordered(trace.events);
    assert.equal(trace.events[0].role,'return'); assert.equal(trace.events[1].phase,'finish');
    assert.equal((await state(page)).captured.length,3);
    checks.push('Arrastre directo: retorno suave del gesto y ejecución de la ruta real, sin duplicados y con bloqueo continuo.'); await context.close();
  }
  {
    const { page, context } = await fresh();
    const session = await context.newCDPSession(page);
    const a = await cell(page,54).boundingBox(), b = await cell(page,0).boundingBox();
    const touch = (type, x, y) => session.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y, id: 1, radiusX: 3, radiusY: 3 }] });
    await touch('touchStart',a.x+a.width/2,a.y+a.height/2);
    await touch('touchMove',a.x+a.width/2-15,a.y+a.height/2-15);
    await page.waitForFunction(() => document.querySelector('.drag-layer'));
    assert.equal(await page.evaluate(() => scrollY),0);
    await touch('touchMove',b.x+b.width/2,b.y+b.height/2); await touch('touchEnd');
    await finished(page); ordered((await page.evaluate(() => window.trace)).events);
    assert.equal((await state(page)).captured.length,3);
    checks.push('Arrastre táctil nativo de Chromium al destino triple: ruta completa, sin scroll ni capturas duplicadas.'); await context.close();
  }
  {
    const { page, context } = await fresh({ reduced: true }); await cell(page,54).click(); await cell(page,18).click(); await idle(page);
    const saved = await state(page); assert.equal(saved.game.turn,'white'); assert.equal(saved.captured.length,2); assert.ok(saved.game.board[9]); assert.ok(saved.game.board[18]);
    assert.deepEqual(await page.evaluate(() => window.trace.events),[]);
    checks.push('Destino doble intermedio: termina voluntariamente dejando la tercera rival; reducción de movimiento instantánea.'); await context.close();
  }
  {
    const { page, context } = await fresh(); await cell(page,54).click(); await cell(page,36).click(); await idle(page);
    assert.deepEqual((await state(page)).path,[36]);
    await cell(page,36).click(); assert.equal((await state(page)).captured.length,1); assert.equal((await state(page)).game.turn,'white');
    checks.push('Por etapas: primer salto y parada voluntaria tocando de nuevo la ficha, sin continuación obligatoria.'); await context.close();
  }
  {
    const { page, context } = await fresh({ white:[18,20,22,32,45],king:true });
    await cell(page,54).click(); await cell(page,9).click(); await idle(page);
    ordered((await page.evaluate(() => window.trace)).events,['54','27'],['45','18']);
    assert.equal((await state(page)).captured.length,2);
    checks.push('Rutas equivalentes: elección numérica predecible 54–27–9.'); await context.close();
  }
  {
    const { page, context } = await fresh({ white:[11,13,29,45,47],king:true }); await cell(page,54).click();
    assert.match(await cell(page,22).getAttribute('class'),/destination/);
    const before = await state(page); await cell(page,22).click();
    await page.locator('#route-dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#restart').isDisabled(),true);
    assert.deepEqual(await state(page),before);
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    assert.deepEqual(await state(page),before);
    await drag(page,54,22);
    await page.locator('#route-dialog').waitFor({state:'visible'});
    await page.screenshot({path:output+'/route-choice.png'});
    await page.getByRole('button',{name:/Capturar 3 fichas/}).click(); await idle(page);
    assert.equal((await state(page)).captured.length,3);
    ordered((await page.evaluate(()=>window.trace)).events,['54','18','4'],['45','11','13']);
    assert.ok((await state(page)).game.board[29]); // The unchosen two-capture route is not used.
    checks.push('Destino ambiguo resaltado desde el origen: cancelar conserva el guardado; el arrastre permite elegir explícitamente la ruta de tres capturas.'); await context.close();
  }
  for (const count of [1,4]) {
    const {page,context}=await fresh({white:[11,13,29,31,45],king:true});
    if(count===4) await drag(page,54,36); else {await cell(page,54).click();await cell(page,36).click();}
    await page.locator('#route-dialog').waitFor({state:'visible'});
    assert.equal(await page.getByRole('button',{name:/Capturar 1 ficha /}).count(),1);
    assert.equal(await page.getByRole('button',{name:/Capturar 4 fichas/}).count(),1);
    // Keyboard activation exercises the same accessible choice as a tap.
    const choice=page.getByRole('button',{name:new RegExp(`Capturar ${count} ficha`)});
    await choice.focus(); await page.keyboard.press('Enter'); await idle(page);
    assert.equal((await state(page)).captured.length,count);
    ordered((await page.evaluate(()=>window.trace)).events,count===1?['54']:['54','18','4','22'],count===1?['45']:['45','11','13','29']);
    if(count===1) {assert.deepEqual((await state(page)).path,[36]);await cell(page,36).click();}
    else assert.deepEqual((await state(page)).path,[]);
    checks.push(`Destino inmediato y final compartido: opción de ${count} capturas accesible, sin prioridad impuesta.`);await context.close();
  }
  {
    const {page,context}=await fresh({source:36,white:[11,13,20,25,27,29],king:true});
    await cell(page,36).click();await cell(page,36).click();
    await page.locator('#route-dialog').waitFor({state:'visible'});
    assert.equal(await page.getByRole('button',{name:/Deseleccionar ficha/}).count(),1);
    await page.getByRole('button',{name:/Capturar 4 fichas/}).click();await idle(page);
    assert.equal((await state(page)).captured.length,4);assert.equal((await state(page)).game.board[36].color,'black');
    checks.push('Cadena que regresa al origen accesible junto con la opción de deseleccionar.');await context.close();
  }
  {
    const {page,context}=await fresh({white:[45]});
    await page.evaluate(key=>{const saved=JSON.parse(localStorage.getItem(key));saved.game.turn='white';saved.game.positions=saved.game.positions.map(p=>p.replace(/^black:/,'white:'));localStorage.setItem(key,JSON.stringify(saved));},key);
    await page.reload();await finished(page);
    assert.deepEqual((await state(page)).game.board[63],{color:'white',king:true});
    assert.equal(await page.locator('#result-title').textContent(),'Partida terminada');
    assert.equal(await page.locator('#result').evaluate(e=>e.classList.contains('celebrate')),false);
    checks.push('IA blanca captura hacia abajo, corona en la fila inferior y gana sin celebración humana.');await context.close();
  }
  {
    const {page,context}=await fresh({white:[45,27]});await cell(page,54).click();
    assert.match(await cell(page,18).getAttribute('class'),/destination/);
    await cell(page,18).click();await finished(page);
    ordered((await page.evaluate(()=>window.trace)).events,['54','36'],['45','27']);
    assert.equal((await state(page)).captured.length,2);
    assert.equal(await page.locator('#result-title').textContent(),'¡Has ganado!');
    assert.equal(await page.locator('#result').evaluate(e=>e.classList.contains('celebrate')),true);
    checks.push('Captura doble inequívoca seleccionada directamente: dos saltos, dos traslados y celebración del humano negro.');await context.close();
  }

  {
    const { page, context } = await fresh(); await cell(page,54).click(); await cell(page,0).click();
    await page.waitForFunction(() => document.querySelector('.captured-travelling')); await page.reload(); await finished(page);
    assert.equal((await state(page)).captured.length,3); assert.equal(await page.locator('#result').evaluate(el => el.classList.contains('celebrate')),false);
    assert.deepEqual(await page.evaluate(() => window.trace.events),[]);
    checks.push('Recarga durante el primer traslado: restaura resultado triple completo sin repetir captura ni celebración.'); await context.close();
  }
  assert.deepEqual(errors,[]); await writeFile(output+'/checks.json',JSON.stringify({ checks,errors },null,2)); console.log(JSON.stringify({ checks,errors },null,2));
} finally { if (browser) await browser.close(); server.kill(); await writeFile(output+'/server.log',log); }
