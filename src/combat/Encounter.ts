import { Vector3 } from 'three';
import type { Box3 } from 'three';
import { Gunner } from '../enemies/Gunner';
import { PulsePistol } from '../weapons/PulsePistol';
import { Health } from './Damage';
import { ProjectilePool } from './ProjectilePool';
import { combatSettings as config } from './config';
import { nearestWall, rayBoxDistance } from './geometry';
import type { TimeManager } from '../core/TimeManager';
import { Archetype } from '../enemies/Archetype';
import { Warden } from '../enemies/Warden';
import { Scattergun } from '../weapons/Scattergun';
import type { Spawn } from '../levels/rooms';
import { difficulties } from './difficulty';
import type { Difficulty } from './difficulty';

export type CombatEvent = 'fire' | 'scatter' | 'empty' | 'reload' | 'aim' | 'charge' | 'lock' | 'bossPhase' | 'shield' | 'enemyShot' | 'hit' | 'headshot' | 'kill' | 'impact' | 'damage' | 'nearMiss' | 'victory' | 'death';
export class Encounter {
  readonly pistol = new PulsePistol();
  readonly scattergun = new Scattergun();
  activeWeapon: 1 | 2 = 1;
  scatterUnlocked = false;
  get weapon() { return this.activeWeapon === 1 ? this.pistol : this.scattergun; }
  readonly health = new Health(config.playerHealth);
  readonly projectiles = new ProjectilePool();
  readonly enemies: Gunner[] = [new Gunner(new Vector3(-3, 0, -3), 0), new Gunner(new Vector3(4, 0, -7), 1)];
  tutorial = false;
  tutorialCanFire = true;
  difficulty:Difficulty=difficulties.MEDIUM;
  state: 'READY' | 'ACTIVE' | 'DEAD' | 'CLEARED' = 'READY';
  private readonly impact = new Vector3();
  private readonly eye = new Vector3();
  constructor(private walls: readonly Box3[], private time: TimeManager, private event: (event: CombatEvent, position?: Vector3) => void = () => {}) {}
  get remaining() { return this.enemies.reduce((count, enemy) => count + Number(enemy.health.alive), 0); }
  start() { if (this.state === 'READY') this.state = 'ACTIVE'; }
  setWalls(walls: readonly Box3[]) { this.walls=walls; }
  configure(spawns: Spawn[], unlocked = false, tutorial = false, difficulty:Difficulty=difficulties.MEDIUM) {
    this.difficulty=difficulty;
    this.enemies.length=0;
    spawns.forEach((spawn,index)=>{const position=new Vector3(spawn.x,spawn.y??0,spawn.z);this.enemies.push(spawn.kind==='gunner'?new Gunner(position,index):spawn.kind==='warden'?new Warden(position,index):new Archetype(position,index,spawn.kind));});
    for(const enemy of this.enemies)enemy.difficulty=difficulty;
    this.scatterUnlocked=unlocked;this.tutorial=tutorial;this.tutorialCanFire=!tutorial;this.reset();
  }
  switchWeapon(slot:1|2) {
    if(this.state!=='ACTIVE' || this.weapon.reloadRemaining>0 || slot===2 && !this.scatterUnlocked)return false;
    this.activeWeapon=slot;return true;
  }
  reset() {
    this.health.reset(); this.pistol.reset(); this.scattergun.reset(); this.activeWeapon=1; this.projectiles.reset(); this.time.reset();
    for (const enemy of this.enemies) enemy.reset();
    this.state = 'READY';
  }
  updateReal(realDelta: number) { if (this.state === 'ACTIVE') { this.pistol.update(realDelta);this.scattergun.update(realDelta); } }
  reload() { if (this.state === 'ACTIVE' && this.weapon.reload()) this.event('reload'); }
  fire(origin: Vector3, direction: Vector3) {
    if (this.state !== 'ACTIVE') return false;
    if (this.tutorial && !this.tutorialCanFire) return false;
    if (!this.weapon.fire()) { if (this.weapon.state === 'EMPTY') this.event('empty'); return false; }
    const scatter=this.activeWeapon===2;
    this.time.requestActivityBurst(scatter?0.55:config.shotBurst, 1); this.event(scatter?'scatter':'fire');
    if(scatter){
      const right=new Vector3().crossVectors(direction,new Vector3(0,1,0));
      if(right.lengthSq()<0.001)right.set(1,0,0);else right.normalize();
      const up=new Vector3().crossVectors(right,direction).normalize();
      for(let i=0;i<7 && this.state==='ACTIVE';i++){
        const angle=i*Math.PI/3,offset=i===0?0:0.07;
        const ray=direction.clone().addScaledVector(right,Math.cos(angle)*offset).addScaledVector(up,Math.sin(angle)*offset).normalize();
        this.trace(origin,ray,true);
      }
    }else this.trace(origin,direction,false);
    return true;
  }
  private trace(origin:Vector3,direction:Vector3,scatter:boolean) {
    let nearest = Math.min(config.shotRange, nearestWall(origin, direction, config.shotRange, this.walls));
    let target: Gunner | undefined, headshot = false;
    for (const enemy of this.enemies) {
      if (!enemy.health.alive) continue;
      const hit=enemy.raycast(origin,direction,nearest);
      if (hit.distance < nearest) { nearest = hit.distance; target = enemy; headshot = hit.headshot; }
    }
    this.impact.copy(origin).addScaledVector(direction, nearest);
    if (target) {
      const damage=(scatter?Scattergun.damageAt(nearest):config.shotDamage)*(headshot?config.headshotMultiplier:1);
      if(!target.receiveHit(damage,origin,headshot)){this.event('shield',this.impact);return;}
      this.event(headshot ? 'headshot' : 'hit', this.impact);
      if (!target.health.alive) this.event('kill', this.impact);
      if (this.remaining === 0) { this.state = 'CLEARED'; this.projectiles.reset(); this.event('victory'); }
    } else if (nearest < config.shotRange) this.event('impact', this.impact);
  }
  damagePlayer(amount = config.projectileDamage) {
    if (this.state !== 'ACTIVE' || this.tutorial || !this.health.damage(amount*this.difficulty.damage)) return;
    this.event('damage');
    if (!this.health.alive) { this.state = 'DEAD'; this.projectiles.reset(); this.event('death'); }
  }
  updateWorld(worldDelta: number, previousFeet: Vector3, currentFeet: Vector3) {
    if (this.state !== 'ACTIVE') return;
    this.eye.copy(currentFeet); this.eye.y += 1.6;
    // Existing bullets sweep over this frame. Newly emitted bullets begin moving next frame.
    this.projectiles.update(worldDelta, previousFeet, currentFeet, this.walls,
      amount => this.damagePlayer(amount), position => this.event('impact', position), () => this.event('nearMiss'));
    if (this.state !== 'ACTIVE') return;
    for (const enemy of this.enemies) {
      const previousState = enemy.state;
      const phase=enemy.phase;
      enemy.move(worldDelta,this.eye,this.walls,this.enemies);
      enemy.update(worldDelta, this.eye, this.walls, (origin, direction, options) => {
        if (this.projectiles.spawn(origin, direction,{...options,speed:(options?.speed??config.projectileSpeed)*this.difficulty.projectile})) this.event('enemyShot', origin);
      }, amount=>this.damagePlayer(amount));
      if(enemy.phase!==phase){this.projectiles.reset();this.event('bossPhase');}
      if (enemy.state === 'AIMING' && previousState !== 'AIMING') this.event(enemy.kind==='charger'?'charge':enemy.kind==='marksman'?'lock':'aim', enemy.muzzle);
    }
  }
}
