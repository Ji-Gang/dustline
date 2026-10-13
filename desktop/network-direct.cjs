'use strict';
const {BrowserWindow}=require('electron'),path=require('node:path'),{createDirect}=require('./direct.cjs');
// Keep network callbacks out of the expensive 3D renderer's event loop.
async function createNetworkDirect(owner){
 const worker=new BrowserWindow({show:false,width:64,height:64,webPreferences:{preload:path.join(__dirname,'network-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 let api,closed=false;
 const close=()=>{if(closed)return;closed=true;owner.removeListener('closed',close);api?.close();if(!worker.isDestroyed())worker.destroy();};
 owner.once('closed',close);
 try{await worker.loadFile(path.join(__dirname,'network.html'));if(closed||owner.isDestroyed())throw Error('游戏窗口已关闭');api=createDirect(worker);const original=api.close;api.close=()=>{original();if(!closed){closed=true;owner.removeListener('closed',close);if(!worker.isDestroyed())worker.destroy();}};worker.once('closed',()=>api.close());return api;}
 catch(error){close();throw error;}
}
module.exports={createNetworkDirect};
