import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { PulsePistol } from '../src/weapons/PulsePistol';
import { TimeManager } from '../src/core/TimeManager';
import { Encounter } from '../src/combat/Encounter';
import { Gunner } from '../src/enemies/Gunner';
import { ProjectilePool } from '../src/combat/ProjectilePool';
import { Health } from '../src/combat/Damage';
import { PlayerController } from '../src/player/PlayerController';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { combatSettings as config } from '../src/combat/config';
import { nearestWall } from '../src/combat/geometry';

const feet = new Vector3(0, 0, 9), eye = new Vector3(0, 1.6, 9);
const idle = { input: 0, speed: 0, angularSpeed: 0, airborne: false };
function fixture(walls: Box3[] = []) {
  const time = new TimeManager(), events: string[] = [];
  const encounter = new Encounter(walls, time, event => events.push(event)); encounter.start();
  return { time, encounter, events };
}
function shoot(encounter: Encounter, index = 0, head = false) {
  const target = encounter.enemies[index].position.clone(); target.y += head ? 1.7 : 1.05;
  encounter.updateReal(config.fireDelay + 0.001);
  return encounter.fire(eye, target.sub(eye).normalize());
}

test('pistol fire cadence, empty magazine, full reload and fire lockout', () => {
  const pistol = new PulsePistol(); assert.equal(pistol.reload(), false);
  assert.equal(pistol.fire(), true); assert.equal(pistol.fire(), false);
  for (let i = 1; i < 8; i++) { pistol.update(0.22); assert.equal(pistol.fire(), true); }
  pistol.update(0.22); assert.equal(pistol.fire(), false); assert.equal(pistol.ammo, 0);
  assert.equal(pistol.reload(), true); assert.equal(pistol.reload(), false);
  pistol.update(1); assert.equal(pistol.fire(), false); assert.equal(pistol.ammo, 0);
  pistol.update(0.31); assert.equal(pistol.ammo, 8); assert.equal(pistol.fire(), true);
});
test('reload is real-time even at locked time; pause leaves state unchanged', () => {
  const { encounter, time } = fixture(); shoot(encounter); encounter.reload();
  const remaining = encounter.weapon.reloadRemaining;
  time.update(0.05, idle); assert.equal(encounter.weapon.reloadRemaining, remaining);
  for (let i = 0; i < 80; i++) encounter.updateReal(1 / 60);
  assert.equal(encounter.weapon.ammo, 8); assert.equal(encounter.weapon.state, 'READY');
});
test('hitscan damages body/head, fires temporal bursts, and cannot penetrate cover', () => {
  const { encounter, time, events } = fixture(); shoot(encounter);
  assert.equal(encounter.enemies[0].health.current, 66); assert.ok(events.includes('hit'));
  time.update(1 / 60, idle); assert.equal(time.target, 1);
  shoot(encounter, 0, true); assert.equal(encounter.enemies[0].state, 'DEAD'); assert.ok(events.includes('headshot'));
  const wall = new Box3(new Vector3(-10, 0, 2), new Vector3(10, 4, 2.1));
  const blocked = fixture([wall]); shoot(blocked.encounter);
  assert.equal(blocked.encounter.enemies[0].health.current, 100); assert.ok(blocked.events.includes('impact'));
});
test('three body hits kill; final kill clears bullets, disables combat, and emits victory once', () => {
  const { encounter, events } = fixture();
  encounter.projectiles.spawn(new Vector3(0, 1, 0), new Vector3(0, 0, 1));
  for (let i = 0; i < 3; i++) shoot(encounter);
  assert.equal(encounter.remaining, 1);
  for (let i = 0; i < 3; i++) shoot(encounter, 1);
  assert.equal(encounter.state, 'CLEARED'); assert.equal(encounter.projectiles.count, 0);
  assert.equal(shoot(encounter), false); encounter.damagePlayer(); assert.equal(encounter.health.current, 100);
  assert.equal(events.filter(event => event === 'victory').length, 1);
});
test('four hits kill player once; death prevents firing/reload/damage and reset is comprehensive', () => {
  const { encounter, time, events } = fixture(); shoot(encounter); encounter.reload();
  encounter.enemies[0].hit(34); encounter.projectiles.spawn(eye, new Vector3(0, 0, -1));
  for (let i = 0; i < 8; i++) encounter.damagePlayer();
  assert.equal(encounter.health.current, 0); assert.equal(encounter.state, 'DEAD'); assert.equal(encounter.projectiles.count, 0);
  assert.equal(events.filter(event => event === 'death').length, 1); assert.equal(shoot(encounter), false);
  encounter.reset(); assert.equal(encounter.state, 'READY'); assert.equal(encounter.health.current, 100);
  assert.equal(encounter.weapon.ammo, 8); assert.equal(encounter.weapon.reloadRemaining, 0);
  assert.equal(encounter.remaining, 2); assert.equal(encounter.enemies[0].state, 'IDLE'); assert.equal(encounter.enemies[0].health.current, 100);
  assert.equal(time.scale, 0.02); time.update(0.01, idle); assert.equal(time.activity, 0);
  encounter.start(); assert.equal(shoot(encounter), true);
});
test('retry during active reload resets weapon, dash, position, look and time', () => {
  const { encounter } = fixture(); const collision = new CollisionWorld(); collision.add(0, -0.5, 0, 100, 1, 100);
  const player = new PlayerController(collision, () => {});
  player.look(100, 100); player.update(0.05, { x: 1, z: 0, dash: true, jump: true });
  shoot(encounter); encounter.reload(); encounter.reset(); player.reset();
  assert.equal(encounter.weapon.reloadRemaining, 0); assert.equal(encounter.weapon.cooldown, 0);
  assert.deepEqual(player.position, feet); assert.equal(player.velocity.length(), 0); assert.equal(player.cooldown, 0);
  assert.equal(player.dashRemaining, 0); assert.equal(player.pitch, 0); assert.equal(player.yaw, 0);
});
test('Gunner telegraphs, commits its aim, fires and recovers using world time', () => {
  const enemy = new Gunner(new Vector3(0, 0, 0), 0); let shots = 0;
  const fire = () => shots++;
  enemy.update(0.01, eye, [], fire); assert.equal(enemy.state, 'AIMING');
  const aim = enemy.aimPoint.clone(); const timer = enemy.timer;
  enemy.update(0, new Vector3(3, 1.6, 9), [], fire); assert.equal(enemy.timer, timer); assert.deepEqual(enemy.aimPoint, aim);
  for (let i = 0; i < 60; i++) enemy.update(0.02 / 60, eye, [], fire);
  assert.equal(shots, 0); assert.ok(enemy.timer > 0.6);
  for (let i = 0; i < 50; i++) enemy.update(1 / 60, eye, [], fire);
  assert.equal(shots, 1); assert.equal(enemy.state, 'RECOVERING');
  enemy.hit(100); for (let i = 0; i < 300; i++) enemy.update(1 / 60, eye, [], fire);
  assert.equal(shots, 1); assert.equal(enemy.state, 'DEAD');
});
test('Gunner cannot detect/fire through a wall and cancels aim behind cover', () => {
  const enemy = new Gunner(new Vector3(0, 0, 0), 0); let shots = 0;
  const walls = [new Box3(new Vector3(-2, 0, 3), new Vector3(2, 3, 3.1))];
  for (let i = 0; i < 120; i++) enemy.update(1 / 60, eye, walls, () => shots++);
  assert.equal(shots, 0); assert.equal(enemy.state, 'IDLE');
  enemy.update(0.1, eye, [], () => shots++); assert.equal(enemy.state, 'AIMING');
  enemy.update(0.1, eye, walls, () => shots++); assert.equal(enemy.state, 'IDLE');
});
test('projectiles move 50 times farther at full speed than at 0.02 world time', () => {
  const run = (scale: number) => {
    const pool = new ProjectilePool(); pool.spawn(new Vector3(10, 2, 0), new Vector3(0, 0, 1));
    for (let i = 0; i < 60; i++) pool.update(scale / 60, feet, feet, [], () => {}, () => {}, () => {});
    return pool.items[0].position.z;
  };
  assert.ok(Math.abs(run(1) / run(0.02) - 50) < 1e-8);
});
test('swept bullets hit thin world geometry before player and cannot tunnel at high delta', () => {
  const pool = new ProjectilePool(); let hits = 0, impacts = 0;
  pool.spawn(new Vector3(0, 1.2, 0), new Vector3(0, 0, 1));
  const walls = [new Box3(new Vector3(-2, 0, 5), new Vector3(2, 3, 5.01))];
  pool.update(2, feet, feet, walls, () => hits++, () => impacts++, () => {});
  assert.equal(hits, 0); assert.equal(impacts, 1); assert.equal(pool.count, 0);
  pool.spawn(new Vector3(0, 1.2, 0), new Vector3(0, 0, 1));
  pool.update(2, feet, feet, [], () => hits++, () => {}, () => {});
  assert.equal(hits, 1); assert.equal(pool.count, 0);
});
test('real-time player sweep cannot dash through a frozen bullet', () => {
  const pool = new ProjectilePool(); let hits = 0;
  pool.spawn(new Vector3(0, 1.2, 9), new Vector3(0, 0, 1));
  pool.update(0, new Vector3(-2, 0, 9), new Vector3(2, 0, 9), [], () => hits++, () => {}, () => {});
  assert.equal(hits, 1);
});
test('projectile near miss triggers once, pool is bounded, lifetime expires and slots are reused', () => {
  const pool = new ProjectilePool(); let near = 0, hits = 0;
  pool.spawn(new Vector3(0.65, 1.6, 8), new Vector3(0, 0, 1));
  for (let i = 0; i < 120; i++) pool.update(1 / 120, feet, feet, [], () => hits++, () => {}, () => near++);
  assert.equal(hits, 0); assert.equal(near, 1);
  pool.reset(); for (let i = 0; i < config.projectileCapacity; i++) assert.equal(pool.spawn(eye, new Vector3(0, 0, 1)), true);
  assert.equal(pool.spawn(eye, new Vector3(0, 0, 1)), false);
  pool.update(10, feet, feet, [], () => {}, () => {}, () => {}); assert.equal(pool.count, 0);
  assert.equal(pool.spawn(eye, new Vector3(0, 0, 1)), true); assert.equal(pool.items[0].nearMiss, false);
});
test('health ignores invalid/repeated postmortem damage; ray tests handle parallel and inside rays', () => {
  const hp = new Health(100); assert.equal(hp.damage(NaN), false); assert.equal(hp.damage(-1), false);
  hp.damage(1000); assert.equal(hp.current, 0); assert.equal(hp.damage(25), false);
  const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
  assert.equal(nearestWall(new Vector3(), new Vector3(0, 0, 1), 10, [box]), 0);
  assert.equal(nearestWall(new Vector3(2, 0, 0), new Vector3(0, 0, 1), 10, [box]), Infinity);
});
test('encounter enemy attacks and bullet/player collision produce real damage', () => {
  const { encounter, events } = fixture();
  for (let i = 0; i < 360 && encounter.state === 'ACTIVE'; i++) encounter.updateWorld(1 / 60, feet, feet);
  assert.ok(events.includes('aim')); assert.ok(events.includes('enemyShot'));
  assert.ok(encounter.health.current < 100); assert.ok(events.includes('damage'));
});
