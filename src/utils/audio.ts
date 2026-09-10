/**
 * Hotel Malabar - New Order Notification Audio
 */

let sharedAudioCtx: AudioContext | null = null;

const DEFAULT_SOUND_URL = '/hotel_malabar_new_order_5s.mp3';
const CUSTOM_SOUND_KEY = 'hm_admin_custom_sound_data';
const CUSTOM_SOUND_NAME_KEY = 'hm_admin_custom_sound_name';

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;

    const AudioContextClass =
      window.AudioContext ||
      (window as any).webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }

    return sharedAudioCtx;
  } catch (err) {
    console.warn('AudioContext initialization notice:', err);
    return null;
  }
}

/**
 * Unlock browser audio after user interaction.
 */
export function unlockAudio() {
  const ctx = getAudioContext();

  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/**
 * Get the currently selected custom sound.
 */
export function getCustomSound(): string | null {
  try {
    return localStorage.getItem(CUSTOM_SOUND_KEY);
  } catch {
    return null;
  }
}

/**
 * Get custom sound name.
 */
export function getCustomSoundName(): string {
  try {
    return localStorage.getItem(CUSTOM_SOUND_NAME_KEY) || 'Default Hotel Malabar Sound';
  } catch {
    return 'Default Hotel Malabar Sound';
  }
}

/**
 * Save a custom uploaded sound.
 */
export function saveCustomSound(dataUrl: string, fileName: string) {
  localStorage.setItem(CUSTOM_SOUND_KEY, dataUrl);
  localStorage.setItem(CUSTOM_SOUND_NAME_KEY, fileName);
}

/**
 * Reset to the default Hotel Malabar sound.
 */
export function resetCustomSound() {
  localStorage.removeItem(CUSTOM_SOUND_KEY);
  localStorage.removeItem(CUSTOM_SOUND_NAME_KEY);
}

/**
 * Play the selected notification sound.
 */
export function playNewOrderChime(volume = 0.8) {
  try {
    const customSound = getCustomSound();
    const soundUrl = customSound || DEFAULT_SOUND_URL;

    const audio = new Audio(soundUrl);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.currentTime = 0;

    audio.play().catch(() => {
      playFallbackChime(volume);
    });
  } catch {
    playFallbackChime(volume);
  }
}

/**
 * Preview/test the selected sound.
 */
export function playTestChime() {
  playNewOrderChime(0.8);
}

/**
 * Fallback bell if the MP3 cannot be played.
 */
function playFallbackChime(volume = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();

    masterGain.gain.setValueAtTime(
      Math.max(0.1, Math.min(1, volume)),
      now
    );

    masterGain.connect(ctx.destination);

    const playBellStrike = (
      baseFreq: number,
      time: number,
      decaySec = 1.2
    ) => {
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
        osc.frequency.setValueAtTime(
          baseFreq * freqMult,
          time
        );

        gain.gain.setValueAtTime(
          gainMult,
          time
        );

        gain.gain.exponentialRampToValueAtTime(
          0.001,
          time + decaySec
        );

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(time);
        osc.stop(time + decaySec);
      });
    };

    playBellStrike(880, now, 1.0);
    playBellStrike(740, now + 0.35, 1.0);
    playBellStrike(988, now + 0.7, 1.2);
  } catch (err) {
    console.warn('Fallback audio error:', err);
  }
}

/**
 * Automatically unlock audio after user interaction.
 */
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
