const CACHE = "afterimage-web-20261028-v1";
const CORE = [
  "./", "./index.html", "./style.css", "./app.js", "./manifest.webmanifest",
  "./vhs-leger.json", "./vhs-sale.json", "./vhs-detail.json",
  "./assets/effect-worker.worker-DNyaS0uN.js",
  "./assets/ntsc_rs_web_wrapper_bg-DfF4bjsS.wasm",
  "./assets/ntsc_rs_web_wrapper_relaxed_bg-BhghOWWO.wasm",
  "./icon-192.png", "./icon-512.png"
];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("afterimage-web-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
  if(!["document","script","style","manifest","image","worker",""].includes(req.destination))return;
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});
