// Ember Archive — sound effects, all synthesized with WebAudio.
// No audio files, no network: every sound is an oscillator blip made in code.

export class SoundManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  // The AudioContext must be created (or resumed) from a user gesture,
  // so we lazily build it on the first sound request.
  ensure() {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.ctx) void this.ctx.suspend();
    if (this.enabled) this.ensure(); // resume the context so the next blip is audible
    return this.enabled;
  }

  // One short tone. freq slides to freqEnd when given.
  tone(freq, dur, type = "sine", gain = 0.08, freqEnd = null, delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  click() {
    this.tone(660, 0.07, "triangle", 0.05);
  }

  pickup() {
    this.tone(523, 0.09, "sine", 0.09);
    this.tone(784, 0.14, "sine", 0.09, null, 0.08);
  }

  spotted() {
    // Rising two-note alarm sting when a guard starts the chase.
    this.tone(220, 0.16, "square", 0.05, 330);
    this.tone(330, 0.2, "square", 0.05, 440, 0.12);
  }

  caught() {
    // Low descending buzz for the lose screen.
    this.tone(180, 0.5, "sawtooth", 0.07, 55);
  }

  win() {
    // Little rising arpeggio for the win screen.
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.18, "sine", 0.09, null, i * 0.11));
  }
}
