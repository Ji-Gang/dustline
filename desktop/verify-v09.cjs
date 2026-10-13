'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),net=require('node:net');
const root=path.resolve(__dirname,'..'),pkg=path.join(root,'dist/DUSTLINE-Internet-0.9-win32-x64/resources/app'),out=path.join(root,'desktop-check/bots-feedback-0.9');fs.mkdirSync(out,{recursive:true});
const {Match}=require(path.join(pkg,'pvp/match.cjs')),{connect}=require(path.join(pkg,'pvp/server.cjs'));let win,guest,guestState;const errors=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){const end=Date.now()+12000;while(!await fn()){if(Date.now()>end)throw Error('Timed out: '+label);await wait(40);}}
const js=code=>win.webContents.executeJavaScript(code),view=()=>js('window.__pvp.getState()');
async function finish(error){if(error)errors.push(String(error.stack||error));guest?.close();try{await js('window.multiplayer.leave()');}catch{}fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:!errors.length,errors},null,2));app.exit(errors.length?1:0);}
app.whenReady().then(async()=>{try{
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{preload:path.join(pkg,'desktop/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,offscreen:true}});
 require(path.join(pkg,'desktop/network.cjs')).setup(win);win.webContents.on('console-message',(_e,d)=>{if(d.level==='error')errors.push(d.message);});
 await win.loadFile(path.join(pkg,'pvp/index.html'),{query:{'desktop-check':'1'}});
 await js(`document.getElementById('transport').value='lan';document.getElementById('transport').onchange();document.getElementById('port').value='${port}';document.getElementById('host').click()`);
 await until(async()=>(await view()).state?.players.length===1,'host room');
 assert(await js("!document.getElementById('botControls').classList.contains('hidden')"));
 await js("document.getElementById('botDifficulty').value='hard';document.getElementById('addRedBot').click()");await until(async()=>(await view()).state.players.some(p=>p.bot&&p.difficulty==='hard'),'add hard AI');
 await js("document.querySelector('[data-bot-remove]').click()");await until(async()=>(await view()).state.players.length===1,'remove AI');
 await js("document.getElementById('botDifficulty').value='easy';document.getElementById('addBlueBot').click()");await until(async()=>(await view()).state.players.length===2,'blue AI');
 const info=await js("document.getElementById('roomInfo').textContent"),pin=info.match(/房间码：(\d{6})/)[1];guest=await connect({port,pin,name:'真人访客'},m=>{if(m.type==='state')guestState=m.state;});
 await js("document.getElementById('botDifficulty').value='normal';document.getElementById('addRedBot').click()");await until(()=>guestState?.players.length===4&&guestState.players.filter(p=>p.bot).length===2,'guest sees both bots');
 assert(await js("document.getElementById('addBlueBot').disabled&&document.getElementById('addRedBot').disabled"));
 win.webContents.invalidate();await wait(80);fs.writeFileSync(path.join(out,'lobby.png'),(await win.webContents.capturePage()).toPNG());
 guest.send({type:'botRemove',id:guestState.players.find(p=>p.bot).id});await wait(120);assert.equal(guestState.players.length,4);
 await js("document.getElementById('start').click()");await until(async()=>(await view()).ui==='armory','start with bots');const start=guestState.players.filter(p=>p.bot).map(p=>({id:p.id,x:p.x,z:p.z}));
 await until(()=>start.every(a=>{const p=guestState.players.find(p=>p.id===a.id);return Math.hypot(p.x-a.x,p.z-a.z)>2;}),'AI movement reaches remote client');
 guest.close();await js('window.multiplayer.leave()');
 // Feed real authoritative ballistic results into the packaged renderer.
 const match=new Match({target:1});match.add('local','射手');match.add('enemy','训练目标');match.start('local');match.time=5;match.eventId=1000;const p=match.players.get('local'),enemy=match.players.get('enemy');Object.assign(p,{x:11,z:8,yaw:0,pitch:Math.atan2(-.54,16),weapon:'usp',ammo:12,recoil:0,input:{aim:true},protectedUntil:0});Object.assign(enemy,{x:11,z:-8,protectedUntil:0});
 const receive=async()=>js('window.__pvp.setId("local");window.__pvp.receive('+JSON.stringify({type:'state',state:match.snapshot()})+');window.__pvp.updateCombatFeedback(performance.now())');
 await receive();await js("window.__pvp.screen('play')");const random=Math.random;Math.random=()=>.5;match.shoot(p);Math.random=random;assert(enemy.hp>0&&enemy.hp<100);
 await receive();assert(await js("document.getElementById('crosshair').classList.contains('hit')&&!document.getElementById('hitMarker').classList.contains('hidden')"));
 await wait(300);assert(await js("!document.getElementById('crosshair').classList.contains('hit')"));
 // Headshot and the match-winning kill must remain visible over the results.
 p.weapon='awp';p.pitch=0;p.recoil=0;Math.random=()=>.5;match.shoot(p);Math.random=random;assert.equal(match.phase,'ended');await receive();
 assert(await js("!document.getElementById('killBadge').classList.contains('hidden')&&document.getElementById('killTitle').textContent==='爆头击杀'&&document.getElementById('killVictim').textContent==='训练目标'"));
 win.webContents.invalidate();await wait(300);fs.writeFileSync(path.join(out,'kill.png'),(await win.webContents.capturePage()).toPNG());
 await wait(1900);assert(await js("document.getElementById('killBadge').classList.contains('hidden')"));
 await finish();
 }catch(e){await finish(e);}});
setTimeout(()=>finish(Error('UI test deadline')),45000);
