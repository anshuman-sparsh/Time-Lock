import * as THREE from 'three';
import type { Encounter, CombatEvent } from './Encounter';
import { combatSettings as config } from './config';
import { Warden } from '../enemies/Warden';
import { droneParts } from '../enemies/droneShape';

export class CombatView {
  readonly weaponScene = new THREE.Scene();
  readonly weaponCamera = new THREE.PerspectiveCamera(65, 1, 0.01, 5);
  private readonly pistol = new THREE.Group();
  private readonly scatter = new THREE.Group();
  particleLimit=72;
  trails=true;
  private readonly muzzle: THREE.Mesh;
  private readonly flashLight = new THREE.PointLight('#9ffff0', 0, 2);
  private readonly enemyViews: { group: THREE.Group; material: THREE.MeshStandardMaterial; visor: THREE.MeshBasicMaterial; laser: THREE.Line; parts: { mesh: THREE.Mesh; position: THREE.Vector3; scale: THREE.Vector3 }[] }[] = [];
  private readonly forward = new THREE.Vector3(0, 0, 1);
  private readonly bulletViews: THREE.Group[] = [];
  private readonly particles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  recoil = 0; hitMarker = 0; headshot = false; damageFlash = 0; nearMiss = 0;
  private flash = 0;
  constructor(scene: THREE.Scene, private encounter: Encounter) {
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.pistol.scale.setScalar(0.72);
    const dark = new THREE.MeshStandardMaterial({ color: '#24323d', metalness: 0.65, roughness: 0.32 });
    const silver = new THREE.MeshStandardMaterial({ color: '#b0c7cf', metalness: 0.7, roughness: 0.28 });
    const teal = new THREE.MeshBasicMaterial({ color: '#86ffe5' });
    const piece = (parent: THREE.Group, material: THREE.Material, size: number[], position: number[]) => {
      const mesh = new THREE.Mesh(box, material); mesh.scale.set(size[0], size[1], size[2]);
      mesh.position.set(position[0], position[1], position[2]); parent.add(mesh); return mesh;
    };
    piece(this.pistol, dark, [0.13, 0.18, 0.48], [0, 0, -0.1]);
    piece(this.pistol, silver, [0.15, 0.07, 0.41], [0, 0.09, -0.12]);
    const grip = piece(this.pistol, dark, [0.11, 0.23, 0.13], [0, -0.18, 0.04]); grip.rotation.x = -0.2;
    piece(this.pistol, teal, [0.155, 0.025, 0.23], [0, 0.04, -0.12]);
    piece(this.pistol, dark, [0.1, 0.03, 0.07], [0, 0.14, -0.22]);
    piece(this.pistol, teal, [0.02, 0.015, 0.025], [0, 0.16, -0.22]);
    piece(this.pistol, dark, [0.09, 0.1, 0.06], [0, 0, -0.365]);
    piece(this.scatter,silver,[0.23,0.17,0.58],[0,0,-0.15]);
    piece(this.scatter,dark,[0.2,0.22,0.25],[0,-0.1,0.1]);
    const orange=new THREE.MeshBasicMaterial({color:'#ffb260'});
    for(const side of [-1,1])piece(this.scatter,orange,[0.07,0.07,0.46],[side*0.07,0,-0.24]);
    this.scatter.scale.setScalar(0.72);this.weaponScene.add(this.scatter);
    this.muzzle = new THREE.Mesh(new THREE.OctahedronGeometry(0.085), new THREE.MeshBasicMaterial({ color: '#bcfff2' }));
    this.muzzle.position.set(0, 0, -0.43); this.muzzle.scale.z = 2; this.pistol.add(this.muzzle);
    this.flashLight.position.copy(this.muzzle.position); this.pistol.add(this.flashLight);
    this.weaponScene.add(this.pistol, new THREE.HemisphereLight('#deffff', '#152534', 3));
    const key = new THREE.DirectionalLight('#ffffff', 3); key.position.set(-2, 3, 1); this.weaponScene.add(key);

    for (const enemy of encounter.enemies) {
      const group = new THREE.Group(); group.position.copy(enemy.position); scene.add(group);
      const color={gunner:'#d34457',charger:'#ef922c',marksman:'#a474f0',drone:'#36bdda',sentinel:'#cdd8df',warden:'#e0e2e5',target:'#71dfac'}[enemy.kind];
      const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.22, metalness: 0.5, roughness: 0.4 });
      material.userData.base=color;
      const visor = new THREE.MeshBasicMaterial({ color: enemy.kind==='warden'?'#ff3355':color });
      if(enemy.kind==='warden'){
        piece(group,material,[2,2.2,1.2],[0,2.1,0]);
        for(const side of [-1,1]){piece(group,dark,[0.7,3.8,0.8],[side*1.15,2,0]);piece(group,visor,[0.5,0.5,0.5],[side*3,2.4,0]);}
        const core=new THREE.Mesh(new THREE.OctahedronGeometry(0.55),visor);core.position.set(0,2.6,0.7);group.add(core);
        piece(group,material,[1.3,0.6,1],[0,4.2,0]);
      }else if(enemy.kind==='drone'){
        for(const part of droneParts)piece(group,part.material==='body'?material:part.material==='visor'?visor:dark,[...part.size],[...part.position]);
      }else{
      piece(group, material, [0.65, 0.73, 0.44], [0, 1.05, 0]);
      piece(group, material, [0.45, 0.43, 0.42], [0, 1.69, 0]);
      piece(group, visor, [0.39, 0.07, 0.015], [0, 1.73, 0.22]);
      for (const side of [-1, 1]) {
        piece(group, dark, [0.21, 0.68, 0.25], [side * 0.2, 0.34, 0]);
        piece(group, material, [0.22, 0.4, 0.31], [side * 0.43, 1.18, 0]);
      }
      if(enemy.kind!=='charger'){piece(group, dark, [0.18, 0.16, enemy.kind==='marksman'?1:0.45], [0, 1.38, 0.3]);piece(group, visor, [0.1, 0.07, 0.02], [0, 1.38, 0.54]);}
      if(enemy.kind==='sentinel'){
        group.scale.set(1.5,1.28,1.3);
        const shield=piece(group,new THREE.MeshBasicMaterial({color:'#ffb6be',transparent:true,opacity:0.4,depthWrite:false}),[1.1,1.3,0.05],[0,0.9,0.45]);shield.name='shield';
      }
      if(enemy.kind==='marksman')group.scale.x=0.8;
      }
      const laserGeometry = new THREE.BufferGeometry(); laserGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const laser = new THREE.Line(laserGeometry, new THREE.LineBasicMaterial({ color: '#ff4a64', transparent: true, opacity: 0.22, depthWrite: false })); scene.add(laser);
      this.enemyViews.push({ group, material, visor, laser, parts: group.children.map(child => ({ mesh: child as THREE.Mesh, position: child.position.clone(), scale: child.scale.clone() })) });
    }
    const core = new THREE.SphereGeometry(config.projectileRadius, 10, 8);
    const haloMaterial = new THREE.MeshBasicMaterial({ color: '#ff244e', transparent: true, opacity: 0.22, depthWrite: false });
    const coreMaterial = new THREE.MeshBasicMaterial({ color: '#ffd1c5' });
    const trailGeometry = new THREE.CylinderGeometry(0.025, 0.065, 0.65, 6); trailGeometry.rotateX(Math.PI / 2);
    const trailMaterial = new THREE.MeshBasicMaterial({ color: '#ff345b', transparent: true, opacity: 0.7, depthWrite: false });
    for (const _ of encounter.projectiles.items) {
      const group = new THREE.Group(); group.add(new THREE.Mesh(core, coreMaterial));
      const halo = new THREE.Mesh(core, haloMaterial.clone()); halo.scale.setScalar(2.3); group.add(halo);
      const trail = new THREE.Mesh(trailGeometry, trailMaterial.clone()); trail.position.z = -0.32; group.add(trail);
      group.visible = false; this.bulletViews.push(group); scene.add(group);
    }
    const shardGeometry = new THREE.OctahedronGeometry(0.035);
    const shardMaterial = new THREE.MeshBasicMaterial({ color: '#ff967f' });
    for (let i = 0; i < 72; i++) {
      const mesh = new THREE.Mesh(shardGeometry, shardMaterial); mesh.visible = false; scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3(), life: 0 });
    }
    this.reset();
  }
  event(event: CombatEvent, position?: THREE.Vector3) {
    if (event === 'fire' || event==='scatter') { this.recoil = event==='scatter'?1.7:1; this.flash = 0.065; }
    if (event === 'hit' || event === 'headshot') { this.hitMarker = 0.18; this.headshot = event === 'headshot'; }
    if (event === 'kill') this.hitMarker = 0.3;
    if (event === 'damage') this.damageFlash = 1;
    if (event === 'nearMiss') this.nearMiss = 0.35;
    if (position && ['hit', 'headshot', 'kill', 'impact'].includes(event)) {
      let count = event === 'kill' ? 16 : event === 'headshot' ? 10 : 5;
      for (const particle of this.particles.slice(0,this.particleLimit)) {
        if (particle.life > 0) continue;
        particle.life = 0.45; particle.mesh.position.copy(position); particle.mesh.visible = true;
        particle.velocity.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(4);
        if (--count <= 0) break;
      }
    }
  }
  reset() {
    this.recoil = this.flash = this.hitMarker = this.damageFlash = this.nearMiss = 0; this.headshot = false;
    this.muzzle.visible = false; this.flashLight.intensity = 0;
    for (const particle of this.particles) { particle.life = 0; particle.mesh.visible = false; }
    for (const bullet of this.bulletViews) bullet.visible = false;
    this.update(0, 0, 0);
  }
  update(realDelta: number, worldDelta: number, bob: number) {
    this.recoil *= Math.exp(-realDelta * 15); this.flash = Math.max(0, this.flash - realDelta);
    this.hitMarker = Math.max(0, this.hitMarker - realDelta); this.damageFlash *= Math.exp(-realDelta * 5);
    this.nearMiss *= Math.exp(-realDelta * 8);
    const reloadProgress = this.encounter.weapon.reloadRemaining / this.encounter.weapon.reloadDuration;
    const dip = reloadProgress > 0 ? Math.sin((1 - reloadProgress) * Math.PI) : 0;
    this.pistol.position.set(0.31, -0.26 - dip * 0.2 + bob * 0.5, -0.54 + this.recoil * 0.09);
    this.pistol.rotation.set(this.recoil * 0.14 - dip * 0.3, 0, -dip * 0.4);
    this.scatter.position.copy(this.pistol.position);this.scatter.rotation.copy(this.pistol.rotation);
    this.pistol.visible=this.encounter.activeWeapon===1;this.scatter.visible=this.encounter.activeWeapon===2;
    if(this.muzzle.parent!==(this.scatter.visible?this.scatter:this.pistol)){(this.scatter.visible?this.scatter:this.pistol).add(this.muzzle);}
    this.muzzle.visible = this.flash > 0; this.flashLight.intensity = this.flash > 0 ? 1.5 : 0;
    this.encounter.enemies.forEach((enemy, i) => {
      const view = this.enemyViews[i];
      view.group.position.copy(enemy.position);
      view.group.visible = enemy.health.alive || enemy.deathTime < 0.8;
      view.group.rotation.y = enemy.yaw;
      view.material.emissive.set(enemy.flash > 0 ? '#ffb9a3' : view.material.userData.base);
      view.material.emissiveIntensity = enemy.flash > 0 ? 1.8 : 0.35;
      view.visor.color.set(enemy.kind==='warden'?(enemy.coreOpen?'#ff5267':'#351620'):enemy.state === 'AIMING' || enemy.state === 'FIRING' ? '#fff0bb' : view.material.userData.base);
      const shield=view.group.getObjectByName('shield');if(shield)shield.visible=enemy.shieldActive;
      view.laser.visible = enemy.state === 'AIMING';
      const vertices = view.laser.geometry.attributes.position as THREE.BufferAttribute;
      vertices.setXYZ(0, enemy.muzzle.x, enemy.muzzle.y, enemy.muzzle.z);
      vertices.setXYZ(1, enemy.aimPoint.x, enemy.aimPoint.y, enemy.aimPoint.z); vertices.needsUpdate = true;
      if(enemy instanceof Warden){
        view.laser.visible=enemy.beamWarning||enemy.beamActive;
        vertices.setXYZ(0,enemy.beamOrigin.x,enemy.beamOrigin.y,enemy.beamOrigin.z);
        vertices.setXYZ(1,enemy.beamOrigin.x+Math.sin(enemy.beamAngle)*enemy.beamLength,enemy.beamOrigin.y,enemy.beamOrigin.z+Math.cos(enemy.beamAngle)*enemy.beamLength);
        (view.laser.material as THREE.LineBasicMaterial).opacity=enemy.beamActive?1:0.4;
      }
      view.laser.frustumCulled = false;
      view.parts.forEach((part, index) => {
        part.mesh.position.copy(part.position); part.mesh.rotation.set(0, 0, 0); part.mesh.scale.copy(part.scale);
        if (!enemy.health.alive) {
          const t = enemy.deathTime;
          part.mesh.position.x += Math.sin(index * 2.4) * t * 1.3;
          part.mesh.position.y += t * 0.5 - t * t * 2;
          part.mesh.rotation.z = Math.sin(index) * t * 2;
          part.mesh.scale.multiplyScalar(Math.max(0.01, 1 - t / 0.8));
        }
      });
    });
    this.encounter.projectiles.items.forEach((projectile, index) => {
      const view = this.bulletViews[index]; view.visible = projectile.active;
      if (projectile.active) { view.position.copy(projectile.position); view.quaternion.setFromUnitVectors(this.forward, projectile.direction);view.scale.setScalar(projectile.radius/config.projectileRadius);view.children[2].visible=this.trails;for(const part of view.children.slice(1))(part as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>).material.color.setHex(projectile.color); }
    });
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      particle.life -= worldDelta; particle.mesh.visible = particle.life > 0;
      particle.mesh.position.addScaledVector(particle.velocity, worldDelta);
      particle.velocity.y -= worldDelta * 4; particle.mesh.scale.setScalar(Math.max(0, particle.life / 0.45));
    }
  }
  resize(aspect: number) { this.weaponCamera.aspect = aspect; this.weaponCamera.updateProjectionMatrix(); }
  render(renderer: THREE.WebGLRenderer) {
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(this.weaponScene, this.weaponCamera); renderer.autoClear = true;
  }
}
