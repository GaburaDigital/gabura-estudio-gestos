// Service worker do Estúdio de Gestos: guarda os arquivos para funcionar sem internet depois da primeira visita.
// A versão do cache vem do endereço (sw.js?v=...), que muda a cada publicação; ao ativar, os caches antigos são apagados.
const VERSAO = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'estudio-gestos-' + VERSAO;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './configs/exemplo_basico.json'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('estudio-gestos-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primeiro a rede (para pegar a versão nova); sem internet, o que está guardado.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
});
