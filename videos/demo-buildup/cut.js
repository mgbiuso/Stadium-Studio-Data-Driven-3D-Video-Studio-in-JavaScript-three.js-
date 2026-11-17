/* Demo: the Garden builds itself from the bedrock up, each part dropping in with a callout label.
   Rendered from stadium-studio/msg.html with SS.episode.render(EPISODE). No voice: a look at the technique. */
(function(){
window.EPISODE={
  title:'demo-buildup',
  voice:{lines:[],guess:[]},
  build(){
    const shots=[{type:'studio',name:'build',style:'cutout',layer:'build',dur:17,hide:['city'],groundAt:.3,
      cam:{from:{orbit:-18,dolly:.78,lift:10},to:{orbit:22,dolly:.7,lift:-10}},linear:true,fadeIn:.4,fadeOut:.6,
      build:[{g:'under',t:2.2,drop:50},{g:'lower',t:4.4},{g:'facade',t:4.9},{g:'middle',t:6.4},{g:'upper',t:7.0},{g:'crown',t:9.0,drop:90},{g:'roof',t:11.2,drop:110}]}];
    return {shots,captions:[]};
  }
};
})();
