/* Stadium Studio episode renderer: turns an episode recipe into a finished vertical MP4, with no editing app.
   A recipe (for example videos/01-msg-penn-station/cut.js) lists voice lines, then shots laid out against them:
     studio shots (a style, era, design layer and a camera move), photos (slow zoom), and video clips (Google Earth).
   Big captions are drawn on top and the voice lines are mixed into the soundtrack.
   Everything is built one frame at a time, like Render MP4, so it is smooth on any Mac.
   Use it from Chrome's console or have Claude run it:  await SS.episode.render(EPISODE)  */
(function(){
'use strict';
const R=SS.recorder, ST=SS.studio; if(!R||!R.frame||!ST) return;
const W=R.W, H=R.H, FPS=R.FPS, DISPLAY='"Big Shoulders","Barlow Condensed","Arial Narrow",Arial,sans-serif', MONO='"IBM Plex Mono",Menlo,monospace';
const out=document.createElement('canvas'); out.width=W; out.height=H; const ox=out.getContext('2d');
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2, lerp=(a,b,t)=>a+(b-a)*t, clamp01=x=>Math.max(0,Math.min(1,x));
const yieldNow=()=>new Promise(r=>{const c=new MessageChannel(); c.port1.onmessage=()=>r(); c.port2.postMessage(0);});
const status=window.__episode={stage:'idle',frame:0,frames:0,error:null};

/* ---------- loading voice, photos and clips ---------- */
async function loadVoice(urls,rate){
  const ac=new OfflineAudioContext(1,rate,rate);
  return Promise.all(urls.map(async u=>{const buf=await (await fetch(u)).arrayBuffer(); return ac.decodeAudioData(buf);}));
}
const loadImg=src=>new Promise((ok,no)=>{const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>no(new Error('photo not found: '+src)); i.src=src;});
// clips are loaded whole into memory first, so every frame can be reached (a simple local server can't stream partial files)
async function loadVideo(src){const r=await fetch(src); if(!r.ok) throw new Error('clip not found: '+src); const url=URL.createObjectURL(await r.blob());
  return new Promise((ok,no)=>{const v=document.createElement('video'); v.muted=true; v.preload='auto'; v.src=url;
    v.onloadeddata=()=>ok(v); v.onerror=()=>no(new Error('clip will not play: '+src));});}
const seek=(v,t)=>new Promise(r=>{if(Math.abs(v.currentTime-t)<1e-3) return r(); v.onseeked=()=>r(); v.currentTime=t;});

/* ---------- camera moves, relative to the style's own starting view ---------- */
// m = {orbit: degrees around the target, dolly: distance factor, lift: metres up, aim: [x,y,z] shift of target and camera, fov}
function camAt(P,m){
  const tgt=P.tgt.clone(), pos=P.pos.clone(); if(m.aim){const a=new THREE.Vector3(...m.aim); tgt.add(a); pos.add(a);}
  const off=pos.sub(tgt); if(m.orbit) off.applyAxisAngle(new THREE.Vector3(0,1,0),m.orbit*Math.PI/180);
  if(m.dolly) off.multiplyScalar(m.dolly); if(m.lift) off.y+=m.lift;
  return {o:P.o,pos:tgt.clone().add(off),tgt,fov:m.fov||P.fov,size:P.size&&m.dolly?P.size*m.dolly:P.size,zoom:1};
}
function mix(a,b,e){const k=new Set([...Object.keys(a),...Object.keys(b)]), m={};
  k.forEach(n=>{if(n==='aim'){const A=a.aim||[0,0,0],B=b.aim||[0,0,0]; m.aim=A.map((v,i)=>lerp(v,B[i],e));}
    else {const d=n==='dolly'?1:n==='fov'?null:0, A=a[n]!=null?a[n]:d, B=b[n]!=null?b[n]:d; m[n]=A==null?B:B==null?A:lerp(A,B,e);}});
  return m;}

/* ---------- drawing ---------- */
function cover(img,zoom,fx,fy){
  const iw=img.videoWidth||img.naturalWidth, ih=img.videoHeight||img.naturalHeight, s=Math.max(W/iw,H/ih)*zoom, w=iw*s, h=ih*s;
  ox.drawImage(img,(W-w)*(fx==null?.5:fx),(H-h)*(fy==null?.5:fy),w,h);
}
function text(str,x,y,o){
  ox.save(); ox.font=o.font; ox.textAlign=o.align||'center'; ox.textBaseline='middle'; ox.globalAlpha=o.alpha==null?1:o.alpha;
  if('letterSpacing' in ox) ox.letterSpacing=o.spacing||'0px';
  if(o.scale&&o.scale!==1){ox.translate(x,y); ox.scale(o.scale,o.scale); x=0; y=0;}
  ox.lineJoin='round'; ox.strokeStyle=o.stroke||'rgba(8,14,24,.85)'; ox.lineWidth=o.lw||12; ox.strokeText(str,x,y);
  ox.fillStyle=o.color||'#ffffff'; ox.fillText(str,x,y); ox.restore();
}
// a big caption pops in on a solid brand-cyan block (easy to read over anything), holds, then fades
function caption(c,t){
  const a=t-c.t0, b=c.t1-t; if(a<0||b<0) return; const pop=clamp01(a/.16), fade=clamp01(b/.2), s=.84+.16*ease(pop), fs=c.size||118;
  ox.save(); ox.globalAlpha=Math.min(pop,fade); ox.translate(W/2,H*(c.y||.72)); ox.scale(s,s);
  ox.font=`900 ${fs}px ${DISPLAY}`; if('letterSpacing' in ox) ox.letterSpacing='1px'; ox.textAlign='center'; ox.textBaseline='middle';
  const str=c.text.toUpperCase(), w=ox.measureText(str).width, padX=fs*.28, h=fs*1.12;
  ox.shadowColor='rgba(0,0,0,.35)'; ox.shadowBlur=18; ox.shadowOffsetY=6;
  ox.fillStyle=c.box||'#7ff6ff'; ox.beginPath(); ox.roundRect?ox.roundRect(-w/2-padX,-h/2,w+2*padX,h,fs*.16):ox.rect(-w/2-padX,-h/2,w+2*padX,h); ox.fill();
  ox.shadowColor='transparent'; ox.fillStyle=c.color||'#0b1220'; ox.fillText(str,0,fs*.04); ox.restore();
}

/* ---------- setting up a studio shot ---------- */
async function useStyle(k){if(ST.style().key!==k){ST.setStyle(k); for(let i=0;i<4;i++){ST.step(0); await yieldNow();}}}
async function stage(sh){
  // camFrom: start from another style's camera (so a night pass lines up exactly with the day shot)
  let P=null; if(sh.camFrom){await useStyle(sh.camFrom); P=ST.presetView();}
  await useStyle(sh.style);
  ST.setEra(sh.era||'today',true); for(let i=0;i<3;i++){ST.step(1/FPS); await yieldNow();}
  if(SS.layer) SS.layer.set(sh.layer||'off');
  P=P||ST.presetView();
  // centerOn: keep the camera's angle but aim it at the Garden (default), the block (V.cutBox) or any [x, z]
  const V=ST.venue(), c=sh.centerOn===false?null:Array.isArray(sh.centerOn)?sh.centerOn
    :sh.centerOn==='block'&&V.cutBox?[(V.cutBox[0]+V.cutBox[1])/2,(V.cutBox[2]+V.cutBox[3])/2]:[V.center.x,V.center.z];
  if(c&&!P.o){const d=new THREE.Vector3(c[0]-P.tgt.x,0,c[1]-P.tgt.z); P.pos.add(d); P.tgt.add(d);}
  return P;
}
// an overlay's strength over time: [[t, alpha], ...] with straight lines between
const curve=(pts,t)=>{if(t<=pts[0][0]) return pts[0][1]; for(let i=1;i<pts.length;i++) if(t<=pts[i][0]){const [a,x]=pts[i-1],[b,y]=pts[i]; return x+(y-x)*ease((t-a)/(b-a||1));} return pts[pts.length-1][1];};

/* ---------- the renderer ---------- */
// opts: {only: shot index (renders that one shot alone, no captions or voice), save: 'videos/...mp4'}
async function render(ep,opts){
  opts=opts||{}; status.stage='loading'; status.error=null;
  if(document.fonts) await Promise.all(['900 100px "Big Shoulders"','800 30px "Big Shoulders"','500 20px "IBM Plex Mono"'].map(f=>document.fonts.load(f).catch(()=>{})));
  const rate=48000, solo=opts.only!=null;
  const voice=await loadVoice(ep.voice.lines,rate);   // always loaded: the shots are timed to it
  // lay the voice lines end to end, with a short gap between them
  let t=ep.voice.start||.3; const L=voice.map(b=>{const s={start:t,end:t+b.duration}; t=s.end+(ep.voice.gap||.25); return s;});
  const plan=ep.build(L.length?L:ep.voice.guess);
  let shots=plan.shots; if(solo){const all=shots.concat(plan.extra||[]); shots=[typeof opts.only==='string'?all.find(x=>x.name===opts.only):all[opts.only]]; if(!shots[0]) throw new Error('no shot '+opts.only);}
  const total=shots.reduce((s,x)=>s+x.dur,0), N=Math.round(total*FPS);
  // media
  for(const sh of shots){if(sh.type==='photo') sh.img=await loadImg(sh.src); if(sh.type==='video') sh.vid=await loadVideo(sh.src); if(sh.overlay&&!solo) sh.ovid=await loadVideo(sh.overlay.src);}
  // encoders
  let cfg=null; for(const codec of ['avc1.640028','avc1.4d0028','avc1.42e028']){const c={codec,width:W,height:H,bitrate:12e6,framerate:FPS,avc:{format:'avc'}};
    try{if((await VideoEncoder.isConfigSupported(c)).supported){cfg=c; break;}}catch(e){}}
  if(!cfg) throw new Error('This browser has no H.264 video encoder');
  const withAudio=!solo&&voice.length>0;
  const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:W,height:H,frameRate:FPS},
    ...(withAudio?{audio:{codec:'aac',numberOfChannels:1,sampleRate:rate}}:{}),fastStart:'in-memory'});
  let err=null; const enc=new VideoEncoder({output:(c,m)=>muxer.addVideoChunk(c,m),error:e=>{err=e;}}); enc.configure(cfg);
  status.stage='rendering'; status.frames=N; status.frame=0;
  R.begin();
  try{
    let f=0, shotStart=0;
    for(const sh of shots){
      const n=Math.round(sh.dur*FPS); let P=null, events=(sh.events||[]).slice();
      if(sh.type==='studio') P=await stage(sh);
      for(let i=0;i<n;i++,f++){
        const lt=i/FPS, e=n>1?i/(n-1):1, gt=f/FPS;
        ox.globalAlpha=1; ox.fillStyle='#000'; ox.fillRect(0,0,W,H);
        if(sh.type==='studio'){
          if(sh.build){   // build-up: each part stays hidden until its time, then drops into place
            const V=ST.venue(); V.buildOff={}; V.buildHide=new Set();
            sh.build.forEach(b=>{const q=clamp01((lt-b.t)/(b.len||1.1)); if(q<=0) V.buildHide.add(b.g); else V.buildOff[b.g]=(1-ease(q))*(b.drop||70);
              if(b.g==='under'&&V.G.under) V.G.under.visible=q>0;});
            (sh.hide||[]).forEach(k=>{if(V[k]) V[k].visible=false;});
            if(sh.groundAt!=null&&V.cutHolder){const q=clamp01((lt-sh.groundAt)/1.1); V.cutHolder.visible=q>0; V.cutHolder.position.y=-(1-ease(q))*40;}
          }
          while(events.length&&events[0].t<=lt){const ev=events.shift(); if(ev.era) ST.setEra(ev.era,false); if(ev.layer&&SS.layer) SS.layer.set(ev.layer);}
          const cam=camAt(P,mix(sh.cam&&sh.cam.from||{},sh.cam&&sh.cam.to||{},sh.linear?e:ease(e)));
          ST.setView(cam); ox.drawImage(R.frame(1/FPS,lt+(sh.layerT0||0)),0,0);
          if(sh.ovid){const a=curve(sh.overlay.alpha,lt); if(a>.002){await seek(sh.ovid,Math.min(sh.ovid.duration-.001,lt)); ox.globalAlpha=a; ox.drawImage(sh.ovid,0,0,W,H); ox.globalAlpha=1;}}   // e.g. the night pass fading in and out
        } else if(sh.type==='photo'){
          cover(sh.img,lerp(sh.zoom?sh.zoom[0]:1,sh.zoom?sh.zoom[1]:1.08,e),sh.fx,sh.fy);
          if(sh.credit) text(sh.credit,W*.06,H*.775,{font:`500 22px ${MONO}`,align:'left',lw:5,color:'#e8f6ff'});
        } else if(sh.type==='video'){
          await seek(sh.vid,Math.min(sh.vid.duration-.001,(sh.from||0)+lt*(sh.speed||1)));
          if(sh.fit==='blur'){   // a wide clip: full width in the middle, a blurred copy behind it, so nothing (like a required credit) is cropped off
            ox.save(); ox.filter='blur(36px) brightness(.55)'; cover(sh.vid,1.15); ox.restore();
            const vw=sh.vid.videoWidth, vh=sh.vid.videoHeight, h=W*vh/vw; ox.drawImage(sh.vid,0,H*(sh.y||.42)-h/2,W,h);
          } else cover(sh.vid,1);
          if(sh.ovid){const a=curve(sh.overlay.alpha,lt); if(a>.002){await seek(sh.ovid,Math.min(sh.ovid.duration-.001,(sh.overlay.from||0)+lt*(sh.speed||1))); ox.globalAlpha=a; cover(sh.ovid,1); ox.globalAlpha=1;}}   // e.g. the realistic night half fading in
        } else {ox.fillStyle=sh.color||'#0b1220'; ox.fillRect(0,0,W,H);}
        if(sh.title) text(sh.title.text,W/2,H*(sh.title.y||.45),{font:`700 ${sh.title.size||96}px ${DISPLAY}`,spacing:'2px',alpha:clamp01(lt/.4)});
        if(sh.sub) text(sh.sub.text,W/2,H*(sh.sub.y||.52),{font:`500 ${sh.sub.size||30}px ${MONO}`,lw:6,alpha:clamp01((lt-.3)/.4),color:'#e8f6ff'});
        // fades between shots
        const fi=sh.fadeIn?clamp01(lt/sh.fadeIn):1, fo=sh.fadeOut?clamp01((sh.dur-lt)/sh.fadeOut):1, k=Math.min(fi,fo);
        if(k<1){ox.globalAlpha=1-k; ox.fillStyle='#000'; ox.fillRect(0,0,W,H); ox.globalAlpha=1;}
        if(!solo) (plan.captions||[]).forEach(c=>caption(c,gt));
        const vf=new VideoFrame(out,{timestamp:Math.round(f*1e6/FPS),duration:Math.round(1e6/FPS)});
        enc.encode(vf,{keyFrame:f%(FPS*2)===0}); vf.close(); if(err) throw err;
        while(enc.encodeQueueSize>6) await yieldNow();
        status.frame=f; if(f%10===0) await yieldNow();
      }
      if(sh.build){const V=ST.venue(); V.buildOff=null; V.buildHide=null; Object.values(V.G).forEach(g=>g.visible=true); (sh.hide||[]).forEach(k=>{if(V[k]) V[k].visible=true;}); if(V.cutHolder) V.cutHolder.position.y=0; ST.setEra(ST.venue().era||'today',true);}
      shotStart+=sh.dur;
    }
    await enc.flush(); if(err) throw err;
    // the soundtrack: every voice line placed at its start time
    if(withAudio){
      status.stage='audio';
      const len=Math.round(total*rate), mixd=new Float32Array(len);
      voice.forEach((b,k)=>{const d=b.getChannelData(0), o=Math.round(L[k].start*rate); for(let i=0;i<d.length&&o+i<len;i++) mixd[o+i]+=d[i]*(ep.voice.gain||1);});
      let aerr=null; const ae=new AudioEncoder({output:(c,m)=>muxer.addAudioChunk(c,m),error:e=>{aerr=e;}});
      ae.configure({codec:'mp4a.40.2',sampleRate:rate,numberOfChannels:1,bitrate:128000});
      for(let i=0;i<len;i+=1024){const part=mixd.subarray(i,Math.min(len,i+1024));
        const ad=new AudioData({format:'f32-planar',sampleRate:rate,numberOfFrames:part.length,numberOfChannels:1,timestamp:Math.round(i*1e6/rate),data:part});
        ae.encode(ad); ad.close(); if(aerr) throw aerr; if(ae.encodeQueueSize>20) await yieldNow();}
      await ae.flush(); ae.close();
    }
    muxer.finalize();
  } finally {try{enc.close();}catch(_){} R.end();}
  const blob=new Blob([muxer.target.buffer],{type:'video/mp4'});
  if(opts.save){status.stage='saving'; const r=await fetch('/save?path='+encodeURIComponent(opts.save),{method:'POST',body:blob}); if(!r.ok) throw new Error('save failed: '+r.status);}
  status.stage='done'; status.bytes=blob.size; status.seconds=total;
  return {blob,seconds:total,lines:L};
}
SS.episode={render,status};
})();
