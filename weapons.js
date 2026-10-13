/* Detailed original weapon meshes. Modeled parts are merged by material except moving assemblies. */
(() => {
'use strict';
const T=THREE,A=Art,geometryCache=new Map(),marks=new Map();
function roundedGeometry(w,h,d,r=.004){const key=[w,h,d,r].join('/');if(geometryCache.has(key))return geometryCache.get(key);r=Math.min(r,w/4,h/4,d/4);const shape=new T.Shape();shape.moveTo(-w/2+r,-h/2+r);shape.lineTo(w/2-r,-h/2+r);shape.lineTo(w/2-r,h/2-r);shape.lineTo(-w/2+r,h/2-r);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:d-2*r,steps:1,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3,curveSegments:3});g.translate(0,0,-d/2+r);geometryCache.set(key,g);return g;}
function mesh(parent,g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
function round(parent,m,x,y,z,w,h,d,r=.004){return mesh(parent,roundedGeometry(w,h,d,r),m,x,y,z);}
function profile(parent,m,points,width){const s=new T.Shape();points.forEach(([z,y],i)=>i?s.lineTo(z,y):s.moveTo(z,y));s.closePath();const g=new T.ExtrudeGeometry(s,{depth:width-.008,steps:1,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:3});g.rotateY(-Math.PI/2);g.translate(width/2-.004,0,0);return mesh(parent,g,m);}
function ring(parent,m,x,y,z,r=.022,tube=.003){return mesh(parent,new T.TorusGeometry(r,tube,8,32),m,x,y,z);}
function materialSetup(){const m=A.mats;if(m.machined)return;const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#b5b5b5';g.fillRect(0,0,256,256);for(let i=0;i<900;i++){const v=(i*73)%255;g.strokeStyle=`rgba(${v},${v},${v},0.14)`;g.beginPath();g.moveTo(i*31%256,i*97%256);g.lineTo((i*31%256)+2+i%13,i*97%256);g.stroke();}const tx=new T.CanvasTexture(c);tx.wrapS=tx.wrapT=T.RepeatWrapping;
  m.machined=new T.MeshStandardMaterial({color:'#465059',roughness:.4,metalness:.82,bumpMap:tx,bumpScale:.0007});
  m.phosphate=new T.MeshStandardMaterial({color:'#28323a',roughness:.62,metalness:.65,bumpMap:tx,bumpScale:.001});
  m.polymer=new T.MeshStandardMaterial({color:'#28312e',roughness:.92,bumpMap:tx,bumpScale:.002});
  m.fde=new T.MeshStandardMaterial({color:'#9e8b61',roughness:.76,bumpMap:tx,bumpScale:.001});
  m.lens=new T.MeshStandardMaterial({color:'#256a73',metalness:.78,roughness:.12});
  m.clearMag=new T.MeshStandardMaterial({color:'#655c42',roughness:.4,transparent:true,opacity:.65,depthWrite:false});
}
function engraving(parent,id,x,y,z){if(!marks.has(id)){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.clearRect(0,0,512,128);g.fillStyle='#a2aca5';g.font='bold 36px monospace';g.fillText(Tactical.WEAPONS[id].name,12,46);g.font='19px monospace';g.fillText('DUSTLINE  /  024-718',12,85);g.fillText('SAFE  •  FIRE',12,115);const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;marks.set(id,new T.MeshStandardMaterial({map:tx,transparent:true,depthWrite:false,roughness:.65,polygonOffset:true,polygonOffsetFactor:-1}));}const o=mesh(parent,new T.PlaneGeometry(.18,.045),marks.get(id),x,y,z);o.rotation.y=Math.PI/2;}
function screw(parent,x,y,z){const m=A.mats;const head=mesh(parent,new T.CylinderGeometry(.006,.006,.003,6),m.steel,x,y,z);head.rotation.z=Math.PI/2;round(parent,m.black,x+.002,y,z,.001,.002,.008,.0003);}
function rail(parent,z0,z1,y,width=.09){const m=A.mats;round(parent,m.phosphate,0,y,z0+(z1-z0)/2,width,.018,Math.abs(z1-z0));for(let z=z0;z>z1;z-=.024)round(parent,m.machined,0,y+.014,z,width+.014,.013,.014,.0015);}
function optic(parent,z=-.2,scope=false){const m=A.mats;if(scope){for(const zz of [z+.12,z-.12]){round(parent,m.phosphate,0,.135,zz,.06,.08,.033);ring(parent,m.phosphate,0,.2,zz,.045,.005);}A.rod(parent,m.phosphate,[0,.2,z+.2],[0,.2,z-.24],.038);A.rod(parent,m.machined,[0,.2,z-.18],[0,.2,z-.3],.057);mesh(parent,new T.CircleGeometry(.047,32),m.lens,0,.2,z-.301).rotation.y=Math.PI;ring(parent,m.machined,0,.2,z-.3,.052,.005);A.cyl(parent,m.phosphate,0,.255,z,.021,.034);const side=A.cyl(parent,m.phosphate,.05,.2,z,.019,.032);side.rotation.z=Math.PI/2;for(let i=0;i<20;i++){const a=i*Math.PI/10;round(parent,m.machined,Math.cos(a)*.021,.266,z+Math.sin(a)*.021,.004,.012,.004,.0008);}}else{profile(parent,m.phosphate,[[-.26,.10],[-.26,.22],[-.19,.24],[-.15,.2],[-.15,.10]],.072);round(parent,m.black,0,.17,-.206,.051,.077,.064);round(parent,m.lens,0,.176,-.24,.049,.058,.003);round(parent,m.redLight,0,.17,-.243,.003,.003,.002,.0005);}}
function barrel(parent,tip,start=-.45,r=.018,suppress=false){const m=A.mats;A.rod(parent,m.machined,[0,.016,start],[0,.016,tip],r);for(const z of [start,tip+.07])ring(parent,m.phosphate,0,.016,z,r+.003,.003);if(suppress){A.rod(parent,m.phosphate,[0,.016,tip+.03],[0,.016,tip-.18],r+.015);for(let z=tip+.02;z>tip-.17;z-=.026)ring(parent,m.machined,0,.016,z,r+.015,.0015);tip-=.18;}else{A.rod(parent,m.phosphate,[0,.016,tip+.02],[0,.016,tip-.04],r+.008);for(let i=0;i<3;i++)round(parent,m.black,r+.008,.016,tip-i*.012,.003,.014,.007,.001);tip-=.04;}ring(parent,m.steel,0,.016,tip,r+.004,.003);const bore=mesh(parent,new T.CircleGeometry(r*.73,24),m.black,0,.016,tip+.001);bore.material=m.black;bore.rotation.y=Math.PI;return tip;}
function pistolGrip(parent,z,m){const grip=round(parent,m,0,-.132,z,.075,.205,.092,.012);grip.rotation.x=-.22;for(let row=0;row<8;row++)for(const side of [-1,1])round(parent,A.mats.phosphate,side*.039,-.08-row*.017,z+.009,.005,.008,.053,.001);}
function hands(parent,pistol){const m=A.mats,g=new T.Group();parent.add(g);A.rod(g,m.cloth,[.18,-.42,.32],[.055,-.17,.03],.066);A.sphere(g,m.vest,.035,-.12,-.035,.068,.086,.066);A.rod(g,m.cloth,[-.24,-.42,.31],[-.08,-.09,pistol?-.18:-.45],.064);A.sphere(g,m.vest,-.038,-.09,pistol?-.18:-.45,.068,.07,.09);for(let i=0;i<4;i++){round(g,m.polymer,.077,-.085-i*.021,-.04,.027,.018,.07);round(g,m.polymer,-.057,-.09+i*.018,pistol?-.19:-.45,.096,.014,.031);}round(g,m.black,.08,-.18,.08,.09,.04,.09);round(g,m.glass,.08,-.156,.08,.065,.006,.053);A.bake(g);return g;}
function createWeapon(id,firstPerson=false){materialSetup();const w=Tactical.WEAPONS[id],m=A.mats,group=new T.Group(),body=new T.Group(),magazine=new T.Group(),bolt=new T.Group(),slide=new T.Group(),pump=new T.Group();group.name=id;group.add(body,magazine,bolt,slide,pump);if(w.melee){
 round(body,m.polymer,0,-.08,.015,.065,.08,.23,.01);for(let i=0;i<8;i++)round(body,m.phosphate,0,-.08,.10-i*.024,.071,.086,.01,.002);
 round(body,m.steel,0,-.075,-.12,.14,.024,.028);profile(body,m.machined,[[-.13,-.045],[-.39,-.035],[-.57,-.06],[-.38,-.10],[-.13,-.105]],.022);
 profile(body,m.steel,[[-.15,-.09],[-.38,-.086],[-.57,-.06],[-.38,-.105],[-.15,-.11]],.012);
 for(let i=0;i<6;i++)round(body,m.phosphate,0,-.039,-.15-i*.022,.024,.009,.01,.001);
 screw(body,.036,-.08,.08);screw(body,.036,-.08,-.07);A.bake(body);if(firstPerson){const hand=new T.Group();group.add(hand);A.rod(hand,m.cloth,[.18,-.42,.32],[.025,-.1,.05],.06);A.sphere(hand,m.vest,0,-.09,.025,.062,.065,.085);for(let i=0;i<4;i++)round(hand,m.polymer,.032,-.07,.085-i*.036,.045,.05,.026);A.bake(hand);}
 const muzzle=new T.Object3D(),ejection=new T.Object3D();muzzle.position.z=-.57;group.add(muzzle,ejection);return {group,magazine,bolt,slide,pump,muzzle,ejection,baseMagazine:magazine.position.clone()};
 }const pistol=w.category==='pistol',sniper=w.category==='sniper',bull=['p90','famas','aug'].includes(id),ak=id==='ak',wood=ak||id==='nova'?m.gunwood:m.polymer;
  let tip=-.8,magPos=[0,-.075,-.24],material=['aug','galil','scout'].includes(id)?m.fde:id==='awp'?m.olive:m.phosphate;
  if(pistol){
    const length=id==='deagle'?.34:id==='p250'?.235:.27,width=id==='deagle'?.094:.08;
    profile(body,m.polymer,[[-length,.022],[-length,-.047],[-.15,-.068],[-.08,-.04],[.01,-.038],[.014,.022]],width);
    const front=-length-.025;profile(slide,id==='deagle'?m.steel:m.machined,[[front,.026],[front,.085],[front+.045,.112],[.012,.112],[.022,.087],[.022,.027]],width+.005);
    pistolGrip(body,-.059,id==='p250'?m.fde:m.polymer);magPos=[0,-.16,-.06];round(magazine,m.machined,0,-.028,0,.065,.103,.065);round(magazine,m.polymer,0,-.085,0,.08,.018,.088);
    for(let i=0;i<9;i++)for(const side of [-1,1])round(slide,m.black,side*(width/2+.002),.066,-.08+i*.009,.003,.045,.003,.0005);
    round(slide,m.black,width/2+.005,.052,-.19,.002,.043,.07);round(slide,m.steel,width/2+.007,.052,-.18,.003,.028,.043);
    round(slide,m.phosphate,0,.12,front+.035,.023,.018,.02);round(slide,m.phosphate,0,.12,-.02,.07,.018,.018);for(const x of [-.025,.025])round(slide,m.white,x,.122,-.009,.006,.006,.003,.001);
    tip=barrel(body,front-.01,front+.12,.015,w.suppressed);round(body,m.phosphate,.05,-.01,-.018,.009,.019,.065);round(body,m.phosphate,.052,-.05,-.075,.012,.02,.021);
  }else if(id==='p90'){
    profile(body,m.polymer,[[.3,.04],[.3,-.18],[.10,-.20],[.00,-.08],[-.20,-.07],[-.24,-.17],[-.40,-.17],[-.48,-.04],[-.57,-.02],[-.57,.065]],.15);
    round(body,m.rubber,0,-.06,.31,.16,.24,.035,.014);pistolGrip(body,-.11,m.polymer);round(body,m.polymer,0,-.04,-.39,.14,.08,.1,.016);A.rod(body,m.polymer,[0,-.04,-.47],[0,-.14,-.36],.025);
    magPos=[0,.103,-.1];round(magazine,m.clearMag,0,0,0,.123,.052,.42,.012);for(let i=0;i<19;i++){const shell=A.cyl(magazine,m.brass,0,.002,-.19+i*.02,.009,.085);shell.rotation.z=Math.PI/2;}
    rail(body,-.34,-.52,.125);optic(body);tip=barrel(body,-.66,-.47,.018,false);
  }else if(bull){
    profile(body,material,[[.31,.065],[.31,-.20],[.11,-.22],[-.03,-.08],[-.43,-.08],[-.48,.025],[-.39,.083]],.14);round(body,m.rubber,0,-.065,.325,.158,.255,.031,.012);
    pistolGrip(body,-.265,m.polymer);magPos=[0,-.105,.085];round(magazine,m.machined,0,-.09,0,.075,.21,.105,.007);for(let i=0;i<4;i++)round(magazine,m.phosphate,.04,-.095,-.036+i*.024,.005,.15,.008);
    if(id==='famas'){A.rod(body,m.phosphate,[0,.08,.05],[0,.215,.02],.019);A.rod(body,m.phosphate,[0,.08,-.39],[0,.215,-.36],.019);round(body,m.phosphate,0,.22,-.17,.087,.035,.43);round(body,m.black,0,.242,-.17,.029,.009,.34);for(const side of [-1,1])A.rod(body,m.machined,[side*.052,-.045,-.5],[side*.075,-.22,-.58],.01);}
    else{optic(body,-.18,true);const grip=round(body,m.polymer,0,-.155,-.43,.072,.23,.075,.013);grip.rotation.x=.13;}
    tip=barrel(body,id==='famas'?-.85:-.83,-.45,.018,false);
  }else if(id==='nova'){
    profile(body,m.machined,[[-.38,.072],[.04,.067],[.07,-.06],[-.30,-.08],[-.39,-.01]],.105);
    profile(body,wood,[[.05,.045],[.21,-.035],[.46,-.058],[.46,-.23],[.34,-.20],[.12,-.13],[.055,-.075]],.11);round(body,m.rubber,0,-.14,.47,.13,.18,.024,.01);
    tip=barrel(body,-1.10,-.3,.023,false);A.rod(body,m.phosphate,[0,-.05,-.29],[0,-.05,-.94],.024);round(pump,m.polymer,0,-.03,-.55,.095,.11,.24,.014);for(let i=0;i<12;i++)ring(pump,m.machined,0,-.028,-.45-i*.018,.052,.0025);
    magazine.visible=false;magPos=[0,-.05,-.6];for(let i=0;i<5;i++){A.rod(body,m.red,[-.068,-.018,.0-i*.04],[-.068,.052,.0-i*.04],.014);A.rod(body,m.brass,[-.068,.049,.0-i*.04],[-.068,.061,.0-i*.04],.014);}
    round(body,m.redLight,0,.046,-1.07,.008,.014,.01,.002);
  }else if(sniper){
    profile(body,material,[[.40,.02],[.40,-.16],[.18,-.18],[.09,-.04],[-.19,-.08],[-.35,-.06],[-.57,.017],[-.56,.055]],.115);
    round(body,m.rubber,0,-.075,.42,.13,.20,.033,.012);round(body,material,0,.045,.23,.115,.07,.22,.014);pistolGrip(body,-.05,m.polymer);
    A.rod(body,m.machined,[0,.055,-.45],[0,.055,.0],.035);magPos=[0,-.077,-.22];round(magazine,m.machined,0,-.025,0,.085,.09,.125,.006);
    tip=barrel(body,id==='awp'?-1.18:-1.01,-.37,id==='awp'?.024:.017,false);optic(body,-.20,true);
    A.rod(bolt,m.steel,[.045,.04,-.02],[.11,-.012,-.02],.012);A.sphere(bolt,m.polymer,.115,-.02,-.02,.025,.025,.025);
    for(const s of [-1,1]){A.rod(body,m.phosphate,[s*.055,-.04,-.52],[s*.14,-.32,-.60],.013);round(body,m.rubber,s*.14,-.33,-.6,.06,.035,.055);}
    if(id==='scout'){round(body,m.black,0,-.06,.27,.045,.06,.20);for(let i=0;i<4;i++)round(body,m.black,.06,-.018,-.35-i*.044,.007,.026,.025);}
  }else{
    const heavy=id==='m249',smg=w.category==='smg',length=heavy?.53:smg?.33:.42,receiverWidth=heavy?.145:.112;
    profile(body,material,[[-length,.035],[-length,.073],[.015,.083],[.06,.025],[.042,-.066],[-.22,-.071],[-.29,-.038]],receiverWidth);
    pistolGrip(body,-.025,m.polymer);
    if(ak){profile(body,wood,[[.05,.045],[.32,-.02],[.34,-.175],[.19,-.14],[.04,-.067]],.097);round(body,m.rubber,0,-.084,.345,.11,.15,.024);}
    else if(id==='ump'){for(const side of [-1,1]){A.rod(body,m.phosphate,[side*.052,.034,.045],[side*.052,.04,.29],.014);A.rod(body,m.phosphate,[side*.052,-.035,.045],[side*.052,-.06,.29],.014);}round(body,m.rubber,0,-.022,.31,.11,.17,.035);}
    else{A.rod(body,m.machined,[0,.017,.045],[0,.017,.29],.029);profile(body,m.polymer,[[.15,.055],[.35,.035],[.37,-.16],[.29,-.17],[.25,-.066],[.14,-.029]],.103);round(body,m.rubber,0,-.059,.377,.122,.20,.027);for(let i=0;i<5;i++)round(body,m.machined,0,-.02,.1+i*.03,.075,.008,.007);}
    const end=heavy?-.82:smg?-.53:-.65;
    round(body,ak?wood:id==='galil'?m.fde:m.polymer,0,.005,-length-.09,heavy?.135:.108,.12,heavy?.27:.22,.012);
    for(let i=0;i<(heavy?9:6);i++)for(const side of [-1,1]){round(body,m.black,side*(heavy?.069:.057),.01,-length+.018-i*.028,.007,.025,.015,.003);if(!ak)round(body,m.machined,side*.06,-.04,-length+.01-i*.028,.008,.008,.018,.002);}
    rail(body,.0,-length,.097,receiverWidth*.78);
    if(!ak&&id!=='mp5')optic(body);
    else{ring(body,m.phosphate,0,.11,end+.02,.02,.004);round(body,m.machined,0,.075,end+.02,.018,.07,.022);round(body,m.machined,0,.121,end+.02,.005,.035,.006);}
    tip=barrel(body,heavy?-.99:smg?-.62:-.88,end+.08,heavy?.023:.018,w.suppressed);
    if(ak){profile(magazine,m.phosphate,[[-.062,.01],[.055,.01],[.06,-.10],[.10,-.21],[.135,-.28],[.033,-.325],[-.02,-.21],[-.058,-.085]],.075);for(const side of [-1,1])for(let i=0;i<3;i++)A.rod(magazine,m.machined,[side*.04,-.035,-.034+i*.036],[side*.04,-.255,.06+i*.032],.003);}
    else if(heavy){magPos=[-.03,-.09,-.26];round(magazine,m.olive,0,-.09,0,.19,.19,.19,.014);for(let i=0;i<11;i++){const z=-.2+i*.021;A.rod(body,m.brass,[-.13,.08,z],[-.07,.08,z],.008);round(body,m.phosphate,-.105,.071,z,.014,.012,.022,.002);}A.rod(body,m.phosphate,[-.03,.16,-.35],[.02,.16,-.53],.014);A.rod(body,m.phosphate,[-.03,.08,-.35],[-.03,.16,-.35],.014);for(const side of [-1,1])A.rod(body,m.machined,[side*.044,-.03,-.76],[side*.13,-.28,-.84],.012);}
    else{const height=smg?.28:.24;profile(magazine,m.machined,[[-.05,0],[.05,0],[.075,-height],[.0,-height-.015]],.077);for(const side of [-1,1])for(let i=0;i<3;i++)round(magazine,m.phosphate,side*.04,-height*.55,-.023+i*.023,.005,height*.65,.006,.001);round(magazine,m.polymer,0,-height-.005,.035,.089,.025,.096);}
    round(body,m.black,receiverWidth/2+.002,.035,-.17,.003,.05,.105);round(bolt,m.steel,receiverWidth/2+.006,.035,-.17,.005,.032,.065);round(bolt,m.phosphate,.092,.04,-.125,.06,.016,.03);
    if(ak){A.rod(body,m.phosphate,[0,.077,-.43],[0,.077,-.7],.017);round(body,wood,0,.068,-.47,.099,.069,.2,.012);}
  }
  // Trigger bow and trigger; small receiver controls, pins, seam lines and markings.
  const gripZ=pistol?-.075:bull?-.265:-.025;const guard=ring(body,m.phosphate,0,-.078,gripZ-.047,.039,.004);guard.rotation.y=Math.PI/2;guard.scale.set(.86,1,1.12);A.rod(body,m.machined,[0,-.042,gripZ-.031],[0,-.085,gripZ-.044],.004);
  for(const z of [-.24,-.095,.007])screw(body,pistol?.044:.060,-.015,z);round(body,m.phosphate,.065,-.033,-.056,.018,.007,.032,.002);
  engraving(body,id,pistol?.049:.073,pistol?-.005:.009,pistol?-.14:-.225);
  magazine.position.set(...magPos);const baseMagazine=magazine.position.clone();
  const muzzle=new T.Object3D();muzzle.position.set(0,.016,tip);group.add(muzzle);
  const ejection=new T.Object3D();ejection.position.set(.09,.05,-.17);group.add(ejection);
  let sourceParts=0;group.traverse(o=>{if(o.isMesh)sourceParts++;});
  for(const part of [body,magazine,bolt,slide,pump])A.bake(part);if(firstPerson)hands(group,pistol);
  group.userData.sourceParts=sourceParts;group.userData.weaponId=id;
  return {group,magazine,muzzle,ejection,bolt,slide,pump,baseMagazine,sourceParts};
}
A.createWeapon=createWeapon;
})();
