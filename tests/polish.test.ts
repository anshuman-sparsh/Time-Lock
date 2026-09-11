import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Box3 } from 'three';
import { Archetype } from '../src/enemies/Archetype';
import { Encounter } from '../src/combat/Encounter';
import { TimeManager } from '../src/core/TimeManager';
import { LevelManager } from '../src/levels/LevelManager';
import { difficulties } from '../src/combat/difficulty';
import { rooms } from '../src/levels/rooms';
import { Warden } from '../src/enemies/Warden';

test('Three-second room countdown advances once and menu return cancels it',()=>{
 const loaded:number[]=[];const level=new LevelManager(index=>loaded.push(index));level.begin();level.next(3);
 for(const remaining of [2,1]){level.update(1);assert.equal(level.transitionRemaining,remaining);assert.equal(level.index,0);}
 level.update(1);assert.equal(level.index,1);assert.equal(level.mode,'ROOM');level.update(1);assert.deepEqual(loaded,[0,1]);
 level.next(3);level.returnToMenu();level.update(4);assert.equal(level.index,1);assert.deepEqual(loaded,[0,1]);
});

test('Drone visible body corners and wings remain hittable at every yaw and flight position',()=>{
 const drone=new Archetype(new Vector3(2,3,-4),0,'drone');
 for(const elapsed of [0,0.02,1,4]){
  drone.update(elapsed,new Vector3(0,1.6,8),[],()=>{});
  for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI,5.7]){
   drone.yaw=yaw;
   for(const [x,y] of [[0,0.5],[0.44,0.71],[0.79,0.5],[-0.79,0.5]]){
    const origin=new Vector3(x,y,4).applyAxisAngle(new Vector3(0,1,0),yaw).add(drone.position);
    const direction=new Vector3(0,0,-1).applyAxisAngle(new Vector3(0,1,0),yaw);
    assert.ok(Number.isFinite(drone.raycast(origin,direction,10).distance));
   }
   const origin=new Vector3(0,0.9,4).applyAxisAngle(new Vector3(0,1,0),yaw).add(drone.position);
   assert.equal(drone.raycast(origin,new Vector3(0,0,-1).applyAxisAngle(new Vector3(0,1,0),yaw),10).distance,Infinity);
  }
 }
});
test('Vertical Threat Drone dies to either weapon, clears as final enemy and respawns on retry',()=>{
 const spawn=rooms.flatMap(room=>room.enemies).find(enemy=>enemy.kind==='drone')!;
 for(const weapon of [1,2] as const)for(const range of [3,22]){
  const enc=new Encounter([],new TimeManager());enc.configure([spawn],true,false);enc.start();enc.switchWeapon(weapon);
  const drone=enc.enemies[0];enc.updateWorld(0.02,new Vector3(0,1.6,9),new Vector3(0,0,9));
  const target=drone.position.clone().add(new Vector3(0,0.5,0)),origin=target.clone().add(new Vector3(0,0,range));
  const health=drone.health.current;enc.fire(origin,target.clone().sub(origin).normalize());assert.ok(drone.health.current<health);
  for(let n=0;drone.health.alive&&n<40;n++){enc.weapon.ammo=5;enc.updateReal(1);enc.fire(origin,target.clone().sub(origin).normalize());}
  assert.equal(enc.remaining,0);assert.equal(enc.state,'CLEARED');enc.reset();assert.equal(enc.remaining,1);assert.ok(enc.enemies[0].health.alive);
 }
});
test('Ground roles move in world time, respect walls and restore spawn',()=>{
 const eye=new Vector3(0,1.6,12),walls=[new Box3(new Vector3(-30,-1,-30),new Vector3(30,0,30)),new Box3(new Vector3(2,0,-30),new Vector3(2.05,5,30))];
 for(const kind of ['gunner','marksman','sentinel','charger'] as const){
  const enemy=new Archetype(new Vector3(),0,kind);enemy.state='RECOVERING';
  enemy.move(0,eye,walls,[enemy]);assert.equal(enemy.position.length(),0);
  for(let n=0;n<100;n++)enemy.move(0.01,eye,walls,[enemy]);assert.ok(enemy.position.length()>0.1,kind);
  for(let n=0;n<2000;n++)enemy.move(0.01,eye,walls,[enemy]);assert.ok(enemy.position.x<2);assert.ok(Math.abs(enemy.position.z)<16.7);
  enemy.reset();assert.equal(enemy.position.length(),0);
 }
});
test('Campaign difficulty stays fixed through retry and transition without health inflation',()=>{
 assert.deepEqual([difficulties.LOW.damage,difficulties.MEDIUM.damage,difficulties.HARD.damage],[4,5,5.6]);
 for(const name of ['LOW','MEDIUM','HARD'] as const){
  const level=new LevelManager(()=>{});level.selectDifficulty(name);level.begin();level.selectDifficulty(name==='LOW'?'HARD':'LOW');level.retry();level.next();level.update(1);assert.equal(level.difficulty.name,name);
  const enc=new Encounter([],new TimeManager());enc.configure([{kind:'drone',x:0,y:2,z:0}],false,false,difficulties[name]);assert.equal(enc.enemies[0].health.current,85);enc.start();enc.damagePlayer(10);assert.equal(enc.health.current,100-10*difficulties[name].damage);
 }
 assert.ok(difficulties.LOW.projectile<difficulties.MEDIUM.projectile&&difficulties.MEDIUM.projectile<difficulties.HARD.projectile);
 assert.ok(difficulties.LOW.aim>difficulties.HARD.aim);assert.ok(difficulties.LOW.spread>difficulties.HARD.spread);assert.ok(difficulties.LOW.movement<difficulties.HARD.movement);
});
test('Normal movement nearly freezes with scaled worldDelta and charging stops before other bodies',()=>{
 const eye=new Vector3(0,1.6,12);
 for(const kind of ['gunner','marksman','sentinel','charger','drone'] as const){
  const slow=new Archetype(new Vector3(0,kind==='drone'?2:0,0),0,kind),fast=new Archetype(slow.position.clone(),0,kind),home=slow.position.clone();
  slow.state=fast.state='RECOVERING';
  for(let n=0;n<50;n++)for(const [enemy,dt] of [[slow,0.0004],[fast,0.02]] as const){if(kind==='drone')enemy.update(dt,eye,[],()=>{});else enemy.move(dt,eye,[],[enemy]);}
  assert.ok(slow.position.distanceTo(home)<fast.position.distanceTo(home)*0.1,kind);
 }
 const charger=new Archetype(new Vector3(),0,'charger'),peer=new Archetype(new Vector3(0,0,2),1,'gunner');
 charger.move(0,eye,[],[charger,peer]);charger.state='CHARGING';charger.direction.set(0,0,1);charger.timer=1;
 charger.update(0.3,eye,[],()=>{});assert.ok(charger.position.distanceTo(peer.position)>=1.1);assert.equal(charger.state,'RECOVERING');
});
test('Warden keeps health constant while LOW lengthens and HARD shortens telegraphs',()=>{
 const durations:number[]=[];
 for(const name of ['LOW','MEDIUM','HARD'] as const){
  const boss=new Warden(new Vector3(0,0,-8),0);boss.difficulty=difficulties[name];let shots=0,elapsed=0;
  while(!shots&&elapsed<10){boss.update(0.01,new Vector3(0,1.6,8),[],()=>shots++);elapsed+=0.01;}
  assert.ok(shots>0);assert.equal(boss.health.current,900);durations.push(elapsed);
 }
 assert.ok(durations[0]>durations[1]&&durations[1]>durations[2]);
});


