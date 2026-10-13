'use strict';
const crypto=require('node:crypto'),zlib=require('node:zlib'),mqtt=require('mqtt');
const ROUTES={gt:'mqtts://broker.emqx.io:8883',gw:'wss://broker.emqx.io:8084/mqtt',ct:'mqtts://broker-cn.emqx.io:8883',cw:'wss://broker-cn.emqx.io:8084/mqtt'};
const publicDER=Buffer.from('302a300506032b6570032100','hex');
function identity(){const keys=crypto.generateKeyPairSync('ed25519');const pub=keys.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64url');return {privateKey:keys.privateKey,pub,id:crypto.createHash('sha256').update(pub).digest('hex').slice(0,32)};}
function publicKey(pub){if(!/^[\w-]{43}$/.test(pub))throw Error('无效签名公钥');return crypto.createPublicKey({key:Buffer.concat([publicDER,Buffer.from(pub,'base64url')]),format:'der',type:'spki'});}
function room(secret,pub,route){return {secret,pub,route,key:crypto.createHash('sha256').update('dustline-key:'+secret).digest(),topic:'dustline/v3/'+crypto.createHash('sha256').update(route+secret+pub).digest('hex'),code:'DL3.'+route+'.'+secret+'.'+pub};}
function createRoom(host,route='gt'){if(!Object.hasOwn(ROUTES,route))throw Error('未知线路');return room(crypto.randomBytes(16).toString('base64url'),host.pub,route);}
function parseRoom(code){const parts=String(code||'').trim().split('.');if(parts.length!==4||parts[0]!=='DL3'||!Object.hasOwn(ROUTES,parts[1])||!/^[\w-]{22}$/.test(parts[2])||!/^[\w-]{43}$/.test(parts[3]))throw Error('请使用 0.6 新版并粘贴完整 DL3. 房间码，旧房间码不能加入');publicKey(parts[3]);return room(parts[2],parts[3],parts[1]);}
function seal(room,topic,body,sender){const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',room.key,nonce);cipher.setAAD(Buffer.from(topic));const plain=zlib.deflateRawSync(Buffer.from(JSON.stringify(body))),encrypted=Buffer.concat([nonce,cipher.update(plain),cipher.final(),cipher.getAuthTag()]);return Buffer.concat([encrypted,crypto.sign(null,encrypted,sender.privateKey)]);}
function open(room,topic,packet,expectedPub){if(!Buffer.isBuffer(packet)||packet.length<93||packet.length>65536)throw Error('packet size');const data=packet.subarray(0,-64),signature=packet.subarray(-64);if(expectedPub&&!crypto.verify(null,data,publicKey(expectedPub),signature))throw Error('signature');const decipher=crypto.createDecipheriv('aes-256-gcm',room.key,data.subarray(0,12));decipher.setAAD(Buffer.from(topic));decipher.setAuthTag(data.subarray(-16));const raw=Buffer.concat([decipher.update(data.subarray(12,-16)),decipher.final()]);const body=JSON.parse(zlib.inflateRawSync(raw,{maxOutputLength:131072}).toString('utf8'));if(!expectedPub){if(!crypto.verify(null,data,publicKey(body.pub),signature)||crypto.createHash('sha256').update(body.pub).digest('hex').slice(0,32)!==body.sender)throw Error('sender signature');}return body;}
async function broker(topics,onMessage,onClose,{route='gt',exact=false}={}){
 if(!Object.hasOwn(ROUTES,route))throw Error('未知线路');
 const alternate=route[0]+(route[1]==='t'?'w':'t');
 const urls=exact?[ROUTES[route]]:[ROUTES[route],ROUTES[alternate]];
 let lastError;
 for(const url of urls){
  try {
   return await new Promise((resolve,reject)=>{
    let ready=false,closed=false;
    const client=mqtt.connect(url,{protocolVersion:4,clientId:'dl2-'+crypto.randomBytes(10).toString('hex'),clean:true,keepalive:15,connectTimeout:9000,reconnectPeriod:0,queueQoSZero:false});
    const timeout=setTimeout(()=>fail(Error('中转连接超时')),11000);
    function fail(error){
     if(ready){if(!closed){closed=true;onClose(error);}}
     else {clearTimeout(timeout);client.end(true);reject(error);}
    }
    client.on('error',fail);
    client.on('close',()=>fail(Error('互联网中转连接已断开')));
    client.on('message',(topic,packet)=>{if(ready)onMessage(topic,packet);});
    client.on('connect',()=>{
     client.stream.setNoDelay?.(true);
     client.subscribe(topics,{qos:0},(error,grants)=>{
      if(error||grants.some(g=>g.qos===128)){fail(error||Error('中转订阅失败'));return;}
      ready=true;clearTimeout(timeout);
      resolve({url,
       publish(topic,packet){if(!closed&&client.connected&&client.stream.writableLength<8192)client.publish(topic,packet,{qos:0,retain:false});},
       close(){closed=true;client.end(true);}
      });
     });
    });
   });
  }catch(error){lastError=error;}
 }
 throw Error('无法连接互联网中转，请检查出站网络：'+lastError?.message);
}
// Probe message transit (not DNS/handshake time), and pin the selected region in the room code.
async function measureRoute(route){
 const topic='dustline-route/'+crypto.randomBytes(16).toString('hex'),samples=[];
 let bus,timer,stamp,finish;
 const result=new Promise(resolve=>{finish=resolve;});
 try{
  bus=await broker([topic],()=>{samples.push(Date.now()-stamp);if(samples.length===3)finish(true);else ping();},()=>finish(false),{route,exact:true});
  function ping(){stamp=Date.now();bus.publish(topic,Buffer.from('route-probe'));}
  timer=setTimeout(()=>finish(false),3000);ping();
  if(!await result)throw Error('测速超时');
  return {route,ms:[...samples].sort((a,b)=>a-b)[1]};
 }finally{clearTimeout(timer);bus?.close();}
}
async function selectRoute(){
 const results=await Promise.allSettled(Object.keys(ROUTES).map(measureRoute));
 const available=results.filter(r=>r.status==='fulfilled').map(r=>r.value).sort((a,b)=>a.ms-b.ms);
 if(!available.length)throw Error('中转测速未完成：'+results.map(r=>r.reason?.message).filter(Boolean).join('；'));
 return {...available[0],measurements:available};
}
module.exports={identity,createRoom,parseRoom,seal,open,broker,selectRoute,ROUTES};
