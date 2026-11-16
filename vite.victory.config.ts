import { defineConfig, mergeConfig, type ConfigEnv } from 'vite';
import base from './vite.config';

export function victoryConfig({ command, isPreview }: ConfigEnv) {
  if (command !== 'serve' || isPreview) {
    throw new Error('La prueba de victoria solo se permite con npm run dev:victory; no se puede compilar ni publicar.');
  }
  // Resolve a local module URL without adding Node types to the browser project.
  // Keep Windows drive paths and UNC hosts valid as well as ordinary POSIX paths.
  const url = new URL('./dev/victory-storage.ts', import.meta.url);
  const pathname = decodeURIComponent(url.pathname);
  const storagePath = url.hostname ? '//' + url.hostname + pathname : pathname.replace(/^\/([A-Za-z]:\/)/, '$1');
  return mergeConfig(base, {
    server: { port: 5175, strictPort: true },
    resolve: { alias: [{ find: /^\.\/storage$/, replacement: storagePath }] },
    plugins: [{
      name: 'development-victory-preview',
      apply: 'serve',
      transformIndexHtml(html: string) {
        return html.replace('<title>Damas Españolas</title>', '<title>Prueba de victoria · Desarrollo</title>');
      }
    }]
  });
}
export default defineConfig(victoryConfig);
