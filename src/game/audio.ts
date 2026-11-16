"use client";

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private acousticFilter: BiquadFilterNode | null = null;
  private soundEnabled: boolean = true;
  private volume: number = 0.8;
  private isVacuum: boolean = false;

  private rumbleOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;

  private dopplerOsc: OscillatorNode | null = null;
  private dopplerGain: GainNode | null = null;

  private abyssalDroneOsc: OscillatorNode | null = null;
  private abyssalDroneGain: GainNode | null = null;
  private ventNoiseNode: AudioNode | null = null;
  private ventGain: GainNode | null = null;

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
      this.acousticFilter = this.ctx.createBiquadFilter();
      this.acousticFilter.type = "lowpass";
      this.acousticFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);
      this.masterGain.connect(this.acousticFilter);
      this.acousticFilter.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setAcousticEnvironment(isVacuum: boolean) {
    this.isVacuum = isVacuum;
    const ctx = this.getContext();
    if (this.acousticFilter && ctx) {
      const targetFreq = isVacuum ? 350 : 20000;
      this.acousticFilter.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.15);
    }
  }

  public playQuindarTone(intro: boolean = true) {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(intro ? 2525 : 2475, now);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Audio playback best-effort
    }
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

  /**
   * Continuous Low-Frequency Thruster Rumble
   * Synthesizes deep 42 Hz - 85 Hz rocket roar while W/S thrust keys are held.
   */
  public startThrusterRumble() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;
    if (this.rumbleOsc) return; // already active

    try {
      this.rumbleOsc = ctx.createOscillator();
      this.rumbleGain = ctx.createGain();
      this.rumbleFilter = ctx.createBiquadFilter();

      this.rumbleFilter.type = "lowpass";
      this.rumbleFilter.frequency.setValueAtTime(85, ctx.currentTime);

      this.rumbleOsc.type = "sawtooth";
      this.rumbleOsc.frequency.setValueAtTime(42, ctx.currentTime);

      this.rumbleGain.gain.setValueAtTime(0.01, ctx.currentTime);
      this.rumbleGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.12);

      this.rumbleOsc.connect(this.rumbleFilter);
      this.rumbleFilter.connect(this.rumbleGain);
      this.rumbleGain.connect(dest);

      this.rumbleOsc.start();
    } catch {
      // Audio best-effort
    }
  }

  public stopThrusterRumble() {
    if (!this.rumbleOsc || !this.rumbleGain || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.rumbleGain.gain.setValueAtTime(this.rumbleGain.gain.value, now);
      this.rumbleGain.gain.linearRampToValueAtTime(0.001, now + 0.1);
      const osc = this.rumbleOsc;
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {}
      }, 120);
      this.rumbleOsc = null;
    } catch {
      this.rumbleOsc = null;
    }
  }

  public updateThrusterThrottle(throttle: number) {
    if (!this.rumbleOsc || !this.ctx) return;
    const targetFreq = 38 + Math.min(48, throttle * 42);
    this.rumbleOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
  }

  private plasmaNoiseNode: AudioBufferSourceNode | null = null;
  private plasmaGain: GainNode | null = null;
  private plasmaFilter: BiquadFilterNode | null = null;

  /**
   * Continuous hypersonic atmospheric ionization & thruster wind roar
   */
  public updateHypersonicWind(speedMps: number) {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const normalizedSpeed = Math.max(0, Math.min(1.0, (speedMps - 4.5) / 18.0));

    if (normalizedSpeed > 0.05) {
      if (!this.plasmaGain) {
        try {
          const bufferSize = ctx.sampleRate * 2;
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
          }

          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;
          whiteNoise.loop = true;

          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(600, ctx.currentTime);
          filter.Q.setValueAtTime(1.8, ctx.currentTime);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0, ctx.currentTime);

          whiteNoise.connect(filter);
          filter.connect(gain);
          gain.connect(this.getDest() ?? ctx.destination);

          whiteNoise.start();

          this.plasmaNoiseNode = whiteNoise;
          this.plasmaFilter = filter;
          this.plasmaGain = gain;
        } catch {}
      }

      if (this.plasmaGain && this.plasmaFilter) {
        const targetGain = normalizedSpeed * 0.12 * this.volume;
        const targetFreq = 400 + normalizedSpeed * 1200;
        this.plasmaGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.1);
        this.plasmaFilter.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.1);
      }
    } else if (this.plasmaGain) {
      this.plasmaGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    }
  }

  /**
   * Short High-Frequency Burst for RCS Maneuvering (Q/E/A/D)
   */
  public playRcsBurst() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1100, ctx.currentTime);
      filter.Q.setValueAtTime(2.5, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.075);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start();
    } catch {
      // Audio best-effort
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

  public playTouchdown() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      // Heavy mechanical touchdown thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(110, now);

      osc.type = "sine";
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.35);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // Audio playback best-effort
    }
  }

  public playGearDeploy() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      // Hydraulic whine
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.linearRampToValueAtTime(420, now + 0.22);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // Audio playback best-effort
    }
  }

  public playHullImpact() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.16);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Audio playback best-effort
    }
  }

  public playWarningAlarm() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(660, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // Audio playback best-effort
    }
  }

  public playRadioStatic(durationMs: number = 180) {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;
    try {
      const bufferSize = Math.max(256, Math.floor(ctx.sampleRate * (durationMs / 1000)));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.14;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400, ctx.currentTime);
      filter.Q.setValueAtTime(2.0, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start();
    } catch {
      // Audio playback best effort
    }
  }

  public playMasterCaution() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(587.33, now + 0.12);
      osc.frequency.setValueAtTime(880, now + 0.24);
      osc.frequency.setValueAtTime(587.33, now + 0.36);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch {
      // Audio best-effort
    }
  }

  public playHullStrain(intensity: number = 1.0) {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(120, now);

      osc.type = "triangle";
      osc.frequency.setValueAtTime(68, now);
      osc.frequency.linearRampToValueAtTime(52, now + 0.4);

      const vol = Math.min(0.18, 0.08 * intensity);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.46);
    } catch {
      // Audio best-effort
    }
  }

  public playDockingCrunch() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.28);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.32);
    } catch {
      // Audio best-effort
    }
  }

  public speakRadioComm(text: string, callsign: string = "HOUSTON") {
    if (!this.soundEnabled || this.volume <= 0) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      this.playQuindarTone(true);
      this.playRadioStatic(220);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 0.94;
      utterance.rate = 1.04;
      utterance.volume = Math.min(1.0, this.volume * 1.1);

      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => v.lang.startsWith("en") && !v.name.includes("Google"));
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => {
        this.playRadioStatic(120);
        this.playQuindarTone(false);
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis best-effort
    }
  }

  public speakGPWS(callout: string, isWarning: boolean = false) {
    if (!this.soundEnabled || this.volume <= 0) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      if (isWarning) {
        this.playMasterCaution();
      }

      const utterance = new SpeechSynthesisUtterance(callout);
      utterance.pitch = isWarning ? 1.15 : 0.88;
      utterance.rate = 1.12;
      utterance.volume = Math.min(1.0, this.volume * 1.2);

      const voices = window.speechSynthesis.getVoices();
      const roboticVoice = voices.find((v) => v.lang.startsWith("en"));
      if (roboticVoice) utterance.voice = roboticVoice;

      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis best-effort
    }
  }

  // ==========================================================================
  // GAME 02: PROJECT AEGIS (HYPERVELOCITY DART DEFLECTION SYNTHESIZER)
  // ==========================================================================

  // 1. Hypervelocity Doppler Whine: sweeps 800 Hz to 4200 Hz scaled with closing velocity (up to 6.2 km/s)
  public startDopplerWhine(velocityKms: number = 0.5) {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;
    try {
      if (this.dopplerOsc) {
        this.updateDopplerWhine(velocityKms);
        return;
      }
      const now = ctx.currentTime;
      this.dopplerOsc = ctx.createOscillator();
      this.dopplerGain = ctx.createGain();

      this.dopplerOsc.type = "sine";
      const clampedVel = Math.max(0, Math.min(6.2, velocityKms));
      const targetFreq = 800 + (clampedVel / 6.2) * 3400; // 800 Hz -> 4200 Hz
      this.dopplerOsc.frequency.setValueAtTime(targetFreq, now);

      this.dopplerGain.gain.setValueAtTime(0.001, now);
      this.dopplerGain.gain.linearRampToValueAtTime(0.12 * this.volume, now + 0.2);

      this.dopplerOsc.connect(this.dopplerGain);
      this.dopplerGain.connect(dest);
      this.dopplerOsc.start(now);
    } catch {
      // Audio best-effort
    }
  }

  public updateDopplerWhine(velocityKms: number) {
    if (!this.dopplerOsc || !this.dopplerGain) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const clampedVel = Math.max(0, Math.min(6.2, velocityKms));
      const targetFreq = 800 + (clampedVel / 6.2) * 3400;
      this.dopplerOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);
    } catch {
      // Audio best-effort
    }
  }

  public stopDopplerWhine() {
    if (!this.dopplerOsc || !this.dopplerGain) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      this.dopplerGain.gain.linearRampToValueAtTime(0.001, now + 0.15);
      const osc = this.dopplerOsc;
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {}
      }, 200);
      this.dopplerOsc = null;
      this.dopplerGain = null;
    } catch {
      this.dopplerOsc = null;
      this.dopplerGain = null;
    }
  }

  // 2. Terminal Kinetic Impact Crunch: 40 Hz - 120 Hz explosive burst + white noise telemetry annihilation
  public playKineticImpactCrunch() {
    this.stopDopplerWhine();
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;
    try {
      const now = ctx.currentTime;

      // Low-frequency explosive impact boom (120 Hz down to 40 Hz)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      const subFilter = ctx.createBiquadFilter();

      subOsc.type = "sawtooth";
      subOsc.frequency.setValueAtTime(120, now);
      subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.8);

      subFilter.type = "lowpass";
      subFilter.frequency.setValueAtTime(160, now);
      subFilter.frequency.exponentialRampToValueAtTime(50, now + 0.8);

      subGain.gain.setValueAtTime(0.35 * this.volume, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      subOsc.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(dest);

      subOsc.start(now);
      subOsc.stop(now + 1.25);

      // Probe telemetry annihilation white-noise static burst
      const bufferSize = Math.floor(ctx.sampleRate * 0.45);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(1200, now);
      noiseFilter.Q.setValueAtTime(2.0, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.28 * this.volume, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(dest);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.46);
    } catch {
      // Audio best-effort
    }
  }

  // 3. LICIACube Beacon Telemetry: 1800 Hz periodic data packet transmission of ejecta imagery
  public playLiciacubeBeacon() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.setValueAtTime(1850, now + 0.04);
      osc.frequency.setValueAtTime(1800, now + 0.08);

      gain.gain.setValueAtTime(0.08 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // Audio best-effort
    }
  }

  // GAME 03: PROJECT EUROPA - Subterranean Ocean Procedural Synthesis
  // 1. Underwater Acoustic Resonance: 40 Hz - 60 Hz lowpass ocean drone (130 MPa mass)
  public startAbyssalDrone() {
    if (!this.soundEnabled || this.volume <= 0) return;
    if (this.abyssalDroneOsc) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(48, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(65, now);
      filter.Q.setValueAtTime(3.0, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.25 * this.volume, now + 1.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start(now);
      this.abyssalDroneOsc = osc;
      this.abyssalDroneGain = gain;
    } catch {}
  }

  public stopAbyssalDrone() {
    if (!this.abyssalDroneOsc || !this.abyssalDroneGain) return;
    const ctx = this.getContext();
    if (ctx) {
      const now = ctx.currentTime;
      this.abyssalDroneGain.gain.setValueAtTime(this.abyssalDroneGain.gain.value, now);
      this.abyssalDroneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      setTimeout(() => {
        try {
          this.abyssalDroneOsc?.stop();
          this.abyssalDroneOsc?.disconnect();
        } catch {}
        this.abyssalDroneOsc = null;
        this.abyssalDroneGain = null;
      }, 900);
    } else {
      this.abyssalDroneOsc = null;
      this.abyssalDroneGain = null;
    }
  }

  // 2. Active Sonar Ping: 1200 Hz sinusoidal ping echoing with 1.8s acoustic reverberation tail
  public playActiveSonarPing() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(1180, now + 0.15);

      gain.gain.setValueAtTime(0.3 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 1.85);
    } catch {}
  }

  // 3. Structural Pressure Creak: metallic stress creaks triggered when depth > 5000m
  public playHullPressureCreak() {
    if (!this.soundEnabled || this.volume <= 0) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(115, now);
      osc1.frequency.linearRampToValueAtTime(92, now + 0.7);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(118, now);
      osc2.frequency.linearRampToValueAtTime(89, now + 0.7);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(280, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18 * this.volume, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.9);
      osc2.stop(now + 0.9);
    } catch {}
  }

  // 4. Hydrothermal Vent Boil: Filtered white noise (200 Hz - 800 Hz) bubbling superheated water
  public startHydrothermalBoil() {
    if (!this.soundEnabled || this.volume <= 0) return;
    if (this.ventNoiseNode) return;
    const ctx = this.getContext();
    const dest = this.getDest();
    if (!ctx || !dest) return;

    try {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(450, ctx.currentTime);
      filter.Q.setValueAtTime(1.5, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15 * this.volume, ctx.currentTime + 1.0);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start();
      this.ventNoiseNode = noise;
      this.ventGain = gain;
    } catch {}
  }

  public stopHydrothermalBoil() {
    if (!this.ventNoiseNode || !this.ventGain) return;
    const ctx = this.getContext();
    if (ctx) {
      const now = ctx.currentTime;
      this.ventGain.gain.setValueAtTime(this.ventGain.gain.value, now);
      this.ventGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      setTimeout(() => {
        try {
          (this.ventNoiseNode as AudioBufferSourceNode)?.stop();
          this.ventNoiseNode?.disconnect();
        } catch {}
        this.ventNoiseNode = null;
        this.ventGain = null;
      }, 600);
    } else {
      this.ventNoiseNode = null;
      this.ventGain = null;
    }
  }
}

export const soundManager = new SoundManager();
