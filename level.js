/* Dust II-inspired architecture. Walk surfaces and solid geometry share map.js data. */
(() => {
'use strict';
const T=THREE,A=Art,C=Tactical,cache=new Map();let seed=9017;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function surface(kind,color){const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const g=canvas.getContext('2d');g.fillStyle=color;g.fillRect(0,0,1024,1024);
  if(kind==='stone'||kind==='paving'){const row=kind==='stone'?128:85;for(let y=0;y<1024;y+=row){const offset=(Math.floor(y/row)%2)*95;for(let x=-200;x<1024;x+=190){const tone=Math.round(rand()*35);g.fillStyle=`rgba(${tone>17?255:0},${tone>17?255:0},${tone>17?255:0},${.02+rand()*.07})`;g.fillRect(x+offset+4,y+4,183,row-8);g.lineWidth=5;g.strokeStyle='#493c3040';g.strokeRect(x+offset,y,190,row);g.lineWidth=2;g.strokeStyle='#f5e7c52b';g.strokeRect(x+offset+5,y+5,180,row-10);}}}
  for(let i=0;i<95000;i++){const v=rand()>.48?255:0;g.fillStyle=`rgba(${v},${v},${v},${rand()*.12})`;const n=.5+rand()*2.8;g.fillRect(rand()*1024,rand()*1024,n,n);}
  for(let i=0;i<170;i++){g.fillStyle=`rgba(65,46,26,${rand()*.035})`;g.beginPath();g.ellipse(rand()*1024,rand()*1024,10+rand()*130,8+rand()*70,rand()*6,0,Math.PI*2);g.fill();}
  const tx=new T.CanvasTexture(canvas);tx.colorSpace=T.SRGBColorSpace;tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.anisotropy=8;
  return new T.MeshStandardMaterial({map:tx,bumpMap:tx,bumpScale:kind==='stone'?.038:.012,roughness:.96});
}
function tileBox(g,m,x,y,z,w,h,d){const key=[w,h,d].join('/');let geo=cache.get(key);if(!geo){geo=new T.BoxGeometry(w,h,d);const uv=geo.attributes.uv;for(let face=0;face<6;face++){const u=face<2?d: w,v=face<2?h:face<4?d:h;for(let j=0;j<4;j++){const i=face*4+j;uv.setXY(i,uv.getX(i)*u/2.4,uv.getY(i)*v/2.4);}}cache.set(key,geo);}const mesh=new T.Mesh(geo,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;}
function texturedPlane(g,m,x,y,z,w,h,rotation=0){const mesh=new T.Mesh(new T.PlaneGeometry(w,h),m);mesh.position.set(x,y,z);mesh.rotation.y=rotation;mesh.receiveShadow=true;g.add(mesh);return mesh;}
function bolt(g,x,y,z){const o=A.cyl(g,A.mats.iron,x,y,z,.026,.027);o.rotation.x=Math.PI/2;}
function gateLeaf(parent,wall){const g=new T.Group();g.position.set(wall.x,wall.base||0,wall.z);const side=wall.d>wall.w;g.rotation.y=side?Math.PI/2:0;parent.add(g);const width=side?wall.d:wall.w;
  tileBox(g,A.mats.wood,0,wall.h/2,0,width,wall.h,.5);for(let x=-width/2+.15;x<width/2;x+=.25)A.box(g,A.mats.leather,x,wall.h/2,.257,.016,wall.h-.05,.01);
  for(const y of [.42,1.7,3.05,wall.h-.2]){A.box(g,A.mats.iron,0,y,.272,width-.12,.14,.03);for(let x=-width/2+.23;x<width/2-.1;x+=.39)bolt(g,x,y,.296);}
  const handle=new T.Mesh(new T.TorusGeometry(.16,.028,8,24),A.mats.iron);handle.position.set(width*.25,1.75,.36);g.add(handle);A.box(g,A.mats.iron,width*.25,1.89,.31,.21,.3,.025);
}
function arch(g,width,spring,rise,depth,material){const shape=new T.Shape();for(let i=0;i<=36;i++){const a=i*Math.PI/36,x=Math.cos(a)*(width/2+.34),y=spring+Math.sin(a)*(rise+.34);i?shape.lineTo(x,y):shape.moveTo(x,y);}for(let i=36;i>=0;i--){const a=i*Math.PI/36;shape.lineTo(Math.cos(a)*width/2,spring+Math.sin(a)*rise);}shape.closePath();const geom=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,curveSegments:20});geom.translate(0,0,-depth/2);const o=new T.Mesh(geom,material);o.castShadow=o.receiveShadow=true;g.add(o);for(let i=0;i<18;i++){const a=(i+.5)*Math.PI/18;const mesh=A.box(g,A.mats.stone,Math.cos(a)*(width/2+.15),spring+Math.sin(a)*(rise+.15),depth/2+.012,.03,.28,.028);mesh.rotation.z=-a;}}
function facadeDetail(parent,width,height,mat,style){const M=A.mats;
  for(let x=-width/2+1.8;x<width/2-1.1;x+=3.6){for(let y=3.4;y<height-1.2;y+=3.7){tileBox(parent,M.stone,x,y,0,1.74,2.10,.19);A.box(parent,M.black,x,y,.11,1.40,1.73,.08);for(const side of [-1,1]){tileBox(parent,style==='hotel'?M.blue:M.wood,x+side*.37,y,.19,.65,1.61,.1);for(let j=0;j<11;j++)A.box(parent,M.iron,x+side*.37,y-.7+j*.14,.26,.56,.025,.025);}tileBox(parent,M.stone,x,y-1.1,.25,1.96,.16,.65);
      if(y>6&&rand()>.58){tileBox(parent,M.stone,x,y-1.17,.49,2.25,.17,1.15);for(let dx=-1;dx<=1;dx+=.2)A.rod(parent,M.iron,[x+dx,y-1.05,.99],[x+dx,y-.26,.99],.017);A.rod(parent,M.iron,[x-1.06,y-.24,.99],[x+1.06,y-.24,.99],.028);for(const sign of [-1,1])A.rod(parent,M.iron,[x+sign*1.05,y-.25,.02],[x+sign*1.05,y-.25,.99],.027);}
    }
    // Ground-floor arches, worn door leaves, hinges and handles.
    if(width<40&&rand()>.48){tileBox(parent,M.stone,x,1.2,.05,1.7,2.4,.20);tileBox(parent,M.wood,x,1.13,.19,1.35,2.24,.1);for(let y=.3;y<2.3;y+=.7)A.box(parent,M.iron,x,y,.257,1.24,.045,.025);A.sphere(parent,M.brass,x+.43,1.1,.30,.045,.045,.025);const a=new T.Group();a.position.set(x,0,.05);parent.add(a);arch(a,1.7,2.36,.76,.28,M.stone);}
  }
  for(let y=.25;y<1.4;y+=.38)tileBox(parent,M.stone,0,y,-.01,width,.10,.14);
  for(const sign of [-1,1]){A.rod(parent,M.iron,[sign*(width/2-.22),.2,.17],[sign*(width/2-.22),height-.3,.17],.045);for(let y=.7;y<height;y+=2.5)A.box(parent,M.iron,sign*(width/2-.22),y,.13,.17,.055,.17);}
  for(let i=0;i<Math.min(12,width/2);i++){const x=rand()*width-width/2,y=.35+rand()*1.6;const geo=new T.CircleGeometry(.06+rand()*.15,5);const o=new T.Mesh(geo,M.rose);o.position.set(x,y,.105);o.rotation.z=rand()*6;parent.add(o);}
}
function rooftop(g,b){const m=A.mats;tileBox(g,m.stone,0,b.h+.1,0,b.w+.35,.3,b.d+.35);for(const z of [-b.d/2,b.d/2])tileBox(g,m.plaster2,0,b.h+.55,z,b.w+.25,.8,.27);for(const x of [-b.w/2,b.w/2])tileBox(g,m.plaster2,x,b.h+.55,0,.27,.8,b.d);
  const x=b.w*.18,z=b.d*.1;tileBox(g,m.iron,x,b.h+.57,z,1.7,.85,1.15);for(let i=0;i<9;i++)A.box(g,m.steel,x-.68+i*.17,b.h+.6,z+.59,.045,.58,.015);A.rod(g,m.iron,[x+.65,b.h+.25,z],[x+.65,b.h+.25,z+1],.07);
  const dish=new T.Mesh(new T.SphereGeometry(.67,24,12,0,Math.PI*2,0,.95),m.white);dish.position.set(-b.w*.22,b.h+1.2,z);dish.rotation.x=.95;g.add(dish);A.rod(g,m.iron,[-b.w*.22,b.h,z],[-b.w*.22,b.h+1.3,z],.035);A.rod(g,m.iron,[-b.w*.22,b.h+1.25,z],[-b.w*.22,b.h+1.5,z+.6],.02);
  A.rod(g,m.iron,[0,b.h,0],[0,b.h+3.2,0],.035);for(let y=b.h+1.8;y<b.h+3;y+=.4)A.rod(g,m.iron,[-.8,y,0],[.8,y,0],.012);
}
function building(parent,b,materials){const g=new T.Group();g.position.set(b.x,0,b.z);parent.add(g);const material=b.style==='kasbah'?materials.stone:b.style==='hotel'?materials.white:materials.plaster;tileBox(g,material,0,b.h/2,0,b.w,b.h,b.d);tileBox(g,A.mats.stone,0,.35,0,b.w+.08,.7,b.d+.08);
  const sides=[{x:0,z:b.d/2,w:b.w,r:0},{x:0,z:-b.d/2,w:b.w,r:Math.PI},{x:b.w/2,z:0,w:b.d,r:Math.PI/2},{x:-b.w/2,z:0,w:b.d,r:-Math.PI/2}];
  for(const s of sides){const face=new T.Group();face.position.set(s.x,0,s.z);face.rotation.y=s.r;g.add(face);facadeDetail(face,s.w,b.h,material,b.style);}
  rooftop(g,b);
  if(b.style==='kasbah'){for(const x of [-b.w/2+.6,b.w/2-.6])for(const z of [-b.d/2+.6,b.d/2-.6]){tileBox(g,materials.stone,x,b.h-.9,z,1.5,2.9,1.5);for(const dx of [-.48,.48])tileBox(g,materials.stone,x+dx,b.h+.75,z,.34,.65,1.5);}}
  return g;
}
function cargo(g,p){const M=A.mats,y=C.groundHeight(p.x,p.z);tileBox(g,M.crate,p.x,y+p.h/2,p.z,p.w,p.h,p.d);for(const z of [-p.d/2,p.d/2]){for(const x of [-p.w/2+.13,p.w/2-.13]){tileBox(g,M.wood,p.x+x,y+p.h/2,p.z+z,.18,p.h,.13);for(let yy=.2;yy<p.h;yy+=.55)bolt(g,p.x+x,y+yy,p.z+z+.08);}for(const yy of [.12,p.h-.12])tileBox(g,M.wood,p.x,y+yy,p.z+z,p.w,.18,.13);for(let xx=-p.w/2+.4;xx<p.w/2;xx+=.45)A.box(g,M.leather,p.x+xx,y+p.h/2,p.z+z+.045,.016,p.h-.15,.018);}
  for(const x of [-p.w/2,p.w/2])for(const yy of [.12,p.h-.12])tileBox(g,M.wood,p.x+x,y+yy,p.z,.12,.17,p.d);
  A.label(g,'↑  FRAGILE',p.x,y+p.h*.62,p.z+p.d/2+.08,Math.min(p.w*.55,1.25),.35,'#d6c7a2','#7f7153');
}
function barrel(g,x,y,z){const M=A.mats;const geom=new T.CylinderGeometry(.42,.44,1.16,32,1);const o=new T.Mesh(geom,M.blue);o.position.set(x,y+.58,z);o.castShadow=o.receiveShadow=true;g.add(o);for(const h of [.08,.38,.83,1.11]){const ring=new T.Mesh(new T.TorusGeometry(.443,.022,6,32),M.iron);ring.rotation.x=Math.PI/2;ring.position.set(x,y+h,z);g.add(ring);}A.cyl(g,M.iron,x+.17,y+1.17,z+.12,.075,.025);A.label(g,'OIL',x,y+.64,z+.448,.4,.21,'#d8cf9f','#61706c');}
function car(parent,p){const g=new T.Group();g.position.set(p.x,C.groundHeight(p.x,p.z),p.z);parent.add(g);const M=A.mats,paint=new T.MeshStandardMaterial({color:p.x>0?'#8caaa4':'#9b927a',roughness:.79,metalness:.3});tileBox(g,paint,0,.55,0,2.5,.57,4.65);tileBox(g,M.black,0,.26,0,2.35,.18,4.3);tileBox(g,paint,0,.94,-.05,2.02,.62,2.1);tileBox(g,M.glass,0,1.03,-1.10,1.85,.45,.018);tileBox(g,M.glass,0,1.03,1.01,1.82,.42,.018);
  for(const side of [-1,1]){for(const z of [-.55,.48]){tileBox(g,M.glass,side*1.02,1.04,z,.025,.39,.86);tileBox(g,M.iron,side*1.04,.60,z,.018,.37,.95);A.box(g,M.steel,side*1.075,.69,z+.23,.026,.038,.16);}A.box(g,paint,side*1.23,.91,-.76,.26,.15,.32);for(const z of [-1.47,1.45]){const tire=A.cyl(g,M.rubber,side*1.19,.38,z,.39,.21);tire.rotation.z=Math.PI/2;const hub=A.cyl(g,M.steel,side*1.31,.38,z,.23,.028);hub.rotation.z=Math.PI/2;for(let i=0;i<12;i++){const a=i*Math.PI/6;const spoke=A.box(g,M.iron,side*1.33,.38+Math.sin(a)*.13,z+Math.cos(a)*.13,.025,.06,.025);spoke.rotation.x=-a;}for(let i=0;i<24;i++){const a=i*Math.PI/12;const tread=A.box(g,M.black,side*1.19,.38+Math.sin(a)*.389,z+Math.cos(a)*.389,.2,.025,.09);tread.rotation.x=a;}}}
  for(const z of [-2.37,2.37]){tileBox(g,M.steel,0,.47,z,2.4,.12,.12);for(const side of [-1,1])tileBox(g,z<0?M.white:M.red,side*.85,.73,z,.47,.19,.022);tileBox(g,M.iron,0,.75,z,1.05,.17,.025);for(let x=-.45;x<.5;x+=.09)A.box(g,M.black,x,.75,z-.015,.035,.13,.024);}
  for(let x=-.8;x<.9;x+=.25){A.rod(g,M.iron,[x,.96,-1.115],[x+.15,1.14,-1.116],.006);}A.box(g,M.black,0,.92,-.55,1.65,.13,.35);const steering=new T.Mesh(new T.TorusGeometry(.21,.023,6,24),M.rubber);steering.position.set(-.51,1.1,-.49);steering.rotation.x=.5;g.add(steering);
}
function terrain(g,s,materials){const x0=s.x-s.w/2,x1=s.x+s.w/2,z0=s.z-s.d/2,z1=s.z+s.d/2;const localHeight=(x,z)=>{let t=s.axis==='x'?(x-x0)/s.w:(z-z0)/s.d;if(s.reverse)t=1-t;return s.y+(s.axis?s.rise*Math.max(0,Math.min(1,t)):0);};const top=[new T.Vector3(x0,localHeight(x0,z0),z0),new T.Vector3(x0,localHeight(x0,z1),z1),new T.Vector3(x1,localHeight(x1,z1),z1),new T.Vector3(x1,localHeight(x1,z0),z0)];const points=[],uv=[];for(const [a,b,c] of [[0,1,2],[0,2,3]])for(const i of [a,b,c]){points.push(...top[i].toArray());uv.push(top[i].x/3,top[i].z/3);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const o=new T.Mesh(geo,materials.paving);o.receiveShadow=true;g.add(o);
  for(let i=0;i<4;i++){const a=top[i],b=top[(i+1)%4];const v=[a.x,0,a.z,b.x,0,b.z,b.x,b.y,b.z,a.x,0,a.z,b.x,b.y,b.z,a.x,a.y,a.z];const wall=new T.BufferGeometry();wall.setAttribute('position',new T.Float32BufferAttribute(v,3));wall.setAttribute('uv',new T.Float32BufferAttribute([0,0,3,0,3,1,0,0,3,1,0,1],2));wall.computeVertexNormals();g.add(new T.Mesh(wall,materials.stone));}
  // Thin nosings over the collision ramp read as stairs without snagging feet.
  if(s.steps){const n=16;for(let i=1;i<n;i++){const t=i/n;if(s.axis==='z'){const z=z0+s.d*t,y=localHeight(s.x,z);tileBox(g,A.mats.stone,s.x,y+.016,z,s.w,.032,.075);}else{const x=x0+s.w*t,y=localHeight(x,s.z);tileBox(g,A.mats.stone,x,y+.016,s.z,.075,.032,s.d);}}}
}
function buildWorld(scene){seed=9017;const M=A.mats,materials={plaster:surface('plaster','#c3ad87'),white:surface('plaster','#d6c9aa'),stone:surface('stone','#b19d7a'),paving:surface('paving','#aaa087')};const root=new T.Group();root.name='DustIIRebuild';scene.add(root);const chunks=new Map();function sector(x,z){const key=Math.floor((x+90)/45)+','+Math.floor((z+90)/45);if(!chunks.has(key)){const g=new T.Group();g.name='sector-'+key;root.add(g);chunks.set(key,g);}return chunks.get(key);}
  tileBox(sector(0,0),materials.paving,0,-.19,0,C.MAP.width+.4,.36,C.MAP.depth+.4);
  for(const s of C.SURFACES)terrain(sector(s.x,s.z),s,materials);
  for(const b of C.BUILDINGS)building(sector(b.x,b.z),b,materials);
  for(const wall of C.WALLS){const g=sector(wall.x,wall.z);if(wall.wood)gateLeaf(g,wall);else{tileBox(g,materials.stone,wall.x,(wall.base||0)+wall.h/2,wall.z,wall.w,wall.h,wall.d);tileBox(g,M.stone,wall.x,(wall.base||0)+wall.h+.05,wall.z,wall.w+.12,.1,wall.d+.12);}}
  for(const p of C.PROPS){const g=sector(p.x,p.z);if(p.type==='crate')cargo(g,p);else if(p.type==='car')car(g,p);else{const y=C.groundHeight(p.x,p.z);for(const dx of [-.49,.49])for(const dz of [-.49,.49])barrel(g,p.x+dx,y,p.z+dz);}}
  for(const roof of C.ROOFS)tileBox(sector(roof.x,roof.z),materials.stone,roof.x,roof.base+roof.h/2,roof.z,roof.w,roof.h,roof.d);
  for(const z of [-23,-12,0,13,25,37]){const g=new T.Group();g.position.set(-59,0,z);sector(-59,z).add(g);arch(g,13.3,3.3,2.8,.42,materials.stone);for(const side of [-1,1])tileBox(g,materials.stone,side*6.7,1.7,0,.4,3.4,.7);}
  for(const x of [-48,-37,-25,-14]){const g=new T.Group();g.position.set(x,0,8.5);g.rotation.y=Math.PI/2;sector(x,8.5).add(g);arch(g,6.7,3.8,1.8,.35,materials.stone);}
  for(const [x,z,width,rotation] of [[0,-18,10,0],[53,32,8,Math.PI/2],[-35,-44,10,Math.PI/2],[-59,-27,12,0]]){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;sector(x,z).add(g);arch(g,width,4.6,1.4,1,materials.stone);}
  for(const site of C.SITES){const g=sector(site.x,site.z),y=C.groundHeight(site.x,site.z);const mark=A.label(g,site.id,site.x,y+.025,site.z,4,4,'#ad4b33','#b2a180');mark.rotation.x=-Math.PI/2;const ring=new T.Mesh(new T.RingGeometry(7.55,7.7,64),M.red);ring.rotation.x=-Math.PI/2;ring.position.set(site.x,y+.019,site.z);g.add(ring);}
  // Site-specific landmarks and navigation graphics.
  A.label(sector(53,-65),'HOTEL AURORE',53,9.1,-65.93,13,1.45,'#e5ddc8','#437780');
  A.label(sector(53,-65),'★ ★ ★ ★',53,7.1,-65.91,5,.6,'#b5924e','#d9ceb0');
  A.label(sector(-55,-65),'KASBAH  /  B',-55,7,-65.94,7,1.2,'#e3d0a4','#846b46');
  for(const [text,x,z,y,rot] of [['← B',-4,51.06,2,0],['A →',4,51.06,2,0],['A  ↑',51.99,17,3,Math.PI/2],['B  ↑',-65.84,28,2.5,Math.PI/2],['A  →',4.94,-32,3,-Math.PI/2],['← B',-9.98,-25,2.8,Math.PI/2]])A.label(sector(x,z),text,x,y,z,2.4,1.1,'#bb5237','#c2b28c',rot);
  for(const [team,color] of [['attacker','#d7a15c'],['defender','#6fbad0']]){const p=C.SPAWNS[team][0],sign=A.label(sector(p.x,p.z),team==='attacker'?'T SPAWN':'CT SPAWN',p.x,.021,p.z,7,2,color,'#a69a80');sign.rotation.x=-Math.PI/2;}
  // Scaffolding next to B window, including clamps, braces, planks and tarp.
  const scaffold=sector(-32,-58);for(const x of [-33,-30])for(const z of [-61,-54]){A.rod(scaffold,M.iron,[x,0,z],[x,6,z],.032);for(let y=1;y<6;y+=1.8){A.rod(scaffold,M.iron,[x,y,-61],[x,y,-54],.027);A.box(scaffold,M.steel,x,y,z,.09,.09,.09);}}for(let i=0;i<6;i++)tileBox(scaffold,M.wood,-31.5,3.5,-60.7+i*1.2,3,.09,1.1);A.rod(scaffold,M.iron,[-33,.2,-61],[-30,5.8,-54],.023);
  // Road drains, inset paving edges and debris kept small enough not to affect movement.
  for(let z=-9;z<26;z+=6){tileBox(sector(66,z),M.iron,60.2,.025,z,.62,.04,1.5);for(let k=0;k<8;k++)A.box(sector(66,z),M.black,60.2,.05,z-.63+k*.18,.5,.014,.045);}
  for(const [x,z,h] of [[-72,57,9],[-72,-63,9],[73,63,10],[72,-62,9],[10,76,8]]){const g=sector(x,z);A.palm(g,x,z,h);}
  // Rooftop cables stay above the playable routes.
  for(const [a,b] of [[[-73,13,45],[-17,12,62]],[[-9,12,42],[27,13,28]],[[28,13,19],[74,14,21]],[[-34,11,-48],[6,13,-62]]]){const points=[new T.Vector3(...a),new T.Vector3((a[0]+b[0])/2,(a[1]+b[1])/2-1.8,(a[2]+b[2])/2),new T.Vector3(...b)];sector(a[0],a[2]).add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),30,.018,4,false),M.black));}
  for(let i=0;i<420;i++){const x=rand()*146-73,z=rand()*140-70;if(C.blocked(x,z,C.createColliders(),.7))continue;const y=C.groundHeight(x,z),o=A.box(sector(x,z),i%5?M.stone:M.rose,x,y+.025,z,.045+rand()*.12,.05,.05+rand()*.1);o.rotation.y=rand()*6;}
  for(const z of [-7,18,34]){const light=new T.PointLight('#ffd9a1',20,13,2);light.position.set(-59,4.6,z);scene.add(light);const lamp=sector(-59,z);A.box(lamp,M.iron,-65.8,3.8,z,.23,.42,.2);A.box(lamp,M.redLight,-65.65,3.8,z,.19,.31,.16);}
  // Outer skyline is detailed but not navigable.
  for(let i=0;i<24;i++){const x=-111+i*10,h=10+rand()*16,g=sector(x,-91);tileBox(g,materials.plaster,x,h/2,-94,8,h,12);tileBox(g,materials.stone,x,h,-94,8.4,.3,12.4);if(i%4===0){A.cyl(g,materials.stone,x,h+2,-94,1.7,4);A.sphere(g,materials.white,x,h+4,-94,1.9,1.3,1.9);}}
  let pieces=0;root.traverse(o=>{if(o.isMesh)pieces++;});for(const g of chunks.values())A.bake(g);root.userData.sourceParts=pieces;
  const sky=new T.Mesh(new T.SphereGeometry(430,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#79a5b5')},bottom:{value:new T.Color('#e3d6b8')}},vertexShader:'varying vec3 pos;void main(){pos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 pos;void main(){float h=clamp(normalize(pos).y*1.8,0.,1.);gl_FragColor=vec4(mix(bottom,top,h),1.);}'}));scene.add(sky);return root;
}
A.buildWorld=buildWorld;
})();
