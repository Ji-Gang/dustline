/* Tactical AI: perception snapshots, finite ammunition, cover/peek, role-based objectives. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else Object.assign(root.Tactical,factory(root.Tactical));})(typeof globalThis!=='undefined'?globalThis:this,function(C){
'use strict';
const DIFFICULTIES={
  recruit:{name:'新兵',reaction:1.05,error:.060,turn:1.5,memory:3,hearing:.65,tactics:0,burst:2,pause:.85,radio:1.6,fov:100,description:'反应较慢、点射间隔长，适合熟悉地图与压枪。'},
  regular:{name:'普通',reaction:.68,error:.038,turn:2.2,memory:5,hearing:.85,tactics:1,burst:3,pause:.60,radio:1.0,fov:110,description:'听声调查、基础掩体与换弹，保留较多瞄准误差。'},
  veteran:{name:'老兵',reaction:.43,error:.023,turn:3.0,memory:7,hearing:1,tactics:2,burst:4,pause:.43,radio:.65,fov:120,description:'掩体探头、短点射、受伤撤退，分路线推进。'},
  expert:{name:'专家',reaction:.28,error:.014,turn:4.1,memory:9,hearing:1.15,tactics:3,burst:5,pause:.30,radio:.4,fov:125,description:'共享已发现的位置，侧翼包抄，回防时分工拆包与掩护。'},
  nightmare:{name:'噩梦',reaction:.18,error:.008,turn:5.2,memory:11,hearing:1.3,tactics:4,burst:6,pause:.22,radio:.25,fov:135,description:'快速反应与稳定点射，积极换位协同；仍受视野、墙体与弹药限制。'}
};
const STATE_NAMES={hold:'架点',advance:'推进',investigate:'搜点',engage:'交火',cover:'躲避',peek:'探头',flank:'包抄',reload:'换弹',plant:'安放',defuse:'拆包',guard:'掩护'};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const eye=b=>({x:b.x,y:(b.y||0)+(b.crouching?1.12:1.52),z:b.z});
function canSee(bot,target,boxes,profile){
  if(!target.alive)return false;
  const d=distance(bot,target);if(d>72)return false;
  const yaw=Math.atan2(bot.x-target.x,bot.z-target.z);
  if(d>4&&Math.abs(wrap(yaw-bot.yaw))>(bot.memory?Math.max(profile.fov,145):profile.fov)*Math.PI/360)return false;
  return C.clearLine(eye(bot),eye(target),boxes);
}
function walkClear(a,b,boxes){const d=distance(a,b),n=Math.max(1,Math.ceil(d/.32));let previous=C.groundHeight(a.x,a.z);for(let i=1;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n,h=C.groundHeight(x,z);if(C.blocked(x,z,boxes,.42)||Math.abs(h-previous)>.38)return false;previous=h;}return true;}
class AIDirector{
  constructor(boxes,nav,rng=Math.random){this.boxes=boxes;this.nav=nav;this.random=rng;this.difficulty='veteran';this.contacts=[];this.round=1;this.coverPoints=[];
    for(const b of boxes){if(b.h<1.6||b.w>25||b.d>25)continue;const xx=b.w/2+.85,zz=b.d/2+.85;for(const s of [-1,1])for(const f of [-.72,0,.72]){
      for(const p of [{x:b.x+s*xx,z:b.z+f*b.d/2},{x:b.x+f*b.w/2,z:b.z+s*zz}])if(!C.blocked(p.x,p.z,boxes,.42))this.coverPoints.push(p);
    }}
  }
  reset(round=1){this.contacts=[];this.round=round;}
  setDifficulty(id){if(DIFFICULTIES[id])this.difficulty=id;}
  profile(bot){return DIFFICULTIES[bot.team==='attacker'?'veteran':this.difficulty];}
  init(bot){bot.teamSlot??=bot.team==='attacker'?bot.index+1:Math.max(0,bot.index-2);bot.routeIndex=0;Object.assign(bot,{state:'hold',stateUntil:0,memory:null,target:null,aimPoint:null,readyAt:0,senseAt:0,fireAt:0,burstLeft:0,reloadUntil:0,path:[],pathAt:0,goal:null,coverPoint:null,peekPoint:null,stuck:0,radioAt:0,spottedUntil:0,planAt:0,crouching:false,objectiveProgress:0,role:bot.team==='attacker'?(bot.index===0?'entry':'support'):['anchor','flanker','rotate','anchor','flanker'][bot.teamSlot]||'anchor',gun:C.loadout(bot.team==='attacker'?'m4':'ak')});}
  hear(source,radius,now,bots,kind='shot'){
    for(const b of bots){if(!b.alive||b.team===source.team||distance(b,source)>radius*this.profile(b).hearing||b.target)continue;const error=kind==='step'?2:3.5;
      b.memory={x:source.x+(this.random()-.5)*error,z:source.z+(this.random()-.5)*error,y:(source.y||0)+1.3,time:now,heard:true};b.senseAt=0;if(b.state!=='cover'&&b.state!=='reload'){b.state='investigate';b.goal={...b.memory};b.pathAt=0;}
    }
  }
  reportDamage(bot,source,now){if(!bot.gun)return;bot.memory={x:source.x+(this.random()-.5)*2,z:source.z+(this.random()-.5)*2,y:(source.y||0)+1.3,time:now,heard:true};bot.planAt=0;bot.senseAt=0;}
  chooseCover(bot,threat,bots){
    const candidates=[];for(const p of this.coverPoints){const d=distance(bot,p);if(d>18||d<.7||distance(threat,p)<3)continue;
      if(C.clearLine({x:threat.x,y:threat.y||1.5,z:threat.z},{x:p.x,y:C.groundHeight(p.x,p.z)+1.35,z:p.z},this.boxes))continue;
      const crowded=bots.some(o=>o!==bot&&o.alive&&o.coverPoint&&distance(o.coverPoint,p)<2);if(crowded)continue;
      candidates.push({point:p,score:d+(bot.team==='attacker'?distance(threat,p)*.5:distance(threat,p)*.015)});
    }
    candidates.sort((a,b)=>a.score-b.score);
    for(const {point} of candidates.slice(0,6)){const path=this.nav.path(bot.x,bot.z,point.x,point.z);if(path.length||distance(bot,point)<2)return {...point};}return null;
  }
  choosePeek(bot,threat){const cover=bot.coverPoint;if(!cover)return null;let best=null,score=Infinity;
    for(const radius of [1.6,2.8,4])for(let i=0;i<12;i++){let a=i*Math.PI/6,p={x:cover.x+Math.cos(a)*radius,z:cover.z+Math.sin(a)*radius};if(!walkClear(cover,p,this.boxes)||!C.clearLine({...p,y:C.groundHeight(p.x,p.z)+1.5},{x:threat.x,y:threat.y||1.3,z:threat.z},this.boxes))continue;let cost=distance(cover,p);if(cost<score){best=p;score=cost;}}
    return best;
  }
  moveTo(bot,goal,dt,now,speed){if(!goal)return 0;const initial={x:bot.x,z:bot.z};if(distance(bot,goal)<.25)return 0;
    if(walkClear(bot,goal,this.boxes)){bot.path=[goal];}
    else if(now>=bot.pathAt||!bot.path.length){bot.path=this.nav.path(bot.x,bot.z,goal.x,goal.z);const start=this.nav.point(this.nav.nearest(this.nav.cell(bot.x,bot.z)));if(bot.path[0]&&!walkClear(bot,bot.path[0],this.boxes)&&walkClear(bot,start,this.boxes))bot.path.unshift(start);const last=bot.path[bot.path.length-1];if(last&&walkClear(last,goal,this.boxes))bot.path.push(goal);bot.pathAt=now+.8;}
    while(bot.path.length&&distance(bot,bot.path[0])<.26)bot.path.shift();
    let index=0;for(let i=1;i<Math.min(bot.path.length,5);i++)if(walkClear(bot,bot.path[i],this.boxes))index=i;
    if(index)bot.path.splice(0,index);const point=bot.path[0];if(!point)return 0;
    const d=distance(bot,point),step=Math.min(speed*dt,d);C.move(bot,(point.x-bot.x)/d*step,(point.z-bot.z)/d*step,this.boxes,.38);
    const traveled=distance(initial,bot);bot.stuck=traveled<step*.15?bot.stuck+dt:0;
    if(bot.stuck>.65){bot.pathAt=0;bot.path=[];bot.stuck=0;const p=this.nav.point(this.nav.nearest(this.nav.cell(bot.x,bot.z)));if(walkClear(bot,p,this.boxes))C.move(bot,(p.x-bot.x)*Math.min(1,dt*3),(p.z-bot.z)*Math.min(1,dt*3),this.boxes);}
    return traveled/Math.max(dt,.001);
  }
  setGoal(bot,goal){if(!bot.goal||distance(bot.goal,goal)>1){bot.pathAt=0;bot.path=[];}bot.goal=goal;}
  objective(bot,world,defuser){
    const {bomb,player,bots}=world;
    if(bomb?.planted){
      if(bot.team==='defender'){
        if(bot===defuser){bot.state='defuse';return {x:bomb.x,z:bomb.z};}
        bot.state='guard';const angle=(bot.index-2)*Math.PI*.5;const point={x:bomb.x+Math.cos(angle)*5.5,z:bomb.z+Math.sin(angle)*5.5};return C.blocked(point.x,point.z,this.boxes,.5)?this.nav.point(this.nav.nearest(this.nav.cell(point.x,point.z))):point;
      }
      bot.state='guard';const p={x:bomb.x+(bot.index===0?-5:5),z:bomb.z+6};return this.nav.point(this.nav.nearest(this.nav.cell(p.x,p.z)));
    }
    const attacking=bot.team==='attacker',slot=bot.teamSlot;
    if(attacking&&!player.alive&&!bots.some(b=>b.alive&&b.team==='attacker'&&b.carryBomb))bot.carryBomb=true;
    const routeKey=attacking?((this.round-1)%2===0?(slot%2?'aLong':'aShort'):(slot%2?'bTunnel':'bSplit')):(slot<2?'ctA':slot<4?'ctB':'ctMid');
    const route=C.ROUTES[routeKey];if(bot.routeKey!==routeKey){bot.routeKey=routeKey;bot.routeIndex=0;}
    while(bot.routeIndex<route.length-1&&distance(bot,route[bot.routeIndex])<2.2)bot.routeIndex++;
    bot.state=attacking?(bot.carryBomb?'plant':'advance'):'hold';
    if(bot.routeIndex<route.length-1)return route[bot.routeIndex];
    const destination=route[route.length-1];
    if(attacking&&bot.carryBomb)return C.SITES[(this.round-1)%2];
    const p={x:destination.x+(slot%2?1.8:-1.8),z:destination.z+(slot%3)*1.5};
    return C.blocked(p.x,p.z,this.boxes,.5)?this.nav.point(this.nav.nearest(this.nav.cell(p.x,p.z))):p;
  }

  tick(dt,world){const {bots,player,now,bomb}=world,all=[player,...bots];
    for(let i=this.contacts.length-1;i>=0;i--){const contact=this.contacts[i];if(contact.at>now)continue;for(const b of bots)if(b.alive&&b.team===contact.team&&b!==contact.source&&!b.target&&this.profile(b).tactics>=3){b.memory={...contact.position};b.senseAt=0;}this.contacts.splice(i,1);}
    let defuser=null;if(bomb?.planted){const defenders=bots.filter(b=>b.alive&&b.team==='defender'&&!b.reloadUntil);defenderSort: {let best=Infinity;for(const b of defenders){const cost=distance(b,bomb)+(b.target?12:0);if(cost<best){best=cost;defuser=b;}}}}
    let activeDefuser=null;
    for(const bot of bots){if(!bot.alive)continue;const cfg=this.profile(bot),weapon=C.WEAPONS[bot.gun.id];bot.crouching=false;
      if(now>=bot.senseAt){bot.senseAt=now+(cfg.tactics>=3?.10:.18);let target=null,score=Infinity;
        for(const candidate of all){if(candidate.team===bot.team||!canSee(bot,candidate,this.boxes,cfg))continue;const priority=distance(bot,candidate)*(candidate===bot.target?.75:1);if(priority<score){target=candidate;score=priority;}}
        if(target){if(bot.target!==target){bot.readyAt=now+cfg.reaction*(.8+this.random()*.4);bot.engageSince=now;bot.burstLeft=cfg.burst;}
          bot.memory={x:target.x,y:(target.y||0)+1.3,z:target.z,time:now};bot.aimHead=cfg.tactics>=3&&this.random()<.14;
          if(bot.team==='attacker'&&target!==player)target.spottedUntil=now+2;
          if(now>=bot.radioAt){this.contacts.push({at:now+cfg.radio,team:bot.team,source:bot,position:{...bot.memory}});bot.radioAt=now+1.4;}
        }
        bot.target=target;
      }
      if(bot.memory&&now-bot.memory.time>cfg.memory)bot.memory=null;
      const visible=bot.target?.alive&&canSee(bot,bot.target,this.boxes,cfg)?bot.target:null;
      if(!visible)bot.target=null;
      if(bot.reloadUntil&&now>=bot.reloadUntil){C.reloadWeapon(bot.gun);bot.reloadUntil=0;bot.stateUntil=0;}
      if(!bot.reloadUntil&&bot.gun.reserve>0&&(bot.gun.ammo===0||!visible&&bot.gun.ammo<Math.ceil(weapon.mag*.3))){bot.reloadUntil=now+weapon.reload;bot.state='reload';bot.coverPoint=cfg.tactics?this.chooseCover(bot,bot.memory||{x:bot.x,z:bot.z+10,y:1.5},bots):null;if(bot.coverPoint)this.setGoal(bot,bot.coverPoint);}
      const forcedCover=bot.reloadUntil||cfg.tactics>0&&bot.hp<38&&now>=bot.planAt&&visible;
      if(forcedCover){bot.state=bot.reloadUntil?'reload':'cover';if(!bot.coverPoint&&bot.memory)bot.coverPoint=this.chooseCover(bot,bot.memory,bots);if(bot.coverPoint)this.setGoal(bot,bot.coverPoint);bot.stateUntil=Math.max(bot.stateUntil,now+.6);bot.planAt=now+2;}
      else if((bot.state==='cover'||bot.state==='peek')&&bot.coverPoint&&bot.memory){
        if(bot.state==='cover'&&distance(bot,bot.coverPoint)<.5&&now>bot.stateUntil){bot.peekPoint=this.choosePeek(bot,bot.memory);if(bot.peekPoint){bot.state='peek';bot.peekArrived=false;this.setGoal(bot,bot.peekPoint);bot.stateUntil=now+8;}else{bot.coverPoint=null;bot.state='investigate';}}
        else if(bot.state==='peek'){
          if(!bot.peekArrived&&distance(bot,bot.peekPoint)<.4){bot.peekArrived=true;bot.stateUntil=now+1.1+cfg.reaction;}
          if(now>bot.stateUntil){bot.peekCount=(bot.peekCount||0)+1;if(bot.peekCount>=2){bot.peekCount=0;bot.coverPoint=null;bot.state='investigate';bot.planAt=now+3;}else{bot.state='cover';this.setGoal(bot,bot.coverPoint);bot.stateUntil=now+.6+this.random()*.5;}}
        }
      }
      else if(visible){bot.state='engage';
        if(bot.team==='attacker'&&distance(bot,visible)>28)this.setGoal(bot,this.objective(bot,{...world,now},defuser));else bot.goal=null;
        if(cfg.tactics>=2&&now>=bot.planAt&&now-bot.engageSince>1.1){bot.planAt=now+2.4;bot.coverPoint=this.chooseCover(bot,bot.memory,bots);if(bot.coverPoint){bot.state='cover';bot.stateUntil=now+.9;this.setGoal(bot,bot.coverPoint);}}
      }
      else if(bot.memory){
        if(bot.state==='flank'&&bot.goal&&distance(bot,bot.goal)>1&&now<bot.stateUntil){/* complete the chosen flank without chasing live coordinates */}
        else if(cfg.tactics>=3&&bot.role==='flanker'&&now-bot.memory.time>.6&&now>=bot.planAt){
          const dx=bot.memory.x-bot.x,dz=bot.memory.z-bot.z,d=Math.hypot(dx,dz)||1,side=bot.index%2?1:-1,p={x:bot.memory.x-dz/d*11*side,z:bot.memory.z+dx/d*11*side};
          const point=this.nav.point(this.nav.nearest(this.nav.cell(p.x,p.z)));bot.state='flank';bot.stateUntil=now+6;bot.planAt=now+8;this.setGoal(bot,point);
        }else{bot.state='investigate';this.setGoal(bot,{x:bot.memory.x,z:bot.memory.z});if(distance(bot,bot.memory)<1.3){bot.memory=null;bot.goal=null;}}
      }else{bot.coverPoint=null;this.setGoal(bot,this.objective(bot,{...world,now},defuser));}
      let wantMove=!!bot.goal;
      if(bot.state==='cover'&&bot.coverPoint&&distance(bot,bot.coverPoint)<.5||bot.state==='hold'&&bot.goal&&distance(bot,bot.goal)<.5)wantMove=false;
      if(bot.state==='defuse'&&distance(bot,bomb)<2.25&&!visible){wantMove=false;activeDefuser=bot;bot.crouching=true;}
      if(bot.state==='plant'&&!visible){const site=C.SITES.find(s=>distance(bot,s)<5);if(site){wantMove=false;bot.crouching=true;bot.objectiveProgress+=dt;if(bot.objectiveProgress>=3){world.plant(bot.x,bot.z,site,bot);bot.carryBomb=false;bot.objectiveProgress=0;}}else bot.objectiveProgress=0;}else bot.objectiveProgress=0;
      const old={x:bot.x,z:bot.z};const velocity=bot.reloadUntil?2.1:bot.state==='peek'?1.8:bot.team==='attacker'?3.6:bot.state==='hold'?1.7:3.2;
      bot.walk=wantMove?this.moveTo(bot,bot.goal,dt,now,velocity*C.MAP.speedMultiplier):0;
      if(!bot.walk&&visible&&bot.state==='engage'&&cfg.tactics>=2&&!bot.reloadUntil&&now<bot.fireAt-.12){const dx=visible.x-bot.x,dz=visible.z-bot.z,d=Math.hypot(dx,dz)||1,side=Math.sin(now*1.7+bot.index)>0?1:-1;C.move(bot,-dz/d*side*dt*.9,dx/d*side*dt*.9,this.boxes);bot.walk=distance(old,bot)/dt;}
      for(const other of all){if(other===bot||!other.alive)continue;const d=distance(bot,other);if(d>0&&d<.85)C.move(bot,(bot.x-other.x)/d*dt,(bot.z-other.z)/d*dt,this.boxes);}
      bot.y=C.groundHeight(bot.x,bot.z);
      let aim=visible?{x:visible.x,y:(visible.y||0)+(visible.crouching?1:bot.aimHead?1.62:1.28),z:visible.z}:bot.memory||bot.goal;
      bot.pitch=visible?Math.atan2(aim.y-eye(bot).y,distance(bot,aim)):0;
      if(aim){let yaw=Math.atan2(bot.x-aim.x,bot.z-aim.z);if(!visible&&!bot.memory&&distance(bot,aim)<.7)yaw=(bot.team==='defender'?Math.PI:0)+Math.sin(now*.6+bot.index)*.7;const diff=wrap(yaw-bot.yaw);bot.yaw+=Math.max(-cfg.turn*dt,Math.min(cfg.turn*dt,diff));}
      if(visible&&!bot.reloadUntil&&bot.gun.ammo>0&&now>=bot.readyAt&&now>=bot.fireAt&&bot.state!=='cover'&&bot.state!=='defuse'&&bot.state!=='plant'){
        const desired=Math.atan2(bot.x-visible.x,bot.z-visible.z),aligned=Math.abs(wrap(desired-bot.yaw))<.07;
        if(aligned){const aimPoint={x:aim.x,y:aim.y,z:aim.z};const error=cfg.error*(1+bot.walk*.4)*(1+distance(bot,visible)/100);world.fire(bot,aimPoint,error);bot.gun.ammo--;bot.burstLeft--;bot.fireAt=now+weapon.rate;if(bot.burstLeft<=0){bot.burstLeft=cfg.burst;bot.fireAt+=cfg.pause;}}
      }
      if(bot.reloadUntil&&bot.coverPoint&&distance(bot,bot.coverPoint)<.8)bot.crouching=true;
    }
    if(bomb?.planted){if(activeDefuser&&activeDefuser.alive){if(bomb.defuserId!==activeDefuser.index)bomb.defuse=0;bomb.defuserId=activeDefuser.index;bomb.defuse+=dt;}else{bomb.defuse=0;bomb.defuserId=null;}if(bomb.defuse>=5)bomb.defused=true;}
  }
}
return {DIFFICULTIES,STATE_NAMES,AIDirector,canSee,walkClear};
});
