import { config } from "../config.js";
import { type Language } from "../i18n/messages.js";
import { type TtsProvider } from "./provider.js";
import { SystemTtsProvider } from "./system.js";
import { ElevenLabsTtsProvider } from "./elevenlabs.js";
import { PiperTtsProvider } from "./piper.js";

/** Serial queue — ensures one utterance finishes before the next starts. */
let speechQueue: Promise<void> = Promise.resolve();

/** The primary provider, resolved once from config. */
let primaryProvider: TtsProvider | null = null;

/** Fallback provider (always system/say). */
const fallbackProvider = new SystemTtsProvider();

function getProvider(): TtsProvider {
  if (primaryProvider) return primaryProvider;

  switch (config.ttsProvider) {
    case "elevenlabs":
      primaryProvider = new ElevenLabsTtsProvider();
      break;
    case "piper":
      primaryProvider = new PiperTtsProvider();
      break;
    default:
      primaryProvider = new SystemTtsProvider();
  }

  console.log(`[TTS] Provider: ${primaryProvider.name}`);
  return primaryProvider;
}

/**
 * Play TTS audio into the meeting.
 *
 * Calls are serialised: if a second call arrives while the first is still
 * speaking, it waits for the first to finish before starting.
 *
 * If the primary provider fails, falls back to system TTS (say/espeak).
 */
export function playAudioInMeeting(text: string, lang?: Language): Promise<void> {
  const device = config.audioDevice;
  if (!device) {
    console.log("[Audio] No audio device configured — skipping playback.");
    return Promise.resolve();
  }

  const job = speechQueue.then(() => speakWithFallback(text, lang));
  speechQueue = job.catch(() => {});
  return job;
}

async function speakWithFallback(text: string, lang?: Language): Promise<void> {
  const effectiveLang = lang ?? config.language;
  const provider = getProvider();

  try {
    await provider.speak(text, effectiveLang);
  } catch (err) {
    // Fall back to system TTS if the primary provider fails
    if (provider !== fallbackProvider && provider.name !== "system") {
      console.warn(`[TTS] ${provider.name} failed, falling back to system:`, err);
      try {
        await fallbackProvider.speak(text, effectiveLang);
      } catch (fallbackErr) {
        console.error("[TTS] Fallback (system) also failed:", fallbackErr);
      }
    } else {
      console.error("[TTS] System TTS failed:", err);
    }
  }
}
