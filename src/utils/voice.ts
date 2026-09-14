import Tts from 'react-native-tts';

let initialized = false;

async function ensureReady() {
  if (initialized) return;
  try {
    await Tts.getInitStatus();
    Tts.setDefaultLanguage('en-US');
    Tts.setDefaultRate(0.48);
    Tts.setDefaultPitch(1.0);
    initialized = true;
  } catch {
    // Some devices need an install of a TTS engine first.
    try {
      await Tts.requestInstallEngine();
    } catch {
      // Ignore — speak() will no-op if engine missing.
    }
  }
}

export async function speakText(text: string) {
  const clean = text.trim();
  if (!clean) return;
  await ensureReady();
  try {
    await Tts.stop();
    Tts.speak(clean);
  } catch (error) {
    console.warn('Voice commentary unavailable:', error);
  }
}

export async function stopSpeaking() {
  try {
    await Tts.stop();
  } catch {
    // no-op
  }
}
