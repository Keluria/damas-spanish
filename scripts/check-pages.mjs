// Validate the built artifact, including Workbox's generated precache URLs.
// No browser, credentials, network or third-party dependencies are needed.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { runInNewContext } from 'node:vm';

const base = '/damas-spanish/';
const origin = 'https://keluria.github.io';
const site = new URL(base, origin);
const directory = resolve('dist');
const read = path => readFileSync(resolve(directory, path), 'utf8');
function asset(reference, relativeTo = site) {
  const url = new URL(reference, relativeTo);
  assert.equal(url.origin, origin, `Unexpected external asset: ${url}`);
  assert.ok(url.pathname.startsWith(base), `Asset outside Pages base: ${url}`);
  const file = resolve(directory, decodeURIComponent(url.pathname.slice(base.length)));
  assert.ok(file.startsWith(directory + sep), `Asset outside dist: ${file}`);
  assert.ok(statSync(file).isFile(), `Missing compiled asset: ${url}`);
  return url;
}
const html = read('index.html');
const links = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
assert.ok(links.includes(`${base}manifest.webmanifest`));
assert.ok(links.includes(`${base}registerSW.js`));
for (const link of links) asset(link);

const manifestURL = asset('manifest.webmanifest');
const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(new URL(manifest.start_url, manifestURL).href, site.href);
assert.equal(new URL(manifest.scope, manifestURL).href, site.href);
assert.equal(manifest.display, 'standalone');
for (const size of ['192x192', '512x512']) {
  const icon = manifest.icons.find(icon => icon.sizes === size && icon.type === 'image/png');
  assert.ok(icon, `Missing install icon: ${size}`);
  asset(icon.src, manifestURL);
}
asset('apple-touch-icon.png');

let registration;
runInNewContext(read('registerSW.js'), {
  navigator: { serviceWorker: { register: (url, options) => { registration = { url, options }; } } },
  window: { addEventListener: (event, callback) => { assert.equal(event, 'load'); callback(); } }
});
assert.ok(registration, 'Missing service worker registration');
assert.equal(registration.url, `${base}sw.js`);
assert.equal(registration.options.scope, base);
const workerURL = asset(registration.url);
let precache = [], fallback;
const define = (dependencies, factory) => {
  for (const dependency of dependencies) asset(`${dependency}.js`, workerURL);
  factory({
    precacheAndRoute: entries => { precache = entries; },
    cleanupOutdatedCaches() {},
    registerRoute() {},
    NavigationRoute: class {},
    createHandlerBoundToURL: url => { fallback = url; }
  });
};
runInNewContext(read('sw.js'), { self: { define, addEventListener() {} }, define });
assert.ok(precache.length > 0, 'Empty offline precache');
for (const entry of precache) asset(entry.url, workerURL);
for (const required of ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']) {
  assert.ok(precache.some(entry => entry.url === required), `Not precached: ${required}`);
}
assert.ok(precache.some(entry => entry.url.startsWith('assets/') && entry.url.endsWith('.js')));
assert.ok(precache.some(entry => entry.url.startsWith('assets/') && entry.url.endsWith('.css')));
assert.equal(fallback, 'index.html');
asset(fallback, workerURL);
console.log(`Pages/PWA OK: ${site.href}, manifest, icons, registration, navigation fallback and ${precache.length} precache entries.`);
