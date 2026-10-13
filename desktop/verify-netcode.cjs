'use strict';
const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Match}=require('../pvp/match.cjs');
const root=path.resolve(__dirname,'..'),pkg=path.join(root,'dist','DUSTLINE-Internet-0.8-win32-x64','resources','app'),out=path.join(root,'desktop-check','netcode-0.8');fs.mkdirSync(out,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let win;const errors=[];
app.whenReady().then(async()=>{try{
 win=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{preload:path.join(pkg,'desktop/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,offscreen:true}});
 win.webContents.on('console-message',(_event,details)=>{if(details.level==='error')errors.push(details.message);});
 const js=code=>win.webContents.executeJavaScript(code),m=new Match();m.add('local','反馈测试');m.add('other','对手');m.start('local');m.tick(.5);const p=m.players.get('local');p.weapon='usp';p.ammo=12;
 await win.loadFile(path.join(pkg,'pvp/index.html'),{query:{'desktop-check':'1'}});
 await js('window.__pvp.setId("local");window.__pvp.receive('+JSON.stringify({type:'state',state:m.snapshot()})+');window.__pvp.screen("play")');
 // No host processes any command or sends another packet during this assertion.
 let v=await js('document.getElementById("game").dispatchEvent(new MouseEvent("mousedown",{button:0,bubbles:true}));window.__pvp.render(.016,1);window.__pvp.getState()');assert(v.kick>.8,JSON.stringify(v));assert.equal(v.pendingFeedback,1);assert.equal(v.state.players.find(p=>p.id==='local').ammo,12);
 await js('window.dispatchEvent(new MouseEvent("mouseup",{button:0}));window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyW"}))');await wait(180);
 v=await js('window.__pvp.getState()');assert(v.position.z<26,'Local movement must not wait for a reply');assert(v.inputHistory>0);
 await js('window.dispatchEvent(new KeyboardEvent("keyup",{code:"KeyW"}))');
 m.command('local',{type:'input',seq:1,input:{yaw:0,fire:true}});m.tick(1/60);
 await js('window.__pvp.receive('+JSON.stringify({type:'state',state:m.snapshot()})+')');v=await js('window.__pvp.getState()');assert.equal(v.pendingFeedback,0);
 const confirmationKick=v.kick;assert(confirmationKick<.8,'Delayed host confirmation must not replay kick');
 win.webContents.invalidate();await wait(80);fs.writeFileSync(path.join(out,'game.png'),(await win.webContents.capturePage()).toPNG());
 assert.equal(errors.length,0);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,immediateFireWithoutHostReply:true,localMovementWithoutReply:true,confirmationDoesNotRepeatFeedback:true,confirmationKick,errors},null,2));
 app.exit(0);
 }catch(e){fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:false,errors:[...errors,String(e.stack)]},null,2));app.exit(1);}});
setTimeout(()=>app.exit(2),30000);
