/* Episode 1 cut (v14): the arena on top of a train station.
   The recipe for SS.episode.render (stadium-studio/engine/episode.js), rendered from stadium-studio/msg.html.
   Shots are cut to the voice lines, so if a line changes, the shots move with it.
   v14: script v2 (script-v2.md), real photos for the history half, the Garden rising out of the tracks,
   running captions, a music bed, and an ending that loops back to the first frame. */
(function(){
const DIR='../videos/01-msg-penn-station/', PH='../real%20photo%20references/';
const LINES=[
  'Right now, there could be a hockey game happening on top of the busiest train station in the Western Hemisphere.',
  "This is Madison Square Garden. Let's lift it out of the city.",
  'Under the ice: Penn Station. Twenty-one tracks, forty-two feet down, cut into Manhattan bedrock.',
  'More than six hundred thousand people pass through it every day, while trains run right under the seats.',
  "It wasn't always a basement. In nineteen-ten, this was Penn Station, with a waiting room fifteen stories tall.",
  'By the fifties, the railroad was losing money.',
  'The air above Penn Station was worth more than the station itself. So the railroad sold it, and in nineteen sixty-three, tore down the palace underneath.',
  'Demolition started on October twenty-eighth. It rained that day.',
  'It took three years. Most of the stone was dumped in a New Jersey swamp.',
  'In return, the railroad got a new station for free, underground, plus a quarter of the new Garden.',
  'The outrage gave New York its landmarks law, the one that later saved Grand Central.',
  'Now Penn Station is getting an eight billion dollar rebuild, with columns again. But the Garden stays on top. Should it?'];
// on-screen captions: | splits the line into the chunks that pop on screen one after another; * marks a key chunk (drawn bigger)
const CAPS=[
  'RIGHT NOW,|THERE COULD BE|A HOCKEY GAME|HAPPENING ON TOP|OF THE BUSIEST|*TRAIN STATION|IN THE WESTERN|HEMISPHERE',
  'THIS IS|*MADISON SQUARE GARDEN|LET\'S LIFT IT|OUT OF THE CITY',
  'UNDER THE ICE:|*PENN STATION|*21 TRACKS|*42 FEET DOWN|CUT INTO|MANHATTAN BEDROCK',
  'MORE THAN|*600,000 PEOPLE|PASS THROUGH IT|EVERY DAY|WHILE TRAINS RUN|RIGHT UNDER|THE SEATS',
  'IT WASN\'T ALWAYS|A BASEMENT|*IN 1910|THIS WAS|*PENN STATION|WITH A WAITING ROOM|*15 STORIES TALL',
  'BY THE FIFTIES|THE RAILROAD WAS|*LOSING MONEY',
  'THE AIR ABOVE|PENN STATION|*WAS WORTH MORE|THAN THE STATION|ITSELF|SO THE RAILROAD|*SOLD IT|AND IN 1963|*TORE DOWN|THE PALACE|UNDERNEATH',
  'DEMOLITION STARTED|*ON OCTOBER 28|IT RAINED|THAT DAY',
  'IT TOOK|*3 YEARS|MOST OF THE STONE|WAS DUMPED IN A|*NEW JERSEY SWAMP',
  'IN RETURN|THE RAILROAD GOT|A NEW STATION|*FOR FREE|*UNDERGROUND|PLUS A QUARTER|*OF THE NEW GARDEN',
  'THE OUTRAGE|GAVE NEW YORK|*ITS LANDMARKS LAW|THE ONE THAT|LATER SAVED|*GRAND CENTRAL',
  'NOW PENN STATION|IS GETTING AN|*$8 BILLION|REBUILD|WITH COLUMNS AGAIN|BUT THE GARDEN|*STAYS ON TOP|*SHOULD IT?'];

// where each realistic shot sits inside the FLUX repaints (fixed: measured from the v13 reels, which were rendered once)
const REEL={
  'S2-cutout':{src:DIR+'clips/realism-reel-A-flux.mp4',from:0,len:3.933},
  'S3-section':{src:DIR+'clips/realism-reel-A-flux.mp4',from:3.933,len:5.628},
  'S6-then':{src:DIR+'clips/realism-reel-B-flux.mp4',from:0,len:10.616},
  'S7-rain':{src:DIR+'clips/realism-reel-C-flux.mp4',from:0,len:3.106},
  'S6-1910-plate':{src:DIR+'clips/realism-reel-C-flux.mp4',from:3.106,len:10.616}};
const photo=(name,file,credit,o)=>Object.assign({type:'photo',name,src:PH+file,credit,zoom:[1.04,1.16]},o||{});

window.EPISODE={
  title:'ep01-arena-on-a-train-station',
  has:{G1:true,real:true,reel:true},
  voice:{lines:LINES.map((_,k)=>DIR+'voice/v2/line'+String(k+1).padStart(2,'0')+'.wav'),start:.3,gap:.25,gain:1.1},
  build(L){
    const s=i=>L[i].start, e=i=>L[i].end;
    const at=(i,w)=>s(i)+(e(i)-s(i))*Math.max(0,LINES[i].indexOf(w))/LINES[i].length;
    // shots laid end to end: each entry is [shot, end time]; a shot's length is its end minus the previous end
    const plan=[], add=(sh,end)=>plan.push([sh,end]);
    const has=this.has, n1end=at(1,'lift')+.2, n1=n1end-(e(0)+.15);

    // 1. hook: the Google Earth dive, with the hook written on the very first frame
    add({type:'video',name:'G1',src:DIR+'clips/G1-radius-vertical.mp4',speed:10.9/(e(0)+.15),
      title:{text:'THERE\'S A TRAIN STATION\nUNDER THIS ARENA',y:.3,size:104,weight:900,lw:16,at:0,until:2.8}},e(0)+.15);
    // 2. the realistic aerial, day to night (AI mood shot)
    add({type:'video',name:'S1-real',src:DIR+'clips/ai-test/S1-day-night-realistic.mp4',
      overlay:{src:DIR+'clips/ai-test/S1-day-night-realistic.mp4',from:n1,alpha:[[0,0],[.9,0],[1.6,1],[n1,1]]}},n1end);
    // 3. the floating block and the dive to the trains, then the section (same lengths as in v13, so the repaints line up)
    add({type:'studio',name:'S2-cutout',style:'cutout',layer:'cutout',cam:{from:{shot:'blockWide'},to:{shot:'blockDive'}}},at(2,'Twenty-one')-.1);
    add({type:'studio',name:'S3-section',style:'slice',layer:'trackflow',cam:{from:{shot:'sliceA'},to:{shot:'sliceB'}},linear:true},s(3)-.1);
    // 4. X-ray, wide enough for both subway lines
    add({type:'studio',name:'S4-xray',style:'xray',layer:'routes',centerOn:'block',cam:{from:{orbit:0,dolly:1.55},to:{orbit:25,dolly:1.4}},linear:true},s(4)-.1);
    // 5. 1910 in real photos (Library of Congress / Detroit Publishing, public domain)
    add(photo('P-aerial','penn%20station%20story%20candidates/14%20Pennsylvania%20Station%20aerial%20view,%201910s.jpg','PENN STATION, 1910s · DETROIT PUBLISHING CO.',{fy:.45}),at(4,'this was')-.05);
    add(photo('P-front','penn%20station%201910/02%20exterior%20from%206th%20ave%201912.jpg','7TH AVENUE FRONT, 1912 · LIBRARY OF CONGRESS',{fy:.4}),at(4,'with a')-.05);
    add(photo('P-waiting','penn%20station%201910/05%20main%20waiting%20room%201905.jpg','MAIN WAITING ROOM · LIBRARY OF CONGRESS',{zoom:[1.08,1.24],fy:.55}),s(5)-.1);
    // 6. the decline: 1942, then 1962
    add(photo('P-1942','penn%20station%201910/11%20waiting%20room%201942.jpg','WAITING ROOM, 1942 · LIBRARY OF CONGRESS'),at(5,'the railroad')-.05);
    add(photo('P-1962','penn%20station%20story%20candidates/03%20Main%20concourse%20of%20Pennsylvania%20Station,%20New%20York%20City%20on%20April%2024,%20196.jpg','CONCOURSE, APRIL 1962 · CERVIN ROBINSON, HABS'),s(6)-.1);
    // 7. the trade: today's Garden dissolving into the 1910 station (two repaints)
    const swT=at(6,'So the')-(s(6)-.1)+.1;
    add({type:'studio',name:'S6-then',style:'aerial',centerOn:false,cam:{from:{shot:'gardenTop'},to:{shot:'pennWide'}},events:[{t:swT,era:'1910'}]},e(6)+.25);
    // 8. demolition day in the rain (the 3.1 s repaint stretched to fit, in slow motion)
    add({type:'studio',name:'S7-rain',style:'night',era:'1910',centerOn:false,layer:'weather63',cam:{from:{shot:'pennWide'},to:{shot:'pennRain'}}},s(8)-.1);
    // 9. gone: the station torn down, the tracks still running (Mike's pick from the build-up sample)
    const T=[-20,-20,0], A={tgt:T,off:[-540,405,600]}, B={tgt:T,off:[-470,390,625]}, C={tgt:[-10,-6,0],off:[-330,420,690]};   // framed for the vertical video
    add({type:'studio',name:'B-gone',style:'cutout',era:'gone',centerOn:false,cam:{from:A,to:B},linear:true},s(9)-.1);
    // 10. the Garden rises out of the tracks, piece by piece
    add({type:'studio',name:'B-rise',style:'cutout',era:'today',centerOn:false,cam:{from:B,to:C},linear:true,
      build:[{g:'lower',t:.4},{g:'facade',t:.8},{g:'middle',t:1.8},{g:'upper',t:2.4},{g:'crown',t:3.6,drop:90},{g:'roof',t:4.9,drop:110}]},s(10)-.1);
    // 11. what it saved
    add(photo('P-gct','grand%20central/02%20main%20concourse%201903-1920.jpg','GRAND CENTRAL · DETROIT PUBLISHING CO.',{zoom:[1.02,1.16],fy:.45}),s(11)-.1);   // the gray scan (the 1913 one is tinted pink)
    // 12. the question, over the Earth dive played in reverse: it ends on the video's first frame, so the loop is seamless
    const endT=e(11)+1.6;
    add({type:'video',name:'G1-out',src:DIR+'clips/G1-radius-vertical.mp4',fadeOut:0,
      title:{text:'SHOULD THE\nGARDEN STAY?',y:.3,size:120,weight:900,lw:16}},endT);

    // lengths from the end times, then the realistic repaints
    let t0=0; const shots=plan.map(([sh,end])=>{sh.dur=end-t0; t0=end; return sh;});
    const by=n=>shots.find(x=>x.name===n);
    by('G1-out').from=10.85; by('G1-out').speed=-10.85/by('G1-out').dur;
    by('G1-out').title.at=e(11)-(endT-by('G1-out').dur)-.2;   // the end title comes up as he finishes the question
    if(has.reel){
      ['S2-cutout','S3-section','S6-then'].forEach(n=>{const sh=by(n), r=REEL[n]; sh.real={src:r.src,from:r.from,speed:Math.min(1,r.len/sh.dur)};});
      const r7=by('S7-rain'); r7.real={src:REEL['S7-rain'].src,from:0,speed:Math.min(1,REEL['S7-rain'].len/r7.dur)};
      const s6=by('S6-then'), p=REEL['S6-1910-plate']; s6.real2={src:p.src,from:p.from,at:swT,fade:2.4,speed:s6.real.speed};
    }

    // captions: each chunk shows from its estimated start in the line (by spoken length) to the next chunk
    const captions=[];
    CAPS.forEach((line,i)=>{
      const parts=line.split('|'), w=parts.map(p=>p.replace(/[*?,.:']/g,'').replace(/\d/g,'xxxx').replace('$','xxxxxx').length+1), tot=w.reduce((a,b)=>a+b,0);
      let acc=0; parts.forEach((p,k)=>{const a=s(i)+(e(i)-s(i))*acc/tot; acc+=w[k]; const b=k===parts.length-1?e(i)+.15:s(i)+(e(i)-s(i))*acc/tot;
        const key=p[0]==='*'; captions.push({t0:a,t1:b,text:p.replace('*',''),size:key?100:80,y:.74});});
    });
    // music bed under everything (ducks while Victor talks); quiet rain under the 1963 shot. No other effects.
    const music={src:'/videos/_sound/music/doc-underscore-take1.mp3',gain:.32,duck:.4,fadeIn:.5,fadeOut:2.5};
    const r=by('S7-rain'), rStart=shots.slice(0,shots.indexOf(r)).reduce((a,x)=>a+x.dur,0);
    const sfx=[{src:'/videos/_sound/sfx/rain-2.mp3',t:rStart,gain:.3}];
    return {shots,captions,music,sfx};
  }
};
})();
