'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('multiplayer',Object.freeze({
 host:options=>ipcRenderer.invoke('pvp:host',options),join:options=>ipcRenderer.invoke('pvp:join',options),leave:()=>ipcRenderer.invoke('pvp:leave'),
 copyCode:code=>ipcRenderer.invoke('pvp:copy',code),
 direct:message=>ipcRenderer.send('pvp:direct',message),onDirect:callback=>{const listener=(_e,m)=>callback(m);ipcRenderer.on('pvp:direct',listener);return()=>ipcRenderer.removeListener('pvp:direct',listener);},
 send:message=>ipcRenderer.send('pvp:send',message),onMessage:callback=>{const listener=(_event,message)=>callback(message);ipcRenderer.on('pvp:message',listener);return()=>ipcRenderer.removeListener('pvp:message',listener);}
}));
