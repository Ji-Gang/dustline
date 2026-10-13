'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('multiplayer',Object.freeze({direct:message=>ipcRenderer.send('pvp:direct',message),onDirect:callback=>{const listener=(_e,m)=>callback(m);ipcRenderer.on('pvp:direct',listener);return()=>ipcRenderer.removeListener('pvp:direct',listener);}}));
