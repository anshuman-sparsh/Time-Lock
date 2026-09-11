export const soundPresets={LOW:0.25,MEDIUM:0.6,HIGH:0.95} as const;
// Effects attenuation is AFTER compression: the compressor cannot undo the slider.
export class AudioMix {
  readonly master:GainNode;
  readonly effects:GainNode;
  readonly ambience:GainNode;
  readonly world:GainNode;
  readonly realtime:GainNode;
  constructor(readonly context:BaseAudioContext){
    this.master=context.createGain();this.effects=context.createGain();this.ambience=context.createGain();
    this.world=context.createGain();this.realtime=context.createGain();this.world.gain.value=0.68;
    const compressor=context.createDynamicsCompressor(),limiter=context.createWaveShaper(),curve=new Float32Array(2048);
    compressor.threshold.value=-12;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=0.003;compressor.release.value=0.15;
    for(let i=0;i<curve.length;i++)curve[i]=0.85*Math.tanh((i/(curve.length-1)*2-1)*1.3);
    limiter.curve=curve;limiter.oversample='2x';
    this.world.connect(compressor);this.realtime.connect(compressor);compressor.connect(limiter);limiter.connect(this.effects);
    this.effects.connect(this.master);this.ambience.connect(this.master);this.master.connect(context.destination);
    this.set(0,0,0,true);
  }
  set(master:number,effects:number,ambience:number,immediate=false){
    for(const [node,value] of [[this.master,master],[this.effects,effects],[this.ambience,ambience]] as const){
      const time=this.context.currentTime;node.gain.cancelScheduledValues(time);
      if(immediate)node.gain.setValueAtTime(value,time);else node.gain.setTargetAtTime(value,time,0.015);
    }
  }
}
