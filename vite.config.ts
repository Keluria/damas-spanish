import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: '/damas-spanish/',
  plugins: [VitePWA({
    registerType: 'prompt',
    injectRegister: 'auto',
    includeAssets: ['icon.svg', 'apple-touch-icon.png'],
    manifest: {
      name: 'Damas Españolas', short_name: 'Damas', lang: 'es',
      description: 'Damas españolas para dos personas, con calma y sin distracciones.',
      start_url: '/damas-spanish/', scope: '/damas-spanish/',
      display: 'standalone', background_color: '#faf7ef', theme_color: '#234e46',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
      ]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,ico}'], navigateFallback: 'index.html' }
  })]
});
