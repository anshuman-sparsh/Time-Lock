import { Box3, Vector3 } from 'three';
import { Health } from '../combat/Damage';
import { combatSettings as config } from '../combat/config';
import { nearestWall, rayBoxDistance } from '../combat/geometry';
import type { EnemyKind } from '../levels/rooms';
import type { ProjectileOptions } from '../combat/ProjectilePool';
import { difficulties } from '../combat/difficulty';
import type { Difficulty } from '../combat/difficulty';
import { EnemyMotion } from './EnemyMotion';

export type GunnerState = 'IDLE' | 'AIMING' | 'FIRING' | 'RECOVERING' | 'CHARGING' | 'BEAM' | 'DEAD';
export class Gunner {
  readonly health: Health;
  kind: EnemyKind = 'gunner';
  difficulty:Difficulty=difficulties.MEDIUM;
  private readonly home:Vector3;
  private readonly motion:EnemyMotion;
  protected peers:readonly Gunner[]=[];
  shieldActive = false;
  coreOpen = true;
  phase = 1;
  beamAngle = 0;
  beamActive = false;
  beamWarning = false;
  readonly body = new Box3();
  readonly head = new Box3();
  readonly muzzle = new Vector3();
  readonly direction = new Vector3();
  readonly aimPoint = new Vector3();
  private readonly towardPlayer = new Vector3();
  state: GunnerState = 'IDLE';
  timer = 0; yaw = 0; flash = 0; deathTime = 0; shots = 0;
  constructor(readonly position: Vector3, readonly index: number, hp = config.enemyHealth) { this.home=position.clone();this.motion=new EnemyMotion(this.home,index);this.health = new Health(hp); this.resetBase(); }
  reset() {
    this.resetBase();
  }
  protected resetBase() {
    this.position.copy(this.home);this.motion.reset();
    this.health.reset(); this.state = 'IDLE'; this.timer = this.index * 0.28;
    this.yaw = this.flash = this.deathTime = this.shots = 0;
    this.body.min.copy(this.position).add(new Vector3(-0.38, 0.25, -0.28));
    this.body.max.copy(this.position).add(new Vector3(0.38, 1.45, 0.28));
    this.head.min.copy(this.position).add(new Vector3(-0.25, 1.45, -0.25));
    this.head.max.copy(this.position).add(new Vector3(0.25, 1.95, 0.25));
    this.muzzle.copy(this.position).add(new Vector3(0, 1.38, 0));
    this.aimPoint.copy(this.muzzle); this.direction.set(0, 0, 1);
  }
  move(dt:number,eye:Vector3,walls:readonly Box3[],peers:readonly Gunner[]){
    this.peers=peers;
    this.motion.update(this,dt,eye,walls,peers);
    if(this.kind!=='drone'&&this.kind!=='warden')this.syncHitboxes(this.kind==='sentinel'?0.6:0.38,this.kind==='sentinel'?2.5:1.95);
  }
  protected syncHitboxes(width = 0.38, height = 1.95) {
    const p = this.position;
    this.body.min.set(p.x-width,p.y+0.25,p.z-width*0.75); this.body.max.set(p.x+width,p.y+height-0.5,p.z+width*0.75);
    this.head.min.set(p.x-width*0.66,p.y+height-0.5,p.z-width*0.66); this.head.max.set(p.x+width*0.66,p.y+height,p.z+width*0.66);
    this.muzzle.set(p.x,p.y+height*0.708,p.z);
  }
  receiveHit(amount: number, _origin: Vector3, _headshot: boolean) { return this.hit(amount); }
  raycast(origin:Vector3,direction:Vector3,maximum:number) {
    const body=rayBoxDistance(origin,direction,this.body,maximum),head=rayBoxDistance(origin,direction,this.head,maximum);
    return {distance:this.kind==='warden'&&head<Infinity?head:Math.min(body,head),headshot:this.kind==='warden'?head<Infinity:head<=body};
  }
  hit(amount: number) {
    if (!this.health.damage(amount)) return false;
    this.flash = 0.18;
    if (!this.health.alive) { this.state = 'DEAD'; this.deathTime = 0; }
    return true;
  }
  update(worldDelta: number, playerEye: Vector3, walls: readonly Box3[], fire: (origin: Vector3, direction: Vector3, options?: ProjectileOptions) => void, _melee?: (damage: number) => void) {
    this.flash = Math.max(0, this.flash - worldDelta);
    if (!this.health.alive) { this.deathTime += worldDelta; return; }
    this.towardPlayer.copy(playerEye).sub(this.muzzle);
    const distance = this.towardPlayer.length();
    this.towardPlayer.normalize();
    const visible = distance < config.detectionRange && nearestWall(this.muzzle, this.towardPlayer, distance, walls) >= distance;
    if (!visible) { this.state = 'IDLE'; this.timer = 0; return; }
    const targetYaw = Math.atan2(this.towardPlayer.x, this.towardPlayer.z);
    const difference = Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw));
    this.yaw += difference * (1 - Math.exp(-worldDelta * 8));
    this.timer -= worldDelta/(this.state==='AIMING'?this.difficulty.aim:this.state==='RECOVERING'?this.difficulty.recovery:1);
    if (this.state === 'IDLE' && this.timer <= 0) {
      this.state = 'AIMING'; this.timer = config.aimDuration;
      // Commit to a visible aim point. No perfect last-frame tracking: strafing can dodge.
      this.aimPoint.copy(playerEye); this.aimPoint.y -= 0.3;
      this.aimPoint.x += Math.sin(this.index * 2 + this.shots * 1.7) * 0.18*this.difficulty.spread;
      this.direction.copy(this.aimPoint).sub(this.muzzle).normalize();
    } else if (this.state === 'AIMING' && this.timer <= 0) {
      // Recheck the committed firing path: cover must stop the shot, even after aim begins.
      if (nearestWall(this.muzzle, this.direction, this.muzzle.distanceTo(this.aimPoint), walls, config.projectileRadius) === Infinity)
        fire(this.muzzle, this.direction);
      this.state = 'FIRING'; this.timer = 0.08; this.shots++;
    } else if (this.state === 'FIRING' && this.timer <= 0) {
      this.state = 'RECOVERING'; this.timer = config.recoveryDuration;
    } else if (this.state === 'RECOVERING' && this.timer <= 0) this.state = 'IDLE';
  }
}
