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
  trainEnd:std({color:lin('#9da3ab')},'under'),
  tank:std({color:lin('#6e5139'),roughness:.95}), tankRoof:std({color:lin('#3d3934')}), globe:std({color:lin('#4fbf74'),roughness:.4})
};
const K={seat:0,aisle:1,walk:2,riser:3,fascia:4,soffit:5,back:6,cap:7,canopy:8,roof:9,wall:10,wallTop:11,ground:12,mpark:13,inner:14,boards:15,cable:16,roofTop:17,slab:18,platform:19,track:20,
  seat2:21,pier:22,ring:23,gap:24,ceil:25,ceil2:26,beam:27,unit:28,nbr:29,nbr2:30,nbrTop:31,podium:32,curtain:33,nbr3:34,sidewalk:35,curb:36,steel:37};
// newer kinds borrow an older kind's color in palettes that do not name them
const KFALL={nbr3:'back',sidewalk:'aisle',curb:'riser',steel:'cable',seat2:'seat',pier:'back',ring:'canopy',gap:'fascia',ceil:'inner',ceil2:'inner',beam:'cable',unit:'roofTop',nbr:'back',nbr2:'back',nbrTop:'roof',podium:'back',curtain:'fascia'};

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

/* =====================================================================
   City kit (shared by every venue): buildings with real facades, streets, sidewalks, census trees,
   signals, subway entrances, and elevated train lines. Works in the data's own frame; a venue can
   place the result anywhere by putting it in a moved or turned group.
===================================================================== */
// walls get a window texture, roofs are flat; b = {pts, h, minh, k (wall kind), kt (roof kind), hole, skipEdge}
function blocks(V,list,group,mat){
  const pos=[],uv=[],kinds=[],kbT=new KB(),up=[0,1,0];
  list.forEach(b=>{
    let pts=b.pts; const A=pts.reduce((s,p,i)=>{const q=pts[(i+1)%pts.length]; return s+p[0]*q[1]-q[0]*p[1];},0);
    const sgn=A>0?1:-1, h=b.h, y0=b.minh||0; let acc=0;
    pts.forEach((a,i)=>{const c=pts[(i+1)%pts.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz); if(len<.05) return;
      if(b.skipEdge && b.skipEdge(a,c)){acc+=len; return;}
      const n=[sgn*dz,0,-sgn*dx], A0=[a[0],y0,a[1]],B0=[c[0],y0,c[1]],B1=[c[0],h,c[1]],A1=[a[0],h,a[1]];
      const u0=acc/32,u1=(acc+len)/32,v0=y0/28.8,v1=h/28.8; acc+=len;
      const cr=(p,q,r)=>{const ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=r[0]-p[0],vy=r[1]-p[1],vz=r[2]-p[2]; return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];};
      const nn=cr(A0,B0,B1), ok=nn[0]*n[0]+nn[2]*n[2]>=0;
      const T=ok?[[A0,u0,v0],[B0,u1,v0],[B1,u1,v1],[A0,u0,v0],[B1,u1,v1],[A1,u0,v1]]:[[A0,u0,v0],[B1,u1,v1],[B0,u1,v0],[A0,u0,v0],[A1,u0,v1],[B1,u1,v1]];
      T.forEach(([p,u,v])=>{pos.push(...p); uv.push(u,v); kinds.push(b.k);});});
    const holes=b.hole?[b.hole.map(p=>new THREE.Vector2(p[0],p[1]))]:[], all=pts.concat(b.hole||[]);
    THREE.ShapeUtils.triangulateShape(pts.map(p=>new THREE.Vector2(p[0],p[1])),holes).forEach(f=>kbT.triF([all[f[0]][0],h,all[f[0]][1]],[all[f[1]][0],h,all[f[1]][1]],[all[f[2]][0],h,all[f[2]][1]],b.kt,up));
  });
  if(pos.length){const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(kinds.length*3),3)); g.computeVertexNormals();
    const m=new THREE.Mesh(g,mat); m.userData.kinds=Uint8Array.from(kinds); m.castShadow=m.receiveShadow=true; V.kindMeshes.push(m); V.edgeTargets.push(m); group.add(m);}
  if(kbT.p.length) kbT.mesh(V,group);
}
const pip=(p,poly)=>{let inside=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j]; if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])) inside=!inside;} return inside;};
const centroid=pts=>[pts.reduce((s,q)=>s+q[0],0)/pts.length,pts.reduce((s,q)=>s+q[1],0)/pts.length];
const polyArea=pts=>Math.abs(pts.reduce((s,p,i)=>{const q=pts[(i+1)%pts.length]; return s+p[0]*q[1]-q[0]*p[1];},0))/2;

// facade textures: one tile = 8 bays (4 m) by 8 floors (3.6 m). White walls, so each building's color tints them.
const FACADE=(()=>{
  const T=draw=>{const c=mk(256,256),x=c.getContext('2d'); x.fillStyle='#ffffff'; x.fillRect(0,0,256,256); draw(x); return tex(c,true,true);};
  let sd=9; const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
  return {
    // prewar brick: tall paired windows, pale lintels, faint brick courses
    brick:T(x=>{for(let y=0;y<256;y+=3){x.fillStyle=`rgba(0,0,0,${.03+rnd()*.03})`; x.fillRect(0,y,256,1);}
      for(let i=0;i<8;i++) for(let j=0;j<8;j++){x.fillStyle='#e9e4da'; x.fillRect(i*32+7,j*32+5,18,3); x.fillStyle='#3d434c'; x.fillRect(i*32+8,j*32+8,16,19); x.fillStyle='rgba(255,255,255,.18)'; x.fillRect(i*32+8,j*32+8,16,3); x.fillStyle='#2b3037'; x.fillRect(i*32+15,j*32+8,2,19);}}),
    // prewar limestone: deep-set windows, a line at every floor
    stone:T(x=>{for(let j=0;j<8;j++){x.fillStyle='rgba(0,0,0,.08)'; x.fillRect(0,j*32+30,256,2);}
      for(let i=0;i<8;i++) for(let j=0;j<8;j++){x.fillStyle='#4a5059'; x.fillRect(i*32+9,j*32+7,14,19); x.fillStyle='rgba(0,0,0,.25)'; x.fillRect(i*32+9,j*32+7,14,3);}}),
    // postwar: long ribbon windows between solid bands
    // lit offices at night (same layout, so it lines up with every facade)
    night:(()=>{const c=mk(256,256),x=c.getContext('2d'); x.fillStyle='#000'; x.fillRect(0,0,256,256); let s=7; const r=()=>((s=(s*16807)%2147483647)/2147483647);
      for(let i=0;i<8;i++) for(let j=0;j<8;j++) if(r()<.42){const t=r(); x.fillStyle=`rgba(255,${200+t*40|0},${130+t*60|0},${.55+t*.45})`; x.fillRect(i*32+5,j*32+7,22,17);} return tex(c,true,true);})(),
    band:T(x=>{for(let j=0;j<8;j++){x.fillStyle='#5a636e'; x.fillRect(0,j*32+9,256,14); x.fillStyle='rgba(255,255,255,.15)'; x.fillRect(0,j*32+9,256,3); x.fillStyle='rgba(0,0,0,.3)'; for(let i=0;i<256;i+=16) x.fillRect(i,j*32+9,2,14);}}),
  };
})();

// the neighborhood: buildings (style from the tax lots), rooftops, ground, sidewalks, trees, signals, subway entrances
function buildCity(V,D,parent,o){
  o=o||{};
  const box=o.box||D.box, lots=(D.city&&D.city.lots)||[], skip=new Set(o.skipBins||[]);
  V.mats.win=V.mats.win||std({vertexColors:true,map:FACADE.brick,roughness:.85});
  V.mats.glassWall=V.mats.glassWall||std({vertexColors:true,map:V.tex.win||FACADE.band,roughness:.16,metalness:.55});
  V.mats.brick=std({vertexColors:true,map:FACADE.brick,roughness:.9}); V.mats.stone=std({vertexColors:true,map:FACADE.stone,roughness:.85}); V.mats.band=std({vertexColors:true,map:FACADE.band,roughness:.8});
  V.facadeMats=[V.mats.brick,V.mats.stone,V.mats.band];
  const groups={brick:[],stone:[],band:[],glass:[]}, tanks=[], bulk=new KB();
  (D.buildings||[]).filter(b=>!skip.has(b.bin)&&!(o.skipNear&&o.skipNear(b))).forEach(b=>{
    const c=centroid(b.pts), lot=lots.find(l=>pip(l,b.pts))||null;
    const yr=lot?lot[2]:parseInt(b.yr||'0',10)||0, floors=lot&&lot[3]?lot[3]:Math.round(b.h/3.4), seed=(parseInt(String(b.bin).replace(/\D/g,'')||'7',10)%97)/97;
    let kind=b.h>80||(yr>=1985&&b.h>35)?'glass':yr&&yr<1946?(seed<.62?'brick':'stone'):'band';
    const k=kind==='glass'?K.curtain:kind==='brick'?K.nbr:kind==='stone'?K.nbr2:K.nbr3;
    groups[kind].push({pts:b.pts,h:b.h,k,kt:K.nbrTop});
    const area=polyArea(b.pts);
    // rooftops: a stair and elevator bulkhead on most buildings, a wooden water tank on prewar mid-rises (a New York signature)
    if(kind!=='glass'&&b.h>14&&area>220&&pip(c,b.pts)) boxKB(bulk,[c[0],b.h+1.6,c[1]],[5.5,3.2,4.5],0,K.unit,K.nbrTop);
    if((kind==='brick'||kind==='stone')&&floors>=6&&floors<=26&&area>260){const tp=[c[0]+3.5,c[1]-2.5]; if(pip(tp,b.pts)) tanks.push([tp[0],b.h,tp[1]]);}
  });
  blocks(V,groups.brick,parent,V.mats.brick); blocks(V,groups.stone,parent,V.mats.stone); blocks(V,groups.band,parent,V.mats.band); blocks(V,groups.glass,parent,V.mats.glassWall);
  if(bulk.p.length) bulk.mesh(V,parent);
  if(tanks.length){
    const body=new THREE.InstancedMesh(new THREE.CylinderGeometry(2.3,2.3,4.4,12),mats.tank,tanks.length), roof=new THREE.InstancedMesh(new THREE.ConeGeometry(2.55,1.7,12),mats.tankRoof,tanks.length),
      legs=new THREE.InstancedMesh(new THREE.BoxGeometry(3.8,2.6,3.8),mats.tankRoof,tanks.length), M=new THREE.Matrix4();
    tanks.forEach(([x,y,z],i)=>{M.makeTranslation(x,y+1.3,z); legs.setMatrixAt(i,M); M.makeTranslation(x,y+4.8,z); body.setMatrixAt(i,M); M.makeTranslation(x,y+7.85,z); roof.setMatrixAt(i,M);});
    [body,roof,legs].forEach(m=>{m.castShadow=true; parent.add(m);});
  }
  // ground: streets, crosswalks and lane lines painted; sidewalks raised as real curbs
  const [x0,x1,z0,z1]=box, W=x1-x0, H=z1-z0, sc=2048/Math.max(W,H), c=mk(Math.round(W*sc),Math.round(H*sc)), x=c.getContext('2d');
  x.setTransform(sc,0,0,sc,-x0*sc,-z0*sc); x.lineCap='round'; x.lineJoin='round';
  x.fillStyle='#bab5ab'; x.fillRect(x0,z0,W,H);
  const line=pts=>{x.beginPath(); pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));};
  (D.streets||[]).forEach(s=>{line(s.pts); x.strokeStyle='#3c3e43'; x.lineWidth=s.w+3; x.stroke();});
  (D.streets||[]).forEach(s=>{line(s.pts); x.setLineDash(s.w>14?[3,6]:[2.5,7]); x.strokeStyle='rgba(240,240,236,.75)'; x.lineWidth=.18; x.stroke(); x.setLineDash([]);});
  (D.paths||[]).filter(p=>p.kind==='crossing').forEach(p=>{line(p.pts); x.setLineDash([.6,.6]); x.strokeStyle='#efefea'; x.lineWidth=3.2; x.lineCap='butt'; x.stroke(); x.setLineDash([]); x.lineCap='round';});
  for(let i=0;i<900;i++){x.fillStyle=`rgba(0,0,0,${Math.random()*.05})`; x.fillRect(x0+Math.random()*W,z0+Math.random()*H,.6+Math.random()*1.5,.4);}   // asphalt wear
  V.tex.streets=tex(c); V.mats.streets=std({map:V.tex.streets,roughness:1});
  const gp=new THREE.Mesh(new THREE.PlaneGeometry(W,H).rotateX(-Math.PI/2),V.mats.streets); gp.position.set((x0+x1)/2,.03,(z0+z1)/2); gp.receiveShadow=true; parent.add(gp);
  const walks=((D.city&&D.city.sidewalks)||[]).map(pts=>({pts,h:.18,k:K.curb,kt:K.sidewalk}));
  if(walks.length){V.mats.walk=std({vertexColors:true,roughness:.95}); blocks(V,walks,parent,V.mats.walk);}
  // street trees from the city's tree census, sized by real trunk width (falls back to OpenStreetMap trees)
  const ct=(D.city&&D.city.trees)||[], spots=ct.length?ct.map(t=>[t[0],t[1],t[2]||6]):(D.trees||[]).map(t=>[t[0],t[1],8]);
  V.trees=new THREE.Group(); parent.add(V.trees);
  if(spots.length){
    const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.26,1,6),mats.trunk,spots.length), crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),mats.crown,spots.length);
    const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),P=new THREE.Vector3(),col=new THREE.Color();
    spots.forEach(([tx,tz,dbh],i)=>{const r=Math.min(5.5,Math.max(1.6,1.3+dbh*.11)), th=2.2+dbh*.1;
      P.set(tx,th/2,tz); S.set(1+dbh*.02,th,1+dbh*.02); M.compose(P,Q,S); trunk.setMatrixAt(i,M);
      P.set(tx,th+r*.75,tz); S.set(r,r*.85,r); M.compose(P,Q,S); crown.setMatrixAt(i,M); col.setHSL(.28+((i*37)%10)/120,.35,.78+((i*13)%10)/60); crown.setColorAt(i,col);});
    trunk.castShadow=crown.castShadow=true; crown.receiveShadow=true; V.trees.add(trunk,crown);
  }
  // traffic signals (a pole on the near corner) and subway entrances (green railings and globe lamps)
  const F=D.furniture||[], sig=F.filter(f=>f.kind==='traffic_signals'), ent=F.filter(f=>f.kind==='subway_entrance');
  if(sig.length){const pole=new THREE.InstancedMesh(new THREE.CylinderGeometry(.13,.16,6.2,6),mats.dark,sig.length), head=new THREE.InstancedMesh(new THREE.BoxGeometry(.5,1.3,.5),mats.dark,sig.length), M=new THREE.Matrix4();
    sig.forEach((f,i)=>{M.makeTranslation(f.p[0]+6,3.1,f.p[1]+6); pole.setMatrixAt(i,M); M.makeTranslation(f.p[0]+6,5.6,f.p[1]+5.2); head.setMatrixAt(i,M);}); parent.add(pole,head);}
  if(ent.length){const rail=new THREE.InstancedMesh(new THREE.BoxGeometry(3,1,4.6),mats.globe,ent.length), post=new THREE.InstancedMesh(new THREE.SphereGeometry(.32,10,8),mats.globe,ent.length*2), M=new THREE.Matrix4();
    ent.forEach((f,i)=>{M.makeTranslation(f.p[0],.5,f.p[1]); rail.setMatrixAt(i,M); [-1,1].forEach((s,k)=>{M.makeTranslation(f.p[0]+s*1.5,2.4,f.p[1]+2.3); post.setMatrixAt(i*2+k,M);});}); parent.add(rail,post);}
  return {box};
}

// elevated train line (like the 4 train over River Avenue): one centerline through all the el track pieces
function buildEl(V,D,parent,o){
  o=o||{}; const els=(D.els||[]).filter(e=>e.subway||o.rail); if(!els.length) return null;
  const P=els.flatMap(e=>e.pts), cx=P.reduce((s,p)=>s+p[0],0)/P.length, cz=P.reduce((s,p)=>s+p[1],0)/P.length;
  let sxx=0,sxz=0,szz=0; P.forEach(p=>{const a=p[0]-cx,b=p[1]-cz; sxx+=a*a; sxz+=a*b; szz+=b*b;});
  const ang=.5*Math.atan2(2*sxz,sxx-szz), ax=[Math.cos(ang),Math.sin(ang)], nx=[-ax[1],ax[0]];
  const pr=P.map(p=>[(p[0]-cx)*ax[0]+(p[1]-cz)*ax[1],(p[0]-cx)*nx[0]+(p[1]-cz)*nx[1]]).sort((a,b)=>a[0]-b[0]);
  const path=[]; for(let t=pr[0][0];t<=pr[pr.length-1][0];t+=12){const near=pr.filter(q=>Math.abs(q[0]-t)<14); const off=near.length?near.reduce((s,q)=>s+q[1],0)/near.length:0; path.push([cx+ax[0]*t+nx[0]*off,cz+ax[1]*t+nx[1]*off]);}
  if(path.length<2) return null;
  const Y=o.y||9.5, kb=new KB(), seg=[]; let L=0; const cum=[0];
  for(let i=1;i<path.length;i++){L+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]); cum.push(L);}
  const at=s=>{s=Math.max(0,Math.min(L,s)); let i=1; while(i<cum.length-1&&cum[i]<s) i++; const a=path[i-1],b=path[i],t=(s-cum[i-1])/((cum[i]-cum[i-1])||1); return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,yaw:Math.atan2(b[0]-a[0],b[1]-a[1])};};
  for(let s=0;s<L;s+=6){const p=at(s+3); boxKB(kb,[p.x,Y,p.z],[10,1.3,6.4],p.yaw,K.steel,K.steel); [-4.6,4.6].forEach(lx=>boxKB(kb,[p.x+Math.cos(p.yaw)*lx,Y+1.1,p.z-Math.sin(p.yaw)*lx],[.4,1,6.4],p.yaw,K.steel,K.steel));}
  for(let s=4;s<L;s+=16){const p=at(s); [-4.2,4.2].forEach(lx=>boxKB(kb,[p.x+Math.cos(p.yaw)*lx,Y/2,p.z-Math.sin(p.yaw)*lx],[.7,Y,.7],p.yaw,K.steel,K.steel)); boxKB(kb,[p.x,Y-1.2,p.z],[10,1,.8],p.yaw,K.steel,K.steel);}
  let st=null; const stn=(D.furniture||[]).find(f=>f.kind==='station');
  if(stn){let best=0,bd=1e9; for(let s=0;s<=L;s+=2){const p=at(s),d=Math.hypot(p.x-stn.p[0],p.z-stn.p[1]); if(d<bd){bd=d;best=s;}} if(bd<60){st=best;
    for(let s=st-70;s<st+70;s+=6){const p=at(s+3); boxKB(kb,[p.x,Y+1.4,p.z],[16,.6,6.2],p.yaw,K.platform,K.steel); boxKB(kb,[p.x,Y+6,p.z],[15,.5,6.4],p.yaw,K.roof,K.steel);}}}
  V.elMesh=kb.mesh(V,parent);
  return {L,at,station:st,y:Y};
}

Object.assign(SS,{$,app,stage,canvas,loading,labelsEl,renderer,maxAniso,reduceMotion,deg,TAU,lin,scene,mk,tex,CLIP_ABOVE,CLIP_UNDER,std,stadMat,underMat,mats,K,KFALL,KB,boxKB,resample,makeLoop,range,band,quadAt,tier,genStrip,genRing,orient,closedIdx,lettersTex,ribbonTex,friezeTex,roadTex,woodTex,strataTex,trainTex,SH,VENUES,newVenue,rrect,boundsOf,extrudeOutline,addGrounds,addTrees,addField,addSight});
// a seating tier's stepped outline at one spot around the bowl, for blueprint cross sections
function tierProfile(L,i,T){const f=v=>typeof v==='function'?v(i):v, o0=f(T.o0),o1=f(T.o1),S=T.steps,dO=(o1-o0)/S,dH=(T.h1-T.h0)/(S-1),fb=T.soffit?T.h0-T.fascia:0,pts=[L.pos(i,o0,fb)];
  for(let s=0;s<S;s++){const y=T.h0+s*dH; pts.push(L.pos(i,o0+s*dO,y),L.pos(i,o0+(s+1)*dO,y));}
  pts.push(L.pos(i,o1,T.soffit?T.sb:0)); if(T.soffit) pts.push(L.pos(i,o0,fb)); return pts;}
Object.assign(SS,{blocks,pip,centroid,polyArea,FACADE,buildCity,buildEl,tierProfile});
SS.ok=true;
})();
