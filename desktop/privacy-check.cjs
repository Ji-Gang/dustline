'use strict';
// Inspect tracked or staged source only. Never enumerate local network adapters.
const cp=require('node:child_process'),fs=require('node:fs'),crypto=require('node:crypto'),net=require('node:net');
const staged=process.argv.includes('--staged');
const git=args=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:20*1024*1024});
const allowed=new Set(['127.0.0.1','0.0.0.0','192.168.1.8','::1','::']);
const bytes=file=>staged?cp.execFileSync('git',['show',':'+file],{maxBuffer:30*1024*1024}):fs.readFileSync(file);
let assets={};try{assets=JSON.parse(bytes('assets/provenance.json').toString('utf8')).files||{};}catch{}
const files=git(['ls-files','-z']).split('\0').filter(Boolean),failures=[];
for(const file of files){
 if(/(^|\/)(desktop-check|dist|node_modules)\/|\.(log|zip|pcap|pcapng)$|(^|\/)(connection-report|lan-network)/i.test(file)){failures.push(file+': local diagnostic/build artifact');continue;}
 // Binary art is accepted only with an audited upstream source and exact digest.
 if(/^assets\/.*\.(jpg|bin)$/.test(file)){const a=assets[file];if(!a||!a.source.startsWith('https://dl.polyhaven.org/file/ph-assets/')||crypto.createHash('sha256').update(bytes(file)).digest('hex')!==a.sha256)failures.push(file+': unaudited or modified binary asset');continue;}
 let text;try{text=staged?git(['show',':'+file]):fs.readFileSync(file,'utf8');}catch{continue;}
 const candidates=text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b|(?<![\w:])[\da-fA-F]*:[\da-fA-F]*:[\da-fA-F:]*(?![\w:])/g)||[];
 if(candidates.some(x=>net.isIP(x)&&!allowed.has(x)))failures.push(file+': unexpected IP literal (value withheld)');
}
if(failures.length){console.error('Privacy check failed:\n'+failures.join('\n'));process.exitCode=1;}else console.log('PASS privacy: no unexpected IP literals or diagnostic artifacts in '+files.length+' tracked files');
