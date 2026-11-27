export type PokemonSound = "correct" | "incorrect" | "unlock" | "complete";

type Tone = { frequency: number; offset: number; duration: number; type?: OscillatorType };

const patterns: Record<PokemonSound, Tone[]> = {
  correct: [
    { frequency: 659.25, offset: 0, duration: 0.12, type: "triangle" },
    { frequency: 880, offset: 0.105, duration: 0.18, type: "triangle" },
  ],
  incorrect: [
    { frequency: 246.94, offset: 0, duration: 0.14, type: "sine" },
    { frequency: 196, offset: 0.12, duration: 0.18, type: "sine" },
  ],
  unlock: [
    { frequency: 523.25, offset: 0, duration: 0.14, type: "triangle" },
    { frequency: 659.25, offset: 0.105, duration: 0.15, type: "triangle" },
    { frequency: 783.99, offset: 0.21, duration: 0.23, type: "triangle" },
  ],
  complete: [
    { frequency: 523.25, offset: 0, duration: 0.2, type: "triangle" },
    { frequency: 659.25, offset: 0.14, duration: 0.2, type: "triangle" },
    { frequency: 783.99, offset: 0.28, duration: 0.2, type: "triangle" },
    { frequency: 1046.5, offset: 0.42, duration: 0.42, type: "triangle" },
  ],
};

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return null;
  if (!audioContext || audioContext.state === "closed") audioContext = new window.AudioContext();
  return audioContext;
}

/** Call before awaiting the server response so the browser registers the user's audio gesture. */
export function preparePokemonAudio(enabled = true) {
  if (!enabled) return;
  try {
    const context = getAudioContext();
    if (context?.state === "suspended") void context.resume().catch(() => undefined);
  } catch {
    // Audio is an enhancement; unsupported or blocked audio must never affect gameplay.
  }
}

export function playPokemonSound(sound: PokemonSound, enabled = true) {
  if (!enabled) return;
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    const start = context.currentTime + 0.015;
    for (const tone of patterns[sound]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + tone.offset;
      oscillator.type = tone.type ?? "sine";
      oscillator.frequency.setValueAtTime(tone.frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.055, at + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + tone.duration + 0.02);
    }
  } catch {
    // Audio is an enhancement; unsupported or blocked audio must never affect gameplay.
  }
}
