import { PulsePistol } from './PulsePistol';
export class Scattergun extends PulsePistol {
  constructor() { super(5,1.9,0.7); }
  static damageAt(distance:number) { return 23*Math.max(0.15,Math.min(1,1-(distance-4)/20)); }
}
