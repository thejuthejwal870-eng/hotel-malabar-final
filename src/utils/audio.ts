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

export const DEFAULT_SOUND_NAME = 'Hotel Malabar Default Bell (Authentic 3-Strike MP3 Chime)';

let currentCustomAudioData: string | null = null;
let currentCustomSoundName: string = DEFAULT_SOUND_NAME;
let customAudioElement: HTMLAudioElement | null = null;

// Initialize from localStorage if available on browser
if (typeof window !== 'undefined') {
  try {
    const savedData = localStorage.getItem('hm_admin_custom_sound_data');
    const savedName = localStorage.getItem('hm_admin_custom_sound_name');
    if (savedData) {
      currentCustomAudioData = savedData;
      currentCustomSoundName = savedName || 'Custom Notification Sound';
      customAudioElement = new Audio(savedData);
      customAudioElement.preload = 'auto';
    }
  } catch (err) {
    console.warn('Custom sound init notice:', err);
  }
}

export function setCustomAudio(audioData: string | null, soundName?: string) {
  currentCustomAudioData = audioData;
  if (audioData) {
    currentCustomSoundName = soundName || 'Custom Notification Sound';
    if (typeof window !== 'undefined') {
      try {
        customAudioElement = new Audio(audioData);
        customAudioElement.preload = 'auto';
      } catch (err) {
        console.warn('Could not initialize custom Audio instance:', err);
        customAudioElement = null;
      }
    }
  } else {
    currentCustomSoundName = DEFAULT_SOUND_NAME;
    customAudioElement = null;
  }
}

export function resetCustomAudio() {
  setCustomAudio(null);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('hm_admin_custom_sound_data');
      localStorage.removeItem('hm_admin_custom_sound_name');
    } catch (err) {
      console.warn('Error clearing custom sound from localStorage:', err);
    }
  }
}

export function getCurrentSoundName(): string {
  return currentCustomSoundName;
}

export function hasCustomAudio(): boolean {
  return !!currentCustomAudioData;
}

/**
 * Plays the Hotel Malabar authentic default 3-strike bell chime using Web Audio
 */
export function playDefaultWebAudioChime(volume = 0.8) {
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
    console.warn('Unable to trigger default audio chime:', err);
  }
}

/**
 * Plays the new order chime:
 * If a custom sound is set, plays the custom sound automatically.
 * If no custom sound is selected, uses the existing Hotel Malabar default sound.
 */
export function playNewOrderChime(volume = 0.8) {
  try {
    if (currentCustomAudioData) {
      if (!customAudioElement || customAudioElement.src !== currentCustomAudioData) {
        customAudioElement = new Audio(currentCustomAudioData);
      }
      customAudioElement.volume = Math.max(0.1, Math.min(1.0, volume));
      customAudioElement.currentTime = 0;
      const playPromise = customAudioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Custom audio playback error, using default chime fallback:', err);
          playDefaultWebAudioChime(volume);
        });
      }
      return;
    }

    // Default Hotel Malabar kitchen bell chime
    playDefaultWebAudioChime(volume);
  } catch (err) {
    console.warn('Unable to trigger audio notification chime:', err);
    playDefaultWebAudioChime(volume);
  }
}

/**
 * Shorter single chime for audio testing and button confirmation
 */
export function playTestChime() {
  if (currentCustomAudioData) {
    playNewOrderChime(0.8);
    return;
  }
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

