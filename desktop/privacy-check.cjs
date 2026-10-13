'use strict';
// Inspect tracked or staged source only. Never enumerate local network adapters.
const cp=require('node:child_process'),fs=require('node:fs'),net=require('node:net');
const staged=process.argv.includes('--staged');
const git=args=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:20*1024*1024});
const allowed=new Set(['127.0.0.1','0.0.0.0','192.168.1.8','::1','::']);
const files=git(['ls-files','-z']).split('\0').filter(Boolean),failures=[];
for(const file of files){
 if(/(^|\/)(desktop-check|dist|node_modules)\/|\.(log|zip|pcap|pcapng)$|(^|\/)(connection-report|lan-network)/i.test(file)){failures.push(file+': local diagnostic/build artifact');continue;}
 let text;try{text=staged?git(['show',':'+file]):fs.readFileSync(file,'utf8');}catch{continue;}
 const candidates=text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b|(?<![\w:])[\da-fA-F]*:[\da-fA-F]*:[\da-fA-F:]*(?![\w:])/g)||[];
 if(candidates.some(x=>net.isIP(x)&&!allowed.has(x)))failures.push(file+': unexpected IP literal (value withheld)');
}
if(failures.length){console.error('Privacy check failed:\n'+failures.join('\n'));process.exitCode=1;}else console.log('PASS privacy: no unexpected IP literals or diagnostic artifacts in '+files.length+' tracked files');
