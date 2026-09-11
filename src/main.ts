import * as THREE from 'three';
import './style.css';
import { settings } from './config';
import { InputManager } from './core/InputManager';
import { TimeManager } from './core/TimeManager';
import { AudioManager } from './core/AudioManager';
import { PlayerController } from './player/PlayerController';
import { World } from './world/World';
import { Encounter } from './combat/Encounter';
import { CombatView } from './combat/CombatView';
import { CombatHUD } from './ui/CombatHUD';
import { LevelManager } from './levels/LevelManager';
import { rooms } from './levels/rooms';
import { GameMenu } from './ui/GameMenu';
import { disposeObjects } from './core/dispose';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('game');
const message = element('message');
const button = element<HTMLButtonElement>('enter');

function boot() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(settings.fov,1,0.08,90);
  camera.rotation.order = 'YXZ';
  let world = new World(scene);
  const time = new TimeManager();
  const audio = new AudioManager();
  const playerAction = (action:'jump'|'dash') => { time.requestActivityBurst(action === 'dash' ? 0.28 : 0.2); audio.playAction(action); };
  let player = new PlayerController(world.collision, playerAction);
  let combatView: CombatView;
  const encounter = new Encounter(world.collision.boxes, time, (event, position) => {
    combatView?.event(event, position); audio.playCombat(event);
  });
  combatView = new CombatView(scene, encounter);
  const combatHUD = new CombatHUD(encounter); combatHUD.reset();
  const level = new LevelManager(index=>loadRoom(index));
  let menu:GameMenu;
  let lastEncounter: typeof encounter.state='READY';
  const signal=document.createElement('div');signal.id='system-signal';document.body.append(signal);
  const previousFeet = new THREE.Vector3(), aimDirection = new THREE.Vector3();
  let previous = performance.now(), fps = 60, bobPhase = 0, hudTimer = 0, contextLost = false;
  const input = new InputManager(canvas, locked => {
    document.body.classList.toggle('playing',locked);
    if (locked && level.mode==='ROOM') { encounter.start();menu.hide(); }
    else if (level.mode==='TRANSITION') { if(locked)menu.hide();else menu.show('pause'); }
    else if (!locked && level.mode==='ROOM' && encounter.state==='ACTIVE') menu.show('pause');
    previous = performance.now();
    if (!locked && encounter.state==='ACTIVE') audio.suspend();
  }, text => { message.textContent = text; });
  const applySettings=()=>{
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,settings.graphics==='LOW'?1:settings.graphics==='HIGH'?2:1.5));
    combatView.particleLimit=settings.graphics==='LOW'?24:settings.graphics==='HIGH'?72:48;combatView.trails=settings.graphics!=='LOW';
    camera.fov=settings.fov;camera.updateProjectionMatrix();
  };
  const loadRoom=(index:number)=>{
    input.clear();audio.reset();disposeObjects(combatView.weaponScene);disposeObjects(scene);
    world=new World(scene,rooms[index]);player=new PlayerController(world.collision,playerAction);
    encounter.setWalls(world.collision.boxes);encounter.configure(rooms[index].enemies,level.scatterUnlocked,!!rooms[index].tutorial,level.difficulty);
    combatView=new CombatView(scene,encounter);combatView.resize(camera.aspect);applySettings();
    world.update(0,0);bobPhase=hudTimer=0;previous=performance.now();lastEncounter='READY';
    if(rooms[index].tutorial)encounter.projectiles.spawn(new THREE.Vector3(-5,1.3,0),new THREE.Vector3(1,0,0),{speed:3,damage:0,color:0x70e8d2});
    if(input.locked){encounter.start();menu.hide();}else menu.show('ready');
  };
  const resume=()=>{if(!contextLost){void input.lock();void audio.unlock();}};
  const reset=()=>level.retry();
  menu=new GameMenu(level,audio,{
    start:()=>{level.begin();resume();},resume,
    retry:()=>{level.retry();resume();},
    next:()=>{level.next();menu.hide();},
    main:()=>{level.returnToMenu();document.exitPointerLock();input.clear();encounter.projectiles.reset();audio.reset();menu.show('main');document.body.classList.remove('playing');},
    settings:applySettings,
  });
  const debug = element('debug');
  const debugEnabled = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
  debug.hidden = true;
  // Opt-in development harness only; Vite removes this branch from production builds.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug'))
    Object.assign(window, { __TIMELOCK_TEST__: { encounter, get player(){return player;}, time, reset,level,audio, get view(){return combatView;} } });
  document.addEventListener('keydown', e => { if (e.code === 'F3' && debugEnabled) { e.preventDefault(); debug.hidden = !debug.hidden; } });
  const resize = () => { renderer.setSize(window.innerWidth,window.innerHeight); camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); combatView.resize(camera.aspect); };
  window.addEventListener('resize',resize); resize();
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); contextLost = true; document.exitPointerLock(); element('overlay').hidden = false;
    message.textContent = 'Graphics context was lost. Reload this page to restart the lab.'; button.disabled = true;
  });
  const state = element('state'), scale = element('scale'), dash = element('dash'), fill = element('time-fill');
  const frameInput = { x:0,z:0,jump:false,dash:false };
  const activity = { input:0,speed:0,angularSpeed:0,airborne:false };
  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.max(0,Math.min((now-previous)/1000,0.05)); previous = now;
    if (contextLost || document.hidden) return;
    if(level.mode!=='TRANSITION'||input.locked)level.update(dt);
    fps += (1 / Math.max(dt,0.001) - fps) * (1-Math.exp(-dt*3));
    const active = input.locked && encounter.state === 'ACTIVE' && level.mode==='ROOM';
    let fire = false, reload = false;
    if (active) {
      previousFeet.copy(player.position);
      const dx = input.dx, dy = input.dy; input.dx = input.dy = 0;
      const oldPitch = player.pitch;
      player.look(dx,dy);
      frameInput.x = Number(input.keys.has('KeyD'))-Number(input.keys.has('KeyA'));
      frameInput.z = Number(input.keys.has('KeyS'))-Number(input.keys.has('KeyW'));
      frameInput.jump = input.pressed('Space');
      const leftDash = input.pressed('ShiftLeft'), rightDash = input.pressed('ShiftRight');
      frameInput.dash = leftDash || rightDash;
      player.update(dt,frameInput);
      encounter.updateReal(dt);
      if(input.pressed('Digit1'))encounter.switchWeapon(1);
      if(input.pressed('Digit2'))encounter.switchWeapon(2);
      fire = input.pressed('Fire'); reload = input.pressed('KeyR');
      activity.input = Math.min(1,Math.hypot(frameInput.x,frameInput.z));
      activity.speed = Math.hypot(player.velocity.x,player.velocity.z);
      activity.angularSpeed = Math.hypot(dx*settings.mouseSensitivity,player.pitch-oldPitch)/Math.max(dt,0.001);
      activity.airborne = !player.grounded;
      bobPhase += activity.speed*dt*1.7;
    }
    const moving = input.locked && player.grounded ? Math.min(1,Math.hypot(player.velocity.x,player.velocity.z)/settings.movementSpeed) : 0;
    const bob = Math.sin(bobPhase*2)*0.025*moving;
    camera.position.set(player.position.x,player.position.y+1.6+(bob-player.landing)*settings.cameraEffects,player.position.z);
    camera.rotation.set(Math.min(Math.PI/2-0.02, player.pitch + (combatView.recoil * 0.012 + combatView.damageFlash * 0.006) * settings.cameraEffects),player.yaw,0);
    camera.updateMatrixWorld();
    if (active) {
      if (reload) encounter.reload();
      if (fire) encounter.fire(camera.position, camera.getWorldDirection(aimDirection));
      time.update(dt,activity); world.update(time.worldDelta,time.worldElapsed); audio.setTimeScale(time.scale);
      encounter.updateWorld(time.worldDelta, previousFeet, player.position);
      level.calibrate(dt,activity.speed,time.scale);encounter.tutorialCanFire=level.tutorial==='FIRE'||!level.room.tutorial;
    } else if ((encounter.state === 'CLEARED' || encounter.state === 'DEAD') && level.mode!=='MENU') {
      // Finish only the terminal presentation, with the same central world clock. No active AI/projectiles.
      activity.input = activity.speed = activity.angularSpeed = 0; activity.airborne = false;
      time.update(dt, activity); world.update(time.worldDelta, time.worldElapsed);
      for (const enemy of encounter.enemies) if (!enemy.health.alive) enemy.deathTime += time.worldDelta;
    }
    const terminal = encounter.state === 'CLEARED' || encounter.state === 'DEAD';
    combatView.update(active || terminal ? dt : 0, active || terminal ? time.worldDelta : 0, bob);
    combatHUD.update(combatView);
    if(encounter.state!==lastEncounter){
      lastEncounter=encounter.state;
      if(encounter.state==='DEAD'){document.exitPointerLock();menu.show('dead');document.body.classList.remove('playing');}
      if(encounter.state==='CLEARED'){
        level.roomCleared();
        if(level.mode==='ENDING'){document.exitPointerLock();document.body.classList.remove('playing');time.reset();menu.hide();audio.reset();audio.play('ending');}
        else {level.next(3);input.clear();menu.hide();}
      }
    }
    signal.classList.toggle('full',level.mode==='TRANSITION'||level.mode==='ENDING');
    signal.textContent=level.mode==='TRANSITION'&&input.locked?'NEXT ROOM · '+Math.min(2,Math.floor(level.transitionRemaining)):level.mode==='ENDING'&&level.endingElapsed<4?(level.endingElapsed<2?'TEMPORAL CONTAINMENT FAILED':'TIME UNLOCKED'):active&&level.room.tutorial?(level.tutorial==='MOVE'?'MOVE · WASD':level.tutorial==='STOP'?'STOP · RELEASE MOVEMENT':'TIME MOVES WHEN YOU DO. · FIRE AT THE GREEN TARGET'):'';
    signal.hidden=!signal.textContent;
    if(level.mode==='ENDING'&&level.endingElapsed>=4&&level.endingElapsed-dt<4)menu.show('ending');
    element('room-state').textContent=level.room.name+' / '+encounter.remaining+' HOSTILES · '+level.difficulty.name;
    const boss=encounter.enemies.find(enemy=>enemy.kind==='warden');
    if(boss && active)element('room-state').textContent='WARDEN · PHASE '+boss.phase+' · '+Math.ceil(boss.health.current)+' HP · '+(boss.coreOpen?'CORE OPEN':'CORE SEALED');
    const targetFov = settings.fov+((player.dashRemaining > 0 ? 9 : 0) + combatView.recoil * 1.5)*settings.cameraEffects;
    const newFov = camera.fov+(targetFov-camera.fov)*(1-Math.exp(-dt*14));
    if (Math.abs(newFov-camera.fov)>0.001) { camera.fov = newFov; camera.updateProjectionMatrix(); }
    hudTimer += dt;
    if (hudTimer >= 0.08) {
      hudTimer = 0;
      state.textContent = input.locked ? time.state : 'STANDBY';
      scale.textContent = `${time.scale.toFixed(3)} ×`;
      fill.style.transform = `scaleX(${time.scale})`;
      dash.textContent = player.cooldown > 0 ? `${player.cooldown.toFixed(1)} s` : 'READY';
      document.documentElement.style.setProperty('--locked',String(1-time.scale));
      if (!debug.hidden) debug.textContent = `DEVELOPER TELEMETRY / F3\nFPS        ${fps.toFixed(0)}\nVELOCITY   ${player.velocity.length().toFixed(2)} m/s\nGROUNDED   ${player.grounded ? 'YES' : 'NO'}\nDASH       ${player.cooldown === 0 ? 'READY' : player.cooldown.toFixed(2)}\nTIME       ${time.scale.toFixed(3)}\nTARGET     ${time.target.toFixed(3)}\nACTIVITY   ${time.activity.toFixed(2)}\nSTATE      ${time.state}\nHP         ${encounter.health.current}\nAMMO       ${encounter.weapon.ammo}\nWEAPON     ${encounter.weapon.state}\nENEMIES    ${encounter.remaining}\nPROJECTILES ${encounter.projectiles.count}\nENCOUNTER  ${encounter.state}\n${active ? 'SIMULATION ACTIVE' : 'PAUSED / CLICK TO ENTER'}`;
    }
    renderer.render(scene,camera);
    if (encounter.state !== 'READY' && level.mode!=='MENU') combatView.render(renderer);
  }
  requestAnimationFrame(frame);
}
try { boot(); } catch (error) {
  message.textContent = 'Unable to start the 3D lab. Enable WebGL 2 / hardware acceleration and reload.';
  button.disabled = true; console.error('TIME//LOCK initialization failed',error);
}
