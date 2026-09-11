import type { CombatEvent } from '../combat/Encounter';
import { synthesizeSound } from './sound';
import type { SoundName } from './sound';
import { AudioMix, soundPresets } from './AudioMix';
export class AudioManager {
  context?: AudioContext;
  worldBus?: GainNode;
  realtimeBus?: GainNode;
  private master?: GainNode;
  private ambience?: GainNode;
  mix?: AudioMix;
  private sampleLoad?:Promise<void>;
  readonly loadedSamples=new Set<string>();
  sampleError='';
  private buffers = new Map<SoundName,AudioBuffer>();
  private voices = new Map<AudioBufferSourceNode,boolean>();
  worldTimeScale=0.02;
  masterVolume=0.6; effectsVolume=0.85; musicVolume=0.18;
  preset:'LOW'|'MEDIUM'|'HIGH'|'CUSTOM'='MEDIUM';
  setPreset(name:keyof typeof soundPresets){this.setVolumes(soundPresets[name],this.effectsVolume,this.musicVolume);this.preset=name;}
  async unlock(){
    try{
      if(!this.context){
        const ctx=this.context=new AudioContext();
        this.mix=new AudioMix(ctx);this.master=this.mix.master;this.worldBus=this.mix.world;this.realtimeBus=this.mix.realtime;this.ambience=this.mix.ambience;
        this.mix.set(this.masterVolume,this.effectsVolume,this.musicVolume*(0.35+this.worldTimeScale*0.65),true);
        for(const frequency of [55,82.41]){const tone=ctx.createOscillator(),gain=ctx.createGain();tone.frequency.value=frequency;gain.gain.value=0.022;tone.connect(gain);gain.connect(this.ambience);tone.start();}
      }
      await this.context.resume();this.sampleLoad??=this.loadSamples();
    }catch{/* Optional audio cannot block gameplay. */}
  }
  setVolumes(master:number,effects:number,music:number){
    const clamp=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
    if(master!==this.masterVolume)this.preset='CUSTOM';
    this.masterVolume=clamp(master);this.effectsVolume=clamp(effects);this.musicVolume=clamp(music);
    if(!this.context)return;const now=this.context.currentTime;
    this.mix?.set(this.masterVolume,this.effectsVolume,this.musicVolume*(0.35+this.worldTimeScale*0.65));
  }
  setTimeScale(scale:number){
    this.worldTimeScale=scale;
    if(!this.context)return;
    for(const [voice,hostile] of this.voices)if(hostile)voice.playbackRate.setTargetAtTime(0.72+scale*0.28,this.context.currentTime,0.06);
    this.ambience?.gain.setTargetAtTime(this.musicVolume*(0.35+scale*0.65),this.context.currentTime,0.1);
  }
  playAction(action:'jump'|'dash'){this.play(action);}
  private async loadSamples(){
    await Promise.all((['fire','scatter'] as const).map(async name=>{
      try{
        const response=await fetch('./audio/'+(name==='fire'?'laser1.ogg':'laser9.ogg'));if(!response.ok)throw Error('Sound HTTP '+response.status);
        const buffer=await this.context!.decodeAudioData(await response.arrayBuffer());
        // Normalize bundled samples once, and add a restrained original low transient to Scattergun.
        let peak=0;for(let channel=0;channel<buffer.numberOfChannels;channel++){const samples=buffer.getChannelData(channel);for(let i=0;i<samples.length;i++){if(name==='scatter')samples[i]+=Math.sin(i/buffer.sampleRate*2*Math.PI*95)*Math.exp(-i/buffer.sampleRate*32)*0.15;peak=Math.max(peak,Math.abs(samples[i]));}}
        for(let channel=0;channel<buffer.numberOfChannels;channel++){const samples=buffer.getChannelData(channel);for(let i=0;i<samples.length;i++)samples[i]*=0.75/(peak||1);}
        this.buffers.set(name,buffer);this.loadedSamples.add(name);
      }catch(error){this.sampleError=String(error);}
    }));
  }
  playCombat(event:CombatEvent){this.play(event);}
  play(name:SoundName){
    const ctx=this.context;if(!ctx||ctx.state!=='running'||!this.worldBus||!this.realtimeBus)return;
    if(this.voices.size>=24){const first=this.voices.keys().next().value;if(first){first.stop();this.voices.delete(first);}}
    let buffer=this.buffers.get(name);
    if(!buffer){const samples=synthesizeSound(name,ctx.sampleRate);buffer=ctx.createBuffer(1,samples.length,ctx.sampleRate);buffer.copyToChannel(samples,0);this.buffers.set(name,buffer);}
    const source=ctx.createBufferSource(),gain=ctx.createGain();
    const hostile=['aim','lock','charge','enemyShot'].includes(name);
    const volume=name==='fire'?0.85:name==='scatter'?1:name==='impact'?0.13:name==='aim'?0.3:name==='hit'?0.32:name==='headshot'?0.4:name==='ui'?0.3:0.55;
    gain.gain.value=volume;source.buffer=buffer;source.playbackRate.value=hostile?0.72+this.worldTimeScale*0.28:name==='scatter'&&this.loadedSamples.has(name)?0.78:1;
    source.connect(gain);gain.connect(hostile?this.worldBus:this.realtimeBus);this.voices.set(source,hostile);
    source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};source.start();
  }
  reset(){for(const voice of this.voices.keys())try{voice.stop();}catch{}this.voices.clear();}
  suspend(){void this.context?.suspend().catch(()=>{});}
}
