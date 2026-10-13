'use strict';
// Run explicitly with Electron to check the packaged game in its desktop renderer.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'desktop-check');
fs.mkdirSync(out,{recursive:true});
const errors=[];let win;const timeout=setTimeout(()=>finish(new Error('Desktop check timed out')),60000);
function finish(error){clearTimeout(timeout);if(error)errors.push(String(error.stack||error));fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:!errors.length,errors},null,2));app.exit(errors.length?1:0);}
app.whenReady().then(async()=>{
  try {
    win=new BrowserWindow({width:1440,height:900,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
    win.webContents.on('console-message',(_event,details)=>{if(details.level==='error')errors.push(details.message);});
    win.webContents.on('render-process-gone',(_event,details)=>finish(new Error(JSON.stringify(details))));
    await win.loadFile(path.join(root,'dist','DUSTLINE-win32-x64','resources','app','index.html'),{query:{'desktop-check':'1'}});
    const result=await win.webContents.executeJavaScript(`(async()=>{
      const game=window.__dustline;if(!game)throw Error(document.getElementById('fatalText').textContent||'Game did not bootstrap');
      const wait=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      game.newMatch();game.setTestState({mode:'playing',phase:'live'});document.getElementById('buy').classList.add('hidden');
      game.player.guns[0]=Tactical.loadout('awp');game.player.slot=0;
      // Verify right mouse input through actual DOM dispatch without requesting pointer lock.
      const menu=new MouseEvent('contextmenu',{button:2,bubbles:true,cancelable:true});document.getElementById('scope').dispatchEvent(menu);
      if(!menu.defaultPrevented)throw Error('Context menu was not canceled on overlay');
      const canvas=document.getElementById('game'),request=canvas.requestPointerLock;canvas.requestPointerLock=async()=>{};
      canvas.dispatchEvent(new MouseEvent('mousedown',{button:2,bubbles:true,cancelable:true}));game.syncCamera(1);
      if(!game.getState().aiming||game.camera.fov!==Tactical.WEAPONS.awp.scope)throw Error('Right aim did not open scope');
      window.dispatchEvent(new MouseEvent('mouseup',{button:2,bubbles:true,cancelable:true}));game.syncCamera(1);
      if(game.getState().aiming||game.camera.fov!==78)throw Error('Scope did not release');canvas.requestPointerLock=request;
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',bubbles:true}));if(!game.getState().aiming)throw Error('Q toggle failed');
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',bubbles:true}));
      game.setTestState({mode:'paused'});await wait();
      const gl=game.renderer.getContext();if(gl.isContextLost())throw Error('WebGL context lost');
      return {webgl:gl.getParameter(gl.VERSION),actors:game.bots.length+1,triangles:game.renderer.info.render.triangles,contextMenuCanceled:menu.defaultPrevented,scope:true,desktop: true};
    })()`);
    assert.equal(result.actors,10);assert(result.triangles>0);
    fs.writeFileSync(path.join(out,'runtime.json'),JSON.stringify(result,null,2));
    fs.writeFileSync(path.join(out,'spawn.png'),(await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript(`(()=>{const g=window.__dustline;Object.assign(g.player,{x:66,z:-6,y:0,yaw:0,pitch:.05});g.syncCamera(1);g.renderer.clear();g.renderWorld();})()`);
    fs.writeFileSync(path.join(out,'a-long.png'),(await win.webContents.capturePage()).toPNG());
    finish();
  }catch(error){finish(error);}
});
