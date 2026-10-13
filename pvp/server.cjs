'use strict';
const net=require('node:net'),crypto=require('node:crypto');const {Match}=require('./match.cjs');
const VERSION=2;
function send(socket,value){if(!socket||socket.destroyed||socket.writableEnded)return;if(socket.writableLength>65536&&['state','input','ping'].includes(value.type))return;if(socket.writableLength>512000){socket.destroy(Error('发送队列持续拥塞'));return;}socket.write(JSON.stringify(value)+'\n');}
function read(socket,callback){let buffer='';socket.setEncoding('utf8');socket.on('data',data=>{buffer+=data;let end;while((end=buffer.indexOf('\n'))>=0){if(end>32768){socket.destroy(Error('消息过大'));return;}const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{callback(JSON.parse(line));}catch{socket.destroy(Error('消息格式错误'));return;}if(socket.destroyed)return;}if(buffer.length>32768)socket.destroy(Error('消息过大'));});}
async function createServer({port=27888,pin=String(crypto.randomInt(100000,1000000)),options={},reconnectGraceMs=30000,onDiagnostic=()=>{}}={}){
 const match=new Match(options),peers=new Map(),sockets=new Set(),sessions=new Map();let tick=0,closing=false;const server=net.createServer(socket=>{socket.setNoDelay(true);socket.setKeepAlive(true,5000);sockets.add(socket);let id=null,session=null,tokens=640,last=Date.now(),reason='网络连接关闭';const helloTimeout=setTimeout(()=>{if(!id)socket.destroy();},5000);socket.setTimeout(12000,()=>{reason='12 秒无通信';socket.destroy();});
  socket.on('error',e=>{reason=e.code||e.message;});socket.on('close',()=>{clearTimeout(helloTimeout);sockets.delete(socket);if(id&&peers.get(id)===socket){peers.delete(id);onDiagnostic({time:new Date().toISOString(),id,reason});const p=match.players.get(id);if(p)Object.assign(p,{input:{},inputQueue:[],pendingPress:false,burst:0,triggered:false});if(session&&!closing)session.timer=setTimeout(()=>{sessions.delete(session.token);match.remove(id);},reconnectGraceMs);else match.remove(id);}});
  read(socket,message=>{if(!message||typeof message!=='object')return;
   if(!id){if(message.type!=='hello'||message.version!==VERSION||message.pin!==pin){send(socket,{type:'error',message:'房间码或版本不匹配'});socket.end();return;}
    if(message.resumeToken){session=sessions.get(message.resumeToken);if(!session){send(socket,{type:'error',message:'重连席位已过期，请重新加入房间'});socket.end();return;}id=session.id;clearTimeout(session.timer);const old=peers.get(id);peers.set(id,socket);old?.destroy();}
    else {const newId=crypto.randomUUID();if(!match.add(newId,message.name)){send(socket,{type:'error',message:'房间已满'});socket.end();return;}id=newId;if(message.reconnect){session={id,token:crypto.randomBytes(32).toString('hex')};sessions.set(session.token,session);}peers.set(id,socket);}
    clearTimeout(helloTimeout);send(socket,{type:'welcome',id,version:VERSION,...(session?{resumeToken:session.token}:{})});send(socket,{type:'state',state:match.snapshot()});return;}
   if(message.type==='leave'){if(session){clearTimeout(session.timer);sessions.delete(session.token);session=null;}reason='玩家主动离开';socket.end();return;}
   if(message.type==='ping'){send(socket,{type:'pong',stamp:message.stamp});return;}
   const now=Date.now();tokens=Math.min(640,tokens+(now-last)*.16);last=now;if(tokens<1)return;tokens--;match.command(id,message);
  });
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',()=>{server.removeListener('error',reject);resolve();});});
 server.on('error',()=>{});const timer=setInterval(require('./netcode.js').clock(()=>{match.tick(1/60);if(++tick%2===0){const snapshot={type:'state',state:match.snapshot()};for(const socket of peers.values())send(socket,snapshot);}}),1000/120);
 return {match,pin,port:server.address().port,close:()=>new Promise(resolve=>{closing=true;clearInterval(timer);for(const s of sessions.values())clearTimeout(s.timer);sessions.clear();for(const socket of sockets){send(socket,{type:'serverClosing'});socket.end();setTimeout(()=>socket.destroy(),100).unref();}server.close(resolve);})};
}
function connect({host='127.0.0.1',port=27888,pin,name,reconnectMs=30000},onMessage){return new Promise((resolve,reject)=>{
 let socket,token,id,ready=false,stopped=false,retrying=false,started=0,retryTimer,heartbeat,timeout,reason='连接中断';
 const client={get id(){return id;},send:m=>{if(ready)send(socket,m);},close:()=>{stopped=true;clearTimeout(retryTimer);clearTimeout(timeout);clearInterval(heartbeat);send(socket,{type:'leave'});socket?.end();const old=socket;setTimeout(()=>old?.destroy(),100).unref();}};
 function dial(){if(stopped)return;const s=socket=net.createConnection({host,port});s.setNoDelay(true);s.setKeepAlive(true,5000);let accepted=false;
 timeout=setTimeout(()=>{reason='连接或握手超时';s.destroy();},retrying?Math.max(1,Math.min(6000,reconnectMs-(Date.now()-started))):6000);
 s.on('connect',()=>send(s,{type:'hello',version:VERSION,pin,name,reconnect:true,...(token?{resumeToken:token}:{})}));
 s.on('error',e=>{reason=e.code==='ECONNREFUSED'?'房间未开启或端口不可达':e.code||e.message;});
 s.on('close',()=>{ready=false;clearTimeout(timeout);clearInterval(heartbeat);if(stopped)return;if(!id){stopped=true;reject(Error(reason));return;}
 if(!retrying){retrying=true;started=Date.now();}if(!token||Date.now()-started>=reconnectMs){stopped=true;onMessage({type:'disconnected',message:'重连失败：'+reason+'。请检查热点和房主是否在线。'});return;}
 onMessage({type:'reconnecting',message:'连接中断，正在自动重连…',reason});retryTimer=setTimeout(dial,500);});
 read(s,m=>{if(m.type==='serverClosing'){stopped=true;onMessage({type:'disconnected',message:'房主已关闭房间'});s.destroy();return;}
 if(m.type==='error'&&!accepted){stopped=true;clearTimeout(timeout);if(!id)reject(Error(m.message));else onMessage({type:'disconnected',message:m.message});s.destroy();return;}
 if(m.type==='welcome'){accepted=ready=true;id=m.id;token=m.resumeToken;clearTimeout(timeout);s.setTimeout(12000,()=>{reason='12 秒未收到房主数据';s.destroy();});heartbeat=setInterval(()=>send(s,{type:'ping',stamp:Date.now()}),2000);if(retrying){retrying=false;onMessage({type:'reconnected'});}resolve(client);}onMessage(m);});}
 dial();});}
module.exports={createServer,connect,VERSION};
