'use strict';
const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createDirect}=require('./direct.cjs'),{createRelayHost,connectRelay}=require('../pvp/relay.cjs'),W=require('../pvp/relay-wire.cjs');
const out=path.join(__dirname,'..','desktop-check','direct-0.8');fs.mkdirSync(out,{recursive:true});
const windows=[],bridges=[],guests=[],states=new Map(),pongs=[],errors=[];let host,done=false,relayStates=0;
const subscribers=new Set(),wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){const end=Date.now()+35000;while(!fn()){if(Date.now()>end)throw Error('Timed out '+label);await wait(50);}}
async function fakeTransport(topics,message){const sub={topics,message};subscribers.add(sub);return {url:'memory-signaling',publish(topic,packet){if(topic.endsWith('/state'))relayStates++;for(const s of subscribers)if(s.topics.includes(topic))queueMicrotask(()=>s.message(topic,packet));},close(){subscribers.delete(sub);}};}
const live=process.argv.includes('--live'),transport=live?W.broker:fakeTransport;
const timer=setTimeout(()=>finish(Error('RTC test timeout')),150000);
async function finish(error){if(done)return;done=true;clearTimeout(timer);if(error)errors.push(String(error.stack||error));for(const guest of guests)await guest.close();await host?.close();for(const b of bridges)b.close();for(const w of windows)if(!w.isDestroyed())w.destroy();fs.writeFileSync(path.join(out,live?'live-result.json':'result.json'),JSON.stringify({ok:!errors.length,live,errors,directRttMs:pongs.filter(p=>p.via==='direct').map(p=>p.ms),relayRttMs:pongs.filter(p=>p.via==='relay').map(p=>p.ms)},null,2));app.exit(errors.length?1:0);}
app.whenReady().then(async()=>{try{
 for(let i=0;i<4;i++){const w=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});windows.push(w);w.webContents.on('console-message',(_e,level,message)=>{if(level===3)errors.push(message);});await w.loadFile(path.join(__dirname,'rtc-test.html'));bridges.push(createDirect(w));}
 host=await createRelayHost({name:'RTC HOST',transport,direct:bridges[0]},m=>{if(m.type==='state')states.set('host',m.state);});
 for(let i=0;i<3;i++)guests.push(await connectRelay({code:host.code,name:'RTC '+i,transport,direct:bridges[i+1]},m=>{if(m.type==='state')states.set(i,m.state);if(m.type==='pong')pongs.push({player:i,via:m.via,ms:Date.now()-m.stamp});}));
 await until(()=>guests.every(g=>bridges[0].ready(g.id))&&bridges.slice(1).every(b=>b.ready('host')),'three direct peers');
 host.client.send({type:'start'});await until(()=>[0,1,2].every(i=>states.get(i)?.phase==='playing'),'direct snapshots');
 const before=relayStates;await wait(250);if(!live)assert.equal(relayStates,before,'All-direct state must bypass MQTT');
 const player=host.match.players.get(guests[0].id),z=player.z;guests[0].send({type:'weapon',weapon:'mp5'});
 for(let i=1;i<=15;i++){guests[0].send({type:'input',seq:i,input:{yaw:player.yaw,pitch:0,forward:true}});if(i===3)guests[0].send({type:'weapon',weapon:'m4'});await wait(16);}
 await until(()=>player.weapon==='m4'&&Math.abs(player.z-z)>.25,'unreliable input with reliable command');
 guests[0].send({type:'input',seq:16,input:{yaw:player.yaw,pitch:0}});
 for(let i=0;i<3;i++)for(const guest of guests){guest.send({type:'ping',stamp:Date.now()});await wait(70);}
 await until(()=>pongs.filter(p=>p.via==='direct').length>=9,'direct RTT');
 bridges[1].drop('host');await until(()=>!bridges[0].ready(guests[0].id),'direct failure');
 guests[0].send({type:'ping',stamp:Date.now()});await until(()=>pongs.some(p=>p.player===0&&p.via==='relay'),'MQTT fallback');
 const oldFrame=states.get(0).time;await until(()=>states.get(0).time>oldFrame,'fallback keeps state alive');
 await finish();
}catch(error){await finish(error);}});
