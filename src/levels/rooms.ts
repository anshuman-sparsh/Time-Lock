export type EnemyKind = 'gunner' | 'charger' | 'marksman' | 'drone' | 'sentinel' | 'warden' | 'target';
export interface Spawn { kind: EnemyKind; x: number; z: number; y?: number }
export interface RoomDefinition {
  name: string; message: string; accent: string; enemies: Spawn[];
  cover: number[][]; tutorial?: boolean; boss?: boolean;
}
export const rooms: RoomDefinition[] = [
  { name: 'TEMPORAL CALIBRATION', message: 'SUBJECT: UNKNOWN // TEMPORAL LOCK: ACTIVE', accent: '#70e8d2', tutorial: true,
    enemies: [{ kind: 'target', x: 0, z: -4 }], cover: [[-8,0.5,0,3,1,3],[8,0.5,0,3,1,3]] },
  { name: 'FIRST CONTACT', message: 'SIMULATION STABILITY: 98%', accent: '#6ce2ca',
    enemies: [{kind:'gunner',x:-3,z:-3},{kind:'gunner',x:4,z:-7}],
    cover: [[-7,0.3,3,3,0.6,3],[-7,0.75,-1,3,1.5,3],[-7,1.2,-5,4,2.4,3],[7,1.5,-6,1,3,13],[11,1.5,-6,1,3,13],[3,0.6,2,2,1.2,2],[-2,0.45,-7,2.5,0.9,2.5]] },
  { name: 'PRESSURE', message: 'MOTION SIGNATURE DETECTED // WATCH THE ORANGE TELEGRAPH', accent: '#ffb15b',
    enemies: [{kind:'gunner',x:-7,z:-10},{kind:'gunner',x:7,z:-10},{kind:'charger',x:0,z:-5}],
    cover: [[-6,0.8,2,3,1.6,3],[6,0.8,2,3,1.6,3],[-11,0.4,-5,3,0.8,4],[11,0.4,-5,3,0.8,4]] },
  { name: 'SIGHTLINE', message: 'SIMULATION STABILITY: 78% // BREAK THE VIOLET LASER', accent: '#b997ff',
    enemies: [{kind:'gunner',x:5,z:-5},{kind:'charger',x:-5,z:-4},{kind:'marksman',x:0,z:-14}],
    cover: [[-3,1.2,2,2,2.4,2],[3,1.2,-4,2,2.4,2],[-8,0.7,-8,4,1.4,2],[8,0.7,6,3,1.4,2]] },
  { name: 'VERTICAL THREAT', message: 'TEMPORAL ANOMALY DETECTED // LOOK UP', accent: '#60d5ff',
    enemies: [{kind:'gunner',x:-8,z:-9},{kind:'gunner',x:8,z:-11},{kind:'drone',x:0,y:2.7,z:-7},{kind:'charger',x:5,z:-2}],
    cover: [[-6,0.4,3,3,0.8,3],[-6,0.9,-1,3,1.8,3],[-6,1.3,-5,3,2.6,3],[6,0.6,3,3,1.2,3],[10,1.6,-5,2,3.2,3]] },
  { name: 'CONTROL', message: 'CONTAINMENT FAILURE // FLANK THE WHITE SHIELD', accent: '#ff6d85',
    enemies: [{kind:'sentinel',x:0,z:-8},{kind:'marksman',x:9,z:-13},{kind:'drone',x:-7,y:2.4,z:-8},{kind:'charger',x:-4,z:-1}],
    cover: [[-6,1.2,3,3,2.4,2],[6,1.2,3,3,2.4,2],[0,0.55,0,3,1.1,3],[8,0.6,-5,3,1.2,2],[-11,0.7,-3,2,1.4,3]] },
  { name: 'THE WARDEN', message: 'WARDEN PROTOCOL ACTIVE // STRIKE THE OPEN CORE', accent: '#ff4868', boss: true,
    enemies: [{kind:'warden',x:0,z:-9}],
    cover: [[-7,1.3,1,2.5,2.6,2.5],[7,1.3,1,2.5,2.6,2.5],[-10,0.5,-8,3,1,3],[10,0.5,-8,3,1,3]] },
];
