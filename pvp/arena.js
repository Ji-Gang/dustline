/* Shared arena geometry and authoritative movement: metres, mirrored spawns. */
(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f();else root.Arena=f();})(globalThis,()=>{
const maps={foundry:'铸造工坊',quarry:'砂岩采石场'};
function create(id='foundry'){if(!Object.hasOwn(maps,id))id='foundry';
const bounds={x:40,z:30},boxes=[];
// Covers the animated body (0.632 m), boots and the visible wall trim.
const radius=.72,epsilon=.001;
const add=(x,z,w,d,h,kind='wall')=>boxes.push({x,z,w,d,h,kind});
add(-41,0,2,64,8);add(41,0,2,64,8);add(0,-31,84,2,8);add(0,31,84,2,8);
if(id==='foundry'){for(const sign of [-1,1]){
 add(-27,sign*19,18,2,5);add(27,sign*19,18,2,5);add(0,sign*19,14,2,5);
 add(-17,sign*8,3,15,6);add(17,sign*8,3,15,6);
 add(-30,sign*5,8,5,2.3,'container');add(30,sign*5,8,5,2.3,'container');
 add(-7,sign*9,4,4,1.55,'crate');add(7,sign*9,4,4,1.55,'crate');
}
add(0,0,1.8,4.8,3.2,'compressor');add(-24,0,3,3,1.5,'crate');add(24,0,3,3,1.5,'crate');
 }else{
 for(const sign of [-1,1]){add(-27,sign*18,17,2,4,'wall');add(26,sign*17,16,3,3.4,'wall');add(-20,sign*5,5,9,4.5,'rock');add(21,sign*7,5,8,3.6,'rock');add(-8,sign*20,4,4,2.35,'crate');add(9,sign*21,5,3,2.35,'crate');add(-32,sign*8,6,4,2.8,'container');add(32,sign*3,5,4,2.35,'crate');}add(0,0,1.8,4.8,3.2,'compressor');add(-32,0,4,3,2.35,'crate');add(5,0,2,5,2.5,'wall');
 }
for(const b of boxes){if(b.kind==='crate')b.h=Math.max(2.35,b.h);b.base=groundAt(b.x,b.z);}
function groundAt(x,z){return id==='quarry'?1.2*Math.max(0,Math.min(1,(12-Math.abs(x))/4,(13-Math.abs(z))/6)):0;}
function terrainHit(a,b){const length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),steps=Math.ceil(length/.15);for(let i=1;i<=steps;i++){const t=i/steps;if(a.y+(b.y-a.y)*t<groundAt(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return t;}return null;}
const spawns={blue:[{x:-4,z:26,yaw:0},{x:4,z:26,yaw:0}],red:[{x:4,z:-26,yaw:Math.PI},{x:-4,z:-26,yaw:Math.PI}]};
for(let i=2;i<8;i++){const x=[-12,12,-20,20,-28,28][i-2];spawns.blue.push({x,z:26,yaw:0});spawns.red.push({x:-x,z:-26,yaw:Math.PI});}
// Cabinets and columns previously had visuals but no solid collision.
if(id==='foundry')for(const sign of [-1,1])for(const x of [-12,12])add(x,sign*29.3,4,1.2,2.2,'collisionOnly');
if(id==='foundry')for(const z of [-15,0,15])for(const x of [-39,39])add(x,z,.65,.65,8.8,'collisionOnly');
function inSpawn(p){return p.team==='blue'?p.z>=22:p.z<=-22;}
function blocked(x,z,r=radius){return !Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>bounds.x-r||Math.abs(z)>bounds.z-r||boxes.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);}
// Recover an embedded position, including overlapping boxes and map boundaries.
// Search only when invalid; normal movement never pays for the candidate grid.
function resolve(p,r=radius){
 if(!blocked(p.x,p.z,r))return false;
 const x=Number.isFinite(p.x)?p.x:0,z=Number.isFinite(p.z)?p.z:26;
 const clamp=(v,max)=>Math.max(-max+r+epsilon,Math.min(max-r-epsilon,v));
 const xs=new Set([clamp(x,bounds.x)]),zs=new Set([clamp(z,bounds.z)]);
 for(const b of boxes){for(const sign of [-1,1]){xs.add(clamp(b.x+sign*(b.w/2+r+epsilon),bounds.x));zs.add(clamp(b.z+sign*(b.d/2+r+epsilon),bounds.z));}}
 let best=null,distance=Infinity;
 for(const xx of xs)for(const zz of zs){const d=(xx-x)**2+(zz-z)**2;if(d<distance&&!blocked(xx,zz,r)){best={x:xx,z:zz};distance=d;}}
 if(best){p.x=best.x;p.z=best.z;}return !!best;
}
function segmentFree(a,b,r=radius){
 if(blocked(a.x,a.z,r)||blocked(b.x,b.z,r))return false;
 for(const box of boxes){let enter=0,leave=1,hit=true;for(const [axis,size] of [['x','w'],['z','d']]){
  const lo=box[axis]-box[size]/2-r+1e-7,hi=box[axis]+box[size]/2+r-1e-7,d=b[axis]-a[axis];
  if(Math.abs(d)<1e-10){if(a[axis]<=lo||a[axis]>=hi){hit=false;break;}}
  else{const t1=(lo-a[axis])/d,t2=(hi-a[axis])/d;enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));if(enter>leave){hit=false;break;}}
 }if(hit&&enter<1&&leave>0)return false;}return true;
}
// Snapshot smoothing follows a clear corner route instead of cutting through it.
function interpolate(from,to,t){
 const a={x:from.x,z:from.z},b={x:to.x,z:to.z};resolve(a);resolve(b);t=Math.max(0,Math.min(1,t));
 const lerp=(p,q,f)=>({x:p.x+(q.x-p.x)*f,z:p.z+(q.z-p.z)*f});
 if(segmentFree(a,b))return lerp(a,b,t);
 for(const c of [{x:a.x,z:b.z},{x:b.x,z:a.z}])if(segmentFree(a,c)&&segmentFree(c,b)){
  const first=Math.hypot(c.x-a.x,c.z-a.z),second=Math.hypot(b.x-c.x,b.z-c.z),d=t*(first+second);
  return d<first?lerp(a,c,d/first):lerp(c,b,second?(d-first)/second:1);
 }
 return t<.5?a:b;
}
function solidActor(p,q){return q!==p&&(p.id===undefined||q.id!==p.id)&&q.alive!==false&&q.deployed!==false;}
function actorsBlocked(p,x,z,others){return others.some(q=>solidActor(p,q)&&Math.hypot(x-q.x,z-q.z)<radius*2-1e-7);}
function actorsSegmentFree(p,a,b,others){const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;return !others.some(q=>{if(!solidActor(p,q))return false;const t=length?Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.z-a.z)*dz)/length)):0;return Math.hypot(a.x+dx*t-q.x,a.z+dz*t-q.z)<radius*2-1e-7;});}
// Used for occupied spawns and small visual overlaps caused by delayed snapshots.
function resolveActors(p,others=[],allowed=()=>true){
 resolve(p);const origin={x:p.x,z:p.z},valid=(x,z)=>!blocked(x,z)&&!actorsBlocked(p,x,z,others)&&allowed({x,z,team:p.team});
 if(valid(p.x,p.z))return false;
 const candidates=[];
 for(const q of others)if(solidActor(p,q)){const dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz),r=radius*2+epsilon;candidates.push({x:q.x+(d?dx/d:1)*r,z:q.z+(d?dz/d:0)*r});}
 candidates.sort((a,b)=>Math.hypot(a.x-origin.x,a.z-origin.z)-Math.hypot(b.x-origin.x,b.z-origin.z));
 for(const c of candidates)if(valid(c.x,c.z)&&segmentFree(origin,c)){Object.assign(p,c);return true;}
 for(let ring=1;ring<=48;ring++)for(let i=0;i<48;i++){const angle=i*Math.PI/24,d=ring*.2,x=origin.x+Math.cos(angle)*d,z=origin.z+Math.sin(angle)*d;if(valid(x,z)&&segmentFree(origin,{x,z})){p.x=x;p.z=z;return true;}}
 return false;
}
function separateActors(players,anchorId){
 const result=players.map(p=>({...p})),ordered=[...result].sort((a,b)=>(a.id===anchorId?-1:b.id===anchorId?1:0)),placed=[];
 for(const p of ordered)if(p.alive&&p.deployed!==false){resolveActors(p,placed);placed.push(p);}return result;
}
function move(p,dx,dz,others=[]){if(!Number.isFinite(dx)||!Number.isFinite(dz))return;resolveActors(p,others);const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.17));for(let i=0;i<n;i++){const x=p.x+dx/n;if(!blocked(x,p.z)&&!actorsBlocked(p,x,p.z,others))p.x=x;const z=p.z+dz/n;if(!blocked(p.x,z)&&!actorsBlocked(p,p.x,z,others))p.z=z;}}
function step(p,input,dt,speed,others=[]){const f=(input.forward?1:0)-(input.back?1:0),s=(input.right?1:0)-(input.left?1:0),len=Math.hypot(f,s)||1,pace=speed*1.35*(input.crouch?.46:input.aim?.7:input.walk?.52:1);move(p,(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)*pace*dt/len,(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)*pace*dt/len,others);}
const soloSpawns=[];for(const x of [-36,-12,12,36])for(const z of [-26,-13,13,26])if(!blocked(x,z,radius+.05))soloSpawns.push({x,z,yaw:Math.atan2(x,z)});return {id,name:maps[id],bounds,radius,boxes,spawns,soloSpawns,groundAt,terrainHit,inSpawn,blocked,resolve,segmentFree,interpolate,actorsBlocked,actorsSegmentFree,resolveActors,separateActors,move,step};
}
const arena=create();arena.create=create;arena.maps=maps;arena.select=id=>Object.assign(arena,create(id));return arena;
});
