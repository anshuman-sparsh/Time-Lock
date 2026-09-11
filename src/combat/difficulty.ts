export type DifficultyName='LOW'|'MEDIUM'|'HARD';
export interface Difficulty { readonly name:DifficultyName; readonly projectile:number; readonly spread:number; readonly aim:number; readonly recovery:number; readonly movement:number; readonly decision:number; readonly damage:number; readonly boss:number }
// Five-times challenge pass: hostile damage is scaled exactly 5x while the tested
// movement, telegraph and projectile relationships between presets stay intact.
export const difficulties:Readonly<Record<DifficultyName,Difficulty>>={
 LOW:Object.freeze({name:'LOW',projectile:0.8,spread:1.8,aim:1.3,recovery:1.25,movement:0.75,decision:1.3,damage:4,boss:0.8}),
 MEDIUM:Object.freeze({name:'MEDIUM',projectile:1,spread:1,aim:1,recovery:0.92,movement:1,decision:1,damage:5,boss:1}),
 HARD:Object.freeze({name:'HARD',projectile:1.2,spread:0.45,aim:0.84,recovery:0.78,movement:1.22,decision:0.75,damage:5.6,boss:1.18}),
};
