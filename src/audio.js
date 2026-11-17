/** Original, asset-free sound design. Audio is created only after a user gesture. */
export class GameAudio {
  constructor() {
    this.context = null;
    this.volume = 0.65;
    this.muted = false;
    this.active = false;
    this.lastPlayed = new Map();
    this.beat = 0;
    this.nextBeat = 0;
    this.droneNodes = [];
  }

  async init() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        const ctx = this.context;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -13;
        this.limiter.knee.value = 18;
        this.limiter.ratio.value = 5;
        this.limiter.attack.value = 0.005;
        this.limiter.release.value = 0.18;
        this.master.connect(this.limiter);
        this.limiter.connect(ctx.destination);
        this.fx = ctx.createGain();
        this.fx.gain.value = 0.7;
        this.fx.connect(this.master);
        this.ambience = ctx.createGain();
        this.ambience.gain.value = this.active ? 0.24 : 0;
        this.ambience.connect(this.master);
        this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < data.length; i++) {
          const white = Math.random() * 2 - 1;
          previous = (previous + white * 0.035) / 1.035;
          data[i] = white * 0.7 + previous * 1.8;
        }
        this.startDrone();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this.nextBeat = this.context.currentTime + 0.08;
      return this.context.state === 'running';
    } catch (error) {
      // A restrictive browser can refuse audio while the game remains playable.
      console.info('Audio unavailable:', error.message);
      return false;
    }
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    this.syncVolume();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.syncVolume();
  }

  syncVolume() {
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.04);
  }

  setActive(active) {
    const changed = this.active !== Boolean(active);
    this.active = Boolean(active);
    if (this.ambience) {
      this.ambience.gain.setTargetAtTime(this.active ? 0.24 : 0, this.context.currentTime, 0.35);
      if (changed && this.active) this.nextBeat = this.context.currentTime + 0.08;
    }
  }

  tone({ frequency = 100, endFrequency = frequency, duration = 0.2, volume = 0.2, type = 'sine', delay = 0, destination = this.fx, cutoff = 0, attack = 0.004 }) {
    const ctx = this.context;
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(10, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(10, endFrequency), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(attack, duration / 3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    let filter;
    if (cutoff) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      filter.Q.value = 0.5;
      oscillator.connect(filter);
      filter.connect(envelope);
    } else oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      filter?.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  noise({ duration = 0.2, volume = 0.2, frequency = 1500, endFrequency = frequency, type = 'lowpass', delay = 0, destination = this.fx }) {
    const ctx = this.context;
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    filter.Q.value = 0.7;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
    source.start(start, Math.random() * 0.6);
    source.stop(start + duration + 0.03);
  }

  startDrone() {
    const ctx = this.context;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 330;
    filter.Q.value = 0.6;
    filter.connect(this.ambience);
    [55, 55.35, 82.4069, 110.15].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = index < 2 ? 'sawtooth' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = index < 2 ? 0.035 : 0.025;
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start();
      this.droneNodes.push(oscillator, gain);
    });
    const drift = ctx.createOscillator();
    const driftDepth = ctx.createGain();
    drift.frequency.value = 0.095;
    driftDepth.gain.value = 115;
    drift.connect(driftDepth);
    driftDepth.connect(filter.frequency);
    drift.start();
    this.droneNodes.push(filter, drift, driftDepth);
  }

  play(name, options = {}) {
    if (!this.context || this.context.state !== 'running' || this.muted) return;
    const now = this.context.currentTime;
    const throttle = { enemy: 0.45, hurt: 0.13, hit: 0.035, pickup: 0.09, empty: 0.2, click: 0.05 }[name] || 0;
    if (now - (this.lastPlayed.get(name) ?? -100) < throttle) return;
    this.lastPlayed.set(name, now);
    const gain = typeof options === 'number' ? options : (options.volume ?? 1);
    const level = Math.max(0, Math.min(1.5, gain));
    const tone = config => this.tone({ ...config, volume: config.volume * level });
    const noise = config => this.noise({ ...config, volume: config.volume * level });

    switch (name) {
      case 'shotgun':
        noise({ duration: 0.25, volume: 0.8, frequency: 6600, endFrequency: 290 });
        tone({ frequency: 160, endFrequency: 42, duration: 0.27, volume: 0.65 });
        tone({ frequency: 90, endFrequency: 31, duration: 0.38, volume: 0.38, type: 'triangle' });
        noise({ duration: 0.06, volume: 0.2, frequency: 1800, type: 'bandpass', delay: 0.24 });
        noise({ duration: 0.045, volume: 0.15, frequency: 3400, type: 'highpass', delay: 0.39 });
        break;
      case 'fireball':
        noise({ duration: 0.36, volume: 0.4, frequency: 2300, endFrequency: 120, type: 'bandpass' });
        tone({ frequency: 430, endFrequency: 65, duration: 0.34, volume: 0.28, type: 'sawtooth', cutoff: 1200 });
        tone({ frequency: 80, endFrequency: 35, duration: 0.26, volume: 0.3 });
        break;
      case 'hit':
        noise({ duration: 0.09, volume: 0.24, frequency: 1700, endFrequency: 180 });
        tone({ frequency: 240, endFrequency: 67, duration: 0.09, volume: 0.18, type: 'triangle' });
        break;
      case 'enemy':
        tone({ frequency: 92 + Math.random() * 22, endFrequency: 52, duration: 0.4, volume: 0.14, type: 'sawtooth', cutoff: 600 });
        noise({ duration: 0.25, volume: 0.08, frequency: 700, type: 'bandpass' });
        break;
      case 'death':
        tone({ frequency: 165, endFrequency: 29, duration: 0.48, volume: 0.24, type: 'sawtooth', cutoff: 900 });
        noise({ duration: 0.28, volume: 0.28, frequency: 900, endFrequency: 110 });
        break;
      case 'hurt':
        tone({ frequency: 112, endFrequency: 54, duration: 0.19, volume: 0.24, type: 'triangle' });
        noise({ duration: 0.13, volume: 0.24, frequency: 620, endFrequency: 120 });
        break;
      case 'pickup':
        tone({ frequency: 523.25, duration: 0.1, volume: 0.16, type: 'triangle' });
        tone({ frequency: 783.99, duration: 0.19, volume: 0.14, type: 'triangle', delay: 0.07 });
        break;
      case 'key':
        [440, 554.37, 659.25, 880].forEach((frequency, i) => tone({ frequency, duration: 0.38, volume: 0.14, type: 'triangle', delay: i * 0.11 }));
        break;
      case 'empty':
        noise({ duration: 0.035, volume: 0.13, frequency: 1900, type: 'bandpass' });
        tone({ frequency: 330, endFrequency: 120, duration: 0.035, volume: 0.06, type: 'square', cutoff: 1400 });
        break;
      case 'win':
        [220, 277.18, 329.63, 440, 554.37, 659.25].forEach((frequency, i) => tone({ frequency, duration: 0.85, volume: 0.14, type: 'triangle', delay: i * 0.14, attack: 0.025 }));
        tone({ frequency: 55, duration: 1.8, volume: 0.3 });
        break;
      case 'click':
        tone({ frequency: 680, endFrequency: 380, duration: 0.04, volume: 0.085, type: 'triangle' });
        break;
    }
  }

  update(dt, state) {
    if (state && typeof state.paused === 'boolean') this.setActive(!state.paused);
    if (!this.context || !this.active || this.muted || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (now < this.nextBeat) return;
    // 108 BPM, industrial half-time pulse. Each event is bounded and self-disposes.
    this.nextBeat = now + 60 / 108 / 2;
    const step = this.beat++ % 16;
    const pattern = [55, 55, 55, 65.406, 55, 55, 82.407, 73.416];
    if (step % 2 === 0 || step === 7 || step === 15) {
      const frequency = pattern[Math.floor(step / 2)];
      this.tone({ frequency, endFrequency: frequency * 0.99, duration: 0.2, volume: 0.17, type: 'sawtooth', cutoff: 350, destination: this.ambience });
    }
    if (step % 4 === 0) {
      this.tone({ frequency: 105, endFrequency: 35, duration: 0.22, volume: 0.38, destination: this.ambience });
    }
    if (step === 4 || step === 12) {
      this.noise({ duration: 0.16, volume: 0.2, frequency: 1750, endFrequency: 500, type: 'bandpass', destination: this.ambience });
    }
    if (step % 2 === 1) {
      this.noise({ duration: 0.045, volume: step === 15 ? 0.08 : 0.035, frequency: 4800, type: 'highpass', destination: this.ambience });
    }
  }

  dispose() {
    this.droneNodes.forEach(node => {
      try { if (node.stop) node.stop(); } catch { /* Already stopped. */ }
      node.disconnect();
    });
    this.droneNodes.length = 0;
    this.context?.close();
    this.context = null;
  }
}

export default GameAudio;
