/* Stadium Studio recorder: saves vertical 1080 x 1920 videos for TikTok, Reels and Shorts.
   Live take: records the screen while you drag (the browser's MediaRecorder), in real time.
   Planned move: you set a start and an end view; the engine draws every frame itself and the browser's
   video encoder (WebCodecs) packs them into an MP4 with mp4-muxer, so the result is always smooth.
   Only the 3D picture and its backdrop are recorded: panels, labels and guides stay off the video. */
(function(){
'use strict';
const ST=window.SS&&SS.studio; if(!ST) return;
const $=id=>document.getElementById(id), app=$('app');
const W=1080,H=1920,FPS=30;
const ui={open:$('rec-open'),panel:$('rec'),vert:$('rec-vert'),clean:$('rec-clean'),live:$('rec-live'),time:$('rec-time'),
  a:$('rec-a'),b:$('rec-b'),move:$('rec-move'),len:$('rec-len'),prev:$('rec-prev'),render:$('rec-render'),prog:$('rec-prog'),msg:$('rec-msg'),safe:$('safe')};
const say=t=>{ui.msg.textContent=t;};
const canLive=!!(window.MediaRecorder&&HTMLCanvasElement.prototype.captureStream);
const canRender=!!(window.VideoEncoder&&window.VideoFrame&&window.Mp4Muxer);
ui.open.hidden=false;

/* ---------- the video picture: the style's backdrop, then the 3D canvas on top ---------- */
const comp=document.createElement('canvas'); comp.width=W; comp.height=H;
const cx=comp.getContext('2d');
// the same backdrops as #stage in studio.css. r = [center x, center y, width radius, height radius] as fractions of the frame
const R4=[.5,.4,1.2,.95];
const BGS={
  day:{r:[.5,.32,1.2,.95],s:[[0,'#f5f7f9'],[.55,'#dfe5ec'],[1,'#c6ced8']]},
  night:{r:[.5,.38,1.1,.8],s:[[0,'#1c2a46'],[.55,'#0c1322'],[1,'#04060b']],stars:true},
  drawing:{l:[[0,'#b9bcc0'],[1,'#a3a7ac']]},
  wire:{l:[[0,'#4b4f56'],[.6,'#33363b'],[1,'#26282c']]},
  toy:{l:[[0,'#bfe0f7'],[.58,'#e2f0fb'],[1,'#f5f9fd']]},
  pastel:{l:[[0,'#f8d6c4'],[1,'#f4c4ad']]},
  road:{r:R4,s:[[0,'#fbfbfb'],[.6,'#eceeef'],[1,'#dcdfe2']]},
  white:{r:R4,s:[[0,'#ffffff'],[.7,'#f4f3f0'],[1,'#e9e7e2']]},
  cel:{r:R4,s:[[0,'#5f7586'],[.6,'#4b5f70'],[1,'#3d4f5e']]},
  pixel:{r:R4,s:[[0,'#4a6a84'],[.65,'#3b5870'],[1,'#2f485c']]},
  ink:{r:R4,s:[[0,'#f4ecdc'],[.7,'#e9dec7'],[1,'#dccfb4']]},
  studio:{fill:'studio',r:[.5,.42,1.1,.9],s:[[0,'rgba(255,255,255,.14)'],[.45,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.22)']]},
  bpsheet:{fill:'#1d3a68'}, blueprint:{fill:'#f3f6f9'}
};
const bgCache={};
function backdrop(key,studio){
  const id=key+'|'+studio; if(bgCache[id]) return bgCache[id];
  const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'), B=BGS[key]||BGS.day;
  if(B.fill){x.fillStyle=B.fill==='studio'?studio:B.fill; x.fillRect(0,0,W,H);}
  if(B.l){const g=x.createLinearGradient(0,0,0,H); B.l.forEach(([o,col])=>g.addColorStop(o,col)); x.fillStyle=g; x.fillRect(0,0,W,H);}
  if(B.r){const [px,py,rx,ry]=B.r; x.save(); x.translate(px*W,py*H); x.scale(rx*W/(ry*H),1);
    const g=x.createRadialGradient(0,0,0,0,0,ry*H); B.s.forEach(([o,col])=>g.addColorStop(o,col)); x.fillStyle=g; x.fillRect(-4*W,-4*H,8*W,8*H); x.restore();}
  if(B.stars){let s=7; const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
    for(let i=0;i<90;i++){x.fillStyle=`rgba(255,255,255,${.3+rnd()*.45})`; const r=.8+rnd()*1.2; x.beginPath(); x.arc(rnd()*W,rnd()*H*.55,r,0,6.283); x.fill();}}
  return bgCache[id]=c;
}
const FILTER={isoInk:'contrast(1.06) saturate(1.12)',isoCel:'saturate(1.06)'};   // the same CSS filters the page puts on these styles
function composite(){
  const s=ST.style(), src=ST.canvas;
  if(!s.post) cx.drawImage(backdrop(s.bg,s.studioBg),0,0);   // realistic styles paint their own sky, so the 3D picture is already opaque
  cx.filter=FILTER[s.key]||'none'; cx.imageSmoothingEnabled=!s.S.pixel;   // pixel art is drawn small, then scaled up with hard edges
  cx.drawImage(src,0,0,src.width,src.height,0,0,W,H); cx.filter='none';
}

/* ---------- saving ---------- */
function save(blob,ext,kind){
  const s=ST.style(), d=new Date(), p=n=>String(n).padStart(2,'0');
  const name=`${s.venue}-${s.key}-${kind}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
  const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  say(`Saved ${name} (${(blob.size/1e6).toFixed(1)} MB) to your Downloads folder.`);
}

/* ---------- panel and frame ---------- */
let busy=false, mr=null;
function setVertical(on){app.classList.toggle('vertical',on); ui.vert.setAttribute('aria-pressed',String(on)); ui.safe.hidden=!on; ST.refit();}
function ensureVertical(){if(!app.classList.contains('vertical')) setVertical(true);}
function setBusy(on){busy=on; [ui.vert,ui.a,ui.b,ui.move,ui.len,ui.prev,ui.render,ui.open].forEach(b=>b.disabled=on); ui.live.disabled=on&&!mr;}
ui.open.addEventListener('click',()=>{
  const open=ui.panel.hidden; ui.panel.hidden=!open; ui.open.setAttribute('aria-pressed',String(open));
  if(open){setVertical(ui.vert.getAttribute('aria-pressed')==='true'); syncStyle(ST.style().S);
    if(!ui.msg.textContent) say('Frame your shot inside the 9:16 box. The dashed areas are where the apps put their buttons and captions.');}
  else {if(mr) stopLive(); app.classList.remove('vertical','clean'); ui.safe.hidden=true; ui.clean.setAttribute('aria-pressed','false'); ST.refit();}   // keeps the Vertical frame choice for next time
});
ui.vert.addEventListener('click',()=>setVertical(!app.classList.contains('vertical')));
ui.clean.addEventListener('click',()=>{const on=app.classList.toggle('clean'); ui.clean.setAttribute('aria-pressed',String(on));});

// the blueprint is a still drawing, and a new venue makes saved views meaningless
let lastVenue=null;
function syncStyle(S){
  const sheet=!!S.sheet, v=ST.style().venue;
  if(v!==lastVenue){lastVenue=v; A=B=null; ui.a.setAttribute('aria-pressed','false'); ui.b.setAttribute('aria-pressed','false');}
  if(ui.panel.hidden) return;
  [ui.live,ui.a,ui.b,ui.prev,ui.render,ui.vert].forEach(b=>b.disabled=sheet||busy);
  if(sheet){if(mr) stopLive(); app.classList.remove('vertical'); ui.safe.hidden=true; ST.refit(); say('The blueprint sheet is a still drawing, so it can\'t be recorded. Pick another style.');}
  else if(ui.vert.getAttribute('aria-pressed')==='true'&&!app.classList.contains('vertical')){setVertical(true); say('');}
  if(!canLive) ui.live.disabled=true;
  if(!canRender) ui.render.disabled=true;
}
ST.onStyle=syncStyle;

/* ---------- live take ---------- */
let chunks=[], t0=0, timer=null;
ui.live.addEventListener('click',()=>mr?stopLive():startLive());
function startLive(){
  if(busy||!canLive) return;
  ensureVertical(); ST.setSize(W,H); app.classList.add('recording'); composite(); ST.onFrame=composite;
  const mime=['video/mp4;codecs=avc1.640028','video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'';
  try{mr=new MediaRecorder(comp.captureStream(FPS),mime?{mimeType:mime,videoBitsPerSecond:12e6}:{videoBitsPerSecond:12e6});}
  catch(e){endLive(); say('This browser could not start recording: '+e.message); return;}
  chunks=[];
  mr.ondataavailable=e=>{if(e.data&&e.data.size) chunks.push(e.data);};
  mr.onstop=()=>{const type=mr.mimeType||mime||'video/webm'; if(chunks.length) save(new Blob(chunks,{type}),type.includes('mp4')?'mp4':'webm','live'); else say('Nothing was recorded.'); endLive();};
  mr.start(1000); t0=performance.now();
  timer=setInterval(()=>{const s=Math.floor((performance.now()-t0)/1000); ui.time.textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;},250);
  setBusy(true); ui.live.textContent='■ Stop and save'; ui.live.classList.add('stop'); ui.live.disabled=false;
  say(mime.includes('mp4')?'Recording. Drag, zoom or switch styles, then press Stop.':'Recording as WebM (this browser can\'t record MP4 live). Planned moves always save MP4.');
}
function stopLive(){if(mr&&mr.state!=='inactive') mr.stop();}
function endLive(){
  clearInterval(timer); ST.onFrame=null; ST.setSize(null); app.classList.remove('recording'); mr=null;
  ui.live.textContent='● Start recording'; ui.live.classList.remove('stop'); ui.time.textContent='0:00'; setBusy(false); syncStyle(ST.style().S);
}

/* ---------- planned move ---------- */
let A=null,B=null;
ui.a.addEventListener('click',()=>{A=ST.view(); ui.a.setAttribute('aria-pressed','true'); say(ui.move.value==='ab'?'Start saved. Move the camera, then press Set end.':'Start saved. Orbits turn around the spot the camera is looking at.');});
ui.b.addEventListener('click',()=>{B=ST.view(); ui.b.setAttribute('aria-pressed','true'); say('End saved. Press Preview to watch the move, or Render MP4 to save it.');});
const ease=t=>.5-.5*Math.cos(Math.PI*t);   // slow in, slow out
const sph=v=>new THREE.Spherical().setFromVector3(v.pos.clone().sub(v.tgt));
// glide between two views around the target, so the camera curves instead of cutting straight through the building
function between(a,b,e){
  const s0=sph(a), s1=sph(b); let dth=s1.theta-s0.theta; dth=Math.atan2(Math.sin(dth),Math.cos(dth));
  const tgt=a.tgt.clone().lerp(b.tgt,e), s=new THREE.Spherical(s0.radius*Math.pow(s1.radius/s0.radius,e),s0.phi+(s1.phi-s0.phi)*e,s0.theta+dth*e);
  return {o:a.o,pos:new THREE.Vector3().setFromSpherical(s).add(tgt),tgt,fov:a.fov+(b.fov-a.fov)*e,zoom:a.zoom*Math.pow(b.zoom/a.zoom,e),size:a.size};
}
function orbit(a,ang){const s=sph(a); s.theta+=ang; return Object.assign({},a,{pos:new THREE.Vector3().setFromSpherical(s).add(a.tgt),tgt:a.tgt.clone()});}
function plan(){
  const mv=ui.move.value, sec=+ui.len.value;
  if(mv==='ab'){
    if(!A||!B){say('Set a start and an end first: frame the first view, press Set start, move the camera, press Set end.'); return null;}
    if(A.o!==B.o){say('The start and end use different camera types (flat iso views versus normal views). Set both in the same style.'); return null;}
    return {sec,kind:'move',at:e=>between(A,B,ease(e))};
  }
  const deg=+mv.slice(1), a=A||ST.view(), loop=Math.abs(deg)===360;
  return {sec,loop,kind:'orbit'+Math.abs(deg),at:e=>orbit(a,deg*Math.PI/180*(loop?e:ease(e)))};
}
ui.prev.addEventListener('click',()=>{
  if(busy) return; const p=plan(); if(!p) return; ensureVertical(); let t=0; ST.setControls(false); setBusy(true); say('Previewing the move. This is not saved.');
  ST.REC.driver=dt=>{t+=dt/p.sec; ST.setView(p.at(Math.min(1,t))); if(t>=1){ST.REC.driver=null; ST.setControls(true); setBusy(false); syncStyle(ST.style().S); say('Preview done. Press Render MP4 to save it.');}};
});
ui.render.addEventListener('click',renderMove);
async function renderMove(){
  if(busy) return; if(!canRender){say('Planned moves need a browser with a video encoder: use Google Chrome.'); return;}
  const p=plan(); if(!p) return;
  let cfg=null;
  for(const codec of ['avc1.640028','avc1.4d0028','avc1.42e028']){
    const c={codec,width:W,height:H,bitrate:12e6,framerate:FPS,avc:{format:'avc'}};
    try{if((await VideoEncoder.isConfigSupported(c)).supported){cfg=c; break;}}catch(e){}
  }
  if(!cfg){say('This browser can\'t make MP4 video. Try Google Chrome.'); return;}
  ensureVertical(); setBusy(true); ui.prog.hidden=false; ui.prog.value=0;
  const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:W,height:H,frameRate:FPS},fastStart:'in-memory'});
  let encErr=null; const enc=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:e=>{encErr=e;}}); enc.configure(cfg);
  const N=Math.round(p.sec*FPS), back=ST.view();
  ST.REC.paused=true; ST.setControls(false); ST.setSize(W,H); ST.REC.clock=Date.now()/1000;
  try{
    for(let i=0;i<N;i++){
      const e=p.loop?i/N:(N>1?i/(N-1):1);   // a 360 orbit stops one frame short of the start, so the video loops without a stutter
      ST.REC.driver=()=>ST.setView(p.at(e));
      ST.step(1/FPS); ST.REC.clock+=1/FPS; composite();
      const vf=new VideoFrame(comp,{timestamp:Math.round(i*1e6/FPS),duration:Math.round(1e6/FPS)});
      enc.encode(vf,{keyFrame:i%(FPS*2)===0}); vf.close();
      if(encErr) throw encErr;
      while(enc.encodeQueueSize>6) await new Promise(r=>setTimeout(r,5));
      if(i%5===0){ui.prog.value=i/N; say(`Rendering frame ${i+1} of ${N}…`); await new Promise(r=>setTimeout(r,0));}
    }
    await enc.flush(); if(encErr) throw encErr; muxer.finalize();
    ui.prog.value=1; save(new Blob([muxer.target.buffer],{type:'video/mp4'}),'mp4',p.kind);
  }catch(e){say('The render stopped ('+(e&&e.message||e)+'). Nothing was saved.');}
  finally{
    try{enc.close();}catch(_){}
    ST.REC.driver=null; ST.REC.clock=null; ST.setSize(null); ST.setView(back); ST.REC.paused=false; ST.setControls(true);
    ui.prog.hidden=true; setBusy(false); syncStyle(ST.style().S);
  }
}
if(!canLive&&!canRender) say('This browser can\'t record video. Open Stadium Studio in Google Chrome.');
})();
