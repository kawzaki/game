export const SOUNDS = {
  countdown: 'https://www.myinstants.com/media/sounds/count-down-sound-effekt.mp3',
  buzzer: 'https://assets.mixkit.co/active_storage/sfx/1084/1084-preview.mp3',
  correct: 'https://www.myinstants.com/media/sounds/correct.mp3',
  wrong: 'https://www.myinstants.com/media/sounds/wrong-answer-buzzer.mp3',
  timeout: 'https://assets.mixkit.co/active_storage/sfx/2658/2658-preview.mp3',
  game_over_win: 'https://www.myinstants.com/media/sounds/award-winners-fanfare_SXgBSYC.mp3',
  game_over_lose: 'https://www.myinstants.com/media/sounds/wah-wah-sound-effect.mp3',
  ding: 'https://www.myinstants.com/media/sounds/ding-sound-effect.mp3'
};

export type SoundType = keyof typeof SOUNDS;

export const playSound = (type: SoundType) => {
  try {
    const audio = new Audio(SOUNDS[type]);
    audio.play().catch(e => console.warn(`Sound play error (${type}):`, e));
  } catch (err) {
    console.error("Audio error:", err);
  }
};
