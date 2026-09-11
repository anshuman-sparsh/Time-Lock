import * as THREE from 'three';
import { CollisionWorld } from './CollisionWorld';
import { rooms } from '../levels/rooms';
import type { RoomDefinition } from '../levels/rooms';
export class World {
  readonly collision = new CollisionWorld();
  private rotors: THREE.Mesh[] = [];
  private orbs: THREE.Mesh[] = [];
  private pendulum = new THREE.Group();
  constructor(scene: THREE.Scene, room: RoomDefinition = rooms[1]) {
    scene.background = new THREE.Color('#0b1520');
    scene.fog = new THREE.Fog('#0b1520', 22, 65);
    scene.add(new THREE.HemisphereLight('#bceeff', '#243047', 2.7));
    const sun = new THREE.DirectionalLight('#d4eeff', 2.3); sun.position.set(8, 18, 6); scene.add(sun);
    const concrete = new THREE.MeshStandardMaterial({ color: '#253847', roughness: 0.8 });
    const wall = new THREE.MeshStandardMaterial({ color: '#182937', roughness: 0.9 });
    const teal = new THREE.MeshStandardMaterial({ color: room.accent, emissive: room.accent, emissiveIntensity: 0.4, metalness: 0.45, roughness: 0.3 });
    const amber = new THREE.MeshStandardMaterial({ color: '#ffc177', emissive: '#8b4b19', emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.35 });
    const unit = new THREE.BoxGeometry(1,1,1);
    const box = (x: number,y: number,z: number,w: number,h: number,d: number, material = concrete, solid = true) => {
      const mesh = new THREE.Mesh(unit, material); mesh.position.set(x,y,z); mesh.scale.set(w,h,d); scene.add(mesh);
      if (solid) this.collision.add(x,y,z,w,h,d);
      return mesh;
    };
    box(0,-0.5,0,32,1,36);
    box(-16,3,0,1,6,36,wall); box(16,3,0,1,6,36,wall);
    box(0,3,-18,32,6,1,wall); box(0,3,18,32,6,1,wall);
    const grid = new THREE.GridHelper(32,32,'#37626b','#29424c'); grid.position.y = 0.006; scene.add(grid);
    for (const x of [-15.45,15.45]) box(x,0.06,0,0.05,0.06,35,teal,false);
    box(0,0.06,-17.45,31,0.06,0.05,teal,false);
    // Reachable jump platforms, and a narrow corridor on the right.
    for(const dimensions of room.cover)box(dimensions[0],dimensions[1],dimensions[2],dimensions[3],dimensions[4],dimensions[5]);
    for (let i = 0; i < 3; i++) {
      const x = (i-1)*4.5;
      box(x,0.3,-12,2.2,0.6,2.2);
      box(x,0.62,-12,2.25,0.04,2.25,teal,false);
      const rotor = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7,0), i === 1 ? amber : teal);
      rotor.position.set(x,2.1,-12); this.rotors.push(rotor); scene.add(rotor);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5,0.025,6,64),teal);
    ring.rotation.x = Math.PI/2; ring.position.set(0,2.7,-3); scene.add(ring);
    const sphere = new THREE.SphereGeometry(0.14,12,8);
    for (let i = 0; i < 6; i++) { const orb = new THREE.Mesh(sphere,amber); this.orbs.push(orb); scene.add(orb); }
    const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,2.4,6),concrete); tether.position.y = -1.2;
    const weight = new THREE.Mesh(new THREE.OctahedronGeometry(0.35),amber); weight.position.y = -2.4;
    this.pendulum.add(tether,weight); this.pendulum.position.set(-11,4.5,-10); scene.add(this.pendulum);
    this.label(scene,room.name,0,4.25,-17.4,8);
    this.label(scene,'01   /   CONTACT',0,0.018,4,4,true);
    this.label(scene,'ELEVATION',-7,3.2,-7,3);
    this.label(scene,'DASH →',9,3.7,-12.5,2.7);
    this.update(0,0);
  }
  private label(scene: THREE.Scene, text: string, x: number,y: number,z: number,width: number, floor = false) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.font = 'bold 60px monospace'; ctx.fillStyle = '#81aaa9'; ctx.textAlign = 'center'; ctx.fillText(text,512,85);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width,width/8),new THREE.MeshBasicMaterial({ map:texture,transparent:true,depthWrite:false }));
    mesh.position.set(x,y,z); if (floor) mesh.rotation.x = -Math.PI/2; scene.add(mesh);
  }
  update(worldDelta: number, elapsed: number) {
    this.rotors.forEach((rotor,i) => { rotor.rotation.x = elapsed * 0.65; rotor.rotation.y = elapsed; rotor.position.y = 2.1 + Math.sin(elapsed*1.5+i)*0.25; });
    this.orbs.forEach((orb,i) => { const angle = elapsed*0.85+i*Math.PI/3; orb.position.set(Math.cos(angle)*2.5,2.7+Math.sin(angle*2)*0.2,-3+Math.sin(angle)*2.5); });
    this.pendulum.rotation.z = Math.sin(elapsed*1.8)*0.65;
  }
}
