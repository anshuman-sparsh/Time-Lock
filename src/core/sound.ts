export type SoundName = 'fire'|'scatter'|'empty'|'reload'|'aim'|'charge'|'lock'|'bossPhase'|'shield'|'enemyShot'|'hit'|'headshot'|'kill'|'impact'|'damage'|'nearMiss'|'victory'|'death'|'dash'|'jump'|'ui'|'ending';
// Cached deterministic synthesis: transient + low body + mechanical tail, not a lone quiet sine.
export function synthesizeSound(name:SoundName,rate:number) {
  const shot=name==='fire'||name==='scatter'||name==='enemyShot';
  const heavy=name==='scatter'||name==='bossPhase'||name==='death';
  const duration=heavy?0.48:name==='victory'||name==='ending'?0.8:name==='reload'?0.38:0.2;
  const result=new Float32Array(Math.ceil(rate*duration));
  let seed=9173,previous=0,phase=0,peak=0;
  const frequency=name==='headshot'?1100:name==='lock'?820:name==='aim'?540:name==='shield'?340:name==='ui'?680:heavy?90:shot?180:300;
  for(let i=0;i<result.length;i++){
    const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)|0;
    const noise=(seed>>>0)/2147483648-1,bright=noise-previous*0.8;previous=noise;
    const attack=Math.min(1,t/0.002),envelope=Math.exp(-t/(heavy?0.105:0.065));
    phase+=2*Math.PI*frequency*(shot?0.4+0.6*Math.exp(-t*25):1)/rate;
    let value=Math.sin(phase)*envelope*0.5+Math.sin(phase*2.01)*envelope*0.15;
    if(shot||name==='damage'||name==='impact'||name==='dash'||name==='nearMiss'||name==='charge') value+=bright*Math.exp(-t/(heavy?0.09:0.035))*(shot?0.85:0.35);
    if(name==='reload')value=bright*(Math.exp(-Math.abs(t-0.02)*130)+0.7*Math.exp(-Math.abs(t-0.23)*90))*0.4;
    if(name==='victory'||name==='ending')value=(Math.sin(t*2*Math.PI*330)+Math.sin(t*2*Math.PI*440)+Math.sin(t*2*Math.PI*660))*Math.exp(-t*5)*0.2;
    result[i]=value*attack*Math.min(1,(duration-t)/0.012);peak=Math.max(peak,Math.abs(result[i]));
  }
  const gain=0.75/(peak||1);for(let i=0;i<result.length;i++)result[i]*=gain;
  return result;
}
