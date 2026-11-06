'use strict';
const assert=require('node:assert/strict'),A=require('./arena'),N=require('./netcode'),P=require('./prediction'),{Match}=require('./match.cjs'),{path}=require('./bots.cjs');
let cornerCases=0;
for(const id of Object.keys(A.maps)){
 const arena=A.create(id),r=arena.radius;
 for(const b of arena.boxes){
  const embedded={x:b.x,z:b.z};arena.move(embedded,0,0);assert(!arena.blocked(embedded.x,embedded.z),'embedded recovery '+id);
  for(const sx of [-1,1])for(const sz of [-1,1]){
   const a={x:b.x+sx*(b.w/2+r+.03),z:b.z+sz*(b.d/2+r-.5)},c={x:b.x+sx*(b.w/2+r-.5),z:b.z+sz*(b.d/2+r+.03)};
   if(arena.blocked(a.x,a.z)||arena.blocked(c.x,c.z))continue;
   assert(!arena.segmentFree(a,c),'corner chord must intersect expanded box');
   const snapshots=new N.Snapshots(),player={id:'p',spawnId:1,alive:true,team:'blue',yaw:0,pitch:0};
   snapshots.push({time:0,players:[{...player,...a}]});snapshots.push({time:.2,players:[{...player,...c}]});
   let previous=a;
   for(let i=0;i<=40;i++){const p=snapshots.sample('p',i/200,arena);assert(!arena.blocked(p.x,p.z));assert(arena.segmentFree(previous,p),'smoothing crossed solid');previous=p;}cornerCases++;
  }
  for(const axis of ['x','z'])for(const sign of [-1,1]){
   const size=axis==='x'?'w':'d',p={x:b.x,z:b.z};p[axis]+=sign*(b[size]/2+r+.1);if(arena.blocked(p.x,p.z))continue;
   arena.move(p,axis==='x'?-sign*100:0,axis==='z'?-sign*100:0);assert(!arena.blocked(p.x,p.z));assert(sign*(p[axis]-b[axis])>=b[size]/2+r-1e-7);
  }
 }
 for(const p of [{x:1e4,z:1e4},{x:NaN,z:Infinity}]){arena.move(p,0,0);assert(!arena.blocked(p.x,p.z));}
 for(const s of arena.spawns.blue){const route=path(s,{x:4,z:-26},arena);assert(route.length);for(let i=1;i<route.length;i++)assert(arena.segmentFree(route[i-1],route[i]));}
 const m=new Match({map:id});m.add('p','Player');m.start('p');const p=m.players.get('p'),box=arena.boxes.find(b=>b.kind==='crate');Object.assign(p,{x:box.x,z:box.z});m.tick(1/60);assert(!arena.blocked(p.x,p.z));
 A.select(id);const predicted=P.reconcile({x:box.x,z:box.z,yaw:0,seq:0},[],0,6);assert(!arena.blocked(predicted.x,predicted.z));
}
A.select('foundry');assert(cornerCases>50);
// Clear endpoints alone are insufficient for camera correction across a thin wall.
assert(!A.segmentFree({x:-27,z:17},{x:-27,z:21}));
console.log('PASS '+cornerCases+' corner smoothing cases, two-map high-speed collision, embedded recovery, prediction and AI clearance');
for(const map of Object.keys(A.maps))for(const mode of ['team','arsenal'])for(const sameTeam of [false,true]){
 const m=new Match({map,mode}),p=m.add('a','A'),q=m.add('b','B');if(sameTeam)m.command('b',{type:'seat',team:'blue',slot:1});m.start('a');
 Object.assign(p,{x:-3,z:26,yaw:-Math.PI/2});Object.assign(q,{x:3,z:26,yaw:Math.PI/2});
 for(let i=0;i<180;i++){for(const b of [p,q]){b.input={forward:true};b.lastInput=m.time;}m.tick(N.STEP);assert(q.x>p.x,'players crossed through each other');assert(Math.hypot(p.x-q.x,p.z-q.z)>=m.arena.radius*2-1e-7);}
 const occupied=m.arena.spawns[p.team][p.slot];Object.assign(q,occupied);p.alive=false;m.spawn(p);if(mode==='team')assert(m.arena.inSpawn(p));assert(!m.arena.actorsBlocked(p,p.x,p.z,[q]));
 const local={id:'p',x:0,z:26,yaw:-Math.PI/2,spawnId:1,ack:0},blocker={id:'q',x:3,z:26,alive:true,deployed:true,bot:sameTeam};A.select(map);
 const frames=Array.from({length:120},(_,i)=>({seq:i+1,spawnId:1,dt:N.STEP,input:{forward:true,yaw:-Math.PI/2}}));
 const predicted=P.reconcile(local,frames,0,7.2,[blocker]),host={...local};for(const f of frames)A.step(host,f.input,f.dt,7.2,[blocker]);assert.equal(predicted.x,host.x);assert(predicted.x<=blocker.x-A.radius*2+1e-7);
 for(const inactive of [{...blocker,alive:false},{...blocker,deployed:false}]){const a={...local};A.move(a,6,0,[inactive]);assert(a.x>blocker.x);}
 const visual=A.separateActors([{...local,alive:true,deployed:true,x:1.5},{...blocker,x:1.5}],local.id);assert.equal(visual[0].x,1.5);assert(!A.actorsBlocked(visual[1],visual[1].x,visual[1].z,visual));assert(visual.every(p=>!A.blocked(p.x,p.z)));
}
A.select('foundry');console.log('PASS teammate/enemy/AI body blocking, occupied respawn, prediction parity, dead/spectator pass-through and visual separation');
assert(!A.actorsSegmentFree({id:'p'},{x:0,z:26},{x:6,z:26},[{id:'q',x:3,z:26,alive:true}]));
(async()=>{const {createServer,connect}=require('./server.cjs'),server=await createServer({port:0}),clients=[],states=[];try{
 for(let i=0;i<2;i++)clients.push(await connect({port:server.port,pin:server.pin,name:'Collision'+i},packet=>{if(packet.type==='state')states[i]=packet.state;}));
 server.match.start(clients[0].id);const p=server.match.players.get(clients[0].id),q=server.match.players.get(clients[1].id);Object.assign(p,{x:-3,z:26});Object.assign(q,{x:3,z:26});
 for(let i=1;i<=35;i++){clients[0].send({type:'input',seq:i,input:{forward:true,yaw:-Math.PI/2}});clients[1].send({type:'input',seq:i,input:{forward:true,yaw:Math.PI/2}});await new Promise(r=>setTimeout(r,30));}
 for(const state of states){const a=state.players.find(p=>p.id===clients[0].id),b=state.players.find(p=>p.id===clients[1].id);assert(a.x<b.x);assert(b.x-a.x>=server.match.arena.radius*2-1e-7);assert(a.x>-3&&b.x<3);}
 console.log('PASS real TCP clients move head-on and both receive non-overlapping authoritative positions');
}finally{clients.forEach(c=>c.close());await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
