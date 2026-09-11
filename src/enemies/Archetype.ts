import { Vector3 } from 'three';
import type { Box3 } from 'three';
import { Gunner } from './Gunner';
import { nearestWall, rayBoxDistance } from '../combat/geometry';
import { droneBoxes } from './droneShape';
import type { ProjectileOptions } from '../combat/ProjectilePool';
import type { EnemyKind } from '../levels/rooms';
import { CollisionWorld } from '../world/CollisionWorld';

type Fire = (origin: Vector3, direction: Vector3, options?: ProjectileOptions) => void;
export class Archetype extends Gunner {
  private readonly spawn: Vector3;
  private readonly velocity = new Vector3();
  private readonly oldPosition = new Vector3();
  private readonly target = new Vector3();
  private readonly collision = new CollisionWorld();
  private elapsed = 0;
  private burstLeft = 0;
  private meleeUsed = false;
  private readonly rayOrigin=new Vector3();
  private readonly rayDirection=new Vector3();
  override raycast(origin:Vector3,direction:Vector3,maximum:number) {
    if(this.kind!=='drone')return super.raycast(origin,direction,maximum);
    this.rayOrigin.copy(origin).sub(this.position);this.rayDirection.copy(direction);
    const c=Math.cos(this.yaw),s=Math.sin(this.yaw);
    for(const vector of [this.rayOrigin,this.rayDirection]){const x=vector.x,z=vector.z;vector.x=c*x-s*z;vector.z=s*x+c*z;}
    let distance=Infinity;for(const box of droneBoxes)distance=Math.min(distance,rayBoxDistance(this.rayOrigin,this.rayDirection,box,maximum));
    return {distance,headshot:false};
  }
  constructor(position: Vector3, index: number, kind: EnemyKind) {
    super(position,index,kind === 'sentinel' ? 230 : kind === 'charger' ? 100 : kind === 'target' ? 34 : 85);
    this.kind = kind; this.spawn = position.clone(); this.reset();
  }
  override reset() {
    this.position.copy(this.spawn); super.reset(); this.elapsed = this.burstLeft = 0; this.meleeUsed = false;
    this.shieldActive = this.kind === 'sentinel'; this.beamWarning = this.beamActive = false;
    this.syncHitboxes(this.kind === 'sentinel' ? 0.6 : 0.38, this.kind === 'sentinel' ? 2.5 : this.kind === 'drone' ? 1 : 1.95);
  }
  override receiveHit(amount: number, origin: Vector3, headshot: boolean) {
    if (this.kind === 'sentinel' && this.shieldActive && !headshot) {
      this.target.copy(origin).sub(this.position).normalize();
      if (this.target.x*Math.sin(this.yaw)+this.target.z*Math.cos(this.yaw)>0.2) return false;
    }
    return this.hit(amount);
  }
  override update(dt: number, eye: Vector3, walls: readonly Box3[], fire: Fire, melee?: (damage: number) => void) {
    this.flash = Math.max(0,this.flash-dt);
    if (!this.health.alive) { this.deathTime += dt; return; }
    if (this.kind === 'target') return;
    this.elapsed += dt;
    if (this.kind === 'drone') {
      this.oldPosition.copy(this.position);
      const flight=this.elapsed*this.difficulty.movement;
      this.position.set(this.spawn.x+Math.sin(flight*0.65+0.15*Math.sin(flight*0.23))*1.8,this.spawn.y+Math.sin(flight*1.3)*0.22+Math.sin(flight*0.41)*0.08,this.spawn.z+(Math.cos(flight*0.65)-1)*0.6);
      this.position.x=Math.max(-14.5,Math.min(14.5,this.position.x));this.position.z=Math.max(-16.5,Math.min(16.5,this.position.z));
      if(walls.some(box=>this.position.x+0.92>box.min.x&&this.position.x-0.92<box.max.x&&this.position.z+0.92>box.min.z&&this.position.z-0.92<box.max.z&&this.position.y+0.725>box.min.y&&this.position.y+0.275<box.max.y))this.position.copy(this.oldPosition);
      this.syncHitboxes(0.55,1);
    }
    this.target.copy(eye).sub(this.muzzle); const distance = this.target.length(); this.target.normalize();
    const visible = distance < 40 && nearestWall(this.muzzle,this.target,distance,walls)>=distance;
    if (this.state !== 'CHARGING') {
      const desired = Math.atan2(this.target.x,this.target.z);
      this.yaw += Math.atan2(Math.sin(desired-this.yaw),Math.cos(desired-this.yaw))*(1-Math.exp(-dt*(this.kind==='sentinel'?1:7)));
    }
    if (this.kind==='sentinel') this.shieldActive = this.elapsed%5 < 2.7;
    this.timer -= dt/(this.state==='AIMING'?this.difficulty.aim:this.state==='RECOVERING'?this.difficulty.recovery:1);
    if (this.state === 'CHARGING') {
      this.oldPosition.copy(this.position);
      this.collision.boxes.length = 0; for (const box of walls) this.collision.boxes.push(box);
      this.velocity.copy(this.direction).multiplyScalar(12*this.difficulty.movement); this.velocity.y = -2;
      this.collision.move(this.position,this.velocity,dt,0.38,1.95); this.syncHitboxes();
      // Swept melee point: a large frame may not skip the player. One hit per rush.
      this.target.copy(this.position).sub(this.oldPosition); const lengthSq=this.target.lengthSq();
      const fraction=lengthSq ? Math.max(0,Math.min(1,eye.clone().sub(this.oldPosition).dot(this.target)/lengthSq)) : 0;
      this.target.multiplyScalar(fraction).add(this.oldPosition); this.target.y+=1.2;
      if (!this.meleeUsed && this.target.distanceTo(eye)<1.1) { melee?.(30); this.meleeUsed=true;this.position.copy(this.oldPosition);this.timer=0; }
      for(const peer of this.peers){
        if(peer===this||!peer.health.alive||Math.abs(peer.position.y-this.position.y)>1.5)continue;
        this.target.copy(this.position).sub(this.oldPosition);const length=this.target.lengthSq();
        const t=length?Math.max(0,Math.min(1,this.rayOrigin.copy(peer.position).sub(this.oldPosition).dot(this.target)/length)):0;
        this.target.multiplyScalar(t).add(this.oldPosition);
        if(Math.hypot(this.target.x-peer.position.x,this.target.z-peer.position.z)<1.1){this.position.copy(this.oldPosition);this.timer=0;break;}
      }
      this.position.x=Math.max(-14.6,Math.min(14.6,this.position.x));this.position.z=Math.max(-16.6,Math.min(16.6,this.position.z));this.position.y=Math.max(0,this.position.y);this.syncHitboxes();
      if (this.timer<=0 || this.position.distanceToSquared(this.oldPosition)<0.000001 && dt>0) { this.state='RECOVERING';this.timer=1.5; }
      return;
    }
    if (!visible) { this.state='IDLE';this.timer=Math.max(0,this.timer);return; }
    const aimDuration=this.kind==='marksman'?1.15:this.kind==='charger'?0.65:this.kind==='sentinel'?1.0:0.7;
    if (this.state==='IDLE' && this.timer<=0) {
      this.state='AIMING';this.timer=aimDuration;this.aimPoint.copy(eye);this.aimPoint.y-=0.25;
      this.aimPoint.x+=Math.sin(this.index*2+this.shots*1.7)*0.18*this.difficulty.spread;
      this.direction.copy(this.aimPoint).sub(this.muzzle).normalize();this.burstLeft=this.kind==='drone'?3:1;
    } else if (this.state==='AIMING') {
      if (this.kind==='marksman' && this.timer>0.35) { this.aimPoint.copy(eye);this.aimPoint.y-=0.2;this.aimPoint.x+=Math.sin(this.index*2+this.shots*1.7)*0.18*this.difficulty.spread;this.direction.copy(this.aimPoint).sub(this.muzzle).normalize(); }
      if (this.timer<=0) {
        if (this.kind==='charger') { this.direction.y=0;this.direction.normalize();this.state='CHARGING';this.timer=1.15;this.meleeUsed=false; }
        else { this.emit(fire,walls);this.state='FIRING';this.timer=0.17; }
      }
    } else if (this.state==='FIRING' && this.timer<=0) {
      if (this.burstLeft>0) { this.emit(fire,walls);this.timer=0.17; }
      else { this.state='RECOVERING';this.timer=this.kind==='marksman'?2.4:this.kind==='sentinel'?2:1.4; }
    } else if (this.state==='RECOVERING' && this.timer<=0) this.state='IDLE';
  }
  private emit(fire: Fire,walls:readonly Box3[]) {
    const options = this.kind==='marksman'?{speed:13,damage:40,color:0xb993ff}:this.kind==='drone'?{speed:7,damage:12,radius:0.065,color:0x55dfff}:{speed:5,damage:35,radius:0.18,color:0xff6774};
    if (nearestWall(this.muzzle,this.direction,this.muzzle.distanceTo(this.aimPoint),walls,options.radius??0.09)===Infinity) fire(this.muzzle,this.direction,options);
    this.burstLeft--;this.shots++;
  }
}
