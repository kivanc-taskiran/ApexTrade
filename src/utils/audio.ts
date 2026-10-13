/**
 * Lightweight, zero-dependency sound synthesizer using Web Audio API.
 * Works seamlessly in React Native Web without external audio files.
 * Safely no-ops in native environments.
 */

let audioEnabled = true;

export function setAudioEnabled(enabled: boolean) {
  audioEnabled = enabled;
}

export function isAudioEnabled(): boolean {
  return audioEnabled;
}

export function playSound(type: 'buy' | 'sell' | 'fill' | 'click' | 'faucet') {
  if (!audioEnabled) return;
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'buy') {
      // Pleasant upward dual-tone chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'sell') {
      // Crisp downward chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now); // G5
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.12); // C5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'fill') {
      // Triggered limit order execution sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.18); // E6
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'faucet') {
      // Coin deposit sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(987.77, now + 0.08); // B5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'click') {
      // Subtle tactile click
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch {
    // Gracefully ignore audio autoplay policies
  }
}
