import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const output = 'work/victory-preview';
const vite = 'node_modules/vite/bin/vite.js';
const previewURL = 'http://127.0.0.1:5175/damas-spanish/';
const productionURL = 'http://127.0.0.1:5176/damas-spanish/';
await mkdir(output, { recursive: true });
const servers = [];
function start(args, name) {
  const process = spawn(globalThis.process.execPath, [vite, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  process.stdout.on('data', chunk => { log += chunk; });
  process.stderr.on('data', chunk => { log += chunk; });
  process.on('error', error => { log += String(error); });
  servers.push({ process, name, log: () => log });
  return process;
}
async function ready(url, server) {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Vite terminó antes de servir ' + url);
    try { if ((await fetch(url)).ok) return; } catch { /* Waiting for startup. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('No se pudo abrir ' + url);
}
async function compiledFiles(directory) {
  const all = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = directory + '/' + item.name;
    if (item.isDirectory()) all.push(...await compiledFiles(path));
    else all.push(path);
  }
  return all;
}
let browser;
const errors = [], checks = [];
try {
  // The special configuration must refuse building; default dist already exists.
  const blocked = spawnSync(process.execPath, [vite, 'build', '--config', 'vite.victory.config.ts'], { encoding: 'utf8' });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stdout + blocked.stderr, /no se puede compilar ni publicar/);
  checks.push('La configuración especial rechaza vite build.');
  for (const path of await compiledFiles('dist')) {
    assert.ok(!path.includes('/dev/'), 'Development file in dist: ' + path);
    if (/\.(html|js|css)$/.test(path)) {
      const content = await readFile(path, 'utf8');
      assert.ok(!content.includes('Prueba de victoria · Desarrollo'), path);
      assert.ok(!content.includes('victory-storage'), path);
    }
  }
  checks.push('El artefacto de producción no contiene la vista ni el almacén de prueba.');
  await ready(previewURL, start(['--config', 'vite.victory.config.ts', '--host', '127.0.0.1'], 'development'));
  await ready(productionURL, start(['preview', '--host', '127.0.0.1', '--port', '5176', '--strictPort'], 'production'));
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {})
  });
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
    recordVideo: { dir: output, size: { width: 820, height: 1180 } }
  });
  await context.addInitScript(() => {
    const board = Array(64).fill(null);
    for (let i = 0; i < 64; i++) {
      const row = Math.floor(i / 8);
      if ((row + i % 8) % 2 === 0 && (row < 3 || row > 4)) {
        board[i] = { color: row < 3 ? 'black' : 'white', king: false };
      }
    }
    const key = 'white:' + board.map(p => p ? (p.color === 'white' ? 'w' : 'b') : '.').join('');
    window.existingNormalSave = JSON.stringify({
      version: 1, game: { board, turn: 'white', positions: [key] }, from: null, path: [],
      testMarker: 'existing-game-do-not-touch'
    });
    if (location.protocol === 'http:' && !localStorage.getItem('damas-spanish.game.v1')) {
      localStorage.setItem('damas-spanish.game.v1', window.existingNormalSave);
    }
    window.starStarts = 0;
    document.addEventListener('animationstart', event => {
      if (event.animationName === 'gentle-stars') window.starStarts++;
    });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(previewURL);
  assert.match(await page.title(), /Prueba de victoria/);
  assert.equal(await page.locator('#board .piece').count(), 2);
  assert.equal(await page.locator('[data-square="36"] .piece.white').count(), 1);
  assert.equal(await page.locator('[data-square="27"] .piece.black').count(), 1);
  await page.screenshot({ path: output + '/01-position.png' });
  await page.locator('[data-square="36"]').click();
  await page.locator('[data-square="18"]').click();
  await page.waitForFunction(() => document.querySelector('.piece.moving'));
  assert.equal(await page.locator('#result').isVisible(), false);
  await page.waitForFunction(() => !document.querySelector('#result').hidden);
  assert.equal(await page.locator('#result-title').textContent(), '¡Has ganado!');
  assert.equal(await page.locator('#result-message').textContent(), '¡Muy bien jugado!');
  assert.equal(await page.getByRole('button').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Nueva partida' }).isEnabled(), true);
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#result-stars span').count(), 5);
  const stars = await page.locator('#result-stars span').first().evaluate(element => ({
    opacity: Number(getComputedStyle(element).opacity),
    duration: getComputedStyle(element).animationDuration
  }));
  assert.ok(stars.opacity > .3, 'Las estrellas deben ser visibles durante la celebración.');
  assert.equal(stars.duration, '2s');
  await page.screenshot({ path: output + '/02-victory.png' });
  await page.waitForTimeout(1600);
  assert.equal(await page.evaluate(() => window.starStarts), 5);
  checks.push('Captura real e4-c6, resultado después del salto y cinco estrellas animadas una sola vez.');
  assert.equal(await page.evaluate(() => localStorage.getItem('damas-spanish.game.v1')), await page.evaluate(() => window.existingNormalSave));
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.waitForFunction(() => !document.querySelector('#play-area').hidden);
  assert.equal(await page.locator('#restart-dialog').isVisible(), false);
  assert.equal(await page.locator('#board .piece').count(), 24);
  assert.equal(await page.locator('#status').textContent(), 'Tu turno · blancas');
  assert.equal(await page.evaluate(() => localStorage.getItem('damas-spanish.game.v1')), await page.evaluate(() => window.existingNormalSave));
  checks.push('Nueva partida reinicia directamente; la partida normal existente permanece intacta.');
  await page.reload();
  assert.equal(await page.locator('#board .piece').count(), 2);
  checks.push('Recargar reinicia únicamente el escenario en memoria.');
  const video = page.video();
  await context.close();
  if (video) { await video.saveAs(output + '/victory.webm'); await video.delete(); }

  const production = await browser.newContext({ serviceWorkers: 'block' });
  const publicPage = await production.newPage();
  publicPage.on('pageerror', error => errors.push(error.message));
  await publicPage.goto(productionURL + '?victory=1&scenario=victory');
  assert.equal(await publicPage.title(), 'Damas Españolas');
  assert.equal(await publicPage.locator('#board .piece').count(), 24);
  assert.equal(await publicPage.locator('#result').isVisible(), false);
  checks.push('Los parámetros URL no activan el escenario en el artefacto público.');
  await production.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors }, null, 2));
  await writeFile(output + '/checks.json', JSON.stringify({ checks, errors }, null, 2));
} finally {
  if (browser) await browser.close();
  for (const server of servers) {
    server.process.kill();
    await writeFile(output + '/' + server.name + '.log', server.log());
  }
}
