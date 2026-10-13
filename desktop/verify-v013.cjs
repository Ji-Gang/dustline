'use strict';
const {app,BrowserWindow,ipcMain}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),pkg=path.join(root,'dist/DUSTLINE-Internet-0.13-win32-x64/resources/app'),out=path.join(root,'desktop-check/features-0.13');fs.mkdirSync(out,{recursive:true});
const {Match}=require(path.join(pkg,'pvp/match.cjs'));const m=new Match();m.add('me','Player');m.add('enemy','Enemy');m.start('me');let win,done=false;
const wait=ms=>new Promise(r=>setTimeout(r,ms)),js=s=>win.webContents.executeJavaScript(s),feed=()=>js('window.__pvp.setId("me");window.__pvp.receive('+JSON.stringify({type:'state',state:m.snapshot()})+')');
const timer=setTimeout(()=>finish(Error('timeout')),40000);function finish(e){if(done)return;done=true;clearTimeout(timer);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:!e,error:e?.stack}));app.exit(e?1:0);}
fs.writeFileSync(path.join(out,'preload.cjs'),`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('multiplayer',{send:m=>ipcRenderer.send('test-command',m),onMessage:()=>{},on:()=>{}});`);
ipcMain.on('test-command',(_,cmd)=>m.command('me',cmd));
app.whenReady().then(async()=>{try{win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{preload:path.join(out,'preload.cjs'),offscreen:true,backgroundThrottling:false}});await win.loadFile(path.join(pkg,'pvp/index.html'),{query:{'desktop-check':'1'}});await feed();
assert.equal(await js("document.querySelectorAll('#guns button').length"),12);assert.equal(await js("document.querySelectorAll('#sidearms button').length"),4);
await js("document.querySelector('[data-weapon=m4]').click();document.querySelector('[data-weapon=deagle]').click()");await wait(100);await feed();assert.equal(m.players.get('me').primary,'m4');assert.equal(m.players.get('me').secondary,'deagle');assert.equal(await js("document.querySelectorAll('[data-weapon].active').length"),2);
win.webContents.invalidate();await wait(100);fs.writeFileSync(path.join(out,'armory.png'),(await win.webContents.capturePage()).toPNG());
await js("window.__pvp.screen('play');document.activeElement.blur();window.dispatchEvent(new KeyboardEvent('keydown',{code:'Digit3'}))");await wait(100);await feed();assert.equal(m.players.get('me').weapon,'knife');await js('window.__pvp.render(.016,0)');assert.equal(await js("document.getElementById('ammo').textContent"),'近战');
win.webContents.invalidate();await wait(150);fs.writeFileSync(path.join(out,'knife.png'),(await win.webContents.capturePage()).toPNG());
await js("window.dispatchEvent(new WheelEvent('wheel',{deltaY:100,cancelable:true}))");await wait(100);await feed();assert.equal(m.players.get('me').weapon,'m4');
await js("window.dispatchEvent(new KeyboardEvent('keydown',{code:'Digit2'}))");await wait(100);await feed();assert.equal(m.players.get('me').weapon,'deagle');finish();}catch(e){finish(e);}});
