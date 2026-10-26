// World time of day. `night` is what the child chose; `amount` (0 = day, 1 = night)
// eases towards it so skies, light and colours fade instead of jumping.

const FADE_SECONDS = 1.5;

export class DayNight {
  constructor(night = false) {
    this.night = night;
    this.amount = night ? 1 : 0;
    this.listeners = new Set();
  }

  toggle() {
    this.set(!this.night);
  }

  set(night) {
    if (night === this.night) return;
    this.night = night;
    for (const fn of this.listeners) fn(night);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  update(dt) {
    const target = this.night ? 1 : 0;
    const step = dt / FADE_SECONDS;
    this.amount = target > this.amount ? Math.min(target, this.amount + step) : Math.max(target, this.amount - step);
  }
}
