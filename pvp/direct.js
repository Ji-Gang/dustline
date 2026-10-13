/* Encrypted WebRTC data channels; MQTT only carries authenticated signaling. */
(()=>{'use strict';const net=window.multiplayer;if(!net?.onDirect)return;
let epoch=null;const peers=new Map();
const emit=(id,m)=>net.direct({epoch,id,...m});
function drop(id){const p=peers.get(id);if(!p)return;peers.delete(id);p.closed=true;clearTimeout(p.deadline);clearInterval(p.monitor);p.pc.close();}
function reset(){for(const id of [...peers.keys()])drop(id);}
function open(id,initiator){if(peers.has(id))return;const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:global.stun.twilio.com:3478'}],bundlePolicy:'max-bundle'});
 const p={pc,id,closed:false,fast:null,control:null,candidates:[],chain:Promise.resolve()};peers.set(id,p);
 function status(){if(p.closed)return;emit(id,{type:'status',ready:p.fast?.readyState==='open'&&p.control?.readyState==='open'&&['connected','completed'].includes(pc.iceConnectionState),detail:pc.iceConnectionState});}
 p.monitor=setInterval(async()=>{if(p.closed||pc.connectionState==='closed'||typeof pc.getStats!=='function')return;try{const stats=await pc.getStats();let pair;stats.forEach(s=>{if(s.type==='transport'&&s.selectedCandidatePairId)pair=stats.get(s.selectedCandidatePairId);});if(!pair)stats.forEach(s=>{if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated)pair=s;});if(!p.closed&&Number.isFinite(pair?.currentRoundTripTime))emit(id,{type:'metrics',networkMs:Math.round(pair.currentRoundTripTime*1000)});}catch{}},2000);
 function channel(c){if(!['fast','control'].includes(c.label)){c.close();return;}p[c.label]=c;c.bufferedAmountLowThreshold=16384;c.onbufferedamountlow=status;c.onopen=()=>{status();};c.onclose=status;c.onerror=status;
  c.onmessage=e=>{if(p.closed||typeof e.data!=='string'||e.data.length>131072)return;try{emit(id,{type:'data',body:JSON.parse(e.data)});}catch{}};
 }
 pc.ondatachannel=e=>channel(e.channel);pc.oniceconnectionstatechange=status;
 pc.onicecandidate=e=>{if(e.candidate)emit(id,{type:'signal',signal:{candidate:e.candidate.toJSON()}});};
 // A slow/blocked direct attempt must never hold up joining the fallback room.
 p.deadline=setTimeout(()=>{if(p.fast?.readyState!=='open'){emit(id,{type:'status',ready:false,detail:'timeout'});drop(id);}},20000);
 if(initiator){channel(pc.createDataChannel('fast',{ordered:false,maxRetransmits:0}));channel(pc.createDataChannel('control',{ordered:true}));p.chain=pc.createOffer().then(offer=>pc.setLocalDescription(offer)).then(()=>emit(id,{type:'signal',signal:{description:pc.localDescription.toJSON()}})).catch(()=>{emit(id,{type:'status',ready:false,detail:'failed'});drop(id);});}
}
net.onDirect(m=>{
 if(m.type==='open'){if(epoch!==m.epoch){reset();epoch=m.epoch;}try{open(m.id,m.initiator);}catch{emit(m.id,{type:'status',ready:false,detail:'unavailable'});}return;}
 if(m.epoch!==epoch)return;if(m.type==='reset'){reset();epoch=null;return;}if(m.type==='drop'){drop(m.id);return;}const p=peers.get(m.id);if(!p)return;
 if(m.type==='signal'){p.chain=p.chain.then(async()=>{if(p.closed)return;const s=m.signal;if(s.description){if(!['offer','answer'].includes(s.description.type)||typeof s.description.sdp!=='string')return;await p.pc.setRemoteDescription(s.description);for(const c of p.candidates)await p.pc.addIceCandidate(c);p.candidates=[];if(s.description.type==='offer'){await p.pc.setLocalDescription(await p.pc.createAnswer());emit(m.id,{type:'signal',signal:{description:p.pc.localDescription.toJSON()}});}}else if(s.candidate){if(p.pc.remoteDescription)await p.pc.addIceCandidate(s.candidate);else if(p.candidates.length<64)p.candidates.push(s.candidate);}}).catch(()=>{emit(m.id,{type:'status',ready:false,detail:'failed'});drop(m.id);});}
 if(m.type==='send'){const type=m.body?.body?.type||m.body?.type,c=['state','input'].includes(type)?p.fast:p.control;
  if(c?.readyState==='open'&&c.bufferedAmount<65536)c.send(JSON.stringify(m.body));else emit(m.id,{type:'status',ready:false,detail:'congested'});
 }
});
})();
