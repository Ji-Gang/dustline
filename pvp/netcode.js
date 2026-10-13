/* Shared, transport-independent timing and visual prediction. */
(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f();else root.Netcode=f();})(globalThis,()=>{
 'use strict';
 const STEP=1/60,INTERPOLATION=.05,MAX_REWIND=.2;
 class Snapshots {
  constructor(){this.frames=[];}
  clear(){this.frames.length=0;}
  push(state){if(this.frames.length&&state.time<=this.frames.at(-1).time)return;this.frames.push(state);if(this.frames.length>32)this.frames.shift();}
  sample(id,time){
   if(!this.frames.length)return null;
   let before=this.frames[0],after=before;
   for(const frame of this.frames){after=frame;if(frame.time>=time)break;before=frame;}
   const a=before.players.find(p=>p.id===id),b=after.players.find(p=>p.id===id);
   if(!a||!b||a.spawnId!==b.spawnId||a.alive!==b.alive||a.team!==b.team)return b||a;
   const t=after.time>before.time?Math.max(0,Math.min(1,(time-before.time)/(after.time-before.time))):1;
   const angle=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw));
   return {...b,x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:a.yaw+angle*t,pitch:(a.pitch||0)+((b.pitch||0)-(a.pitch||0))*t};
  }
 }
 // Cosmetic only. The host remains the sole authority for ammunition and damage.
 class FireFeedback {
  constructor(){this.reset();}
  reset(){this.key=null;this.pending=[];this.next=0;this.press=0;this.burst=0;this.shots=0;this.reloadUntil=0;}
  sync(p){const key=p.spawnId+':'+p.weapon;if(this.key!==key){this.reset();this.key=key;this.next=p.fireAt||0;}this.next=Math.max(this.next,p.fireAt||0);if(!p.alive){this.pending=[];this.burst=0;}if(p.reloadUntil)this.reloadUntil=p.reloadUntil;}
  confirm(e,now){const i=this.pending.findIndex(s=>s.spawnId===e.spawnId&&s.weapon===e.weapon&&now-s.at<1.5);if(i<0)return false;this.pending.splice(i,1);return true;}
  step(p,w,now,held,press,enabled){
   this.sync(p);this.pending=this.pending.filter(s=>now-s.at<1.5);
   const pressed=press>this.press;this.press=press;
   if(!enabled||!p.alive){this.burst=0;return false;}
   if(now<Math.max(p.reloadUntil||0,this.reloadUntil))return false;
   if(w.burst&&pressed&&now>=this.next)this.burst=w.burst;
   if(now<this.next||(!w.melee&&p.ammo-this.pending.length<=0)||!(this.burst>0||(w.auto?held||pressed:pressed)))return false;
   this.next=now+w.rate;if(this.burst>0&&!--this.burst)this.next+=.22;
   this.pending.push({at:now,spawnId:p.spawnId,weapon:p.weapon});this.shots++;return true;
  }
 }
 // Catch up bounded elapsed time rather than assuming each timer fires on time.
 function clock(step){let last=performance.now(),remainder=0;return ()=>{const now=performance.now();remainder+=Math.min(.1,Math.max(0,(now-last)/1000));last=now;while(remainder+1e-9>=STEP){step(STEP);remainder-=STEP;}};}
 return {STEP,INTERPOLATION,MAX_REWIND,Snapshots,FireFeedback,clock};
});
