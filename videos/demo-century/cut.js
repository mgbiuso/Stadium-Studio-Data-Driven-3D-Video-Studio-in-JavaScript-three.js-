/* Sample: one block, 62 years. The floating block goes from the 1906 dig, to Penn Station rising (1910),
   to the station torn down with the trains still running below (1963), to the Garden dropping in on top (1968).
   A look at the technique for the build-up video idea. No voice yet. Rendered from stadium-studio/msg.html. */
(function(){
// the camera circles the block slowly; both shots share one path so the cut between them is invisible
const T=[47,24,0];                                     // the middle of the old station block (V.pennCenter), aimed a little high so the block sits mid-frame
const A={tgt:T,off:[-480,325,480]}, B={tgt:T,off:[-345,380,585]}, C={tgt:T,off:[-190,405,655]};
window.EPISODE={
  title:'demo-century',
  voice:{lines:[],guess:[]},
  build(){
    const shots=[
      // 1906 dig, then the station grows out of it, then it sinks away (the tracks stay)
      {type:'studio',name:'then',style:'cutout',era:'1906',dur:11.5,centerOn:false,cam:{from:A,to:B},linear:true,fadeIn:.4,
        events:[{t:3.4,era:'1910'},{t:8.2,era:'gone'}]},
      // 1968: the Garden drops in on top of the working station, piece by piece
      {type:'studio',name:'now',style:'cutout',era:'today',dur:9.5,centerOn:false,cam:{from:B,to:C},linear:true,fadeOut:.6,
        build:[{g:'lower',t:.5},{g:'facade',t:1.0},{g:'middle',t:2.2},{g:'upper',t:2.8},{g:'crown',t:4.0,drop:90},{g:'roof',t:5.4,drop:110}]}];
    const cap=(t0,t1,text)=>({t0,t1,text});
    const captions=[cap(.5,3.2,'1906 · THE DIG'),cap(3.8,7.9,'1910 · PENN STATION'),cap(8.6,11.4,'1963 · TORN DOWN'),
      cap(12.2,17.2,'1968 · THE GARDEN'),cap(17.8,20.6,'ONE BLOCK · 62 YEARS')];
    // sound: the music bed plus one effect per change (the Garden's parts land at 11.5 s + their build times)
    const S='videos/_sound/', fx=(f,t,gain)=>({src:'/'+S+'sfx/'+f+'.mp3',t,gain});
    const music={src:'/'+S+'music/doc-underscore-take1.mp3',gain:.55,fadeIn:.8,fadeOut:2.5};
    const sfx=[fx('lift-whoosh-1',3.2,.7),fx('collapse-boom-1',8.1,.8),fx('train-rumble-1',9.6,.6),
      ...[.5,1.0,2.2,2.8,4.0,5.4].map((t,i)=>fx(i%2?'steel-drop-2':'steel-drop-1',11.5+t+.35,.55))];
    return {shots,captions,music,sfx};
  }
};
})();
