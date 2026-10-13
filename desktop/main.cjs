'use strict';
const {app,BrowserWindow,Menu,dialog}=require('electron');
const path=require('node:path');
const version=require('../package.json').version;let win;
app.setName('DUSTLINE Internet');
app.setPath('userData',path.join(app.getPath('appData'),'DUSTLINE-Internet')); 
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
  app.whenReady().then(()=>{
    Menu.setApplicationMenu(null);
    win=new BrowserWindow({title:'DUSTLINE · 联机版 '+version,width:1440,height:900,minWidth:960,minHeight:640,backgroundColor:'#171d20',show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,webSecurity:true,devTools:false}});
    require('./network.cjs').setup(win);
    win.removeMenu();
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',event=>event.preventDefault());
    // No browser context menu, including events targeted at HUD overlays.
    win.webContents.on('context-menu',event=>event.preventDefault());
    win.webContents.on('before-input-event',(event,input)=>{
      if(input.key==='F11'||input.key==='Enter'&&input.alt){event.preventDefault();if(input.type==='keyDown'&&!input.isAutoRepeat)win.setFullScreen(!win.isFullScreen());}
      if(input.key==='F5'||input.control&&['r','l','n','t','w','+','-','0'].includes(input.key.toLowerCase()))event.preventDefault();
    });
    win.webContents.session.setPermissionRequestHandler((_contents,permission,callback)=>callback(permission==='pointerLock'||permission==='fullscreen'));
    win.once('ready-to-show',()=>win.show());
    win.webContents.on('did-fail-load',(_event,code,message)=>{if(code!==-3)dialog.showErrorBox('游戏启动失败',message+'\n请保留整个 DUSTLINE 文件夹后重试。');});
    win.loadFile(path.join(__dirname,'..','pvp','index.html'));
  });
  app.on('window-all-closed',()=>app.quit());
}
