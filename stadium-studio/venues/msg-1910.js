/* Venue era: Pennsylvania Station as it stood in 1910, on the same blocks as today's Madison Square Garden.
   Adds a "Today | 1910" switch to the MSG venue (V.eras). Stylized but to scale.

   Sources
   - Measurements: Wikipedia, "Pennsylvania Station (1910–1963)", Design section (read 2026-11-16):
     788 x 432 ft footprint; 69 ft average and 153 ft maximum height; 35 ft by 4.5 ft Doric columns;
     230 ft side colonnades; 63 ft carriageways; 45 x 225 ft arcade; main waiting room 314 ft 4 in x 108 ft 8 in,
     150 ft tall, lunettes of 38 ft 4 in radius, 60 ft Corinthian columns; concourse glass roof 210 x 340 ft;
     clock 61 ft above the sidewalk; 21 tracks and 11 platforms below.
   - Look: Library of Congress photos (no known restrictions), saved in real photo references/penn station 1910.
   - Street lines: the MSG city data (data/msg-data.js).
   - Neighborhood: buildings standing today that were built in 1910 or earlier stay; newer ones are replaced by
     typical 25 x 100 ft walk-ups (an approximation, not a record of each building). The lot east of 7th Avenue
     between 32nd and 33rd Street is shown dug out, as in the 1910 and 1912 photos; the railroad's land west of
     8th Avenue is shown as an open track cut (approximate). */
(function(){
'use strict';
if(!window.SS||!SS.ok) return;
const {K,KB,std,mats,blocks,pip,centroid,lin}=SS;

SS.builders.push(function buildPenn1910(){
  const V=SS.VENUES.msg; if(!V) return;
  const D=(window.STADIUM_DATA||{}).msg||null;
  const FT=.3048;

  // ---------------------------------------------------------------- the site: 7th to 8th Avenue, 31st to 33rd Street
  const g=D&&D.grid?D.grid:{x_lo:-89.74,x_hi:183.75,z_lo:-78.91,z_hi:78.01};   // street centerlines (x = grid east, z = grid south)
  const CX=(g.x_lo+g.x_hi)/2, CZ=(g.z_lo+g.z_hi)/2;
  const X0=CX-788*FT/2, X1=CX+788*FT/2, Z0=CZ-432*FT/2, Z1=CZ+432*FT/2;       // the building's frontages
  const H=69*FT, TOP=153*FT, FLOOR=(V.depth&&V.depth.upper)||-4;   // average height, highest point, waiting room and concourse floor (below the street, approximate)
  const COL_H=35*FT, COL_R=4.5*FT/2, STYLO=1;   // Doric columns on a 1 m base
  const ENT=STYLO+COL_H;                         // top of the columns: the entablature starts here
  // east to west: 7th Avenue front, arcade, main waiting room, concourse, 8th Avenue block
  const xWall=X1-3.4;                             // the front wall stands behind the colonnade
  const arcW=45*FT, arcX0=xWall-225*FT;          // arcade from the main entrance to the waiting room
  const wrX1=arcX0, wrX0=wrX1-108.67*FT, wrHalf=314.33*FT/2, wrMid=(wrX0+wrX1)/2;
  const coX1=wrX0, coX0=coX1-210*FT, coHalf=340*FT/2;   // the concourse's glass roof, 210 x 340 ft
  const wing=14;                                  // depth of the long office wings on 31st and 33rd Streets

  const P=new THREE.Group(); V.penn=P; V.G.base.add(P);
  const kb=new KB();
  const k=K;   // kinds: granite walls, roofs, glass, steel
  // a box whose six faces all point outward (the realistic styles' corner shading reads face directions)
  const boxF=(b,x0,x1,y0,y1,z0,z1,top,side)=>{
    b.quadF([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],top,[0,1,0]); b.quadF([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],side,[0,-1,0]);
    b.quadF([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],side,[0,0,-1]); b.quadF([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],side,[0,0,1]);
    b.quadF([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],side,[-1,0,0]); b.quadF([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],side,[1,0,0]);};
  const box=(x0,x1,y0,y1,z0,z1,top,side)=>boxF(kb,x0,x1,y0,y1,z0,z1,top===undefined?k.roof:top,side===undefined?k.granite:side);
  const cyl=(x,z,y0,y1,r,n,kind)=>{n=n||14; for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2, p=(a,y)=>[x+Math.cos(a)*r,y,z+Math.sin(a)*r];
    const am=(a0+a1)/2; kb.quadF(p(a0,y0),p(a1,y0),p(a1,y1),p(a0,y1),kind,[Math.cos(am),0,Math.sin(am)]);}};   // faces point outward (the corner shading reads them)
  // a half-disc window (lunette) on a wall: 'x' walls face along x, 'z' walls along z; s = which way it faces
  const lunette=(axis,at,c,ySpring,r,s,kind)=>{const n=20, pt=(a)=>{const u=Math.cos(a)*r,v=ySpring+Math.sin(a)*r; return axis==='x'?[at+s*.25,v,c+u]:[c+u,v,at+s*.25];};
    for(let i=0;i<n;i++){const a0=i/n*Math.PI,a1=(i+1)/n*Math.PI; kb.triF(axis==='x'?[at+s*.25,ySpring,c]:[c,ySpring,at+s*.25],pt(a0),pt(a1),kind,axis==='x'?[s,0,0]:[0,0,s]);}
    [-.6,-.2,.2,.6].forEach(f=>{const u=f*r, top=ySpring+Math.sqrt(r*r-u*u); if(axis==='x') box(at+s*.15,at+s*.45,ySpring,top,c+u-.18,c+u+.18,k.steel,k.steel); else box(c+u-.18,c+u+.18,ySpring,top,at+s*.15,at+s*.45,k.steel,k.steel);});};

  // ---- the 7th Avenue front: a Doric colonnade between two corner pavilions with the carriageway openings
  const pav=24;
  box(xWall-20,xWall,FLOOR,H,Z0+pav,Z1-pav);                         // front building behind the columns
  box(xWall,X1,ENT,H,Z0+pav,Z1-pav);                                 // entablature and attic, carried by the columns
  box(xWall,X1+.6,0,STYLO,Z0+pav,Z1-pav,k.walk,k.granite);           // the base the columns stand on
  {const n=20,step=(Z1-Z0-2*pav-4)/(n-1); for(let i=0;i<n;i++) cyl(X1-1.6,Z0+pav+2+i*step,STYLO,ENT,COL_R,16,k.granite);}
  box(xWall,X1+.4,ENT,ENT+.9,Z0+pav,Z1-pav,k.granite,k.granite);    // cornice line over the columns
  [[Z0,Z0+pav],[Z1-pav,Z1]].forEach(([za,zb])=>{
    box(xWall-20,X1,FLOOR,H+3,za,zb);                                // corner pavilion, a little taller
    box(X1-.4,X1+.2,0,15,(za+zb)/2-63*FT/2,(za+zb)/2+63*FT/2,k.gap,k.gap);   // the 63 ft carriageway opening
    // a low pediment over the pavilion
    const zc=(za+zb)/2, hw=(zb-za)/2; kb.triF([X1+.25,H+3,zc-hw],[X1+.25,H+3,zc+hw],[X1+.25,H+8,zc],k.granite,[1,0,0]);
  });
  box(X1-.9,X1+.25,H,H+4,CZ-14,CZ+14,k.roof,k.granite);              // raised attic over the main entrance
  {const c=new THREE.Mesh(new THREE.CircleGeometry(7*FT/2,24),mats.lights); c.position.set(X1+.3,61*FT,CZ); c.rotation.y=Math.PI/2; P.add(c);}   // the clock, 61 ft up

  // ---- long wings on 31st and 33rd Streets, with 230 ft colonnades at their eastern ends
  const colStart=X1-230*FT;
  [[Z0,1],[Z1,-1]].forEach(([zEdge,s])=>{
    const zIn=zEdge+s*wing, zFace=zEdge+s*3.4, zz=(a,b)=>[Math.min(a,b),Math.max(a,b)];
    let [za,zb]=zz(zEdge,zIn); box(X0,colStart,FLOOR,H,za,zb);       // plain part of the wing
    [za,zb]=zz(zFace,zIn); box(colStart,xWall-20,FLOOR,H,za,zb);     // behind the side colonnade
    [za,zb]=zz(zEdge,zFace); box(colStart,xWall-20,ENT,H,za,zb);     // entablature over the side colonnade
    [za,zb]=zz(zEdge-s*.6,zFace); box(colStart,xWall-20,0,STYLO,za,zb,k.walk,k.granite);
    const n=14, step=(xWall-20-colStart-4)/(n-1); for(let i=0;i<n;i++) cyl(colStart+2+i*step,zEdge+s*1.6,STYLO,ENT,COL_R,16,k.granite);
  });

  // ---- arcade: a 45 ft wide shopping street from the main entrance to the waiting room, skylit
  [[-1,CZ-arcW/2-3,CZ-arcW/2],[1,CZ+arcW/2,CZ+arcW/2+3]].forEach(([,za,zb])=>box(arcX0,xWall-20,FLOOR,17,za,zb));
  box(arcX0,xWall-20,FLOOR,0,CZ-arcW/2,CZ+arcW/2,k.walk,k.granite);  // arcade floor at street level
  [[Z0+wing,CZ-arcW/2-3],[CZ+arcW/2+3,Z1-wing]].forEach(([za,zb])=>box(wrX1,xWall-20,FLOOR,H-1,za,zb));   // rooms either side of the arcade

  // ---- main waiting room: a hollow hall with a coffered barrel vault, lunette windows above the roofs
  const wt=2.5, wrTop=36, inHalf=(wrX1-wrX0)/2-wt, crown=FLOOR+150*FT, spring=crown-inHalf;
  box(wrX0,wrX1,FLOOR-.5,FLOOR+.1,CZ-wrHalf,CZ+wrHalf,k.walk,k.granite);                         // floor
  box(wrX0,wrX0+wt,FLOOR,wrTop,CZ-wrHalf,CZ+wrHalf); box(wrX1-wt,wrX1,FLOOR,wrTop,CZ-wrHalf,CZ+wrHalf);   // long walls
  box(wrX0,wrX1,FLOOR,wrTop,CZ-wrHalf,CZ-wrHalf+wt); box(wrX0,wrX1,FLOOR,wrTop,CZ+wrHalf-wt,CZ+wrHalf);   // end walls
  {const n=18; for(let i=0;i<n;i++){const a0=i/n*Math.PI,a1=(i+1)/n*Math.PI, pt=(a,z)=>[wrMid+Math.cos(a)*inHalf,spring+Math.sin(a)*inHalf,z];   // vault (seen from inside)
    const am=(a0+a1)/2; kb.quadF(pt(a0,CZ-wrHalf+wt),pt(a1,CZ-wrHalf+wt),pt(a1,CZ+wrHalf-wt),pt(a0,CZ+wrHalf-wt),k.ceil,[-Math.cos(am),-Math.sin(am),0]);}}
  // roof over the hall: low gables up to the station's highest point
  {const e=1, pts=[[wrX0-e,wrTop],[wrMid,TOP],[wrX1+e,wrTop]], z0=CZ-wrHalf-e, z1=CZ+wrHalf+e;
    kb.quadF([pts[0][0],pts[0][1],z0],[pts[1][0],pts[1][1],z0],[pts[1][0],pts[1][1],z1],[pts[0][0],pts[0][1],z1],k.roof,[-1,1,0]);
    kb.quadF([pts[1][0],pts[1][1],z0],[pts[2][0],pts[2][1],z0],[pts[2][0],pts[2][1],z1],[pts[1][0],pts[1][1],z1],k.roof,[1,1,0]);
    [z0,z1].forEach((z,i)=>kb.triF([pts[0][0],wrTop,z],[pts[2][0],wrTop,z],[wrMid,TOP,z],k.granite,[0,0,i?1:-1]));}
  // three lunettes on each long side, one on each end (38 ft 4 in radius)
  const lr=38.33*FT, ls=wrTop-lr-.3;
  [-1,0,1].forEach(j=>{lunette('x',wrX1,CZ+j*wrHalf*2/3,ls,lr,1,k.curtain); lunette('x',wrX0,CZ+j*wrHalf*2/3,ls,lr,-1,k.curtain);});
  lunette('z',CZ-wrHalf,wrMid,ls,lr,-1,k.curtain); lunette('z',CZ+wrHalf,wrMid,ls,lr,1,k.curtain);
  // eight 60 ft Corinthian columns on pedestals inside the hall
  [wrX0+wt+1.6,wrX1-wt-1.6].forEach(x=>[-1,-1/3,1/3,1].forEach(f=>{const z=CZ+f*(wrHalf-wt-2.2);
    box(x-1.6,x+1.6,FLOOR,FLOOR+3,z-1.6,z+1.6,k.pier,k.pier); cyl(x,z,FLOOR+3,FLOOR+3+60*FT,1.05,14,k.pier); box(x-1.5,x+1.5,FLOOR+3+60*FT,FLOOR+4.6+60*FT,z-1.5,z+1.5,k.pier,k.pier);}));
  // rooms beyond the ends of the hall (the men's and women's waiting rooms)
  box(wrX0,wrX1,FLOOR,H,Z0+wing,CZ-wrHalf); box(wrX0,wrX1,FLOOR,H,CZ+wrHalf,Z1-wing);

  // ---- concourse: the "hall of iron", steel columns and arches under glass vaults
  const coY=18, rise=7, bays=3, bw=coHalf*2/bays;
  box(coX0,coX1,FLOOR-.5,FLOOR+.1,CZ-coHalf,CZ+coHalf,k.walk,k.granite);
  const steelXs=[0,1,2,3].map(i=>coX0+2+i*(coX1-coX0-4)/3), steelZs=[0,1,2,3].map(i=>CZ-coHalf+i*bw);
  steelXs.forEach(x=>steelZs.forEach(z=>cyl(x,z,FLOOR,coY,.45,8,k.steel)));
  // steel arch ribs across each vault (at every column line) and glass panes between
  const glassKB=new KB();
  for(let b=0;b<bays;b++){const zc=CZ-coHalf+(b+.5)*bw, half=bw/2, n=12, arc=(a)=>[zc+Math.cos(a)*half,coY+Math.sin(a)*rise];
    for(let i=0;i<n;i++){const a0=i/n*Math.PI,a1=(i+1)/n*Math.PI,[z0,y0]=arc(a0),[z1,y1]=arc(a1);
      const am=(a0+a1)/2, up=[0,Math.sin(am),Math.cos(am)];
      glassKB.quadF([coX0,y0,z0],[coX1,y0,z0],[coX1,y1,z1],[coX0,y1,z1],k.curtain,up);
      steelXs.forEach(x=>kb.quadF([x-.2,y0,z0],[x+.2,y0,z0],[x+.2,y1,z1],[x-.2,y1,z1],k.steel,up));}
    box(coX0,coX1,coY-.5,coY,zc-half-.3,zc-half+.3,k.steel,k.steel);}
  // ---- 8th Avenue block, west of the concourse
  box(X0,coX0,FLOOR,H-1,Z0+wing,Z1-wing);
  [-1,0,1].forEach(j=>box(X0+12,coX0-10,H-1,H+.6,CZ+j*30-5,CZ+j*30+5,k.curtain,k.granite));   // skylights over the 8th Avenue block
  box(coX0,coX1,FLOOR,H,Z0+wing,CZ-coHalf); box(coX0,coX1,FLOOR,H,CZ+coHalf,Z1-wing);

  kb.mesh(V,P);
  // the concourse glass: see-through, so the steel and the floor show from above
  V.mats.pennGlass=std({color:lin('#c9dbe2'),transparent:true,opacity:.32,roughness:.08,metalness:.2,side:THREE.DoubleSide,depthWrite:false});
  {const m=glassKB.mesh(V,P,V.mats.pennGlass); m.castShadow=false; const i=V.kindMeshes.indexOf(m); if(i>=0) V.kindMeshes.splice(i,1);}

  // ---------------------------------------------------------------- the 1910 neighborhood
  const N=new THREE.Group(); V.city1910=N; (V.city||V.G.base).add(N);
  const rnd=(x,z)=>{const s=Math.sin(x*12.9898+z*78.233)*43758.5453; return s-Math.floor(s);};
  const inPRR=c=>c[0]<g.x_lo-12&&c[1]>g.z_lo&&c[1]<g.z_hi;                 // railroad land west of 8th Avenue
  const inDig=c=>c[0]>g.x_hi+12&&c[1]>g.z_lo&&c[1]<CZ;                     // the dug-out lot east of 7th Avenue
  const inSite=c=>c[0]>g.x_lo&&c[0]<g.x_hi&&c[1]>g.z_lo&&c[1]<g.z_hi;       // the station's own blocks
  const rows={brick:[],stone:[]}, tanks=[];
  (V.splitFoot||[]).forEach(f=>{
    const c=centroid(f.pts); if(inPRR(c)||inDig(c)||inSite(c)) return;
    const xs=f.pts.map(p=>p[0]), zs=f.pts.map(p=>p[1]), lw=25*FT, ld=100*FT;
    for(let x=Math.min(...xs)+lw/2;x<Math.max(...xs);x+=lw) for(let z=Math.min(...zs)+ld/2;z<Math.max(...zs);z+=ld){
      if(!pip([x,z],f.pts)) continue;
      const r=rnd(x,z), floors=4+Math.floor(r*3), h=floors*3.5+(r>.85?3.5:0);   // typical 4 to 6 story walk-ups
      const pts=[[x-lw/2+.15,z-ld/2+.15],[x+lw/2-.15,z-ld/2+.15],[x+lw/2-.15,z+ld/2-.15],[x-lw/2+.15,z+ld/2-.15]];
      (r<.7?rows.brick:rows.stone).push({pts,h,k:r<.7?k.nbr:k.nbr2,kt:k.nbrTop});
      if(floors>=6&&r>.5) tanks.push([x,h,z]);
    }
  });
  blocks(V,rows.brick,N,V.mats.brick); blocks(V,rows.stone,N,V.mats.stone); if(tanks.length) SS.waterTanks(tanks,N);
  // ---- 1910 only: the open track cut west of 8th Avenue and the dug-out lot east of 7th
  const box2=(kbx,x0,x1,y0,y1,z0,z1,top,side)=>boxF(kbx,x0,x1,y0,y1,z0,z1,top,side);
  const gk=new KB(), bx=D&&D.box?D.box:[-170,265,-160,160], X10=new THREE.Group(); (V.city||V.G.base).add(X10);
  {const x0=bx[0], x1=g.x_lo-15.2, z0=g.z_lo+9.1, z1=g.z_hi-9.1;
    const fl=((V.depth&&V.depth.slab)||-13.45)-.6, rl=(V.depth&&V.depth.rail)||-12.9;   // the cut goes down to track level, like the station
    if(x1>x0+5){box2(gk,x0,x1,fl-.5,fl,z0,z1,k.dirt,k.dirt); box2(gk,x0,x1,fl,0,z0-1.2,z0,k.granite,k.granite); box2(gk,x0,x1,fl,0,z1,z1+1.2,k.granite,k.granite); box2(gk,x1,x1+1.2,fl,0,z0,z1,k.granite,k.granite);
      for(let z=z0+4;z<z1-2;z+=5) box2(gk,x0,x1,fl,rl,z-.8,z+.8,k.track,k.track);}}
  {const x0=g.x_hi+15.2, x1=Math.min(bx[1],g.x_hi+15.2+60), z0=g.z_lo+9.1, z1=CZ-9.1;
    if(x1>x0+5){box2(gk,x0,x1,-4,-3.5,z0,z1,k.dirt,k.dirt); box2(gk,x0,x1,-3.5,0,z0,z0+.4,k.dirt,k.dirt); box2(gk,x0,x0+.4,-3.5,0,z0,z1,k.dirt,k.dirt);}}
  gk.mesh(V,X10);

  // ---- the dig, before 1910: the block cleared and cut down to track level, from 7th Avenue west past 8th Avenue.
  // "The level of the track system below the street surface varies from 39 to 58 ft." Retaining walls ran along 31st and 33rd
  // Streets and 7th Avenue (ASCE Transactions vol. 68, 1910); some 500 buildings were demolished (Wikipedia). 8th Avenue was
  // carried across the cut on steel (shown simply; the paper describes this for 9th Avenue in detail).
  const DG=new THREE.Group(); V.G.base.add(DG);
  const kd=new KB(), pitF=((V.depth&&V.depth.rail)||-12.9)-.6, px0=bx[0], px1=X1;
  box2(kd,px0,px1,pitF-.6,pitF,Z0,Z1,k.dirt,k.dirt);                                         // rock floor at sub-grade
  box2(kd,px0,px1,pitF,0,Z0-1.4,Z0,k.slab,k.slab); box2(kd,px0,px1,pitF,0,Z1,Z1+1.4,k.slab,k.slab);   // retaining walls on 33rd and 31st
  box2(kd,px1,px1+1.4,pitF,0,Z0-1.4,Z1+1.4,k.slab,k.slab);                                  // and along 7th Avenue
  {const ax0=g.x_lo-15.2, ax1=g.x_lo+15.2;                                                  // 8th Avenue on steel across the cut
    box2(kd,ax0,ax1,-.8,0,Z0-1.4,Z1+1.4,k.walk,k.steel);
    for(let z=Z0+6;z<Z1-3;z+=10) [ax0+3,(ax0+ax1)/2,ax1-3].forEach(x=>box2(kd,x-.35,x+.35,pitF,-.8,z-.35,z+.35,k.steel,k.steel));}
  for(let x=px0+20;x<px1-20;x+=38) for(let z=Z0+20;z<Z1-10;z+=34) box2(kd,x-4,x+4,pitF,pitF+3.5,z-3,z+3,k.dirt,k.dirt);   // spoil heaps waiting to be hauled
  kd.mesh(V,DG);

  // ---- grounds: today's streets; 1910 with the station's footprint open; the dig with the whole cut open
  const ground=V.city&&V.city.children.find(c=>c.isMesh&&c.material===V.mats.streets);
  // the street ground with a rectangular opening, built from up to four rectangles around it (works even when the opening reaches the edge)
  // the street ground with rectangular openings: cut into bands along z, and in each band keep the stretches no opening covers
  const holed=(...holes)=>{if(!ground) return null; const [x0,x1,z0,z1]=bx, W=x1-x0, Hh=z1-z0, pos=[], uv=[];
    holes=holes.map(([a,b,c,d])=>[Math.max(x0,a),Math.min(x1,b),Math.max(z0,c),Math.min(z1,d)]);
    const rect=(a0,a1,c0,c1)=>{if(a1-a0<.01||c1-c0<.01) return; [[a0,c0],[a0,c1],[a1,c1],[a0,c0],[a1,c1],[a1,c0]].forEach(([x,z])=>{pos.push(x,.03,z); uv.push((x-x0)/W,(z1-z)/Hh);});};
    const zs=[...new Set([z0,z1,...holes.flatMap(h=>[h[2],h[3]])])].sort((a,b)=>a-b);
    for(let k=0;k<zs.length-1;k++){const c0=zs[k],c1=zs[k+1],mid=(c0+c1)/2, cov=holes.filter(h=>h[2]<=mid&&h[3]>=mid).map(h=>[h[0],h[1]]).sort((a,b)=>a[0]-b[0]);
      let x=x0; cov.forEach(([a,b])=>{if(a>x) rect(x,a,c0,c1); x=Math.max(x,b);}); rect(x,x1,c0,c1);}
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,V.mats.streets); m.receiveShadow=true; ground.parent.add(m); m.visible=false; return m;};
  const ground1910=holed([X0,X1,Z0,Z1],[bx[0]-1,g.x_lo-15.2+1.2,g.z_lo+9.1-1.2,g.z_hi-9.1+1.2]), groundDig=holed([bx[0]-1,X1+1.4,Z0-1.4,Z1+1.4]);   // 1910: the station and the open track cut west of 8th Avenue

  // ---- opening-day sun: where the sun stood over Manhattan on November 27, 1910, at 2 pm (time chosen; the date is real)
  function sunScene(ms,lat,lon){
    const r=Math.PI/180, d=(ms-946728000000)/86400000, g=(357.529+.98560028*d)*r, q=280.459+.98564736*d;
    const L=(q+1.915*Math.sin(g)+.02*Math.sin(2*g))*r, e=(23.439-.00000036*d)*r, ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)), dec=Math.asin(Math.sin(e)*Math.sin(L));
    const H=(((18.697374558+24.06570982441908*d)%24)*15+lon)*r-ra, f=lat*r;
    const alt=Math.asin(Math.sin(f)*Math.sin(dec)+Math.cos(f)*Math.cos(dec)*Math.cos(H)), az=Math.atan2(-Math.sin(H),Math.tan(dec)*Math.cos(f)-Math.sin(f)*Math.cos(H));
    const E=Math.cos(alt)*Math.sin(az), Nn=Math.cos(alt)*Math.cos(az), U=Math.sin(alt), gd=((D&&D.meta.grid_deg)||-29)*r, ex=[Math.cos(gd),Math.sin(gd)], nx=[-ex[1],ex[0]];
    return {alt:alt/r, dir:[E*ex[0]+Nn*ex[1],U,-(E*nx[0]+Nn*nx[1])]};
  }
  const area=D&&D.meta.area?D.meta.area:[40.7476,-73.9975,40.7534,-73.9893], sun1910=sunScene(Date.UTC(1910,10,27,19,0),(area[0]+area[2])/2,(area[1]+area[3])/2);
  const day=k=>((D&&D.history&&D.history.days)||[]).find(d=>d.date===k), w10=day('1910-11-27');

  // ---------------------------------------------------------------- switching eras
  // Each piece belongs to some eras. Pieces fade by rising out of (or sinking into) the ground, so a switch is one continuous shot.
  const keep=new Set([V.city,V.trees,V.road,V.lot,V.plinth,P,DG]);
  const todayScaled=[V.G.lower,V.G.facade,V.G.middle,V.G.upper,V.G.crown,V.G.roof,V.shell,V.annex,V.hang,V.sight,V.cityNew,V.underNew,
    ...V.G.base.children.filter(c=>!keep.has(c))].filter(Boolean);
  const modern=(V.city?V.city.children:[]).filter(c=>c.isInstancedMesh&&(c.material===mats.globe||c.material===mats.dark));   // subway entrances (1917 and later) and traffic signals
  const GROUPS={today:{scaled:todayScaled,swap:[ground,V.trees,...modern].filter(Boolean)},penn:{grow:[P]},extra:{grow:[X10]},hood:{grow:[N]},dig:{grow:[DG]}};
  const MEMBERS={today:['today'],'1910':['penn','extra','hood'],'1906':['dig','hood']};
  const w={today:1,penn:0,extra:0,hood:0,dig:0}, goal=Object.assign({},w);
  const ease=x=>x*x*(3-2*x);
  function show(){
    const T=GROUPS.today, et=ease(w.today);
    T.scaled.forEach(o=>{o.scale.y=Math.max(1e-4,et); if(et<.001) o.visible=false; else if(et>.999&&o.userData.eraHid) o.visible=true; o.userData.eraHid=et<.001;});
    T.swap.forEach(o=>{if(w.today<.5) o.visible=false; else if(o.userData.eraOff){o.visible=true;} o.userData.eraOff=w.today<.5;});
    ['penn','extra','hood','dig'].forEach(k=>GROUPS[k].grow.forEach(o=>{const e=ease(w[k]); o.scale.y=Math.max(1e-4,e); o.visible=e>.001;}));
    if(ground1910) ground1910.visible=w.penn>=.5; if(groundDig) groundDig.visible=w.dig>=.5&&w.penn<.5;
    if(V.G.under) V.G.under.visible=w.dig<.5;                      // no platforms or trains yet during the dig
    if(V.soilHalf&&w.today<.5) V.soilHalf.visible=false;
    if(V.plinth&&w.today<.5) V.plinth.visible=false;   // the base slab would cover the sunken halls and the dig
  }
  const today={section:V.section,labels:V.labels.section};
  const SEC={'1910':{section:{axis:'z',c:CZ},labels:[
    {p:[wrMid,crown-6,CZ],t:'Main waiting room · 150 ft'},{p:[(coX0+coX1)/2,coY+3,CZ],t:'Concourse · glass and steel'},
    {p:[(arcX0+xWall)/2,10,CZ],t:'Arcade from 7th Avenue'},{p:[(X0+coX0)/2,8,CZ],t:'8th Avenue building'},{p:[40,((V.depth&&V.depth.plat)||-12)+.3,CZ],t:'21 tracks · 42 ft below the street'}]},
    '1906':{section:{axis:'z',c:CZ},labels:[{p:[40,pitF+.5,CZ],t:'Cut down to track level · 39 to 58 ft'},{p:[g.x_lo,0,CZ],t:'8th Avenue carried on steel'},{p:[X1-2,pitF/2,CZ],t:'Retaining wall · 7th Avenue'}]}};
  V.era='today'; const camSec=V.camOv.section;
  V.eras={
    list:[['1906','The dig'],['1910','1910'],['today','Today']],
    info:{
      '1910':{name:'Pennsylvania Station',eyebrow:'3D study · 1910 · the site of today\'s Madison Square Garden',
        spec:['Opened 1910','788 × 432 ft','Torn down 1963–66'],skip:['bowl','exploded','blueprint'],
        sun:sun1910.alt>3?sun1910.dir.map(v=>v*260):null, sunNote:`Opening-day sun, Nov 27, 1910, 2 pm${w10&&w10.weather?` · ${w10.weather.TMAX}°F, dry (NOAA)`:''}`},
      '1906':{name:'Digging Penn Station',eyebrow:'3D study · before 1910 · the cut for the tracks',
        spec:['About 500 buildings cleared','Tracks 39 to 58 ft down','Opened 1910'],skip:['bowl','exploded','blueprint']}},
    apply(key,instant){Object.keys(goal).forEach(k=>goal[k]=(MEMBERS[key]||[]).includes(k)?1:0); if(instant) Object.assign(w,goal);
      const E=SEC[key]||today; V.section=E.section; V.labels.section=E.labels;
      if(SEC[key]) V.camOv.section={tgt:[CX,2,CZ],size:120}; else if(camSec) V.camOv.section=camSec; else delete V.camOv.section; show();},
    tick(dt){let moved=false; Object.keys(w).forEach(k=>{if(w[k]!==goal[k]){w[k]=Math.max(0,Math.min(1,w[k]+Math.sign(goal[k]-w[k])*dt/2.4)); moved=true;}}); if(moved) show();},
    refresh:show
  };
  show();

  // ---------------------------------------------------------------- design layer for 1910 (engine/layer.js)
  V.layers=(V.layers||[]).concat([
    {key:'penn',name:'1910 facts',era:'1910',items:[
      {type:'outline',pts:[[X0,Z0],[X1,Z0],[X1,Z1],[X0,Z1]],y:H+.4},
      {type:'dim',a:[X0,H+10,Z1+3],b:[X1,H+10,Z1+3],text:'788 FT',textAt:.5},
      {type:'dim',a:[wrX0,0,CZ+wrHalf+2],b:[wrX0,TOP,CZ+wrHalf+2],text:'153 FT',textAt:.55},
      {type:'label',p:[wrMid,TOP,CZ],slot:'top',title:'PENNSYLVANIA STATION',sub:['OPENED NOV 27, 1910 · MCKIM, MEAD & WHITE']},
      {type:'label',p:[(coX0+coX1)/2,coY+rise,CZ],slot:'low',small:true,title:'TORN DOWN 1963–66',sub:['MADISON SQUARE GARDEN OPENED','ON THIS SITE IN 1968']}]},
    {key:'dig',name:'The dig',era:'1906',items:[
      {type:'outline',pts:[[bx[0],Z0],[X1,Z0],[X1,Z1],[bx[0],Z1]],y:.3},
      {type:'dim',a:[X1-6,0,Z1-4],b:[X1-6,pitF+.6,Z1-4],text:'39–58 FT',textAt:.5},
      {type:'label',p:[40,pitF+.5,CZ],slot:'top',title:'DIGGING PENN STATION',sub:['ABOUT 500 BUILDINGS CLEARED','TRACKS 39 TO 58 FT BELOW THE STREET']}]}
  ]);
});
})();
