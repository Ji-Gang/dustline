'use strict';
const A=require('./arena.js'),C=require('../core.js');
const LEVELS={easy:{label:'简单',reaction:.65,error:.055,turn:2.6},normal:{label:'普通',reaction:.32,error:.023,turn:4},hard:{label:'困难',reaction:.18,error:.009,turn:5.5}};
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
function visible(a,b){const from={x:a.x,y:a.crouching?1.12:1.64,z:a.z},to={x:b.x,y:b.crouching?.95:1.3,z:b.z};return !A.boxes.some(box=>C.segmentBox(from,to,box)!==null);}
function walkable(a,b){const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.35);for(let i=0;i<=n;i++){const t=n?i/n:0;if(A.blocked(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.46))return false;}return true;}
let nodes;
function graph(){if(nodes)return nodes;nodes=[];const lookup=new Map();for(let x=-38;x<=38;x+=2)for(let z=-28;z<=28;z+=2)if(!A.blocked(x,z,.46)){const node={x,z,edges:[]};lookup.set(x+','+z,nodes.length);nodes.push(node);}for(const n of nodes)for(const [dx,dz] of [[2,0],[-2,0],[0,2],[0,-2],[2,2],[-2,2],[2,-2],[-2,-2]]){const i=lookup.get((n.x+dx)+','+(n.z+dz));if(i!==undefined&&walkable(n,nodes[i]))n.edges.push(i);}return nodes;}
function path(from,to){const grid=graph();function nearest(p){let best=-1,d=Infinity;for(let i=0;i<grid.length;i++){const n=grid[i],distance=(p.x-n.x)**2+(p.z-n.z)**2;if(distance<d&&walkable(p,n)){best=i;d=distance;}}return best;}const start=nearest(from),goal=nearest(to);if(start<0||goal<0)return [];const queue=[start],previous=new Map([[start,-1]]);for(let i=0;i<queue.length&&!previous.has(goal);i++)for(const next of grid[queue[i]].edges)if(!previous.has(next)){previous.set(next,queue[i]);queue.push(next);}if(!previous.has(goal))return [];const result=[];for(let i=goal;i!==-1;i=previous.get(i))result.push({x:grid[i].x,z:grid[i].z});return result.reverse();}
class Bots {
 constructor(){this.brains=new Map();}
 forget(id){this.brains.delete(id);}
 update(match,p,dt){
  let b=this.brains.get(p.id);if(!b||b.spawn!==p.spawnId){b={spawn:p.spawnId,target:null,seenAt:0,memory:null,path:[],repath:0,scan:0,error:0,errorAt:0,patrol:0};this.brains.set(p.id,b);}
  const level=LEVELS[p.difficulty]||LEVELS.normal,time=match.time;
  if(time>=b.scan){b.scan=time+.1;const targets=[...match.players.values()].filter(q=>q.alive&&q.deployed&&q.team!==p.team&&Math.hypot(q.x-p.x,q.z-p.z)<48&&Math.abs(angle(Math.atan2(-(q.x-p.x),-(q.z-p.z))-p.yaw))<1.6&&visible(p,q)).sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z));const found=targets[0];if(found?.id!==b.target){b.target=found?.id||null;b.seenAt=time;}if(found)b.memory={x:found.x,z:found.z,until:time+2};}
  const target=b.target?match.players.get(b.target):null,canSee=target?.alive&&visible(p,target);
  p.lastInput=time;p.viewTime=null;p.input={};
  if(p.ammo===0||!canSee&&p.ammo<C.WEAPONS[p.weapon].mag*.3)match.command(p.id,{type:'reload'});
  if(canSee){
   const dx=target.x-p.x,dz=target.z-p.z,distance=Math.hypot(dx,dz);
   if(time>=b.errorAt){b.errorAt=time+.22;b.error=(Math.random()-.5)*2*level.error;}
   const desired=Math.atan2(-dx,-dz)+b.error,delta=angle(desired-p.yaw);p.yaw+=Math.max(-level.turn*dt,Math.min(level.turn*dt,delta));
   p.pitch=Math.atan2((target.crouching?.95:1.25)-(p.crouching?1.12:1.64),distance)-p.recoil*.85+b.error*.3;
   p.input.aim=true;p.input.fire=time-b.seenAt>=level.reaction&&Math.abs(delta)<.09&&time>=target.protectedUntil;
   // Stop and fire in short bursts; the same host cadence/ammo rules apply.
   if(Math.sin(time*3+p.slot)<-.45)p.input.fire=false;
   p.input.forward=distance>24;p.input.back=distance<7;
   if(distance<24){p.input.left=Math.sin(time*1.2+p.slot)>0;p.input.right=!p.input.left;}
   return;
  }
  const lanes=[-35,11,35],lane=lanes[(p.botIndex+p.slot)%3],sign=p.team==='blue'?-1:1;
  const destinations=[{x:lane,z:0},{x:lane,z:sign*24},{x:-lane,z:sign*24},{x:-lane,z:0}];
  let goal=b.memory&&b.memory.until>time?b.memory:destinations[b.patrol%destinations.length];
  if(Math.hypot(goal.x-p.x,goal.z-p.z)<2){b.memory=null;b.patrol++;goal=destinations[b.patrol%destinations.length];b.repath=0;}
  if(time>=b.repath){b.path=path(p,goal);b.repath=time+1.2;}
  while(b.path.length&&Math.hypot(b.path[0].x-p.x,b.path[0].z-p.z)<.65)b.path.shift();
  const next=b.path[0];if(next){const desired=Math.atan2(-(next.x-p.x),-(next.z-p.z)),delta=angle(desired-p.yaw);p.yaw+=Math.max(-level.turn*dt,Math.min(level.turn*dt,delta));p.input.forward=Math.abs(delta)<.6;}else p.yaw+=dt;
  p.pitch=0;
 }
}
module.exports={Bots,LEVELS,path,visible};
