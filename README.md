# TIME//LOCK

Stage 3 implementation is complete with intentionally simple presentation. A tutorial, five combat rooms, five normal enemy archetypes, two weapons, a three-phase boss and an ending are connected. Automated checks pass; native capture, human difficulty/pacing and listening tests remain unverified. Stage 4 was not started.

## Run

- npm install
- npm run dev — http://localhost:5173
- npm test — system tests
- npm run build — TypeScript check and static dist/ build
- npm run preview — http://localhost:4173

Desktop WebGL 2, keyboard and mouse required. No new dependencies, backend or runtime network services were added.

## Controls and menus

WASD move; mouse aim; left click semi-auto fire; R reload; Space jump; Shift directional dash; 1 pistol; 2 Scattergun after unlock; Escape pauses/releases capture. F3 toggles initially hidden telemetry in development or production with ?debug.

Main menu: Enter Simulation, Settings, How to Play, Credits.
Pause: Resume, Restart Room, Settings, Main Menu.
Clear: automatic 2 → 1 → 0 countdown, then the next checkpoint starts with mouse capture retained. Escape pauses the countdown; Resume continues it.
Death: TIME EXPIRED / Retry Room.
Ending: TIME UNLOCKED / Play Again, Main Menu, Credits.

Settings apply immediately for the session: master volume, effects, ambience, mouse sensitivity, FOV, camera effects and LOW/MEDIUM/HIGH graphics. Presets adjust pixel ratio, particle budget and trails. Settings are not saved across page reloads.

## Campaign

| Room | Purpose / roster |
| --- | --- |
| Temporal Calibration | Move, stop and shoot a green target; harmless temporal projectile |
| First Contact | Original two-Gunner encounter |
| Pressure | Two Gunners and a Charger |
| Sightline | Gunner, Charger, Marksman; clear unlocks Scattergun |
| Vertical Threat | Two Gunners, Drone, Charger; raised cover |
| Control | Sentinel, Marksman, Drone, Charger |
| The Warden | Three-phase boss and final containment-failure sequence |

Rooms use distinct cover layouts and accent colors within a shared primitive arena shell. Enemies are present visibly at entry, with attack telegraphs; no surprise behind-player spawns. Health/ammo restore fully on room entry. Retry preserves the current room checkpoint and weapon unlock, resets the active weapon to pistol, and clears enemies, bullets, timers, camera effects and audio voices.

The requested 10–20-minute campaign and 2–4-minute boss durations are design targets, not measured playtest results.

## Enemies and weapons

- **Gunner:** preserved red baseline enemy; committed aim, visible projectile and recovery.
- **Charger:** orange melee silhouette; charge telegraph, world-time rush, collision-safe movement, one melee hit per rush and recovery.
- **Marksman:** slim violet silhouette, long emitter; tracks initially, locks aim before firing a visible faster 40-damage projectile, then recovers.
- **Burst Drone:** cyan hovering machine; bounded world-time motion and three spaced low-damage shots.
- **Sentinel:** white heavy with visible front shield; frontal body damage blocked while shielded. Headshots, flanking or the timed opening permit damage. Slow heavy shot.
- **Warden:** large white/black construct; only its red core takes damage while open. Phase 1 fires readable five-shot spreads. At 68% HP, telegraphed rotating beams are added; cover blocks them and damage has a cooldown. At 33%, recovery shortens and two side constructs add projectile pressure. No summoned armies. Death disables attacks and starts the four-second containment-failure / TIME UNLOCKED ending.

Pulse Pistol retains 8 rounds, 0.21-second cadence, 1.3-second real reload and 34 body/68 head damage. Scattergun has 5 shells, seven rays, range falloff, 0.7-second cadence, 1.9-second reload and stronger recoil/time burst. Switching during reload is intentionally blocked. Reserve ammo is unlimited. Scattergun unlock is a room-clear reward/message, not a separate physical inventory pickup.

## Time and audio

TimeManager remains authoritative. Player control, weapon timers, reload, UI and recoil use real time. Enemy motion, aim, shields, boss attacks, bullets and world particles use worldDelta. Pistol shots request 0.24-second temporal bursts; Scattergun blasts request 0.55 seconds. Relative sweeps catch a player crossing a nearly frozen projectile.

**Audio was specifically improved for loudness and balance:** cached procedural samples layer a sharp transient, lower body and mechanical tail instead of quiet lone oscillator tones. Sources are normalized to a 0.75 peak, mixed at role-specific levels, compressed and soft-limited before the master gain. Enemy effects sit below player weapon effects. Master defaults to 60%, effects 85%, ambience 18%. The settings menu includes Test Sound.

Hostile playback pitch follows time smoothly within a usable range; player/UI effects stay responsive. Two quiet ambient tones provide atmosphere, not a composed soundtrack. Voices are capped at 24 and samples are reused. Two bundled Kenney CC0 Digital Audio samples supply weapon fire; other effects retain procedural synthesis. See public/audio/README.md and Kenney-License.txt. Waveform checks establish finite samples/headroom, not subjective sound quality on your speakers.

## Architecture and file inventory

Preserved PlayerController and CollisionWorld movement logic. Existing Encounter, Gunner, projectile pool, PulsePistol, CombatView and TimeManager remain the foundation. LevelManager owns campaign progression; room definitions hold cover/rosters. Archetype shares only the common state needed for four new roles; Warden owns its boss behavior. GameMenu owns menu/settings flow. Room rebuilds explicitly dispose geometry, materials and textures.

Created:
- src/levels/rooms.ts, LevelManager.ts
- src/enemies/Archetype.ts, Warden.ts
- src/weapons/Scattergun.ts
- src/core/sound.ts, dispose.ts
- src/ui/GameMenu.ts
- tests/campaign.test.ts
- scripts/campaign-smoke.mjs

Modified:
- src/main.ts, src/config.ts, src/style.css
- src/core/AudioManager.ts
- src/world/World.ts
- src/enemies/Gunner.ts
- src/weapons/PulsePistol.ts
- src/combat/Encounter.ts, ProjectilePool.ts, CombatView.ts
- src/ui/CombatHUD.ts
- README.md, AI_agents_info.md

## Validation and limitations

**Passed:** all 39 system tests, including the 23 Stage 1/2 regressions, each new enemy, boss vulnerability/phases, switching/reset, room progression and deterministic audio peaks/RMS. TypeScript and production build passed. No Stage 1/2 regression was detected. A Charger test initially omitted the floor and was corrected to represent actual rooms; ending Credits flow was corrected to avoid the ending screen replacing it every frame.

**Chrome development browser:** menus/settings, tutorial move/stop, seven-room progression via the actual damage API, room and boss death/retry, weapon switching, ending/credits/menu return, resize and no captured runtime errors. Setup/damage calls used the opt-in development harness; this was not a human combat playthrough. The boss screenshot was inspected.

**Chrome production browser:** menus/settings and tutorial move/stop passed; development hooks were absent; no captured runtime errors. Full production combat progression was not exercised.

**Capture:** headless native pointer lock failed, so browser input used a disclosed capture shim. Physical mouse capture, Escape/reentry and real tab switching remain unverified. A prior automatic approval attempt hit the usage limit; the same check was retried successfully after the user asked to continue.

**Not tested:** human aiming/dodging/audio balance, normal-play beatability of each room, campaign duration, sustained memory/target-GPU performance, Firefox/Safari or full production victory. Earlier Stage 2 Edge results are not claimed as Stage 3 coverage.

Final production output: JS 544.99 kB / 142.31 kB gzip; CSS 5.44 kB / 1.90 kB gzip. Vite retains its non-failing >500 kB chunk advisory. No Stage 3 FPS benchmark was performed. Pools, shared geometry and quality presets bound costs.

Known limitations: simple AABB hitboxes/collision, local steering without global pathfinding, shared arena shell, thin boss beam visuals, automatic Scattergun reward, short text/fade ending and generic credits. No known functional failures in covered checks; manual acceptance remains pending.

## Manual acceptance

Latest targeted pass (2026-09-11): Drone raycasts now inverse-transform the shot into the same local boxes used by its rendered body, visor and wings. Previously humanoid damage boxes missed visible upper body/wing regions and ignored yaw. No camera-origin or health-count fault was found. Regression coverage includes rotated edges, empty space, moving positions, both weapons at 3/22 units, final-hostile clear and retry.

All normal enemies now use world-time movement: Gunners strafe and back away; Chargers reposition between rushes and stop at bodies/cover; Marksmen maintain distance and move during recovery; Drones combine bounded horizontal orbit and altitude variation; Sentinels apply slow pressure and lateral movement. Ground steering uses acceleration, seeded variable decision intervals, collision and separation. This is local steering, not global route planning; complex obstacle layouts still need human inspection.

Enter Simulation opens difficulty selection before BEGIN. The selection remains fixed through retries/transitions and is read-only in settings. Starting another campaign permits a new selection. Existing enemy counts and HP, player weapons and campaign ramp are retained; MEDIUM recovery is slightly faster than the prior baseline.

| Multiplier | LOW | MEDIUM | HARD |
| --- | ---: | ---: | ---: |
| Projectile speed | 0.80 | 1.00 | 1.20 |
| Aim error | 1.80 | 1.00 | 0.45 |
| Telegraph duration | 1.30 | 1.00 | 0.84 |
| Recovery duration | 1.25 | 0.92 | 0.78 |
| Movement speed | 0.75 | 1.00 | 1.22 |
| Reposition decision interval | 1.30 | 1.00 | 0.75 |
| Incoming damage | 4.00 | 5.00 | 5.60 |
| Boss pattern clock / beam speed | 0.80 | 1.00 | 1.18 |

Warden keeps 900 HP and its phase thresholds. Its telegraph/recovery durations also divide by the boss clock multiplier: LOW gives longer core openings, HARD shorter openings and faster patterns. No extra enemies or unavoidable-hit mechanic was added. Beatability and perceived balance are not established by automation.

The old unlabeled LOW/MEDIUM/HIGH selector controlled graphics, not sound. Graphics is now explicitly labeled; separate SOUND presets set actual master gain to 0.25/0.60/0.95. Effects attenuation moved after compression/limiting so compression cannot compensate for slider reductions. All effects route through this bus and master; ambience independently routes through master. Gain updates are smoothed over 15 ms; settings last for the session. No duplicate audio context was found; context reuse is checked.

Weapon assets: Kenney (Kenney Vleugels), Digital Audio, laser1.ogg and laser9.ogg, approximately 18.6 kB combined. Source: https://kenney.nl/assets/digital-audio. CC0; attribution is not required, provenance and original license are bundled in public/audio/. Samples are decoded/cached and normalized to 0.75 peak; Scattergun adds a restrained original low transient and slower playback. Procedural fallback keeps gameplay working if decoding fails.

Latest validation: 39/39 tests pass (33 preserved plus six new regressions); TypeScript/Vite build passes. Chrome MEDIUM/LOW and Edge HARD passed seven-room damage-API progression, retries, ending and console checks. Chrome production passed settings/difficulty entry and tutorial movement/stopping with no development harness. Browser checks use a pointer-lock shim, not native capture or human aiming. Real OfflineAudioContext output RMS for LOW/MEDIUM/HIGH was 0.1031/0.2475/0.3918 with the same tone; peaks 0.1432/0.3437/0.5441. Mute was zero; Effects and Ambience each produced the expected 4:1 output ratio. Live preset switching, a subsequent Master change, sample decoding and context reuse were checked. These are signal measurements, not listening tests. Production full combat and physical listening remain untested.

New files this pass: src/enemies/{droneShape,EnemyMotion}.ts, src/combat/difficulty.ts, src/core/AudioMix.ts, tests/polish.test.ts, public/audio/{laser1.ogg,laser9.ogg,Kenney-License.txt,README.md}. Modified: src/enemies/{Gunner,Archetype,Warden}.ts, src/combat/{Encounter,CombatView}.ts, src/core/AudioManager.ts, src/levels/LevelManager.ts, src/ui/GameMenu.ts, src/main.ts, scripts/campaign-smoke.mjs, README.md and AI_agents_info.md. No dependencies added. TEST_DIFFICULTY selects the browser test campaign difficulty.

Performance: bounded existing enemy/voice counts, cached audio and scratch steering vectors; no new navigation library. Final JS 544.99 kB (142.31 kB gzip); the existing chunk-size advisory remains. FPS targets and long-session stability were not benchmarked. No known failures remain in covered checks; do not interpret this as a guarantee of zero bugs.

1. Start normally; complete move/stop/fire calibration with native capture.
2. Clear each room without test hooks. Check Charger rush/walls, Marksman cover, Drone bursts and Sentinel opening/flank/head mechanics.
3. Try both weapons, held/rapid clicks, empty magazines and switching during reload.
4. Pause/reenter and switch tabs during flying bullets/reload. Retry repeatedly in each room and boss; check no ghost effects or lost unlock.
5. Play each boss phase: read gaps, dodge/cover/jump the laser, hit only the open core, reach the ending and use Credits/Main Menu/Play Again.
6. Listen to pistol/Scattergun/enemy mixes, adjust Master/Effects/Ambience, test mute and overlapping shots. Check LOW/MEDIUM/HIGH on target hardware.

Optional automation: node scripts/campaign-smoke.mjs while dev server runs. TEST_URL can select production preview with ?debug. CHROME_PATH selects a local Chromium executable. Uses local DevTools port 9223 and ignored .test-artifacts/. It reports capture shim and harness coverage explicitly. The older browser-smoke.mjs is the retained Stage 2 scenario and is not the campaign acceptance script.

README and AI_agents_info.md are updated. Model identity: GPT-6 as supplied by the environment; no sub-agents used. Recommended future work is manual balancing, audio listening, beam/readability polish and hardware profiling—not more feature scope. Stage 4 has not begun.


