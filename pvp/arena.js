/* Shared arena geometry and authoritative movement: metres, mirrored spawns. */
(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f();else root.Arena=f();})(globalThis,()=>{
const maps={foundry:'铸造工坊',quarry:'砂岩采石场'};
function create(id='foundry'){if(!Object.hasOwn(maps,id))id='foundry';
const bounds={x:40,z:30},boxes=[];
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
function blocked(x,z,r=.38){return Math.abs(x)>bounds.x-r||Math.abs(z)>bounds.z-r||boxes.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);}
function move(p,dx,dz){if(!Number.isFinite(dx)||!Number.isFinite(dz))return;const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.17));for(let i=0;i<n;i++){if(!blocked(p.x+dx/n,p.z))p.x+=dx/n;if(!blocked(p.x,p.z+dz/n))p.z+=dz/n;}}
function step(p,input,dt,speed){const f=(input.forward?1:0)-(input.back?1:0),s=(input.right?1:0)-(input.left?1:0),len=Math.hypot(f,s)||1,pace=speed*1.35*(input.crouch?.46:input.aim?.7:input.walk?.52:1);move(p,(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)*pace*dt/len,(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)*pace*dt/len);}
const soloSpawns=[];for(const x of [-36,-12,12,36])for(const z of [-26,-13,13,26])if(!blocked(x,z,.65))soloSpawns.push({x,z,yaw:Math.atan2(x,z)});return {id,name:maps[id],bounds,boxes,spawns,soloSpawns,groundAt,terrainHit,inSpawn,blocked,move,step};
}
const arena=create();arena.create=create;arena.maps=maps;arena.select=id=>Object.assign(arena,create(id));return arena;
});
