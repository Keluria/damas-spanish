import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = 'work/drag-checks';
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5180', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let log = '', browser;
server.stdout.on('data', chunk => { log += chunk; }); server.stderr.on('data', chunk => { log += chunk; });
const checks = [], errors = [];
const url = 'http://127.0.0.1:5180/damas-spanish/';
const key = 'damas-spanish.game.v1';
async function ready() {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(log);
    try { if ((await fetch(url)).ok) return; } catch { /* Startup. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Preview not ready: ' + log);
}
async function fresh(options = {}) {
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, reducedMotion: 'no-preference', serviceWorkers: 'block', ...options });
  await context.addInitScript(() => {
    Math.random = () => 0;
    window.inputTrace = { writes: [], animations: [], captures: [] };
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'damas-spanish.game.v1') window.inputTrace.writes.push(JSON.parse(value));
      return set.call(this, key, value);
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(frames, options) {
      window.inputTrace.animations.push({ color: this.classList.contains('white') ? 'white' : 'black', duration: options.duration });
      return animate.call(this, frames, options);
    };
    const capture = Element.prototype.setPointerCapture;
    Element.prototype.setPointerCapture = function(id) { window.inputTrace.captures.push(id); return capture.call(this, id); };
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  return { page, context };
}
async function state(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }
async function raw(page) { return page.evaluate(key => localStorage.getItem(key), key); }
async function centre(page, square) {
  const r = await page.locator('#board > .cell').nth(square).boundingBox();
  assert.ok(r); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}
async function begin(page, source) {
  const start = await centre(page, source);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + 12, start.y - 12);
  await page.waitForFunction(() => document.querySelector('.drag-layer .piece'));
  return start;
}
async function finish(page, target) { await page.mouse.move(target.x, target.y, { steps: 8 }); await page.mouse.up(); }
async function settle(page) { await page.waitForFunction(() => !document.querySelector('.drag-layer') && !document.querySelector('#restart').disabled); }
async function fixture(page, pieces, turn = 'white', from = null, path = []) {
  await page.evaluate(({ pieces, turn, from, path, key }) => {
    const board = Array(64).fill(null);
    for (const [i, [color, king]] of Object.entries(pieces)) board[Number(i)] = { color, king };
    const position = turn + ':' + board.map(p => p ? (p.color === 'white' ? (p.king ? 'W' : 'w') : (p.king ? 'B' : 'b')) : '.').join('');
    localStorage.setItem(key, JSON.stringify({ version: 1, game: { board, turn, positions: [position] }, from, path }));
  }, { pieces, turn, from, path, key });
  await page.reload();
}
async function touch(session, type, point) {
  await session.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, id: 1, radiusX: 3, radiusY: 3 }] : [] });
}
try {
  await ready(); browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  {
    const { page, context } = await fresh();
    const target = await centre(page, 32), start = await begin(page, 41);
    assert.equal(await page.locator('[data-square="32"].destination').count(), 1);
    await page.evaluate(()=>{const id=window.inputTrace.captures.at(-1);document.querySelector('[data-square="16"]').dispatchEvent(new PointerEvent('lostpointercapture',{bubbles:true,pointerId:id}));});
    assert.equal(await page.locator('.drag-layer').count(),1);
    await page.mouse.move(start.x - 35, start.y - 35);
    await page.waitForFunction(({x, y}) => { const r = document.querySelector('.drag-layer .piece').getBoundingClientRect(); return Math.abs(r.x+r.width/2-x)<2 && Math.abs(r.y+r.height/2-y)<2; }, {x:start.x-35,y:start.y-35});
    assert.equal(await page.locator('#board .piece.white').count() + await page.locator('.drag-layer .piece.white').count(), 12);
    await page.screenshot({ path: output + '/following-pointer.png' });
    await finish(page, target); await settle(page);
    assert.equal((await state(page)).game.board[32]?.color, 'white');
    const trace = await page.evaluate(() => window.inputTrace);
    assert.equal(trace.animations.filter(a=>a.color==='white').length, 0);
    assert.equal(trace.writes.filter(s=>s.game.turn==='black').length, 1);
    assert.ok(trace.captures.length > 0);
    const machineSource=await centre(page,16), machineTarget=await centre(page,25);
    await page.mouse.move(machineSource.x,machineSource.y);await page.mouse.down();
    await page.mouse.move(machineTarget.x,machineTarget.y,{steps:4});
    assert.equal(await page.locator('.drag-layer').count(),0);await page.mouse.up();
    assert.equal((await page.evaluate(()=>window.inputTrace.captures)).length,trace.captures.length);
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Tu turno · blancas');
    assert.equal((await page.evaluate(()=>window.inputTrace.animations)).filter(a=>a.color==='black').length, 1);
    checks.push('Ratón: seguimiento real, destinos visibles, captura de puntero, una jugada y una respuesta IA; sin animación blanca duplicada.');
    await context.close();
  }
  for (const target of [33, 43, 'outside']) {
    const {page, context}=await fresh();
    if(target===43) await page.locator('[data-square="43"]').click();
    const before=await raw(page);
    await begin(page,41); await finish(page,target==='outside'?{x:3,y:3}:await centre(page,target));
    await settle(page); assert.equal(await raw(page),before);
    assert.equal(await page.locator('[data-square="41"] .piece.white').count(),1);
    const trace=await page.evaluate(()=>window.inputTrace);
    assert.equal(trace.animations.filter(a=>a.color==='white'&&a.duration===180).length,1);
    checks.push('Suelta inválida '+target+': retorno suave sin modificar partida ni selección.'); await context.close();
  }
  {
    const {page, context}=await fresh(); await fixture(page,{36:['white',false],27:['black',false]});
    await begin(page,36); await finish(page,await centre(page,18)); await settle(page);
    await page.waitForFunction(()=>!document.querySelector('#result').hidden);
    assert.equal(await page.locator('#result-title').textContent(),'¡Has ganado!');
    assert.equal((await state(page)).game.board[27],null);
    assert.equal((await page.evaluate(()=>window.inputTrace.animations)).filter(a=>a.color==='white').length,0);
    assert.equal(await page.getByRole('button').count(),1);
    await page.waitForTimeout(100); assert.equal(await page.locator('#result').isVisible(),true);
    await page.waitForTimeout(500);await page.screenshot({path:output+'/capture-victory.png'});
    checks.push('Captura por arrastre elimina la última negra y conserva la celebración, sin clic fantasma ni reinicio accidental.');await context.close();
  }
  {
    const {page,context}=await fresh();const start=await centre(page,41);
    await page.mouse.move(start.x,start.y);await page.mouse.down();
    await page.mouse.move(start.x+3,start.y+2);await page.mouse.up();
    assert.equal(await page.locator('.drag-layer').count(),0);
    assert.equal((await state(page)).from,41);assert.equal((await state(page)).game.turn,'white');
    checks.push('Temblor inferior al umbral: sigue siendo selección por pulsación, sin movimiento involuntario.');await context.close();
  }
  {
    const {page,context}=await fresh();const before=await raw(page), start=await centre(page,41);
    await page.mouse.move(start.x,start.y);await page.mouse.down();
    await page.keyboard.press('Escape');await page.mouse.up();await settle(page);
    assert.equal(await raw(page),before);
    checks.push('Escape antes del umbral cancela también el clic posterior, sin guardar una selección accidental.');await context.close();
  }
  {
    const {page,context}=await fresh();const pieces={54:['white',false],45:['black',false],27:['black',false]};
    await fixture(page,pieces);await begin(page,54);await finish(page,await centre(page,36));await settle(page);
    assert.deepEqual((await state(page)).path,[36]);assert.equal((await state(page)).game.turn,'white');
    await page.waitForTimeout(750);assert.deepEqual((await state(page)).path,[36]);
    await page.locator('[data-square="36"]').click();
    assert.equal((await state(page)).game.turn,'black');assert.deepEqual((await state(page)).path,[]);
    await fixture(page,pieces);await begin(page,54);await finish(page,await centre(page,36));await settle(page);
    await begin(page,36);assert.equal(await page.locator('[data-square="18"].destination').count(),1);
    await finish(page,await centre(page,18));await settle(page);
    assert.equal(await page.locator('#result-title').textContent(),'¡Has ganado!');
    assert.equal((await page.evaluate(()=>window.inputTrace.animations)).filter(a=>a.color==='white').length,0);
    checks.push('Cadena opcional: sin clic fantasma que termine el turno; permite parar tocando o continuar arrastrando desde la casilla actual.');await context.close();
  }
  {
    const {page, context}=await fresh(); await fixture(page,{0:['white',true],2:['black',false]});
    await begin(page,0); assert.equal(await page.locator('[data-square="54"].destination').count(),1);
    await finish(page,await centre(page,54));await settle(page);
    assert.equal((await state(page)).game.board[54]?.king,true);
    checks.push('Dama: desplazamiento diagonal largo hacia atrás por destino legal.');await context.close();
  }
  {
    const {page, context}=await fresh();
    await page.locator('[data-square="41"]').click();await page.locator('[data-square="32"]').click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('damas-spanish.game.v1')).game.turn==='black');
    assert.equal((await page.evaluate(()=>window.inputTrace.animations)).filter(a=>a.color==='white').length,1);
    assert.equal((await page.evaluate(()=>window.inputTrace.writes)).filter(s=>s.game.turn==='black').length,1);
    checks.push('Dos pulsaciones nativas conservadas, con una única animación y jugada.');await context.close();
  }
  {
    const {page,context}=await fresh();
    await page.locator('[data-square="41"]').focus();await page.locator('[data-square="41"]').press('Enter');
    await page.locator('[data-square="32"]').focus();await page.locator('[data-square="32"]').press('Space');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('damas-spanish.game.v1')).game.turn==='black');
    assert.equal((await state(page)).game.board[32]?.color,'white');
    checks.push('Teclado: selección con Enter y destino con Espacio.');await context.close();
  }
  {
    const {page,context}=await fresh();const before=await raw(page);await begin(page,41);
    await page.setViewportSize({width:820,height:1100});await settle(page);await page.mouse.up();
    assert.equal(await raw(page),before);
    await begin(page,41);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await settle(page);await page.mouse.up();
    assert.equal(await raw(page),before);
    await begin(page,41);
    await page.evaluate(()=>{const id=window.inputTrace.captures.at(-1);document.querySelector('#board').releasePointerCapture(id);});
    await page.mouse.move(300,400);await settle(page);await page.mouse.up();assert.equal(await raw(page),before);
    checks.push('Redimensionado/orientación, pérdida de foco y pérdida real de captura cancelan sin alterar el guardado.');await context.close();
  }
  {
    const {page,context}=await fresh({reducedMotion:'reduce'});const before=await raw(page);
    await begin(page,41);await finish(page,{x:3,y:3});await settle(page);
    assert.equal(await raw(page),before);assert.equal((await page.evaluate(()=>window.inputTrace.animations)).length,0);
    checks.push('Reducir movimiento: retorno instantáneo.');await context.close();
  }
  {
    const {page,context}=await fresh({hasTouch:true,isMobile:true,viewport:{width:820,height:650}});
    await page.evaluate(()=>scrollTo(0,150));const y=await page.evaluate(()=>scrollY);
    const session=await context.newCDPSession(page), start=await centre(page,41), end=await centre(page,32);
    await touch(session,'touchStart',start);await touch(session,'touchMove',{x:start.x-15,y:start.y-15});
    await page.waitForFunction(()=>document.querySelector('.drag-layer'));
    await touch(session,'touchMove',end);await touch(session,'touchEnd');await settle(page);
    assert.equal((await state(page)).game.board[32]?.color,'white');assert.equal(await page.evaluate(()=>scrollY),y);
    const oldY=await page.evaluate(()=>scrollY);
    await touch(session,'touchStart',{x:5,y:450});
    for(let i=1;i<=6;i++){await touch(session,'touchMove',{x:5,y:450-i*25});await page.waitForTimeout(25);}
    await touch(session,'touchEnd');await page.waitForTimeout(150);
    assert.ok(await page.evaluate(()=>scrollY)>oldY);
    checks.push('Táctil nativo: arrastre sin scroll del tablero y navegación normal en el margen exterior.');await context.close();
  }
  {
    const {page,context}=await fresh({hasTouch:true,isMobile:true}); const before=await raw(page), session=await context.newCDPSession(page), start=await centre(page,41);
    await touch(session,'touchStart',start);await touch(session,'touchMove',{x:start.x-20,y:start.y-20});await page.waitForFunction(()=>document.querySelector('.drag-layer'));
    await touch(session,'touchCancel');await settle(page);assert.equal(await raw(page),before);
    await page.locator('[data-square="41"]').tap();await page.locator('[data-square="32"]').tap();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('damas-spanish.game.v1')).game.turn==='black');
    checks.push('Pointercancel táctil restaura y permite después jugar por dos toques.');await context.close();
  }
  assert.deepEqual(errors,[]);await writeFile(output+'/checks.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
} finally {
  if(browser)await browser.close();server.kill();await writeFile(output+'/server.log',log);
}
