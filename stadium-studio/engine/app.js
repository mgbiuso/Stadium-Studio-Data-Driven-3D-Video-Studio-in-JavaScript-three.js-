/* Stadium Studio engine, part 2: lights, cameras, styles, UI and the frame loop. */
(function(){
'use strict';
if(!window.SS||!SS.ok) return;
const {$,app,stage,canvas,loading,labelsEl,renderer,maxAniso,reduceMotion,deg,TAU,lin,scene,mk,tex,CLIP_ABOVE,CLIP_UNDER,std,stadMat,underMat,mats,K,KFALL,KB,boxKB,resample,makeLoop,range,band,quadAt,tier,genStrip,genRing,orient,closedIdx,lettersTex,ribbonTex,friezeTex,roadTex,woodTex,strataTex,trainTex,SH,VENUES,newVenue,rrect,boundsOf,extrudeOutline,addGrounds,addTrees,addField,addSight}=SS;
/* =====================================================================
   Lights, cameras, controls
===================================================================== */
const hemi=new THREE.HemisphereLight(0xffffff,0x888888,.8); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,1.6);
sun.castShadow=true; sun.shadow.mapSize.set(4096,4096);
// Stage 1 realism: a soft studio sky for reflections, film-style color response, and haze (realistic views only)
const envMap=THREE.RoomEnvironment?new THREE.PMREMGenerator(renderer).fromScene(new THREE.RoomEnvironment(),.04).texture:null;
const HAZE={day:['#d9e0e8',420,1700],night:['#0b1220',380,1500],afternoon:['#e6e3dc',420,1700]};
let realKey='', fogBase=null;
// tall frames (like 9:16 video) pull the camera back to fit the width, so the haze starts farther away by the same amount
const aspectPull=()=>Math.max(1,Math.pow(1.55/(Wd/Ht),.8));
function fitFog(){if(scene.fog&&fogBase){const k=aspectPull(); scene.fog.near=fogBase[0]*k; scene.fog.far=fogBase[1]*k;}}
/* Stage 1b, realistic views only: soft shading where surfaces meet (SAO), glow around bright lights (bloom),
   then film-style color and screen color in one final step. Needs an opaque sky, so the style's backdrop is painted into the scene. */
const POST={on:false};
if(THREE.EffectComposer&&THREE.SAOPass&&THREE.UnrealBloomPass&&THREE.ShaderPass){
  const rt=new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType});
  POST.comp=new THREE.EffectComposer(renderer,rt);
  POST.render=new THREE.RenderPass(scene,null);
  POST.sao=new THREE.SAOPass(scene,new THREE.PerspectiveCamera(),false,true);
  Object.assign(POST.sao.params,{saoBias:.6,saoIntensity:.006,saoScale:2,saoKernelRadius:14,saoMinResolution:0,saoBlur:true,saoBlurRadius:4,saoBlurStdDev:2.5,saoBlurDepthCutoff:.004});
  POST.bloom=new THREE.UnrealBloomPass(new THREE.Vector2(256,256),.7,.45,.9);
  POST.final=new THREE.ShaderPass({uniforms:{tDiffuse:{value:null},exposure:{value:1},tone:{value:1}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse; uniform float exposure; uniform float tone; varying vec2 vUv;
      vec3 fit(vec3 v){vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b;}
      vec3 aces(vec3 c){const mat3 I=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777));
        const mat3 O=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602));
        c*=exposure/0.6; c=I*c; c=fit(c); c=O*c; return clamp(c,0.,1.);}
      vec3 srgb(vec3 c){return mix(pow(c,vec3(0.41666))*1.055-0.055,c*12.92,vec3(lessThanEqual(c,vec3(0.0031308))));}
      void main(){vec4 t=texture2D(tDiffuse,vUv); vec3 c=tone>.5?aces(max(t.rgb,0.)):t.rgb; gl_FragColor=vec4(srgb(c),1.);}`});
  [POST.render,POST.sao,POST.bloom,POST.final].forEach(p=>POST.comp.addPass(p));
}
// the style backdrops as scene skies (same colors as the CSS backdrops in studio.css)
const SKY={};
function skyTex(bg){
  if(SKY[bg]) return SKY[bg];
  const c=mk(512,512),x=c.getContext('2d'), rad=(stops,cy)=>{const g=x.createRadialGradient(256,cy,0,256,cy,420); stops.forEach(([o,col])=>g.addColorStop(o,col)); x.fillStyle=g; x.fillRect(0,0,512,512);};
  if(bg==='night'){rad([[0,'#1c2a46'],[.55,'#0c1322'],[1,'#04060b']],190); let s=5; const r=()=>((s=(s*16807)%2147483647)/2147483647); for(let i=0;i<140;i++){x.fillStyle=`rgba(255,255,255,${.3+r()*.5})`; x.fillRect(r()*512,r()*300,1.2,1.2);}}
  else if(bg==='drawing'){const g=x.createLinearGradient(0,0,0,512); g.addColorStop(0,'#b9bcc0'); g.addColorStop(1,'#a3a7ac'); x.fillStyle=g; x.fillRect(0,0,512,512);}
  else if(bg==='white') rad([[0,'#ffffff'],[.7,'#f4f3f0'],[1,'#e9e7e2']],205);
  else rad([[0,'#f5f7f9'],[.55,'#dfe5ec'],[1,'#c6ced8']],165);
  const t=tex(c); return SKY[bg]=t;
}
Object.assign(sun.shadow.camera,{left:-220,right:220,top:220,bottom:-220,near:10,far:1000});
sun.shadow.bias=-.0004; sun.shadow.normalBias=.4; scene.add(sun,sun.target);
const pointLights=[0,1,2,3].map(()=>{const l=new THREE.PointLight(0xfff1d6,0,460,1); scene.add(l); return l;});
const catcher=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400).rotateX(-Math.PI/2),new THREE.ShadowMaterial({opacity:.18}));
catcher.receiveShadow=true; scene.add(catcher);
const clouds=new THREE.Group(); scene.add(clouds);
[[-150,72,-80,1],[150,92,-130,1.2],[170,58,80,.9],[-130,96,110,1.1],[20,118,-210,1],[-40,64,190,.8]].forEach(([cx,cy,cz,s])=>{
  const g=new THREE.Group(); [[0,0,0,9],[9,-1,2,7],[-9,-2,-1,6.5],[3,4,-2,6],[-4,3,3,5.5]].forEach(([x,y,z,r])=>{const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mats.cloud); m.position.set(x,y,z); g.add(m);});
  g.position.set(cx,cy,cz); g.scale.setScalar(s); clouds.add(g);});

const persp=new THREE.PerspectiveCamera(34,1,6,2400);   // a tight depth range keeps the corner shading clean
const ortho=new THREE.OrthographicCamera(-1,1,1,-1,-2000,6000);
let cam=persp, orthoSize=150, Wd=1, Ht=1, tw=null, mode='showcase';
const target=new THREE.Vector3();
const controls=THREE.OrbitControls?new THREE.OrbitControls(persp,canvas):null;
if(controls){controls.enableDamping=true; controls.dampingFactor=.08; controls.enabled=true; controls.maxPolarAngle=Math.PI*.495; controls.minDistance=12; controls.maxDistance=1200; controls.screenSpacePanning=true; controls.addEventListener('start',()=>{tw=null;});}

/* =====================================================================
   Styles
===================================================================== */
const PAL={
  day:{k:{granite:'#d9c2b0',dirt:'#9a8a73',schist:'#4c535d',soil:'#b38b5d',lining:'#a39f96',seat2:'#22406f',pier:'#d8c4a2',ring:'#f4f2ec',gap:'#2c2723',ceil:'#dcc59e',ceil2:'#ceb48b',beam:'#8e7657',unit:'#d9d6cf',nbr:'#9a5b44',nbr2:'#cdc2ad',nbr3:'#bab6ad',sidewalk:'#c9c4b9',curb:'#a29d93',steel:'#56645b',nbrTop:'#8f8b85',podium:'#e3ded3',curtain:'#46525f',
    seat:'#22406f',aisle:'#a39f96',walk:'#b3aea4',riser:'#7e7c77',fascia:'#1a2947',soffit:'#6f6c66',back:'#bdb5a5',cap:'#b3ab9b',canopy:'#efeeea',roof:'#a9a397',wall:'#1a2947',wallTop:'#22345a',ground:'#8d877c',mpark:'#4d7b3d',inner:'#cfc4ad',boards:'#f3f3f0',cable:'#5d6470',roofTop:'#c3c6cb',slab:'#9b978f',platform:'#cfcac0',track:'#4a4743'},
    plinth:'#c9c2b4',field:'#ffffff',fieldMap:true,facade:'#ffffff',facadeMap:true,letters:true,ribbon:'#ffffff',ribbonMap:true,board:'#ffffff',boardMap:true,frieze:'#f4f3ef',dark:'#1f2622',accent:'#1a2947',monument:'#e3dfd6',lights:'#dcdcd8',red:'#c8102e',trunk:'#6b5641',crown:'#5a8549',trees:true,trainMap:true,soilTop:'#b9b2a5'},
  wire:{k:{seat:'#a2a6ac',aisle:'#b3b6bb',walk:'#b3b6bb',riser:'#979ba1',fascia:'#a9adb3',soffit:'#8f9399',back:'#aeb2b7',cap:'#a7abb1',canopy:'#c3c6ca',roof:'#aaaeb3',wall:'#9da1a7',wallTop:'#a5a9ae',ground:'#9a9ea4',mpark:'#9a9ea4',inner:'#b0b3b8',boards:'#b5b8bd',cable:'#8a8e94',roofTop:'#b9bcc1',slab:'#a0a4aa',platform:'#b0b3b8',track:'#8a8e94'},
    plinth:'#8c9096',field:'#a3a7ad',fieldMap:false,facade:'#b5b8bd',facadeMap:false,letters:false,ribbon:'#9da1a7',ribbonMap:false,board:'#9da1a7',boardMap:false,frieze:'#c8cbcf',dark:'#8f9399',accent:'#9da1a7',monument:'#b0b3b8',lights:'#b5b8bd',red:'#9da1a7',trunk:'#999',crown:'#aaa',trees:false,trainMap:false},
  toy:{k:{seat:'#ee6a3c',seat2:'#3f7fd4',aisle:'#f3f6fa',walk:'#eef3f9',riser:'#d5e2f2',fascia:'#7fa8de',soffit:'#d7e0ea',back:'#cfe0f5',cap:'#e6eef8',canopy:'#ffffff',roof:'#ffffff',wall:'#7fa8de',wallTop:'#93b7e6',ground:'#c3d7ef',mpark:'#86cf74',inner:'#dfeaf8',boards:'#ffffff',cable:'#9fb6d3',roofTop:'#ffffff',
    pier:'#b9d1f0',ring:'#ffffff',gap:'#8fb2e2',podium:'#a9c5ec',curtain:'#8fb2e2',nbrTop:'#e9f0f8'},
    plinth:'#a9c6ec',field:'#ffffff',fieldMap:true,facade:'#cfe0f5',facadeMap:false,letters:false,ribbon:'#2f5d9a',ribbonMap:false,board:'#ffffff',boardMap:true,frieze:'#ffffff',dark:'#2c4a73',accent:'#2f5d9a',monument:'#ffffff',lights:'#ffffff',red:'#e05a5a',trunk:'#b58d65',crown:'#76c267',trees:true},
  road:{k:{seat:'#d8322f',aisle:'#f2f2f2',walk:'#f2f2f2',riser:'#b9282a',fascia:'#2357b5',soffit:'#e9e9e9',back:'#ffffff',cap:'#f4f4f4',canopy:'#ffffff',roof:'#f1f1f1',wall:'#2357b5',wallTop:'#2357b5',ground:'#6b625b',mpark:'#5fa64a',inner:'#ffffff',boards:'#ffffff',cable:'#cfcfcf',roofTop:'#ffffff'},
    plinth:'#6e655d',field:'#ffffff',fieldMap:true,facade:'#ffffff',facadeMap:true,letters:true,ribbon:'#ffffff',ribbonMap:true,board:'#ffffff',boardMap:true,frieze:'#ffffff',dark:'#26292e',accent:'#2357b5',monument:'#ffffff',lights:'#ffffff',red:'#d8322f',trunk:'#7a5a3c',crown:'#4f9a46',trees:false},
  studio:{k:{seat:'#c8102e',aisle:'#f4f3f1',walk:'#f4f3f1',riser:'#ecebe8',fascia:'#0038a8',soffit:'#e6e4e0',back:'#f4f3f1',cap:'#efeeeb',canopy:'#ffffff',roof:'#f1f0ed',wall:'#0038a8',wallTop:'#0038a8',ground:'#e9e8e4',mpark:'#e9e8e4',inner:'#f4f3f1',boards:'#ffffff',cable:'#d8d6d2',roofTop:'#ffffff'},
    plinth:'#f1efeb',field:'#ffffff',fieldMap:true,facade:'#f5f4f1',facadeMap:false,letters:true,ribbon:'#ffffff',ribbonMap:true,board:'#ffffff',boardMap:true,frieze:'#ffffff',dark:'#e7e5e0',accent:'#e7e5e0',monument:'#ffffff',lights:'#ffffff',red:'#c8102e',trunk:'#ddd',crown:'#eee',trees:false},
  pastel:{k:{seat:'#ef8a4c',aisle:'#f6b57a',walk:'#f6b57a',riser:'#e27a3f',fascia:'#ffffff',soffit:'#f3d7c3',back:'#ef8a4c',cap:'#f08f52',canopy:'#ffffff',roof:'#ffffff',wall:'#ffffff',wallTop:'#ffffff',ground:'#f4c36c',mpark:'#7cc46d',inner:'#ef8a4c',boards:'#ffffff',cable:'#f6c9a8',roofTop:'#ffffff'},
    plinth:'#9a9a9a',field:'#ffffff',fieldMap:true,facade:'#ee8448',facadeMap:false,letters:false,ribbon:'#ffffff',ribbonMap:false,board:'#ffffff',boardMap:false,frieze:'#ffffff',dark:'#f4c36c',accent:'#f4c36c',monument:'#ffffff',lights:'#ffffff',red:'#e05a5a',trunk:'#b58d65',crown:'#7cc46d',trees:false},
  illus:{k:{ring:'#f4f1ea',pier:'#e9dcc2',ceil:'#efe3c9',ceil2:'#e4d4b4',beam:'#a99a80',podium:'#efe9dc',curtain:'#5f7fa3',seat2:'#3f86c6',unit:'#d9d4c8',
    seat:'#3f86c6',aisle:'#e9e3d6',walk:'#e9e3d6',riser:'#b94a44',fascia:'#a7413c',soffit:'#d9d2c3',back:'#e4d2b0',cap:'#d8c49f',canopy:'#9a9590',roof:'#a8a39a',wall:'#3a6ea5',wallTop:'#3a6ea5',ground:'#c45d4f',mpark:'#5aa04a',inner:'#e4d2b0',boards:'#ffffff',cable:'#77736d',roofTop:'#b3aea5',slab:'#b9b2a6',platform:'#e2dccf',track:'#5b5550'},
    plinth:'#c45d4f',field:'#ffffff',fieldMap:true,facade:'#ffffff',facadeMap:true,letters:true,ribbon:'#ffffff',ribbonMap:true,board:'#ffffff',boardMap:true,frieze:'#ffffff',dark:'#2f3a45',accent:'#3a6ea5',monument:'#ffffff',lights:'#f1efe9',red:'#c8102e',trunk:'#7a5a3c',crown:'#4f9a46',trees:true,trainMap:true,soilTop:'#9a9488'},
  bpsheet:null,
  blueprint:{k:{seat:'#86aad8',aisle:'#eef3f8',walk:'#eef3f8',riser:'#c9d7e8',fascia:'#4f7fb5',soffit:'#d6e0ec',back:'#f4f7fa',cap:'#f4f7fa',canopy:'#ffffff',roof:'#f1f4f8',wall:'#8fb0d6',wallTop:'#8fb0d6',ground:'#eef2f6',mpark:'#e2eee2',inner:'#f4f7fa',boards:'#ffffff',cable:'#9fb2c8',roofTop:'#f4f7fa',slab:'#e9eef4',platform:'#f4f6f9',track:'#9fb2c8'},
    plinth:'#eef2f6',field:'#e6eef2',fieldMap:false,facade:'#f6f8fb',facadeMap:false,letters:false,ribbon:'#c9d8ea',ribbonMap:false,board:'#dfe8f2',boardMap:false,frieze:'#ffffff',dark:'#dfe7f0',accent:'#c9d8ea',monument:'#ffffff',lights:'#ffffff',red:'#e7a0a0',trunk:'#ddd',crown:'#eee',trees:false,trainMap:false,soilTop:'#e3d7c2'}
};
// the drawing sheet: every surface the same navy, so only the white outlines read
PAL.bpsheet=(()=>{const N='#1f3e70',k={}; Object.keys(K).forEach(n=>k[n]=N); return {k,plinth:N,field:'#ffffff',fieldMap:'bp',facade:N,facadeMap:false,letters:false,ribbon:N,ribbonMap:false,board:N,boardMap:false,frieze:N,dark:N,accent:N,monument:N,lights:N,red:N,trunk:N,crown:N,trees:false,trainMap:false,soilTop:N};})();
// iso map-icon palettes: start from the daylight colors, then push each toward its reference
const isoPal=(k,o)=>Object.assign({},PAL.day,{k:Object.assign({},PAL.day.k,{seat:'#2b2c31',seat2:'#2b2c31',ground:'#3a3d44'},k),trees:true,trainMap:false,winMap:true,podMap:true},o);
PAL.day.winMap=PAL.day.podMap=true; PAL.illus.winMap=PAL.illus.podMap=true;
PAL.cel=isoPal({fascia:'#2c4a73',back:'#ece4d4',cap:'#e6dccb',canopy:'#ffffff',roof:'#a8a091',roofTop:'#9d9282',unit:'#f3eee5',pier:'#f3e9d3',ring:'#ffffff',gap:'#5b4a3d',podium:'#f4f1ea',curtain:'#5f93b8',nbrTop:'#d9d3c7',inner:'#ece4d4'},
  {facade:'#ddb487',facadeMap:false,winMap:false,podMap:true,lotTop:'#e3c3ad',lotSide:'#b8937c',lotEdge:'#cfa58c',crown:'#5c9e4b',trunk:'#7a5a3c'});
PAL.pixel=isoPal({roof:'#8e8778',roofTop:'#867b6b',unit:'#e6e1d6',pier:'#e9d7b8',ring:'#f7f6f2',gap:'#3d322a',podium:'#e6e1d6',curtain:'#3e6d93',nbrTop:'#b9b2a5'},
  {facade:'#f2d9b8',lotTop:'#b8b2a6',lotSide:'#6a645b',lotEdge:'#d6d1c6',crown:'#3f9a3c',trunk:'#6b4e33'});
PAL.ink=isoPal({roof:'#7d7466',roofTop:'#756a5b',unit:'#d8d0c0',pier:'#e6cfa8',ring:'#f1ece0',gap:'#2e2620',podium:'#d9d0bf',curtain:'#4c6b80',nbrTop:'#a89f8f'},
  {facade:'#e7c79f',lotTop:'#c9bfa9',lotSide:'#7f735f',lotEdge:'#ddd3bd',crown:'#3d7d38',trunk:'#5b4330'});
const LIGHTS={
  day:{hs:'#e3ecf7',hg:'#7f7666',hi:.8,sc:'#fff1dc',si:1.7,sp:[150,240,110],pl:0,cat:.18,glow:'screens'},
  night:{hs:'#3a4a6e',hg:'#07090d',hi:.3,sc:'#9fb4dd',si:.26,sp:[-120,220,-40],pl:.75,cat:0,glow:'night'},
  arena:{hs:'#fff1de',hg:'#3a3328',hi:.75,sc:'#ffffff',si:.15,sp:[60,240,40],pl:1.5,cat:0,glow:'arena'},
  afternoon:{hs:'#e6eef8',hg:'#7a705f',hi:.72,sc:'#ffe0b8',si:1.9,sp:[-170,125,125],pl:0,cat:.22,glow:'screens'},
  sheet:{hs:'#ffffff',hg:'#ffffff',hi:1,sc:'#ffffff',si:0,sp:[0,300,0],pl:0,cat:0,glow:'none'},
  dusk:{hs:'#ffe9cf',hg:'#6f6a5c',hi:.62,sc:'#ffc98a',si:1.65,sp:[-230,125,150],pl:0,cat:.3,glow:'dusk'},
  studio:{hs:'#ffffff',hg:'#d9d2cc',hi:.95,sc:'#ffffff',si:1.35,sp:[-140,260,180],pl:0,cat:.38,glow:'screens'},
  wire:{hs:'#ffffff',hg:'#5c6066',hi:1.05,sc:'#ffffff',si:.75,sp:[150,240,110],pl:0,cat:0,glow:'none'},
  toy:{hs:'#f2f8ff',hg:'#aebccc',hi:1,sc:'#ffffff',si:1.1,sp:[120,260,60],pl:0,cat:.12,glow:'screens'},
  flat:{hs:'#ffffff',hg:'#c9d3de',hi:.95,sc:'#ffffff',si:.75,sp:[80,200,300],pl:0,cat:0,glow:'none'},
  iso:{hs:'#f4f6fa',hg:'#9a948a',hi:.85,sc:'#fff4e2',si:1.35,sp:[-120,220,160],pl:0,cat:.25,glow:'screens'},
  atlas:{hs:'#fffaf0',hg:'#d8ccb4',hi:1.05,sc:'#fff6e6',si:.6,sp:[-120,220,160],pl:0,cat:.12,glow:'none'}
};
const STYLES={
  aerial:{name:'Daylight aerial',refs:'Refs 1 · 2 · 4 · 19 · 21',desc:'The hero shot. Full color and sun shadows, with the real neighborhood where city data exists.',pal:'day',light:'day',bg:'day',real:true,haze:'day'},
  corner:{name:'Street corner',refs:'New ref · corner view',desc:'A low corner view across the intersection in warm afternoon light, with the real streets and neighboring buildings where city data exists.',pal:'day',light:'afternoon',bg:'day',real:true,haze:'afternoon'},
  night:{name:'Night game',refs:'Ref 6',desc:'Lights on. Windows, screens and signage glow against a night sky.',pal:'day',light:'night',bg:'night',real:true,env:false,haze:'night',exposure:1.25,glow:true},
  bowl:{name:'Inside the bowl',refs:'Refs 5 · 8 · 13 · 14 · arena photos',desc:'From the seats, looking across the playing surface toward the upper decks, the ceiling and the banners.',pal:'day',light:V=>V.indoor?'arena':'day',bg:V=>V.indoor?'night':'day',flyIn:true,real:true,exposure:1.55,glow:true,
    opts:[['seat','Seats'],['up','Second view']],optsWhen:V=>!!V.camOv.bowlUp,optFx:{up:{cam:'bowlUp'}}},
  overhead:{name:'Overhead',refs:'Ref 3',desc:'Straight down from above, like a drone shot. In Explore, scroll to zoom straight through the roof into the bowl.',pal:'day',light:'day',bg:'day',flyIn:true,real:true,haze:'day'},
  exploded:{name:'Exploded',refs:'Refs 9 · 10 · 22',desc:'Just the arena, its levels lifted apart and labeled: station, event level and 100s, 200s, bridges and scoreboard, ceiling, roof.',pal:'day',light:'day',bg:'drawing',explode:true,edges:'ink',station:true,real:true,
    shell:false,annex:false,plinth:false,clipUnder:'box',labels:'exploded'},
  wire:{name:'Wireframe',refs:'Ref 11',desc:'The raw model in a 3D-software viewport look, with live triangle and vertex counts. In Explore, zoom through the roof.',pal:'wire',light:'wire',bg:'wire',edges:'wire',stats:true,flyIn:true},
  isoCel:{name:'Iso · cel',refs:'Iso ref 4',desc:'The venue as a map icon: the real building, roof on, in flat cel-shaded color like an animated film.',pal:'cel',light:'iso',bg:'cel',edges:'cel',iso:true,
    opts:[['lot','On a lot'],['float','Floating']]},
  isoPixel:{name:'Iso · pixel',refs:'Iso refs 1 · 2',desc:'The venue as a map icon in dense, crisp pixel art, like a city-builder game.',pal:'pixel',light:'iso',bg:'pixel',edges:'pixel',iso:true,pixel:.42,
    opts:[['lot','On a lot'],['float','Floating']]},
  isoInk:{name:'Iso · ink',refs:'Iso ref 5',desc:'The venue as a map icon with bold ink outlines and painted color, like an illustrated poster.',pal:'ink',light:'afternoon',bg:'ink',edges:'inkbold',iso:true,
    opts:[['lot','On a lot'],['float','Floating']]},
  studio:{name:'Color studio',refs:'Ref 16',desc:'A white model on one bold floor color, with only the team colors picked out.',pal:'studio',light:'studio',bg:'studio',plinth:false,trees:false},
  cutaway:{name:'Cutaway',refs:'Refs 20 · 23',desc:'The real building sliced in half to show every layer, from the roof down to the trains, with sightlines from the seats.',pal:'day',light:'day',bg:'white',station:true,edges:'soft',plinth:false,real:true,
    clip:'half',soil:'half',sight:true,labels:'section',cam:'section'},
  underground:{name:'Underground',refs:'City, MTA and USGS data',desc:'Everything above the sidewalk lifted away: the station levels, subway and rail tunnels, soil and the bedrock underneath, from real borings.',
    pal:'day',light:'day',bg:'drawing',real:true,station:true,under:true,clip:'ground',plinth:false,trees:false,labels:'under',cam:'underground'},
  xray:{name:'X-ray city',refs:'City, MTA and USGS data',desc:'The buildings turn to glass so you can see what runs underneath them: station, tunnels and rock.',
    pal:'day',light:'day',bg:'drawing',station:true,under:true,xray:true,edges:'xray',plinth:false,trees:false,labels:'under',cam:'underground'},
  blueprint:{name:'Blueprint sheet',refs:'New ref · blueprint',desc:'A flat drawing sheet: an elevation on top and the floor plan below, drawn as white lines from the real outline and heights. A still drawing, so Explore is off.',pal:'bpsheet',light:'sheet',bg:'bpsheet',edges:'chalk',plinth:false,trees:false,city:false,sheet:true}
};
const ORDER=['aerial','corner','night','bowl','overhead','underground','xray','exploded','wire','isoCel','isoPixel','isoInk','studio','cutaway','blueprint'];
// views that show the real neighborhood around the venue
const CITY=new Set(['aerial','corner','night','overhead','wire','underground','xray']);
const CAMS={
  aerial:{off:[-200,169,257],tgt:[0,-4,-2],fov:34},
  corner:{off:[-235,62,250],tgt:[0,8,0],fov:40},
  blueprint:{off:[0,500,1],tgt:[0,0,0],fov:30},
  night:{off:[0,123,333],tgt:[0,2,-18],fov:36},
  overhead:{off:[0,560,3],tgt:[0,0,15],fov:34},
  exploded:{off:[-260,200,300],tgt:[0,30,0],fov:36},
  wire:{off:[-215,154,247],tgt:[0,-4,-2],fov:34},
  iso:{ortho:true,dir:[1,.82,1],tgt:[0,8,0],size:120},
  road:{off:[250,230,300],tgt:[0,-10,0],fov:32},
  studio:{off:[-240,200,300],tgt:[0,-6,0],fov:32},
  pastel:{ortho:true,dir:[-1,1.1,1],tgt:[0,-8,0],size:150},
  cutaway:{ortho:true,dir:[1,.95,1],tgt:[0,-16,0],size:168},
  section:{ortho:true,dir:'section',tgt:[0,6,0],size:96},
  underground:{off:[-150,175,235],tgt:[0,-10,0],fov:36}
};

let V=null, current='aerial', exploded=false;
const resolve=(v)=>typeof v==='function'?v(V):v;

function recolor(kc){
  const cols=[]; for(const n in K) cols[K[n]]=lin(kc[n]||'#cccccc');
  V.kindMeshes.forEach(m=>{const a=m.geometry.attributes.color,ks=m.userData.kinds; for(let v=0;v<ks.length;v++){const c=cols[ks[v]]; a.array[3*v]=c.r; a.array[3*v+1]=c.g; a.array[3*v+2]=c.b;} a.needsUpdate=true;});
}
function setMat(mat,hex,map){if(!mat)return; mat.color.copy(lin(hex)); if(map!==undefined && mat.map!==map){mat.map=map; mat.needsUpdate=true;}}
function glow(mat,hex,map,intensity){
  if(!mat) return; const on=!!hex; mat.emissive.copy(on?lin(hex):new THREE.Color(0)); const em=on?(map||null):null;
  if(mat.emissiveMap!==em){mat.emissiveMap=em; mat.needsUpdate=true;} mat.emissiveIntensity=intensity||1;
}
const edgeMats={above:new THREE.LineBasicMaterial({transparent:true}),under:new THREE.LineBasicMaterial({transparent:true})};
const EDGE_LOOK={xray:['#7fb8e6',.32],wire:['#2a2d31',.75],ink:['#1d1f24',.5],blue:['#1f4e8c',.6],chalk:['#eef3ff',.92],soft:['#2a2c31',.22],cel:['#26303c',.5],pixel:['#1b2330',.6],inkbold:['#141414',.85],sepia:['#4a3622',.9]};
function setEdges(look){
  if(look && !V.edgesBuilt){V.edgeTargets.forEach(m=>{const under=m.material===underMat||CLIP_UNDER.includes(Array.isArray(m.material)?m.material[4]:m.material);
      const l=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry,15),under?edgeMats.under:edgeMats.above); m.add(l); m.userData.edge=l;}); V.edgesBuilt=true;}
  if(look){const [c,o]=EDGE_LOOK[look]; Object.values(edgeMats).forEach(m=>{m.color.copy(lin(c)); m.opacity=o;});}
  V.edgeTargets.forEach(m=>{if(m.userData.edge) m.userData.edge.visible=!!look;});
}
function setClip(modeC,underC){
  let above=[],under=[],inter=false;
  // three.js hides points on the negative side of a plane, so a normal of -x with constant c hides everything where x > c
  if(modeC==='quad'){above=[new THREE.Plane(new THREE.Vector3(-1,0,0),V.cut.x),new THREE.Plane(new THREE.Vector3(0,0,-1),V.cut.z)]; inter=true;}
  // hide everything above the sidewalk: set on the renderer itself, so the shading and shadow passes skip it too
  renderer.clippingPlanes=modeC==='ground'?[new THREE.Plane(new THREE.Vector3(0,-1,0),0)]:[];
  if(modeC==='half'){const s=V.section,p=new THREE.Plane(s.axis==='x'?new THREE.Vector3(-1,0,0):new THREE.Vector3(0,0,-1),s.c); above=[p]; under=[p];}
  // exploded: keep only the part of the station right under the arena (hidden if outside any of the four walls)
  if(underC==='box'){const r=V.boxR||80; under=[[-1,0,r],[1,0,r],[0,-1,r],[0,1,r]].map(([x,z,c])=>new THREE.Plane(new THREE.Vector3(x,0,z),c));}
  const set=(m,pl)=>{m.clippingPlanes=pl; m.clipIntersection=inter; m.clipShadows=true; m.needsUpdate=true;};   // cut-away parts cast no shadows either
  CLIP_ABOVE.forEach(m=>set(m,above)); set(edgeMats.above,above); CLIP_UNDER.forEach(m=>set(m,under)); set(edgeMats.under,under);
  (V.trainMats||[]).forEach(m=>{m.clippingPlanes=under.concat(V.trainClip||[]); m.clipIntersection=false; m.needsUpdate=true;});
}
function setXray(on){
  CLIP_ABOVE.forEach(m=>{
    if(on){if(!m.userData.xr){m.userData.xr={t:m.transparent,o:m.opacity,d:m.depthWrite}; m.transparent=true; m.opacity=.12; m.depthWrite=false; m.needsUpdate=true;}}
    else if(m.userData.xr){const x=m.userData.xr; m.transparent=x.t; m.opacity=x.o; m.depthWrite=x.d; delete m.userData.xr; m.needsUpdate=true;}});
}
function setLights(lightKey){
  const Lt=LIGHTS[lightKey], S=STYLES[current];
  hemi.color.copy(lin(Lt.hs)); hemi.groundColor.copy(lin(Lt.hg)); hemi.intensity=Lt.hi*(scene.environment?.55:1);
  const es=(V.eras&&V.eras.info[V.era]||{}).sun, sp=es&&Lt.si>1?es:Lt.sp;   // an era can bring its own sun (e.g. opening day, 1910)
  sun.color.copy(lin(Lt.sc)); sun.intensity=Lt.si; sun.position.set(V.center.x+sp[0],sp[1],V.center.z+sp[2]); sun.target.position.copy(V.center);
  const pp=V.pointPos[lightKey]||[]; pointLights.forEach((l,k)=>{if(pp[k]){l.position.set(...pp[k]); l.intensity=Lt.pl;} else l.intensity=0;});
  catcher.visible=Lt.cat>0; catcher.material.opacity=Lt.cat; catcher.position.set(V.center.x,S.wood?-9.4:-3.7,V.center.z);
}
let shotsOn=false;

function applyStyle(key,instant){
  current=key; const S=curStyle(), pal=PAL[S.pal], lightKey=resolve(S.light), Lt=LIGHTS[lightKey];
  exploded=!!S.explode; app.dataset.style=key; V.inside=false;
  const kc=Object.assign({},PAL.day.k,pal.k);
  if(S.pal==='day') Object.assign(kc,V.dayK); else for(const n in KFALL) if(!pal.k[n]) kc[n]=kc[KFALL[n]];
  if(S.pal==='studio') Object.assign(kc,{seat:V.studio.seat,seat2:V.studio.seat,fascia:V.studio.trim,wall:V.studio.trim,wallTop:V.studio.trim});
  recolor(kc);
  setMat(V.mats.field,pal.fieldMap==='bp'?(V.tex.fieldBP?'#ffffff':pal.plinth):pal.field,pal.fieldMap==='bp'?(V.tex.fieldBP||null):pal.fieldMap?V.tex.field:null);
  setMat(V.mats.facade,pal.facade,pal.facadeMap?V.tex.facade:null);
  setMat(V.mats.ribbon,pal.ribbon,pal.ribbonMap?V.tex.ribbon:null);
  setMat(V.mats.board,pal.board,pal.boardMap?V.tex.board:null);
  setMat(V.mats.marquee,pal.board,pal.boardMap?V.tex.marquee:null);
  setMat(V.mats.ad,pal.board,pal.boardMap?V.tex.ad:null);
  setMat(V.mats.ring,kc.ring); (V.finMats||[]).forEach(m=>setMat(m,kc.pier));
  setMat(V.mats.win,'#ffffff',pal.winMap?V.tex.win:null); setMat(V.mats.glassWall,'#ffffff',pal.winMap?V.tex.win:null); setMat(V.mats.pod,'#ffffff',pal.podMap?V.tex.pod:null);
  (V.facadeMats||[]).forEach(m=>setMat(m,'#ffffff',pal.winMap?m.userData.map||(m.userData.map=m.map):null)); setMat(V.mats.walk,'#ffffff');
  setMat(V.mats.lotTop,pal.lotTop||pal.plinth); setMat(V.mats.lotSide,pal.lotSide||pal.plinth); setMat(V.mats.lotEdge,pal.lotEdge||pal.plinth);
  (V.bannerMats||[]).forEach(m=>setMat(m,pal.boardMap?'#ffffff':pal.board,pal.boardMap?m.userData.map:null));
  setMat(mats.frieze,pal.frieze);
  ['dark','accent','monument','lights','red','trunk','crown'].forEach(n=>setMat(mats[n],pal[n]));
  setMat(mats.cloud,'#ffffff');
  setMat(mats.plinthTop,pal.plinth); setMat(mats.plinthSide,pal.plinth);
  setMat(mats.woodTop,'#7f9f58'); setMat(mats.woodSide,'#ffffff');
  setMat(mats.square,pal.plinth); setMat(mats.road,'#ffffff');
  setMat(mats.soilTop,pal.soilTop||PAL.day.soilTop); setMat(mats.soilSide,'#ffffff');
  setMat(V.mats.streets,lightKey==='night'?'#565b64':'#ffffff');
  (V.trainMats||[]).filter(m=>!m.userData.plain).forEach(m=>setMat(m,pal.trainMap===false?'#c9cdd2':'#ffffff',pal.trainMap===false?null:m.userData.map));

  // what is visible
  const city=CITY.has(key)&&S.city!==false, lotOn=!!S.iso&&optOf(key)==='lot';
  V.plinth.visible=S.plinth!==false && !S.wood && !S.square && !(S.iso&&(V.lot||!lotOn)) && !(city&&V.hidePlinthInCity);
  if(V.lot) V.lot.visible=lotOn;
  if(V.shell) V.shell.visible=S.shell!==false; if(V.annex) V.annex.visible=S.annex!==false;
  V.wood.visible=!!S.wood; V.square.visible=!!S.square;
  V.road.visible=!!S.road; V.roadHide.forEach(o=>o.visible=!S.road||!!V.city);
  V.trees.visible=pal.trees && S.trees!==false && (V.city?city:true);
  if(V.city) V.city.visible=city;
  V.soil.visible=S.soil==='cut'; V.soilHalf.visible=S.soil==='half';
  V.G.under.visible=!!(S.station && V.station);
  V.roofObjs.forEach(o=>o.visible=S.roof!==false && !shotsOn);
  if(V.hang) V.hang.visible=S.clip!=='toytop' && !shotsOn;
  if(V.shotPlane) V.shotPlane.visible=shotsOn && !S.sheet;
  if(V.sight) V.sight.visible=!!S.sight;
  V.letters.visible=pal.letters; clouds.visible=!!S.clouds;
  $('tilt-top').hidden=$('tilt-bot').hidden=$('vignette').hidden=!S.tilt;
  setEdges(S.edges||null); setClip(S.clip||null,S.clipUnder||null); setXray(!!S.xray);
  if(V.ground) V.ground.visible=!!(S.under||S.clip==='half');   // the soil and bedrock block shows in the underground views and the cutaway
  // map-icon looks: pixel art is drawn small and scaled up without smoothing
  const pr=S.pixel||(REC.size?1:Math.min(window.devicePixelRatio||1,2)); if(renderer.getPixelRatio()!==pr){renderer.setPixelRatio(pr); renderer.setSize(Wd,Ht,false); if(POST.comp){POST.comp.setPixelRatio(pr); POST.comp.setSize(Wd,Ht);}}
  canvas.style.imageRendering=S.pixel?'pixelated':'';
  // fly-in: only some views let Explore pass through the roof; the rest stop outside the walls
  if(controls){controls.minDistance=(S.flyIn||shotsOn||!V.indoor)?12:(V.flyGuard||12); controls.zoomSpeed=S.flyIn?1.6:1;}

  // lights
  // realism switches: only recompile materials when they actually change
  const rk=S.real?('real|'+(S.haze||'')+'|'+(S.exposure||.95)+'|'+(S.env!==false)):'flat';
  if(rk!==realKey){realKey=rk;
    POST.on=!!(S.real&&POST.comp);
    renderer.toneMapping=S.real&&!POST.on?THREE.ACESFilmicToneMapping:THREE.NoToneMapping; renderer.toneMappingExposure=S.exposure||.95;

    scene.environment=S.real&&S.env!==false?envMap:null;
    const hz=S.haze&&HAZE[S.haze]; scene.fog=hz?new THREE.Fog(lin(hz[0]),hz[1],hz[2]):null; fogBase=hz?[hz[1],hz[2]]:null; fitFog();
    scene.traverse(o=>{if(o.material) (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.needsUpdate=true; if('envMapIntensity' in m) m.envMapIntensity=m.metalness>.3?1:.28;});});}
  if(V.mats.glassWall){V.mats.glassWall.metalness=S.real?.55:0; V.mats.glassWall.roughness=S.real?.16:.8;}
  if(V.mats.field){V.mats.field.roughness=S.real?.28:1;}
  if(POST.on){POST.final.uniforms.exposure.value=S.exposure||.95; POST.bloom.enabled=!!S.glow;}
  scene.background=POST.on?skyTex(resolve(S.bg)):null;
  setLights(lightKey); clouds.position.copy(V.center);
  const g=Lt.glow, M=V.mats, fin=V.finMats||[];
  [M.facade,M.field,M.ribbon,M.board,M.letters,M.marquee,M.ad,M.ring,M.win,M.glassWall,mats.lights,mats.globe,...(V.facadeMats||[]),...fin,...(V.bannerMats||[])].forEach(m=>glow(m));
  if(g==='night'){glow(M.facade,'#ffffff',V.tex.facadeNight,1); glow(M.field,'#ffffff',V.tex.field,V.indoor?.2:.55); glow(M.ribbon,'#ffffff',V.tex.ribbon,1.25); glow(M.board,'#ffffff',V.tex.board,1.35); glow(mats.lights,'#fff4d6',null,2.6); glow(M.letters,'#ffffff',V.tex.letters,.9); glow(M.marquee,'#ffffff',V.tex.marquee,1.5); glow(M.ad,'#ffffff',V.tex.ad,1.4);
    glow(M.ring,'#3f6dff',null,1.25); fin.forEach((m,k)=>glow(m,['#ff2a3c','#ffffff','#2f5bff'][k],V.tex.finGlow,.95)); glow(M.win,'#ffd9a6',V.tex.winNight,1); glow(M.glassWall,'#ffd9a6',SS.FACADE.night,.8); (V.facadeMats||[]).forEach(m=>glow(m,'#ffd9a6',SS.FACADE.night,.9)); glow(mats.globe,'#5fe08a',null,1.6);}
  else if(g==='arena'){glow(M.field,'#ffffff',V.tex.field,.3); glow(M.ribbon,'#ffffff',V.tex.ribbon,1.3); glow(M.board,'#ffffff',V.tex.board,1.5); glow(M.marquee,'#ffffff',V.tex.marquee,1.2); glow(mats.lights,'#fff4d6',null,2); (V.bannerMats||[]).forEach(m=>glow(m,'#ffffff',m.userData.map,.12));}
  else if(g==='dusk'){glow(M.facade,'#ffffff',V.tex.facadeNight,.5); glow(M.ribbon,'#ffffff',V.tex.ribbon,.8); glow(M.board,'#ffffff',V.tex.board,1); glow(mats.lights,'#fff1cf',null,1.8); glow(M.letters,'#ffffff',V.tex.letters,.35); glow(M.marquee,'#ffffff',V.tex.marquee,1.1); glow(M.ad,'#ffffff',V.tex.ad,1.1); glow(M.win,'#ffd9a6',V.tex.winNight,.45); glow(M.ring,'#ffffff',null,.15);}
  else if(g==='screens'){if(pal.ribbonMap) glow(M.ribbon,'#ffffff',V.tex.ribbon,.35); if(pal.boardMap){glow(M.board,'#ffffff',V.tex.board,.45); glow(M.marquee,'#ffffff',V.tex.marquee,.45); glow(M.ad,'#ffffff',V.tex.ad,.45);}}

  // backdrop, UI
  stage.dataset.bg=resolve(S.bg); app.style.setProperty('--studio',V.studio.bg);
  $('stats').hidden=!S.stats;
  $('n-name').textContent=S.name; $('n-refs').textContent=S.refs; $('n-desc').textContent=S.desc;
  document.querySelectorAll('.style-btn').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.key===key)));
  buildLabels(); renderOpts(key);
  $('sheet').hidden=!S.sheet; if(S.sheet) fillSheet();
  bShots.hidden=!V.shots||!!S.sheet; bShots.setAttribute('aria-pressed',String(shotsOn));
  // one camera mode: each style glides the camera into place, and you can always drag and zoom (except on the still blueprint)
  bReset.hidden=hint.hidden=!controls||!!S.sheet; if(controls) controls.enabled=!S.sheet; userMoved=false;
  updateDataNote(); layoutCache=null;
  for(const k in V.G) if(instant||reduceMotion){V.G[k].position.copy(expOf(k));}
  if(V.eras&&V.eras.refresh) V.eras.refresh();   // keep the other era's buildings hidden
  goTo(preset(viewKey()),instant);
  if(SS.studio&&SS.studio.onStyle) SS.studio.onStyle(S);
}
/* style options: a small two-way switch some styles carry (cutaway cut, bowl seat, iso base) */
const OPT={};
function optOf(key){const S=STYLES[key]; if(!S.opts||(S.optsWhen&&!S.optsWhen(V))) return null; return OPT[key]||S.opts[0][0];}
function curStyle(){const S=STYLES[current], o=optOf(current); return o&&S.optFx&&S.optFx[o]?Object.assign({},S,S.optFx[o]):S;}
function renderOpts(key){
  const box=$('opts'), S=STYLES[key], cur=optOf(key); box.textContent=''; box.hidden=!cur; if(!cur) return;
  ((key==='bowl'&&V.bowlOpts)||S.opts).forEach(([k,l])=>{const b=document.createElement('button'); b.type='button'; b.textContent=l; b.setAttribute('aria-pressed',String(k===cur));
    b.addEventListener('click',()=>{if(OPT[key]===k) return; OPT[key]=k; applyStyle(key);}); box.appendChild(b);});
}
/* live trains: if data/live_trains.py is running on this Mac, swap the timetable for real MTA arrivals */
function pollLive(){
  fetch('http://127.0.0.1:8790/live.json',{cache:'no-store'}).then(r=>r.json()).then(d=>{
    if(!d.updated) return; const base=d.updated-600;   // a little in the past, so trains already pulling in still show
    Object.values(VENUES).forEach(v=>{const L=d.venues&&d.venues[v.key]; if(v.setLive&&L){v.setLive(L.arrivals,base); v.liveTrains=true; v.liveBase=base;}});
    simMin=-1;
  }).catch(()=>{Object.values(VENUES).forEach(v=>{if(v.liveTrains&&v.resetTrains) v.resetTrains(); v.liveTrains=false;});});
}
setTimeout(pollLive,1500); setInterval(pollLive,20000);
/* the extra line under the style notes: train clock and shot-map legend */
let lastClock='';
function updateDataNote(clock){
  const S=STYLES[current], parts=[];
  if(V.trainAt && (V.trainShown?V.trainShown():V.G.under.visible)) parts.push(`${V.trainLabel||'LIRR at Penn Station'} · ${clock||lastClock||''} · ${V.liveTrains?'live from the MTA':'real schedule for '+new Date((V.trainDate||'2026-01-01')+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})+', 1 minute per second'}`);
  if(shotsOn && V.shots && !S.sheet){const sh=V.shots; parts.push(`Shot map · ${sh.games} home games, ${sh.season.slice(0,4)}-${sh.season.slice(6)} · ${sh.team}: ${sh.team_shots.length.toLocaleString('en-US')} shots, ${sh.goals.team} goals (red) · Opponents: ${sh.opp.length.toLocaleString('en-US')} shots, ${sh.goals.opp} goals (gold)`);}
  const el=$('n-data'); el.hidden=!parts.length; el.textContent=parts.join('  ·  ');
}

/* blueprint sheet: two flat views drawn into one frame */
/* blueprint poster: a three-quarter elevation on top, the plan with callouts and a cut through the stands below,
   and a tall title strip on the right. Every line is the building's own outline, drawn white on navy. */
const sheetCam={E:new THREE.OrthographicCamera(-1,1,1,-1,-4000,4000),P:new THREE.OrthographicCamera(-1,1,1,-1,-4000,4000),S:new THREE.OrthographicCamera(-1,1,1,-1,-4000,4000)};
const planCut=[new THREE.Plane(new THREE.Vector3(0,-1,0),31.5)];
let layoutCache=null;
function fillSheet(){
  const sh=V.sheet||{title:V.name,rows:[]}, t=$('sh-title'); t.innerHTML='';
  const n=document.createElement('p'); n.className='sh-name'; n.textContent=sh.title; t.appendChild(n);
  const a=document.createElement('p'); a.className='sh-addr'; a.textContent=sh.addr||''; t.appendChild(a);
  const dl=document.createElement('dl'); sh.rows.forEach(([k,v])=>{const dt=document.createElement('dt'); dt.textContent=k; const dd=document.createElement('dd'); dd.textContent=v; dl.append(dt,dd);}); t.appendChild(dl);
  $('sh-elev').textContent=sh.elevName||'Elevation'; $('sh-plan').textContent=sh.planName||'Plan'; $('sh-sec').textContent=sh.secName||'Stands cross section';
  V.sheetBox=null;
}
function sheetLayout(){
  if(layoutCache) return layoutCache;
  const ar=app.getBoundingClientRect(), tb=[...document.querySelectorAll('.topbar > *')].reduce((m,e)=>Math.max(m,e.getBoundingClientRect().bottom),0)-ar.top;
  const bt=document.querySelector('.bottom').getBoundingClientRect().top-ar.top;
  const wide=Wd>=900, tw=wide?Math.min(230,Wd*.18):0, f={x:16,y:tb+10,w:Wd-32,h:Math.max(200,bt-tb-20)};
  const pad=26, x0=f.x+pad, x1=f.x+f.w-pad-(wide?tw+12:0), y0=f.y+pad+14, y1=f.y+f.h-pad, gap=34;
  const hE=(y1-y0-gap)*.46, yL=y0+hE+gap, wP=wide?(x1-x0-gap)*.56:(x1-x0);
  layoutCache={F:f,E:{x:x0,y:y0,w:x1-x0,h:hE},P:{x:x0,y:yL,w:wP,h:y1-yL},S:wide?{x:x0+wP+gap,y:yL,w:x1-x0-wP-gap,h:y1-yL}:null,
    T:wide?{x:f.x+f.w-tw-14,y:f.y+14,w:tw,h:f.h-28}:null};
  return layoutCache;
}
// fit an ortho camera to a set of world points, keeping the viewport's shape
function fitCam(c,rect,pts,pad){
  c.updateMatrixWorld(); const inv=c.matrixWorldInverse, v=new THREE.Vector3(); let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  pts.forEach(p=>{v.copy(p).applyMatrix4(inv); x0=Math.min(x0,v.x); x1=Math.max(x1,v.x); y0=Math.min(y0,v.y); y1=Math.max(y1,v.y);});
  let w=(x1-x0)/2*pad,h=(y1-y0)/2*pad; const cx=(x0+x1)/2,cy=(y0+y1)/2,asp=rect.w/rect.h; if(w/h>asp) h=w/asp; else w=h*asp;
  c.left=cx-w; c.right=cx+w; c.top=cy+h; c.bottom=cy-h; c.updateProjectionMatrix(); return rect.w/(2*w);
}
const corners=b=>[0,1,2,3,4,5,6,7].map(i=>new THREE.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z));
function renderSheet(){
  const Ly=sheetLayout(), sh=V.sheet||{};
  if(!V.sheetBox){const b=new THREE.Box3(); ['lower','middle','facade','upper'].forEach(k=>b.expandByObject(V.G[k])); b.min.y=Math.max(b.min.y,0); V.sheetBox=b;}
  const b=V.sheetBox, ctr=b.getCenter(new THREE.Vector3());
  // elevation: a three-quarter view from the building's main side
  const ed=new THREE.Vector3(...(sh.elevDir||[.55,.2,1])).normalize(), E=sheetCam.E;
  E.position.copy(ctr).addScaledVector(ed,900); E.up.set(0,1,0); E.lookAt(ctr); fitCam(E,Ly.E,corners(b),1.04);
  // plan from straight above, north up
  const P=sheetCam.P; P.position.set(ctr.x,900,ctr.z); P.up.set(0,0,-1); P.lookAt(ctr.x,0,ctr.z); const ppm=fitCam(P,Ly.P,corners(b),1.06);
  // stands cross section: a thin slice through the stands, seen straight on
  const sec=V.section, ax=sec.axis, cut=sec.c, S=sheetCam.S, sb=sh.sec||{h:[-70,-12],y:[-2,48]};
  const nrm=ax==='x'?new THREE.Vector3(-1,0,0):new THREE.Vector3(0,0,-1), secPlanes=[new THREE.Plane(nrm.clone(),cut),new THREE.Plane(nrm.clone().negate(),-(cut-7))];
  const sp=ax==='x'?[new THREE.Vector3(cut,sb.y[0],sb.h[0]),new THREE.Vector3(cut,sb.y[1],sb.h[1])]:[new THREE.Vector3(sb.h[0],sb.y[0],cut),new THREE.Vector3(sb.h[1],sb.y[1],cut)];
  if(Ly.S&&!V.secScene&&sh.profile){V.secScene=new THREE.Scene(); const lm=new THREE.LineBasicMaterial({color:lin('#eef3ff')});
    sh.profile.forEach(pl=>V.secScene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pl.map(p=>new THREE.Vector3(...p))),lm)));}
  if(Ly.S){S.position.set(ax==='x'?cut+600:(sb.h[0]+sb.h[1])/2,(sb.y[0]+sb.y[1])/2,ax==='x'?(sb.h[0]+sb.h[1])/2:cut+600); S.up.set(0,1,0); S.lookAt(ax==='x'?cut:S.position.x,S.position.y,ax==='x'?S.position.z:cut); fitCam(S,Ly.S,sp,1.08);}
  const pass=(c,r,planes,hideHang)=>{const y=Ht-r.y-r.h; renderer.setViewport(r.x,y,r.w,r.h); renderer.setScissor(r.x,y,r.w,r.h);
    renderer.clippingPlanes=planes; const hv=V.hang?V.hang.visible:false; if(hideHang&&V.hang) V.hang.visible=false; renderer.render(scene,c); if(V.hang) V.hang.visible=hv;};
  renderer.setClearColor(0x000000,0); renderer.setScissorTest(false); renderer.setViewport(0,0,Wd,Ht); renderer.clear();
  renderer.autoClear=false; renderer.setScissorTest(true);
  pass(E,Ly.E,[],false); pass(P,Ly.P,planCut,true);
  if(Ly.S){const y=Ht-Ly.S.y-Ly.S.h; renderer.setViewport(Ly.S.x,y,Ly.S.w,Ly.S.h); renderer.setScissor(Ly.S.x,y,Ly.S.w,Ly.S.h); renderer.clippingPlanes=[]; if(V.secScene) renderer.render(V.secScene,S); else renderer.render(scene,S);}
  renderer.setScissorTest(false); renderer.setViewport(0,0,Wd,Ht); renderer.autoClear=true; renderer.clippingPlanes=[];
  // overlay: frame, view titles, callouts with leader lines, scale bar, title strip
  const pos=(id,x,y,w,h)=>{const e=$(id); e.style.transform=`translate(${x}px,${y}px)`; if(w!==undefined) e.style.width=w+'px'; if(h!==undefined) e.style.height=h+'px';};
  pos('sh-frame',Ly.F.x,Ly.F.y,Ly.F.w,Ly.F.h);
  pos('sh-elev',Ly.E.x,Ly.E.y-22); pos('sh-plan',Ly.P.x,Ly.P.y-22); $('sh-sec').hidden=!Ly.S; if(Ly.S) pos('sh-sec',Ly.S.x,Ly.S.y-22);
  const bar=$('sh-scale'), px=50*ppm; bar.style.width=px+'px'; pos('sh-scale',Ly.P.x+Ly.P.w-px,Ly.P.y+Ly.P.h-14);
  $('sh-title').hidden=!Ly.T; if(Ly.T) pos('sh-title',Ly.T.x,Ly.T.y,Ly.T.w,Ly.T.h);
  const svg=$('sh-lines'); let html='';
  const callout=(cam,r,p,t,side)=>{const v=new THREE.Vector3(...p).project(cam); if(Math.abs(v.x)>1||Math.abs(v.y)>1) return '';
    const x=r.x+(v.x+1)/2*r.w, y=r.y+(1-v.y)/2*r.h, lx=side<0?r.x+6:r.x+r.w-6, ty=y;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6"/><polyline points="${x.toFixed(1)},${y.toFixed(1)} ${(x+(lx-x)*.35).toFixed(1)},${ty.toFixed(1)} ${lx},${ty.toFixed(1)}"/>`+
      `<text x="${side<0?lx:lx}" y="${(ty-4).toFixed(1)}" text-anchor="${side<0?'start':'end'}">${t}</text>`;};
  (sh.callouts||[]).forEach((c,k)=>{html+=callout(P,Ly.P,c.p,c.t,c.side||(k%2?1:-1));});
  if(Ly.S) (V.labels.section||[]).forEach(l=>{const inside=ax==='x'?(l.p[2]>=Math.min(...sb.h)&&l.p[2]<=Math.max(...sb.h)&&Math.abs(l.p[0]-cut)<40):(l.p[0]>=Math.min(...sb.h)&&l.p[0]<=Math.max(...sb.h)&&Math.abs(l.p[2]-cut)<40);
    if(inside) html+=callout(S,Ly.S,[ax==='x'?cut:l.p[0],l.p[1],ax==='x'?l.p[2]:cut],l.t,1);});
  svg.setAttribute('viewBox',`0 0 ${Wd} ${Ht}`); svg.innerHTML=html;
}

/* cameras */
function preset(key){
  const S=STYLES[key], c=Object.assign({},CAMS[key]||(S&&S.iso?CAMS.iso:{}),(S&&S.iso&&V.camOv.iso)||{},V.camOv[key]||{}), aspect=Wd/Ht;
  if(c.abs) return {type:'p',pos:new THREE.Vector3(...c.pos),tgt:new THREE.Vector3(...c.tgt),fov:c.fov};
  const s=V.scale, tgt=new THREE.Vector3(V.center.x+c.tgt[0]*s,c.tgt[1],V.center.z+c.tgt[2]*s);
  if(c.ortho){const dir=c.dir==='section'?(V.section.axis==='x'?[1,.14,.25]:[.25,.14,1]):c.dir; return {type:'o',pos:new THREE.Vector3(...dir).normalize().multiplyScalar(700).add(tgt),tgt,size:c.size*s};}
  const p=new THREE.Vector3(...c.off).multiplyScalar(s); p.multiplyScalar(aspectPull()).add(tgt);
  return {type:'p',pos:p,tgt,fov:c.fov};
}
function updateOrtho(){const aspect=Wd/Ht,halfH=aspect<1.25?orthoSize*1.25/aspect:orthoSize; ortho.left=-halfH*aspect; ortho.right=halfH*aspect; ortho.top=halfH; ortho.bottom=-halfH; ortho.updateProjectionMatrix();}
function goTo(pr,instant){
  const wantO=pr.type==='o', switching=wantO!==(cam===ortho);
  if(wantO){orthoSize=pr.size; updateOrtho();}
  if(switching||instant||reduceMotion){
    cam=wantO?ortho:persp; if(controls) controls.object=cam;
    cam.position.copy(pr.pos); target.copy(pr.tgt); if(!wantO) persp.fov=pr.fov; cam.zoom=1; cam.updateProjectionMatrix(); cam.lookAt(target);
    if(controls) controls.target.copy(target); tw=null; return;
  }
  tw={t:0,dur:1.35,p0:cam.position.clone(),p1:pr.pos.clone(),t0:target.clone(),t1:pr.tgt.clone(),f0:persp.fov,f1:wantO?persp.fov:pr.fov,z0:cam.zoom};
  tw.bump=Math.min(120,tw.p0.distanceTo(tw.p1)*.22);
}
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function expOf(k){const v=exploded?V.EXP[k]:0; return Array.isArray(v)?new THREE.Vector3(...v):new THREE.Vector3(0,v||0,0);}

/* labels */
let LBL=[], lblMode=null;
function buildLabels(){
  labelsEl.textContent=''; lblMode=curStyle().labels||null;
  LBL=lblMode?V.labels[lblMode].map(L=>{const el=document.createElement('div'); el.className='label'; el.innerHTML='<span class="txt"></span><span class="lead"></span><span class="dot"></span>'; el.querySelector('.txt').textContent=L.t; labelsEl.appendChild(el); return Object.assign({el,v:new THREE.Vector3()},L);}):[];
}
function updateLabels(){
  let show=!!lblMode && !tw && !REC.size;
  if(lblMode==='exploded') show=show && V.G.crown.position.distanceTo(expOf('crown'))<10;
  labelsEl.hidden=!show; if(!show) return;
  LBL.forEach(L=>{
    const off=L.g?V.G[L.g].position:new THREE.Vector3();
    L.v.set(L.p[0]+off.x,L.p[1]+off.y,L.p[2]+off.z).project(cam);
    const x=(L.v.x+1)/2*Wd,y=(1-L.v.y)/2*Ht, flip=lblMode==='section'?x>Wd*.5:x<Wd*.42;
    L.el.classList.toggle('flip',flip);
    L.el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(${flip?-5:5}px,-50%) translateX(${flip?'0':'-100%'})`;
  });
}

/* =====================================================================
   UI
===================================================================== */
const row=$('styles');
ORDER.forEach(k=>{
  const b=document.createElement('button'); b.type='button'; b.className='style-btn'; b.dataset.key=k; b.setAttribute('aria-pressed','false');
  b.innerHTML='<span class="s-name"></span><span class="s-ref"></span>'; b.querySelector('.s-name').textContent=STYLES[k].name; b.querySelector('.s-ref').textContent=STYLES[k].refs;
  b.addEventListener('click',()=>applyStyle(k)); row.appendChild(b);
});
const bReset=$('reset'),hint=$('hint'),bShots=$('m-shots');
let userMoved=false;
if(controls) controls.addEventListener('start',()=>{userMoved=true;});
const viewKey=()=>shotsOn&&V.shots&&!STYLES[current].sheet?'shots':(curStyle().cam||current);
bShots.addEventListener('click',()=>{shotsOn=!shotsOn; applyStyle(current);});
bReset.addEventListener('click',()=>goTo(preset(viewKey())));
/* eras: a venue can carry more than one moment in time (V.eras, e.g. MSG today and Penn Station in 1910).
   The venue swaps its own buildings; the engine shows the switch, the title and the styles that era supports. */
const erasBox=$('eras');
const eraInfo=()=>(V.eras&&V.eras.info[V.era])||{};
const skipped=k=>(V.skipStyles||[]).includes(k)||(eraInfo().skip||[]).includes(k);
function renderTitle(){
  const e=eraInfo(); $('v-eyebrow').textContent=e.eyebrow||V.eyebrow; $('v-name').textContent=e.name||V.name;
  const sp=$('v-spec'); sp.textContent=''; (e.spec||V.spec).forEach(t=>{const s=document.createElement('span'); s.textContent=t; sp.appendChild(s);});
  canvas.setAttribute('aria-label','3D model of '+(e.name||V.name));
  document.querySelectorAll('.style-btn').forEach(b=>b.hidden=skipped(b.dataset.key));
}
function renderEras(){
  erasBox.textContent=''; erasBox.hidden=!V.eras; if(!V.eras) return;
  V.eras.list.forEach(([k,label])=>{const b=document.createElement('button'); b.type='button'; b.textContent=label; b.setAttribute('aria-pressed',String(k===V.era));
    b.addEventListener('click',()=>setEra(k)); erasBox.appendChild(b);});
}
function setEra(k,instant){
  if(!V.eras||V.era===k) return;
  V.era=k; V.eras.apply(k,!!(instant||reduceMotion));   // the venue swaps its buildings (animated in V.eras.tick)
  renderTitle(); renderEras(); applyStyle(skipped(current)?'aerial':current);
}
function setVenue(key){
  if(V) V.root.visible=false;
  V=VENUES[key]; V.root.visible=true; if(!V.shots) shotsOn=false;
  if(skipped(current)) current='aerial';
  renderTitle(); renderEras();
  document.querySelectorAll('.venues button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.venue===key)));
  applyStyle(current,true);
}
// one switcher button per venue recipe that loaded
function makeVenueButtons(){
  const box=document.querySelector('.venues');
  Object.values(VENUES).forEach(v=>{const b=document.createElement('button'); b.type='button'; b.dataset.venue=v.key; b.setAttribute('aria-pressed','false'); b.textContent=v.short||v.name;
    b.addEventListener('click',()=>{if(v.key!==V.key) setVenue(v.key);}); box.appendChild(b);});
}

/* build both venues, then start */
SS.builders.forEach(b=>b()); makeVenueButtons();
const vertCount=v=>{let n=0; v.root.traverse(o=>{if(o.isMesh&&o.geometry) n+=o.geometry.attributes.position.count*(o.isInstancedMesh?o.count:1);}); return n;};
Object.values(VENUES).forEach(v=>v.verts=vertCount(v));

/* recording: the recorder (engine/recorder.js) can fix the drawing size, pause the loop, set a clock and drive the camera */
const REC={size:null,paused:false,clock:null,driver:null};
function resize(){
  if(REC.size) return;   // while recording, the video size wins over the window size
  Wd=Math.max(1,canvas.clientWidth||app.clientWidth); Ht=Math.max(1,canvas.clientHeight||app.clientHeight);
  renderer.setSize(Wd,Ht,false); persp.aspect=Wd/Ht; persp.updateProjectionMatrix(); updateOrtho(); layoutCache=null;
  if(POST.comp){POST.comp.setPixelRatio(renderer.getPixelRatio()); POST.comp.setSize(Wd,Ht);}
  fitFog();
  if(V && !tw && !userMoved) goTo(preset(viewKey()),true);
}
/* the depth range follows the camera: a far-away camera (tall video frames, big zoom-outs) gets a deeper near plane,
   which keeps the corner shading clean instead of drawing dark outlines. Close views keep the tuned 6 to 2400. */
function fitDepth(){
  if(cam!==persp) return; const d=persp.position.distanceTo(target), n=Math.max(6,d/61), f=Math.max(2400,d*6.5);
  if(Math.abs(persp.near-n)>.05||Math.abs(persp.far-f)>1){persp.near=n; persp.far=f; persp.updateProjectionMatrix();
    if(POST.sao) POST.sao.params.saoScale=2*f/2400;}   // the shading divides its scale by the far distance, so keep that ratio fixed
}
new ResizeObserver(resize).observe(app); resize();
setVenue('yankee');

const clock=new THREE.Clock(); let fT=0,fN=0,first=true,simT=0,simMin=-1;
const fmt=n=>n.toLocaleString('en-US');
const nowSec=()=>REC.clock!==null?REC.clock:Date.now()/1000;
function frame(){
  requestAnimationFrame(frame);
  const dt=Math.min(clock.getDelta(),.1);
  if(REC.paused) return;   // the recorder is stepping frames itself
  step(dt);
  fT+=dt; fN++; if(fT>.5){const fps=Math.round(fN/fT); fT=0; fN=0;
    if(STYLES[current].stats) $('stats').textContent=`[Perspective] [Edged faces]  Tris ${fmt(renderer.info.render.triangles)}  ·  Verts ${fmt(V.verts)}  ·  ${fps} fps`;}
  if(first){first=false; loading.hidden=true;}
}
/* one frame: move things on by dt seconds, then draw */
function step(dt){
  if(V.eras&&V.eras.tick) V.eras.tick(dt);
  for(const k in V.G){const want=expOf(k),g=V.G[k]; if(reduceMotion) g.position.copy(want); else g.position.lerp(want,Math.min(1,dt*4));}
  if(REC.driver){REC.driver(dt); if(controls) controls.target.copy(target);}
  else if(tw){
    tw.t+=dt/tw.dur; const e=tw.t>=1?1:ease(tw.t);
    cam.position.lerpVectors(tw.p0,tw.p1,e); cam.position.y+=Math.sin(Math.PI*e)*tw.bump; target.lerpVectors(tw.t0,tw.t1,e);
    if(cam===persp) persp.fov=tw.f0+(tw.f1-tw.f0)*e; cam.zoom=tw.z0+(1-tw.z0)*e; cam.updateProjectionMatrix(); cam.lookAt(target);
    if(controls) controls.target.copy(target); if(tw.t>=1) tw=null;
  } else if(controls && controls.enabled){controls.update(); target.copy(controls.target);}
  else cam.lookAt(target);
  if(clouds.visible) clouds.children.forEach((c,k)=>{c.position.x+=Math.sin(clock.elapsedTime*.2+k)*.02;});
  // trains under MSG: one real-schedule minute per second, looping 5 to 6 pm
  if(V.trainAt && (V.trainShown?V.trainShown():V.G.under.visible)){
    let tm; if(V.liveTrains){tm=(nowSec()-V.liveBase)/60;} else {simT=(simT+(reduceMotion?0:dt))%60; tm=simT;}
    V.trainAt(tm); const mm=Math.floor(tm*(V.liveTrains?4:1));
    if(mm!==simMin){simMin=mm; lastClock=V.drawBoard(tm,V.liveTrains?new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):null); updateDataNote(lastClock);}}
  // Explore: once the camera passes under the roof, switch to the arena's own lighting
  if(V.indoor && ((controls && controls.enabled && !tw) || REC.driver)){const r=Math.hypot(cam.position.x-V.center.x,cam.position.z-V.center.z), inside=r<V.Ri && cam.position.y>0 && cam.position.y<V.yC(r);
    if(inside!==!!V.inside){V.inside=inside; setLights(inside?'arena':resolve(STYLES[current].light)); stage.dataset.bg=inside?'night':resolve(STYLES[current].bg);}}
  fitDepth();
  if(STYLES[current].sheet) renderSheet();
  else if(POST.on){POST.render.camera=cam; POST.sao.enabled=cam===persp; if(POST.sao.enabled) POST.sao.camera=persp; POST.comp.render(dt);}
  else {renderer.setClearColor(0x000000,0); renderer.render(scene,cam);}
  if(SS.studio.onFrame) SS.studio.onFrame();   // the recorder copies the frame here, while the picture is still in the canvas
  updateLabels();
}

/* the small set of controls the recorder needs */
SS.studio={
  REC, step, canvas, renderer,
  onFrame:null, onStyle:null,
  style:()=>({key:current,S:curStyle(),bg:resolve(curStyle().bg),post:POST.on,venue:V.key,studioBg:V.studio.bg}),
  view:()=>({o:cam===ortho,pos:cam.position.clone(),tgt:target.clone(),fov:persp.fov,zoom:cam.zoom,size:orthoSize}),
  setView(v){
    const want=v.o?ortho:persp; if(cam!==want){cam=want; if(controls) controls.object=cam;}
    if(v.o){orthoSize=v.size; updateOrtho();} else persp.fov=v.fov;
    cam.position.copy(v.pos); target.copy(v.tgt); cam.zoom=v.zoom; cam.updateProjectionMatrix(); cam.lookAt(target);
    if(controls) controls.target.copy(target); tw=null;
  },
  // draw at an exact video size (or back to the window when w is null)
  setSize(w,h){
    if(w){REC.size=[w,h]; const pr=curStyle().pixel||1; renderer.setPixelRatio(pr); renderer.setSize(w,h,false); Wd=w; Ht=h;
      persp.aspect=w/h; persp.updateProjectionMatrix(); updateOrtho(); if(POST.comp){POST.comp.setPixelRatio(pr); POST.comp.setSize(w,h);} fitFog();}
    else {REC.size=null; const pr=curStyle().pixel||Math.min(window.devicePixelRatio||1,2); renderer.setPixelRatio(pr); resize();}
    layoutCache=null;
  },
  refit(){resize();},
  setEra(k,instant){setEra(k,instant);},
  // a point in the scene to screen position (-1 to 1 across and up), using the camera of the last drawn frame
  project(v){return v.project(cam);},
  setControls(on){if(controls) controls.enabled=on&&!STYLES[current].sheet;}
};
frame();
})();
