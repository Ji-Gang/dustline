'use strict';
// Assemble a portable Windows application from the pinned, locally installed runtime.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),runtime=path.join(root,'node_modules','electron','dist');
if(process.platform!=='win32')throw Error('This build targets Windows.');
if(!fs.existsSync(path.join(runtime,'electron.exe')))throw Error('Run npm install first.');
const version=require('../package.json').version,minor=version.split('.').slice(0,2).join('.');
const output=path.join(root,'dist','DUSTLINE-Internet-'+minor+'-win32-x64');
fs.mkdirSync(output,{recursive:true});
fs.cpSync(runtime,output,{recursive:true});
const executable=path.join(output,'DUSTLINE.exe');
fs.copyFileSync(path.join(output,'electron.exe'),executable);
fs.unlinkSync(path.join(output,'electron.exe'));
const dest=path.join(output,'resources','app');fs.mkdirSync(dest,{recursive:true});
const files=['index.html','style.css','map.js','core.js','ai.js','models.js','weapons.js','level.js','game.js','README.md','README-offline.md','README-LAN-0.4.md','docs/GitHub更新.md'];
for(const file of files){fs.mkdirSync(path.dirname(path.join(dest,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(dest,file));}
fs.mkdirSync(path.join(dest,'desktop'),{recursive:true});
for(const name of ['main.cjs','preload.cjs','network.cjs','direct.cjs','network-direct.cjs','network-preload.cjs','network.html'])fs.copyFileSync(path.join(__dirname,name),path.join(dest,'desktop',name));
fs.cpSync(path.join(root,'pvp'),path.join(dest,'pvp'),{recursive:true,filter:source=>!source.endsWith('test.cjs')});
fs.cpSync(path.join(root,'vendor'),path.join(dest,'vendor'),{recursive:true});
const dependencies=Object.entries(require('../package-lock.json').packages).filter(([key,value])=>key.startsWith('node_modules/')&&!value.dev);
for(const [dependency] of dependencies){const source=path.join(root,dependency);if(fs.existsSync(source))fs.cpSync(source,path.join(dest,dependency),{recursive:true});}
fs.writeFileSync(path.join(dest,'package.json'),JSON.stringify({name:'dustline-desktop',productName:'DUSTLINE',version:require('../package.json').version,main:'desktop/main.cjs'},null,2));
fs.writeFileSync(path.join(output,'开始游戏.txt'),'双击 DUSTLINE.exe 开始游戏。无需浏览器或安装 Node.js；互联网房间只需能访问中转服务，不要求设备互通。\r\n请保留整个文件夹，不要单独移动 exe。\r\n右键按住瞄准 / Q 切换瞄准；F11 或 Alt+Enter 切换全屏；Esc 暂停。\r\n地图：铸造工坊，房间人数上限 2–16 人（可添加 AI）；大厅点击空位自选位置，房主随时开局，空位可中途加入，目标击杀可调；B 在出生区选枪。0.12 会尝试 WebRTC 玩家直连，失败则使用中转；访客右上角显示实际路径和延迟。尚不能保证跨电脑 100 ms。选择互联网房间，房主创建后点击复制房间码，好友粘贴 DL3. 开头完整代码加入。不需要 IP 或端口映射。公共测试中转不保证延迟和可用性。\r\n');
const manifest={version:require('../package.json').version,runtime:require('../node_modules/electron/package.json').version,files:{}};
for(const file of [...files,'desktop/main.cjs','desktop/preload.cjs','desktop/network.cjs','desktop/direct.cjs','desktop/network-direct.cjs','desktop/network-preload.cjs','desktop/network.html',...fs.readdirSync(path.join(root,'pvp')).filter(name=>!name.endsWith('test.cjs')).map(name=>'pvp/'+name)])manifest.files[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(dest,file))).digest('hex');
fs.writeFileSync(path.join(output,'build-manifest.json'),JSON.stringify(manifest,null,2));
fs.copyFileSync(path.join(__dirname,'update.ps1'),path.join(output,'update.ps1'));
fs.writeFileSync(path.join(output,'update.cmd'),'@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1" %*\r\nexit /b %errorlevel%\r\n');
fs.writeFileSync(path.join(output,'runtime-version.txt'),manifest.runtime);
console.log('Built '+executable);
