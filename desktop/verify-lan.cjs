'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),pkg=path.join(root,'dist/DUSTLINE-Internet-0.11-win32-x64/resources/app'),out=path.join(root,'desktop-check/lan-0.11');
const {createServer,connect}=require(path.join(pkg,'pvp/server.cjs'));fs.mkdirSync(out,{recursive:true});
const address=Object.values(os.networkInterfaces()).flat().find(a=>a.family==='IPv4'&&!a.internal)?.address;
let win,external,finished=false;const peers=[],samples=[],checks=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
const js=s=>win.webContents.executeJavaScript(s),view=()=>js('window.__pvp.getState()');
async function until(fn,label){const deadline=Date.now()+15000;while(!await fn()){if(Date.now()>deadline)throw Error(label);await wait(50);}checks.push(label);}
async function finish(error){if(finished)return;finished=true;clearTimeout(deadline);for(const p of peers)p.close();try{await js('window.multiplayer.leave()');}catch{}await external?.close();samples.sort((a,b)=>a-b);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:!error,scope:'Same computer via its non-loopback IPv4; not a two-computer LAN test',address,checks,rtt:{count:samples.length,min:samples[0],median:samples[Math.floor(samples.length/2)],p95:samples[Math.floor(samples.length*.95)],max:samples.at(-1)},error:error?.stack},null,2));app.exit(error?1:0);}
const deadline=setTimeout(()=>finish(Error('LAN verification deadline')),60000);
app.whenReady().then(async()=>{try{
 assert(address,'No LAN IPv4');external=await createServer({port:0});const port=external.port;await external.close();external=null;
 win=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{preload:path.join(pkg,'desktop/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 require(path.join(pkg,'desktop/network.cjs')).setup(win);await win.loadFile(path.join(pkg,'pvp/index.html'),{query:{'desktop-check':'1'}});
 await js(`document.getElementById('transport').value='lan';document.getElementById('transport').onchange();document.getElementById('port').value='${port}';document.getElementById('host').click()`);
 await until(async()=>(await view()).state?.players.length===1,'Packaged UI creates LAN room');
 const info=await js("document.getElementById('roomInfo').textContent"),pin=info.match(/房间码：(\d{6})/)[1];assert(info.includes(address));
 await js("document.getElementById('start').click()");await until(async()=>(await view()).state?.phase==='playing','Host starts alone');
 for(let i=0;i<3;i++)peers.push(await connect({host:address,port,pin,name:'LAN '+i},m=>{if(m.type==='pong')samples.push(Date.now()-m.stamp);}));
 await until(async()=>(await view()).state.players.length===4,'Three guests join using NIC address');
 for(const p of peers)p.send({type:'deploy'});
 await until(async()=>(await view()).state.players.every(p=>p.deployed),'Four players deployed');
 for(let i=0;i<40;i++){for(const p of peers)p.send({type:'ping',stamp:Date.now()});await wait(50);}
 await until(()=>samples.length>=120,'120 latency replies during running match');
 await assert.rejects(connect({host:address,port,pin:'000000',name:'bad'},()=>{}),/房间码/);checks.push('Invalid room code rejected');
 fs.writeFileSync(path.join(out,'host.png'),(await win.webContents.capturePage()).toPNG());
 peers.forEach(p=>p.close());await js('window.multiplayer.leave()');
 external=await createServer({port:0});const host=await connect({host:address,port:external.port,pin:external.pin,name:'External host'},()=>{});peers.push(host);host.send({type:'start'});
 await js(`window.__pvp.screen('connect');document.getElementById('address').value=${JSON.stringify(address+':'+external.port)};document.getElementById('pin').value='${external.pin}';document.getElementById('join').click()`);
 await until(async()=>{const v=await view();return v.id!==host.id&&v.state?.players.length===2&&v.ui==='lobby';},'Packaged UI joins running LAN host');
 fs.writeFileSync(path.join(out,'guest.png'),(await win.webContents.capturePage()).toPNG());await finish();
 }catch(e){await finish(e);}});
