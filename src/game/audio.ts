"use client";

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private soundEnabled: boolean = true;
  private volume: number = 0.8; // 0..1

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && !this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.soundEnabled ? this.volume : 0,
        this.ctx.currentTime
      );
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getDest(): AudioNode | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    return this.masterGain ?? ctx.destination;
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    const ctx = this.getContext();
    if (this.masterGain && ctx) {
      this.masterGain.gain.setValueAtTime(enabled ? this.volume : 0, ctx.currentTime);
    }
  }

  public setVolume(volPercent: number) {
    this.volume = Math.max(0, Math.min(100, volPercent)) / 100;
    const ctx = this.getContext();
    if (this.masterGain && ctx && this.soundEnabled) {
      this.masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
    }
  }

  public getVolume(): number {
    return Math.round(this.volume * 100);
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public playFootstep() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(140, ctx.currentTime);

      osc.type = "triangle";
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // Audio playback best-effort
    }
  }

  public playJump() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(dest);

      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {
      // Audio playback best-effort
    }
  }

  public playFlashlight() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(1800, ctx.currentTime);
      osc.frequency.setValueAtTime(900, ctx.currentTime + 0.02);

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(dest);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Audio playback best-effort
    }
  }

  public playPickup() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.5, now + 0.24); // C6

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.39);
    } catch {
      // Audio playback best-effort
    }
  }

  public playEquip() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Audio playback best-effort
    }
  }

  public playAirlockAlarm() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now + i * 0.45);
        osc.frequency.exponentialRampToValueAtTime(440, now + i * 0.45 + 0.35);

        gain.gain.setValueAtTime(0.12, now + i * 0.45);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.45 + 0.38);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(now + i * 0.45);
        osc.stop(now + i * 0.45 + 0.39);
      }
    } catch {
      // Audio playback best-effort
    }
  }

  public playVentingHiss() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const bufferSize = ctx.sampleRate * 1.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1200, ctx.currentTime);
      filter.Q.setValueAtTime(2.0, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start();
    } catch {
      // Audio playback best-effort
    }
  }

  public playThrusterPuff() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const bufferSize = ctx.sampleRate * 0.12;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(450, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start();
    } catch {
      // Audio playback best-effort
    }
  }

  public playRepairClank() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.19);
    } catch {
      // Audio playback best-effort
    }
  }

  public playBeaconChime() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const freqs = [587.33, 880, 1174.66];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.08, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.41);
      });
    } catch {
      // Audio playback best-effort
    }
  }

  public playSuccessFanfare() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const chords = [
        [523.25, 659.25, 783.99],
        [587.33, 739.99, 880.0],
        [659.25, 830.61, 987.77],
        [783.99, 987.77, 1174.66, 1567.98],
      ];

      chords.forEach((chord, i) => {
        const t = now + i * 0.22;
        chord.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.08, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

          osc.connect(gain);
          gain.connect(dest);

          osc.start(t);
          osc.stop(t + 0.46);
        });
      });
    } catch {
      // Audio playback best-effort
    }
  }

  public playWarningBeep() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.17);
    } catch {
      // Audio playback best-effort
    }
  }

  public playEngineRoar() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const bufferSize = ctx.sampleRate * 0.25;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(260, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start();
    } catch {
      // Audio playback best-effort
    }
  }

  public playDockingLatch() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "triangle";

      osc1.frequency.setValueAtTime(120, now);
      osc1.frequency.exponentialRampToValueAtTime(45, now + 0.18);

      osc2.frequency.setValueAtTime(240, now);
      osc2.frequency.exponentialRampToValueAtTime(80, now + 0.18);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(dest);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.26);
      osc2.stop(now + 0.26);
    } catch {
      // Audio playback best-effort
    }
  }

  public playRefillChime() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const freqs = [440, 554.37, 659.25, 880];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now + idx * 0.07);

        gain.gain.setValueAtTime(0.08, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.2);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.21);
      });
    } catch {
      // Audio playback best-effort
    }
  }

  public playRadarBeep() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1174.66, now); // D6
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Audio playback best-effort
    }
  }
}

export const soundManager = new SoundManager();
