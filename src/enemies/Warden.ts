import { Vector3 } from 'three';
import type { Box3 } from 'three';
import { Gunner } from './Gunner';
import { nearestWall } from '../combat/geometry';
import type { ProjectileOptions } from '../combat/ProjectilePool';

export class Warden extends Gunner {
  private pattern=0;
  private beamCooldown=0;
  private readonly ray=new Vector3();
  private readonly up=new Vector3(0,1,0);
  readonly beamOrigin=new Vector3();
  beamLength=28;
  constructor(position:Vector3,index:number){super(position,index,900);this.kind='warden';this.reset();}
  override reset(){
    super.reset();this.pattern=this.beamCooldown=0;this.phase=1;this.coreOpen=false;this.beamActive=this.beamWarning=false;
    this.syncHitboxes(1.2,4.8);
    this.head.min.set(this.position.x-0.48,this.position.y+2.15,this.position.z-0.7);
    this.head.max.set(this.position.x+0.48,this.position.y+3.05,this.position.z+0.8);
    this.beamOrigin.copy(this.position);this.beamOrigin.y+=1.1;this.timer=0.8;
  }
  override receiveHit(amount:number,_origin:Vector3,weakPoint:boolean){return this.coreOpen&&weakPoint?this.hit(amount):false;}
  override update(dt:number,eye:Vector3,walls:readonly Box3[],fire:(origin:Vector3,direction:Vector3,options?:ProjectileOptions)=>void,damage?:(amount:number)=>void){
    this.flash=Math.max(0,this.flash-dt);
    if(!this.health.alive){this.deathTime+=dt;this.beamActive=this.beamWarning=false;this.coreOpen=false;return;}
    const next=this.health.current/this.health.maximum<=0.33?3:this.health.current/this.health.maximum<=0.68?2:1;
    if(next>this.phase){this.phase=next;this.state='RECOVERING';this.timer=1;this.beamActive=this.beamWarning=false;this.coreOpen=true;}
    this.timer-=dt*this.difficulty.boss/(this.state==='AIMING'?this.difficulty.aim:this.state==='RECOVERING'?this.difficulty.recovery:1);this.beamCooldown=Math.max(0,this.beamCooldown-dt);this.aimPoint.copy(eye);this.aimPoint.y-=0.3;
    if(this.state==='IDLE'&&this.timer<=0){
      this.pattern++;this.state='AIMING';this.timer=this.phase===1?0.9:1.2;this.coreOpen=false;
      this.direction.copy(this.aimPoint).sub(this.muzzle).normalize();this.beamWarning=this.phase>=2&&this.pattern%2===0;
      this.beamAngle=Math.atan2(eye.x-this.position.x,eye.z-this.position.z)-0.3;
    }else if(this.state==='AIMING'&&this.timer<=0){
      this.coreOpen=true;
      if(this.beamWarning){this.beamWarning=false;this.beamActive=true;this.state='BEAM';this.timer=1.6;}
      else{
        for(const angle of [-0.28,-0.14,0,0.14,0.28]){this.ray.copy(this.direction).applyAxisAngle(this.up,angle);fire(this.muzzle,this.ray,{speed:7,damage:25,radius:0.12,color:0xff5067});}
        if(this.phase===3)for(const side of [-1,1]){const origin=this.muzzle.clone();origin.x+=side*3;origin.y-=1;this.ray.copy(eye).sub(origin).normalize();fire(origin,this.ray,{speed:9,damage:18,color:0xffbc68});}
        this.state='RECOVERING';this.timer=this.phase===3?1.35:2;
      }
    }else if(this.state==='BEAM'){
      this.beamAngle+=dt*0.4*this.difficulty.boss;this.ray.set(Math.sin(this.beamAngle),0,Math.cos(this.beamAngle));
      this.beamLength=Math.min(28,nearestWall(this.beamOrigin,this.ray,28,walls));
      const x=eye.x-this.beamOrigin.x,z=eye.z-this.beamOrigin.z,along=x*this.ray.x+z*this.ray.z,across=Math.abs(x*this.ray.z-z*this.ray.x);
      if(along>0&&along<this.beamLength&&across<0.42&&eye.y<2.65&&this.beamCooldown===0){damage?.(30);this.beamCooldown=0.8;}
      if(this.timer<=0){this.beamActive=false;this.state='RECOVERING';this.timer=1.5;}
    }else if(this.state==='RECOVERING'&&this.timer<=0){this.coreOpen=false;this.state='IDLE';}
    if(this.beamWarning){this.ray.set(Math.sin(this.beamAngle),0,Math.cos(this.beamAngle));this.beamLength=Math.min(28,nearestWall(this.beamOrigin,this.ray,28,walls));}
  }
}
