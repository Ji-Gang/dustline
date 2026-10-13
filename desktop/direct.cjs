'use strict';
const {ipcMain}=require('electron'),crypto=require('node:crypto');
// WebRTC stays in Chromium; the authoritative match stays in the main process.
function createDirect(win){
 const epoch=crypto.randomBytes(12).toString('hex'),peers=new Map();let closed=false;
 const emit=m=>{if(!closed&&!win.isDestroyed())win.webContents.send('pvp:direct',{epoch,...m});};
 const api={onSignal:()=>{},onData:()=>{},onStatus:()=>{},onMetrics:()=>{},
  open(id,initiator){if(closed||peers.has(id))return;peers.set(id,{ready:false,last:Date.now()});emit({type:'open',id,initiator});},
  signal(id,signal){if(peers.has(id))emit({type:'signal',id,signal});},
  ready(id){const p=peers.get(id);return !!p?.ready&&Date.now()-p.last<4000;},
  send(id,body){if(!api.ready(id))return false;emit({type:'send',id,body});return true;},
  drop(id){if(!peers.delete(id))return;emit({type:'drop',id});},
  close(){if(closed)return;emit({type:'reset'});closed=true;peers.clear();ipcMain.removeListener('pvp:direct',receive);}
 };
 function receive(event,m){if(closed||event.sender!==win.webContents||!m||m.epoch!==epoch||!peers.has(m.id))return;
  if(JSON.stringify(m).length>131072)return;const p=peers.get(m.id);
  if(m.type==='signal'&&m.signal&&JSON.stringify(m.signal).length<24000)api.onSignal(m.id,m.signal);
  if(m.type==='status'){p.ready=m.ready===true;if(p.ready)p.last=Date.now();api.onStatus(m.id,p.ready,m.detail);}
  if(m.type==='metrics'&&Number.isFinite(m.networkMs)&&m.networkMs>=0&&m.networkMs<60000)api.onMetrics(m.id,{networkMs:m.networkMs});
  if(m.type==='data'&&m.body&&typeof m.body==='object'){p.last=Date.now();api.onData(m.id,m.body);}
 }
 ipcMain.on('pvp:direct',receive);return api;
}
module.exports={createDirect};
