export class InputManager {
  readonly keys = new Set<string>();
  private presses = new Set<string>();
  dx = 0; dy = 0;
  constructor(private canvas: HTMLCanvasElement, private onLock: (locked: boolean) => void, private onError: (message: string) => void) {
    document.addEventListener('keydown', e => {
      if (!this.locked) return;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.presses.add(e.code);
      this.keys.add(e.code);
    });
    document.addEventListener('keyup', e => this.keys.delete(e.code));
    document.addEventListener('mousedown', e => {
      if (this.locked && e.button === 0 && !this.keys.has('Fire')) {
        this.keys.add('Fire'); this.presses.add('Fire');
      }
    });
    document.addEventListener('mouseup', e => { if (e.button === 0) this.keys.delete('Fire'); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('mousemove', e => { if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; } });
    document.addEventListener('pointerlockchange', () => { this.clear(); this.onLock(this.locked); });
    document.addEventListener('pointerlockerror', () => this.onError('Mouse capture was declined. Click Enter to retry.'));
    window.addEventListener('blur', () => { this.clear(); if (this.locked) document.exitPointerLock(); });
    document.addEventListener('visibilitychange', () => { this.clear(); if (document.hidden && this.locked) document.exitPointerLock(); });
  }
  get locked() { return document.pointerLockElement === this.canvas; }
  async lock() {
    if (!this.canvas.requestPointerLock) { this.onError('This browser does not support pointer lock. Please use a desktop browser.'); return; }
    try { await this.canvas.requestPointerLock(); } catch { this.onError('Mouse capture failed. Click Enter to retry.'); }
  }
  pressed(code: string) { const pressed = this.presses.has(code); this.presses.delete(code); return pressed; }
  clear() { this.keys.clear(); this.presses.clear(); this.dx = this.dy = 0; }
}
