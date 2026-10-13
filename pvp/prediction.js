(function(root,factory){const value=factory(typeof module==='object'?require('./arena.js'):root.Arena);if(typeof module==='object')module.exports=value;else root.Prediction=value;})(globalThis,function(A){
 'use strict';
 // Re-apply the inputs still travelling to/from the host instead of pulling the
 // camera to an old network position. Collision uses the same map as the host.
 function reconcile(player,history,now,speed){
  const result={x:player.x,z:player.z,yaw:player.yaw};
  if(history.some(entry=>entry.dt)){
   for(const entry of history){if(entry.seq<=player.ack||entry.spawnId!==player.spawnId)continue;result.yaw=entry.input.yaw;A.step(result,entry.input,entry.dt,speed);}
   return result;
  }
  let index=-1;for(let i=0;i<history.length;i++){if(history[i].seq<=player.seq)index=i;else break;}
  if(index<0)return result;
  const start=Math.max(history[index].time,now-350);
  for(let i=index;i<history.length;i++){
   const entry=history[i],from=Math.max(start,entry.time),to=Math.min(now,history[i+1]?.time??now);
   if(to<=from)continue;
   result.yaw=entry.input.yaw;
   A.step(result,entry.input,(to-from)/1000,speed);
  }
  return result;
 }
 return {reconcile};
});
