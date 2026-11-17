/* Episode 1 cut: the arena on top of a train station.
   The recipe for SS.episode.render (stadium-studio/engine/episode.js), rendered from stadium-studio/msg.html.
   Shots are cut to the voice lines, so if a line changes, the shots move with it.
   Every studio shot is centered on the Garden unless it says otherwise (centerOn). */
(function(){
const DIR='../videos/01-msg-penn-station/';
const LINES=[
  'Right now, there could be a hockey game happening on top of the busiest train station in the Western Hemisphere.',
  "This is Madison Square Garden. Let's lift it out of the city.",
  'Under the ice: Penn Station. Twenty-one tracks, forty-two feet down, cut into Manhattan bedrock.',
  'More than six hundred thousand people pass through it every day, while trains run right under the seats.',
  'So how do you hang a roof over all that? Forty-eight steel cables, stretched across a ring four hundred and four feet wide, like a giant bicycle wheel.',
  "But the Garden wasn't built on empty ground. To make room, New York tore down this.",
  'Demolition started on October twenty-eighth, nineteen sixty-three. It rained that day.',
  "And losing it set off a chain reaction that saved Grand Central. That's part two."];

window.EPISODE={
  title:'ep01-arena-on-a-train-station',
  has:{G1:true,G2:false,real:true},
  voice:{lines:LINES.map((_,k)=>DIR+'voice/line'+String(k+1).padStart(2,'0')+'.wav'),start:.3,gap:.25,gain:1.1},
  build(L){
    const s=i=>L[i].start, e=i=>L[i].end;
    const at=(i,w)=>s(i)+(e(i)-s(i))*Math.max(0,LINES[i].indexOf(w))/LINES[i].length;
    // cut points: Earth orbit to the end of line 1, the photo held for 3 seconds
    const cut=[0, e(0)+.15, at(1,'lift')+.2, at(2,'Twenty-one')-.1, s(3)-.1, s(4)-.1, s(5)-.1, e(5)+.25, e(5)+3.25, s(7)-.1, e(7)+.15];
    const d=k=>cut[k+1]-cut[k], has=this.has, n1=d(1);
    const night={type:'studio',name:'S1-night',style:'night',camFrom:'aerial',dur:n1,cam:{from:{dolly:1.5,lift:80},to:{dolly:.9}}};
    const shots=[
      // Google Earth orbit (Mike's render, 10.7 s, 16:9): played a little faster to fit line 1, full width over a blurred fill
      // Google Earth orbit (Mike's render, vertical 1080 x 1920, 11 s), played a little faster to fit line 1
      has.G1?{type:'video',src:DIR+'clips/G1-radius-vertical.mp4',dur:d(0),speed:10.9/d(0),fadeIn:.3}
            :{type:'studio',name:'G1-standin',style:'aerial',dur:d(0),cam:{from:{dolly:3.2,lift:600},to:{dolly:1.5,lift:80}},linear:true,fadeIn:.3},
      // daylight, a quick smooth flip to night and back, then on
      // MOOD SHOT ONLY: the realistic version (Runway Aleph via ElevenLabs, AI-generated) of our own aerial. The clip is
      // day for its first half and the same move at night for its second half; the night half fades in and out on top.
      // Data shots never use AI. Posts that include this need the platform's AI-generated label.
      has.real?{type:'video',name:'S1-real',src:DIR+'clips/ai-test/S1-day-night-realistic.mp4',dur:n1,
        overlay:{src:DIR+'clips/ai-test/S1-day-night-realistic.mp4',from:n1,alpha:[[0,0],[.9,0],[1.6,1],[n1,1]]}}   // the AI turned to dusk early, so it goes day to night and the next shot cuts away
      :{type:'studio',name:'S1-aerial',style:'aerial',dur:n1,cam:night.cam,
        overlay:{src:DIR+'clips/S1-night.mp4',alpha:[[0,0],[.25,0],[.85,1],[Math.max(1.2,n1-1.1),1],[Math.max(1.6,n1-.35),0]]}},
      {type:'studio',name:'S2-cutout',style:'cutout',layer:'cutout',centerOn:'block',dur:d(2),cam:{from:{orbit:-4,dolly:1.02,aim:[0,22,0]},to:{orbit:4,dolly:.95,aim:[0,22,0]}},linear:true},
      // the city cut open: the Garden's bowl over the tracks, trains running out toward both rivers
      {type:'studio',name:'S3-section',style:'slice',layer:'trackflow',dur:d(3),cam:{from:{dolly:1.0,lift:-20,aim:[0,24,0]},to:{dolly:.82,lift:-38,aim:[0,24,0]}},linear:true},
      {type:'studio',name:'S4-xray',style:'xray',layer:'routes',dur:d(4),cam:{from:{orbit:0},to:{orbit:35}},linear:true},
      {type:'studio',name:'S5-roof',style:'exploded',dur:d(5),cam:{from:{orbit:0,dolly:.5},to:{orbit:-40,dolly:.42}},linear:true},
      {type:'studio',name:'S6-then',style:'aerial',dur:d(6),cam:{from:{dolly:1},to:{dolly:.88}},events:[{t:Math.max(.2,d(6)-3.0),era:'1910'}]},
      {type:'photo',name:'P1-waiting-room',src:'../real%20photo%20references/penn%20station%201910/05%20main%20waiting%20room%201905.jpg',
        dur:d(7),zoom:[1.12,1.24],fy:.55,credit:'MAIN WAITING ROOM · LIBRARY OF CONGRESS'},
      {type:'studio',name:'S7-rain',style:'aerial',era:'1910',layer:'weather63',dur:d(8),cam:{from:{orbit:0},to:{orbit:-25}},linear:true},
      has.G2?{type:'video',src:DIR+'clips/G2-grand-central.mp4',dur:d(9)}
            :{type:'card',name:'G2-standin',dur:d(9),color:'#0b1220',title:{text:'GRAND CENTRAL',y:.42,size:120},sub:{text:'SAVED IN 1978 · EPISODE 2',y:.49}},
      {type:'studio',name:'S8-end',style:'night',dur:2.8,cam:{from:{orbit:0},to:{orbit:20}},linear:true,fadeOut:.6,
        title:{text:'PART 2',y:.42,size:150},sub:{text:'THE BUILDING THAT SAVED GRAND CENTRAL',y:.48,size:30}}];
    const cap=(i,w,text,len)=>({t0:at(i,w),t1:at(i,w)+(len||1.5),text});
    const captions=[
      cap(0,'on top of','ON TOP OF',1.6), cap(1,'lift','LIFT IT',1.4), cap(2,'forty-two','42 FEET',1.7), cap(3,'six hundred','600,000+ A DAY',2.0),
      cap(4,'Forty-eight','48 CABLES',1.8), cap(5,'tore down','TORE DOWN',1.4), cap(6,'October','OCT 28, 1963',1.9)];
    return {shots,captions,extra:[night]};
  }
};
})();
