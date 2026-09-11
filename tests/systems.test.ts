import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { PlayerController } from '../src/player/PlayerController';
import { TimeManager } from '../src/core/TimeManager';
import { settings } from '../src/config';

const idle = { x:0,z:0,jump:false,dash:false };
const inactive = { input:0,speed:0,angularSpeed:0,airborne:false };
function fixture() { const world = new CollisionWorld(); world.add(0,-0.5,0,100,1,100); return { world, player:new PlayerController(world,()=>{}) }; }
function run(player: PlayerController, seconds: number, input = idle, hz = 60) { for(let i=0;i<Math.round(seconds*hz);i++) player.update(1/hz,input); }

test('time settles near frozen and wakes smoothly, using distinct clocks',()=>{
  const time = new TimeManager(); time.update(1/60,{...inactive,input:1});
  assert.ok(time.scale>0.02 && time.scale<0.5);
  for(let i=0;i<120;i++) time.update(1/60,{...inactive,input:1});
  assert.ok(time.scale>0.99);
  for(let i=0;i<120;i++) time.update(1/60,inactive);
  assert.ok(Math.abs(time.scale-0.02)<0.0001);
  assert.ok(time.worldDelta<time.realDelta/40);
});
test('camera deadzone, airborne activity, overlapping bursts, and delta clamp',()=>{
  const time = new TimeManager(); time.update(1/60,{...inactive,angularSpeed:0.1}); assert.equal(time.target,0.02);
  time.update(1/60,{...inactive,angularSpeed:4}); assert.equal(time.target,1);
  time.update(1/60,{...inactive,airborne:true}); assert.ok(time.target>0.75);
  time.requestActivityBurst(0.1,1); time.requestActivityBurst(0.8,0.3);
  for(let i=0;i<15;i++)time.update(1/60,inactive);
  assert.ok(time.activity<0.31 && time.activity>0.29);
  time.update(100,inactive); assert.equal(time.realDelta,0.05);
  time.update(NaN,inactive); assert.equal(time.realDelta,0);
});
test('temporal interpolation is frame rate independent',()=>{
  const scales = [30,60,144].map(hz=>{const time=new TimeManager();for(let i=0;i<hz;i++)time.update(1/hz,{...inactive,input:1});return time.scale;});
  assert.ok(Math.max(...scales)-Math.min(...scales)<1e-10);
});
test('diagonal speed equals cardinal speed; stop has no drift',()=>{
  const a=fixture().player,b=fixture().player;
  run(a,1,{...idle,z:-1});run(b,1,{...idle,x:1,z:-1});
  assert.ok(Math.abs(a.velocity.length()-b.velocity.length())<1e-8);
  assert.ok(Math.abs(a.velocity.length()-settings.movementSpeed)<1e-8);
  run(a,1);assert.ok(a.velocity.length()<1e-8);assert.equal(a.position.y,0);
});
test('jump lands, cannot double jump, and can jump again after landing',()=>{
  const {player}=fixture(); player.update(1/60,{...idle,jump:true});assert.ok(player.position.y>0);assert.equal(player.grounded,false);
  const initial=player.velocity.y;player.update(1/60,{...idle,jump:true});assert.ok(player.velocity.y<initial);
  run(player,1.5);assert.equal(player.position.y,0);assert.equal(player.grounded,true);
  player.update(1/60,{...idle,jump:true});assert.ok(player.velocity.y>0);
});
test('dash cannot tunnel through a thin wall or bypass cooldown',()=>{
  const {world,player}=fixture();world.add(0,2,7,10,4,0.1);
  player.update(1/60,{...idle,z:-1,dash:true});run(player,0.4,{...idle,z:-1});
  assert.ok(player.position.z>=7.37-1e-8);
  const cooldown=player.cooldown;player.update(1/60,{...idle,dash:true});assert.ok(player.cooldown<cooldown);assert.equal(player.dashRemaining,0);
  run(player,2);player.update(1/60,{...idle,dash:true});assert.ok(player.dashRemaining>0);
});
test('corners stop both axes and high speed falls land on a platform',()=>{
  const world=new CollisionWorld();world.add(2,2,0,0.1,4,20);world.add(0,2,2,20,4,0.1);
  const pos=new Vector3(0,0,0),velocity=new Vector3(100,0,100);world.move(pos,velocity,0.05);
  assert.ok(pos.x<=1.63+1e-8 && pos.z<=1.63+1e-8);
  world.add(0,0.5,0,2,1,2);pos.set(0,5,0);velocity.set(0,-200,0);
  assert.equal(world.move(pos,velocity,0.05),true);assert.equal(pos.y,1);
});
test('dash ends without permanent speed boost; direction follows look',()=>{
  const {player}=fixture();player.yaw=Math.PI/2;player.update(1/60,{...idle,dash:true});assert.ok(player.velocity.x<0);
  run(player,0.5);assert.ok(Math.hypot(player.velocity.x,player.velocity.z)<=settings.movementSpeed);
  run(player,1);assert.equal(player.velocity.length(),0);
  player.look(0,100000);assert.ok(player.pitch>-Math.PI/2);
});
test('walking off a platform falls; low ceilings prevent upward clipping',()=>{
  const {world,player}=fixture();world.add(0,0.5,9,2,1,2);player.position.y=1;
  run(player,0.6,{...idle,x:1});assert.ok(player.position.y<1);run(player,1);assert.equal(player.position.y,0);
  world.add(player.position.x,2.2,player.position.z,4,0.2,4);
  player.update(1/60,{...idle,jump:true});run(player,0.1);assert.ok(player.position.y+1.75<=2.1+1e-8);
});
