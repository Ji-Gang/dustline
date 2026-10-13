'use strict';
// MQTT QoS 0 is deliberately used for state. Handshake messages need their own
// acknowledgements so a missing offer cannot strand all subsequent candidates.
class Signaling {
 constructor(send,deliver,{automatic=true}={}){this.sendPacket=send;this.deliver=deliver;this.serial=0;this.pending=new Map();this.seen=new Set();this.closed=false;if(automatic)this.timer=setInterval(()=>this.pump(),500);}
 send(signal){if(this.closed||this.pending.size>=64)return;const body={type:'signal',signalId:++this.serial,signal};this.pending.set(body.signalId,{body,created:Date.now(),sent:Date.now()});this.sendPacket(body);}
 receive(m){if(this.closed||!Number.isSafeInteger(m.signalId)||m.signalId<1)return;
  if(m.type==='signalAck'){this.pending.delete(m.signalId);return;}
  if(m.type!=='signal'||!m.signal)return;this.sendPacket({type:'signalAck',signalId:m.signalId});if(this.seen.has(m.signalId))return;this.seen.add(m.signalId);if(this.seen.size>256)this.seen.delete(this.seen.values().next().value);this.deliver(m.signal);
 }
 pump(now=Date.now()){if(this.closed)return;for(const [id,entry] of this.pending){if(now-entry.created>18000){this.pending.delete(id);continue;}if(now-entry.sent>=500){entry.sent=now;this.sendPacket(entry.body);}}}
 close(){this.closed=true;clearInterval(this.timer);this.pending.clear();this.seen.clear();}
}
module.exports={Signaling};
