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
  await command('Page.navigate',{url});await delay(2000);
  assert.equal(await evaluate('document.querySelector("#enter").disabled'),false);
  assert.equal(await evaluate('document.querySelector("#debug").hidden'),true);
  await command('Input.dispatchKeyEvent',{type:'keyDown',code:'F3',key:'F3'});
  await command('Input.dispatchKeyEvent',{type:'keyUp',code:'F3',key:'F3'});
  await writeFile(path.join(root,'stage2-intro.png'),Buffer.from((await command('Page.captureScreenshot')).data,'base64'));
  const rect=await evaluate('(()=>{const r=document.querySelector("#enter").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});await delay(500);
  const locked=await evaluate('!!document.pointerLockElement');
  if (!locked) {
    console.log('Headless Chrome did not acquire pointer lock; using an explicit test shim for input integration. Native mouse capture remains unverified.');
    await evaluate(`(()=>{window.__testPointerLock=document.querySelector('#game');Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>window.__testPointerLock});document.exitPointerLock=()=>{window.__testPointerLock=null;document.dispatchEvent(new Event('pointerlockchange'));};document.dispatchEvent(new Event('pointerlockchange'));})()`);
    await delay(200);
  }
  const telemetry=()=>evaluate('document.querySelector("#debug").textContent');
  assert.match(await telemetry(),/LOCKED/);
  await command('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});await delay(700);
  assert.match(await telemetry(),/FLOWING/);
  await command('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});
  await command('Input.dispatchKeyEvent',{type:'keyDown',code:'Space',key:' '});await delay(100);
  assert.match(await telemetry(),/GROUNDED\s+NO/);
  await command('Input.dispatchKeyEvent',{type:'keyUp',code:'Space',key:' '});await delay(1100);
  await command('Input.dispatchKeyEvent',{type:'keyDown',code:'ShiftLeft',key:'Shift'});await delay(100);
  assert.match(await telemetry(),/ACTION BURST/);
  await command('Input.dispatchKeyEvent',{type:'keyUp',code:'ShiftLeft',key:'Shift'});await delay(2400);
  assert.match(await telemetry(),/LOCKED/);
  // Real input listeners, including held-button protection; capture may be shimmed as reported above.
  const mouse = type => evaluate(`document.dispatchEvent(new MouseEvent('${type}',{button:0,bubbles:true}))`);
  const tap = async code => { await command('Input.dispatchKeyEvent',{type:'keyDown',code,key:code==='KeyR'?'r':code});await command('Input.dispatchKeyEvent',{type:'keyUp',code,key:code==='KeyR'?'r':code}); };
  await mouse('mousedown');await delay(300);await mouse('mousedown');await delay(200);
  assert.equal(await evaluate('document.querySelector("#ammo").textContent'),'07');
  await mouse('mouseup');await tap('KeyR');await delay(150);
  assert.match(await evaluate('document.querySelector("#weapon-state").textContent'),/RELOADING/);
  await mouse('mousedown');await mouse('mouseup');await delay(100);
  assert.equal(await evaluate('document.querySelector("#ammo").textContent'),'07');
  await evaluate('document.exitPointerLock()');await delay(150);
  const pausedReload=await evaluate('document.querySelector("#weapon-state").textContent');
  await delay(450);assert.equal(await evaluate('document.querySelector("#weapon-state").textContent'),pausedReload);
  const resume=async()=>{
    if(!locked) await evaluate(`(()=>{window.__testPointerLock=document.querySelector('#game');document.dispatchEvent(new Event('pointerlockchange'));})()`);
    else { const r=await evaluate('(()=>{const r=document.querySelector("#enter").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...r}); }
    await delay(150);
  };
  await resume();await delay(1400);assert.equal(await evaluate('document.querySelector("#ammo").textContent'),'08');
  const developmentHarness=await evaluate('!!window.__TIMELOCK_TEST__');
  if(developmentHarness) {
    await evaluate('window.__TIMELOCK_TEST__.player.reset()');
    const aim=async(index)=>evaluate(`(()=>{const h=window.__TIMELOCK_TEST__,p=h.player,e=h.encounter.enemies[${index}];const x=e.position.x-p.position.x,z=e.position.z-p.position.z,y=e.position.y+1.05-(p.position.y+1.6);p.yaw=Math.atan2(-x,-z);p.pitch=Math.atan2(y,Math.hypot(x,z));})()`);
    for(let enemy=0;enemy<2;enemy++) {
      await aim(enemy);await delay(150);
      for(let shot=0;shot<3;shot++){await mouse('mousedown');await mouse('mouseup');await delay(280);}
    }
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.state'),'CLEARED');
    assert.match(await evaluate('document.querySelector("#intro-title").textContent'),/ROOM CLEARED/);
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.projectiles.count'),0);
    await writeFile(path.join(root,'stage2-victory.png'),Buffer.from((await command('Page.captureScreenshot')).data,'base64'));
    // Exercise the actual retry button handler. The test shim only supplies browser capture.
    await evaluate('document.querySelector("#enter").click()');await delay(200);await resume();
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.health.current'),100);
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.weapon.ammo'),8);
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.remaining'),2);
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.player.cooldown'),0);
    // Place a visible hostile projectile ahead of the camera, then verify the locked trajectory.
    await evaluate(`(()=>{const h=window.__TIMELOCK_TEST__,v=h.player.position.clone();v.y+=1.5;v.z-=2;h.encounter.projectiles.spawn(v,v.clone().set(0,0,1));})()`);
    const before=await evaluate('window.__TIMELOCK_TEST__.encounter.projectiles.items[0].position.z');
    await delay(500);
    const after=await evaluate('window.__TIMELOCK_TEST__.encounter.projectiles.items[0].position.z');
    assert.ok(after-before>0 && after-before<0.2);
    await writeFile(path.join(root,'stage2-projectile.png'),Buffer.from((await command('Page.captureScreenshot')).data,'base64'));
    await mouse('mousedown');await mouse('mouseup');await delay(100);await tap('KeyR');await delay(100);
    await evaluate(`(()=>{const h=window.__TIMELOCK_TEST__,v=h.player.position.clone();v.y+=1.2;for(let i=0;i<4;i++)h.encounter.projectiles.spawn(v,v.clone().set(0,0,1));})()`);
    await delay(250);
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.state'),'DEAD');
    assert.match(await evaluate('document.querySelector("#intro-title").textContent'),/TIME EXPIRED/);
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.projectiles.count'),0);
    await writeFile(path.join(root,'stage2-death.png'),Buffer.from((await command('Page.captureScreenshot')).data,'base64'));
    await evaluate('document.querySelector("#enter").click()');await delay(200);await resume();
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.weapon.reloadRemaining'),0);
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.weapon.ammo'),8);
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.health.current'),100);
    assert.equal(await evaluate('window.__TIMELOCK_TEST__.encounter.projectiles.count'),0);
  }
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:700,y:450,movementX:80,movementY:10});
  await command('Input.dispatchKeyEvent',{type:'keyDown',code:'F3',key:'F3'});
  assert.equal(await evaluate('document.querySelector("#debug").hidden'),true);
  await command('Input.dispatchKeyEvent',{type:'keyUp',code:'F3',key:'F3'});
  await command('Input.dispatchKeyEvent',{type:'keyDown',code:'F3',key:'F3'});
  await command('Input.dispatchKeyEvent',{type:'keyUp',code:'F3',key:'F3'});
  assert.equal(await evaluate('document.querySelector("#debug").hidden'),false);
  await writeFile(path.join(root,'stage2-arena.png'),Buffer.from((await command('Page.captureScreenshot')).data,'base64'));
  await evaluate('document.exitPointerLock()');await delay(100);
  assert.equal(await evaluate('document.querySelector("#overlay").hidden'),false);
  await command('Emulation.setDeviceMetricsOverride',{width:960,height:640,deviceScaleFactor:1,mobile:false});await delay(100);
  assert.equal(await evaluate('document.querySelector("canvas").style.width'),'960px');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({url,startup:true,nativePointerLock:locked,inputShim:!locked,movement:true,jump:true,dash:true,timeSettling:true,semiAuto:true,reload:true,pauseDuringReload:true,developmentHarness,victoryAndDeathRetry:developmentHarness,hudToggle:true,unlockEvent:true,resize:true,consoleErrors:errors,telemetry:await telemetry()},null,2));
} finally { socket?.close();chrome.kill(); }
