import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

// Optional local Chrome check using the built-in DevTools protocol; no test dependency.
const root = path.resolve('.test-artifacts');
const url = process.env.TEST_URL || 'http://127.0.0.1:5173/?debug';
await mkdir(root, { recursive: true });
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--remote-debugging-port=9223', `--user-data-dir=${path.join(root, 'chrome-profile')}`,
  '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', 'about:blank',
], { stdio: 'ignore', windowsHide: true });
let socket;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let tabs;
  for(let i=0;i<40;i++) { try { tabs = await (await fetch('http://127.0.0.1:9223/json')).json(); break; } catch { await delay(250); } }
  assert.ok(tabs, 'Chrome DevTools must start');
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve,reject) => { socket.onopen=resolve;socket.onerror=reject; });
  let id=0; const pending=new Map(); const errors=[];
  socket.onmessage = event => {
    const message=JSON.parse(event.data);
    if(message.id) { const job=pending.get(message.id);pending.delete(message.id); if(job) { if(message.error)job.reject(message.error);else job.resolve(message.result); } }
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
    if(message.method==='Runtime.consoleAPICalled' && message.params.type==='error')errors.push(message.params.args);
  };
  socket.onclose = event => { for(const job of pending.values())job.reject(Error(`DevTools closed: ${event.code} ${event.reason}`));pending.clear(); };
  const command=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;const timeout=setTimeout(()=>{pending.delete(request);reject(Error(`DevTools timeout: ${method}`));},5000);pending.set(request,{resolve:value=>{clearTimeout(timeout);resolve(value);},reject:error=>{clearTimeout(timeout);reject(error);}});socket.send(JSON.stringify({id:request,method,params}));});
  const evaluate=async expression=> {const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  await command('Runtime.enable');await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});

  await command('Page.navigate',{url});await delay(1500);
  assert.equal(await evaluate('document.querySelector("#enter").textContent'),'ENTER SIMULATION');
  const clickText=async text=>evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(text)});if(!button)throw Error('Button missing');button.click();})()`);
  await clickText('SETTINGS');
  assert.equal(await evaluate('document.querySelectorAll("#menu-panel input").length'),6);
  await evaluate(`(()=>{const input=document.querySelector('[aria-label="MASTER VOLUME"]');input.value='0.6';input.dispatchEvent(new Event('input'));const quality=document.querySelector('[aria-label="Graphics quality"]');quality.value='LOW';quality.dispatchEvent(new Event('change'));})()`);
  await clickText('BACK');
  await writeFile(path.join(root,'stage3-menu.png'),Buffer.from((await command('Page.captureScreenshot')).data,'base64'));
  await clickText('ENTER SIMULATION');
  await clickText('DIFFICULTY: '+(process.env.TEST_DIFFICULTY||'MEDIUM'));
  const rect=await evaluate('(()=>{const r=document.querySelector("#enter").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});await delay(400);
  const nativeCapture=await evaluate('!!document.pointerLockElement');
  const capture=async()=>{
    if(!nativeCapture)await evaluate(`(()=>{window.__capture=document.querySelector('#game');Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>window.__capture});document.exitPointerLock=()=>{window.__capture=null;document.dispatchEvent(new Event('pointerlockchange'));};document.dispatchEvent(new Event('pointerlockchange'));})()`);
    await delay(120);
  };
  await capture();
  await command('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});await delay(600);
  await command('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});await delay(1700);
  assert.match(await evaluate('document.querySelector("#system-signal").textContent'),/FIRE/);
  const harness=await evaluate('!!window.__TIMELOCK_TEST__');
  if(harness){
    await delay(700);
    const audioOutput=await evaluate(`(async()=>{
      const audio=window.__TIMELOCK_TEST__.audio;await audio.sampleLoad;
      if(audio.loadedSamples.size!==2)throw Error('Samples failed: '+audio.sampleError);
      const render=async(master,effects,ambience,branch)=>{
        const context=new OfflineAudioContext(1,12000,24000),mix=new audio.mix.constructor(context);
        mix.set(master,effects,ambience,true);const tone=context.createOscillator();tone.frequency.value=220;tone.connect(mix[branch]);tone.start();
        const data=(await context.startRendering()).getChannelData(0);let sum=0,peak=0;for(const v of data){sum+=v*v;peak=Math.max(peak,Math.abs(v));}return {rms:Math.sqrt(sum/data.length),peak};
      };
      const levels=[];for(const master of [0,0.25,0.6,0.95])levels.push(await render(master,0.85,0,'realtime'));
      const quiet=await render(0.6,0.2,0,'world'),loud=await render(0.6,0.8,0,'world');
      const ambientQuiet=await render(0.6,0,0.2,'ambience'),ambientLoud=await render(0.6,0,0.8,'ambience');
      if(levels[0].peak!==0||Math.abs(levels[3].rms/levels[1].rms-3.8)>0.01||Math.abs(loud.rms/quiet.rms-4)>0.01||Math.abs(ambientLoud.rms/ambientQuiet.rms-4)>0.01||levels.some(v=>v.peak>=1))throw Error('Audio output regression');
      const originalContext=audio.context;
      for(const [preset,target] of [['HIGH',0.95],['LOW',0.25],['HIGH',0.95],['MEDIUM',0.6],['LOW',0.25]]){
        audio.setPreset(preset);await new Promise(resolve=>setTimeout(resolve,100));
        if(Math.abs(audio.mix.master.gain.value-target)>0.003)throw Error('Live preset gain mismatch');
        for(const sound of ['fire','scatter','reload','enemyShot','aim','lock','nearMiss','damage','kill','bossPhase','ui'])audio.play(sound);
      }
      audio.reset();await audio.unlock();if(audio.context!==originalContext)throw Error('Duplicated AudioContext');
      audio.setVolumes(0.4,0.85,0.18);await new Promise(resolve=>setTimeout(resolve,100));
      if(Math.abs(audio.mix.master.gain.value-0.4)>0.003||audio.preset!=='CUSTOM')throw Error('Master slider after preset failed');
      audio.setPreset('MEDIUM');
      return {levels,effectsRatio:loud.rms/quiet.rms,ambienceRatio:ambientLoud.rms/ambientQuiet.rms,samples:[...audio.loadedSamples]};
    })()`);
    console.log('Measured Web Audio output:',JSON.stringify(audioOutput));
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.audio.masterVolume'),0.6);
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.view.particleLimit'),24);
    for(let room=0;room<7;room++){
      assert.equal(await evaluate('window.__TIMELOCK_TEST__.level.index'),room);
      if(room===2||room===6){
        await evaluate('window.__TIMELOCK_TEST__.encounter.damagePlayer(1000)');await delay(150);
        assert.match(await evaluate('document.querySelector("#intro-title").textContent'),/TIME EXPIRED/);
        await clickText('RETRY ROOM');await capture();
        assert.equal(await evaluate('window.__TIMELOCK_TEST__.level.index'),room);
        assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.health.current'),100);
      }
      if(room===4){
        await command('Input.dispatchKeyEvent',{type:'keyDown',code:'Digit2',key:'2'});
        await command('Input.dispatchKeyEvent',{type:'keyUp',code:'Digit2',key:'2'});await delay(100);
        assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.activeWeapon'),2);
      }
      if(room===6){
        await evaluate(`(()=>{const h=window.__TIMELOCK_TEST__,boss=h.encounter.enemies[0];boss.health.current=600;h.encounter.updateWorld(0.01,h.player.position,h.player.position);})()`);
        assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.enemies[0].phase'),2);
        await writeFile(path.join(root,'stage3-boss.png'),Buffer.from((await command('Page.captureScreenshot')).data,'base64'));
      }
      // Damage API integration sweep; fixture positions bypass human aiming, explicitly reported.
      await evaluate(`(()=>{const h=window.__TIMELOCK_TEST__,enc=h.encounter;enc.activeWeapon=1;enc.tutorialCanFire=true;for(const enemy of enc.enemies){enemy.coreOpen=true;enemy.shieldActive=false;const target=enemy.kind==='drone'?enemy.position.clone().add({x:0,y:0.5,z:0}):enemy.head.getCenter(enemy.position.clone());const origin=target.clone();origin.z+=0.85;for(let shot=0;enemy.health.alive&&shot<70;shot++){enc.pistol.ammo=8;enc.updateReal(0.3);enc.fire(origin,target.clone().sub(origin).normalize());}if(enemy.health.alive)throw Error('Enemy not defeated: '+enemy.kind);}})()`);
      await delay(180);
      assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.state'),'CLEARED');
      assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.projectiles.count'),0);
      if(room<6){
        assert.equal(await evaluate('window.__TIMELOCK_TEST__.level.mode'),'TRANSITION');
        assert.match(await evaluate('document.querySelector("#system-signal").textContent'),/NEXT ROOM · [210]/);
        assert.equal(await evaluate('document.querySelector("#overlay").hidden'),true);
        for(let wait=0;wait<100&&await evaluate('window.__TIMELOCK_TEST__.level.index')===room;wait++)await delay(100);
        assert.equal(await evaluate('window.__TIMELOCK_TEST__.level.index'),room+1);
        assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.state'),'ACTIVE');
        assert.equal(await evaluate('document.querySelector("#overlay").hidden'),true);
      }
    }
    await delay(4200);
    assert.equal(await evaluate('document.querySelector("#intro-title").textContent'),'TIME UNLOCKED');
    await clickText('CREDITS');await delay(150);
    assert.equal(await evaluate('document.querySelector("#intro-title").textContent'),'CREDITS');
    await clickText('BACK');await clickText('MAIN MENU');
    assert.equal(await evaluate('document.querySelector("#enter").textContent'),'ENTER SIMULATION');
  }
  await command('Emulation.setDeviceMetricsOverride',{width:960,height:640,deviceScaleFactor:1,mobile:false});await delay(150);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({url,nativeCapture,captureShim:!nativeCapture,menuSettings:true,tutorialMoveStop:true,campaignDamageApiSweep:harness,roomAndBossRetry:harness,endingCredits:harness,consoleErrors:errors},null,2));
}finally{socket?.close();chrome.kill();}


