/**
 * Web Audio API procedural sound engine for Optimum Hill Climb Racing.
 */
class HillClimbSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private engineOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private isRunning: boolean = false;

  private init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.engineGain) {
      this.engineGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public startEngine() {
    if (this.isRunning) return;
    this.init();
    if (!this.ctx) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.07, this.ctx.currentTime);

      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.isRunning = true;
    } catch {
      // Audio autoplay policy
    }
  }

  public updateEngine(rpmRatio: number, isGas: boolean) {
    if (!this.ctx || !this.isRunning || this.isMuted) return;
    const t = this.ctx.currentTime;
    const clampedRatio = Math.max(0, Math.min(1.5, rpmRatio));
    const targetFreq = 45 + clampedRatio * 110 + (isGas ? 25 : 0);

    if (this.engineOsc) {
      this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.05);
    }
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(280 + clampedRatio * 700, t, 0.05);
    }
    if (this.engineGain) {
      const vol = this.isMuted ? 0 : 0.05 + (isGas ? 0.04 : 0.01) + clampedRatio * 0.03;
      this.engineGain.gain.setTargetAtTime(vol, t, 0.06);
    }
  }

  public playCoinChime(combo = 1) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const semitone = Math.min(12, combo - 1);
    const pitch = Math.pow(2, semitone / 12);

    const f1 = 1320 * pitch;
    const f2 = 2640 * pitch;

    [f1, f2].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.1);

      gain.gain.setValueAtTime(0.12 / (idx + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  public playFuelRefill() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.2);

    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playLandingThud(intensity: number) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);

    const vol = Math.min(0.2, 0.05 + intensity * 0.12);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playCrash() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.45);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.55);
  }

  public playGapFall() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(85, t + 0.55);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.6);
  }

  /**
   * Plays ONLY when a level is successfully completed!
   * Synthesizes a joyful victory fanfare + realistic multi-hand crowd applause.
   */
  public playLevelCompleteApplause() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. Victory Fanfare Arpeggio (C5 - E5 - G5 - C6)
    const fanfareNotes = [
      { freq: 523.25, delay: 0.0, dur: 0.18 },
      { freq: 659.25, delay: 0.12, dur: 0.18 },
      { freq: 783.99, delay: 0.24, dur: 0.22 },
      { freq: 1046.5, delay: 0.38, dur: 0.65 },
    ];

    fanfareNotes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);
      gain.gain.setValueAtTime(0.001, now + n.delay);
      gain.gain.linearRampToValueAtTime(0.16, now + n.delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.dur + 0.05);
    });

    // 2. Crowd Applause & Clapping (dense randomized band-passed noise claps)
    const clapBufferLen = Math.floor(ctx.sampleRate * 0.06);
    const noiseBuffer = ctx.createBuffer(1, clapBufferLen, ctx.sampleRate);
    const ch = noiseBuffer.getChannelData(0);
    for (let i = 0; i < clapBufferLen; i++) {
      // Sharp attack, quick exponential decay per hand clap
      const env = Math.exp(-i / (ctx.sampleRate * 0.012));
      ch[i] = (Math.random() * 2 - 1) * env;
    }

    const totalDuration = 2.6;
    const clapCount = 48;
    for (let c = 0; c < clapCount; c++) {
      const offset = 0.15 + Math.random() * totalDuration;
      // Swell in middle, fade out at end
      const swell = Math.sin((offset / (totalDuration + 0.2)) * Math.PI);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900 + Math.random() * 1400, now + offset);
      filter.Q.setValueAtTime(1.2 + Math.random() * 1.4, now + offset);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06 + swell * 0.1, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.055);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      src.start(now + offset);
      src.stop(now + offset + 0.06);
    }
  }

  public playClick() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(350, t + 0.04);
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }
}

export const sound = new HillClimbSoundEngine();
