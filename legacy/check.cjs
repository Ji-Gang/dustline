// Headless logic smoke checks. Run: node check.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const noop = () => {};
const paint = new Proxy({}, { get: (_, key) => key.startsWith('create') ? () => ({ addColorStop: noop }) : noop, set: () => true });
const elements = new Map();
const element = () => ({ style: {}, classList: { add: noop, remove: noop }, getContext: () => paint, addEventListener: noop, requestPointerLock: async () => {} });
const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element, addEventListener: noop, exitPointerLock: noop };
const context = vm.createContext({ document, window: {}, innerWidth: 1280, innerHeight: 720, addEventListener: noop, requestAnimationFrame: noop, console });
let source = fs.readFileSync(__dirname + '/game.js', 'utf8');
source = source.replace(/\}\)\(\);\s*$/, `
  reset(); state='playing';
  console.assert = (value, message) => { if (!value) throw Error(message); };
  console.assert(enemies.length === 6, 'First wave');
  console.assert(free(p.x,p.y), 'Valid player spawn');
  console.assert(enemies.every(e=>free(e.x,e.y,.28)), 'Valid enemy spawns');
  p={x:2,y:2,a:0,hp:100}; enemies=[{x:4,y:2,hp:2,timer:10,phase:0,hit:0}];
  shoot(); cooldown=0; shoot(); console.assert(kills===1 && enemies.length===0, 'Two shots kill');
  p={x:2,y:3.5,a:0,hp:100}; enemies=[{x:6,y:3.5,hp:2,timer:10,phase:0,hit:0}];cooldown=0;shoot();
  console.assert(enemies[0].hp===2, 'Wall blocks shots');
  beginReload(); update(1.6); console.assert(ammo===30 && reload===0, 'Reload');
  p={x:1.3,y:2,a:0,hp:70};move(p,-1,0);console.assert(p.x===1.3,'Wall collision');
  kits=[{x:p.x,y:p.y}];update(.016);console.assert(p.hp===100 && kits.length===0,'Healing pickup');
  enemies=[];update(.016);update(4.1);console.assert(wave===2 && enemies.length===8,'Wave progression');
  pause();const t=elapsed;update(1);console.assert(elapsed===t && state==='paused','Pause freezes gameplay');
  state='playing';p.hp=0;update(.016);console.assert(state==='over','Game over');
  reset();console.assert(p.hp===100 && ammo===30 && wave===1 && kills===0,'Restart');
  state='playing';render(1);state='menu';render(2);
  for(let i=0;i<500;i++){state='playing';p.hp=100;update(.016);}
  console.assert(enemies.every(e=>Number.isFinite(e.x)&&free(e.x,e.y,.28)),'Enemies remain in walkable space');
  console.log('PASS: spawn, hit detection, wall occlusion, reload, collision, health, waves, pause, game over, restart, render calls, enemy simulation');
})();`);
assert.notEqual(source, fs.readFileSync(__dirname + '/game.js', 'utf8'));
vm.runInContext(source, context);
