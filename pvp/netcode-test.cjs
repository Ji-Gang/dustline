'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Match}=require('./match.cjs'),N=require('./netcode.js'),P=require('./prediction.js'),A=require('./arena.js'),C=require('../core.js');
let passed=0;function test(name,fn){fn();console.log('PASS '+name);passed++;}
function game(){const m=new Match();m.add('a','A');m.add('b','B');m.start('a');m.tick(.3);return m;}
function batch(m,frames,spawnId=m.players.get('a').spawnId){m.command('a',{type:'input',spawnId,frames});}
function frame(seq,extra={}){return {seq,input:{yaw:0,pitch:0,forward:true},firePress:0,...extra};}
test('Acknowledgement means simulated, never merely received; batch cannot accelerate movement',()=>{
 const m=game(),p=m.players.get('a'),z=p.z;batch(m,Array.from({length:12},(_,i)=>frame(i+1)));assert.equal(p.ack,0);assert.equal(p.z,z);m.tick(N.STEP);assert.equal(p.ack,5);assert(Math.abs(z-p.z-C.WEAPONS.ak.speed*1.35*N.STEP)<1e-8);
 const ack=p.ack;batch(m,[null,frame(NaN),frame(ack)]);assert.equal(p.ack,ack);
});
test('Redundant frames recover a lost batch, reorder and duplicates execute once',()=>{
 const m=game(),p=m.players.get('a'),z=p.z;const frames=[1,2,3,4].map(s=>frame(s));batch(m,frames);batch(m,[frames[2],frames[0]]);
 for(let i=0;i<4;i++)m.tick(N.STEP);assert.equal(p.ack,4);assert(Math.abs(z-p.z-C.WEAPONS.ak.speed*1.35*4*N.STEP)<1e-8);const stop=p.z;m.tick(N.STEP);assert.equal(p.z,stop);batch(m,frames);m.tick(N.STEP);assert.equal(p.z,stop);
});
test('Fixed prediction replays only unacknowledged commands and matches host including turns',()=>{
 const m=game(),p=m.players.get('a');Object.assign(p,{x:11,z:12});
 const frames=Array.from({length:8},(_,i)=>({...frame(i+1,{input:{yaw:i<4?0:Math.PI/2,forward:i<7}}),dt:N.STEP,spawnId:p.spawnId}));
 batch(m,frames);for(let i=0;i<3;i++)m.tick(N.STEP);const predicted=P.reconcile(p,frames,0,C.WEAPONS.ak.speed);for(let i=0;i<5;i++)m.tick(N.STEP);assert(Math.hypot(predicted.x-p.x,predicted.z-p.z)<1e-9);assert(!A.blocked(p.x,p.z));
});
test('Press counter preserves short taps when down packet was lost, never repeats on retransmission',()=>{
 const m=game(),p=m.players.get('a');p.weapon='usp';p.ammo=12;batch(m,[frame(1,{firePress:1,input:{yaw:0,pitch:0,fire:false}})]);m.tick(N.STEP);assert.equal(p.ammo,11);
 for(let i=2;i<60;i++){batch(m,[frame(i,{firePress:1,input:{yaw:0,pitch:0,fire:false}})]);m.tick(N.STEP);}assert.equal(p.ammo,11);
});
test('Respawn rejects previous-life inputs and clears queued commands',()=>{
 const m=game(),p=m.players.get('a'),old=p.spawnId;batch(m,[frame(1)]);m.spawn(p);batch(m,[frame(2,{firePress:99})],old);m.tick(N.STEP);assert.equal(p.z,26);assert.equal(p.ammo,C.WEAPONS.ak.mag);assert.equal(p.inputQueue.length,0);
});
test('Delayed/lossy 60 Hz input stream converges after release without extra movement',()=>{
 const m=game(),p=m.players.get('a'),history=[],packets=[];Object.assign(p,{x:11,z:12});let predicted={x:11,z:12,yaw:0};
 for(let tick=1;tick<=210;tick++){
  const input={yaw:tick<60?0:Math.PI/2,forward:tick<110};const f={seq:tick,input,dt:N.STEP,spawnId:p.spawnId,firePress:0};history.push(f);predicted.yaw=input.yaw;A.step(predicted,input,N.STEP,C.WEAPONS.ak.speed);
  if(tick%2===0&&tick%10!==0)packets.push({at:tick+3+(tick%3),frames:history.slice(-12)});
  for(const packet of packets.filter(b=>b.at===tick))batch(m,packet.frames);m.tick(N.STEP);
  if(tick%2===0)predicted=P.reconcile(p,history,0,C.WEAPONS.ak.speed);
 }
 for(const packet of packets.filter(b=>b.at>210))batch(m,packet.frames);for(let i=0;i<12;i++)m.tick(N.STEP);
 assert(Math.hypot(predicted.x-p.x,predicted.z-p.z)<1e-6);assert(!A.blocked(p.x,p.z));
});
test('Snapshot interpolation uses timestamps, shortest yaw, and snaps across respawns',()=>{
 const s=new N.Snapshots(),player={id:'a',x:0,z:0,yaw:3.1,pitch:0,spawnId:1,alive:true,team:'blue'};
 s.push({time:1,players:[player]});s.push({time:1.1,players:[{...player,x:10,yaw:-3.1}]});const mid=s.sample('a',1.05);assert(Math.abs(mid.x-5)<1e-8);assert(Math.abs(mid.yaw)>3);
 s.push({time:1.2,players:[{...player,x:30,spawnId:2}]});assert.equal(s.sample('a',1.15).x,30);assert.equal(s.sample('a',9).x,30);
});
test('Local firing feedback is immediate, confirmation does not replay it, ammo and reload bounded',()=>{
 const f=new N.FireFeedback(),p={spawnId:1,weapon:'usp',alive:true,fireAt:0,ammo:1,reloadUntil:0},w=C.WEAPONS.usp;
 assert(f.step(p,w,1,true,1,true));assert.equal(f.pending.length,1);assert(!f.step(p,w,1.5,true,2,true));assert(f.confirm({spawnId:1,weapon:'usp'},1.5));assert(!f.confirm({spawnId:1,weapon:'usp'},1.5));
 p.ammo=12;p.reloadUntil=3;assert(!f.step(p,w,2,true,3,true));p.spawnId=2;f.sync(p);assert.equal(f.pending.length,0);
});
test('Hitscan rewinds moving target but caps history and never crosses lives/protection',()=>{
 const random=Math.random;Math.random=()=>.5;
 try{const m=game(),p=m.players.get('a'),v=m.players.get('b');Object.assign(p,{x:11,z:8,yaw:0,pitch:0,weapon:'awp',ammo:5,input:{aim:true},protectedUntil:0});Object.assign(v,{x:11,z:-8,protectedUntil:0});m.tick(N.STEP);const seen=m.time;v.x=14;m.tick(.1);p.viewTime=seen;m.shoot(p);assert(!v.alive,'historical target should be hit');
 m.spawn(v);Object.assign(v,{x:14,z:-8,protectedUntil:0});p.recoil=0;m.shoot(p);assert.equal(v.hp,100,'previous life must not be hit');
 const current=m.historical(v,-100);assert(current===v||current.spawnId===v.spawnId);assert(m.history.length<20);
 }finally{Math.random=random;}
});
test('WebRTC congestion recovery re-enables direct path when the buffer drains',()=>{
 let receiver;const sent=[],channels=[];
 class PC {constructor(){this.iceConnectionState='connected';}createDataChannel(label){const c={label,readyState:'open',bufferedAmount:70000,send(){},close(){}};channels.push(c);return c;}async createOffer(){return {};}async setLocalDescription(){this.localDescription={toJSON:()=>({type:'offer',sdp:''})};}close(){}}
 const context={window:{multiplayer:{onDirect:fn=>receiver=fn,direct:m=>sent.push(m)}},RTCPeerConnection:PC,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};vm.runInNewContext(fs.readFileSync(__dirname+'/direct.js','utf8'),context);
 receiver({type:'open',id:'p',epoch:'e',initiator:true});receiver({type:'send',id:'p',epoch:'e',body:{type:'state'}});assert.equal(sent.at(-1).ready,false);channels[0].bufferedAmount=0;channels[0].onbufferedamountlow();assert.equal(sent.at(-1).ready,true);
});
console.log(passed+' netcode checks passed');
