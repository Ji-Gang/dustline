'use strict';
require('./loadout.js');
const C=require('../core.js'),A=require('./arena.js'),N=require('./netcode.js'),{Bots,LEVELS}=require('./bots.cjs');
const clamp=(v,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):min;
class Match {
 constructor(options={}){this.players=new Map();this.host=null;this.phase='lobby';this.time=0;this.scores={blue:0,red:0};this.winner=null;this.events=[];this.eventId=0;this.history=[];this.bots=new Bots();this.botSerial=0;this.configure(options);}
 configure(o){if(this.phase==='playing')return false;const maxPlayers=Math.round(clamp(o.maxPlayers??this.options?.maxPlayers??4,2,16));if([...this.players.values()].some(p=>p.slot>=(p.team==='blue'?Math.ceil(maxPlayers/2):Math.floor(maxPlayers/2))))return false;this.options={maxPlayers,target:Math.round(clamp(o.target??this.options?.target??30,1,200)),protection:clamp(o.protection??this.options?.protection??4,1,10),respawn:clamp(o.respawn??this.options?.respawn??3,1,10)};return true;}
 event(type,data){this.events.push({id:++this.eventId,type,time:this.time,...data});if(this.events.length>32)this.events.shift();}
 capacity(team){return team==='blue'?Math.ceil(this.options.maxPlayers/2):Math.floor(this.options.maxPlayers/2);}
 slots(team){return Array.from({length:this.capacity(team)},(_,i)=>i);}
 add(id,name){if(this.players.size>=this.options.maxPlayers||this.players.has(id))return false;const n=[...this.players.values()].filter(p=>p.team==='blue').length,m=this.players.size-n,team=n<=m?'blue':'red',slot=this.slots(team).find(slot=>![...this.players.values()].some(p=>p.team===team&&p.slot===slot));const p={id,name:String(name||'玩家').replace(/[<>\x00-\x1f]/g,'').slice(0,16),team,slot,kills:0,deaths:0,weapon:'ak',primary:'ak',secondary:'usp',input:{},seq:0,alive:false,deployed:this.phase!=='playing'};this.players.set(id,p);this.host??=id;this.spawn(p);if(!p.deployed)p.alive=false;return p;}
 addBot(id,team,difficulty){if(id!==this.host||this.phase==='playing'||!['blue','red'].includes(team)||!Object.hasOwn(LEVELS,difficulty))return false;const slot=this.slots(team).find(s=>![...this.players.values()].some(p=>p.team===team&&p.slot===s));if(slot===undefined||this.players.size>=this.options.maxPlayers)return false;const index=++this.botSerial,p=this.add('bot-'+index,'AI '+LEVELS[difficulty].label+' '+index);if(!p)return false;Object.assign(p,{bot:true,botIndex:index,difficulty,team,slot,primary:['ak','m4','mp5'][index%3]});this.spawn(p);return p;}
 remove(id){if(!this.players.delete(id))return;this.bots.forget(id);if(this.host===id)this.host=[...this.players.values()].find(p=>!p.bot)?.id??null;if(!this.host)this.phase='lobby';else if(this.phase==='playing')this.event('notice',{text:'有玩家离开，对局继续；空位可由好友加入。'});}
 spawn(p){p.weapon=p.primary;p.inventory={};for(const id of [p.primary,p.secondary,'knife'])p.inventory[id]={ammo:C.WEAPONS[id].mag,reserve:C.WEAPONS[id].reserve,fireAt:0};const s=A.spawns[p.team][p.slot];Object.assign(p,s,{hp:100,alive:true,canSelect:true,protectedUntil:this.time+this.options.protection,respawnAt:0,ammo:C.WEAPONS[p.weapon].mag,reserve:C.WEAPONS[p.weapon].reserve,reloadUntil:0,fireAt:this.time+.25,recoil:0,shots:0,lastShot:-99,burst:0,triggered:false,pendingPress:false,pitch:0,crouching:false,input:{},inputQueue:[],ack:p.seq||0,firePress:0,viewTime:null,spawnId:(p.spawnId||0)+1});}
 equip(p,weapon){if(p.weapon===weapon)return;const old=p.inventory[p.weapon];if(old)Object.assign(old,{ammo:p.ammo,reserve:p.reserve,fireAt:p.fireAt});const next=p.inventory[weapon];p.weapon=weapon;p.ammo=next.ammo;p.reserve=next.reserve;p.fireAt=Math.max(this.time+.3,next.fireAt||0);p.reloadUntil=0;p.recoil=0;p.shots=0;p.burst=0;p.pendingPress=false;p.triggered=false;p.input={};p.inputQueue=[];}
 start(id){if(id!==this.host||!this.players.size||this.phase==='playing')return false;this.scores={blue:0,red:0};this.winner=null;this.phase='playing';for(const p of this.players.values()){p.kills=p.deaths=0;p.deployed=true;this.spawn(p);}this.event('notice',{text:'对局开始！未满可随时加入，率先达到目标击杀数的队伍获胜。'});return true;}
 command(id,m){const p=this.players.get(id);if(!p||!m||typeof m!=='object')return;
  if(m.type==='input'&&Array.isArray(m.frames)){
   if(m.spawnId!==p.spawnId||!p.alive||!p.deployed||this.phase!=='playing')return;
   p.fixedInput=true;p.lastInput=this.time;
   // Redundant recent commands recover packet loss. Never acknowledge reception
   // as execution, nor let an oversized batch grant extra simulation time.
   for(const frame of m.frames.slice(-12)){
    if(!frame||typeof frame!=='object'||!Number.isSafeInteger(frame.seq)||frame.seq<=p.ack||p.inputQueue.some(f=>f.seq===frame.seq))continue;
    const raw=frame.input||{};if(raw.weapon&&raw.weapon!==p.weapon)continue;const input={yaw:clamp(raw.yaw,-1e6,1e6)%(Math.PI*2),pitch:clamp(raw.pitch,-1.4,1.4)};
    for(const key of ['forward','back','left','right','fire','aim','crouch','walk'])input[key]=raw[key]===true;input.aim&&=C.WEAPONS[p.weapon].scope>0;
    p.inputQueue.push({seq:frame.seq,input,firePress:Number.isSafeInteger(frame.firePress)&&frame.firePress>=0?frame.firePress:0,viewTime:Number.isFinite(frame.viewTime)?clamp(frame.viewTime,this.time-N.MAX_REWIND,this.time):this.time});
   }
   p.inputQueue.sort((a,b)=>a.seq-b.seq);if(p.inputQueue.length>8)p.inputQueue.splice(0,p.inputQueue.length-8);return;
  }
  if(m.type==='input'){if(p.fixedInput)return;const i=m.input||{};if(!Number.isSafeInteger(m.seq)||m.seq<=p.seq)return;p.seq=m.seq;p.lastInput=this.time;if(i.fire===true&&!p.input.fire)p.pendingPress=true;p.input={};for(const k of ['forward','back','left','right','fire','aim','crouch','walk'])p.input[k]=i[k]===true;p.yaw=clamp(i.yaw,-1e6,1e6)%(Math.PI*2);p.pitch=clamp(i.pitch,-1.4,1.4);return;}
  if((m.type==='seat'||m.type==='team')&&['blue','red'].includes(m.team)){
   const slot=m.type==='seat'?m.slot:this.slots(m.team).find(s=>![...this.players.values()].some(q=>q.team===m.team&&q.slot===s));
   // Late arrivals select a seat while waiting, before their first deployment.
   const mayMove=this.phase!=='playing'||!p.deployed;
   if(mayMove&&Number.isInteger(slot)&&slot>=0&&slot<this.capacity(m.team)&&![...this.players.values()].some(q=>q.id!==id&&q.team===m.team&&q.slot===slot)&&(p.team!==m.team||p.slot!==slot)){p.team=m.team;p.slot=slot;this.spawn(p);if(!p.deployed)p.alive=false;}
  }
  if(m.type==='botAdd')this.addBot(id,m.team,m.difficulty);
  if(m.type==='botRemove'&&id===this.host&&this.phase!=='playing'&&this.players.get(m.id)?.bot)this.remove(m.id);
  if(m.type==='settings'&&id===this.host){if(!this.configure(m.options||{}))this.event('notice',{text:'无法减少人数：请先腾出超出上限的席位。'});}
  if(m.type==='lobby'&&id===this.host&&this.phase==='ended')this.phase='lobby';
  if(m.type==='start')this.start(id);
  if(m.type==='deploy'&&this.phase==='playing'&&!p.deployed){p.deployed=true;this.spawn(p);}
  if(m.type==='switch'&&p.alive&&p.deployed&&Number.isInteger(m.slot)&&m.slot>=0&&m.slot<3)this.equip(p,[p.primary,p.secondary,'knife'][m.slot]);
  if(m.type==='weapon'&&p.alive&&p.canSelect&&A.inSpawn(p)&&Object.hasOwn(C.WEAPONS,m.weapon)&&!C.WEAPONS[m.weapon].melee){const slot=C.WEAPONS[m.weapon].slot===1?'secondary':'primary';if(p[slot]!==m.weapon){const old=p[slot];p[slot]=m.weapon;p.inventory[m.weapon]={ammo:C.WEAPONS[m.weapon].mag,reserve:C.WEAPONS[m.weapon].reserve,fireAt:0};this.equip(p,m.weapon);delete p.inventory[old];}else this.equip(p,m.weapon);}
  if(m.type==='reload'&&p.alive&&!p.reloadUntil&&p.ammo<C.WEAPONS[p.weapon].mag&&p.reserve>0){p.reloadUntil=this.time+C.WEAPONS[p.weapon].reload;p.burst=0;}
 }
 tick(dt){this.time+=dt;if(this.phase!=='playing')return;
  for(const p of this.players.values()){
   if(!p.deployed)continue;
   if(!p.alive){if(this.time>=p.respawnAt)this.spawn(p);continue;}
   if(p.bot)this.bots.update(this,p,dt);
   if(this.time-(p.lastInput??-99)>(this.inputTimeout||.35))p.input={};
   let executed=null;
   if(p.fixedInput){executed=p.inputQueue.shift();if(executed){const f=executed;p.pendingPress=f.firePress>p.firePress;p.firePress=Math.max(p.firePress,f.firePress);p.input=f.input;p.yaw=f.input.yaw;p.pitch=f.input.pitch;p.viewTime=f.viewTime;}else p.input={yaw:p.yaw,pitch:p.pitch,crouch:p.input.crouch,aim:p.input.aim};}
   const i=p.input,w=C.WEAPONS[p.weapon];if(!w.scope)i.aim=false;p.crouching=!!i.crouch;A.step(p,i,p.fixedInput?Math.min(dt,N.STEP):dt,w.speed);if(executed){p.ack=executed.seq;p.seq=executed.seq;}if(!A.inSpawn(p))p.canSelect=false;
   if(p.reloadUntil&&this.time>=p.reloadUntil){const count=Math.min(w.mag-p.ammo,p.reserve);p.ammo+=count;p.reserve-=count;p.reloadUntil=0;}
   if(this.time-p.lastShot>.18)p.recoil*=Math.exp(-dt*6.5);if(this.time-p.lastShot>.5)p.shots=0;
   const pressed=p.pendingPress||!p.fixedInput&&i.fire&&!p.triggered;p.pendingPress=false;p.triggered=!!i.fire;
   if(w.burst&&pressed&&!p.reloadUntil&&this.time>=p.fireAt)p.burst=Math.min(w.burst,p.ammo);
   if(!p.reloadUntil&&this.time>=p.fireAt&&p.ammo>0&&(p.burst>0||(w.auto?i.fire||pressed:pressed))){this.shoot(p);if(this.phase!=='playing')break;}
  }
  this.history.push({time:this.time,players:[...this.players.values()].map(p=>({id:p.id,x:p.x,z:p.z,crouching:p.crouching,spawnId:p.spawnId,alive:p.alive}))});
  while(this.history.length>2&&this.history[1].time<this.time-N.MAX_REWIND)this.history.shift();
 }
 historical(p,time){
  if(!Number.isFinite(time)||time>=this.time||!this.history.length)return p;
  time=clamp(time,this.time-N.MAX_REWIND,this.time);let a=null,b=null;
  for(const f of this.history){const sample=f.players.find(q=>q.id===p.id);if(!sample||sample.spawnId!==p.spawnId||!sample.alive)continue;if(f.time<=time)a={...sample,time:f.time};if(f.time>=time){b={...sample,time:f.time};break;}}
  if(!a)return p;if(!b)b={...p,time:this.time};const t=b.time>a.time?clamp((time-a.time)/(b.time-a.time),0,1):0;
  return {...a,x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
 }
 shoot(p){const w=C.WEAPONS[p.weapon];if(!w.melee)p.ammo--;p.protectedUntil=0;p.fireAt=this.time+w.rate;if(p.burst>0){p.burst--;if(!p.burst)p.fireAt+=.22;}
  const origin={x:p.x,y:p.crouching?1.12:1.64,z:p.z},pitch=Math.min(1.48,p.pitch+p.recoil),moving=['forward','back','left','right'].some(k=>p.input[k]),spread=w.melee?0:C.spread(p.weapon,{moving,crouch:p.crouching,aim:p.input.aim,shots:p.shots});let endpoint,hitId=null,damage=0,hitHead=false;
  for(let pellet=0;pellet<(w.pellets||1);pellet++){
   const yaw=p.yaw+(Math.random()-.5)*spread*2,angle=pitch+(Math.random()-.5)*spread*2,end={x:origin.x-Math.sin(yaw)*Math.cos(angle)*w.range,y:origin.y+Math.sin(angle)*w.range,z:origin.z-Math.cos(yaw)*Math.cos(angle)*w.range};let nearest=1,target=null,head=false;
   for(const b of A.boxes){const t=C.segmentBox(origin,end,b);if(t!==null&&t<nearest)nearest=t;}
   if(end.y<0)nearest=Math.min(nearest,origin.y/(origin.y-end.y));
   for(const victim of this.players.values()){if(!victim.alive||victim.team===p.team)continue;const pose=this.historical(victim,p.viewTime);for(const part of [{h:pose.crouching?.9:1.38,base:0,w:.55,head:false},{h:.3,base:pose.crouching?.9:1.38,w:.32,head:true}]){const t=C.segmentBox(origin,end,{x:pose.x,z:pose.z,w:part.w,d:part.w,h:part.h,base:part.base});if(t!==null&&t<nearest){nearest=t;target=victim;head=!w.melee&&part.head;}}}
   endpoint={x:origin.x+(end.x-origin.x)*nearest,y:origin.y+(end.y-origin.y)*nearest,z:origin.z+(end.z-origin.z)*nearest};
   if(target&&this.time>=target.protectedUntil){hitId=target.id;const falloff=w.melee?1:w.pellets?Math.max(.15,1-nearest*w.range*.035):Math.max(.7,1-nearest*w.range*.002);const dealt=Math.min(target.hp,w.damage*(head?w.head:1)*falloff);target.hp=Math.max(0,target.hp-dealt);damage+=dealt;hitHead||=head;if(target.hp<=0){target.alive=false;target.deaths++;target.respawnAt=this.time+this.options.respawn;target.input={};p.kills++;this.scores[p.team]++;this.event('kill',{killer:p.name,killerId:p.id,victim:target.name,victimId:target.id,team:p.team,head});if(this.scores[p.team]>=this.options.target){this.phase='ended';this.winner=p.team;break;}}}
  }
  this.event('shot',{player:p.id,spawnId:p.spawnId,weapon:p.weapon,melee:!!w.melee,origin,end:endpoint,hit:hitId,damage,head:hitHead});p.recoil=w.melee?0:Math.min(.34,p.recoil+C.recoil(p.weapon,p.shots,p.crouching,p.input.aim).pitch);p.shots++;p.lastShot=this.time;
 }
 snapshot(){return {netcode:8,phase:this.phase,time:this.time,host:this.host,options:this.options,scores:this.scores,winner:this.winner,events:this.events,players:[...this.players.values()].map(({input,inputQueue,fixedInput,firePress,viewTime,triggered,pendingPress,lastInput,burst,shots,lastShot,...p})=>({...p}))};}
}
module.exports={Match};
