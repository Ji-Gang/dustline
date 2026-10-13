'use strict';
// Host-authoritative rooms with encrypted MQTT signaling/fallback and optional WebRTC.
const {Match}=require('./match.cjs'),W=require('./relay-wire.cjs'),{Signaling}=require('./signaling.cjs');
const VERSION=3;
async function createRelayHost({name,options={},transport=W.broker,route,direct}={},onMessage=()=>{}){
 const selected=route?{route}:transport===W.broker?await W.selectRoute():{route:'gt'};
 const self=W.identity(),room=W.createRoom(self,selected.route),match=new Match(options),peers=new Map();match.inputTimeout=.6;match.add(self.id,name);
 let seq=0,tick=0,frame=0,closed=false,timer,bus;const up=room.topic+'/up',stateTopic=room.topic+'/state';
 const relay=(topic,body)=>bus.publish(topic,W.seal(room,topic,{seq:++seq,body},self));
 const inbox=id=>room.topic+'/peer/'+id;
 const reply=(id,body,path)=>{if(path==='direct'&&direct?.send(id,body))return;relay(inbox(id),body);};
 const report=()=>onMessage({type:'transport',mode:'host',direct:[...peers.keys()].filter(id=>direct?.ready(id)).length,total:peers.size});
 function remove(id){peers.get(id)?.signals?.close();peers.delete(id);direct?.drop(id);match.remove(id);report();}
 function command(id,m,serial,path){const peer=peers.get(id);if(!peer||!m||typeof m.type!=='string')return;
  peer.last=Date.now();if(Date.now()-peer.window>1000){peer.rate=0;peer.window=Date.now();}if(++peer.rate>120)return;
  if(m.type==='leave'){remove(id);return;}
  if(m.type==='ping'){reply(id,{type:'pong',stamp:m.stamp,via:path},path);return;}
  if(m.type==='signal'||m.type==='signalAck'){if(path==='relay'&&peer.rtc){if(peer.signals)peer.signals.receive(m);else if(m.type==='signal')direct?.signal(id,m.signal);}return;}
  if(m.type!=='input'){const last=peer.actions.get(m.type)||0;if(serial<=last)return;peer.actions.set(m.type,serial);}
  match.command(id,m);
 }
 if(direct){direct.onSignal=(id,signal)=>{if(peers.has(id)&&!closed){const p=peers.get(id);if(p.signals)p.signals.send(signal);else relay(inbox(id),{type:'signal',signal});}};direct.onData=(id,envelope)=>{const p=peers.get(id);if(!p||!Number.isSafeInteger(envelope.seq))return;const lane=envelope.body?.type==='input'?'fast':'control';if(envelope.seq<=(p.directSeq[lane]||0))return;p.directSeq[lane]=envelope.seq;command(id,envelope.body,envelope.seq,'direct');};direct.onStatus=report;}
 try{bus=await transport([up],(topic,packet)=>{try{
  const envelope=W.open(room,topic,packet),{sender,seq:serial,body:m}=envelope;if(!Number.isSafeInteger(serial)||!m||typeof m.type!=='string')return;let peer=peers.get(sender);if(peer&&serial<=peer.seq)return;
  if(m.type==='hello'){if(m.version!==VERSION)return;if(!peer){if(!match.add(sender,m.name)){relay(inbox(sender),{type:'error',message:'房间已满'});return;}peer={pub:envelope.pub,seq:0,directSeq:{},actions:new Map(),last:Date.now(),rate:0,window:Date.now(),rtc:!!direct&&m.rtc===true};if(peer.rtc&&m.signalAck===true)peer.signals=new Signaling(body=>relay(inbox(sender),body),signal=>direct.signal(sender,signal));peers.set(sender,peer);}peer.seq=serial;peer.last=Date.now();relay(inbox(sender),{type:'welcome',id:sender,version:VERSION,rtc:peer.rtc,signalAck:!!peer.signals});if(peer.rtc)direct.open(sender,true);report();return;}
  if(!peer||peer.pub!==envelope.pub)return;peer.seq=serial;command(sender,m,serial,'relay');
 }catch{}},()=>{if(closed)return;closed=true;clearInterval(timer);for(const p of peers.values())p.signals?.close();direct?.close();onMessage({type:'error',message:'房间服务已断开，请重新创建房间'});onMessage({type:'disconnected'});},{route:room.route});}catch(error){direct?.close();throw error;}
 onMessage({type:'welcome',id:self.id,version:VERSION});onMessage({type:'state',state:match.snapshot(),frame:++frame});report();
 timer=setInterval(require('./netcode.js').clock(()=>{if(closed)return;match.tick(1/60);for(const [id,p] of peers)if(Date.now()-p.last>10000)remove(id);
  if(++tick%2===0){const snapshot={type:'state',state:match.snapshot(),frame:++frame};onMessage(snapshot);let fallback=false;for(const id of peers.keys())if(!direct?.send(id,snapshot))fallback=true;if(fallback)relay(stateTopic,snapshot);}
  if(tick%120===0)report();
 }),1000/120);
 return {id:self.id,code:room.code,url:bus.url,route:room.route,measurements:selected.measurements,match,
  client:{id:self.id,send:m=>{if(m.type==='ping')onMessage({type:'pong',stamp:m.stamp,via:'local'});else match.command(self.id,m);},close:()=>{}},
  async close(){for(const p of peers.values())p.signals?.close();if(closed){bus.close();direct?.close();return;}for(const id of peers.keys())direct?.send(id,{type:'disconnected'});relay(stateTopic,{type:'disconnected'});closed=true;clearInterval(timer);await new Promise(r=>setTimeout(r,100));direct?.close();bus.close();}
 };
}
async function connectRelay({code,name,transport=W.broker,direct}={},onMessage=()=>{}){
 const room=W.parseRoom(code),self=W.identity(),inbox=room.topic+'/peer/'+self.id,stateTopic=room.topic+'/state',up=room.topic+'/up';
 let serial=0,welcomed=false,closed=false,resolveJoin,rejectJoin,timeout,heartbeat,lastPacket=Date.now(),lastFrame=0,lastPong=0,bus,signals;const lastSeq=new Map();
 const joined=new Promise((resolve,reject)=>{resolveJoin=resolve;rejectJoin=reject;});joined.catch(()=>{});
 const relay=envelope=>bus.publish(up,W.seal(room,up,{sender:self.id,pub:self.pub,...envelope},self));
 const send=(body,forceRelay=false)=>{const envelope={seq:++serial,body};if(!forceRelay&&direct?.send('host',envelope))return;relay(envelope);};
 function close(error){if(closed)return;closed=true;clearTimeout(timeout);clearInterval(heartbeat);signals?.close();direct?.close();bus?.close();if(!welcomed)rejectJoin(error||Error('连接已关闭'));else onMessage({type:'disconnected'});}
 function receive(m,path){if(!m||typeof m.type!=='string')return;lastPacket=Date.now();
  if(m.type==='welcome'&&!welcomed){welcomed=true;clearTimeout(timeout);onMessage(m);if(m.rtc&&direct){if(m.signalAck)signals=new Signaling(body=>send(body,true),signal=>direct.signal('host',signal));direct.open('host',false);onMessage({type:'transport',mode:'connecting'});}else onMessage({type:'transport',mode:'relay'});resolveJoin({id:self.id,send:message=>send(message),async close(){if(closed)return;send({type:'leave'});await new Promise(r=>setTimeout(r,80));close();}});return;}
  if(m.type==='error'&&!welcomed){close(Error(m.message));return;}
  if(m.type==='signal'||m.type==='signalAck'){if(welcomed&&path==='relay'){if(signals)signals.receive(m);else if(m.type==='signal')direct?.signal('host',m.signal);}return;}
  if(m.type==='disconnected'){close(Error('房主已关闭房间'));return;}
  if(m.type==='state'&&Number.isSafeInteger(m.frame)){if(m.frame<=lastFrame)return;lastFrame=m.frame;}
  if(m.type==='pong'){if(!Number.isFinite(m.stamp)||m.stamp<lastPong)return;lastPong=m.stamp;m={...m,via:path};onMessage({type:'transport',mode:path==='direct'?'direct':'relay'});}
  if(welcomed)onMessage(m);
 }
 if(direct){direct.onSignal=(_id,signal)=>{if(!closed){if(signals)signals.send(signal);else send({type:'signal',signal},true);}};direct.onData=(_id,m)=>receive(m,'direct');direct.onStatus=(_id,ready)=>{onMessage({type:'transport',mode:ready?'direct':'relay'});if(ready&&!closed)send({type:'ping',stamp:Date.now()});};}
 try{bus=await transport([inbox,stateTopic],(topic,packet)=>{try{const e=W.open(room,topic,packet,room.pub);if(!Number.isSafeInteger(e.seq)||e.seq<=(lastSeq.get(topic)||0))return;lastSeq.set(topic,e.seq);receive(e.body,'relay');}catch{}},error=>close(error),{route:room.route});}catch(error){closed=true;direct?.close();rejectJoin(error);throw error;}
 timeout=setTimeout(()=>close(Error('房主未回应，请确认房间开启并重新复制完整房间码。')),15000);
 let ticks=0;heartbeat=setInterval(()=>{if(closed)return;if(!welcomed){if(++ticks%20===0)send({type:'hello',version:VERSION,name,rtc:!!direct,signalAck:true},true);return;}if(++ticks%20===0)send({type:'ping',stamp:Date.now()});if(Date.now()-lastPacket>10000)close(Error('房主连接中断'));},50);
 send({type:'hello',version:VERSION,name,rtc:!!direct,signalAck:true},true);return joined;
}
module.exports={createRelayHost,connectRelay};
