/* Stadium Studio design layer: clean graphics drawn on top of the 3D picture.
   Glowing outlines, dimension lines, leader-line labels and flowing train lines, all placed in the scene so they
   follow the camera, and drawn on one after another when you pick a layer or start a recording.
   Each venue recipe lists its layers in V.layers (see venues/msg.js and venues/yankee.js). Every number comes from
   the venue's own data. The recorder draws the same layer into the video (engine/recorder.js). */
(function(){
'use strict';
const ST=window.SS&&SS.studio; if(!ST) return;
const $=id=>document.getElementById(id), scr=$('layer'), sx=scr.getContext('2d'), panel=$('rec'), box=$('layer-opts');
const C={cyan:'#7ff6ff',gold:'#ffd36b',white:'#ffffff',tide:'#4fb3ff'};
const col=c=>C[c||'cyan']||c;   // a named color or any hex, like an official subway line color
const DISPLAY='"Big Shoulders","Barlow Condensed","Arial Narrow",Arial,sans-serif', MONO='"IBM Plex Mono",Menlo,monospace';
const state={key:'off',t0:performance.now(),venue:null};
const v3=new THREE.Vector3(), clamp01=x=>Math.max(0,Math.min(1,x));
if(document.fonts) ['800 30px "Big Shoulders"','700 30px "Big Shoulders"','700 30px "Barlow Condensed"','600 17px "Barlow Condensed"','500 14px "IBM Plex Mono"'].forEach(f=>document.fonts.load(f));

const venue=()=>SS.VENUES[ST.style().venue];
const presets=()=>{const V=venue(); return ((V&&V.layers)||[]).filter(p=>!p.era||p.era===(V.era||'today'));};   // some sets belong to one era
const current=()=>presets().find(p=>p.key===state.key)||null;
function restart(){state.t0=performance.now();}
function setKey(k){state.key=k; restart(); buttons();}
function buttons(){
  box.textContent='';
  [{key:'off',name:'Off'},...presets()].forEach(p=>{const b=document.createElement('button'); b.type='button'; b.textContent=p.name;
    b.setAttribute('aria-pressed',String(p.key===state.key)); b.addEventListener('click',()=>setKey(p.key)); box.appendChild(b);});
}

/* ---------- placing things ---------- */
// a scene point to a pixel in a w x h frame; null when it's behind the camera.
// space 'world' means the point is in the venue's real-world map (Yankee Stadium's city), which is turned to fit the model
function px(p,w,h,space){
  v3.set(p[0],p[1],p[2]); if(space==='world'){const V=venue(); if(V&&V.world) v3.applyMatrix4(V.world.matrixWorld);}
  const n=ST.project(v3); if(n.z>1) return null; return [(n.x+1)/2*w,(1-n.y)/2*h];
}
const pxAll=(pts,f,space)=>pts.map(p=>px(p,f.w,f.h,space)).filter(Boolean);
// draw the first fraction (0 to 1) of a line through screen points; returns the point where it stops
function partial(ctx,pts,frac){
  if(pts.length<2) return pts[0]||null; const seg=[]; let L=0;
  for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); seg.push(d); L+=d;}
  let left=L*frac, end=pts[0]; ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length&&left>0;i++){const d=seg[i-1];
    if(d<=left){ctx.lineTo(pts[i][0],pts[i][1]); left-=d; end=pts[i];}
    else {const f=left/d; end=[pts[i-1][0]+(pts[i][0]-pts[i-1][0])*f,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*f]; ctx.lineTo(end[0],end[1]); left=0;}}
  ctx.stroke(); return end;
}
// a glowing colored line (outlines, train lines) or a crisp white one with a soft shadow (dimensions, leaders)
function glow(ctx,u,color,width,fn){ctx.save(); ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=width*u; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.shadowColor=color; ctx.shadowBlur=12*u; fn(); ctx.shadowBlur=4*u; fn(); ctx.restore();}
function crisp(ctx,u,width,fn){ctx.save(); ctx.strokeStyle=C.white; ctx.fillStyle=C.white; ctx.lineWidth=width*u; ctx.lineCap='round'; ctx.shadowColor='rgba(0,0,0,.55)'; ctx.shadowBlur=3*u; ctx.shadowOffsetY=u; fn(); ctx.restore();}
function words(ctx,u,str,x,y,o){
  ctx.save(); ctx.globalAlpha=o.alpha; ctx.font=o.font; ctx.textAlign=o.align||'left'; ctx.textBaseline='alphabetic';
  if('letterSpacing' in ctx) ctx.letterSpacing=o.spacing||'0px';
  const w=ctx.measureText(str).width;
  if(o.plate){   // a dark rounded plate behind the words, so white text reads over the bright model
    const fs=parseFloat((o.font.match(/([\d.]+)px/)||[0,16])[1]), px=.38*fs, al=o.align||'left', x0=al==='right'?x-w:al==='center'?x-w/2:x;
    ctx.save(); ctx.globalAlpha=o.alpha*.78; ctx.fillStyle='#0b1220'; ctx.beginPath(); (ctx.roundRect||function(a,b,c,d){this.rect(a,b,c,d);}).call(ctx,x0-px,y-fs*.95,w+2*px,fs*1.3,fs*.22); ctx.fill(); ctx.restore();}
  ctx.lineJoin='round'; ctx.strokeStyle='rgba(10,18,30,.62)'; ctx.lineWidth=(o.stroke||3)*u; ctx.strokeText(str,x,y); ctx.fillStyle=o.color||C.white; ctx.fillText(str,x,y);
  ctx.restore(); return w;
}
function ticks(ctx,u,a,b,len){const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=-dy/l*len*u,ny=dx/l*len*u;
  [a,b].forEach(p=>{ctx.beginPath(); ctx.moveTo(p[0]-nx,p[1]-ny); ctx.lineTo(p[0]+nx,p[1]+ny); ctx.stroke();});}
function arrowHead(ctx,u,from,to,size){const a=Math.atan2(to[1]-from[1],to[0]-from[0]),s=size*u;
  ctx.beginPath(); ctx.moveTo(to[0],to[1]); ctx.lineTo(to[0]-Math.cos(a-.45)*s,to[1]-Math.sin(a-.45)*s); ctx.lineTo(to[0]-Math.cos(a+.45)*s,to[1]-Math.sin(a+.45)*s); ctx.closePath(); ctx.fill();}
const dimFont=u=>`600 ${17*u}px ${DISPLAY}`;

/* ---------- the graphics ---------- */
const DRAW={
  // glowing outline: a circle (circle:[x,z,r]) or a footprint (pts:[[x,z],...]) at height y
  outline(ctx,it,p,f){
    let ring; if(it.circle){const [cx,cz,r]=it.circle; ring=[]; for(let i=0;i<=72;i++){const a=i/72*Math.PI*2; ring.push([cx+Math.cos(a)*r,it.y,cz+Math.sin(a)*r]);}}
    else {ring=it.pts.map(q=>[q[0],it.y,q[1]]); ring.push(ring[0]);}
    const s=pxAll(ring,f,it.space); glow(ctx,f.u,col(it.color),2.6,()=>partial(ctx,s,p));
  },
  // width line across the screen over a round building (c:[x,y,z], r), labeled above
  span(ctx,it,p,f){
    const [cx,cy,cz]=it.c, a=px([cx-f.side.x*it.r,cy,cz-f.side.z*it.r],f.w,f.h), b=px([cx+f.side.x*it.r,cy,cz+f.side.z*it.r],f.w,f.h); if(!a||!b) return;
    const m=[(a[0]+b[0])/2,(a[1]+b[1])/2], h=p/2;
    crisp(ctx,f.u,1.6,()=>{partial(ctx,[m,a],p); partial(ctx,[m,b],p); if(p>=1) ticks(ctx,f.u,a,b,6);});
    words(ctx,f.u,it.text,m[0],m[1]-10*f.u,{font:dimFont(f.u),align:'center',alpha:clamp01(h*2-.3),spacing:'1.4px'});
  },
  // height line at the left edge of a round building (c:[x,z], r, y0 to y1)
  height(ctx,it,p,f){
    const [cx,cz]=it.c, ox=cx-f.side.x*(it.r+10)+f.toward.x*8, oz=cz-f.side.z*(it.r+10)+f.toward.z*8;
    const a=px([ox,it.y0,oz],f.w,f.h), b=px([ox,it.y1,oz],f.w,f.h); if(!a||!b) return;
    crisp(ctx,f.u,1.6,()=>{partial(ctx,[a,b],p); if(p>=1) ticks(ctx,f.u,a,b,6);});
    words(ctx,f.u,it.text,a[0]-8*f.u,(a[1]+b[1])/2+5*f.u,{font:dimFont(f.u),align:'right',alpha:clamp01(p*2-1),spacing:'1.4px'});
  },
  // a measured line between two points (a, b), with its text near the far end
  dim(ctx,it,p,f){
    const a=px(it.a,f.w,f.h,it.space), b=px(it.b,f.w,f.h,it.space); if(!a||!b) return;
    crisp(ctx,f.u,1.8,()=>{partial(ctx,[a,b],p); if(p>=1) ticks(ctx,f.u,a,b,6);});
    const t=it.textAt||.82, x=a[0]+(b[0]-a[0])*t, y=a[1]+(b[1]-a[1])*t;
    words(ctx,f.u,it.text,x,y-12*f.u,{font:`700 ${22*f.u}px ${DISPLAY}`,align:'center',alpha:clamp01(p*2-1),spacing:'1px',stroke:4});
  },
  // a glowing line through points; flow:true makes dashes run along it like moving trains
  path(ctx,it,p,f){
    const s=pxAll(it.pts,f,it.space); if(s.length<2) return; const cl=col(it.color);
    if(it.flow){ctx.save(); ctx.globalAlpha=.2; ctx.strokeStyle=cl; ctx.lineWidth=7*f.u; ctx.lineCap='round'; partial(ctx,s,p); ctx.restore();
      glow(ctx,f.u,cl,3.2,()=>{ctx.setLineDash([14*f.u,16*f.u]); ctx.lineDashOffset=-f.t*42*f.u*(it.dir||1)+(it.phase||0)*f.u; partial(ctx,s,p);});}
    else glow(ctx,f.u,cl,it.width||2.6,()=>partial(ctx,s,p));
  },
  // an arrow dropping from a to b (street to tracks)
  drop(ctx,it,p,f){
    const a=px(it.a,f.w,f.h,it.space), b=px(it.b,f.w,f.h,it.space); if(!a||!b) return;
    glow(ctx,f.u,col(it.color),3,()=>{ctx.setLineDash([10*f.u,12*f.u]); ctx.lineDashOffset=-f.t*36*f.u; const e=partial(ctx,[a,b],p); ctx.setLineDash([]); if(p>.9&&e) arrowHead(ctx,f.u,a,e,11);});
  },

  // a depth ruler down a cut face: ticks every 10 ft from the street, and named marks (marks:[{y, text, color}])
  gauge(ctx,it,p,f){
    const [x,z]=it.at, top=px([x,0,z],f.w,f.h,it.space), bot=px([x,it.y1,z],f.w,f.h,it.space); if(!top||!bot) return;
    crisp(ctx,f.u,2,()=>{partial(ctx,[top,bot],p);});
    const ft=.3048, n=Math.floor(-it.y1/(10*ft));
    for(let i=0;i<=n;i++){const y=-i*10*ft, q=px([x,y,z],f.w,f.h,it.space); if(!q||i/n>p) continue; const L=(i%5===0?10:5)*f.u;
      crisp(ctx,f.u,1.4,()=>{ctx.beginPath(); ctx.moveTo(q[0]-L,q[1]); ctx.lineTo(q[0],q[1]); ctx.stroke();});
      if(i%5===0) words(ctx,f.u,`${i*10} FT`,q[0]-14*f.u,q[1]+4*f.u,{font:`600 ${13*f.u}px ${DISPLAY}`,align:'right',alpha:clamp01(p*2-1),spacing:'1px'});}
    (it.marks||[]).forEach((m,k)=>{const q=px([x,m.y,z],f.w,f.h,it.space); if(!q) return; const a=clamp01(p*2-1-k*.12);
      ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=col(m.color||'white'); ctx.beginPath(); ctx.arc(q[0],q[1],4*f.u,0,7); ctx.fill(); ctx.restore();
      words(ctx,f.u,m.text,q[0]+12*f.u,q[1]+5*f.u,{font:`700 ${15*f.u}px ${DISPLAY}`,alpha:a,spacing:'.8px',color:col(m.color||'white'),stroke:4});});
  },
  // a big number that counts up, with a caption and a source line, in one of the left-hand slots
  counter(ctx,it,p,f){
    const SLOT={top:.16,mid:.42,low:.64}, x=f.w*.06, y=f.h*(SLOT[it.slot]||.16), e=1-Math.pow(1-clamp01(p),3), v=Math.round(it.value*e);
    words(ctx,f.u,v.toLocaleString('en-US')+(it.suffix||''),x,y,{font:`700 ${64*f.u}px ${DISPLAY}`,alpha:clamp01(p*3),stroke:5,color:col(it.color||'white')});
    words(ctx,f.u,it.text,x,y+30*f.u,{font:`800 ${24*f.u}px ${DISPLAY}`,alpha:clamp01(p*2-.4),spacing:'.8px',stroke:4,plate:true});
    if(it.sub) words(ctx,f.u,it.sub,x,y+50*f.u,{font:`500 ${12.5*f.u}px ${MONO}`,alpha:clamp01(p*2-.8),color:'#e8f6ff',spacing:'.4px'});
  },
  // a round route badge (like a subway bullet) at a point: text inside, in the line's color
  badge(ctx,it,p,f){
    const q=px(it.p,f.w,f.h,it.space); if(!q) return; const r=(it.r||15)*f.u*Math.min(1,p*1.6);
    ctx.save(); ctx.globalAlpha=clamp01(p*2); ctx.fillStyle=col(it.color); ctx.shadowColor='rgba(0,0,0,.5)'; ctx.shadowBlur=4*f.u; ctx.beginPath(); ctx.arc(q[0],q[1],r,0,7); ctx.fill(); ctx.restore();
    if(p>.4) words(ctx,f.u,it.text,q[0],q[1]+r*.38,{font:`700 ${r*1.1}px Helvetica,Arial,sans-serif`,align:'center',alpha:clamp01(p*2-.6),stroke:0});
  },
  // the shadow clock: moves the real sun through a day (date:[y,m,d] in New York time, from/to in hours, secs for the sweep,
  // lat/lon of the place and grid = how its street grid is turned)
  // and shows the clock time, the sun's height and its path across the sky in the top-right corner
  sunclock(ctx,it,p,f){
    const k=clamp01((f.t-.3)/(it.secs||9)), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2, hr=it.from+(it.to-it.from)*e;
    const [y,mo,d]=it.date, S=SS.sunDir(SS.nyUTC(y,mo,d,hr),it.lat,it.lon,it.grid);
    f.sun=S;   // picked up after drawing, so the 3D sun follows the clock
    const h=Math.floor(hr), m=Math.floor((hr-h)*60), clock=`${(h%12)||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;
    const M=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'], A=clamp01(p*2);
    const xr=f.w*.94, yt=f.h*.14;
    words(ctx,f.u,clock,xr,yt,{font:`700 ${56*f.u}px ${DISPLAY}`,align:'right',alpha:A,stroke:5});
    words(ctx,f.u,`${M[mo-1]} ${d}, ${y}`,xr,yt+26*f.u,{font:`700 ${20*f.u}px ${DISPLAY}`,align:'right',alpha:A,spacing:'1px',stroke:4});
    words(ctx,f.u,S.alt>0?`SUN ${Math.round(S.alt)}° UP`:'SUN DOWN',xr,yt+46*f.u,{font:`500 ${12.5*f.u}px ${MONO}`,align:'right',alpha:A,color:'#e8f6ff'});
    // the sun's path: a dome from sunrise on the left to sunset on the right, with the sun on it
    const cw=150*f.u, ch=46*f.u, x0=xr-cw, yb=yt+100*f.u, peak=it.peak||32;
    ctx.save(); ctx.globalAlpha=A*.55; ctx.strokeStyle=C.white; ctx.lineWidth=1.2*f.u; ctx.setLineDash([3*f.u,5*f.u]);
    ctx.beginPath(); for(let i=0;i<=40;i++){const q=i/40; ctx.lineTo(x0+cw*q,yb-ch*Math.sin(Math.PI*q));} ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=A*.4; ctx.beginPath(); ctx.moveTo(x0-6*f.u,yb); ctx.lineTo(xr+6*f.u,yb); ctx.stroke(); ctx.restore();
    const sx2=x0+cw*e, sy=yb-ch*Math.max(-.15,Math.min(1.1,S.alt/peak));
    ctx.save(); ctx.globalAlpha=A; ctx.fillStyle=col('gold'); ctx.shadowColor=col('gold'); ctx.shadowBlur=14*f.u; ctx.beginPath(); ctx.arc(sx2,sy,7*f.u,0,7); ctx.fill(); ctx.restore();
    if(it.note) words(ctx,f.u,it.note,xr,yb+20*f.u,{font:`500 ${11*f.u}px ${MONO}`,align:'right',alpha:clamp01(p*2-.6),color:'#e8f6ff'});
  },
  // the weather on a recorded day (NOAA): a card in the top-right corner, and rain or snow only if that day had it
  // (day:{date, label, hi, lo, prcp, snow}). A dry day says DRY and stays clear.
  weather(ctx,it,p,f){
    const D=it.day, rain=+D.prcp>0&&!(+D.snow>0), snow=+D.snow>0, A=clamp01(p*2);
    if(rain||snow){const n=Math.round((snow?90:70)+Math.min(1,(+D.prcp||+D.snow/10))*500), a=clamp01(p*1.5);
      let sd=11; const r=()=>((sd=(sd*16807)%2147483647)/2147483647);
      ctx.save(); ctx.globalAlpha=a*.16; ctx.fillStyle='#1b2635'; ctx.fillRect(0,0,f.w,f.h); ctx.globalAlpha=a;
      ctx.strokeStyle='rgba(220,235,255,.55)'; ctx.fillStyle='rgba(255,255,255,.85)'; ctx.lineWidth=1.3*f.u;
      for(let i=0;i<n;i++){const x0=r()*f.w, sp=snow?(30+r()*40):(700+r()*500), y=((r()*f.h+f.t*sp*f.u)%(f.h+40*f.u))-20*f.u;
        if(snow){const x=x0+Math.sin(f.t*1.3+i)*8*f.u; ctx.beginPath(); ctx.arc(x,y,(1.2+r()*1.8)*f.u,0,7); ctx.fill();}
        else {ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x0-3*f.u,y+16*f.u); ctx.stroke();}}
      ctx.restore();}
    const M=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'], [y,mo,d]=D.date.split('-').map(Number), xr=f.w*.94, yt=f.h*.14;
    words(ctx,f.u,`${D.hi}°F`,xr,yt,{font:`700 ${64*f.u}px ${DISPLAY}`,align:'right',alpha:A,stroke:5});
    words(ctx,f.u,`LOW ${D.lo}°F · ${snow?`${D.snow} IN SNOW`:rain?`${D.prcp} IN RAIN`:'DRY'}`,xr,yt+28*f.u,{font:`700 ${20*f.u}px ${DISPLAY}`,align:'right',alpha:A,spacing:'1px',stroke:4,color:rain||snow?col('tide'):C.white});
    words(ctx,f.u,`${M[mo-1]} ${d}, ${y}`,xr,yt+52*f.u,{font:`700 ${17*f.u}px ${DISPLAY}`,align:'right',alpha:clamp01(p*2-.3),spacing:'1px',stroke:4});
    if(D.label) words(ctx,f.u,D.label.toUpperCase(),xr,yt+72*f.u,{font:`500 ${12*f.u}px ${MONO}`,align:'right',alpha:clamp01(p*2-.5),color:'#e8f6ff'});
    words(ctx,f.u,'NOAA DAILY RECORD · CENTRAL PARK',xr,yt+90*f.u,{font:`500 ${11*f.u}px ${MONO}`,align:'right',alpha:clamp01(p*2-.7),color:'#e8f6ff'});
  },
  // a title and fact lines in one of three safe spots on the left (top, mid, low), with a leader line to the point it names
  label(ctx,it,p,f){
    const anchor=px(it.p,f.w,f.h,it.space), SLOT={top:.16,mid:.42,low:.64}, x=f.w*.06, ly=f.h*(SLOT[it.slot]||.16);
    const tw=words(ctx,f.u,it.title,x,ly-8*f.u,{font:`800 ${(it.small?27:33)*f.u}px ${DISPLAY}`,alpha:clamp01(p*1.8-.8),spacing:'.6px',stroke:4,plate:true});
    (it.sub||[]).forEach((s,i)=>words(ctx,f.u,s,x,ly+24*f.u+i*23*f.u,{font:`500 ${14*f.u}px ${MONO}`,alpha:clamp01(p*1.8-.9-i*.15),color:'#e8f6ff',spacing:'.4px',plate:true}));
    if(!anchor) return; const ux=x+Math.max(tw,40*f.u), ex=Math.min(Math.max(anchor[0],ux),f.w*.92);
    crisp(ctx,f.u,1.4,()=>{partial(ctx,[anchor,[ex,ly],[x,ly]],clamp01(p*1.4)); ctx.beginPath(); ctx.arc(anchor[0],anchor[1],4*f.u,0,7); ctx.fill();});
  }
};

/* draw the chosen layer into any 2D canvas of size w x h, t seconds after it started */
function draw(ctx,w,h,t){
  const P=current(); if(!P||ST.style().S.sheet) return;
  const vw=ST.view(), d=vw.tgt.clone().sub(vw.pos), side=new THREE.Vector3(-d.z,0,d.x).normalize(), toward=new THREE.Vector3(-d.x,0,-d.z).normalize();
  const f={w,h,u:h/960,t,side,toward};
  // items draw on one after another; 'at' sets an exact start time and 'until' draws the item back off (build-up sequences)
  P.items.forEach((it,k)=>{let p=clamp01((t-(it.at!=null?it.at:.3+k*.28))/.7); if(it.until!=null&&t>it.until) p=Math.min(p,clamp01(1-(t-it.until)/.45)); if(p>0&&DRAW[it.type]) DRAW[it.type](ctx,it,p,f);});
  if(f.sun) ST.sunAt(f.sun);
}

// a new venue brings its own layer sets
function syncVenue(){const V=venue(), id=V&&(V.key+'|'+(V.era||'')); if(V&&id!==state.venue){state.venue=id; if(!presets().some(p=>p.key===state.key)) state.key='off'; buttons();}}
{const prev=ST.onStyle; ST.onStyle=S=>{if(prev) prev(S); syncVenue();};}
syncVenue();

/* the on-screen copy, shown while the recorder panel is open */
function tick(){
  requestAnimationFrame(tick);
  syncVenue();
  const c=ST.canvas, w=c.clientWidth, h=c.clientHeight, show=!panel.hidden&&state.key!=='off'&&!ST.style().S.sheet&&w>0;
  scr.hidden=!show; if(!show||!(current()||{items:[]}).items.some(it=>it.type==='sunclock')) ST.sunAt(null);   // the sun goes back when the clock is off
  if(!show) return;
  const dpr=Math.min(window.devicePixelRatio||1,2), W=Math.round(w*dpr), H=Math.round(h*dpr);
  if(scr.width!==W||scr.height!==H){scr.width=W; scr.height=H;}
  sx.setTransform(dpr,0,0,dpr,0,0); sx.clearRect(0,0,w,h); draw(sx,w,h,(performance.now()-state.t0)/1000);
}
requestAnimationFrame(tick);

SS.layer={draw,restart,active:()=>!state.mute&&state.key!=='off'&&!!current(),set:k=>{state.key=k||'off'; buttons();},mute:on=>{state.mute=!!on;}};   // mute: keep the set but leave it out of the 3D frame (drawn on top later)
})();
