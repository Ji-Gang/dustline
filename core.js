/* Shared, renderer-independent tactical simulation. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./map.js'):root.DustMap);if(typeof module==='object'&&module.exports)module.exports=api;else root.Tactical=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Level){
  'use strict';
  const WEAPONS={
    usp:{name:'USP-S',type:'消音手枪',price:0,damage:30,head:3.4,mag:12,reserve:60,rate:.20,reload:1.8,kick:.014,spread:.0025,speed:5.2,auto:false,range:75,color:'#c7d0c7'},
    ak:{name:'AK-47',type:'突击步枪',price:2700,damage:36,head:4,mag:30,reserve:90,rate:.10,reload:2.45,kick:.024,spread:.002,speed:4.6,auto:true,range:115,color:'#dca56a'},
    m4:{name:'M4A1-S',type:'消音步枪',price:2900,damage:30,head:3.5,mag:25,reserve:100,rate:.088,reload:2.2,kick:.016,spread:.0015,speed:4.8,auto:true,range:110,color:'#90bfc5'},
    mp5:{name:'MP5-SD',type:'冲锋枪',price:1500,damage:23,head:3.4,mag:30,reserve:120,rate:.075,reload:2.0,kick:.012,spread:.004,speed:5.5,auto:true,range:65,color:'#b1c1a0'},
    awp:{name:'AWP',type:'栓动狙击枪',price:4750,damage:115,head:4,mag:5,reserve:30,rate:1.35,reload:3.3,kick:.078,spread:.024,speed:3.8,auto:false,range:160,color:'#c2ca93'},
    deagle:{name:'DESERT EAGLE',type:'大口径手枪',price:700,damage:58,head:3.8,mag:7,reserve:35,rate:.3,reload:2.1,kick:.05,spread:.003,speed:5.0,auto:false,range:95,color:'#c4cbd1'},
    glock:{name:'GLOCK-18',type:'半自动手枪',price:200,damage:24,head:3.4,mag:20,reserve:100,rate:.15,reload:1.7,kick:.011,spread:.004,speed:5.4,auto:false,range:65,color:'#a2aebb'},
    p250:{name:'P250',type:'紧凑型手枪',price:300,damage:35,head:3.5,mag:13,reserve:65,rate:.19,reload:1.8,kick:.021,spread:.003,speed:5.2,auto:false,range:75,color:'#c7b38e'},
    p90:{name:'P90',type:'个人防卫武器',price:2350,damage:24,head:3.2,mag:50,reserve:150,rate:.066,reload:3.0,kick:.013,spread:.005,speed:5.3,auto:true,range:70,color:'#aea388'},
    ump:{name:'UMP-45',type:'.45 冲锋枪',price:1200,damage:33,head:3.3,mag:25,reserve:100,rate:.105,reload:2.2,kick:.020,spread:.004,speed:5.2,auto:true,range:72,color:'#9da7a4'},
    galil:{name:'GALIL AR',type:'突击步枪',price:1800,damage:30,head:3.5,mag:35,reserve:105,rate:.09,reload:2.7,kick:.024,spread:.003,speed:4.7,auto:true,range:105,color:'#c7b48d'},
    famas:{name:'FAMAS',type:'三连发步枪',price:2050,damage:29,head:3.5,mag:25,reserve:100,rate:.075,reload:2.4,kick:.013,spread:.002,speed:4.8,auto:false,burst:3,range:105,color:'#a9b6b3'},
    aug:{name:'AUG',type:'瞄准镜步枪',price:3300,damage:32,head:3.6,mag:30,reserve:90,rate:.09,reload:2.8,kick:.018,spread:.002,speed:4.5,auto:true,range:120,color:'#b4b79a'},
    scout:{name:'SSG 08',type:'轻型狙击枪',price:1700,damage:78,head:4,mag:10,reserve:50,rate:1.0,reload:2.7,kick:.055,spread:.018,speed:5.1,auto:false,range:150,color:'#c5b890'},
    nova:{name:'NOVA',type:'泵动霰弹枪',price:1050,damage:15,head:1.6,mag:8,reserve:40,rate:.85,reload:3.2,kick:.07,spread:.031,speed:4.9,auto:false,pellets:8,range:38,color:'#bc9267'},
    m249:{name:'M249',type:'轻机枪',price:5200,damage:29,head:3.2,mag:100,reserve:200,rate:.075,reload:4.5,kick:.027,spread:.005,speed:3.8,auto:true,range:115,color:'#b6b891'}
  };
  const CATEGORIES={pistol:'手枪',smg:'冲锋枪',rifle:'步枪',sniper:'狙击枪',shotgun:'霰弹枪',heavy:'机枪'};
  for(const [id,w] of Object.entries(WEAPONS)){
    w.category=['usp','deagle','glock','p250'].includes(id)?'pistol':['mp5','p90','ump'].includes(id)?'smg':['awp','scout'].includes(id)?'sniper':id==='nova'?'shotgun':id==='m249'?'heavy':'rifle';
    w.slot=w.category==='pistol'?1:0;w.scope=w.category==='sniper'?25:id==='aug'?42:0;w.suppressed=['usp','m4','mp5'].includes(id);
  }

  const {MAP,SPAWNS,SITES,SURFACES,BUILDINGS,WALLS,PROPS,ROOFS,LANDMARKS,ROUTES}=Level;
  const COVERS=PROPS.map(p=>[p.x,p.z,p.w,p.d,p.h]);
  const groundHeight=Level.height;
  const zoneName=Level.zone;
  function createColliders(){return [...BUILDINGS.map(b=>({...b,base:0})),...WALLS.map(b=>({...b})),...PROPS.map(p=>({...p,base:groundHeight(p.x,p.z)})),...ROOFS.map(b=>({...b}))];}
  function blocked(x,z,boxes,r=.38,y=null){if(x<MAP.minX+r||x>MAP.maxX-r||z<MAP.minZ+r||z>MAP.maxZ-r)return true;const bottom=y===null?groundHeight(x,z):y;return boxes.some(b=>bottom<(b.base||0)+b.h-.001&&bottom+1.75>(b.base||0)+.02&&Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);}
  function move(body,dx,dz,boxes,r=.38){
    const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));
    function step(x,z){const current=groundHeight(body.x,body.z),next=groundHeight(x,z),y=body.y??current,grounded=y<=current+.09;if(next>y+.38)return;const checkY=grounded?Math.max(y,next):y;if(!blocked(x,z,boxes,r,checkY)){body.x=x;body.z=z;if(grounded&&next>=current-.38)body.y=next;}}
    for(let i=0;i<count;i++){step(body.x+dx/count,body.z);step(body.x,body.z+dz/count);}
  }
  function segmentBox(a,b,box){let lo=0,hi=1;for(const [key,half,center] of [['x',box.w/2,box.x],['y',box.h/2,(box.base||0)+box.h/2],['z',box.d/2,box.z]]){const delta=b[key]-a[key],min=center-half,max=center+half;if(Math.abs(delta)<1e-9){if(a[key]<min||a[key]>max)return null;}else{let u=(min-a[key])/delta,v=(max-a[key])/delta;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return null;}}return lo;}
  function segmentTerrain(a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.45));const below=t=>a.y+(b.y-a.y)*t<groundHeight(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)-.002;for(let i=1;i<=n;i++){if(!below(i/n))continue;let lo=(i-1)/n,hi=i/n;for(let k=0;k<9;k++){const mid=(lo+hi)/2;if(below(mid))hi=mid;else lo=mid;}return hi;}return null;}
  function clearLine(a,b,boxes){return !boxes.some(box=>segmentBox(a,b,box)!==null)&&segmentTerrain(a,b)===null;}
  function spectatorTarget(bots,index,delta=0){const alive=bots.filter(b=>b.alive&&b.team==='attacker');if(!alive.length)return null;const at=alive.findIndex(b=>b.index===index);if(at<0)return alive[0];return alive[(at+delta%alive.length+alive.length)%alive.length];}
  function eyePose(actor){return {x:actor.x,y:(actor.y||0)+(actor.crouching?1.12:1.64),z:actor.z,yaw:actor.yaw||0,pitch:Math.max(-1.4,Math.min(1.4,actor.pitch||0))};}
  function recoil(weapon,index,crouch=false,aim=false){const w=WEAPONS[weapon],n=index%28;return {pitch:w.kick*(n<3?.75:1.05)*(crouch?.75:1)*(aim?.82:1),yaw:w.kick*(n<4?Math.sin(n*1.7)*.12:Math.sin((n-4)*.56)*.65)*(crouch?.7:1)};}
  function spread(weapon,{moving=false,crouch=false,aim=false,airborne=false,shots=0}={}){const w=WEAPONS[weapon];let value=w.spread;if(w.category==='sniper'&&aim)value=.00025;return value*(crouch?.65:1)*(aim?.7:1)+(moving?(w.category==='sniper'?.035:.019):0)+(airborne?.055:0)+Math.min(shots,15)*.0006;}
  function loadout(id){const w=WEAPONS[id];return {id,ammo:w.mag,reserve:w.reserve};}
  function reloadWeapon(gun){const missing=WEAPONS[gun.id].mag-gun.ammo,amount=Math.min(missing,gun.reserve);gun.ammo+=amount;gun.reserve-=amount;return amount;}
  function buy(player,id){const w=WEAPONS[id];if(!w||player.money<w.price)return false;const slot=w.slot;if(player.guns[slot]?.id===id)return false;player.money-=w.price;player.guns[slot]=loadout(id);player.slot=slot;return true;}
  function outcome({attackers,defenders,bomb,time}){if(bomb?.planted){if(bomb.defused)return 'defenders';if(bomb.time<=0)return 'attackers';if(defenders===0)return 'attackers';return null;}if(attackers===0)return 'defenders';if(defenders===0)return 'attackers';if(time<=0)return 'defenders';return null;}

  class Navigation{
    constructor(boxes){this.boxes=boxes;this.step=2;this.cols=Math.floor(MAP.width/2)+1;this.rows=Math.floor(MAP.depth/2)+1;this.walk=new Uint8Array(this.cols*this.rows);this.links=new Uint8Array(this.walk.length);
      for(let z=0;z<this.rows;z++)for(let x=0;x<this.cols;x++)this.walk[z*this.cols+x]=!blocked(x*2+MAP.minX,z*2+MAP.minZ,boxes,.58);
      for(let at=0;at<this.walk.length;at++){if(!this.walk[at])continue;const a=this.point(at);for(const [i,[dx,dz]] of [[1,0],[-1,0],[0,1],[0,-1]].entries()){const x=at%this.cols+dx,z=Math.floor(at/this.cols)+dz,n=z*this.cols+x;if(x<0||z<0||x>=this.cols||z>=this.rows||!this.walk[n])continue;const b=this.point(n);if(Math.abs(groundHeight(a.x,a.z)-groundHeight(b.x,b.z))>.65||blocked((a.x+b.x)/2,(a.z+b.z)/2,boxes,.58))continue;this.links[at]|=1<<i;}}
    }
    cell(x,z){const c=Math.max(0,Math.min(this.cols-1,Math.round((x-MAP.minX)/2))),r=Math.max(0,Math.min(this.rows-1,Math.round((z-MAP.minZ)/2)));return r*this.cols+c;}
    point(id){return {x:(id%this.cols)*2+MAP.minX,z:Math.floor(id/this.cols)*2+MAP.minZ};}
    nearest(id){if(this.walk[id])return id;const p=this.point(id);let best=-1,d=Infinity;for(let i=0;i<this.walk.length;i++)if(this.walk[i]){const q=this.point(i),v=(p.x-q.x)**2+(p.z-q.z)**2;if(v<d){d=v;best=i;}}return best;}
    path(ax,az,bx,bz){const start=this.nearest(this.cell(ax,az)),end=this.nearest(this.cell(bx,bz));if(start<0||end<0)return [];const prev=new Int32Array(this.walk.length).fill(-1),queue=[start];prev[start]=start;for(let q=0;q<queue.length&&prev[end]<0;q++){const at=queue[q];for(const [i,offset] of [1,-1,this.cols,-this.cols].entries()){if(!(this.links[at]&(1<<i)))continue;const n=at+offset;if(prev[n]>=0)continue;prev[n]=at;queue.push(n);}}if(prev[end]<0)return [];const result=[];for(let i=end;i!==start;i=prev[i])result.push(this.point(i));return result.reverse();}
  }
  return {WEAPONS,CATEGORIES,MAP,SPAWNS,SITES,SURFACES,BUILDINGS,WALLS,PROPS,ROOFS,LANDMARKS,ROUTES,COVERS,groundHeight,zoneName,segmentTerrain,spectatorTarget,eyePose,createColliders,blocked,move,segmentBox,clearLine,recoil,spread,loadout,reloadWeapon,buy,outcome,Navigation};
});
