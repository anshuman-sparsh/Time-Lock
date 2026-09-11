import type { LevelManager } from '../levels/LevelManager';
import type { AudioManager } from '../core/AudioManager';
import { settings } from '../config';
type Page='main'|'ready'|'pause'|'clear'|'dead'|'ending'|'settings'|'help'|'credits'|'difficulty';
export class GameMenu {
  page:Page='main';
  private previous:Page='main';
  private readonly overlay=document.getElementById('overlay')!;
  private readonly title=document.getElementById('intro-title')!;
  private readonly description=document.getElementById('intro-description')!;
  private readonly button=document.getElementById('enter') as HTMLButtonElement;
  private readonly panel=document.createElement('div');
  constructor(private level:LevelManager,private audio:AudioManager,private actions:{start:()=>void;resume:()=>void;retry:()=>void;next:()=>void;main:()=>void;settings:()=>void}){
    this.panel.id='menu-panel';this.button.after(this.panel);this.show('main');
  }
  hide(){this.overlay.hidden=true;this.panel.replaceChildren();}
  private extra(label:string,action:()=>void){const button=document.createElement('button');button.className='secondary';button.textContent=label;button.onclick=()=>{void this.audio.unlock();this.audio.play('ui');action();};this.panel.append(button);}
  show(page:Page){
    this.page=page;this.overlay.hidden=false;this.panel.replaceChildren();this.button.hidden=false;
    const level=this.level;
    if(page==='difficulty'){
      this.title.textContent='SELECT DIFFICULTY';this.description.textContent='LOW: forgiving · MEDIUM: intended challenge · HARD: faster, more precise threats. Fixed for this campaign.';
      this.button.textContent='BEGIN · '+level.difficulty.name;this.button.onclick=()=>{void this.audio.unlock();this.actions.start();};
      for(const name of ['LOW','MEDIUM','HARD'] as const)this.extra('DIFFICULTY: '+name,()=>{level.selectDifficulty(name);this.show('difficulty');});
      this.extra('BACK',()=>this.show('main'));return;
    }
    const pages:Record<Exclude<Page,'settings'|'help'|'credits'|'difficulty'>,[string,string,string,()=>void]>={
      main:['TIME//LOCK','SYSTEM INITIALIZING · SUBJECT: UNKNOWN<br>TIME MOVES WHEN YOU DO.','ENTER SIMULATION',()=>this.show('difficulty')],
      ready:[level.room.name,level.room.message,'ENTER ROOM',this.actions.resume],
      pause:['SIMULATION PAUSED','Take your time. The room is waiting.','RESUME',this.actions.resume],
      clear:['ROOM CLEARED',level.index===3?'WEAPON UNLOCKED · SCATTERGUN<br>Press 2 in the next room.':'TEMPORAL CONTROL: STABLE · VITALS RESTORED NEXT ROOM','CONTINUE',this.actions.next],
      dead:['TIME EXPIRED','Read the telegraph. Change the outcome.','RETRY ROOM',this.actions.retry],
      ending:['TIME UNLOCKED','SIMULATION TERMINATED','PLAY AGAIN',()=>this.show('difficulty')],
    };
    if(page==='settings'||page==='help'||page==='credits'){
      this.title.textContent=page.toUpperCase();this.button.textContent='BACK';this.button.onclick=()=>this.show(this.previous);
      this.description.innerHTML=page==='help'?'WASD — MOVE · MOUSE — AIM · LMB — FIRE<br>R — RELOAD · SPACE — JUMP · SHIFT — DASH · 1 / 2 — WEAPONS<br>Stop to read projectiles. Move to dodge. Firing wakes time.<br>White shield: flank or shoot the head. Warden: shoot the open red core.':page==='credits'?'TIME//LOCK<br>Built with Three.js, TypeScript and Web Audio.<br>Weapon samples: Kenney Digital Audio, CC0. Original procedural effects. AI-assisted development.':'CAMPAIGN DIFFICULTY: '+level.difficulty.name+' (selected before start)';
      if(page==='settings')this.settingsPanel();return;
    }
    const [title,description,label,action]=pages[page];this.title.textContent=title;this.description.innerHTML=description;this.button.textContent=label;
    this.button.onclick=()=>{void this.audio.unlock();this.audio.play('ui');action();};
    document.getElementById('message')!.textContent=page==='main'?'A short temporal combat simulation. Headphones recommended.':'Click to capture your mouse. Escape pauses safely.';
    if(page==='pause')this.extra('RESTART ROOM',this.actions.retry);
    if(page==='main'||page==='pause')this.extra('SETTINGS',()=>{this.previous=page;this.show('settings');});
    if(page==='main')this.extra('HOW TO PLAY',()=>{this.previous=page;this.show('help');});
    if(page==='main'||page==='ending')this.extra('CREDITS',()=>{this.previous=page;this.show('credits');});
    if(page!=='main')this.extra('MAIN MENU',this.actions.main);
  }
  private settingsPanel(){
    const slider=(name:string,value:number,min:number,max:number,step:number,apply:(value:number)=>void)=>{
      const row=document.createElement('label'),caption=document.createElement('span'),input=document.createElement('input');
      input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(value);input.setAttribute('aria-label',name);
      caption.textContent=name+' '+value;input.oninput=()=>{caption.textContent=name+' '+input.value;apply(Number(input.value));};row.append(caption,input);this.panel.append(row);
    };
    const audio=this.audio;
    const soundLabel=document.createElement('label'),soundSelect=document.createElement('select');
    soundLabel.textContent='SOUND LEVEL (MASTER)';soundSelect.setAttribute('aria-label','Sound level');
    for(const name of ['LOW','MEDIUM','HIGH','CUSTOM'] as const){const option=document.createElement('option');option.value=option.textContent=name;option.disabled=option.hidden=name==='CUSTOM';soundSelect.append(option);}
    soundSelect.value=audio.preset;
    soundSelect.onchange=()=>{const name=soundSelect.value;if(name==='LOW'||name==='MEDIUM'||name==='HIGH'){void audio.unlock();audio.setPreset(name);audio.play('ui');this.show('settings');}};
    soundLabel.append(soundSelect);this.panel.append(soundLabel);
    slider('MASTER VOLUME',audio.masterVolume,0,1,0.01,v=>{audio.setVolumes(v,audio.effectsVolume,audio.musicVolume);soundSelect.value=audio.preset;});
    slider('EFFECTS VOLUME',audio.effectsVolume,0,1,0.01,v=>audio.setVolumes(audio.masterVolume,v,audio.musicVolume));
    slider('AMBIENCE',audio.musicVolume,0,1,0.01,v=>audio.setVolumes(audio.masterVolume,audio.effectsVolume,v));
    slider('MOUSE SENSITIVITY',settings.mouseSensitivity*1000,0.5,5,0.1,v=>settings.mouseSensitivity=v/1000);
    slider('FIELD OF VIEW',settings.fov,60,100,1,v=>{settings.fov=v;this.actions.settings();});
    slider('CAMERA EFFECTS',settings.cameraEffects,0,1,0.05,v=>settings.cameraEffects=v);
    const select=document.createElement('select');select.setAttribute('aria-label','Graphics quality');
    for(const preset of ['LOW','MEDIUM','HIGH'] as const){const option=document.createElement('option');option.value=option.textContent=preset;select.append(option);}
    select.value=settings.graphics;select.onchange=()=>{settings.graphics=select.value as typeof settings.graphics;this.actions.settings();};const qualityLabel=document.createElement('label');qualityLabel.textContent='GRAPHICS QUALITY (NOT VOLUME)';qualityLabel.append(select);this.panel.append(qualityLabel);
    this.extra('TEST SOUND',()=>this.audio.play('fire'));
  }
}
