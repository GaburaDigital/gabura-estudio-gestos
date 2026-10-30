// Configuração do Vite. "base: './'" faz o site funcionar no GitHub Pages com qualquer nome de repositório.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  // versão da publicação: muda o cache do service worker a cada build
  define: { __VERSAO__: JSON.stringify(new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 12)) },
});
