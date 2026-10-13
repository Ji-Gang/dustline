'use strict';
const {app,BrowserWindow}=require('electron'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');const {createServer,connect}=require('../pvp/server.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'desktop-check','pvp');fs.mkdirSync(out,{recursive:true});const errors=[];let server,peers=[],win;const wait=ms=>new Promise(r=>setTimeout(r,ms));const timer=setTimeout(()=>finish(Error('Desktop PvP check timed out')),60000);
async function finish(error){clearTimeout(timer);if(error)errors.push(String(error.stack||error));peers.forEach(p=>p.close());await server?.close();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:errors.length===0,errors},null,2));app.exit(errors.length?1:0);}
app.whenReady().then(async()=>{try{
 server=await createServer({port:0,pin:'234567',options:{target:10,protection:4,respawn:1}});
 for(let i=0;i<3;i++)peers.push(await connect({port:server.port,pin:server.pin,name:'TEST '+i},()=>{}));
 const packaged=path.join(root,'dist','DUSTLINE-win32-x64','resources','app');win=new BrowserWindow({width:1440,height:900,show:false,webPreferences:{preload:path.join(packaged,'desktop','preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,offscreen:true}});require(path.join(packaged,'desktop','network.cjs')).setup(win);
 win.webContents.on('console-message',(_e,details)=>{if(details.level==='error')errors.push(details.message);});
 await win.loadFile(path.join(packaged,'pvp','index.html'),{query:{'desktop-check':'1'}});
 await win.webContents.executeJavaScript(`document.getElementById('name').value='DESKTOP';document.getElementById('address').value='127.0.0.1:${server.port}';document.getElementById('pin').value='234567';document.getElementById('join').click();`);
 await wait(1000);let view=await win.webContents.executeJavaScript('window.__pvp.getState()');assert.equal(view.state.players.length,4);assert.equal(view.ui,'lobby');const localId=view.id;
 peers[0].send({type:'start'});await wait(300);view=await win.webContents.executeJavaScript('window.__pvp.getState()');assert.equal(view.state.phase,'playing');assert.equal(view.ui,'armory');
 await win.webContents.executeJavaScript(`document.querySelector('[data-weapon="m4"]').click()`);await wait(180);assert.equal(server.match.players.get(localId).weapon,'m4');
 await win.webContents.executeJavaScript(`window.__pvp.screen('play');window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));`);await wait(600);await win.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));`);const local=server.match.players.get(localId);assert(local.z>-26,'Client movement should arrive at server');
 await win.webContents.executeJavaScript(`const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.body.dispatchEvent(event);if(!event.defaultPrevented)throw Error('Context menu conflict');`);
 Object.assign(local,{x:11,z:13,yaw:0,canSelect:false,spawnId:local.spawnId+1});await wait(250);win.webContents.invalidate();await wait(600);fs.writeFileSync(path.join(out,'arena.png'),(await win.webContents.capturePage()).toPNG());
 // Force a server-side death to exercise real snapshot-driven respawn, protection and armory.
 local.alive=false;local.hp=0;local.deaths++;local.respawnAt=server.match.time+.2;await wait(500);view=await win.webContents.executeJavaScript('window.__pvp.getState()');assert.equal(view.ui,'armory');assert(server.match.players.get(localId).alive);assert(local.protectedUntil>server.match.time);
 const stats=await win.webContents.executeJavaScript(`({webgl:window.__pvp.renderer.getContext().getParameter(window.__pvp.renderer.getContext().VERSION),geometry:window.__pvp.world.userData.detailPieces,drawCalls:window.__pvp.renderer.info.render.calls})`);fs.writeFileSync(path.join(out,'runtime.json'),JSON.stringify({...stats,players:4,ipc:true,weaponSync:true,movementSync:true,respawnArmory:true},null,2));
 // Also exercise the desktop host path, room code sharing, settings, and start button.
 await win.webContents.executeJavaScript("document.getElementById('leave').click()");await wait(150);peers.forEach(p=>p.close());peers=[];const hostPort=server.port;await server.close();server=null;
 await win.webContents.executeJavaScript(`document.getElementById('port').value='${hostPort}';document.getElementById('target').value='7';document.getElementById('host').click();`);await wait(700);
 const room=await win.webContents.executeJavaScript("({info:document.getElementById('roomInfo').textContent,...window.__pvp.getState()})");assert.equal(room.state.players.length,1);assert.equal(room.state.host,room.id);const pin=room.info.match(/房间码：(\d{6})/)[1];
 for(let i=0;i<3;i++)peers.push(await connect({port:hostPort,pin,name:'GUEST '+i},()=>{}));await wait(180);await win.webContents.executeJavaScript("document.getElementById('start').click()");await wait(180);const hostedView=await win.webContents.executeJavaScript('window.__pvp.getState()');assert.equal(hostedView.state.phase,'playing');assert.equal(hostedView.state.options.target,7);assert.equal(hostedView.state.players.length,4);
 const report=JSON.parse(fs.readFileSync(path.join(out,'runtime.json'),'utf8'));report.desktopHosting=true;fs.writeFileSync(path.join(out,'runtime.json'),JSON.stringify(report,null,2));
 await finish();
}catch(error){await finish(error);}});
