"use strict";
// AFTERIMAGE WEB — Genuine ntsc-rs WASM, image processing entirely in browser.
// Engine assets: ntsc-rs/ntsc-rs-web (original MIT/Apache notices included).
(() => {
  const $ = id => document.getElementById(id);
  const NAMES = ["strength", "noise", "chroma", "tracking", "detail"];
  const DEFAULTS = {
    light: {strength:52,noise:38,chroma:48,tracking:23,detail:48},
    worn: {strength:82,noise:81,chroma:86,tracking:82,detail:44},
    etched: {strength:55,noise:40,chroma:55,tracking:28,detail:90},
  };
  const PRESET_FILES = {light:"vhs-leger.json",worn:"vhs-sale.json",etched:"vhs-detail.json"};
  const ACCEPT = /\.(png|jpe?g|webp|avif)$/i;
  const state = {
    ready:false,worker:null,rpcId:0,requests:new Map(),presets:{},
    files:[],active:-1,image:null,preset:"etched",controls:{...DEFAULTS.etched},
    revision:0,renderedRevision:-1,running:false,pending:false,view:"vhs",split:50,
    loading:0,error:null,folder:null,durationSamples:[],renderCount:0,uploadedBytes:0,
  };
  window.__afterimageWebQA = {
    get ready(){return state.ready},get renderCount(){return state.renderCount},
    get revision(){return state.revision},get renderedRevision(){return state.renderedRevision},
    get fileCount(){return state.files.length},get active(){return state.active},
    get error(){return state.error},get samples(){return [...state.durationSamples]},
    get uploadedBytes(){return state.uploadedBytes},get engine(){return "ntsc-rs-wasm-worker"},get wasmVariant(){return state.wasmVariant||"initializing"},
  };

  const status = (message) => {
    $("viewStatus").textContent=message;
    $("footerStatus").textContent=message;
  };
  const warn = (message) => {
    state.error=String(message);
    status("Erreur · "+String(message).slice(0,110));
    $("engineStatus").textContent="SIGNAL INDISPONIBLE";
    console.warn("AFTERIMAGE WEB:", message);
  };
  function rpc(type, message, transfer=[]) {
    const id=++state.rpcId;
    return new Promise((resolve,reject)=>{
      state.requests.set(id,{resolve,reject});
      state.worker.postMessage({type,message,id},transfer);
    });
  }
  async function initialize() {
    const paths=["./vhs-leger.json","./vhs-sale.json","./vhs-detail.json"];
    const [a,b,c]=await Promise.all(paths.map(p=>fetch(p).then(r=>{
      if(!r.ok)throw Error("Preset missing: "+p);return r.json();
    })));
    state.presets={light:a,worn:b,etched:c};
    let module=null;
    let wasmVariant="baseline";
    if(new URLSearchParams(location.search).get("wasm")!=="baseline"){
      try{
        const fast=await fetch("./assets/ntsc_rs_web_wrapper_relaxed_bg-BhghOWWO.wasm");
        if(fast.ok){module=await WebAssembly.compile(await fast.arrayBuffer());wasmVariant="relaxed SIMD";}
      }catch(_){}
    }
    if(!module){
      const response=await fetch("./assets/ntsc_rs_web_wrapper_bg-DfF4bjsS.wasm");
      if(!response.ok)throw Error("Binaire WebAssembly introuvable");
      module=await WebAssembly.compile(await response.arrayBuffer());
    }
    state.wasmVariant=wasmVariant;
    const w=new Worker("./assets/effect-worker.worker-DNyaS0uN.js");
    state.worker=w;
    w.addEventListener("message", e=>{
      const data=e.data;
      if(data.originId===null){if(data.type==="panicked")warn("Émulateur arrêté: "+data.message);return;}
      const request=state.requests.get(data.originId);
      if(!request)return;
      state.requests.delete(data.originId);
      if(data.type==="error")request.reject(new Error(String(data.message?.message||data.message)));
      else request.resolve(data);
    });
    w.addEventListener("error",e=>warn("Worker: "+e.message));
    const initialized=await rpc("init",{module});
    if(initialized.type!=="initialized")throw Error("Initialisation inattendue");
    state.ready=true;
    $("engineTag").classList.add("online");
    $("engineTag").innerHTML="<i></i> NTSC-RS · "+(state.wasmVariant==="relaxed SIMD"?"SIMD":"WASM");
    $("engineStatus").textContent="MOTEUR PRÊT";
    status("Moteur VHS prêt · traitement sur ton appareil");
    if(state.image)queueRender();
    await restoreFolder();
    if("serviceWorker" in navigator && (location.protocol==="https:"||["localhost","127.0.0.1"].includes(location.hostname))){
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    }
  }
  function adjustedSettings() {
    const base=structuredClone(state.presets[state.preset]);
    const v=k=>state.controls[k]/50;
    const strength=v("strength"),noise=v("noise"),chroma=v("chroma"),tracking=v("tracking"),detail=v("detail");
    for(const k of ["composite_noise_intensity","luma_noise_intensity","snow_intensity"]){
      base[k] = Number(base[k])*noise*strength;
    }
    base.composite_noise=base.composite_noise_intensity>0.00001;
    base.luma_noise=base.luma_noise_intensity>0.00001;
    base.chroma_noise_intensity*=chroma*strength;
    base.chroma_noise=base.chroma_noise_intensity>0.00001;
    base.vhs_chroma_loss*=chroma*strength;
    base.chroma_phase_noise_intensity*=chroma*strength;
    base.chroma_delay_horizontal+=(chroma-1)*1.1;
    for(const k of ["vhs_edge_wave","head_switching_horizontal_shift","tracking_noise_wave_intensity","tracking_noise_noise_intensity"]){
      base[k]*=tracking*strength;
    }
    base.head_switching=tracking>0.05&&strength>0;
    base.vhs_edge_wave_enabled=tracking>0.05&&strength>0;
    base.tracking_noise=Boolean(base.tracking_noise)&&tracking>0.25&&strength>0;
    base.vhs_sharpen*=detail;
    base.ringing_power*=Math.max(0.1,detail);
    base.vhs_sharpen_enabled=detail>0.01;
    if(strength===0){base.vhs_settings=false;base.ringing=false;base.tracking_noise=false;}
    return base;
  }
  function fit() {
    if(!state.image)return;
    const area=$("stage");
    const ratio=state.image.width/state.image.height;
    const w=Math.max(1,Math.min(area.clientWidth,area.clientHeight*ratio));
    const h=Math.max(1,w/ratio);
    const art=$("artwork");
    art.style.width=w+"px";art.style.height=h+"px";
  }
  function syncView() {
    const before=$("beforeCanvas"),cut=$("splitline");
    for(const button of document.querySelectorAll("[data-view]")){
      button.classList.toggle("active",button.dataset.view===state.view);
    }
    before.hidden=state.view==="vhs";
    cut.hidden=state.view!=="split";
    if(state.view==="split"){
      before.style.clipPath="inset(0 "+(100-state.split)+"% 0 0)";
      cut.style.left=state.split+"%";
      $("artwork").style.cursor="ew-resize";
    }else{
      before.style.clipPath="none";
      $("artwork").style.cursor="default";
    }
    $("osd").hidden=state.view==="original";
  }
  function queueRender() {
    if(!state.image)return;
    state.revision++;state.pending=true;
    $("exportBtn").disabled=true;
    if(state.ready){
      status("Émulation VHS…");
      if(!state.running)requestAnimationFrame(()=>void renderLoop());
    }
  }
  async function renderLoop() {
    if(state.running||!state.ready)return;
    state.running=true;
    try {
      while(state.pending&&state.image){
        state.pending=false;
        const current=state.revision;
        const image=state.image;
        const started=performance.now();
        if(state.controls.strength===0){
          if(current===state.revision){
            $("afterCanvas").getContext("2d").drawImage(image,0,0);
            state.renderedRevision=current;state.renderCount++;
            status("Original · intensité 0");
          }
          continue;
        }
        const settings=adjustedSettings();
        state.worker.postMessage({
          type:"update-settings",id:++state.rpcId,message:JSON.stringify(settings)
        });
        const frame=new VideoFrame(image,{timestamp:0});
        const answer=await rpc("render-frame-to-bitmap",{
          frame,resizeHeight:null,resizeFilter:2,effectEnabled:true,
          rotation:0,frameNum:0,padToEven:false,outputRect:null
        },[frame]);
        if(answer.type!=="rendered-frame-to-bitmap")throw Error("Réponse WASM invalide");
        const bitmap=answer.message;
        if(current===state.revision&&image===state.image){
          const canvas=$("afterCanvas");
          canvas.getContext("2d",{alpha:false}).drawImage(bitmap,0,0);
          state.renderedRevision=current;
          state.renderCount++;
          const ms=Math.round(performance.now()-started);
          state.durationSamples.push(ms);
          if(state.durationSamples.length>30)state.durationSamples.shift();
          status("VHS native prête · "+ms+" ms");
          $("engineStatus").textContent="NTSC ACTIF";
        }
        bitmap.close();
      }
    }catch(error){
      warn(error.message);
    }finally{
      state.running=false;
      if(state.pending&&state.image&&state.ready)requestAnimationFrame(()=>void renderLoop());
      else if(state.renderedRevision===state.revision)$("exportBtn").disabled=false;
    }
  }
  function updateControls() {
    for(const key of NAMES){
      $(key).value=String(state.controls[key]);
      $("v-"+key).textContent=String(state.controls[key]);
    }
    for(const button of document.querySelectorAll("[data-preset]")){
      const selected=button.dataset.preset===state.preset;
      button.classList.toggle("selected",selected);
      button.setAttribute("aria-pressed",String(selected));
    }
  }
  function setPreset(name) {
    if(!DEFAULTS[name])return;
    state.preset=name;
    state.controls={...DEFAULTS[name]};
    updateControls();
    queueRender();
    try{localStorage.setItem("afterimage-web-preset",name)}catch(_){}
  }
  function cleanupMedia() {
    for(const item of state.files){if(item.thumb)URL.revokeObjectURL(item.thumb)}
    state.files=[];state.active=-1;
  }
  function refreshGallery() {
    const strip=$("galleryStrip");strip.replaceChildren();
    $("galleryCount").textContent=String(state.files.length);
    $("pageCounter").textContent=String(Math.max(0,state.active+1)).padStart(2,"0")+" / "+String(state.files.length).padStart(2,"0");
    $("prevBtn").disabled=state.files.length<2;$("nextBtn").disabled=state.files.length<2;
    $("galleryHeading").textContent=state.files.length+" CAPTURES · NAVIGATION";
    for(const [i,item] of state.files.entries()){
      const b=document.createElement("button");
      b.className="tile"+(i===state.active?" active":"");
      b.title=item.name;b.setAttribute("aria-label","Ouvrir "+item.name);
      const img=document.createElement("img");img.src=item.thumb;img.loading="lazy";img.alt="";
      const caption=document.createElement("span");caption.textContent=String(i+1).padStart(2,"0");
      b.append(img,caption);
      b.onclick=()=>{void select(i);$("galleryPanel").hidden=true;};
      strip.append(b);
    }
  }
  async function select(i) {
    if(i<0||i>=state.files.length)return;
    const token=++state.loading;
    const item=state.files[i];
    $("engineStatus").textContent="DÉCODAGE PHOTO";
    try{
      const next=await createImageBitmap(item.file);
      if(token!==state.loading){next.close();return}
      if(state.image)state.image.close();
      state.image=next;state.active=i;
      $("fileName").textContent=item.name.toUpperCase();
      $("fileSize").textContent=next.width+" × "+next.height;
      $("empty").hidden=true;$("artwork").hidden=false;
      for(const id of ["beforeCanvas","afterCanvas"]){
        const cv=$(id);cv.width=next.width;cv.height=next.height;
      }
      $("beforeCanvas").getContext("2d",{alpha:false}).drawImage(next,0,0);
      fit();syncView();refreshGallery();queueRender();
    }catch(e){warn("Photo impossible à ouvrir : "+e.message)}
  }
  async function importFiles(files,{initial=false}={}) {
    const items=Array.from(files).filter(f=>f&&ACCEPT.test(f.name)&&f.size>0);
    if(!items.length){if(!initial)warn("Choisis une image PNG, JPEG, WebP ou AVIF");return}
    cleanupMedia();
    items.sort((a,b)=>b.lastModified-a.lastModified);
    state.files=items.slice(0,500).map(file=>({
      file,name:file.name,thumb:URL.createObjectURL(file),modified:file.lastModified
    }));
    refreshGallery();
    await select(0);
  }
  function toggleGallery(force) {
    const panel=$("galleryPanel");
    panel.hidden=typeof force==="boolean"?!force:!panel.hidden;
  }
  async function exportPNG() {
    if(!state.image||!state.ready)return;
    const target=state.revision;
    $("exportBtn").disabled=true;
    try{
      for(let i=0;i<400&&(state.renderedRevision!==target||state.running);i++){
        await new Promise(resolve=>setTimeout(resolve,30));
      }
      if(state.renderedRevision!==target)throw Error("Rendu pas encore prêt");
      const blob=await new Promise((resolve,reject)=>{
        $("afterCanvas").toBlob(b=>b?resolve(b):reject(Error("Encodage PNG impossible")),"image/png");
      });
      const source=state.files[state.active]?.name||"capture.png";
      const clean=source.replace(/\.[^.]+$/,"").replace(/[^\w-]/g,"_");
      const link=document.createElement("a"),url=URL.createObjectURL(blob);
      link.href=url;link.download=clean+"_"+state.preset+"_AFTERIMAGE.png";
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      status("PNG exporté · "+state.image.width+" × "+state.image.height);
    }catch(e){warn(e.message)}
    finally{$("exportBtn").disabled=state.renderedRevision!==state.revision}
  }
  function folderDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open("afterimage-web-folder",1);
      req.onupgradeneeded=()=>req.result.createObjectStore("handles");
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function saveFolder(handle){
    try{
      const db=await folderDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction("handles","readwrite");
        tx.objectStore("handles").put(handle,"photo-folder");
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
      db.close();
    }catch(_){}
  }
  async function loadSavedFolder(){
    try{
      const db=await folderDb();
      const handle=await new Promise(resolve=>{
        const tx=db.transaction("handles","readonly");
        const req=tx.objectStore("handles").get("photo-folder");
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);
      });
      db.close();return handle;
    }catch(_){return null}
  }
  async function readFolder(handle,requestPermission=false) {
    if(!handle)return;
    let allowed=await handle.queryPermission({mode:"read"});
    if(allowed!=="granted"){
      if(!requestPermission)return;
      allowed=await handle.requestPermission({mode:"read"});
      if(allowed!=="granted")return;
    }
    const files=[];
    for await(const entry of handle.values()){
      if(entry.kind==="file"&&ACCEPT.test(entry.name)){
        try{files.push(await entry.getFile())}catch(_){}
      }
      if(files.length>=500)break;
    }
    state.folder=handle;
    if(files.length){await importFiles(files);status(files.length+" photos · dossier connecté");}
    else status("Aucune image compatible dans ce dossier");
  }
  async function chooseFolder(){
    if(!window.showDirectoryPicker){
      status("Ce navigateur ne permet pas de connecter un dossier. Utilise Importer.");
      $("imageFiles").click();return;
    }
    try {
      const handle=await window.showDirectoryPicker({id:"afterimage-cp77",mode:"read"});
      await readFolder(handle,true);
      await saveFolder(handle);
    }catch(e){if(e.name!=="AbortError")warn(e.message)}
  }
  async function restoreFolder(){
    const handle=await loadSavedFolder();
    if(handle&&!state.files.length)await readFolder(handle,false);
  }
  function setView(view) {
    state.view=view;syncView();
  }
  let dragging=false;
  $("artwork").addEventListener("pointerdown",e=>{
    if(state.view!=="split")return;
    dragging=true;$("artwork").setPointerCapture(e.pointerId);
    updateSplit(e);
  });
  function updateSplit(e){
    if(!dragging)return;
    const rect=$("artwork").getBoundingClientRect();
    state.split=Math.max(0,Math.min(100,100*(e.clientX-rect.left)/rect.width));
    syncView();
  }
  $("artwork").addEventListener("pointermove",updateSplit);
  for(const t of ["pointerup","pointercancel"])$("artwork").addEventListener(t,()=>dragging=false);
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>setView(b.dataset.view));
  document.querySelectorAll("[data-preset]").forEach(b=>b.onclick=()=>setPreset(b.dataset.preset));
  NAMES.forEach(key=>$(key).addEventListener("input",e=>{
    state.controls[key]=Number(e.target.value);
    $("v-"+key).textContent=String(state.controls[key]);
    queueRender();
  }));
  $("importBtn").onclick=()=>$("imageFiles").click();
  $("emptyOpen").onclick=()=>$("imageFiles").click();
  $("folderBtn").onclick=()=>void chooseFolder();
  $("imageFiles").onchange=e=>{void importFiles(e.target.files);e.target.value=""};
  $("exportBtn").onclick=()=>void exportPNG();
  $("prevBtn").onclick=()=>void select((state.active-1+state.files.length)%state.files.length);
  $("nextBtn").onclick=()=>void select((state.active+1)%state.files.length);
  $("libraryBtn").onclick=()=>toggleGallery();
  $("closeGallery").onclick=()=>toggleGallery(false);
  $("refreshBtn").onclick=()=>{if(state.folder)void readFolder(state.folder,true);else toggleGallery(false)};
  $("advancedBtn").onclick=()=>$("advancedPanel").hidden=false;
  $("closeAdvanced").onclick=()=>$("advancedPanel").hidden=true;
  $("doneBtn").onclick=()=>$("advancedPanel").hidden=true;
  $("resetBtn").onclick=()=>setPreset(state.preset);
  let dragDepth=0;
  window.addEventListener("dragenter",e=>{e.preventDefault();dragDepth++;$("dropOverlay").hidden=false});
  window.addEventListener("dragover",e=>e.preventDefault());
  window.addEventListener("dragleave",e=>{e.preventDefault();dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$("dropOverlay").hidden=true});
  window.addEventListener("drop",e=>{
    e.preventDefault();dragDepth=0;$("dropOverlay").hidden=true;
    if(e.dataTransfer?.files?.length)void importFiles(e.dataTransfer.files);
  });
  window.addEventListener("resize",fit);
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){$("galleryPanel").hidden=true;$("advancedPanel").hidden=true;return}
    if(["INPUT","TEXTAREA","SELECT"].includes(e.target?.tagName))return;
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.key.toLowerCase()==="g")toggleGallery();
    else if(e.key==="ArrowLeft"&&state.files.length)void select((state.active-1+state.files.length)%state.files.length);
    else if(e.key==="ArrowRight"&&state.files.length)void select((state.active+1)%state.files.length);
  });
  try{
    const saved=localStorage.getItem("afterimage-web-preset");
    if(DEFAULTS[saved]){state.preset=saved;state.controls={...DEFAULTS[saved]}}
  }catch(_){}
  updateControls();syncView();
  void initialize().catch(e=>warn(e.message));
})();
