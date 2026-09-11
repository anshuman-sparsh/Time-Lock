export class Health {
  current: number;
  constructor(readonly maximum: number) { this.current = maximum; }
  get alive() { return this.current > 0; }
  damage(amount: number) {
    if (!this.alive || !Number.isFinite(amount) || amount <= 0) return false;
    this.current = Math.max(0, this.current - amount);
    return true;
  }
  reset() { this.current = this.maximum; }
}
