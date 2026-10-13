/* Dust II-inspired enlarged tactical layout. Metres; +Z is south / T side. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DustMap=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAP={name:'DUST II / 沙漠灰 · 重建版',width:164,depth:156,minX:-82,maxX:82,minZ:-78,maxZ:78,roundTime:150,speedMultiplier:1.42};
const SPAWNS={
  attacker:[{x:0,z:68,yaw:0},{x:-3,z:67,yaw:0},{x:3,z:67,yaw:0},{x:-5,z:71,yaw:0},{x:5,z:71,yaw:0}],
  defender:[{x:0,z:-53,yaw:Math.PI},{x:-3,z:-52,yaw:Math.PI},{x:3,z:-52,yaw:Math.PI},{x:-5,z:-56,yaw:Math.PI},{x:5,z:-56,yaw:Math.PI}]
};
const SITES=[{id:'A',x:53,z:-49,radius:8},{id:'B',x:-55,z:-49,radius:8}];
const SURFACES=[
  {id:'a-site',x:52,z:-48,w:44,d:32,y:3},
  {id:'short',x:20,z:-14,w:12,d:28,y:3},
  {id:'short-landing',x:30,z:-29,w:24,d:14,y:3},
  {id:'short-ramp',x:20,z:10,w:12,d:20,y:0,axis:'z',rise:3,reverse:true,steps:true},
  {id:'long-ramp',x:67,z:-21,w:14,d:22,y:0,axis:'z',rise:3,reverse:true},
  {id:'ct-stairs',x:20,z:-53,w:20,d:10,y:0,axis:'x',rise:3,steps:true}
];
const BUILDINGS=[
  {id:'west-boundary',x:-80,z:0,w:12,d:156,h:13,style:'kasbah'},
  {id:'east-boundary',x:81,z:0,w:14,d:156,h:12,style:'town'},
  {id:'t-back',x:0,z:82,w:176,d:10,h:11,style:'town'},
  {id:'b-back',x:-55,z:-72,w:48,d:12,h:15,style:'kasbah'},
  {id:'hotel',x:53,z:-73,w:48,d:14,h:17,style:'hotel'},
  {id:'ct-back',x:0,z:-69,w:58,d:16,h:11,style:'town'},
  {id:'t-middle',x:0,z:43,w:18,d:16,h:9,style:'town'},
  {id:'t-west',x:-30,z:49,w:28,d:24,h:11,style:'town'},
  {id:'t-east',x:37,z:48,w:24,d:24,h:10,style:'town'},
  {id:'outside-tunnels',x:-29,z:23,w:30,d:20,h:10,style:'kasbah'},
  {id:'tunnel-block',x:-36,z:-5,w:32,d:20,h:12,style:'kasbah'},
  {id:'mid-west',x:-18,z:-18,w:20,d:26,h:9,style:'town'},
  {id:'mid-to-b',x:-24,z:-34,w:12,d:10,h:8,style:'kasbah'},
  {id:'ct-mid',x:10,z:-32,w:10,d:16,h:9,style:'town'},
  {id:'long-short-divider',x:40,z:7,w:24,d:42,h:11,style:'town'},
  {id:'long-inner-corner',x:57,z:40,w:8,d:8,h:7,style:'town'}
];
const WALLS=[
  {id:'b-south-left',x:-70,z:-27,w:8,d:2,h:7},
  {id:'b-south-right',x:-45,z:-27,w:20,d:2,h:7},
  {id:'b-east-north',x:-35,z:-63,w:2,d:6,h:7},
  {id:'b-window-sill',x:-35,z:-57,w:2,d:6,h:.75},
  {id:'b-window-lintel',x:-35,z:-57,w:2,d:6,h:3.5,base:3.5},
  {id:'b-east-center',x:-35,z:-51.5,w:2,d:5,h:7},
  {id:'b-east-south',x:-35,z:-32.5,w:2,d:11,h:7},
  {id:'mid-gate-west',x:-10,z:-18,w:10,d:2,h:6},
  {id:'mid-gate-east',x:10,z:-18,w:10,d:2,h:6},
  {id:'mid-door-left',x:-3.5,z:-18.6,w:2.8,d:.6,h:4.3,wood:true},
  {id:'mid-door-right',x:3.5,z:-17.4,w:2.8,d:.6,h:4.3,wood:true},
  {id:'long-door-north',x:53,z:29.6,w:.6,d:2.6,h:4.3,wood:true},
  {id:'long-door-south',x:54,z:34.4,w:.6,d:2.6,h:4.3,wood:true},
  {id:'short-parapet',x:13.4,z:-13,w:.65,d:25,h:.85,base:3},
  {id:'short-edge',x:22,z:-36.5,w:9,d:.65,h:.85,base:3},
  {id:'a-backstop',x:73.3,z:-49,w:.6,d:30,h:1.2,base:3},
  {id:'tunnel-west',x:-66.5,z:7,w:1.2,d:61,h:6.5}
];
const PROPS=[
  {type:'crate',x:-12,z:71,w:2.6,d:2.4,h:2.3},
  {type:'crate',x:-5,z:30,w:3,d:3,h:2.8},
  {type:'crate',x:0,z:8,w:3.4,d:3,h:2.3},
  {type:'crate',x:12,z:26,w:2.2,d:2,h:1.2},
  {type:'crate',x:48,z:-48,w:4.6,d:4.2,h:2.8},
  {type:'crate',x:48,z:-55,w:3,d:3,h:1.5},
  {type:'crate',x:35,z:-32,w:3,d:3,h:1.45},
  {type:'crate',x:62,z:-59,w:3,d:2.5,h:1.5},
  {type:'barrels',x:68,z:-58,w:2.2,d:2.2,h:1.3},
  {type:'car',x:68,z:-40,w:2.8,d:5,h:1.2},
  {type:'crate',x:-62,z:-49,w:4.5,d:4.2,h:3.2},
  {type:'crate',x:-46,z:-41,w:4,d:3.5,h:2.8},
  {type:'crate',x:-58,z:-60,w:4,d:3,h:1.3},
  {type:'barrels',x:-44,z:-59,w:2.2,d:2.2,h:1.3},
  {type:'car',x:-69,z:-39,w:2.8,d:5,h:1.2},
  {type:'crate',x:-63,z:19,w:2,d:3,h:2.3},
  {type:'crate',x:-54,z:-13,w:2,d:2,h:1.4},
  {type:'crate',x:-25,z:9,w:2,d:2,h:1.2},
  {type:'barrels',x:69,z:8,w:2.2,d:2.2,h:1.3},
  {type:'crate',x:64,z:29,w:2.4,d:2.4,h:2.6}
];
const ROOFS=[];
for(let z=-20;z<38;z+=10)ROOFS.push({id:'upper-tunnel-roof',x:-59,z,w:14,d:8,h:.6,base:6.4});
ROOFS.push({id:'lower-tunnel-roof',x:-33,z:8.5,w:44,d:7,h:.6,base:5.9});
const LANDMARKS={t:{x:0,z:68},ct:{x:0,z:-53},topMid:{x:-11,z:30},mid:{x:0,z:-9},midDoors:{x:0,z:-18},longDoors:{x:52,z:32},long:{x:66,z:5},short:{x:20,z:-12},upperTunnel:{x:-59,z:16},lowerTunnel:{x:-34,z:8.5},bDoors:{x:-35,z:-44}};
const ROUTES={
  aLong:[{x:18,z:64},{x:19,z:32},{x:57,z:32},{x:65,z:22},{x:66,z:-8},{x:67,z:-34},{x:55,z:-45}],
  aShort:[{x:-12,z:59},{x:-12,z:35},{x:-4,z:22},{x:20,z:22},{x:20,z:2},{x:20,z:-23},{x:30,z:-28},{x:44,z:-40}],
  bTunnel:[{x:-12,z:66},{x:-52,z:66},{x:-58,z:39},{x:-59,z:23},{x:-59,z:0},{x:-59,z:-24},{x:-56,z:-43}],
  bSplit:[{x:-12,z:58},{x:-12,z:36},{x:-5,z:20},{x:-8,z:8},{x:-35,z:8},{x:-59,z:8},{x:-59,z:-24},{x:-51,z:-45}],
  ctA:[{x:9,z:-53},{x:20,z:-53},{x:34,z:-53},{x:53,z:-46}],
  ctB:[{x:-12,z:-48},{x:-29,z:-44},{x:-40,z:-44},{x:-52,z:-48}],
  ctMid:[{x:0,z:-43},{x:0,z:-29},{x:0,z:-23}]
};
function height(x,z){let y=0;for(const s of SURFACES)if(Math.abs(x-s.x)<=s.w/2+.001&&Math.abs(z-s.z)<=s.d/2+.001){let h=s.y;if(s.axis){let t=s.axis==='x'?(x-s.x)/s.w+.5:(z-s.z)/s.d+.5;if(s.reverse)t=1-t;h+=Math.max(0,Math.min(1,t))*s.rise;}y=Math.max(y,h);}return y;}
function zone(x,z){if(z>61&&Math.abs(x)<18)return 'T 出生点';if(z<-43&&z>-62&&Math.abs(x)<10)return 'CT 出生点';if(x>30&&z<-33)return 'A 包点';if(x<-36&&z<-29)return 'B 包点';if(x>56&&z<27)return 'A 大道';if(x>12&&x<29&&z<22)return z<0?'A 小道 / 猫道':'A 小道阶梯';if(x<-50&&z>-27&&z<41)return 'B 洞 / 上层隧道';if(x<-11&&x>-52&&z>4&&z<13)return '下层隧道';if(x>16&&z>27&&z<37)return 'A 大门';if(z<-36)return 'CT 连接路';if(z<-13&&Math.abs(x)<8)return '中门';if(Math.abs(x)<15&&z<35)return '中路';return 'T 外侧 / 转点通道';}
return {MAP,SPAWNS,SITES,SURFACES,BUILDINGS,WALLS,PROPS,ROOFS,LANDMARKS,ROUTES,height,zone};
});
