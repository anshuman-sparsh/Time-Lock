import { rooms } from './rooms';
import { difficulties } from '../combat/difficulty';
import type { DifficultyName } from '../combat/difficulty';

export class LevelManager {
  index = 0;
  private selectedDifficulty:DifficultyName='MEDIUM';
  get difficulty(){return difficulties[this.selectedDifficulty];}
  selectDifficulty(name:DifficultyName){if(this.mode==='MENU'||this.mode==='ENDING')this.selectedDifficulty=name;}
  mode: 'MENU' | 'ROOM' | 'TRANSITION' | 'ENDING' = 'MENU';
  scatterUnlocked = false;
  tutorial: 'MOVE' | 'STOP' | 'FIRE' | 'DONE' = 'MOVE';
  private moved = 0;
  transitionRemaining = 0;
  endingElapsed = 0;
  private pendingIndex = 0;
  constructor(private loadRoom: (index: number) => void) {}
  get room() { return rooms[this.index]; }
  begin() { this.index = 0; this.scatterUnlocked = false; this.mode = 'ROOM'; this.resetTutorial(); this.loadRoom(0); }
  private resetTutorial() { this.tutorial = 'MOVE'; this.moved = 0; }
  retry() { if (this.mode !== 'ROOM') return; this.resetTutorial(); this.loadRoom(this.index); }
  roomCleared() {
    if (this.index === 3) this.scatterUnlocked = true;
    if (this.room.boss && this.mode === 'ROOM') { this.mode = 'ENDING'; this.endingElapsed = 0; }
  }
  next(duration = 0.8) {
    if (this.mode !== 'ROOM' || this.index >= rooms.length - 1) return;
    this.pendingIndex = this.index + 1; this.transitionRemaining = duration; this.mode = 'TRANSITION';
  }
  update(realDelta: number) {
    if (this.mode === 'TRANSITION') {
      this.transitionRemaining = Math.max(0, this.transitionRemaining - realDelta);
      if (this.transitionRemaining === 0) { this.index = this.pendingIndex; this.mode = 'ROOM'; this.resetTutorial(); this.loadRoom(this.index); }
    } else if (this.mode === 'ENDING') this.endingElapsed += realDelta;
  }
  calibrate(realDelta: number, speed: number, timeScale: number) {
    if (!this.room.tutorial || this.mode !== 'ROOM') return;
    if (this.tutorial === 'MOVE') { this.moved += speed * realDelta; if (this.moved > 2) this.tutorial = 'STOP'; }
    else if (this.tutorial === 'STOP' && speed < 0.1 && timeScale < 0.045) this.tutorial = 'FIRE';
  }
  returnToMenu() { this.mode = 'MENU'; this.transitionRemaining = 0; }
}
