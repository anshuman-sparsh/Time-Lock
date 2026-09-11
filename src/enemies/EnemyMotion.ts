import { Vector3 } from 'three';
import type { Box3 } from 'three';
import { CollisionWorld } from '../world/CollisionWorld';
import type { Gunner } from './Gunner';

// Local steering, not pathfinding: bounded travel, acceleration, collision and separation.
export class EnemyMotion {
  private readonly collision=new CollisionWorld();
  private readonly velocity=new Vector3();
  private readonly desired=new Vector3();
  private readonly before=new Vector3();
  private timer=0;
  private side=1;
  private bias=0;
  private seed:number;
  constructor(private readonly home:Vector3,private readonly index:number){this.seed=index+197;}
  reset(){this.velocity.set(0,0,0);this.timer=0;this.seed=this.index+197;}
  private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)|0;return (this.seed>>>0)/4294967296;}
  update(enemy:Gunner,dt:number,eye:Vector3,walls:readonly Box3[],peers:readonly Gunner[]){
    if(dt<=0||!enemy.health.alive||enemy.kind==='target'||enemy.kind==='warden'||enemy.kind==='drone')return;
    if(enemy.state==='AIMING'||enemy.state==='FIRING'||enemy.state==='CHARGING'){this.velocity.set(0,0,0);return;}
    this.timer-=dt;
    if(this.timer<=0){this.side=this.random()<0.5?-1:1;this.bias=this.random()*0.5;this.timer=(0.9+this.random()*1.7)*enemy.difficulty.decision;}
    const dx=eye.x-enemy.position.x,dz=eye.z-enemy.position.z,distance=Math.hypot(dx,dz)||1;
    const preferred=enemy.kind==='marksman'?17:enemy.kind==='sentinel'?7:enemy.kind==='charger'?6:10;
    const toward=distance<preferred-2?-0.85:distance>preferred+3?0.45:0;
    this.desired.set(dx/distance*toward+dz/distance*this.side*(0.6+this.bias),0,dz/distance*toward-dx/distance*this.side*(0.6+this.bias));
    const hx=this.home.x-enemy.position.x,hz=this.home.z-enemy.position.z;
    if(Math.hypot(hx,hz)>5)this.desired.addScaledVector(this.before.set(hx,0,hz).normalize(),1.5);
    for(const peer of peers){if(peer===enemy||!peer.health.alive||Math.abs(peer.position.y-enemy.position.y)>2)continue;const x=enemy.position.x-peer.position.x,z=enemy.position.z-peer.position.z,d=Math.hypot(x,z);if(d<1.6&&d>0.001)this.desired.addScaledVector(this.before.set(x/d,0,z/d),(1.6-d)*2);}
    const speed=(enemy.kind==='sentinel'?0.65:enemy.kind==='marksman'?1.35:enemy.kind==='charger'?1.8:1.65)*enemy.difficulty.movement;
    this.desired.clampLength(0,1).multiplyScalar(speed);
    this.velocity.lerp(this.desired,1-Math.exp(-dt*5));this.velocity.y=-2;
    this.before.copy(enemy.position);this.collision.boxes.length=0;for(const box of walls)this.collision.boxes.push(box);
    this.collision.move(enemy.position,this.velocity,dt,enemy.kind==='sentinel'?0.85:0.55,enemy.kind==='sentinel'?2.5:1.95);
    enemy.position.x=Math.max(-14.6,Math.min(14.6,enemy.position.x));enemy.position.z=Math.max(-16.6,Math.min(16.6,enemy.position.z));
    if(enemy.position.y<0)enemy.position.y=0;
    if(enemy.position.distanceToSquared(this.before)<1e-12){this.side*=-1;this.timer=0.3;}
    // Never advance into the player or another body: undo the step, then choose another direction.
    if(Math.hypot(enemy.position.x-eye.x,enemy.position.z-eye.z)<0.9||peers.some(peer=>peer!==enemy&&peer.health.alive&&Math.abs(peer.position.y-enemy.position.y)<1.5&&Math.hypot(peer.position.x-enemy.position.x,peer.position.z-enemy.position.z)<1.05)){
      enemy.position.copy(this.before);this.side*=-1;this.timer=0.4;
    }
  }
}

