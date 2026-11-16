/* Venue recipe: Yankee Stadium. Uses the shared helpers from engine/core.js. */
(function(){
'use strict';
if(!window.SS||!SS.ok) return;
const {$,app,stage,canvas,loading,labelsEl,renderer,maxAniso,reduceMotion,deg,TAU,lin,scene,mk,tex,CLIP_ABOVE,CLIP_UNDER,std,stadMat,underMat,mats,K,KFALL,KB,boxKB,resample,makeLoop,range,band,quadAt,tier,genStrip,genRing,orient,closedIdx,lettersTex,ribbonTex,friezeTex,roadTex,woodTex,strataTex,trainTex,SH,VENUES,newVenue,rrect,boundsOf,extrudeOutline,addGrounds,addTrees,addField,addSight}=SS;
/* =====================================================================
   VENUE 1: Yankee Stadium
===================================================================== */
function buildYankee(){
  const V=newVenue('yankee',{name:'Yankee Stadium',eyebrow:'3D study · The Bronx, New York',spec:['Opened 2009','LF 318 ft','CF 408 ft','RF 314 ft'],
    sheet:{title:'Yankee Stadium',addr:'1 East 161st Street · Bronx, NY',elevDir:[.45,.22,1],elevName:'Home plate entrance elevation',planName:'Plan at field level',secName:'Stands cross section',sec:{h:[-128,-38],y:[-2,52]},
      callouts:[{p:[0,0,0],t:'Home plate'},{p:[0,0,-18.4],t:'Pitcher\'s mound'},{p:[0,0,-112],t:'Center field'},{p:[-62,0,-100],t:'Left field'},{p:[62,0,-100],t:'Right field'},{p:[0,0,-128],t:'Monument Park'},{p:[45,8,22],t:'Main level'}],rows:[['Architect','HOK Sport (now Populous)'],['Builder','Turner Construction'],['Cost','$2.3 billion'],['Groundbreaking','August 16, 2006'],['Opened','April 16, 2009'],['Field','LF 318 · CF 408 · RF 314 ft'],['Drawn from','Hand-built study model']]},
    center:new THREE.Vector3(0,0,-40),scale:1,indoor:false,studio:{bg:'#24457e',seat:'#1f3c73',trim:'#c9a24a'},cut:{x:0,z:-40},section:{axis:'z',c:-40},
    dayK:{}});
  const C=[0,-53.8],r2=Math.SQRT1_2,dL=[-r2,-r2],dR=[r2,-r2],nL=[-r2,r2],nR=[r2,r2];
  const raw=[],hc=[0,-11.3],ha=25,RO=70.2;
  for(let a=45;a>-45;a-=3){const t=a*deg; raw.push([hc[0]+ha*Math.sin(t),hc[1]+ha*Math.cos(t)]);}
  for(let s=8;s<97;s+=3){const o=17-16*(s-8)/89; raw.push([s*dL[0]+o*nL[0],s*dL[1]+o*nL[1]]);}
  for(let a=258;a>102;a-=2){const t=a*deg; raw.push([C[0]+RO*Math.sin(t),C[1]+RO*Math.cos(t)]);}
  for(let s=97;s>8;s-=3){const o=17-16*(s-8)/89; raw.push([s*dR[0]+o*nR[0],s*dR[1]+o*nR[1]]);}
  let pts=resample(raw,360);
  for(let pass=0;pass<2;pass++){const n=pts.length; pts=pts.map((p,i)=>{const a=pts[(i-1+n)%n],b=pts[(i+1)%n]; return [(a[0]+2*p[0]+b[0])/4,(a[1]+2*p[1]+b[1])/4];});}
  const phiOf=p=>Math.atan2(p[0]-C[0],p[1]-C[1])/deg;
  let iCF=0; pts.forEach((p,i)=>{if(Math.abs(phiOf(p))>Math.abs(phiOf(pts[iCF]))) iCF=i;});
  pts=pts.slice(iCF).concat(pts.slice(0,iCF));
  const L=makeLoop(pts,C), N=L.N;
  const REG=L.PHI.map(f=>Math.abs(f)<=112?0:Math.abs(f)<163?1:2);
  const rawBo=REG.map(r=>r===0?58:r===1?26:30);
  const bo=L.smooth(rawBo,8).map((v,i)=>Math.max(v,rawBo[i]));
  const fh=L.smooth(REG.map(r=>r===0?30:20),8);
  const st=L.smooth(REG.map(r=>r===0?46:r===1?15:0),8).map((v,i)=>REG[i]===1?15:v);
  const fo=L.smooth(rawBo.map(v=>v+5),8).map((v,i)=>Math.max(v,bo[i]+4));
  const plinthOff=L.smooth(fo,6).map(v=>v+22);

  // textures
  const FX={xmin:-80,zmin:-134,W:160};
  V.tex.field=(()=>{
    const S=2048,c=mk(S,S),x=c.getContext('2d'),k=S/FX.W; x.setTransform(k,0,0,k,-FX.xmin*k,-FX.zmin*k);
    x.fillStyle='#3d7a34'; x.fillRect(FX.xmin,FX.zmin,FX.W,FX.W);
    x.save(); x.rotate(Math.PI/4); for(let j=-45;j<45;j++){x.fillStyle=j%2?'rgba(255,255,255,.07)':'rgba(0,0,0,.05)'; x.fillRect(j*6,-280,6,560);}
    x.rotate(-Math.PI/2); for(let j=-45;j<45;j++){if(j%2){x.fillStyle='rgba(255,255,255,.05)'; x.fillRect(j*6,-280,6,560);}} x.restore();
    x.beginPath(); L.P.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.lineWidth=9; x.strokeStyle='#a06c46'; x.stroke();
    const dirt='#b27b4f'; x.fillStyle=dirt; x.beginPath(); x.moveTo(0,0); x.lineTo(-27.5,-27.5); x.arc(0,-18.44,29,Math.atan2(-9.06,-27.5),Math.atan2(-9.06,27.5),false); x.closePath(); x.fill();
    const inf=()=>{x.beginPath(); x.moveTo(0,-4.3); x.lineTo(15.6,-19.4); x.lineTo(0,-34.6); x.lineTo(-15.6,-19.4); x.closePath();};
    x.fillStyle='#46873b'; inf(); x.fill();
    x.fillStyle=dirt; x.beginPath(); x.arc(0,0,3.96,0,TAU); x.fill(); x.fillStyle='#b9845a'; x.beginPath(); x.arc(0,-18.44,2.74,0,TAU); x.fill();
    x.strokeStyle='#f4f4ef'; x.lineWidth=.15; [dL,dR].forEach(d=>{x.beginPath(); x.moveTo(0,0); x.lineTo(d[0]*99,d[1]*99); x.stroke();});
    x.lineWidth=.08; x.strokeRect(-1.6,-.92,1.2,1.84); x.strokeRect(.4,-.92,1.2,1.84);
    x.fillStyle='#f7f7f2'; [[19.4,-19.4],[0,-38.8],[-19.4,-19.4]].forEach(b=>{x.save(); x.translate(b[0],b[1]); x.rotate(Math.PI/4); x.fillRect(-.19,-.19,.38,.38); x.restore();});
    x.beginPath(); x.moveTo(-.22,-.22); x.lineTo(.22,-.22); x.lineTo(.22,0); x.lineTo(0,.22); x.lineTo(-.22,0); x.closePath(); x.fill(); x.fillRect(-.3,-18.52,.6,.16);
    return tex(c);
  })();
  const facadeT=night=>{
    const w=256,h=768,c=mk(w,h),x=c.getContext('2d'),m=v=>h-v*25.6,px=v=>v*25.6,cx=128,oy0=4.2,spring=19.6,r=2.8;
    const opening=pad=>{const Lx=cx-px(r+pad),R=cx+px(r+pad); x.beginPath(); x.moveTo(Lx,m(oy0-pad*.3)); x.lineTo(Lx,m(spring)); x.arc(cx,m(spring),px(r+pad),Math.PI,0,false); x.lineTo(R,m(oy0-pad*.3)); x.closePath();};
    if(!night){
      x.fillStyle='#d9ceb6'; x.fillRect(0,0,w,h); x.strokeStyle='rgba(110,90,60,.16)'; x.lineWidth=1;
      for(let v=3.2;v<27.4;v+=1.1){x.beginPath(); x.moveTo(0,m(v)+.5); x.lineTo(w,m(v)+.5); x.stroke();}
      const g=x.createLinearGradient(0,0,w,0); g.addColorStop(0,'rgba(0,0,0,.11)'); g.addColorStop(.12,'rgba(0,0,0,0)'); g.addColorStop(.88,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.11)'); x.fillStyle=g; x.fillRect(0,0,w,h);
      x.fillStyle='#8c877d'; x.fillRect(0,m(3.2),w,px(3.2));
      x.fillStyle='#c4b79c'; opening(.45); x.fill();
      const gg=x.createLinearGradient(0,m(spring+r),0,m(oy0)); gg.addColorStop(0,'#3d4a5a'); gg.addColorStop(1,'#1e2630'); x.fillStyle=gg; opening(0); x.fill();
      x.save(); opening(0); x.clip(); x.strokeStyle='#6c7787'; x.lineWidth=3; for(let v=oy0+3.4;v<spring+r;v+=3.4){x.beginPath(); x.moveTo(0,m(v)); x.lineTo(w,m(v)); x.stroke();}
      x.beginPath(); x.moveTo(cx,0); x.lineTo(cx,h); x.stroke(); x.restore();
      x.fillStyle='rgba(0,0,0,.22)'; x.fillRect(0,m(27.4),w,4); x.fillStyle='#c6b99f'; x.fillRect(0,m(28.2),w,px(.8)); x.fillStyle='#e6dcc8'; x.fillRect(0,0,w,px(.45));
    } else {
      x.fillStyle='#000'; x.fillRect(0,0,w,h);
      const up=x.createLinearGradient(0,m(0),0,m(16)); up.addColorStop(0,'rgba(255,190,120,.34)'); up.addColorStop(1,'rgba(255,190,120,0)'); x.fillStyle=up; x.fillRect(0,0,w,h);
      const wg=x.createLinearGradient(0,m(spring+r),0,m(oy0)); wg.addColorStop(0,'#ffd892'); wg.addColorStop(1,'#ffae55'); x.fillStyle=wg; opening(0); x.fill();
      x.save(); opening(0); x.clip(); x.strokeStyle='#3a2810'; x.lineWidth=3; for(let v=oy0+3.4;v<spring+r;v+=3.4){x.beginPath(); x.moveTo(0,m(v)); x.lineTo(w,m(v)); x.stroke();} x.restore();
    }
    return tex(c,true);
  };
  V.tex.facade=facadeT(false); V.tex.facadeNight=facadeT(true);
  V.tex.letters=lettersTex('YANKEE STADIUM','700 118px Georgia,"Times New Roman",serif',x=>{const g=x.createLinearGradient(0,22,0,140); g.addColorStop(0,'#f6dd92'); g.addColorStop(.5,'#cf9f3e'); g.addColorStop(1,'#8f6a22'); return g;},38);
  V.tex.ribbon=ribbonTex(['NEW YORK YANKEES','★','YANKEE STADIUM','★','THE BRONX','★','27 WORLD SERIES TITLES','★'],'#0a1630','#d9b65c');
  V.tex.board=(()=>{
    const c=mk(640,352),x=c.getContext('2d'); x.fillStyle='#060a12'; x.fillRect(0,0,640,352);
    x.fillStyle='#13284d'; x.fillRect(10,10,620,46); x.fillStyle='#f4f6fa'; x.font='700 30px Georgia,serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('YANKEE STADIUM',320,34);
    x.fillStyle='#0f1f3d'; x.fillRect(10,64,404,170); x.strokeStyle='rgba(255,255,255,.11)'; x.lineWidth=2; for(let i=20;i<414;i+=12){x.beginPath(); x.moveTo(i,64); x.lineTo(i,234); x.stroke();}
    x.fillStyle='#fff'; x.font='italic 700 60px Georgia,serif'; x.fillText('Yankees',212,140); x.fillStyle='#d9b65c'; x.font='600 17px Helvetica,Arial,sans-serif'; x.fillText('WELCOME TO THE BRONX',212,194);
    x.fillStyle='#0c1424'; x.fillRect(422,64,208,170); x.textAlign='left';
    [['PITCH','98 MPH'],['COUNT','2-1'],['OUTS','2']].forEach((r,k)=>{x.fillStyle='#8ea3c8'; x.font='600 14px Helvetica,Arial,sans-serif'; x.fillText(r[0],436,88+k*52); x.fillStyle='#ffc94a'; x.font='700 26px Helvetica,Arial,sans-serif'; x.fillText(r[1],436,112+k*52);});
    const cols=['','1','2','3','4','5','6','7','8','9','R','H','E'],rows=[['BOS','0','1','0','0','2','0','0','0','0','3','7','1'],['NYY','2','0','0','1','0','0','3','0','X','6','9','0']];
    x.fillStyle='#0b1220'; x.fillRect(10,242,620,100); x.textAlign='center';
    cols.forEach((t,k)=>{x.fillStyle='#8ea3c8'; x.font='600 15px Helvetica,Arial,sans-serif'; x.fillText(t,k===0?52:76+k*42,262);});
    rows.forEach((row,r)=>row.forEach((t,k)=>{x.fillStyle=k===0?'#fff':'#ffc94a'; x.font='700 21px Helvetica,Arial,sans-serif'; x.fillText(t,k===0?52:76+k*42,292+r*34);}));
    return tex(c);
  })();
  V.mats.facade=std({map:V.tex.facade,side:THREE.DoubleSide});
  V.mats.letters=std({map:V.tex.letters,transparent:true,alphaTest:.3,side:THREE.DoubleSide,roughness:.5});
  V.mats.ribbon=std({map:V.tex.ribbon,side:THREE.DoubleSide,roughness:.6});
  V.mats.board=std({map:V.tex.board,roughness:.6});

  // geometry
  const infield=L.runs(i=>REG[i]===0)[0], bleachers=L.runs(i=>REG[i]===1);
  const T1={o0:1,o1:32,h0:2.5,h1:11,steps:16,fascia:2.5,soffit:false,aisle:9,walk:-1};
  const T2={o0:22,o1:42,h0:16,h1:25,steps:11,fascia:3,soffit:true,sb:13,aisle:9,walk:-1};
  const T3={o0:34,o1:58,h0:30,h1:46,steps:16,fascia:3.5,soffit:true,sb:30,aisle:9,walk:5};
  const TB={o0:1,o1:26,h0:2.6,h1:15,steps:14,fascia:2.6,soffit:false,aisle:11,walk:-1};
  const kbBase=new KB();
  for(let i=0;i<N;i++){quadAt(kbBase,L,i,0,0,0,2.6,K.wall); quadAt(kbBase,L,i,0,2.6,.6,2.6,K.wallTop); band(kbBase,L,i,()=>[0,.03],ii=>[bo[ii],.03],REG[i]===2?K.mpark:K.ground);}
  kbBase.mesh(V,V.G.base);
  const kbLow=new KB(); tier(kbLow,L,infield,T1); bleachers.forEach(r=>tier(kbLow,L,r,TB)); kbLow.mesh(V,V.G.lower);
  const kbMid=new KB(); tier(kbMid,L,infield,T2); kbMid.mesh(V,V.G.middle);
  const kbUp=new KB(); tier(kbUp,L,infield,T3); kbUp.mesh(V,V.G.upper);
  const kbCr=new KB();
  for(let i=infield[0];i<infield[1];i++){quadAt(kbCr,L,i,48,49.6,59,47.6,K.canopy); quadAt(kbCr,L,i,48,48.7,59,46.7,K.soffit); quadAt(kbCr,L,i,48,48.7,48,49.6,K.canopy); quadAt(kbCr,L,i,59,46,59,47.6,K.back);}
  kbCr.mesh(V,V.G.crown);
  const kbFac=new KB();
  for(let i=0;i<N;i++){band(kbFac,L,i,ii=>[bo[ii],fh[ii]],ii=>[fo[ii],fh[ii]],K.roof); if(st[i]<fh[i]-.2 && st[L.w(i+1)]<fh[L.w(i+1)]-.2) band(kbFac,L,i,ii=>[bo[ii],st[ii]],ii=>[bo[ii],fh[ii]],K.inner);}
  kbFac.mesh(V,V.G.facade);
  let tot=0; for(let i=0;i<N;i++){const a=L.pos(i,fo[i],0),b=L.pos(i+1,fo[L.w(i+1)],0); tot+=Math.hypot(b[0]-a[0],b[2]-a[2]);}
  const fm=new THREE.Mesh(genStrip(L,closedIdx(L),i=>fo[i],()=>0,i=>fh[i],tot/Math.round(tot/10)),V.mats.facade); fm.castShadow=fm.receiveShadow=true; V.G.facade.add(fm); V.edgeTargets.push(fm);
  const iHome=L.idxAtPhi(0), hIdx=[iHome]; {let acc=0,k=0; while(acc<24){k++; const a=L.pos(iHome+k-1,fo[L.w(iHome+k-1)],0),b=L.pos(iHome+k,fo[L.w(iHome+k)],0); acc+=Math.hypot(b[0]-a[0],b[2]-a[2]); hIdx.push(iHome+k); hIdx.unshift(iHome-k);}}
  V.letters=new THREE.Mesh(genStrip(L,orient(L,hIdx,true),i=>fo[L.w(i)]+.3,()=>23.1,()=>26.5,'fit'),V.mats.letters); V.G.facade.add(V.letters);
  const inIdx=range(infield[0],infield[1]);
  V.G.middle.add(new THREE.Mesh(genStrip(L,orient(L,inIdx,false),()=>21.9,()=>13.4,()=>15.6,80),V.mats.ribbon));
  V.G.upper.add(new THREE.Mesh(genStrip(L,orient(L,inIdx,false),()=>33.9,()=>27,()=>29.6,80),V.mats.ribbon));
  V.G.crown.add(new THREE.Mesh(genStrip(L,inIdx,()=>47.9,()=>44.9,()=>49.6,6),mats.frieze));
  bleachers.forEach(r=>V.G.lower.add(new THREE.Mesh(genStrip(L,range(r[0],r[1]),()=>25.8,()=>15.1,()=>18.9,6),mats.frieze)));
  addField(V,L,V.tex.field,FX);
  [[dL,nL],[dR,nR]].forEach(([d,n])=>{const s=18,o=17-16*(s-8)/89-1.5,m=new THREE.Mesh(new THREE.BoxGeometry(3,1.1,17),mats.accent);
    m.position.set(s*d[0]+o*n[0],.55,s*d[1]+o*n[1]); m.rotation.y=Math.atan2(d[0],d[1]); m.castShadow=m.receiveShadow=true; V.G.base.add(m); V.edgeTargets.push(m);});
  const yawIn=i=>Math.atan2(-L.NR[i][0],-L.NR[i][1]);
  {const e=new THREE.Mesh(new THREE.BoxGeometry(30,9,8),mats.dark),p=L.pos(0,5.5,4.5); e.position.set(...p); e.rotation.y=yawIn(0); e.castShadow=e.receiveShadow=true; V.G.base.add(e); V.edgeTargets.push(e);
   const iM=L.idxAtPhi(-172); for(let k=0;k<6;k++){const q=L.pos(iM+k*2,3.2+(k%2)*2.4,.4),b=new THREE.Mesh(new THREE.BoxGeometry(1.1,.8,.5),mats.monument); b.position.set(...q); b.rotation.y=yawIn(iM); b.castShadow=true; V.G.base.add(b);}
   const sb=new THREE.Group(),q=L.pos(0,22,0); sb.position.set(q[0],0,q[2]); sb.rotation.y=yawIn(0);
   const board=new THREE.Mesh(new THREE.BoxGeometry(32,17,2.4),[mats.dark,mats.dark,mats.dark,mats.dark,V.mats.board,mats.dark]); board.position.y=30.5; board.castShadow=true; sb.add(board); V.edgeTargets.push(board);
   [-10,10].forEach(xx=>{const c=new THREE.Mesh(new THREE.BoxGeometry(1.6,22,1.6),mats.dark); c.position.set(xx,11,-.4); c.castShadow=true; sb.add(c);});
   const fg=new THREE.PlaneGeometry(33,3.2),fu=fg.attributes.uv; for(let v=0;v<fu.count;v++) fu.setX(v,fu.getX(v)*33/6);
   const fr=new THREE.Mesh(fg,mats.frieze); fr.position.set(0,40.6,1.25); sb.add(fr); V.G.base.add(sb);}
  for(let i=infield[0]+6;i<infield[1]-4;i+=16){const m=new THREE.Mesh(new THREE.BoxGeometry(6,3,.7),mats.lights),q=L.pos(i,54,50.4); m.position.set(...q); m.rotation.set(.45,yawIn(i),0,'YXZ'); m.castShadow=true; V.G.crown.add(m); V.edgeTargets.push(m);}
  const outline=range(0,N-1).map(i=>{const q=L.pos(i,plinthOff[i],0); return [q[0],q[2]];});
  addGrounds(V,outline); V.outline=outline;
  const spots=[]; for(let i=0;i<N;i+=6){if(Math.abs(L.PHI[i])<16) continue; const o=fo[i]+7+((i/6)%2)*6; if(o>plinthOff[i]-4) continue; const q=L.pos(i,o,0); spots.push([q[0],q[2],.8+.45*Math.abs(Math.sin(i*12.9898))]);}
  addTrees(V,spots);
  V.road=new THREE.Mesh(genRing(L,closedIdx(L),i=>fo[i]+5,i=>fo[i]+16,.09,24),mats.road); V.road.receiveShadow=true; V.G.base.add(V.road);
  V.EXP={base:0,lower:0,facade:0,middle:24,upper:50,crown:84,under:0};

  // labels + sightlines
  const iA=L.idxAtPhi(-72),iB=L.idxAtPhi(-104),iF=L.idxAtPhi(30);
  V.labels.exploded=[{g:'crown',p:L.pos(iA,50,49),t:'Canopy, frieze & light banks'},{g:'upper',p:L.pos(iA,46,40),t:'Grandstand · 400 level'},{g:'middle',p:L.pos(iA,32,21),t:'Main & Terrace · 200 to 300 levels'},{g:'facade',p:L.pos(iF,fo[iF],28),t:'Limestone facade & Great Hall'},{g:'lower',p:L.pos(iB,14,7),t:'Field level · 100s & bleachers'}];
  const iL=L.cross('z',-40,-1), iR=L.cross('z',-40,1);
  const row=(T,s)=>{const dO=(T.o1-T.o0)/T.steps,dH=(T.h1-T.h0)/(T.steps-1); return L.pos(iL,T.o0+(s+.5)*dO,T.h0+s*dH+1.2);};
  addSight(V,[row(T1,3),row(T1,13),row(T2,6),row(T3,4),row(T3,14)],L.pos(iL,-4,.3));
  // blueprint cross section: the stands' real outlines where the cut line crosses the third-base side
  V.sheet.profile=[SS.tierProfile(L,iL,T1),SS.tierProfile(L,iL,T2),SS.tierProfile(L,iL,T3),[L.pos(iL,-30,0),L.pos(iL,fo[iL]+12,0)],[L.pos(iL,fo[iL],0),L.pos(iL,fo[iL],fh[iL])]];
  V.labels.section=[{p:L.pos(iL,52,49.6),t:'Canopy & frieze'},{p:row(T3,10),t:'Grandstand · 400 level'},{p:row(T2,8),t:'Main & Terrace levels'},{p:row(T1,9),t:'Field level · 100s'},
    {p:L.pos(iL,-4,.3),t:'Sightline focal point'},{p:L.pos(iR,fo[iR],18),t:'Limestone facade'},{p:[30,-18,-40],t:'Foundations'}];
  // ---------------------------------------------------------------- the real neighborhood (data/fetch_venue.py yankee), lined up by the real field
  const D=(window.STADIUM_DATA||{}).yankee||null;
  if(D){
    const fld=(D.pitches||[]).find(p=>p.sport==='baseball');
    let F=fld?fld.pts.slice():null; if(F&&F[0][0]===F[F.length-1][0]&&F[0][1]===F[F.length-1][1]) F.pop();
    if(F&&F.length>3){
      // home plate: the corner of the real field outline that sees the rest of the field in the narrowest wedge (about 90 degrees)
      let hp=F[0],best=1e9;
      F.forEach(v=>{const a=F.filter(q=>Math.hypot(q[0]-v[0],q[1]-v[1])>5).map(q=>Math.atan2(q[1]-v[1],q[0]-v[0])).sort((x,y)=>x-y); if(a.length<3) return;
        let gap=a[0]+TAU-a[a.length-1]; for(let i=1;i<a.length;i++) gap=Math.max(gap,a[i]-a[i-1]); if(TAU-gap<best){best=TAU-gap; hp=v;}});
      const c=SS.centroid(F), d=[c[0]-hp[0],c[1]-hp[1]], phi=Math.atan2(d[0],-d[1]), cp=Math.cos(phi), sp=Math.sin(phi);
      // turn and slide the real world so its home plate and center field match the model's (home plate at 0,0, center field toward -z)
      V.world=new THREE.Group(); V.world.rotation.y=phi; V.world.position.set(-(hp[0]*cp+hp[1]*sp),0,-(-hp[0]*sp+hp[1]*cp)); V.G.base.add(V.world);
      V.city=new THREE.Group(); V.world.add(V.city); V.hidePlinthInCity=true;
      const old=V.trees; SS.buildCity(V,D,V.city,{box:D.box}); if(old&&old!==V.trees) old.parent.remove(old);
      // the 4 train on its elevated track over River Avenue, running to the real evening schedule
      const el=SS.buildEl(V,D,V.city,{y:10});
      if(el){V.elLine=[]; for(let s=0;s<=el.L;s+=10){const q=el.at(s); V.elLine.push([q.x,el.y+2.5,q.z]);}}   // for the design layer
      const T=(D.transit||[])[0];
      if(el&&el.station!=null&&T){
        const moves=T.moves.filter(m=>m.line==='4'), tm=std({map:trainTex('#3a3f47','#00933c'),roughness:.4}), endM=std({color:lin('#9da3ab')});
        tm.map.repeat.set(10,1); tm.userData.map=tm.map; V.trainMats=[tm];
        const ease2=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2, s0=el.station;
        const geo=new THREE.BoxGeometry(150,3.6,2.9); V.trains=[];
        // one train per stop at 161 St; called again with live MTA data (N = uptown, S = downtown)
        const makeTrains=list=>{V.trains.forEach(T=>V.city.remove(T.mesh)); V.trains=list.map(mv=>{const m=new THREE.Mesh(geo,[endM,endM,endM,endM,tm,tm]); m.visible=false; m.castShadow=true; V.city.add(m); return {mesh:m,mv,sg:(mv.dir==='1'||mv.dir==='S')?-1:1};});};
        makeTrains(moves); V.resetTrains=()=>makeTrains(moves);
        V.setLive=(arr,base)=>makeTrains((arr||[]).filter(a=>a.line==='4').map(a=>({min:(a.t-base)/60,dir:a.dir,line:'4'})));
        V.trainAt=t=>{V.trains.forEach(T=>{let s=null; for(const sh of [0,60,-60]){const u=t+sh,m=T.mv.min; if(u<m-1.6||u>m+2.1) continue;
            s=u<m?s0-T.sg*(1-ease2((u-(m-1.6))/1.6))*260:u<m+.5?s0:s0+T.sg*ease2((u-m-.5)/1.6)*260;}
          const ok=s!==null&&s>8&&s<el.L-8; T.mesh.visible=ok; if(ok){const p=el.at(s); T.mesh.position.set(p.x+Math.cos(p.yaw)*T.sg*2.2,el.y+3.2,p.z-Math.sin(p.yaw)*T.sg*2.2); T.mesh.rotation.y=p.yaw-Math.PI/2;}});};
        const h0=T.hours[0]; V.drawBoard=(t,live)=>{if(live) return live; const hh=h0+Math.floor(t/60),mm=Math.floor(t)%60; return `${hh>12?hh-12:hh}:${String(mm).padStart(2,'0')} ${hh>=12?'PM':'AM'}`;};
        V.trainShown=()=>V.city.visible; V.trainLabel='4 train at 161 St–Yankee Stadium'; V.trainDate=T.date; V.liveStation='yankee';
      }
    }
  }
  // cameras + lights
  const iS=L.idxAtPhi(-36); V.skipStyles=['cutaway']; V.camOv.iso={size:150,tgt:[0,6,0]}; V.camOv.bowl={abs:true,pos:L.pos(iS,13,2.5+(12/31)*8.5+1.3),tgt:[34,14,-46],fov:58};
  V.camOv.bowlUp={abs:true,pos:[0,1.8,5],tgt:[0,9,-120],fov:68};   // from home plate, looking out to the bleachers
  V.bowlOpts=[['seat','Seats'],['up','Home plate, look out']];
  // design layer sets (engine/layer.js). Home plate is at 0,0 and center field points toward -z;
  // the outfield distances are the posted ones (LF 318 ft, CF 408 ft, RF 314 ft), laid along the foul lines
  {const M=ft=>ft/3.28084, d45=Math.SQRT1_2, back=V.outline.reduce((a,q)=>q[1]>a[1]?q:a,V.outline[0]);
    const lf=[-M(318)*d45,1,-M(318)*d45], cf=[0,1,-M(408)], rf=[M(314)*d45,1,-M(314)*d45];
    V.layers=[
      {key:'facts',name:'Facts',items:[
        {type:'outline',pts:V.outline,y:.6},
        {type:'label',p:[back[0],30,back[1]],slot:'top',title:'YANKEE STADIUM',sub:['OPENED 2009 · BUILT FOR $2.3 BILLION']}]},
      {key:'field',name:'Field',items:[
        {type:'dim',a:[0,1,0],b:lf,text:'318 FT'},
        {type:'dim',a:[0,1,0],b:cf,text:'408 FT'},
        {type:'dim',a:[0,1,0],b:rf,text:'314 FT'},
        {type:'label',p:rf,slot:'low',small:true,title:'THE SHORT PORCH',sub:['RIGHT FIELD LINE: 314 FT','LEFT FIELD LINE: 318 FT']}]}
    ];
    if(V.elLine&&V.elLine.length>1){const mid=V.elLine[Math.floor(V.elLine.length/2)];
      V.layers.push({key:'train',name:'4 train',items:[
        {type:'path',pts:V.elLine,space:'world',flow:true},
        {type:'label',p:mid,space:'world',slot:'top',small:true,title:'THE 4 TRAIN',sub:['ELEVATED OVER RIVER AVENUE','161 ST–YANKEE STADIUM STATION']}]});}
  }
  V.pointPos.night=[[-75,75,-5],[75,75,-5],[-55,75,-95],[55,75,-95]];
  return V;
}

SS.builders.push(buildYankee);
})();
