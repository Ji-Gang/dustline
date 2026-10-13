/* Shared arena geometry and authoritative movement: metres, mirrored spawns. */
(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f();else root.Arena=f();})(globalThis,()=>{
const bounds={x:40,z:30},boxes=[];
const add=(x,z,w,d,h,kind='wall')=>boxes.push({x,z,w,d,h,kind});
add(-41,0,2,64,8);add(41,0,2,64,8);add(0,-31,84,2,8);add(0,31,84,2,8);
for(const sign of [-1,1]){
 add(-27,sign*19,18,2,5);add(27,sign*19,18,2,5);add(0,sign*19,14,2,5);
 add(-17,sign*8,3,15,6);add(17,sign*8,3,15,6);
 add(-30,sign*5,8,5,2.3,'container');add(30,sign*5,8,5,2.3,'container');
 add(-7,sign*9,4,4,1.55,'crate');add(7,sign*9,4,4,1.55,'crate');
}
add(0,0,9,6,3.5,'machine');add(-24,0,3,3,1.5,'crate');add(24,0,3,3,1.5,'crate');
const spawns={blue:[{x:-4,z:26,yaw:0},{x:4,z:26,yaw:0}],red:[{x:4,z:-26,yaw:Math.PI},{x:-4,z:-26,yaw:Math.PI}]};
for(let i=2;i<8;i++){const x=[-12,12,-20,20,-28,28][i-2];spawns.blue.push({x,z:26,yaw:0});spawns.red.push({x:-x,z:-26,yaw:Math.PI});}
// Cabinets and columns previously had visuals but no solid collision.
for(const sign of [-1,1])for(const x of [-12,12])add(x,sign*29.3,4,1.2,2.2,'collisionOnly');
for(const z of [-15,0,15])for(const x of [-39,39])add(x,z,.65,.65,8.8,'collisionOnly');
function inSpawn(p){return p.team==='blue'?p.z>=22:p.z<=-22;}
function blocked(x,z,r=.38){return Math.abs(x)>bounds.x-r||Math.abs(z)>bounds.z-r||boxes.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);}
function move(p,dx,dz){if(!Number.isFinite(dx)||!Number.isFinite(dz))return;const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.17));for(let i=0;i<n;i++){if(!blocked(p.x+dx/n,p.z))p.x+=dx/n;if(!blocked(p.x,p.z+dz/n))p.z+=dz/n;}}
function step(p,input,dt,speed){const f=(input.forward?1:0)-(input.back?1:0),s=(input.right?1:0)-(input.left?1:0),len=Math.hypot(f,s)||1,pace=speed*1.35*(input.crouch?.46:input.aim?.7:input.walk?.52:1);move(p,(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)*pace*dt/len,(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)*pace*dt/len);}
return {name:'FOUNDRY / 铸造工坊',bounds,boxes,spawns,inSpawn,blocked,move,step};
});
