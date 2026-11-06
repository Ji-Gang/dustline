/* CC0 MakeHuman body topology, native skinning and original tactical equipment. */
(()=>{'use strict';
const T=THREE,A=Art,D=window.DustlineHuman,source=new T.BufferGeometry();
source.setAttribute('position',new T.Float32BufferAttribute(D.vertices,3));
source.setAttribute('uv',new T.Float32BufferAttribute(D.uv,2));
source.setAttribute('skinIndex',new T.Uint16BufferAttribute(D.skinIndices,4));
source.setAttribute('skinWeight',new T.Float32BufferAttribute(D.skinWeights,4));
source.setIndex(D.indices);source.computeVertexNormals();
// Average normals across UV seams before adding garment thickness.
const p=source.attributes.position,n=source.attributes.normal,weld=new Map();
for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(6)).join('/');let g=weld.get(key);if(!g){g={ids:[],normal:new T.Vector3()};weld.set(key,g);}g.ids.push(i);g.normal.add(new T.Vector3().fromBufferAttribute(n,i));}
for(const g of weld.values()){g.normal.normalize();for(const i of g.ids)n.setXYZ(i,...g.normal.toArray());}
function handBone(name){return /^(finger|wrist|metacarpal)/.test(name);}
const labels=[];
for(let i=0;i<p.count;i++){
 const name=D.bones[D.skinIndices[i*4]].name,y=p.getY(i),hand=handBone(name);labels.push(hand?1:0);
 const handWeight=D.skinWeights.slice(i*4,i*4+4).reduce((sum,v,j)=>sum+(handBone(D.bones[D.skinIndices[i*4+j]].name)?v:0),0);
 const thickness=(.022+.003*Math.sin(y*65+p.getX(i)*20))*(1-handWeight)+.002*handWeight;
 p.setXYZ(i,p.getX(i)+n.getX(i)*thickness,p.getY(i)+n.getY(i)*thickness,p.getZ(i)+n.getZ(i)*thickness);
}
const groups=[[],[]];
for(let i=0;i<D.indices.length;i+=3){const ids=D.indices.slice(i,i+3);if(ids.some(v=>D.vertices[v*3+1]>1.47||D.vertices[v*3+1]<.14))continue;groups[ids.filter(v=>labels[v]===1).length>=2?1:0].push(...ids);}
source.setIndex(groups.flat());source.addGroup(0,groups[0].length,0);source.addGroup(groups[0].length,groups[1].length,1);source.computeVertexNormals();source.computeBoundingSphere();
const outfits=new Map();
function combineOutfit(root,body,weapon,bones,team){
 const meshes=[];root.traverse(o=>{if(!o.isMesh)return;for(let a=o;a;a=a.parent)if(a===weapon)return;meshes.push(o);});
 let cached=outfits.get(team);
 if(!cached){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),buckets=new Map();
  for(const mesh of meshes){
   const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
   if(!mesh.isSkinnedMesh){let parent=mesh.parent;while(parent&&!parent.isBone)parent=parent.parent;const index=parent?bones.indexOf(parent):D.bones.findIndex(b=>b.name==='root'),indices=new Uint16Array(geo.attributes.position.count*4),weights=new Float32Array(indices.length);for(let i=0;i<indices.length;i+=4){indices[i]=index;weights[i]=1;}geo.setAttribute('skinIndex',new T.BufferAttribute(indices,4));geo.setAttribute('skinWeight',new T.BufferAttribute(weights,4));}
   const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material],groups=geo.groups.length?geo.groups:[{start:0,count:geo.attributes.position.count,materialIndex:0}];
   for(const group of groups){const mat=mats[group.materialIndex];let bucket=buckets.get(mat);if(!bucket){bucket=[];buckets.set(mat,bucket);}bucket.push({geo,start:group.start,count:group.count});}
  }
  const geometry=new T.BufferGeometry(),materials=[...buckets.keys()],size=[...buckets.values()].flat().reduce((sum,g)=>sum+g.count,0),attrs={position:[3,Float32Array],normal:[3,Float32Array],uv:[2,Float32Array],skinIndex:[4,Uint16Array],skinWeight:[4,Float32Array]};
  for(const [name,[itemSize,Type]] of Object.entries(attrs)){const data=new Type(size*itemSize);let offset=0;for(const parts of buckets.values())for(const part of parts){const a=part.geo.attributes[name];if(a)data.set(a.array.subarray(part.start*itemSize,(part.start+part.count)*itemSize),offset*itemSize);offset+=part.count;}geometry.setAttribute(name,new T.BufferAttribute(data,itemSize));}
  let offset=0;for(const [i,parts] of [...buckets.values()].entries()){const count=parts.reduce((sum,p)=>sum+p.count,0);geometry.addGroup(offset,count,i);offset+=count;}
  for(const g of new Set([...buckets.values()].flat().map(p=>p.geo)))g.dispose();
  geometry.computeBoundingSphere();geometry.userData.shared=true;cached={geometry,materials};outfits.set(team,cached);
 }
 for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}
 const combined=new T.SkinnedMesh(cached.geometry,cached.materials);combined.castShadow=combined.receiveShadow=true;combined.frustumCulled=false;root.add(combined);root.updateMatrixWorld(true);combined.bind(body.skeleton);return combined;
}
function create(team){
 const base=A.createEquipmentOperator(team),root=base.root,m=A.mats;
 const discard=[];root.traverse(o=>{if(o.isMesh&&(o.material===m.cloth||o.material===m.enemycloth))discard.push(o);});
 for(const o of discard){o.removeFromParent();o.geometry.dispose();}
 for(const arm of base.arms){arm.removeFromParent();arm.traverse(o=>{if(o.isMesh)o.geometry.dispose();});}
 for(const leg of base.legs){const hidden=[];leg.traverse(o=>{if(o.isMesh&&(o.material===m.leather||o.material===m.rubber))hidden.push(o);});for(const o of hidden){o.removeFromParent();o.geometry.dispose();}}
 const bones=D.bones.map(b=>{const bone=new T.Bone();bone.name=b.name;bone.position.fromArray(b.head);if(b.parent>=0)bone.position.sub(new T.Vector3(...D.bones[b.parent].head));return bone;});
 D.bones.forEach((b,i)=>{if(b.parent>=0)bones[b.parent].add(bones[i]);else root.add(bones[i]);});
 const skeleton=new T.Skeleton(bones),body=new T.SkinnedMesh(source.clone(),[team==='attacker'?m.uniformBlue:m.uniformRed,m.glove]);body.castShadow=body.receiveShadow=true;body.frustumCulled=false;root.add(body);root.updateMatrixWorld(true);body.bind(skeleton);
 const lookup=new Map(bones.map((b,i)=>[b.name,{bone:b,data:D.bones[i]}]));
 function bindAccessory(object,name){root.updateMatrixWorld(true);lookup.get(name).bone.attach(object);}
 bindAccessory(base.torso,'spine01');bindAccessory(base.head,'head');
 for(let i=0;i<2;i++){
  const leg=base.legs[i],side=i===0?'R':'L',sign=i===0?-1:1,knee=leg.children.find(c=>c.type==='Group');
  if(knee){knee.position.x+=sign*.047;bindAccessory(knee,'lowerleg01.'+side);}bindAccessory(leg,'upperleg01.'+side);
  const boot=A.createBoot();boot.position.set(sign*.232,0,0);root.add(boot);bindAccessory(boot,'foot.'+side);
 }
 base.weapon.group.position.set(.10,1.26,-.19);base.weapon.group.scale.setScalar(.82);
 const outfit=combineOutfit(root,body,base.weapon.group,bones,team);
 const temp=new T.Vector3(),direction=new T.Vector3();
 function aimBone(name,target,endName){
  const {bone,data}=lookup.get(name);bone.parent.updateWorldMatrix(true,false);
  temp.copy(target);root.localToWorld(temp);bone.parent.worldToLocal(temp).sub(bone.position);
  direction.fromArray(endName?lookup.get(endName).data.head:data.tail).sub(new T.Vector3(...data.head));
  bone.quaternion.setFromUnitVectors(direction.normalize(),temp.normalize());bone.updateWorldMatrix(false,true);
 }
 for(const side of ['L','R']){
  const sign=side==='L'?1:-1;
  aimBone('upperarm01.'+side,new T.Vector3(sign*.28,1.20,.01),'lowerarm01.'+side);
  aimBone('lowerarm01.'+side,new T.Vector3(side==='R'?.09:-.025,1.19,side==='R'?-.20:-.43),'wrist.'+side);
  for(let finger=1;finger<=5;finger++)for(let joint=1;joint<=3;joint++){const entry=lookup.get('finger'+finger+'-'+joint+'.'+side);if(entry)entry.bone.rotation.y=sign*(finger===1?.25:.7);}
 }
 const shoulders=['L','R'].map(s=>lookup.get('upperarm01.'+s).bone),rest=shoulders.map(b=>b.quaternion.clone()),pitchRotation=new T.Quaternion(),pitchAxis=new T.Vector3(1,0,0);
 function animate(t,speed,pitch=0){
  pitchRotation.setFromAxisAngle(pitchAxis,pitch*.7);shoulders.forEach((b,i)=>b.quaternion.copy(rest[i]).premultiply(pitchRotation));
  for(const side of ['L','R']){const phase=t*9+(side==='L'?0:Math.PI);lookup.get('upperleg01.'+side).bone.rotation.x=Math.sin(phase)*.42*speed;lookup.get('lowerleg01.'+side).bone.rotation.x=Math.max(0,-Math.sin(phase))*.7*speed;}
  lookup.get('head').bone.rotation.x=pitch;
 }
 animate(0,0,0);root.userData.skinning='MakeHuman CC0';return Object.assign(base,{body:outfit,skeleton,animate});
}
A.createOperator=create;
})();
