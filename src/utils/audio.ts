/**
 * Restaurant Kitchen Order Notification Audio Utility
 * Provides realistic, professional restaurant kitchen order bell chimes
 * with Web Audio API, browser unlock handling, and volume control.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (err) {
    console.warn('AudioContext initialization notice:', err);
    return null;
  }
}

/**
 * Ensures audio is unlocked on first user interaction in the browser
 */
export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

// Auto-attach unlock listener on window
if (typeof window !== 'undefined') {
  const handleUserGesture = () => {
    unlockAudio();
    window.removeEventListener('click', handleUserGesture);
    window.removeEventListener('keydown', handleUserGesture);
    window.removeEventListener('touchstart', handleUserGesture);
  };
  window.addEventListener('click', handleUserGesture, { once: true });
  window.addEventListener('keydown', handleUserGesture, { once: true });
  window.addEventListener('touchstart', handleUserGesture, { once: true });
}

/**
 * Plays a resonant, crisp restaurant service/kitchen order bell chime
 * Composed of authentic brass bell harmonics with exponential decay.
 */
export function playNewOrderChime(volume = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0.1, Math.min(1.0, volume)), now);
    masterGain.connect(ctx.destination);

    // Creates a realistic metallic bell tone with fundamental + overtone harmonics
    const playBellStrike = (baseFreq: number, time: number, decaySec = 1.2) => {
      const harmonics = [
        { freqMult: 1.0, gainMult: 0.6, type: 'sine' as OscillatorType },
        { freqMult: 2.0, gainMult: 0.3, type: 'triangle' as OscillatorType },
        { freqMult: 3.2, gainMult: 0.15, type: 'sine' as OscillatorType },
        { freqMult: 4.8, gainMult: 0.08, type: 'sine' as OscillatorType },
      ];

      harmonics.forEach(({ freqMult, gainMult, type }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(baseFreq * freqMult, time);

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(gainMult * 0.7, time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + decaySec);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(time);
        osc.stop(time + decaySec);
      });
    };

    // 3-stroke Hotel Malabar Kitchen Order Alert: Ding - Ding - Dong
    playBellStrike(987.77, now, 0.7); // B5 - First strike
    playBellStrike(1174.66, now + 0.22, 0.8); // D6 - Second strike (rising)
    playBellStrike(1479.98, now + 0.48, 1.4); // F#6 - Resonant resolving chime
  } catch (err) {
    console.warn('Unable to trigger audio notification chime:', err);
  }
}

/**
 * Shorter single chime for audio testing and button confirmation
 */
export function playTestChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1046.5, now); // C6

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.4, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (err) {
    console.warn('Test chime notice:', err);
  }
}

