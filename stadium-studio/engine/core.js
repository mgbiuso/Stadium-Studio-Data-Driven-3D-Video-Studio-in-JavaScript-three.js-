/* Stadium Studio engine, part 1: renderer, shared helpers, materials, geometry builders, venue scaffolding.
   Venue recipes (venues/*.js) and the app (engine/app.js) read these through window.SS. */
window.SS={ok:false,builders:[]};
(function(){
'use strict';
const $=id=>document.getElementById(id);
const app=$('app'), stage=$('stage'), canvas=$('scene'), loading=$('loading'), labelsEl=$('labels');

if(!window.THREE){ loading.textContent='The 3D library did not load. Check your connection and reload the page.'; return; }
let renderer;
try{ renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true}); }
catch(e){ loading.textContent='This browser could not start WebGL, so the 3D view cannot run here.'; return; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setClearColor(0x000000,0);
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.localClippingEnabled=true;
const maxAniso=renderer.capabilities.getMaxAnisotropy();
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const deg=Math.PI/180, TAU=Math.PI*2;
const lin=h=>new THREE.Color(h).convertSRGBToLinear();
const scene=new THREE.Scene();

/* =====================================================================
   Shared helpers: canvases, materials, geometry builders
===================================================================== */
function mk(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function tex(c,rs,rt){const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=maxAniso;if(rs)t.wrapS=THREE.RepeatWrapping;if(rt)t.wrapT=THREE.RepeatWrapping;return t;}
const CLIP_ABOVE=[], CLIP_UNDER=[];
function std(o,clip){const m=new THREE.MeshStandardMaterial(Object.assign({roughness:.9,metalness:0},o)); if(clip==='under')CLIP_UNDER.push(m); else if(clip!==false)CLIP_ABOVE.push(m); return m;}

const stadMat=std({vertexColors:true,side:THREE.DoubleSide,flatShading:true});
const underMat=std({vertexColors:true,side:THREE.DoubleSide,flatShading:true},'under');
const mats={
  dark:std({}), accent:std({}), monument:std({}), lights:std({}), red:std({}),
  frieze:null,
  trunk:std({flatShading:true}), crown:std({flatShading:true}),
  cloud:std({flatShading:true,roughness:1},false),
  glass:std({color:lin('#d6ecf5'),transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide,roughness:.1}),
  road:std({},false), square:std({},false), soilTop:std({},false), soilSide:std({},false), soilDeep:std({color:lin('#4d4034')},false),
  plinthTop:std({},false), plinthSide:std({},false), woodTop:std({},false), woodSide:std({},false),
  trainEnd:std({color:lin('#9da3ab')},'under')
};
const K={seat:0,aisle:1,walk:2,riser:3,fascia:4,soffit:5,back:6,cap:7,canopy:8,roof:9,wall:10,wallTop:11,ground:12,mpark:13,inner:14,boards:15,cable:16,roofTop:17,slab:18,platform:19,track:20,
  seat2:21,pier:22,ring:23,gap:24,ceil:25,ceil2:26,beam:27,unit:28,nbr:29,nbr2:30,nbrTop:31,podium:32,curtain:33};
// newer kinds borrow an older kind's color in palettes that do not name them
const KFALL={seat2:'seat',pier:'back',ring:'canopy',gap:'fascia',ceil:'inner',ceil2:'inner',beam:'cable',unit:'roofTop',nbr:'back',nbr2:'back',nbrTop:'roof',podium:'back',curtain:'fascia'};

class KB{
  constructor(){this.p=[];this.k=[];}
  tri(a,b,c,k){this.p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]); this.k.push(k,k,k);}
  quad(a,b,c,d,k){this.tri(a,b,c,k); this.tri(a,c,d,k);}
  // same as tri/quad, but makes sure the front of the face points along n (needed for one-sided roof and ceiling)
  triF(a,b,c,k,n){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const d=(uy*vz-uz*vy)*n[0]+(uz*vx-ux*vz)*n[1]+(ux*vy-uy*vx)*n[2]; if(d<0) this.tri(a,c,b,k); else this.tri(a,b,c,k);}
  quadF(a,b,c,d,k,n){this.triF(a,b,c,k,n); this.triF(a,c,d,k,n);}
  mesh(V,group,mat){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(this.k.length*3),3));
    g.computeVertexNormals();
    const m=new THREE.Mesh(g,mat||stadMat); m.userData.kinds=Uint8Array.from(this.k);
    m.castShadow=m.receiveShadow=true; V.kindMeshes.push(m); V.edgeTargets.push(m); group.add(m); return m;
  }
}
function boxKB(kb,c,s,yaw,kTop,kSide,kBot){
  const sx=s[0]/2,sy=s[1]/2,sz=s[2]/2,cs=Math.cos(yaw||0),sn=Math.sin(yaw||0);
  const P=(x,y,z)=>[c[0]+x*cs+z*sn,c[1]+y,c[2]-x*sn+z*cs];
  const v=[P(-sx,-sy,-sz),P(sx,-sy,-sz),P(sx,sy,-sz),P(-sx,sy,-sz),P(-sx,-sy,sz),P(sx,-sy,sz),P(sx,sy,sz),P(-sx,sy,sz)];
  kb.quad(v[3],v[2],v[6],v[7],kTop); kb.quad(v[0],v[1],v[5],v[4],kBot===undefined?kSide:kBot);
  kb.quad(v[0],v[1],v[2],v[3],kSide); kb.quad(v[4],v[5],v[6],v[7],kSide); kb.quad(v[0],v[4],v[7],v[3],kSide); kb.quad(v[1],v[5],v[6],v[2],kSide);
}

/* A closed loop of points (the inner edge of the seating) with outward normals. */
function resample(raw,N){
  const seg=[]; let total=0;
  for(let i=0;i<raw.length;i++){const a=raw[i],b=raw[(i+1)%raw.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]); seg.push(l); total+=l;}
  const pts=[]; let si=0,acc=0;
  for(let k=0;k<N;k++){
    const target=k*total/N;
    while(si<seg.length-1 && acc+seg[si]<target){acc+=seg[si]; si++;}
    const a=raw[si],b=raw[(si+1)%raw.length],t=seg[si]?(target-acc)/seg[si]:0;
    pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
  }
  return pts;
}
function makeLoop(pts,C){
  const N=pts.length;
  const NR=pts.map((p,i)=>{const a=pts[(i-1+N)%N],b=pts[(i+1)%N]; let tx=b[0]-a[0],tz=b[1]-a[1]; const l=Math.hypot(tx,tz)||1; tx/=l; tz/=l;
    let n=[tz,-tx]; if(n[0]*(p[0]-C[0])+n[1]*(p[1]-C[1])<0) n=[-tz,tx]; return n;});
  const PHI=pts.map(p=>Math.atan2(p[0]-C[0],p[1]-C[1])/deg);
  const L={N,P:pts,NR,PHI,C};
  L.w=i=>((i%N)+N)%N;
  L.pos=(i,o,y)=>{i=L.w(i); const p=pts[i],n=NR[i]; return [p[0]+n[0]*o,y,p[1]+n[1]*o];};
  L.idxAtPhi=t=>{let best=0,bd=1e9; for(let i=0;i<N;i++){const d=Math.abs(((PHI[i]-t+540)%360)-180); if(d<bd){bd=d;best=i;}} return best;};
  L.runs=pred=>{const out=[];let s=-1;for(let i=0;i<N;i++){if(pred(i)){if(s<0)s=i;}else if(s>=0){out.push([s,i-1]);s=-1;}} if(s>=0)out.push([s,N-1]); return out;};
  L.smooth=(arr,w)=>arr.map((_,i)=>{let s=0;for(let k=-w;k<=w;k++)s+=arr[(i+k+N)%N];return s/(2*w+1);});
  L.cross=(axis,c,sign)=>{let best=0,bd=1e9; for(let i=0;i<N;i++){const p=pts[i],along=axis==='z'?p[1]:p[0],other=axis==='z'?p[0]:p[1]; if(Math.sign(other)!==sign) continue; const d=Math.abs(along-c); if(d<bd){bd=d;best=i;}} return best;};
  return L;
}
const range=(a,b)=>{const r=[];for(let i=a;i<=b;i++)r.push(i);return r;};
function band(kb,L,i,fA,fB,k){const j=L.w(i+1),a=fA(i),b=fA(j),c=fB(j),d=fB(i); kb.quad(L.pos(i,a[0],a[1]),L.pos(j,b[0],b[1]),L.pos(j,c[0],c[1]),L.pos(i,d[0],d[1]),k);}
function quadAt(kb,L,i,oA,yA,oB,yB,k){band(kb,L,i,()=>[oA,yA],()=>[oB,yB],k);}

/* Stepped seating tier swept along the loop. o0/o1 may vary per index. */
function tier(kb,L,run,t){
  const f=v=>typeof v==='function'?v:()=>v, O0=f(t.o0), O1=f(t.o1), S=t.steps, dH=(t.h1-t.h0)/(S-1);
  const fb=t.soffit?t.h0-t.fascia:0, bb=t.soffit?t.sb:0;
  const prof=i=>{const o0=O0(i),o1=O1(i); return [o0,(o1-o0)/S,o1];};
  const [a,b]=run, end=t.closed?L.N:b;
  for(let i=a;i<end;i++){
    const j=L.w(i+1), A=prof(i), B=prof(j), aisle=(i%t.aisle)===0;
    const q=(oa,ya,ob,yb,oc,yc,od,yd,k)=>kb.quad(L.pos(i,oa,ya),L.pos(j,ob,yb),L.pos(j,oc,yc),L.pos(i,od,yd),k);
    for(let s=0;s<S;s++){
      const y=t.h0+s*dH;
      q(A[0]+s*A[1],y,B[0]+s*B[1],y,B[0]+(s+1)*B[1],y,A[0]+(s+1)*A[1],y, s===t.walk?K.walk:aisle?K.aisle:(t.kSeat===undefined?K.seat:t.kSeat));
      if(s>0) q(A[0]+s*A[1],y-dH,B[0]+s*B[1],y-dH,B[0]+s*B[1],y,A[0]+s*A[1],y,K.riser);
    }
    q(A[0],fb,B[0],fb,B[0],t.h0,A[0],t.h0,K.fascia);
    q(A[2],t.h1,B[2],t.h1,B[2],bb,A[2],bb,K.back);
    if(t.soffit) q(A[0],fb,B[0],fb,B[2],bb,A[2],bb,K.soffit);
  }
  if(t.closed) return;
  [a,b].forEach(i=>{
    const [o0,dO,o1]=prof(i), c=[[o0,fb],[o0,t.h0]];
    for(let s=0;s<S;s++){const y=t.h0+s*dH,oB=o0+(s+1)*dO; c.push([oB,y]); if(s<S-1) c.push([oB,y+dH]);}
    c.push([o1,bb]);
    THREE.ShapeUtils.triangulateShape(c.map(q=>new THREE.Vector2(q[0],q[1])),[]).forEach(fc=>
      kb.tri(L.pos(i,c[fc[0]][0],c[fc[0]][1]),L.pos(i,c[fc[1]][0],c[fc[1]][1]),L.pos(i,c[fc[2]][0],c[fc[2]][1]),K.cap));
  });
}
/* Vertical strip (facade, ribbons, frieze, letters). */
function genStrip(L,idxs,offF,y0F,y1F,uScale){
  const Pp=[],U=[],I=[]; let u=0,prev=null;
  idxs.forEach((i,n)=>{
    const o=offF(i),b=L.pos(i,o,y0F(i)),t=L.pos(i,o,y1F(i));
    if(prev) u+=Math.hypot(b[0]-prev[0],b[2]-prev[2]); prev=b;
    Pp.push(...b,...t); U.push(u,0,u,1);
    if(n>0){const k=2*n; I.push(k-2,k,k-1,k-1,k,k+1);}
  });
  const sc=uScale==='fit'?u:uScale; for(let q=0;q<U.length;q+=2) U[q]/=sc;
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(Pp,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2)); g.setIndex(I); g.computeVertexNormals(); return g;
}
/* Horizontal ring (the road). */
function genRing(L,idxs,inF,outF,y,uScale){
  const Pp=[],U=[],I=[]; let u=0,prev=null;
  idxs.forEach((i,n)=>{
    const a=L.pos(i,inF(i),y),b=L.pos(i,outF(i),y),m=[(a[0]+b[0])/2,(a[2]+b[2])/2];
    if(prev) u+=Math.hypot(m[0]-prev[0],m[1]-prev[1]); prev=m;
    Pp.push(...a,...b); U.push(u/uScale,0,u/uScale,1);
    if(n>0){const k=2*n; I.push(k-2,k,k-1,k-1,k,k+1);}
  });
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(Pp,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2)); g.setIndex(I); g.computeVertexNormals(); return g;
}
function orient(L,idxs,outside){
  const m=Math.floor(idxs.length/2),i=L.w(idxs[m]),j=L.w(idxs[m+1]),n=L.NR[i];
  const T=[L.P[j][0]-L.P[i][0],L.P[j][1]-L.P[i][1]],right=outside?[n[1],-n[0]]:[-n[1],n[0]];
  return (T[0]*right[0]+T[1]*right[1])<0?idxs.slice().reverse():idxs;
}
const closedIdx=L=>range(0,L.N-1).concat([0]);

/* =====================================================================
   Shared textures
===================================================================== */
function lettersTex(text,font,fill,sp){
  const c=mk(2048,160),x=c.getContext('2d'); x.font=font; x.textBaseline='middle';
  const ws=[...text].map(ch=>x.measureText(ch).width),total=ws.reduce((a,b)=>a+b,0)+sp*(text.length-1);
  let X=(2048-total)/2; x.fillStyle=fill(x); x.shadowColor='rgba(0,0,0,.35)'; x.shadowOffsetY=4; x.shadowBlur=6;
  [...text].forEach((ch,k)=>{x.fillText(ch,X,86); X+=ws[k]+sp;});
  return tex(c);
}
function ribbonTex(items,bg,star){
  const W=1536,c=mk(W,48),x=c.getContext('2d'); x.fillStyle=bg; x.fillRect(0,0,W,48);
  x.font='600 24px "Arial Narrow",Arial,sans-serif'; x.textBaseline='middle';
  const ws=items.map(t=>x.measureText(t).width),gap=(W-ws.reduce((a,b)=>a+b,0))/items.length;
  let X=gap/2; items.forEach((t,k)=>{x.fillStyle=t==='★'?star:'#eef2f8'; x.fillText(t,X,25); X+=ws[k]+gap;});
  return tex(c,true);
}
function friezeTex(){
  const c=mk(128,104),x=c.getContext('2d'); x.fillStyle='#fff'; x.strokeStyle='#fff';
  x.fillRect(0,0,128,14); x.fillRect(0,0,6,104); x.fillRect(122,0,6,104);
  x.lineWidth=6; x.beginPath(); x.moveTo(3,14); x.quadraticCurveTo(64,122,125,14); x.stroke(); x.lineWidth=3;
  for(let k=1;k<7;k++){const px=6+k*116/7,t=(px-3)/122,y=(1-t)*(1-t)*14+2*(1-t)*t*122+t*t*14; x.beginPath(); x.moveTo(px,14); x.lineTo(px,y); x.stroke();}
  return tex(c,true);
}
function roadTex(){
  const c=mk(512,128),x=c.getContext('2d');
  x.fillStyle='#2e2f33'; x.fillRect(0,0,512,128);
  for(let i=0;i<500;i++){x.fillStyle=`rgba(255,255,255,${Math.random()*.05})`; x.fillRect(Math.random()*512,Math.random()*128,2,2);}
  x.fillStyle='#f2f2ee'; x.fillRect(0,8,512,4);
  x.fillRect(0,61,200,6);
  for(let k=0;k<16;k++){x.fillStyle=k%2?'#1b1b1b':'#f2c230'; x.fillRect(k*32,114,32,14);}
  return tex(c,true);
}
function woodTex(){
  const c=mk(512,128),x=c.getContext('2d'); const g=x.createLinearGradient(0,0,0,128); g.addColorStop(0,'#b07a43'); g.addColorStop(1,'#93602f');
  x.fillStyle=g; x.fillRect(0,0,512,128);
  for(let i=0;i<46;i++){const y=Math.random()*128; x.strokeStyle=`rgba(${60+Math.random()*30},${35+Math.random()*20},15,${.12+Math.random()*.18})`; x.lineWidth=.6+Math.random()*1.6;
    x.beginPath(); x.moveTo(0,y); for(let X=0;X<=512;X+=32) x.lineTo(X,y+Math.sin(X*.02+i)*2.2); x.stroke();}
  const t=tex(c,true,true); return t;
}
function strataTex(){
  const c=mk(64,512),x=c.getContext('2d');
  const layers=[[0,10,'#6d6a64'],[10,28,'#4c3a29'],[28,140,'#8c6a46'],[140,270,'#a7865d'],[270,380,'#7e6650'],[380,512,'#6e6a66']];
  layers.forEach(([a,b,col])=>{x.fillStyle=col; x.fillRect(0,a,64,b-a);});
  for(let i=0;i<220;i++){const y=30+Math.random()*480; x.fillStyle=`rgba(0,0,0,${Math.random()*.18})`; x.beginPath(); x.arc(Math.random()*64,y,1+Math.random()*2.4,0,TAU); x.fill();}
  x.fillStyle='rgba(0,0,0,.25)'; [28,140,270,380].forEach(y=>x.fillRect(0,y,64,2));
  return tex(c,true,true);
}
function trainTex(s1,s2){
  const c=mk(512,64),x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,64); g.addColorStop(0,'#e3e6ea'); g.addColorStop(1,'#a9aeb5'); x.fillStyle=g; x.fillRect(0,0,512,64);
  x.fillStyle='#2a3038'; x.fillRect(0,16,512,16);
  x.fillStyle='rgba(255,255,255,.25)'; for(let i=0;i<512;i+=22) x.fillRect(i,16,2,16);
  x.fillStyle=s1; x.fillRect(0,38,512,6); x.fillStyle=s2; x.fillRect(0,44,512,4);
  x.fillStyle='rgba(0,0,0,.25)'; for(let i=40;i<512;i+=128) x.fillRect(i,14,14,44);
  return tex(c,true);
}
const SH={road:roadTex(),wood:woodTex(),strata:strataTex(),frieze:friezeTex()};
SH.wood.repeat.set(1/38,1/4); SH.strata.repeat.set(1/40,1/34);
mats.frieze=std({map:SH.frieze,alphaTest:.5,side:THREE.DoubleSide});
mats.road.map=SH.road; mats.woodSide.map=SH.wood; mats.soilSide.map=SH.strata;

/* =====================================================================
   Venue scaffolding
===================================================================== */
const VENUES={};
function newVenue(key,o){
  const V=Object.assign({key,root:new THREE.Group(),G:{},kindMeshes:[],edgeTargets:[],mats:{},tex:{},labels:{exploded:[],section:[]},
    roofObjs:[],roadHide:[],camOv:{},pointPos:{},EXP:{}},o);
  ['base','lower','facade','middle','upper','crown','roof','under'].forEach(k=>{V.G[k]=new THREE.Group(); V.root.add(V.G[k]);});
  V.root.visible=false; scene.add(V.root); VENUES[key]=V; return V;
}
function rrect(hx,hz,r,step){ // rounded rectangle outline as [x,z] points
  const pts=[],cx=hx-r,cz=hz-r;
  [[cx,cz,0],[-cx,cz,90],[-cx,-cz,180],[cx,-cz,270]].forEach(([x0,z0,a0])=>{
    for(let a=a0;a<=a0+90;a+=step){const t=a*deg; pts.push([x0+r*Math.cos(t),z0+r*Math.sin(t)]);}
  });
  return pts;
}
function boundsOf(pts){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; pts.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);}); return {x0,x1,z0,z1};}
function extrudeOutline(pts,depth,bevel){
  const shape=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],-p[1])));
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:!!bevel,bevelThickness:bevel||0,bevelSize:bevel||0,bevelSegments:1,curveSegments:4});
  g.rotateX(-Math.PI/2); g.translate(0,-depth-(bevel||0)-.02,0); return g;
}
function addGrounds(V,outline){
  V.bounds=boundsOf(outline);
  V.plinth=new THREE.Mesh(extrudeOutline(outline,3,.5),[mats.plinthTop,mats.plinthSide]); V.plinth.castShadow=V.plinth.receiveShadow=true; V.G.base.add(V.plinth); V.edgeTargets.push(V.plinth);
  V.wood=new THREE.Mesh(extrudeOutline(outline,8,1.2),[mats.woodTop,mats.woodSide]); V.wood.castShadow=V.wood.receiveShadow=true; V.G.base.add(V.wood);
  const B=V.bounds,m=12;
  V.square=new THREE.Mesh(new THREE.BoxGeometry(B.x1-B.x0+m*2,6,B.z1-B.z0+m*2),mats.square); V.square.position.set((B.x0+B.x1)/2,-3.02,(B.z0+B.z1)/2);
  V.square.castShadow=V.square.receiveShadow=true; V.G.base.add(V.square);
  // soil: full block, or an L-shape with one quarter dug out when there is something underground to show
  const c=V.cut, D=34, sq=[[B.x0,B.z0],[B.x1,B.z0],[B.x1,B.z1],[B.x0,B.z1]];
  const L=V.station?[[B.x0,B.z0],[B.x1,B.z0],[B.x1,c.z],[c.x,c.z],[c.x,B.z1],[B.x0,B.z1]]:sq;
  V.soil=new THREE.Group();
  const s1=new THREE.Mesh(extrudeOutline(L,D,0),[mats.soilTop,mats.soilSide]); s1.receiveShadow=true; V.soil.add(s1);
  const fl=new THREE.Mesh(new THREE.BoxGeometry(B.x1-B.x0,2,B.z1-B.z0),mats.soilDeep); fl.position.set((B.x0+B.x1)/2,-D-1.02,(B.z0+B.z1)/2); V.soil.add(fl);
  V.G.base.add(V.soil);
  // half block for the section view (ends exactly at the cut plane)
  const s=V.section; let half;
  if(s.axis==='z') half=[[B.x0,B.z0],[B.x1,B.z0],[B.x1,s.c],[B.x0,s.c]]; else half=[[B.x0,B.z0],[s.c,B.z0],[s.c,B.z1],[B.x0,B.z1]];
  V.soilHalf=new THREE.Group(); V.G.base.add(V.soilHalf);
  if(V.station){ // leave the station levels open so the slice shows them: a thin street crust on top, bedrock below
    const top=new THREE.Mesh(extrudeOutline(half,3.4,0),[mats.soilTop,mats.soilSide]);
    const bot=new THREE.Mesh(extrudeOutline(half,10,0),[mats.soilSide,mats.soilSide]); bot.position.y=-24;
    V.soilHalf.add(top,bot);
  } else V.soilHalf.add(new THREE.Mesh(extrudeOutline(half,D,0),[mats.soilTop,mats.soilSide]));
}
function addTrees(V,spots){
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.35,.45,3,6),mats.trunk,spots.length);
  const crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(3.3,0),mats.crown,spots.length);
  const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),T=new THREE.Vector3();
  spots.forEach(([x,z,s],k)=>{T.set(x,1.5*s,z); S.set(s,s,s); M.compose(T,Q,S); trunk.setMatrixAt(k,M); T.set(x,5.4*s,z); M.compose(T,Q,S); crown.setMatrixAt(k,M);});
  trunk.castShadow=crown.castShadow=true; crown.receiveShadow=true;
  V.trees=new THREE.Group(); V.trees.add(trunk,crown); V.G.base.add(V.trees);
}
function addField(V,L,map,FX){
  const g=new THREE.ShapeGeometry(new THREE.Shape(L.P.map(p=>new THREE.Vector2(p[0],-p[1])))); g.rotateX(-Math.PI/2); g.translate(0,.06,0);
  const pa=g.attributes.position,uv=g.attributes.uv;
  for(let v=0;v<pa.count;v++) uv.setXY(v,(pa.getX(v)-FX.xmin)/FX.W,1-(pa.getZ(v)-FX.zmin)/FX.W);
  V.mats.field=std({map,roughness:1}); const m=new THREE.Mesh(g,V.mats.field); m.receiveShadow=true; V.G.base.add(m); V.edgeTargets.push(m);
}
function addSight(V,eyes,focal){
  V.sight=new THREE.Group();
  const mat=new THREE.LineDashedMaterial({color:lin('#e0782b'),dashSize:1.6,gapSize:1.1});
  eyes.forEach(e=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...e),new THREE.Vector3(...focal)]); const l=new THREE.Line(g,mat); l.computeLineDistances(); V.sight.add(l);
    const d=new THREE.Mesh(new THREE.SphereGeometry(.7,10,8),new THREE.MeshBasicMaterial({color:lin('#e0782b')})); d.position.set(...e); V.sight.add(d);});
  const f=new THREE.Mesh(new THREE.SphereGeometry(.9,12,8),new THREE.MeshBasicMaterial({color:lin('#1f4e8c')})); f.position.set(...focal); V.sight.add(f);
  V.root.add(V.sight);
}

Object.assign(SS,{$,app,stage,canvas,loading,labelsEl,renderer,maxAniso,reduceMotion,deg,TAU,lin,scene,mk,tex,CLIP_ABOVE,CLIP_UNDER,std,stadMat,underMat,mats,K,KFALL,KB,boxKB,resample,makeLoop,range,band,quadAt,tier,genStrip,genRing,orient,closedIdx,lettersTex,ribbonTex,friezeTex,roadTex,woodTex,strataTex,trainTex,SH,VENUES,newVenue,rrect,boundsOf,extrudeOutline,addGrounds,addTrees,addField,addSight});
SS.ok=true;
})();
