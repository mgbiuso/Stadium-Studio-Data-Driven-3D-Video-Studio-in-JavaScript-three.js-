/* Design layer example: the clean graphics that sit on top of the 3D picture (outlines, dimension lines,
   leader-line labels, glowing flow arrows, one caption word). Every number is from our own verified data.
   Open design-layer-demo.html. Add ?layer=off to see the plain picture, ?caption=off to drop the caption. */
(function(){
'use strict';
const ST=window.SS&&SS.studio; if(!ST) return;
const $=id=>document.getElementById(id), app=$('app'), q=new URLSearchParams(location.search);
const showLayer=q.get('layer')!=='off', showCaption=q.get('caption')!=='off';
app.classList.add('demo');

// set the scene: Madison Square Garden, daylight aerial, 9:16 frame, panels hidden
function setup(){
  document.querySelector('.venues button[data-venue="msg"]').click();
  document.querySelector(`.style-btn[data-key="${q.get('style')||'aerial'}"]`).click();
  $('rec-open').click(); if(!app.classList.contains('vertical')) $('rec-vert').click();
}
setTimeout(setup,50);

const V=()=>SS.VENUES.msg, M2FT=3.28084;
const svg=$('dl'); svg.hidden=!showLayer;
const cam=new THREE.PerspectiveCamera();
function project(x,y,z,w,h){const v=new THREE.Vector3(x,y,z).project(cam); return [(v.x+1)/2*w,(1-v.y)/2*h,v.z<1];}

function draw(){
  requestAnimationFrame(draw);
  if(!showLayer) return;
  const c=ST.canvas, w=c.clientWidth, h=c.clientHeight, v=ST.view(); if(!w||v.o) return;
  cam.fov=v.fov; cam.aspect=w/h; cam.near=1; cam.far=6000; cam.position.copy(v.pos); cam.lookAt(v.tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const Vn=V(), R=64.5, HT=44.4;   // drum radius and height from the city data (129 m across, 44 m tall)
  const P=(x,y,z)=>project(x,y,z,w,h);
  // across-the-screen direction on the ground, so the width line always reads wide
  const view=v.tgt.clone().sub(v.pos); const side=new THREE.Vector3(-view.z,0,view.x).normalize();
  const toward=new THREE.Vector3(-view.x,0,-view.z).normalize();
  let s='';
  // 1. glowing outline around the roof edge
  const ring=[]; for(let i=0;i<=72;i++){const a=i/72*Math.PI*2; ring.push(P(Math.cos(a)*R,HT+.3,Math.sin(a)*R));}
  s+=`<polyline class="glow ring" points="${ring.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}"/>`;
  // 2. width dimension line above the roof
  const a=P(-side.x*R,HT+34,-side.z*R), b=P(side.x*R,HT+34,side.z*R), mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
  s+=`<line class="dim" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" marker-start="url(#tick)" marker-end="url(#tick)"/>`;
  s+=`<text class="dimtxt" x="${mx}" y="${my-10}" text-anchor="middle">${Math.round(R*2*M2FT)} FT ACROSS</text>`;
  // 3. height dimension on the near-left edge of the drum
  const hx=-side.x*(R+10)+toward.x*8, hz=-side.z*(R+10)+toward.z*8, h0=P(hx,0,hz), h1=P(hx,HT,hz);
  s+=`<line class="dim" x1="${h0[0]}" y1="${h0[1]}" x2="${h1[0]}" y2="${h1[1]}" marker-start="url(#tick)" marker-end="url(#tick)"/>`;
  s+=`<text class="dimtxt" x="${h0[0]-8}" y="${(h0[1]+h1[1])/2+5}" text-anchor="end">${Math.round(HT*M2FT)} FT</text>`;
  // 4. x-ray of the station level: glowing track lines under the arena (east to west, at the model's track level),
  //    and arrows dropping straight down from the street entrances to the trains
  const TY=-22, line=(p,q,cls,extra)=>`<line class="${cls}" x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" ${extra||''}/>`;
  [-36,-18,0,18,36].forEach((z,k)=>{const p=P(-150,TY,z), q=P(220,TY,z), col=k%2?'gold':'cyan';
    s+=line(p,q,'flow-base '+col)+line(p,q,'flow '+col,`style="animation-delay:${-k*.3}s"`);});
  [[-75,0,0],[62,0,-30],[30,0,64]].forEach(([x,,z],k)=>{const p=P(x,0,z), q=P(x,TY+3,z*.5);
    s+=line(p,q,'drop',`marker-end="url(#ac)" style="animation-delay:${-k*.4}s"`);});
  const hub=P(150,TY,36);
  // 5. leader-line labels (kept out of the app's button and caption areas)
  const top=P(-side.x*R*.2,HT,-side.z*R*.2), lx=w*.06, ly=h*.16;
  s+=`<polyline class="lead" points="${top[0]},${top[1]} ${top[0]-20},${ly+18} ${lx},${ly+18}"/><circle class="dot" cx="${top[0]}" cy="${top[1]}" r="4"/>`;
  s+=`<text class="lab" x="${lx}" y="${ly}">MADISON SQUARE GARDEN</text><text class="sub" x="${lx}" y="${ly+36}">OPENED FEB 11, 1968 · 19,812 SEATS</text>`;
  const ty=h*.66, tx=w*.06;
  s+=`<polyline class="lead" points="${hub[0]},${hub[1]} ${Math.min(hub[0],w*.7)},${ty-18} ${tx},${ty-18}"/><circle class="dot" cx="${hub[0]}" cy="${hub[1]}" r="4"/>`;
  s+=`<text class="lab small" x="${tx}" y="${ty-26}">TRAINS UNDER THE ARENA</text><text class="sub" x="${tx}" y="${ty+4}">34 ST–PENN: 563,795 SUBWAY ENTRIES</text><text class="sub" x="${tx}" y="${ty+24}">NOV 1–14 · MTA DATA</text>`;
  // 6. one caption word, the way CapCut's auto-captions would place it (that part is done in editing)
  if(showCaption) s+=`<text class="cap" x="${w/2}" y="${h*.775}" text-anchor="middle">UNDERNEATH</text>`;
  $('dl-g').innerHTML=s;
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
}
requestAnimationFrame(draw);
})();
