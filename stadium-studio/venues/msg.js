/* Venue recipe: Madison Square Garden + Penn Station. Uses the shared helpers from engine/core.js. */
(function(){
'use strict';
if(!window.SS||!SS.ok) return;
const {$,app,stage,canvas,loading,labelsEl,renderer,maxAniso,reduceMotion,deg,TAU,lin,scene,mk,tex,CLIP_ABOVE,CLIP_UNDER,std,stadMat,underMat,mats,K,KFALL,KB,boxKB,resample,makeLoop,range,band,quadAt,tier,genStrip,genRing,orient,closedIdx,lettersTex,ribbonTex,friezeTex,roadTex,woodTex,strataTex,trainTex,SH,VENUES,newVenue,rrect,boundsOf,extrudeOutline,addGrounds,addTrees,addField,addSight}=SS;
/* =====================================================================
   VENUE 2: Madison Square Garden + Penn Station
===================================================================== */
function buildMSG(){
  // Real-world data from data/fetch_msg.py (NYC Open Data, OpenStreetMap, LIRR, NHL, Wikidata). Falls back to a plain arena if missing.
  const D=(window.STADIUM_DATA||{}).msg||null;
  const R=D?D.drum.R:64.5, HT=D?D.drum.h:44.4;       // drum radius at street level, roof height (city data)
  const Rw=R-1.4, Hw=HT-7.2, Ri=R-3;                    // wall behind the fins, top of the fins, inside face
  const BOX=D?D.box:[-110,110,-90,90];
  const opened=D&&D.facts.opened?new Date(D.facts.opened+'T12:00'):null;
  const V=newVenue('msg',{name:'Madison Square Garden',eyebrow:D?'3D study · Midtown Manhattan · built from city data':'3D study · Midtown Manhattan',
    spec:[opened?'Opened '+opened.getFullYear():'Opened 1968',`Drum ${Math.round(R*2)} m across`,'Above Penn Station'],
    center:new THREE.Vector3(0,0,0),scale:1,indoor:true,station:!!D,Ri,studio:{bg:'#13408f',seat:'#0038a8',trim:'#c8102e'},cut:{x:0,z:0},section:{axis:'x',c:0},
    dayK:{ceil:'#d6b083',ceil2:'#c39c6d',beam:'#4a3a2b',seat:'#1d1e23',seat2:'#1d1e23',aisle:'#3b3d43',walk:'#3b3d43',riser:'#2a2b30',fascia:'#0f1830',soffit:'#2c2e34',back:'#cdbf9f',cap:'#3a3c42',ground:'#2a2d33',inner:'#c9b994',roof:'#8f8b84',roofTop:'#7f7466',boards:'#f3f3f0',cable:'#34373e'},
    sheet:{title:'Madison Square Garden',addr:'4 Pennsylvania Plaza · New York, NY',elevDir:[.95,.24,.7],elevName:'Seventh Avenue elevation',planName:'Plan at the event level',secName:'Stands cross section',sec:{h:[-68,-12],y:[-2,47]},
      callouts:[{p:[0,0,0],t:'NHL rink'},{p:[0,10,24],t:'100 level'},{p:[-22,25,-46],t:'200 level'},{p:[-75,0,0],t:'8th Ave entrance'},{p:[62,0,-30],t:'7th Ave glass box'},{p:[-49,0,49],t:'Stair tower'},{p:[44,0,46],t:'The drum · 129 m'}],
      rows:[['Architect','Charles Luckman Associates'],['Roof engineer','Severud Associates'],['Cost','$123 million (1968)'],['Groundbreaking','October 29, 1964'],['Opened',opened?opened.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):'February 11, 1968'],
        ['Capacity',D&&D.facts.capacity?D.facts.capacity.toLocaleString('en-US')+' (basketball)':'19,812 (basketball)'],['Drum',`${Math.round(R*2)} m across · ${Math.round(HT)} m tall`],
        ['Drawn from','NYC Open Data, OpenStreetMap']]}});
  V.city=new THREE.Group(); V.G.base.add(V.city);
  const L=makeLoop(resample(rrect(33,15.5,11,3),320),[0,0]), N=L.N;
  const edge=L.P.map((p,i)=>{const n=L.NR[i],pn=p[0]*n[0]+p[1]*n[1],pp=p[0]*p[0]+p[1]*p[1]; return -pn+Math.sqrt(pn*pn-pp+Ri*Ri);});
  const yC=r=>HT-10.5+6.4*Math.pow(Math.min(r,Ri)/Ri,1.4);   // ceiling: sags toward the center ring, like the real cable roof
  V.yC=yC;
  /* Depths under the street (y = 0 is street level), shared by the station, trains, labels, sections and the 1910 era.
     Tracks: "The level of the track system below the street surface varies from 39 to 58 ft., and is from 7 to 10 ft.
     below mean high water" (Transactions of the ASCE, vol. 68, 1910, general description; data/penn1910/sources).
     Street at the Garden is about 35 ft above NAVD88 (NYC building footprints, ground_elevation); mean high water at
     the Battery is 1.96 ft NAVD88 today (NOAA station 8518750, 1983-2001 epoch), about 0.75 ft lower in 1910 (sea level
     rises about 2.8 mm a year). So top of rail is about 1.2 - 8.5 = -7.3 ft NAVD88, or 42 ft (12.9 m) below the street.
     LIRR concourse: 18 ft above the tracks (Wikipedia, Pennsylvania Station (1910-1963)). Upper concourse and the subway
     platforms are approximate (OpenStreetMap only gives their order: levels -1, -2, -3). */
  V.depth={rail:-12.9, plat:-11.7, slab:-13.45, lower:-12.9+5.49, upper:-3.9, irt:-6.4, ind:-9.2};
  // design layer sets (engine/layer.js). Sizes come from the city data above; feet = meters x 3.28084
  {const FT=m=>Math.round(m*3.28084), cap=D&&D.facts.capacity?D.facts.capacity:19812;
    const day=opened?opened.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}).toUpperCase():'FEB 11, 1968';
    const TY=V.depth.rail+.3;   // just above the rails (sourced depth, see V.depth)
    V.layers=[
      {key:'facts',name:'Facts',era:'today',items:[
        {type:'outline',circle:[0,0,R],y:HT+.3},
        {type:'span',c:[0,HT+34,0],r:R,text:`${FT(R*2)} FT ACROSS`},
        {type:'height',c:[0,0],r:R,y0:0,y1:HT,text:`${FT(HT)} FT`},
        {type:'label',p:[0,HT,0],slot:'top',title:'MADISON SQUARE GARDEN',sub:[`OPENED ${day} · ${cap.toLocaleString('en-US')} SEATS`]}]},
      {key:'under',name:'Underneath',era:'today',items:[
        ...[-36,-18,0,18,36].map((z,k)=>({type:'path',pts:[[-150,TY,z],[220,TY,z]],flow:true,color:k%2?'gold':'cyan',dir:k%2?-1:1,phase:k*9})),
        ...((D&&D.under&&D.under.entrances)||[]).filter((e,i,a)=>a.findIndex(f=>Math.hypot(f.p[0]-e.p[0],f.p[1]-e.p[1])<25)===i).slice(0,6)
          .map(e=>({type:'drop',a:[e.p[0],0,e.p[1]],b:[e.p[0],/A/.test(e.routes)?V.depth.ind:V.depth.irt,e.p[1]],color:/A/.test(e.routes)?'gold':'cyan'})),   // real MTA entrances
        // MTA hourly subway ridership (data.ny.gov 5wq4-mkjj), both 34 St-Penn Station complexes, Nov 1-14, 2026
        {type:'label',p:[150,TY,36],slot:'low',small:true,title:'TRAINS 42 FT UNDER THE ARENA',sub:['34 ST–PENN: 563,795 SUBWAY ENTRIES','NOV 1–14 · MTA DATA']}]}
    ];}
  const roofMat=std({vertexColors:true,flatShading:true,side:THREE.FrontSide});   // one-sided: roof seen from above, ceiling from below

  // ---------------------------------------------------------------- textures
  const FX={xmin:-40,zmin:-40,W:80};
  const rinkPath=(x,hx,hz,r)=>{x.beginPath(); x.moveTo(-hx+r,-hz); x.lineTo(hx-r,-hz); x.arcTo(hx,-hz,hx,-hz+r,r); x.lineTo(hx,hz-r); x.arcTo(hx,hz,hx-r,hz,r); x.lineTo(-hx+r,hz); x.arcTo(-hx,hz,-hx,hz-r,r); x.lineTo(-hx,-hz+r); x.arcTo(-hx,-hz,-hx+r,-hz,r); x.closePath();};
  const iceTex=bp=>{
    const S=2048,c=mk(S,S),x=c.getContext('2d'),k=S/FX.W; x.setTransform(k,0,0,k,-FX.xmin*k,-FX.zmin*k);
    const red=bp?'#ffffff':'#c8102e',blue=bp?'#ffffff':'#0b49a8';
    x.fillStyle=bp?'#1f3e70':'#2c2f35'; x.fillRect(-40,-40,80,80);
    if(!bp){const ice=x.createRadialGradient(0,0,2,0,0,34); ice.addColorStop(0,'#fbfdff'); ice.addColorStop(1,'#e9f1f7'); x.fillStyle=ice; rinkPath(x,30.5,13,8.5); x.fill();}
    x.save(); rinkPath(x,30.5,13,8.5); x.clip();
    if(bp){x.strokeStyle='#ffffff'; x.lineWidth=.12; [[-.15],[-7.62],[7.62]].forEach(([X])=>{x.beginPath(); x.moveTo(X,-13); x.lineTo(X,13); x.stroke();});}
    else{x.fillStyle=red; x.fillRect(-.15,-13,.3,26); x.fillStyle='rgba(255,255,255,.6)'; for(let z=-13;z<13;z+=.9) x.fillRect(-.05,z,.1,.4);
      x.fillStyle=blue; x.fillRect(-7.77,-13,.3,26); x.fillRect(7.47,-13,.3,26);}
    x.fillStyle=red; x.fillRect(-27.18,-13,.06,26); x.fillRect(27.12,-13,.06,26);
    x.strokeStyle=blue; x.lineWidth=bp?.1:.06; x.beginPath(); x.arc(0,0,4.57,0,TAU); x.stroke();
    x.strokeStyle=red; [[-21.03,-6.71],[-21.03,6.71],[21.03,-6.71],[21.03,6.71]].forEach(p=>{x.beginPath(); x.arc(p[0],p[1],4.57,0,TAU); x.stroke(); x.fillStyle=red; x.beginPath(); x.arc(p[0],p[1],.3,0,TAU); x.fill();});
    if(!bp){x.fillStyle='rgba(120,180,230,.7)'; [-1,1].forEach(s=>{x.beginPath(); x.arc(s*27.15,0,1.83,s>0?Math.PI/2:-Math.PI/2,s>0?Math.PI*1.5:Math.PI/2,false); x.fill();});
      // center-ice circle in the style of the real one (team marks left out on purpose)
      x.fillStyle='rgba(11,73,168,.18)'; x.beginPath(); x.arc(0,0,3.4,0,TAU); x.fill(); x.strokeStyle='rgba(11,73,168,.7)'; x.lineWidth=.14; x.beginPath(); x.arc(0,0,3.4,0,TAU); x.stroke();
      x.font='700 2.1px Helvetica,Arial,sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillStyle='rgba(11,73,168,.55)'; x.fillText('MADISON SQUARE GARDEN',0,9.4);}
    x.restore();
    x.strokeStyle=bp?'#ffffff':'#f0e04a'; x.lineWidth=bp?.14:.25; rinkPath(x,30.62,13.12,8.6); x.stroke();
    return tex(c);
  };
  V.tex.field=iceTex(false); V.tex.fieldBP=iceTex(true);
  // one bay of the drum (48 bays around): warm tan precast panel with fine vertical ribs, storefront glass at street level
  const bayW=TAU*Rw/48;
  const facadeT=night=>{
    const w=128,h=1024,c=mk(w,h),x=c.getContext('2d'),py=h/Hw,m=v=>h-v*py;
    if(!night){
      const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#c8a57a'); g.addColorStop(.75,'#bf9b6f'); g.addColorStop(1,'#b08d63'); x.fillStyle=g; x.fillRect(0,0,w,h);
      for(let X=10;X<w;X+=13){x.fillStyle='rgba(80,52,25,.16)'; x.fillRect(X,0,2,h); x.fillStyle='rgba(255,240,215,.12)'; x.fillRect(X+2,0,1,h);}
      for(let v=9;v<Hw;v+=7.2){x.fillStyle='rgba(70,45,20,.1)'; x.fillRect(0,m(v),w,2);}
      x.fillStyle='#e3dccd'; x.fillRect(0,m(5.4),w,py*.7);
      const sf=x.createLinearGradient(0,m(4.7),0,h); sf.addColorStop(0,'#3a434d'); sf.addColorStop(1,'#59636d'); x.fillStyle=sf; x.fillRect(0,m(4.7),w,py*4.7);
      x.fillStyle='rgba(255,226,170,.28)'; x.fillRect(8,m(3.8),w-16,py*2.6); x.fillStyle='#262b31'; for(let X=0;X<w;X+=32) x.fillRect(X,m(4.7),3,py*4.7);
    } else {
      x.fillStyle='#120d09'; x.fillRect(0,0,w,h);
      for(let X=10;X<w;X+=13){x.fillStyle='rgba(255,210,160,.05)'; x.fillRect(X,0,2,h);}
      const sf=x.createLinearGradient(0,m(4.7),0,h); sf.addColorStop(0,'#ffcf8a'); sf.addColorStop(1,'#ffb766'); x.fillStyle=sf; x.fillRect(0,m(4.7),w,py*4.7);
      x.fillStyle='#3a2a1a'; for(let X=0;X<w;X+=32) x.fillRect(X,m(4.7),3,py*4.7);
    }
    return tex(c,true);
  };
  V.tex.facade=facadeT(false); V.tex.facadeNight=facadeT(true); V.tex.facade.repeat.set(48,1); V.tex.facadeNight.repeat.set(48,1);
  V.tex.finGlow=(()=>{const c=mk(8,256),x=c.getContext('2d'),g=x.createLinearGradient(0,256,0,0); g.addColorStop(0,'#ffffff'); g.addColorStop(.55,'#d0d0d0'); g.addColorStop(1,'#7a7a7a'); x.fillStyle=g; x.fillRect(0,0,8,256); return tex(c);})();
  // windows: one tile is 8 bays (4 m) by 8 floors (3.6 m); the night tile lights a random mix of offices
  const winT=night=>{
    const c=mk(256,256),x=c.getContext('2d'); x.fillStyle=night?'#000':'#ffffff'; x.fillRect(0,0,256,256);
    let seed=night?7:3; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
    for(let i=0;i<8;i++) for(let j=0;j<8;j++){
      if(night){if(rnd()<.42){const t=rnd(); x.fillStyle=`rgba(255,${200+t*40|0},${130+t*60|0},${.55+t*.45})`; x.fillRect(i*32+5,j*32+7,22,17);}}
      else{x.fillStyle='#a3adb8'; x.fillRect(i*32+5,j*32+7,22,17); x.fillStyle='rgba(255,255,255,.2)'; x.fillRect(i*32+5,j*32+7,22,4);}
    }
    return tex(c,true,true);
  };
  V.tex.win=winT(false); V.tex.winNight=winT(true);
  V.mats.win=std({vertexColors:true,map:V.tex.win,roughness:.8});
  V.mats.glassWall=std({vertexColors:true,map:V.tex.win,roughness:.16,metalness:.55});   // curtain-wall glass: reflects the sky in the realistic views
  V.tex.pod=(()=>{const c=mk(64,256),x=c.getContext('2d'); x.fillStyle='#ffffff'; x.fillRect(0,0,64,256);
    for(let j=0;j<8;j++){x.fillStyle='#76808b'; x.fillRect(0,j*32+9,64,12); x.fillStyle='rgba(255,255,255,.18)'; x.fillRect(0,j*32+9,64,3); x.fillStyle='rgba(0,0,0,.25)'; for(let i=0;i<64;i+=16) x.fillRect(i,j*32+9,2,12);}
    return tex(c,true,true);})();
  V.mats.pod=std({vertexColors:true,map:V.tex.pod,roughness:.85});
  V.tex.letters=lettersTex('MADISON SQUARE GARDEN','700 96px "Helvetica Neue",Helvetica,Arial,sans-serif',()=>'#ffffff',14);
  V.tex.ribbon=ribbonTex(['NEW YORK RANGERS','★','MADISON SQUARE GARDEN','★',"THE WORLD'S MOST FAMOUS ARENA",'★'],'#0b1d3f','#e03a3e');
  V.tex.board=(()=>{
    const c=mk(640,320),x=c.getContext('2d'); x.fillStyle='#05070c'; x.fillRect(0,0,640,320);
    x.fillStyle='#0d1f4a'; x.fillRect(10,10,620,44); x.fillStyle='#fff'; x.font='700 26px Helvetica,Arial,sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('MADISON SQUARE GARDEN',320,33);
    const g=x.createLinearGradient(0,64,0,220); g.addColorStop(0,'#0038a8'); g.addColorStop(1,'#001d5c'); x.fillStyle=g; x.fillRect(10,64,620,156);
    x.fillStyle='#fff'; x.font='italic 800 72px Helvetica,Arial,sans-serif'; x.fillText('RANGERS',320,140); x.fillStyle='#ff4b55'; x.font='700 18px Helvetica,Arial,sans-serif'; x.fillText('LETS GO RANGERS',320,196);
    x.fillStyle='#0b1220'; x.fillRect(10,228,620,82);
    x.font='700 30px Helvetica,Arial,sans-serif'; x.fillStyle='#fff'; x.fillText('NYR',90,270); x.fillText('BOS',420,270); x.fillStyle='#ffc94a'; x.fillText('3',190,270); x.fillText('2',520,270);
    x.fillStyle='#8ea3c8'; x.font='600 18px Helvetica,Arial,sans-serif'; x.fillText('2ND · 14:22',305,270);
    const t=tex(c,true); t.repeat.set(4,1); return t;
  })();
  const screenTex=(lines)=>{const c=mk(512,384),x=c.getContext('2d'); const g=x.createLinearGradient(0,0,0,384); g.addColorStop(0,lines.bg[0]); g.addColorStop(1,lines.bg[1]); x.fillStyle=g; x.fillRect(0,0,512,384);
    x.textAlign='center'; x.textBaseline='middle'; lines.t.forEach(([s,f,col,y])=>{x.font=f; x.fillStyle=col; x.fillText(s,256,y);}); return tex(c);};
  V.tex.marquee=screenTex({bg:['#0b2f8a','#021a52'],t:[['MADISON SQUARE GARDEN','700 30px Helvetica,Arial,sans-serif','#ffffff',60],['RANGERS','italic 800 92px Helvetica,Arial,sans-serif','#ffffff',180],['TONIGHT · 7:00 PM','700 34px Helvetica,Arial,sans-serif','#ffc94a',300]]});
  V.tex.ad=screenTex({bg:['#1a1a1f','#3b0f18'],t:[["THE WORLD'S",'700 54px Helvetica,Arial,sans-serif','#ffffff',110],['MOST FAMOUS','700 54px Helvetica,Arial,sans-serif','#ffffff',180],['ARENA','800 86px Helvetica,Arial,sans-serif','#ff4b55',275]]});
  V.mats.facade=std({map:V.tex.facade});
  V.mats.letters=std({map:V.tex.letters,transparent:true,alphaTest:.3,side:THREE.DoubleSide,roughness:.5});
  V.mats.ribbon=std({map:V.tex.ribbon,side:THREE.DoubleSide,roughness:.6});
  V.mats.board=std({map:V.tex.board,roughness:.6});
  V.mats.marquee=std({map:V.tex.marquee,roughness:.5});
  V.mats.ad=std({map:V.tex.ad,roughness:.5});
  V.mats.ring=std({side:THREE.DoubleSide,roughness:.6});
  V.finMats=[std({}),std({}),std({})];

  // ---------------------------------------------------------------- the bowl (seats are all black, like the real arena)
  // 100 level from the glass, a band of suites, then the steep 200 level up to the drum wall (matched to the arena photos)
  const t1o1=i=>.4*(edge[i]-5);
  const T1={o0:1,o1:t1o1,h0:1.2,h1:10,steps:14,fascia:1.2,soffit:false,aisle:10,walk:-1,closed:true};
  const T2={o0:i=>t1o1(i)-1.5,o1:i=>edge[i]-4.5,h0:14.5,h1:34,steps:22,fascia:3,soffit:true,sb:10.2,aisle:10,walk:-1,closed:true,kSeat:K.seat2};
  const kbBase=new KB();
  for(let i=0;i<N;i++){quadAt(kbBase,L,i,-2.5,0,-2.5,1.07,K.boards); quadAt(kbBase,L,i,-2.6,1.07,-2.4,1.07,K.boards); band(kbBase,L,i,()=>[0,.03],ii=>[edge[ii],.03],K.ground);}
  boxKB(kbBase,[-8,.45,-14.3],[10,.9,2],0,K.fascia,K.fascia); boxKB(kbBase,[8,.45,-14.3],[10,.9,2],0,K.fascia,K.fascia); boxKB(kbBase,[0,.45,14.3],[8,.9,2],0,K.fascia,K.fascia);
  kbBase.mesh(V,V.G.base);
  V.G.base.add(new THREE.Mesh(genStrip(L,closedIdx(L),()=>-2.5,()=>1.07,()=>2.9,10),mats.glass));
  // dasher boards: white with sponsor-style panels (made-up names)
  V.tex.boards=(()=>{const c=mk(2048,64),x=c.getContext('2d'); x.fillStyle='#f7f7f4'; x.fillRect(0,0,2048,64); x.fillStyle='#e8e9e6'; x.fillRect(0,52,2048,12);
    const ads=[['GARDEN','#0b49a8'],['NEW YORK','#c8102e'],['PENN PLAZA','#1d1e23'],['SEVENTH AVE','#0b49a8'],['MIDTOWN','#c8102e'],['THE GARDEN','#1d1e23']];
    x.font='800 30px Helvetica,Arial,sans-serif'; x.textAlign='center'; x.textBaseline='middle'; ads.forEach(([t,col],k)=>{x.fillStyle=col; x.fillText(t,170+k*341,28);}); const t=tex(c,true); t.repeat.set(9,1); return t;})();
  V.mats.boards=std({map:V.tex.boards,side:THREE.DoubleSide,roughness:.5});
  V.G.base.add(new THREE.Mesh(genStrip(L,closedIdx(L),()=>-2.53,()=>.08,()=>1.02,'fit'),V.mats.boards));
  [-1,1].forEach(s=>{const g=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.22,1.83),mats.red); g.position.set(s*27.7,.61,0); g.castShadow=true; V.G.base.add(g);});
  addField(V,L,V.tex.field,FX);
  const kbLow=new KB(); tier(kbLow,L,[0,N],T1); kbLow.mesh(V,V.G.lower);
  const kbMid=new KB(); tier(kbMid,L,[0,N],T2); kbMid.mesh(V,V.G.middle);
  // suites: a band of dark glass boxes at the back of the 100 level, under the 200-level overhang
  V.tex.suites=(()=>{const c=mk(256,64),x=c.getContext('2d'); x.fillStyle='#14171d'; x.fillRect(0,0,256,64);
    for(let i=0;i<8;i++){const g=x.createLinearGradient(0,10,0,54); g.addColorStop(0,'#3a4250'); g.addColorStop(1,'#1d2129'); x.fillStyle=g; x.fillRect(i*32+3,10,26,44); x.fillStyle='rgba(255,214,150,.35)'; x.fillRect(i*32+5,36,22,14);}
    const t=tex(c,true); return t;})();
  V.mats.suites=std({map:V.tex.suites,side:THREE.DoubleSide,roughness:.4}); V.tex.suites.repeat.set(60,1);
  V.G.lower.add(new THREE.Mesh(genStrip(L,closedIdx(L),i=>t1o1(L.w(i))+.05,()=>10,()=>13.2,'fit'),V.mats.suites));
  // two blue LED rings: the front of the 200 level, and high up under the ceiling's edge
  V.G.middle.add(new THREE.Mesh(genStrip(L,orient(L,closedIdx(L),false),i=>T2.o0(L.w(i))-.08,()=>12.2,()=>14.2,80),V.mats.ribbon));
  const kbIn=new KB();
  for(let i=0;i<N;i++){band(kbIn,L,i,ii=>[edge[ii]-4.5,34],ii=>[edge[ii],34],K.walk); band(kbIn,L,i,ii=>[edge[ii]-.3,34],ii=>[edge[ii]-.3,HT-3.2],K.inner);}
  kbIn.mesh(V,V.G.middle);
  V.G.middle.add(new THREE.Mesh(genStrip(L,orient(L,closedIdx(L),false),i=>edge[L.w(i)]-.4,()=>34.8,()=>36,80),V.mats.ribbon));

  // ---------------------------------------------------------------- the drum outside
  const P=(r,a,y)=>[Math.sin(a)*r,y,Math.cos(a)*r];
  V.shell=new THREE.Group(); V.G.facade.add(V.shell); V.annex=new THREE.Group(); V.G.facade.add(V.annex);
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(Rw,Rw,Hw,192,1,true),V.mats.facade); wall.position.y=Hw/2; wall.castShadow=wall.receiveShadow=true; V.shell.add(wall); V.edgeTargets.push(wall);
  // 48 tall precast fins, in three groups so the night style can light them red, white and blue
  const finGeo=[[],[],[]];
  for(let k=0;k<48;k++){const a=k/48*TAU, g=new THREE.BoxGeometry(1.5,Hw+.6,R-Rw+.15); g.applyMatrix4(new THREE.Matrix4().makeRotationY(a).setPosition(Math.sin(a)*(Rw+(R-Rw)/2),(Hw+.6)/2,Math.cos(a)*(Rw+(R-Rw)/2))); finGeo[k%3].push(g.toNonIndexed());}
  finGeo.forEach((list,j)=>{const pos=[],nor=[],uv=[]; list.forEach(g=>{pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);});
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const m=new THREE.Mesh(g,V.finMats[j]); m.castShadow=m.receiveShadow=true; V.shell.add(m); V.edgeTargets.push(m);});
  // dark recessed band under the crown, with the cable anchors
  const kbGap=new KB();
  for(let s=0;s<192;s++){const a0=s/192*TAU,a1=(s+1)/192*TAU; kbGap.quad(P(Rw-.7,a0,Hw),P(Rw-.7,a1,Hw),P(Rw-.7,a1,HT-3),P(Rw-.7,a0,HT-3),K.gap); kbGap.quad(P(Rw-.7,a0,Hw),P(Rw-.7,a1,Hw),P(Rw,a1,Hw),P(Rw,a0,Hw),K.gap);}
  for(let k=0;k<48;k++){const a=k/48*TAU; boxKB(kbGap,[Math.sin(a)*(Rw+.2),(Hw+HT-3)/2,Math.cos(a)*(Rw+.2)],[.9,HT-3-Hw,.9],a,K.pier,K.pier);}
  kbGap.mesh(V,V.shell);
  // the bright white ring around the top (lit blue at night)
  const kbRing=new KB();
  for(let s=0;s<192;s++){const a0=s/192*TAU,a1=(s+1)/192*TAU;
    kbRing.quad(P(R+.4,a0,HT-3),P(R+.4,a1,HT-3),P(R+.4,a1,HT),P(R+.4,a0,HT),K.ring);
    kbRing.quad(P(R-3,a0,HT),P(R-3,a1,HT),P(R+.4,a1,HT),P(R+.4,a0,HT),K.ring);
    kbRing.quad(P(Rw-.7,a0,HT-3),P(Rw-.7,a1,HT-3),P(R+.4,a1,HT-3),P(R+.4,a0,HT-3),K.ring);
    kbRing.quad(P(R-3,a0,HT-1.4),P(R-3,a1,HT-1.4),P(R-3,a1,HT),P(R-3,a0,HT),K.ring);}
  V.ringMesh=kbRing.mesh(V,V.shell,V.mats.ring);

  // ---------------------------------------------------------------- roof (seen from outside)
  const kbRT=new KB(), up=[0,1,0], Rm=R-8, yd=r=>HT-2.3-.9*(1-r/Rm);
  for(let s=0;s<96;s++){const a0=s/96*TAU,a1=(s+1)/96*TAU;
    kbRT.quadF(P(R-3,a0,HT-1.4),P(R-3,a1,HT-1.4),P(Rm,a1,HT-1.4),P(Rm,a0,HT-1.4),K.roof,up);
    kbRT.quadF(P(Rm,a0,HT-1.4),P(Rm,a1,HT-1.4),P(Rm,a1,yd(Rm)),P(Rm,a0,yd(Rm)),K.roof,[-Math.sin(a0),0,-Math.cos(a0)]);
    for(let k=0;k<6;k++){const r0=7+(Rm-7)*k/6,r1=7+(Rm-7)*(k+1)/6; kbRT.quadF(P(r1,a0,yd(r1)),P(r1,a1,yd(r1)),P(r0,a1,yd(r0)),P(r0,a0,yd(r0)),K.roofTop,up);}
    kbRT.quadF(P(7,a0,yd(7)),P(7,a1,yd(7)),P(7,a1,HT-1.5),P(7,a0,HT-1.5),K.roof,[Math.sin(a0),0,Math.cos(a0)]);
    kbRT.triF([0,HT-1.5,0],P(7,a0,HT-1.5),P(7,a1,HT-1.5),K.unit,up);}
  V.roofMesh=kbRT.mesh(V,V.G.roof,roofMat); V.roofObjs.push(V.roofMesh);
  const kbUnits=new KB();
  for(let k=0;k<40;k++){const a=(k+.5)/40*TAU; boxKB(kbUnits,[Math.sin(a)*(R-5.5),HT-.6,Math.cos(a)*(R-5.5)],[2.6,1.6,1.8],a,K.unit,K.roof);}
  let sd=11; const rr=()=>((sd=(sd*16807)%2147483647)/2147483647);
  for(let k=0;k<26;k++){const a=rr()*TAU,r=12+rr()*(Rm-16); boxKB(kbUnits,[Math.sin(a)*r,yd(r)+.4,Math.cos(a)*r],[.9+rr(),.8,.9+rr()],a,K.unit,K.unit);}
  for(let k=0;k<6;k++){const a=k/6*TAU; boxKB(kbUnits,[Math.sin(a)*3.6,HT-1,Math.cos(a)*3.6],[1.6,1,1.6],a,K.roof,K.roof);}
  V.roofObjs.push(kbUnits.mesh(V,V.G.roof));

  // ---------------------------------------------------------------- ceiling (seen from inside): warm wood-toned slats, dark radial beams, two oval light rings
  const kbC=new KB(), dn=[0,-1,0], rings=12, Rin=7.5;
  for(let s=0;s<96;s++){const a0=s/96*TAU,a1=(s+1)/96*TAU,k=s%2?K.ceil2:K.ceil;
    for(let j=0;j<rings;j++){const r0=Rin+(Ri-Rin)*j/rings,r1=Rin+(Ri-Rin)*(j+1)/rings; kbC.quadF(P(r0,a0,yC(r0)),P(r0,a1,yC(r0)),P(r1,a1,yC(r1)),P(r1,a0,yC(r1)),k,dn);}
    kbC.quadF(P(Rin,a0,yC(Rin)-3),P(Rin,a1,yC(Rin)-3),P(Rin,a1,yC(Rin)),P(Rin,a0,yC(Rin)),K.cable,[Math.sin(a0),0,Math.cos(a0)]);
    kbC.triF([0,yC(Rin)-3,0],P(Rin,a0,yC(Rin)-3),P(Rin,a1,yC(Rin)-3),K.cable,dn);}
  V.ceilMesh=kbC.mesh(V,V.G.crown,roofMat); V.roofObjs.push(V.ceilMesh);
  const kbB=new KB(), E=(rx,rz,a,y)=>[Math.sin(a)*rx,y,Math.cos(a)*rz];
  for(let k=0;k<48;k++){const a=k/48*TAU;
    for(let j=0;j<rings;j++){const r0=Rin+(Ri-Rin)*j/rings,r1=Rin+(Ri-Rin)*(j+1)/rings; kbB.quad(P(r0,a,yC(r0)-.05),P(r1,a,yC(r1)-.05),P(r1,a,yC(r1)-1.3),P(r0,a,yC(r0)-1.3),K.beam);}}
  [22,38,52].forEach(r=>{for(let s=0;s<96;s++){const a0=s/96*TAU,a1=(s+1)/96*TAU; kbB.quad(P(r,a0,yC(r)-.05),P(r,a1,yC(r)-.05),P(r,a1,yC(r)-.7),P(r,a0,yC(r)-.7),K.beam);}});
  // two oval catwalk rings around the scoreboard, with lights and speaker clusters
  const ringsO=[[17,13.5],[29,23]];
  ringsO.forEach(([rx,rz])=>{const y=yC(Math.max(rx,rz))-3.6;
    for(let s=0;s<64;s++){const a0=s/64*TAU,a1=(s+1)/64*TAU,p0=E(rx,rz,a0,y),p1=E(rx,rz,a1,y),m=[(p0[0]+p1[0])/2,y,(p0[2]+p1[2])/2],l=Math.hypot(p1[0]-p0[0],p1[2]-p0[2]);
      boxKB(kbB,m,[l+.05,.7,1.4],Math.atan2(p1[0]-p0[0],p1[2]-p0[2])+Math.PI/2,K.cable,K.cable);}
    for(let s=0;s<10;s++){const a=s/10*TAU,p=E(rx,rz,a,y); boxKB(kbB,[p[0],(y+yC(Math.max(rx,rz)))/2,p[2]],[.15,yC(Math.max(rx,rz))-y,.15],0,K.cable,K.cable);}});
  for(let s=0;s<8;s++){const a=(s+.5)/8*TAU; boxKB(kbB,[Math.sin(a)*12,yC(12)-5,Math.cos(a)*12],[1.6,2.4,1.6],a,K.cable,K.cable);}
  V.roofObjs.push(kbB.mesh(V,V.G.crown));
  const lamps=new THREE.InstancedMesh(new THREE.BoxGeometry(.55,.35,.55),mats.lights,96), M4=new THREE.Matrix4();
  let li=0; ringsO.forEach(([rx,rz])=>{const y=yC(Math.max(rx,rz))-4.2; for(let s=0;s<48;s++){const a=s/48*TAU; M4.makeTranslation(Math.sin(a)*rx,y,Math.cos(a)*rz); lamps.setMatrixAt(li++,M4);}});
  V.G.crown.add(lamps); V.roofObjs.push(lamps);
  // banners in a row high up near the ceiling's edge: Rangers on one side, Knicks on the other (real numbers and seasons)
  const bannerTex=(top,big,small,c1,c2,c3)=>{const c=mk(128,288),x=c.getContext('2d'); x.fillStyle=c1; x.fillRect(0,0,128,288);
    x.fillStyle=c2; x.fillRect(0,0,128,14); x.fillRect(0,274,128,14); x.fillStyle=c3; x.fillRect(0,14,128,5);
    x.fillStyle=c2; x.textAlign='center'; x.textBaseline='middle'; x.font='700 19px Helvetica,Arial,sans-serif'; x.fillText(top,64,52);
    x.font=`800 ${big.length>3?38:84}px Helvetica,Arial,sans-serif`; x.fillText(big,64,150); x.font='700 16px Helvetica,Arial,sans-serif'; x.fillText(small,64,236); return tex(c);};
  const nyr=[['1','GIACOMIN'],['2','LEETCH'],['3','HOWELL'],['7','GILBERT'],['9','BATHGATE GRAVES'],['11','MESSIER HADFIELD'],['19','RATELLE'],['30','LUNDQVIST'],['35','RICHTER']].map(b=>bannerTex('RANGERS',b[0],b[1],'#f5f5f2','#0b2f86','#c8102e'))
    .concat(['1927-28','1932-33','1939-40','1993-94'].map(y=>bannerTex('STANLEY CUP',y,'CHAMPIONS','#0b2f86','#ffffff','#c8102e')));
  const nyk=[['10','FRAZIER'],['12','BARNETT'],['15','MONROE MCGUIRE'],['19','REED'],['22','DEBUSSCHERE'],['24','BRADLEY'],['33','EWING'],['613','HOLZMAN']].map(b=>bannerTex('KNICKS',b[0],b[1],'#0d4f9e','#ffffff','#f58426'))
    .concat(['1969-70','1972-73'].map(y=>bannerTex('NBA',y,'CHAMPIONS','#f58426','#ffffff','#0d4f9e')));
  V.bannerMats=[];
  const hang=(list,a0,a1)=>list.forEach((t,k)=>{const a=a0+(a1-a0)*(k+.5)/list.length,r=54,top=yC(r)-.4;
    const m=std({map:t,side:THREE.DoubleSide,roughness:.8}); m.userData.map=t; V.bannerMats.push(m);
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(2.1,4.7),m); pl.position.set(Math.sin(a)*r,top-2.35,Math.cos(a)*r); pl.rotation.y=a+Math.PI; V.G.crown.add(pl); V.roofObjs.push(pl);});
  hang(nyr,Math.PI*.58,Math.PI*1.42); hang(nyk,-Math.PI*.36,Math.PI*.36);
  // the flag, hanging near the scoreboard
  V.tex.flag=(()=>{const c=mk(190,100),x=c.getContext('2d'); for(let i=0;i<13;i++){x.fillStyle=i%2?'#ffffff':'#b22234'; x.fillRect(0,i*100/13,190,100/13+1);} x.fillStyle='#3c3b6e'; x.fillRect(0,0,76,54);
    x.fillStyle='#ffffff'; for(let i=0;i<9;i++) for(let j=0;j<(i%2?5:6);j++) x.fillRect(5+j*12.5+(i%2?6:0),4+i*5.5,2.2,2.2); return tex(c);})();
  const fm=std({map:V.tex.flag,side:THREE.DoubleSide,roughness:.9}); fm.userData.map=V.tex.flag; V.bannerMats.push(fm);
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(5.6,3),fm); flag.position.set(-22,yC(24)-2.4,-8); flag.rotation.y=Math.PI/2.6; V.G.crown.add(flag); V.roofObjs.push(flag);

  // ---------------------------------------------------------------- the oval center-hung scoreboard + Chase Bridges
  V.hang=new THREE.Group(); V.G.upper.add(V.hang);
  const oval=(r,h,open)=>{const g=new THREE.CylinderGeometry(r,r,h,48,1,open); g.scale(1.35,1,1); return g;};
  const sb=new THREE.Mesh(oval(8,9,false),[V.mats.board,mats.dark,V.mats.board]); sb.position.y=24.6; sb.castShadow=true; V.hang.add(sb); V.edgeTargets.push(sb);
  V.tex.sbTop=lettersTex('MADISON SQUARE GARDEN   ·   MADISON SQUARE GARDEN','700 86px "Helvetica Neue",Helvetica,Arial,sans-serif',()=>'#f2c14e',10);
  V.mats.sbTop=std({map:V.tex.sbTop,emissive:lin('#ffffff'),emissiveMap:V.tex.sbTop,emissiveIntensity:.5,roughness:.5});
  const top=new THREE.Mesh(oval(8.2,1.5,true),V.mats.sbTop); top.position.y=29.9; V.hang.add(top);
  const bot=new THREE.Mesh(oval(8.25,.8,true),V.mats.ribbon); bot.position.y=19.8; V.hang.add(bot);
  const kbBr=new KB();
  [-1,1].forEach(s=>{const zc=s*44;
    boxKB(kbBr,[0,35,zc],[70,1.6,4.4],0,K.riser,K.fascia,K.soffit);
    for(let k=0;k<2;k++){const h=(k+1)*.5; boxKB(kbBr,[0,35.8+h/2,zc+s*(.6-k*1.2)],[68,h,1.1],0,K.seat,K.riser);}
    boxKB(kbBr,[0,36.4,zc-s*2.1],[70,1.2,.12],0,K.cable,K.cable);
    [-30,-15,0,15,30].forEach(x=>{const top=yC(Math.hypot(x,zc)); boxKB(kbBr,[x,(36+top)/2,zc],[.3,top-36,.3],0,K.cable,K.cable);});});
  [[-6,-4],[6,-4],[-6,4],[6,4]].forEach(([x,z])=>boxKB(kbBr,[x,(30.6+yC(7.5)-3)/2,z],[.3,yC(7.5)-3-30.6,.3],0,K.cable,K.cable));
  kbBr.mesh(V,V.hang);

  // ---------------------------------------------------------------- buildings: walls get a window texture, roofs are flat
  // buildings: the shared city kit in engine/core.js
  const blocks=(list,group,mat)=>SS.blocks(V,list,group,mat);
  if(D){
    // the arena's own block: city outline (minus the drum) as a low base, OpenStreetMap building parts on top
    const minD=Math.min(...D.complex.map(p=>Math.hypot(p[0],p[1]))), hr=Math.min(R-1.3,minD-1);
    const hole=[]; for(let k=0;k<96;k++){const a=-k/96*TAU; hole.push([Math.cos(a)*hr,Math.sin(a)*hr]);}
    blocks([{pts:D.complex,hole,h:9,k:K.podium,kt:K.nbrTop,skipEdge:(a,c)=>Math.hypot(a[0],a[1])<R+1&&Math.hypot(c[0],c[1])<R+1}],V.annex,V.mats.pod);
    const own=[],tall=[];V.glassBoxes=[];
    D.parts.forEach(p=>{const cx=p.pts.reduce((s,q)=>s+q[0],0)/p.pts.length,cz=p.pts.reduce((s,q)=>s+q[1],0)/p.pts.length,h=parseFloat(p.h)||20;
      if(Math.hypot(cx,cz)<20) return;                         // the drum: built above
      const b={pts:p.pts,h,minh:parseFloat(p.minh)||0,k:K.podium,kt:K.nbrTop};
      if(h>80||cx>100){if(h>80) b.k=K.curtain; tall.push(b);}            // Two Penn Plaza and its base belong to the city, not the arena icon
      else{ if(h>=44&&cx>40&&Math.abs(cz)<40){b.k=K.curtain; V.glassBoxes.push(Object.assign({cx,cz},b));} own.push(b);}});
    if(!V.cityNew){V.cityNew=new THREE.Group(); V.city.add(V.cityNew);}   // Two Penn Plaza (1968) belongs to today only
    blocks(own.filter(b=>b.k!==K.curtain),V.annex,V.mats.pod); blocks(own.filter(b=>b.k===K.curtain),V.annex,V.mats.glassWall); blocks(tall.filter(b=>b.k!==K.curtain),V.cityNew,V.mats.pod); blocks(tall.filter(b=>b.k===K.curtain),V.cityNew,V.mats.glassWall);
    // video screens on the two 7th Avenue glass boxes
    V.glassBoxes.forEach((b,k)=>{const xs=b.pts.map(p=>p[0]),zs=b.pts.map(p=>p[1]),zw=Math.max(...zs)-Math.min(...zs);
      const s=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(zw*.82,15),10.5),k?V.mats.ad:V.mats.marquee); s.position.set(Math.max(...xs)+.2,26,b.cz); s.rotation.y=Math.PI/2; V.annex.add(s); V.roadHide.push(s);});
    // the neighborhood: real buildings, streets, sidewalks, census trees, signals, subway entrances (shared city kit)
    // buildings newer than 1910 go in their own group, so the 1910 era (venues/msg-1910.js) can hide them
    if(!V.cityNew){V.cityNew=new THREE.Group(); V.city.add(V.cityNew);}
    SS.buildCity(V,D,V.city,{skipBins:['1083026'],box:BOX,split:yr=>!yr||yr>1910,splitParent:V.cityNew,
      walkSplit:pts=>{const c=SS.centroid(pts), gr=D.grid; return c[0]<gr.x_hi-14&&c[1]>gr.z_lo+8&&c[1]<gr.z_hi-8;}});   // the Garden's plaza is today-only
  }
  // "Madison Square Garden" letters over the 8th Avenue entrance
  V.letters=new THREE.Mesh(new THREE.PlaneGeometry(30,2.4),V.mats.letters); V.letters.position.set(-R-6.6,21.2,0); V.letters.rotation.y=-Math.PI/2; V.annex.add(V.letters);
  if(D){const cen=p=>[p.pts.reduce((s,q)=>s+q[0],0)/p.pts.length,p.pts.reduce((s,q)=>s+q[1],0)/p.pts.length], w=D.parts.filter(p=>cen(p)[0]<-60).sort((a,b)=>Math.abs(cen(a)[1])-Math.abs(cen(b)[1]))[0]; if(w){V.letters.position.x=Math.min(...w.pts.map(p=>p[0]))-.25; V.letters.position.y=Math.min(parseFloat(w.h)||23,23)-2.4;}}

  // ---------------------------------------------------------------- ground block, trees, road
  const rx=(a,b,c,d,r)=>{const pts=[]; [[b-r,d-r,0],[a+r,d-r,90],[a+r,c+r,180],[b-r,c+r,270]].forEach(([cx,cz,a0])=>{for(let t=a0;t<=a0+90;t+=10) pts.push([cx+r*Math.cos(t*deg),cz+r*Math.sin(t*deg)]);}); return pts;};
  addGrounds(V,rx(BOX[0],BOX[1],BOX[2],BOX[3],10));
  if(!V.trees){V.trees=new THREE.Group(); V.G.base.add(V.trees);}
  V.road=new THREE.Group(); V.G.base.add(V.road);
  // the lot for the iso map icons: the arena's own block, cut out like a little island (curb, sidewalk, its real street trees)
  {const cx=D?D.complex.map(p=>p[0]):[-R,R], cz=D?D.complex.map(p=>p[1]):[-R,R];
   const x0=D&&D.grid.x_lo!=null?D.grid.x_lo+11:Math.min(...cx)-12, x1=Math.max(...cx)+14, z0=D&&D.grid.z_lo!=null?D.grid.z_lo+9:Math.min(...cz)-12, z1=D&&D.grid.z_hi!=null?D.grid.z_hi-9:Math.max(...cz)+12;
   V.lot=new THREE.Group(); V.G.base.add(V.lot); V.lot.visible=false;
   V.mats.lotTop=std({roughness:.95}); V.mats.lotSide=std({roughness:.95}); V.mats.lotEdge=std({roughness:.9});
   const top=new THREE.Mesh(extrudeOutline(rx(x0,x1,z0,z1,8),4,.6),[V.mats.lotTop,V.mats.lotSide]); top.receiveShadow=top.castShadow=true; V.lot.add(top); V.edgeTargets.push(top);
   const curb=new THREE.Mesh(extrudeOutline(rx(x0-1.6,x1+1.6,z0-1.6,z1+1.6,9.5),4.4,0),[V.mats.lotEdge,V.mats.lotSide]); curb.position.y=-.18; curb.receiveShadow=true; V.lot.add(curb);
   const spots=(D?D.trees:[]).filter(t=>t[0]>x0-4&&t[0]<x1+4&&t[1]>z0-4&&t[1]<z1+4&&Math.hypot(t[0],t[1])>R+2).map(t=>[Math.min(x1-2,Math.max(x0+2,t[0])),Math.min(z1-2,Math.max(z0+2,t[1]))]);
   const tr=new THREE.InstancedMesh(new THREE.CylinderGeometry(.35,.45,3.2,6),mats.trunk,Math.max(1,spots.length)), cr=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(3.6,1),mats.crown,Math.max(1,spots.length));
   const M=new THREE.Matrix4(); tr.count=cr.count=spots.length; spots.forEach(([x,z],k)=>{M.makeTranslation(x,1.6,z); tr.setMatrixAt(k,M); M.makeTranslation(x,5.6,z); cr.setMatrixAt(k,M);});
   tr.castShadow=cr.castShadow=true; V.lot.add(tr,cr);
   V.camOv.iso={size:Math.max(x1-x0,z1-z0)*.62,tgt:[(x0+x1)/2,10,(z0+z1)/2]};}

  // ---------------------------------------------------------------- Penn Station, from OpenStreetMap (real track and platform positions)
  if(D){
    const kbU=new KB(), lirr=D.platforms.filter(p=>!p.subway), sub=D.platforms.filter(p=>p.subway);
    const xs=lirr.flatMap(p=>p.pts.map(q=>q[0])), zs=lirr.flatMap(p=>p.pts.map(q=>q[1]));
    const PX=[Math.max(BOX[0],Math.min(...xs)),Math.min(BOX[1],Math.max(...xs))], PZ=[Math.min(...zs)-6,Math.max(...zs)+6];
    V.station={PX,PZ};
    const DP=V.depth;
    boxKB(kbU,[(PX[0]+PX[1])/2,DP.slab-.5,(PZ[0]+PZ[1])/2],[PX[1]-PX[0],1,PZ[1]-PZ[0]],0,K.track,K.slab);
    boxKB(kbU,[(PX[0]+PX[1])/2,DP.lower-.5,(PZ[0]-2)/2],[PX[1]-PX[0],1,-(PZ[0]-2)],0,K.slab,K.slab);    // LIRR concourse, 18 ft above the tracks: north half only, so the cutaway sees the platforms
    boxKB(kbU,[(PX[0]+PX[1])/2,DP.upper-.5,(PZ[0]-2)/2],[PX[1]-PX[0],1,-(PZ[0]-2)],0,K.slab,K.slab);    // upper concourse (approximate depth)
    const plat=(p,y0,y1)=>{const pts=p.pts[0][0]===p.pts[p.pts.length-1][0]&&p.pts[0][1]===p.pts[p.pts.length-1][1]?p.pts.slice(0,-1):p.pts; if(pts.length<3) return;
      const A=pts.reduce((s,q,i)=>{const r=pts[(i+1)%pts.length]; return s+q[0]*r[1]-r[0]*q[1];},0),sg=A>0?1:-1;
      pts.forEach((a,i)=>{const c=pts[(i+1)%pts.length]; kbU.quadF([a[0],y0,a[1]],[c[0],y0,c[1]],[c[0],y1,c[1]],[a[0],y1,a[1]],K.slab,[sg*(c[1]-a[1]),0,-sg*(c[0]-a[0])]);});
      THREE.ShapeUtils.triangulateShape(pts.map(q=>new THREE.Vector2(q[0],q[1])),[]).forEach(f=>kbU.triF([pts[f[0]][0],y1,pts[f[0]][1]],[pts[f[1]][0],y1,pts[f[1]][1]],[pts[f[2]][0],y1,pts[f[2]][1]],K.platform,up));};
    lirr.forEach(p=>plat(p,DP.slab,DP.plat));   // high platforms at car-floor height
    sub.forEach(p=>{const y=p.layer==='-2'?DP.ind:DP.irt; plat(p,y-1.1,y);});
    const strip=(pts,y,w,k)=>{for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,ox=-dz/l*w/2,oz=dx/l*w/2;
      kbU.quad([a[0]+ox,y,a[1]+oz],[b[0]+ox,y,b[1]+oz],[b[0]-ox,y,b[1]-oz],[a[0]-ox,y,a[1]-oz],k);}};
    D.rails.forEach(r=>{if(r.subway){strip(r.pts,(r.layer==='-2'?DP.ind:DP.irt)-1.15,1.6,K.track);} else strip(r.pts,DP.rail,1.6,K.cable);});
    // columns that hold up the street, standing on the platforms
    lirr.forEach(p=>{const cz=p.pts.reduce((s,q)=>s+q[1],0)/p.pts.length, pxs=p.pts.map(q=>q[0]); for(let xx=Math.min(...pxs)+12;xx<Math.max(...pxs)-6;xx+=26) boxKB(kbU,[xx,(DP.plat-.5)/2,cz],[1,-.5-DP.plat,1],0,K.slab,K.slab);});
    V.stationMesh=kbU.mesh(V,V.G.under,underMat);
    // every subway stair and elevator to the street (MTA open data): a stair dropping to its line, today only
    V.underNew=new THREE.Group(); V.G.under.add(V.underNew);
    {const kbE=new KB(), ents=((D.under&&D.under.entrances)||[]).filter(e=>e.p[0]>BOX[0]&&e.p[0]<BOX[1]&&e.p[1]>BOX[2]&&e.p[1]<BOX[3]);
      ents.forEach(e=>{const ace=/A/.test(e.routes), y1=(ace?DP.ind:DP.irt), [x,z]=e.p, toward=Math.sign((ace?-90:184)-x)||1, run=Math.abs(y1)*1.6;
        if(/Elevator/.test(e.type)){boxKB(kbE,[x,y1/2,z],[2.2,-y1,2.2],0,K.steel,K.steel); return;}
        for(let k=0;k<8;k++){const t0=k/8,t1=(k+1)/8; kbE.quadF([x+toward*run*t0,y1*t0,z-.9],[x+toward*run*t1,y1*t1,z-.9],[x+toward*run*t1,y1*t1,z+.9],[x+toward*run*t0,y1*t0,z+.9],K.steel,[0,1,0]);}
        boxKB(kbE,[x,.55,z],[2.4,1.1,.12],0,K.steel,K.steel);});
      if(kbE.p.length) kbE.mesh(V,V.underNew,underMat); V.entrances=ents;}
    [[-55,0],[15,2],[85,4]].forEach(([xx,k])=>{const p=lirr[Math.min(lirr.length-1,k*2+2)]; if(!p) return; const cz=p.pts.reduce((s,q)=>s+q[1],0)/p.pts.length;
      const drop=DP.lower-DP.plat, run=9; const m=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(run,drop),.8,3),mats.trainEnd); m.position.set(xx,(DP.lower+DP.plat)/2,cz); m.rotation.z=Math.atan2(drop,run); V.G.under.add(m);});   // stairs, concourse to platform
    // departures board (real LIRR times, redrawn as the clock runs)
    const bc=mk(512,128); V.depCanvas=bc; V.depMap=tex(bc);
    const dep=std({map:V.depMap,emissive:lin('#ffffff'),emissiveIntensity:.8},'under'); dep.emissiveMap=V.depMap;
    const db=new THREE.Mesh(new THREE.BoxGeometry(18,4.5,.5),[mats.dark,mats.dark,mats.dark,mats.dark,dep,dep]); db.position.set(-20,DP.lower+1.8,PZ[0]/2); db.scale.y=.7; V.G.under.add(db);
    // LIRR trains on tracks 13 to 21 (the tracks LIRR mostly uses). The schedule is real; which track each train uses is illustrative.
    const trackZ={};
    D.rails.filter(r=>!r.subway&&/^\d+$/.test(r.ref)&&+r.ref>=13).forEach(r=>{const pts=r.pts.filter(q=>q[0]>-60&&q[0]<150); if(pts.length){(trackZ[r.ref]=trackZ[r.ref]||[]).push(...pts.map(q=>q[1]));}});
    const tracks=Object.keys(trackZ).sort((a,b)=>a-b).map(k=>({ref:k,z:trackZ[k].reduce((s,v)=>s+v,0)/trackZ[k].length,busy:[]}));
    V.trainClip=[new THREE.Plane(new THREE.Vector3(-1,0,0),BOX[1]),new THREE.Plane(new THREE.Vector3(1,0,0),-BOX[0])];
    const tmat=std({map:trainTex('#2a3f8f','#6b2f8f'),roughness:.45},false); tmat.map.repeat.set(9,1); tmat.userData.map=tmat.map; tmat.clippingPlanes=V.trainClip; V.trainMats=[tmat];
    const endMat=std({color:lin('#9da3ab')},false); endMat.clippingPlanes=V.trainClip; V.trainMats.push(endMat); endMat.userData.plain=true;
    const TL=230, xStop=(PX[0]+PX[1])/2+20, xOut=BOX[1]+TL/2+20;
    const overlaps=(a,b)=>[-60,0,60].some(s=>a[0]<b[1]+s&&b[0]+s<a[1]);
    V.trains=[]; V.trainDate=D.trains.date;
    const trainGeo=new THREE.BoxGeometry(TL,3.9,3.1);
    // one train per arrival or departure, each on a free LIRR track; called again with live MTA data
    const makeTrains=moves=>{V.trains.forEach(T=>V.G.under.remove(T.mesh)); V.trains=[]; tracks.forEach(t=>t.busy=[]); V.moves=moves;
      moves.forEach(mv=>{const m=mv.min, iv=mv.kind==='dep'?[m-9,m+2.5]:[m-2.5,m+9];
        const tr=tracks.find(t=>t.busy.every(b=>!overlaps(iv,b))); if(!tr) return; tr.busy.push(iv);
        const mesh=new THREE.Mesh(trainGeo,[endMat,endMat,endMat,endMat,tmat,tmat]); mesh.position.set(xOut,DP.rail+1.95,tr.z); mesh.visible=false; mesh.castShadow=true; V.G.under.add(mesh);
        V.trains.push({mesh,mv,iv});});};
    makeTrains(D.trains.moves); V.resetTrains=()=>makeTrains(D.trains.moves);
    V.setLive=(arr,base)=>makeTrains((arr||[]).filter(a=>a.line==='LIRR').map(a=>{const d=new Date(a.t*1000); return {min:(a.t-base)/60,kind:a.kind,line:'LIRR',to:a.kind==='dep'?'LIRR departure':'LIRR arrival',t:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};}));
    const ease2=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    V.trainAt=(tm)=>{V.trains.forEach(T=>{let x=null; for(const s of [0,60,-60]){const t=tm+s, m=T.mv.min; if(t<T.iv[0]||t>T.iv[1]) continue;
        if(T.mv.kind==='dep') x=t<m?xStop:xStop+ease2(Math.min(1,(t-m)/2.5))*(xOut-xStop);
        else x=t<m?xOut-ease2((t-(m-2.5))/2.5)*(xOut-xStop):(t<m+6.5?xStop:xStop+ease2((t-m-6.5)/2.5)*(xOut-xStop));}
      T.mesh.visible=x!==null; if(x!==null) T.mesh.position.x=x;});};
    V.drawBoard=(tm,live)=>{const x=bc.getContext('2d'),hh=17+Math.floor(tm/60),mm=Math.floor(tm)%60, clock=live||`${hh-12}:${String(mm).padStart(2,'0')} PM`;
      x.fillStyle='#06080c'; x.fillRect(0,0,512,128); x.textBaseline='middle'; x.font='700 22px Helvetica,Arial,sans-serif'; x.fillStyle='#ffffff'; x.fillText('LIRR DEPARTURES',14,20); x.textAlign='right'; x.fillStyle='#ffc94a'; x.fillText(clock,498,20); x.textAlign='left';
      const next=V.moves.filter(m=>m.kind==='dep'&&m.min>=Math.floor(tm)).slice(0,3);
      x.font='600 20px Helvetica,Arial,sans-serif'; next.forEach((m,k)=>{x.fillStyle='#ffc94a'; x.fillText(`${(+m.t.slice(0,2))%12||12}:${m.t.slice(3)}`,14,56+k*26); x.fillStyle='#e8edf5'; x.fillText(m.to.toUpperCase().slice(0,26),96,56+k*26);});
      V.depMap.needsUpdate=true; return clock;};
    V.drawBoard(0);

    // ---------------------------------------------------------------- the ground: bedrock from USGS borings, soil, tunnels, basements
    const gr=D.grid, X7=gr.x_hi-15.24, Z33=gr.z_lo+9.1, Z31=gr.z_hi-9.1;      // 7th Avenue building line, 33rd and 31st Street building lines
    // where the rock and soil are dug out: the station and its track yard (7th Avenue to past 9th), and the subway corridors
    const railPts=[]; D.rails.filter(r=>!r.subway).forEach(r=>{for(let i=0;i<r.pts.length-1;i++){const a=r.pts[i],b=r.pts[i+1],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/5);
      for(let k=0;k<=n;k++) railPts.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}});
    const nearRail=(x,z)=>railPts.some(p=>Math.abs(p[0]-x)<7&&Math.abs(p[1]-z)<7);
    const cut=(x,z)=>{
      if(x<X7&&z>Z33&&z<Z31) return DP.slab-.6;                            // station trench, cut down to sub-grade
      if(Math.abs(x-gr.x_hi)<10) return DP.irt-1.8;                          // 1 2 3 under 7th Avenue
      if(Math.abs(x-gr.x_lo)<10) return DP.ind-1.8;                          // A C E under 8th Avenue
      if(nearRail(x,z)) return DP.slab-.6;                                   // the river tunnels leaving the station
      return null;};
    SS.buildGround(V,D,V.G.under,{cut,bottom:-30});
    if(V.ground&&V.soilHalf){V.soilHalf.visible=false; V.soilHalf=new THREE.Group();}   // the new ground replaces the old cutaway soil
    // tunnel shells: subway tunnels (today only: they opened in 1917 and 1932) and the railroad's river tunnels (1910)
    {const kt=new KB(), kr=new KB();
      D.rails.filter(r=>r.subway).forEach(r=>SS.tunnelShell(kt,r.pts,(r.layer==='-2'?DP.ind:DP.irt)-1.4,4.4,5,K.lining));
      D.rails.filter(r=>!r.subway).forEach(r=>{const out=r.pts.filter(q=>!(q[0]<X7&&q[1]>Z33&&q[1]<Z31)); if(out.length>1) SS.tunnelShell(kr,out,DP.rail-.4,5.2,6,K.lining);});
      if(kt.p.length) kt.mesh(V,V.underNew,underMat); if(kr.p.length) kr.mesh(V,V.G.under,underMat);}
    // basements: the city lists which buildings have space below grade (yes or no). Shown one story deep (3.5 m), an approximation.
    {const has=new Set(D.basements||[]), list=D.buildings.filter(b=>has.has(String(b.bin))&&!(SS.centroid(b.pts)[0]<X7&&SS.centroid(b.pts)[1]>Z33&&SS.centroid(b.pts)[1]<Z31))
        .map(b=>({pts:b.pts,h:-.06,minh:-3.5,k:K.lining,kt:K.lining}));
      if(list.length) SS.blocks(V,list,V.underNew,underMat); V.basementCount=list.length;}
    V.labels.under=[{p:[20,DP.upper+.3,Z33+8],t:'Penn Station concourses'},{p:[60,DP.plat+.3,0],t:'21 tracks · 42 ft down'},
      {p:[gr.x_hi,DP.irt-1,Z31-20],t:'1 2 3 · 7th Avenue'},{p:[gr.x_lo,DP.ind-1,Z31-20],t:'A C E · 8th Avenue'},
      {p:[60,-12,Z31+40],t:'Bedrock · Manhattan schist'},{p:[150,-2,Z31+60],t:'Soil and fill'},{p:[-230,DP.plat+.3,0],t:'Tracks under Moynihan Train Hall'}];
  }
  // ---------------------------------------------------------------- Moynihan Train Hall (opened 2021) in the Farley Building, today only
  // Four steel-and-glass vaults over the old 150 x 200 ft mail sorting room, up to 92 ft (SOM; ASCE Civil Engineering, 2022).
  // Placed over the sunken hall in the city's 3D model of the Farley Building; the vault direction is approximate.
  if(D){const far=D.buildings.find(b=>String(b.bin)==='1084820');
    if(far&&V.cityNew){const xs=far.pts.map(p=>p[0]), zs=far.pts.map(p=>p[1]);
      let cx=(Math.min(...xs)+Math.max(...xs))/2, cz=(Math.min(...zs)+Math.max(...zs))/2, HW=150*.3048/2, HL=200*.3048/2, spring=16;
      const top=92*.3048, m3=D.city3d&&D.city3d['1084820'];
      // the hall: the sunken roof inside the Farley Building in the city's 2014 3D model (about 154 x 210 ft, where the sorting room was)
      if(m3){const low=[], ring=[]; m3.p.forEach(pl=>{if(pl[0]!=='R') return; const X=[],Y=[],Z=[]; for(let i=1;i<pl.length;i+=3){X.push(pl[i]); Y.push(pl[i+1]); Z.push(pl[i+2]);}
          const b={x0:Math.min(...X),x1:Math.max(...X),z0:Math.min(...Z),z1:Math.max(...Z),y:Math.max(...Y)};
          if(b.x0>Math.min(...xs)+15&&b.x1<Math.max(...xs)-15&&b.z0>Math.min(...zs)+8&&b.z1<Math.max(...zs)-8) (b.y<=14?low:ring).push(b);});
        if(low.length){const x0=Math.min(...low.map(b=>b.x0)),x1=Math.max(...low.map(b=>b.x1)),z0=Math.min(...low.map(b=>b.z0)),z1=Math.max(...low.map(b=>b.z1));
          cx=(x0+x1)/2; cz=(z0+z1)/2; HW=(x1-x0)/2; HL=(z1-z0)/2;
          const r=ring.filter(b=>b.x1>x0-2&&b.x0<x1+2&&b.z1>z0-2&&b.z0<z1+2&&b.y<top-3); spring=r.length?Math.max(...r.map(b=>b.y)):14;}}
      const kg=new KB(), ks=new KB(), n=4, w=HW*2/n;
      for(let v=0;v<n;v++){const x0=cx-HW+v*w, steps=10;
        for(let k=0;k<steps;k++){const a0=k/steps*Math.PI,a1=(k+1)/steps*Math.PI, X=a=>x0+w/2-Math.cos(a)*w/2, Y=a=>spring+Math.sin(a)*(top-spring);
          kg.quadF([X(a0),Y(a0),cz-HL],[X(a1),Y(a1),cz-HL],[X(a1),Y(a1),cz+HL],[X(a0),Y(a0),cz+HL],K.curtain,[-Math.cos((a0+a1)/2),Math.sin((a0+a1)/2),0]);
          for(let r=0;r<=6;r++){const z=cz-HL+r*HL/3; ks.quadF([X(a0),Y(a0),z-.25],[X(a1),Y(a1),z-.25],[X(a1),Y(a1),z+.25],[X(a0),Y(a0),z+.25],K.steel,[0,1,0]);}}}
      const gm=std({color:lin('#bcd6e6'),transparent:true,opacity:.42,roughness:.08,metalness:.25,side:THREE.DoubleSide,depthWrite:false});
      const g=new THREE.Group(); V.cityNew.add(g); const gmesh=kg.mesh(V,g,gm); const i=V.kindMeshes.indexOf(gmesh); if(i>=0) V.kindMeshes.splice(i,1); ks.mesh(V,g);
      V.moynihan={cx,cz,top};
      V.layers.push({key:'moynihan',name:'Moynihan',era:'today',items:[
        {type:'outline',pts:[[cx-HW,cz-HL],[cx+HW,cz-HL],[cx+HW,cz+HL],[cx-HW,cz+HL]],y:top+.3},
        {type:'dim',a:[cx+HW+4,0,cz+HL],b:[cx+HW+4,top,cz+HL],text:'92 FT',textAt:.55},
        {type:'label',p:[cx,top,cz],slot:'top',title:'MOYNIHAN TRAIN HALL',sub:['OPENED JAN 1, 2021','INSIDE THE OLD FARLEY POST OFFICE']}]});}}
  V.EXP={base:0,lower:12,facade:0,middle:30,upper:54,crown:78,roof:102,under:[0,-40,0]};
  V.flyGuard=R+24; V.boxR=78;

  // Rangers shot map: removed for now (2026-11-15). The NHL shots are still in data/msg-data.js for a future data layer.

  // ---------------------------------------------------------------- labels + sightlines
  V.labels.exploded=[{g:'roof',p:P(R-6,-50*deg,HT-1),t:'Cable-suspended roof'},{g:'crown',p:P(48,-50*deg,yC(48)-1),t:'Ceiling, banners & light rings'},{g:'upper',p:[-10,30,0],t:'Scoreboard & Chase Bridges'},
    {g:'middle',p:L.pos(L.idxAtPhi(-60),26,26),t:'200 level & suites'},{g:'lower',p:L.pos(L.idxAtPhi(-110),7,7),t:'100 level'},{g:'base',p:[22,1,10],t:'Event level · NHL rink'},{g:'under',p:[-40,V.depth.plat+.3,40],t:'Penn Station tracks · 42 ft down'}];
  const iS=L.idxAtPhi(180);
  const row=(T,s,i)=>{const o0=typeof T.o0==='function'?T.o0(i):T.o0,o1=typeof T.o1==='function'?T.o1(i):T.o1,dO=(o1-o0)/T.steps,dH=(T.h1-T.h0)/(T.steps-1); return L.pos(i,o0+(s+.5)*dO,T.h0+s*dH+1.2);};
  addSight(V,[row(T1,2,iS),row(T1,10,iS),row(T2,3,iS),row(T2,10,iS),row(T2,17,iS),[0,35.4,-36]],L.pos(iS,-2.5,1.07));
  V.labels.section=[{p:[0,HT-1,-30],t:'Cable roof & ceiling'},{p:[0,25,8],t:'Center-hung scoreboard'},{p:[0,35.5,-44],t:'Chase Bridge'},{p:row(T2,12,iS),t:'200 level'},{p:row(T1,6,iS),t:'100 level'},
    {p:[0,.5,6],t:'Event level · NHL rink'},{p:[0,V.depth.upper+.5,-40],t:'Penn Station concourses'},{p:[0,V.depth.plat+.3,-20],t:'Platforms · tracks 1 to 21 · 42 ft down'},{p:[-90,-6,30],t:'A C E subway · 8th Ave'}];
  // blueprint cross section: the real outlines at the north side (x = 0), drawn as lines
  {const iN=L.idxAtPhi(180), z=r=>[0,0,-r], Pz=(r,y)=>[0,y,-r], prof=[SS.tierProfile(L,iN,T1),SS.tierProfile(L,iN,T2)];
   const ceil=[],roof=[]; for(let r=Rin;r<=Ri;r+=2) ceil.push(Pz(r,yC(r))); for(let r=7;r<=Rm;r+=2) roof.push(Pz(r,yd(r)));
   prof.push(ceil,roof,[Pz(R-3,HT),Pz(R+.4,HT),Pz(R+.4,HT-3),Pz(Rw-.7,HT-3),Pz(Rw-.7,Hw),Pz(Rw,Hw),Pz(Rw,0)],[Pz(R+18,0),Pz(0,0)],
     [Pz(edge[iN]-.3+15.5,34),Pz(edge[iN]-.3+15.5,HT-3.2)],[Pz(41.8,34.2),Pz(46.2,34.2),Pz(46.2,35.8),Pz(41.8,35.8),Pz(41.8,34.2)],
     [Pz(-2,V.depth.upper),Pz(R+18,V.depth.upper)],[Pz(-2,V.depth.lower),Pz(R+18,V.depth.lower)],[Pz(-2,V.depth.plat),Pz(R+18,V.depth.plat)],[Pz(-2,V.depth.slab),Pz(R+18,V.depth.slab)]);
   V.sheet.profile=prof;}
  // cameras + lights
  const bo=row(T2,17,L.idxAtPhi(16));
  V.camOv.bowl={abs:true,pos:bo,tgt:[-4,6,-16],fov:66};
  V.bowlOpts=[['seat','200 level'],['up','Lower bowl, look up']];
  V.camOv.bowlUp={abs:true,pos:row(T1,2,L.idxAtPhi(12)),tgt:[0,30,-10],fov:84};
  V.camOv.shots={abs:true,pos:[0,62,40],tgt:[0,0,1],fov:46};
  V.camOv.aerial={off:[-175,150,210],tgt:[12,2,0]}; V.camOv.pastel={size:122,tgt:[14,-8,0]}; V.camOv.night={off:[-210,150,195],tgt:[0,14,0]}; V.camOv.road={off:[260,240,300]};
  V.camOv.studio={off:[-260,215,320]}; V.camOv.exploded={tgt:[0,26,0],off:[-300,185,345]}; V.camOv.overhead={off:[0,520,3],tgt:[0,0,0]};
  V.camOv.corner={off:[-104,6,108],tgt:[-4,20,0],fov:50}; V.camOv.wire={off:[-200,235,245],tgt:[0,0,0]};
  V.pointPos.night=[[84,12,0],[0,12,84],[-84,12,0],[0,12,-84]];
  V.pointPos.arena=[[-20,30,-12],[20,30,12],[-20,30,12],[20,30,-12]];
  return V;
}

SS.builders.push(buildMSG);
})();
