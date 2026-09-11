import { Box3, Vector3 } from 'three';
// One source for visible geometry and damage volumes, in Drone-local space.
export const droneParts = [
  { size:[0.9,0.45,0.7], position:[0,0.5,0], material:'body' },
  { size:[0.3,0.15,0.12], position:[0,0.5,0.4], material:'visor' },
  { size:[0.4,0.12,0.6], position:[-0.6,0.5,0], material:'dark' },
  { size:[0.4,0.12,0.6], position:[0.6,0.5,0], material:'dark' },
] as const;
export const droneBoxes=droneParts.map(({size,position})=>new Box3(
  new Vector3(position[0]-size[0]/2,position[1]-size[1]/2,position[2]-size[2]/2),
  new Vector3(position[0]+size[0]/2,position[1]+size[1]/2,position[2]+size[2]/2)));
