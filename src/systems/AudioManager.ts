import Phaser from 'phaser';

export class AudioManager {
  private static context: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static musicGain: GainNode | null = null;
  private static sfxGain: GainNode | null = null;

  // Settings
  static masterVol = 0.8;
  static musicVol = 0.5;
  static sfxVol = 0.8;
  static isMuted = false;
  static closedCaptions = false;
  static audioCuesOnly = false; // visual subtitles and flashes

  // Music scheduler state
  private static musicIntervalId: any = null;
  private static musicStep = 0;
  static currentTrack: 'menu' | 'town' | 'floor' | 'boss' | null = null;
  private static activeMusicOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];

  // Heartbeat loop state
  private static heartbeatIntervalId: any = null;
  private static isHeartbeatActive = false;
  private static heartbeatRateMs = 1000;

  // Active constant drone nodes (Rift & Blood Moon)
  private static activeDrones: Map<string, { osc: OscillatorNode; gain: GainNode }> = new Map();

  // Cached white noise buffer for SFX drum beats
  private static noiseBuffer: AudioBuffer | null = null;

  // Phaser game instance reference to emit events for closed captions
  private static gameInstance: Phaser.Game | null = null;

  static init(game?: Phaser.Game): void {
    if (game) this.gameInstance = game;
    if (this.context) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.context = new AudioCtx();

      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);

      this.musicGain = this.context.createGain();
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.context.createGain();
      this.sfxGain.connect(this.masterGain);

      // Cache white noise buffer
      this.noiseBuffer = this.makeNoiseBuffer();

      this.loadSettings();
    } catch (e) {
      console.warn('Web Audio API initialization failed', e);
    }
  }

  static setGame(game: Phaser.Game): void {
    this.gameInstance = game;
  }

  private static makeNoiseBuffer(): AudioBuffer | null {
    if (!this.context) return null;
    const bufferSize = this.context.sampleRate * 0.5; // 500ms buffer
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private static loadSettings(): void {
    try {
      const raw = localStorage.getItem('nd_audio_settings');
      if (raw) {
        const settings = JSON.parse(raw);
        this.masterVol = settings.masterVol ?? 0.8;
        this.musicVol = settings.musicVol ?? 0.5;
        this.sfxVol = settings.sfxVol ?? 0.8;
        this.isMuted = settings.isMuted ?? false;
        this.closedCaptions = settings.closedCaptions ?? false;
        this.audioCuesOnly = settings.audioCuesOnly ?? false;
      }
      this.applyVolumes();
    } catch {
      // Ignore
    }
  }

  static saveSettings(): void {
    try {
      const settings = {
        masterVol: this.masterVol,
        musicVol: this.musicVol,
        sfxVol: this.sfxVol,
        isMuted: this.isMuted,
        closedCaptions: this.closedCaptions,
        audioCuesOnly: this.audioCuesOnly
      };
      localStorage.setItem('nd_audio_settings', JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }

  static applyVolumes(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (this.masterGain) this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVol, now);
    if (this.musicGain) this.musicGain.gain.setValueAtTime(this.musicVol, now);
    if (this.sfxGain) this.sfxGain.gain.setValueAtTime(this.sfxVol, now);
  }

  // ── Music Synthesis Loops ───────────────────────────────────────────────────
  static playMusic(type: 'menu' | 'town' | 'floor' | 'boss'): void {
    this.stopMusic();
    if (!this.context) this.init();
    if (!this.context) return;

    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    this.currentTrack = type;
    this.musicStep = 0;

    let tickRateMs = 250; // default tempo (120bpm 16th notes)
    if (type === 'town') tickRateMs = 350;
    if (type === 'floor') tickRateMs = 1000;
    if (type === 'boss') tickRateMs = 180;

    this.musicIntervalId = setInterval(() => {
      this.tickMusic(type);
    }, tickRateMs);
  }

  static stopMusic(): void {
    if (this.musicIntervalId) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
    // Stop any active oscillators
    this.activeMusicOscillators.forEach(item => {
      try {
        item.osc.stop();
      } catch {
        // ignore
      }
    });
    this.activeMusicOscillators = [];
    this.currentTrack = null;
  }

  private static tickMusic(type: 'menu' | 'town' | 'floor' | 'boss'): void {
    if (!this.context || this.isMuted) return;

    const step = this.musicStep;
    this.musicStep++;

    const now = this.context.currentTime;

    if (type === 'menu') {
      const chords = [
        [220.00, 261.63, 329.63, 440.00], // Am
        [174.61, 220.00, 261.63, 349.23], // F
        [146.83, 174.61, 220.00, 293.66], // Dm
        [164.81, 207.65, 246.94, 329.63]  // E7
      ];
      const chordIdx = Math.floor(step / 4) % 4;
      const noteIdx = step % 4;
      const freq = chords[chordIdx][noteIdx];
      this.playSynthNote(freq, 0.22, 'triangle', 0.1);
    } 
    else if (type === 'town') {
      const chords = [
        [130.81, 164.81, 196.00, 246.94], // Cmaj7
        [174.61, 220.00, 261.63, 329.63], // Fmaj7
        [196.00, 246.94, 293.66, 329.63]  // G6
      ];
      const chordIdx = Math.floor(step / 4) % 3;
      const noteIdx = step % 4;
      const freq = chords[chordIdx][noteIdx];
      this.playSynthNote(freq, 0.3, 'sine', 0.08);
    } 
    else if (type === 'floor') {
      // Dark Ambient Drone: Play a continuous low tone E2 (82.41Hz)
      if (step % 8 === 0) {
        this.playSynthNote(82.41, 7.5, 'sine', 0.12);
      }
      // Occasional random high chime note
      if (step % 4 === 2 && Math.random() < 0.4) {
        const notes = [659.25, 698.46, 783.99, 932.33]; // E5, F5, G5, Bb5 (tension scale)
        const freq = notes[Math.floor(Math.random() * notes.length)];
        this.playSynthNote(freq, 1.8, 'sine', 0.04);
      }
    } 
    else if (type === 'boss') {
      // Alternating bassline
      const bassline = [110.00, 220.00, 110.00, 130.81, 110.00, 220.00, 110.00, 146.83]; // Am-C-D
      const freq = bassline[step % 8];
      this.playSynthNote(freq, 0.15, 'sawtooth', 0.08);

      // Play drum noise beats every 4th step
      if (step % 4 === 3) {
        this.playNoiseSFX(0.12, 0.4, 200); // Kick drum thud
      } else if (step % 8 === 7) {
        this.playNoiseSFX(0.15, 0.3, 1500); // Snare snap
      }
    }
  }

  private static playSynthNote(freq: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.context || !this.musicGain) return;
    try {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.context.currentTime);

      gain.gain.setValueAtTime(volume, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start();
      osc.stop(this.context.currentTime + duration);

      const item = { osc, gain };
      this.activeMusicOscillators.push(item);
      setTimeout(() => {
        const idx = this.activeMusicOscillators.indexOf(item);
        if (idx !== -1) this.activeMusicOscillators.splice(idx, 1);
      }, duration * 1000 + 100);
    } catch {
      // ignore
    }
  }

  // ── SFX Synthesis ───────────────────────────────────────────────────────────
  static playSFX(type: 'swing' | 'hit' | 'crit' | 'bounce' | 'parry' | 'perfect_dodge' | 'potion_glug' | 'footstep' | 'hunter_footstep' | 'anomaly_sting' | 'victory' | 'death' | 'telegraph', pitchScale = 1.0): void {
    if (!this.context || this.isMuted) return;

    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    const ccText = this.getClosedCaptionText(type);
    if (this.closedCaptions || this.audioCuesOnly) {
      this.emitCaptionEvent(ccText);
    }

    const now = this.context.currentTime;

    switch (type) {
      case 'swing':
        this.sweepPitch(800, 180, 0.12, 'sine', 0.08, pitchScale);
        break;
      case 'hit':
        this.sweepPitch(400, 80, 0.1, 'triangle', 0.15, pitchScale);
        this.playNoiseSFX(0.08, 0.6, 600); // crunch noise
        break;
      case 'crit':
        // Double hit pitch sweep
        this.sweepPitch(600, 120, 0.08, 'triangle', 0.22, pitchScale);
        this.playNoiseSFX(0.06, 0.8, 1200);
        setTimeout(() => {
          this.sweepPitch(700, 150, 0.08, 'triangle', 0.22, pitchScale);
          this.playNoiseSFX(0.06, 0.8, 1200);
        }, 60);
        break;
      case 'bounce':
        // High pitch ping clink
        this.sweepPitch(2500, 1500, 0.05, 'square', 0.06, pitchScale);
        break;
      case 'parry':
        // Multi-frequency metal clash
        this.sweepPitch(1000, 500, 0.08, 'sine', 0.1, pitchScale);
        this.sweepPitch(1600, 800, 0.08, 'sine', 0.1, pitchScale);
        this.sweepPitch(2200, 1100, 0.08, 'sine', 0.08, pitchScale);
        break;
      case 'perfect_dodge':
        // Shimmering sweep up
        this.sweepPitch(800, 2200, 0.18, 'sine', 0.14, pitchScale);
        break;
      case 'potion_glug':
        // Bubbly rising thud
        this.sweepPitch(180, 320, 0.18, 'sine', 0.15, pitchScale);
        break;
      case 'footstep':
        this.sweepPitch(80, 30, 0.05, 'sine', 0.03, pitchScale);
        break;
      case 'hunter_footstep':
        this.sweepPitch(60, 20, 0.08, 'sine', 0.08, pitchScale);
        break;
      case 'anomaly_sting':
        // Shimmer arpeggio
        this.playArpeggioSFX([523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98], 60, 'sine', 0.12);
        break;
      case 'victory':
        // Fanfare major sweep
        this.playArpeggioSFX([261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50], 90, 'triangle', 0.15);
        break;
      case 'death':
        // Sad arpeggio sweep down
        this.playArpeggioSFX([440.00, 349.23, 293.66, 246.94, 207.65, 110.00], 120, 'sine', 0.2);
        break;
      case 'telegraph':
        // Short rising warning alert
        this.sweepPitch(400, 900, 0.15, 'sawtooth', 0.05, pitchScale);
        break;
    }
  }

  // Synthesize a pitch sweep envelope
  private static sweepPitch(startFreq: number, endFreq: number, duration: number, type: OscillatorType, volume: number, pitchScale = 1.0): void {
    if (!this.context || !this.sfxGain) return;
    try {
      const osc = this.context.createOscillator();
      const gainNode = this.context.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(startFreq * pitchScale, this.context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq * pitchScale, this.context.currentTime + duration);

      gainNode.gain.setValueAtTime(volume, this.context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.sfxGain);

      osc.start();
      osc.stop(this.context.currentTime + duration);
    } catch {
      // ignore
    }
  }

  // Synthesize white noise SFX with filter envelope
  private static playNoiseSFX(duration: number, volume: number, bandpassFreq = 1000): void {
    if (!this.context || !this.sfxGain || !this.noiseBuffer) return;
    try {
      const source = this.context.createBufferSource();
      source.buffer = this.noiseBuffer;

      const filter = this.context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(bandpassFreq, this.context.currentTime);

      const gainNode = this.context.createGain();
      gainNode.gain.setValueAtTime(volume * 0.1, this.context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.sfxGain);

      source.start();
      source.stop(this.context.currentTime + duration);
    } catch {
      // ignore
    }
  }

  // Play a sequence of notes rapidly
  private static playArpeggioSFX(freqs: number[], delayMs: number, type: OscillatorType, volume: number): void {
    freqs.forEach((freq, idx) => {
      setTimeout(() => {
        this.playSynthNote(freq, 0.4, type, volume);
      }, idx * delayMs);
    });
  }

  // ── Ailment/Warnings Ambient Loops ──────────────────────────────────────────
  static startHeartbeat(rateMs = 1000): void {
    this.heartbeatRateMs = rateMs;
    if (this.isHeartbeatActive) return;

    this.isHeartbeatActive = true;
    this.tickHeartbeat();
  }

  static updateHeartbeatRate(rateMs: number): void {
    this.heartbeatRateMs = rateMs;
  }

  static stopHeartbeat(): void {
    this.isHeartbeatActive = false;
    if (this.heartbeatIntervalId) {
      clearTimeout(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  private static tickHeartbeat(): void {
    if (!this.isHeartbeatActive) return;

    // Double thump heartbeat
    this.playHeartbeatThump();
    setTimeout(() => {
      if (this.isHeartbeatActive) this.playHeartbeatThump();
    }, 150);

    if (this.closedCaptions || this.audioCuesOnly) {
      this.emitCaptionEvent(this.heartbeatRateMs < 600 ? '❤ *HEARTBEAT FAST*' : '❤ *heartbeat*');
    }

    this.heartbeatIntervalId = setTimeout(() => {
      this.tickHeartbeat();
    }, this.heartbeatRateMs);
  }

  private static playHeartbeatThump(): void {
    this.sweepPitch(70, 30, 0.08, 'sine', 0.18);
  }

  static startDrone(name: string, freq = 60): void {
    if (this.activeDrones.has(name)) return;
    if (!this.context || !this.sfxGain) return;

    try {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.context.currentTime);

      gain.gain.setValueAtTime(0, this.context.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, this.context.currentTime + 1.0); // fade in over 1s

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start();
      this.activeDrones.set(name, { osc, gain });

      if (this.closedCaptions || this.audioCuesOnly) {
        this.emitCaptionEvent(`🌀 *ambient drone: ${name}*`);
      }
    } catch {
      // ignore
    }
  }

  static stopDrone(name: string): void {
    const drone = this.activeDrones.get(name);
    if (!drone) return;

    try {
      const now = this.context?.currentTime ?? 0;
      drone.gain.gain.setValueAtTime(drone.gain.gain.value, now);
      drone.gain.gain.linearRampToValueAtTime(0, now + 0.5); // fade out
      setTimeout(() => {
        try {
          drone.osc.stop();
        } catch {
          // ignore
        }
      }, 600);
    } catch {
      // ignore
    }

    this.activeDrones.delete(name);
  }

  // ── Closed Captions Accessibility ───────────────────────────────────────────
  private static getClosedCaptionText(type: string): string {
    switch (type) {
      case 'swing': return '⚔ *sword swing*';
      case 'hit': return '💥 *hit*';
      case 'crit': return '⚡ *CRITICAL HIT*';
      case 'bounce': return '🛡 *weapon clink*';
      case 'parry': return '🛡 *PARRY SUCCESS*';
      case 'perfect_dodge': return '✨ *perfect dodge*';
      case 'potion_glug': return '🧪 *potion glug*';
      case 'footstep': return '👣 *footsteps*';
      case 'hunter_footstep': return '👣 *HUNTER FOOTSTEPS CLOSE*';
      case 'anomaly_sting': return '🌀 *anomaly spawn chime*';
      case 'victory': return '🎉 *triumphant victory arpeggio*';
      case 'death': return '💀 *mournful death chime*';
      case 'telegraph': return '🚨 *enemy telegraph tell*';
      default: return `🎵 *SFX: ${type}*`;
    }
  }

  private static emitCaptionEvent(text: string): void {
    if (this.gameInstance) {
      this.gameInstance.events.emit('audio-caption', text);
    }
  }
}
