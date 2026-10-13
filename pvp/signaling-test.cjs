'use strict';
const assert=require('node:assert/strict'),{Signaling}=require('./signaling.cjs');
let attempts=0,acks=0,delivered=0;let sender,receiver;
sender=new Signaling(m=>{if(++attempts>1)receiver.receive(m);},()=>{}, {automatic:false});
receiver=new Signaling(m=>{if(++acks>1)sender.receive(m);},s=>{assert.equal(s.description.type,'offer');delivered++;},{automatic:false});
sender.send({description:{type:'offer',sdp:'test'}});assert.equal(delivered,0);const now=Date.now();sender.pump(now+600);assert.equal(delivered,1);assert.equal(sender.pending.size,1);sender.pump(now+1200);assert.equal(delivered,1);assert.equal(sender.pending.size,0);
sender.send({description:{type:'offer',sdp:'second'}});assert.equal(delivered,2);assert.equal(sender.pending.size,0);sender.close();receiver.close();sender.send({});assert.equal(sender.pending.size,0);
console.log('PASS signaling: lost offer and lost acknowledgement recover without duplicate SDP application; close clears retries');
