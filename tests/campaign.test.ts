import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3,Vector3 } from 'three';
import { Archetype } from '../src/enemies/Archetype';
import { Warden } from '../src/enemies/Warden';
import { Encounter } from '../src/combat/Encounter';
import { TimeManager } from '../src/core/TimeManager';
import { LevelManager } from '../src/levels/LevelManager';
import { rooms } from '../src/levels/rooms';
import { Scattergun } from '../src/weapons/Scattergun';
import { synthesizeSound } from '../src/core/sound';
const eye=new Vector3(0,1.6,7);
test('Charger telegraphs, freezes, sweeps melee once, recovers and resets',()=>{
 const enemy=new Archetype(new Vector3(),0,'charger');let hits=0;
 const ground=[new Box3(new Vector3(-30,-1,-30),new Vector3(30,0,30))];
 enemy.update(0.01,eye,ground,()=>{},()=>hits++);assert.equal(enemy.state,'AIMING');
 for(let i=0;i<70;i++)enemy.update(0.01,eye,ground,()=>{},()=>hits++);
 const position=enemy.position.clone();enemy.update(0,eye,ground,()=>{},()=>hits++);assert.deepEqual(enemy.position,position);
 for(let i=0;i<130;i++)enemy.update(0.01,eye,ground,()=>{},()=>hits++);
 assert.equal(hits,1);assert.equal(enemy.state,'RECOVERING');enemy.reset();assert.equal(enemy.position.length(),0);
});
test('Charger stops at thin walls without attacking through cover',()=>{
 const enemy=new Archetype(new Vector3(),0,'charger');let hits=0;
 for(let i=0;i<70;i++)enemy.update(0.01,eye,[],()=>{},()=>hits++);
 const walls=[new Box3(new Vector3(-4,-1,2),new Vector3(4,4,2.05))];
 for(let i=0;i<200;i++)enemy.update(0.01,eye,walls,()=>{},()=>hits++);
 assert.ok(enemy.position.z<2);assert.equal(hits,0);
});
test('Marksman locks aim before firing a visible high-damage projectile',()=>{
 const enemy=new Archetype(new Vector3(),0,'marksman');const shots:any[]=[];
 for(let i=0;i<100;i++)enemy.update(0.01,eye,[],(o,d,p)=>shots.push(p));
 const aim=enemy.aimPoint.clone();enemy.update(0.01,new Vector3(4,1.6,7),[],()=>{});assert.deepEqual(enemy.aimPoint,aim);
 for(let i=0;i<40;i++)enemy.update(0.01,eye,[],(o,d,p)=>shots.push(p));
 assert.equal(shots.length,1);assert.equal(shots[0].speed,13);assert.equal(shots[0].damage,40);
});
test('Drone motion stays bounded, freezes at zero dt and emits three spaced shots',()=>{
 const enemy=new Archetype(new Vector3(0,2,0),0,'drone');let shots=0;
 for(let i=0;i<130;i++)enemy.update(0.01,eye,[],()=>shots++);
 assert.equal(shots,3);const pos=enemy.position.clone();enemy.update(0,eye,[],()=>shots++);assert.deepEqual(pos,enemy.position);
 for(let i=0;i<3000;i++)enemy.update(0.01,eye,[],()=>{});
 assert.ok(Math.abs(enemy.position.x)<=1.8&&Math.abs(enemy.position.y-2)<=0.31);enemy.reset();assert.equal(enemy.position.y,2);
});
test('Sentinel shield blocks frontal body shots but permits head/flank/open shots',()=>{
 const enemy=new Archetype(new Vector3(),0,'sentinel');
 assert.equal(enemy.receiveHit(34,eye,false),false);assert.equal(enemy.receiveHit(34,eye,true),true);
 assert.equal(enemy.receiveHit(34,new Vector3(0,1,-5),false),true);
 for(let i=0;i<280;i++)enemy.update(0.01,eye,[],()=>{});
 assert.equal(enemy.shieldActive,false);assert.equal(enemy.receiveHit(34,eye,false),true);enemy.reset();assert.equal(enemy.health.current,230);
});
test('Scattergun unlock, reload switching guard, falloff and retry inventory',()=>{
 const time=new TimeManager(),encounter=new Encounter([],time);encounter.start();assert.equal(encounter.switchWeapon(2),false);
 encounter.scatterUnlocked=true;assert.equal(encounter.switchWeapon(2),true);assert.equal(encounter.weapon.ammo,5);
 encounter.fire(eye,new Vector3(0,0,-1));encounter.reload();assert.equal(encounter.switchWeapon(1),false);
 encounter.updateReal(2);assert.equal(encounter.weapon.ammo,5);assert.equal(encounter.switchWeapon(1),true);
 assert.ok(Scattergun.damageAt(3)>Scattergun.damageAt(20)*3);encounter.reset();assert.equal(encounter.activeWeapon,1);assert.equal(encounter.scatterUnlocked,true);
});
test('Warden phases, vulnerability, telegraphed world-time beam and no postmortem attacks',()=>{
 const boss=new Warden(new Vector3(0,0,-8),0);let shots=0;
 assert.equal(boss.receiveHit(68,eye,true),false);boss.coreOpen=true;assert.equal(boss.receiveHit(68,eye,false),false);
 boss.health.current=600;boss.update(0.01,eye,[],()=>shots++);assert.equal(boss.phase,2);
 let warned=false,beamed=false;
 for(let i=0;i<1600;i++){boss.update(0.01,eye,[],()=>shots++);warned ||=boss.beamWarning;beamed ||=boss.beamActive;}
 assert.ok(warned&&beamed);const angle=boss.beamAngle;boss.update(0,eye,[],()=>shots++);assert.equal(angle,boss.beamAngle);
 boss.health.current=290;boss.update(0.01,eye,[],()=>shots++);assert.equal(boss.phase,3);
 boss.hit(1000);const count=shots;boss.update(1,eye,[],()=>shots++);assert.equal(shots,count);assert.equal(boss.beamActive,false);
 boss.reset();assert.equal(boss.health.current,900);assert.equal(boss.phase,1);
});
test('Campaign flows tutorial through five rooms, unlock, boss and ending with room checkpoints',()=>{
 const loaded:number[]=[];const level=new LevelManager(index=>loaded.push(index));level.begin();
 level.calibrate(1,3,1);assert.equal(level.tutorial,'STOP');level.calibrate(1,0,0.02);assert.equal(level.tutorial,'FIRE');
 for(let i=0;i<6;i++){level.roomCleared();level.next();level.update(1);assert.equal(level.index,i+1);level.retry();assert.equal(level.index,i+1);}
 assert.equal(level.scatterUnlocked,true);level.roomCleared();assert.equal(level.mode,'ENDING');level.update(4);assert.equal(level.endingElapsed,4);
 level.begin();assert.equal(level.index,0);assert.equal(level.scatterUnlocked,false);assert.equal(rooms.length,7);
});
test('Each room resets living enemies and can reach clear via its real damage API',()=>{
 const encounter=new Encounter([],new TimeManager());
 for(const room of rooms){encounter.configure(room.enemies,true,!!room.tutorial);encounter.tutorialCanFire=true;encounter.start();
   for(const enemy of encounter.enemies){enemy.coreOpen=true;enemy.shieldActive=false;const origin=enemy.position.clone().add(new Vector3(0,1.7,4));
     const target=enemy.kind==='warden'?enemy.head.getCenter(new Vector3()):enemy.body.getCenter(new Vector3());
     for(let shot=0;enemy.health.alive&&shot<70;shot++){encounter.pistol.ammo=8;encounter.updateReal(0.25);encounter.fire(origin,target.clone().sub(origin).normalize());}
     assert.equal(enemy.health.alive,false,room.name+' '+enemy.kind);
   }
   assert.equal(encounter.state,'CLEARED');encounter.reset();assert.equal(encounter.remaining,room.enemies.length);assert.equal(encounter.projectiles.count,0);
 }
});
test('Layered audio is deterministic, finite, audible and has peak headroom',()=>{
 for(const name of ['fire','scatter','reload','enemyShot','victory','death','charge','lock'] as const){
  const samples=synthesizeSound(name,24000);let sum=0,peak=0;for(const v of samples){assert.ok(Number.isFinite(v));sum+=v*v;peak=Math.max(peak,Math.abs(v));}
  assert.ok(peak<=0.751&&peak>0.7);assert.ok(Math.sqrt(sum/samples.length)>0.045);assert.deepEqual(samples,synthesizeSound(name,24000));
 }
});
