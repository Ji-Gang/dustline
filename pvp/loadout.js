/* PvP equipment; offline arsenal remains unchanged. */
(function(root){const C=typeof module==='object'&&module.exports?require('../core.js'):root.Tactical;
C.WEAPONS.knife={name:'战术匕首',type:'近战',category:'melee',slot:2,melee:true,scope:0,price:0,damage:45,head:1,mag:1,reserve:0,rate:.55,reload:0,kick:0,spread:0,speed:7.2,auto:true,range:2.1,color:'#aab6bf'};
Object.assign(C.WEAPONS.usp,{name:'SERVICE PISTOL',type:'制式手枪',suppressed:false});Object.assign(C.WEAPONS.scout,{name:'RIFLE 7.62',type:'栓动步枪'});
C.LADDER=['knife','usp','deagle','mp5','p90','m4','ak','m249'];C.KILLS_PER_TIER=2;
})(globalThis);
