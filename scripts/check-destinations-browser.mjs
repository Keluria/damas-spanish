import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

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
async function fresh({ black = [45,27,9], king = false, reduced = false, video = false } = {}) {
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
  await page.evaluate(({ black, king, key }) => {
    const board = Array(64).fill(null); board[54] = { color: 'white', king };
    for (const i of black) board[i] = { color: 'black', king: false };
    const position = 'white:' + board.map(p => p ? p.color === 'white' ? p.king ? 'W' : 'w' : 'b' : '.').join('');
    localStorage.setItem(key, JSON.stringify({ version: 1, game: { board, turn: 'white', positions: [position] }, from: null, path: [] }));
  }, { black, king, key });
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
    const { page, context } = await fresh({ video: true });
    await cell(page,54).click();
    for (const i of [36,18,0]) assert.match(await cell(page,i).getAttribute('class'), /destination/);
    await cell(page,0).click();
    await page.waitForFunction(() => document.querySelector('.captured-travelling'));
    assert.equal(await page.locator('#restart').isDisabled(), true);
    assert.equal(await page.locator('#result').isVisible(), false);
    const durable = await state(page); assert.equal(durable.captured.length,3); assert.deepEqual(durable.game.board[0],{ color:'white',king:true });
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
    const saved = await state(page); assert.equal(saved.game.turn,'black'); assert.equal(saved.captured.length,2); assert.ok(saved.game.board[9]); assert.ok(saved.game.board[18]);
    assert.deepEqual(await page.evaluate(() => window.trace.events),[]);
    checks.push('Destino doble intermedio: termina voluntariamente dejando la tercera rival; reducción de movimiento instantánea.'); await context.close();
  }
  {
    const { page, context } = await fresh(); await cell(page,54).click(); await cell(page,36).click(); await idle(page);
    assert.deepEqual((await state(page)).path,[36]);
    await cell(page,36).click(); assert.equal((await state(page)).captured.length,1); assert.equal((await state(page)).game.turn,'black');
    checks.push('Por etapas: primer salto y parada voluntaria tocando de nuevo la ficha, sin continuación obligatoria.'); await context.close();
  }
  {
    const { page, context } = await fresh({ black:[18,20,22,32,45],king:true });
    await cell(page,54).click(); await cell(page,9).click(); await idle(page);
    ordered((await page.evaluate(() => window.trace)).events,['54','27'],['45','18']);
    assert.equal((await state(page)).captured.length,2);
    checks.push('Rutas equivalentes: elección numérica predecible 54–27–9.'); await context.close();
  }
  {
    const { page, context } = await fresh({ black:[11,13,29,45,47],king:true }); await cell(page,54).click();
    assert.doesNotMatch(await cell(page,22).getAttribute('class'),/destination/);
    const before = await state(page); await cell(page,22).click(); assert.deepEqual(await state(page),before);
    await drag(page,54,22); await idle(page); assert.deepEqual(await state(page),before);
    await cell(page,36).click(); await idle(page); await cell(page,22).click(); await idle(page);
    assert.equal((await state(page)).captured.length,2);
    checks.push('Destino ambiguo: no se resalta ni admite arrastre/pulsación arbitrarios; elegir la primera etapa desambigua.'); await context.close();
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
