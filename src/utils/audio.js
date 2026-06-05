// Native browser synth audio effects to recreate Kahoot atmosphere without loading heavy audio assets.
class SoundManager {
  constructor() {
    this.ctx = null;
    this.lobbyInterval = null;
    this.lobbyTempo = 110;
  }

  // Audio Context must be initialized on first user gesture
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Synth helper for simple notes
  playTone(freq, type, duration, startTime = 0, gainValue = 0.1, decay = true) {
    this.init();
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

    gainNode.gain.setValueAtTime(gainValue, this.ctx.currentTime + startTime);
    if (decay) {
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + startTime + duration);
    } else {
      gainNode.gain.setValueAtTime(gainValue, this.ctx.currentTime + startTime + duration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + startTime + duration);
    }

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(this.ctx.currentTime + startTime);
    osc.stop(this.ctx.currentTime + startTime + duration);
  }

  // Short click/timer tick percussion
  playTick() {
    try {
      this.init();
      // High-pitched woodblock or hat sound
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
      gainNode.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // Sweeping pad to start question
  playQuestionStart() {
    try {
      this.init();
      const now = this.ctx.currentTime;
      // Synthesize two oscillator chords
      this.playTone(329.63, 'sine', 0.8, 0, 0.07); // E4
      this.playTone(392.00, 'sine', 0.8, 0.1, 0.07); // G4
      this.playTone(523.25, 'triangle', 1.0, 0.2, 0.05); // C5
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // Answer submitted sound
  playAnswerSubmitted() {
    try {
      this.init();
      this.playTone(880, 'sine', 0.15, 0, 0.05); // A5
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // Correct answer sound
  playCorrect() {
    try {
      this.init();
      const now = this.ctx.currentTime;
      // Arpeggio
      this.playTone(523.25, 'triangle', 0.15, 0, 0.07); // C5
      this.playTone(659.25, 'triangle', 0.15, 0.1, 0.07); // E5
      this.playTone(783.99, 'triangle', 0.15, 0.2, 0.07); // G5
      this.playTone(1046.50, 'sine', 0.4, 0.3, 0.07); // C6
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // Incorrect answer sound
  playIncorrect() {
    try {
      this.init();
      // Low retro downer
      this.playTone(220, 'sawtooth', 0.25, 0, 0.08); // A3
      this.playTone(196, 'sawtooth', 0.5, 0.2, 0.08); // G3
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // Game lobby looping synth tracker (generates a cute catchy tune)
  startLobbyMusic() {
    try {
      this.init();
      if (this.lobbyInterval) return;

      const melody = [
        392.00, 440.00, 523.25, 587.33, 659.25, 0, 659.25, 587.33,
        523.25, 0, 440.00, 392.00, 440.00, 523.25, 0, 523.25
      ];
      const bass = [
        130.81, 130.81, 146.83, 146.83, 164.81, 164.81, 196.00, 196.00,
        130.81, 130.81, 146.83, 146.83, 164.81, 164.81, 130.81, 130.81
      ];

      let beat = 0;
      const beatDuration = 60 / this.lobbyTempo; // ~0.54s per beat

      this.lobbyInterval = setInterval(() => {
        const freq = melody[beat % melody.length];
        const bassFreq = bass[beat % bass.length];

        if (freq > 0) {
          // Play melody note
          this.playTone(freq, 'sine', beatDuration * 0.8, 0, 0.04);
        }
        
        // Play bass note on beats
        if (beat % 2 === 0) {
          this.playTone(bassFreq, 'triangle', beatDuration * 1.5, 0, 0.06);
        }

        beat++;
      }, beatDuration * 1000);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  stopLobbyMusic() {
    if (this.lobbyInterval) {
      clearInterval(this.lobbyInterval);
      this.lobbyInterval = null;
    }
  }

  // Winning podium fanfare
  playVictory() {
    try {
      this.init();
      const tempo = 120;
      const beat = 60 / tempo;
      // Play upbeat victory fanfare chord notes sequentially
      const notes = [
        { f: 261.63, d: 0.2, t: 0 },       // C4
        { f: 329.63, d: 0.2, t: 0.2 },     // E4
        { f: 392.00, d: 0.2, t: 0.4 },     // G4
        { f: 523.25, d: 0.6, t: 0.6 },     // C5
        
        { f: 349.23, d: 0.2, t: 1.2 },     // F4
        { f: 440.00, d: 0.2, t: 1.4 },     // A4
        { f: 523.25, d: 0.2, t: 1.6 },     // C5
        { f: 587.33, d: 0.6, t: 1.8 },     // D5

        { f: 392.00, d: 0.2, t: 2.4 },     // G4
        { f: 493.88, d: 0.2, t: 2.6 },     // B4
        { f: 587.33, d: 0.2, t: 2.8 },     // D5
        { f: 783.99, d: 1.0, t: 3.0 }      // G5
      ];

      notes.forEach(note => {
        this.playTone(note.f, 'sawtooth', note.d, note.t, 0.06, false);
        this.playTone(note.f * 1.5, 'sine', note.d, note.t, 0.04, false); // harmonizer
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }
}

export const audio = new SoundManager();
