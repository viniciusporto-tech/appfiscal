// Nome da versão atual do cache. Troque o número quando quiser forçar atualização do cache.
const CACHE_NAME = "fiscalizacao-cabo-frio-v1";

// Páginas mínimas que queremos disponíveis mesmo com internet instável.
const STATIC_URLS = ["/", "/login", "/agente"];

// No evento de instalação, guardamos os arquivos essenciais no cache do navegador.
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_URLS)));
});

// No evento de ativação, removemos caches antigos para evitar ocupar espaço desnecessário.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
});

// Para requisições GET, tentamos internet primeiro e usamos cache quando a conexão falha.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
