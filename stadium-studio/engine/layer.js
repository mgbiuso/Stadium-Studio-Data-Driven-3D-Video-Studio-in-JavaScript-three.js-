/* Stadium Studio design layer: clean graphics drawn on top of the 3D picture.
   Glowing outlines, dimension lines, leader-line labels and flowing train lines, all placed in the scene so they
   follow the camera, and drawn on one after another when you pick a layer or start a recording.
   Each venue recipe lists its layers in V.layers (see venues/msg.js and venues/yankee.js). Every number comes from
   the venue's own data. The recorder draws the same layer into the video (engine/recorder.js). */
(function(){
'use strict';
const ST=window.SS&&SS.studio; if(!ST) return;
const $=id=>document.getElementById(id), scr=$('layer'), sx=scr.getContext('2d'), panel=$('rec'), box=$('layer-opts');
const C={cyan:'#7ff6ff',gold:'#ffd36b',white:'#ffffff'};
const DISPLAY='"Barlow Condensed","Arial Narrow",Arial,sans-serif', MONO='"IBM Plex Mono",Menlo,monospace';
const state={key:'off',t0:performance.now(),venue:null};
const v3=new THREE.Vector3(), clamp01=x=>Math.max(0,Math.min(1,x));
if(document.fonts) ['700 30px "Barlow Condensed"','600 17px "Barlow Condensed"','500 14px "IBM Plex Mono"'].forEach(f=>document.fonts.load(f));

const venue=()=>SS.VENUES[ST.style().venue];
const presets=()=>{const V=venue(); return (V&&V.layers)||[];};
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
  ctx.lineJoin='round'; ctx.strokeStyle='rgba(10,18,30,.62)'; ctx.lineWidth=(o.stroke||3)*u; ctx.strokeText(str,x,y); ctx.fillStyle=o.color||C.white; ctx.fillText(str,x,y);
  const w=ctx.measureText(str).width; ctx.restore(); return w;
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
    const s=pxAll(ring,f,it.space); glow(ctx,f.u,C[it.color||'cyan'],2.6,()=>partial(ctx,s,p));
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
    const s=pxAll(it.pts,f,it.space); if(s.length<2) return; const col=C[it.color||'cyan'];
    if(it.flow){ctx.save(); ctx.globalAlpha=.2; ctx.strokeStyle=col; ctx.lineWidth=7*f.u; ctx.lineCap='round'; partial(ctx,s,p); ctx.restore();
      glow(ctx,f.u,col,3.2,()=>{ctx.setLineDash([14*f.u,16*f.u]); ctx.lineDashOffset=-f.t*42*f.u*(it.dir||1)+(it.phase||0)*f.u; partial(ctx,s,p);});}
    else glow(ctx,f.u,col,2.6,()=>partial(ctx,s,p));
  },
  // an arrow dropping from a to b (street to tracks)
  drop(ctx,it,p,f){
    const a=px(it.a,f.w,f.h,it.space), b=px(it.b,f.w,f.h,it.space); if(!a||!b) return;
    glow(ctx,f.u,C[it.color||'cyan'],3,()=>{ctx.setLineDash([10*f.u,12*f.u]); ctx.lineDashOffset=-f.t*36*f.u; const e=partial(ctx,[a,b],p); ctx.setLineDash([]); if(p>.9&&e) arrowHead(ctx,f.u,a,e,11);});
  },
  // a title and fact lines in one of three safe spots on the left (top, mid, low), with a leader line to the point it names
  label(ctx,it,p,f){
    const anchor=px(it.p,f.w,f.h,it.space), SLOT={top:.16,mid:.42,low:.64}, x=f.w*.06, ly=f.h*(SLOT[it.slot]||.16);
    const tw=words(ctx,f.u,it.title,x,ly-8*f.u,{font:`700 ${(it.small?25:30)*f.u}px ${DISPLAY}`,alpha:clamp01(p*1.8-.8),spacing:'.6px',stroke:4});
    (it.sub||[]).forEach((s,i)=>words(ctx,f.u,s,x,ly+22*f.u+i*21*f.u,{font:`500 ${13.5*f.u}px ${MONO}`,alpha:clamp01(p*1.8-.9-i*.15),color:'#e8f6ff',spacing:'.4px'}));
    if(!anchor) return; const ux=x+Math.max(tw,40*f.u), ex=Math.min(Math.max(anchor[0],ux),f.w*.92);
    crisp(ctx,f.u,1.4,()=>{partial(ctx,[anchor,[ex,ly],[x,ly]],clamp01(p*1.4)); ctx.beginPath(); ctx.arc(anchor[0],anchor[1],4*f.u,0,7); ctx.fill();});
  }
};

/* draw the chosen layer into any 2D canvas of size w x h, t seconds after it started */
function draw(ctx,w,h,t){
  const P=current(); if(!P||ST.style().S.sheet) return;
  const vw=ST.view(), d=vw.tgt.clone().sub(vw.pos), side=new THREE.Vector3(-d.z,0,d.x).normalize(), toward=new THREE.Vector3(-d.x,0,-d.z).normalize();
  const f={w,h,u:h/960,t,side,toward};
  P.items.forEach((it,k)=>{const p=clamp01((t-.3-k*.28)/.7); if(p>0&&DRAW[it.type]) DRAW[it.type](ctx,it,p,f);});
}

// a new venue brings its own layer sets
function syncVenue(){const V=venue(); if(V&&V.key!==state.venue){state.venue=V.key; if(!presets().some(p=>p.key===state.key)) state.key='off'; buttons();}}
{const prev=ST.onStyle; ST.onStyle=S=>{if(prev) prev(S); syncVenue();};}
syncVenue();

/* the on-screen copy, shown while the recorder panel is open */
function tick(){
  requestAnimationFrame(tick);
  syncVenue();
  const c=ST.canvas, w=c.clientWidth, h=c.clientHeight, show=!panel.hidden&&state.key!=='off'&&!ST.style().S.sheet&&w>0;
  scr.hidden=!show; if(!show) return;
  const dpr=Math.min(window.devicePixelRatio||1,2), W=Math.round(w*dpr), H=Math.round(h*dpr);
  if(scr.width!==W||scr.height!==H){scr.width=W; scr.height=H;}
  sx.setTransform(dpr,0,0,dpr,0,0); sx.clearRect(0,0,w,h); draw(sx,w,h,(performance.now()-state.t0)/1000);
}
requestAnimationFrame(tick);

SS.layer={draw,restart,active:()=>state.key!=='off'&&!!current()};
})();
