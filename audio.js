/**
 * audio.js — Trình quản lý âm thanh game
 * Hỗ trợ: 3 file nhạc MP3 thật + synth SFX + mobile autoplay unlock
 */

const TRACKS = [
  { title: "Track 1", src: "track1.mp3" },
  { title: "Track 2", src: "track2.mp3" },
  { title: "Track 3", src: "track3.mp3" },
];

class AudioManager {
  constructor() {
    this.context   = null;
    this.bgGain    = null;
    this.sfxGain   = null;
    this.bgAudio   = null;   // HTMLAudioElement cho nhạc nền
    this.unlocked  = false;
    this.muted     = false;
    this.volume    = 0.70;
    this.currentTrackIdx = 0;
    this._synthBgTimer = null;
    this._bgPending = false;
  }

  /* ─── Unlock ─── */
  async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === "suspended") await this.context.resume();
      this.bgGain  = this.context.createGain();
      this.sfxGain = this.context.createGain();
      // bgGain is used for synth fallback background
      this.bgGain.gain.value  = this.muted ? 0 : this.volume * 0.35;
      this.sfxGain.gain.value = this.muted ? 0 : this.volume * 0.9;
      this.bgGain.connect(this.context.destination);
      this.sfxGain.connect(this.context.destination);

      if (this._bgPending) {
        this._bgPending = false;
        this.startBg();
      }
    } catch {}
  }

  /* ─── Nhạc nền MP3 ─── */
  playBg(idx = this.currentTrackIdx) {
    this.currentTrackIdx = idx;
    this._stopSynthBg();
    if (this.bgAudio) {
      this.bgAudio.pause();
      this.bgAudio.currentTime = 0;
      this.bgAudio.onended = null;
    }
    if (this.muted) return;

    const track = TRACKS[idx % TRACKS.length];
    const resolvedSrc = (typeof import.meta !== "undefined" && import.meta.url)
      ? new URL(track.src, import.meta.url).toString()
      : `./${track.src}`;
    const audio  = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audio.src = resolvedSrc;
    audio.volume = this.volume * 0.7;
    // Một bài lặp ổn định — tránh nhảy track giữa chừng do onended / reload tab.
    audio.loop = true;
    audio.onended = null;
    let errTries = 0;
    audio.onerror = () => {
      errTries++;
      console.warn("[Audio] MP3 load failed", track.src);
      if (errTries > 2) return;
      const next = (this.currentTrackIdx + 1) % TRACKS.length;
      if (next !== this.currentTrackIdx) {
        setTimeout(() => this.playBg(next), 600);
      }
    };
    this.bgAudio = audio;
    
    const p = audio.play();
    if (p !== undefined) {
      p.catch(() => {
        console.warn("Bg play blocked, will retry on next user gesture");
        this._bgPending = true;
      });
    }
  }

  startBg() {
    if (!this.unlocked) return;
    const a = this.bgAudio;
    if (a && a.src) {
      a.volume = this.muted ? 0 : this.volume * 0.7;
      if (this.muted) return;
      if (!a.paused && !a.ended) return;
      const p = a.play();
      if (p !== undefined) p.catch(() => { this._bgPending = true; });
      return;
    }
    this.playBg(this.currentTrackIdx);
  }

  stopBg() {
    if (this.bgAudio) { this.bgAudio.pause(); this.bgAudio.currentTime = 0; }
    this._stopSynthBg();
  }

  /* ─── Fallback synth background ─── */
  _startSynthBg() {
    if (!this.context || this._synthBgTimer || this.muted) return;
    this._playOneSynthNote();
  }
  _stopSynthBg() {
    if (this._synthBgTimer) { clearTimeout(this._synthBgTimer); this._synthBgTimer = null; }
  }
  _playOneSynthNote() {
    if (!this.context || this.muted) return;
    const ctx  = this.context;
    const now  = ctx.currentTime;
    const scale = [220, 247, 277, 330, 370, 440, 494, 554, 659, 740];
    const freq  = scale[Math.floor(Math.random() * scale.length)];
    const dur   = 0.8 + Math.random() * 0.8;
    const osc   = ctx.createOscillator();
    const g     = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.07 * this.volume, now + 0.05);
    g.gain.linearRampToValueAtTime(0, now + dur);
    osc.connect(g); g.connect(this.bgGain || ctx.destination);
    osc.start(now); osc.stop(now + dur + 0.1);
    this._synthBgTimer = setTimeout(() => {
      this._synthBgTimer = null;
      this._playOneSynthNote();
    }, (dur * 500 + Math.random() * 500));
  }

  /* ─── SFX (Web Audio API synth) ─── */
  playSynth(type) {
    if (!this.unlocked || this.muted || !this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const mg  = ctx.createGain();
    mg.gain.setValueAtTime(0.3 * this.volume, now);
    mg.connect(this.sfxGain || ctx.destination);

    switch (type) {
      case "coin": {
        [0, 0.05, 0.10].forEach((off, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = "sine"; o.frequency.setValueAtTime(880 + i * 220, now + off);
          g.gain.setValueAtTime(0.25, now + off);
          g.gain.exponentialRampToValueAtTime(0.001, now + off + 0.3);
          o.connect(g); g.connect(mg); o.start(now + off); o.stop(now + off + 0.3);
        }); break;
      }
      case "battle": {
        const bufLen = Math.floor(ctx.sampleRate * 0.4);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
        const ns = ctx.createBufferSource(); ns.buffer = buf;
        const bpf = ctx.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 120;
        ns.connect(bpf); bpf.connect(mg);
        const o = ctx.createOscillator(), eg = ctx.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(80, now); o.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        eg.gain.setValueAtTime(1, now); eg.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        o.connect(eg); eg.connect(mg);
        ns.start(now); o.start(now); o.stop(now + 0.4); ns.stop(now + 0.4); break;
      }
      case "cay": {
        [0, 0.15].forEach(off => {
          const blen = Math.floor(ctx.sampleRate * 0.12);
          const b = ctx.createBuffer(1, blen, ctx.sampleRate);
          const d = b.getChannelData(0);
          for (let i = 0; i < blen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (blen * 0.15));
          const s = ctx.createBufferSource(); s.buffer = b;
          const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 400;
          s.connect(lpf); lpf.connect(mg); s.start(now + off);
        }); break;
      }
      case "murmur": {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(440, now); o.frequency.linearRampToValueAtTime(380, now + 0.2);
        g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        o.connect(g); g.connect(mg); o.start(now); o.stop(now + 0.3); break;
      }
      case "caiVa": {
        const blen = Math.floor(ctx.sampleRate * 0.2);
        const b = ctx.createBuffer(1, blen, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < blen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (blen * 0.07));
        const s = ctx.createBufferSource(); s.buffer = b; s.connect(mg); s.start(now); break;
      }
    }
  }

  /* ─── Volume / Mute ─── */
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.bgAudio)   this.bgAudio.volume = this.volume * 0.7;
    if (this.sfxGain)   this.sfxGain.gain.value = this.muted ? 0 : this.volume * 0.9;
    if (this.bgGain)    this.bgGain.gain.value = this.muted ? 0 : this.volume * 0.35;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.bgAudio)   this.bgAudio.volume = this.muted ? 0 : this.volume * 0.7;
    if (this.sfxGain)   this.sfxGain.gain.value = this.muted ? 0 : this.volume * 0.9;
    if (this.bgGain)    this.bgGain.gain.value = this.muted ? 0 : this.volume * 0.35;
    if (this.muted) this._stopSynthBg();
    return this.muted;
  }

  get tracks() { return TRACKS; }
  get currentTrack() { return TRACKS[this.currentTrackIdx]; }
}

export const audioManager = new AudioManager();

export function playSfxKey(key) {
  audioManager.playSynth(key || "murmur");
}
