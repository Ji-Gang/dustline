(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f();else root.CombatFeedback=f();})(globalThis,()=>{
 class Feedback {
  constructor(){this.reset();}
  reset(){this.last=0;this.hitUntil=0;this.killUntil=0;this.head=false;this.killHead=false;this.victim='';}
  consume(e,id,now){if(e.id<=this.last)return;this.last=e.id;
   if((e.type==='hit'||e.type==='shot')&&e.player===id&&e.damage>0){this.hitUntil=now+220;this.head=!!e.head;}
   if(e.type==='kill'&&e.killerId===id){this.hitUntil=now+300;this.killUntil=now+1800;this.head=!!e.head;this.killHead=!!e.head;this.victim=e.victim;}
  }
  view(now){return {hit:now<this.hitUntil,kill:now<this.killUntil,head:this.head,killHead:this.killHead,victim:this.victim};}
 }
 return Feedback;
});
