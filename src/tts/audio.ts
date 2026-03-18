import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";
import { type Language, defaultVoices } from "../i18n/messages.js";

const execFileAsync = promisify(execFile);

/**
 * Resolve the TTS voice for the given language.
 * Priority: explicit env var (TTS_VOICE / TTS_VOICE_FR) → language default.
 */
function resolveVoice(lang: Language): string {
  if (lang === "fr") {
    return config.ttsVoiceFr || defaultVoices.fr;
  }
  return config.ttsVoice || defaultVoices.en;
}

/**
 * Play TTS audio into the meeting by routing it through BlackHole 2ch.
 *
 * Uses `say -a "BlackHole 2ch"` to speak directly to the virtual audio
 * device. Chromium picks up BlackHole as its mic input, so Teams hears
 * the speech.
 */
export async function playAudioInMeeting(text: string, lang?: Language): Promise<void> {
  const device = config.audioDevice;
  if (!device) {
    console.log("[Audio] No audio device configured — skipping playback.");
    return;
  }

  const effectiveLang = lang ?? config.language;
  const voice = resolveVoice(effectiveLang);

  console.log(`[Audio] Speaking to device "${device}" (voice: ${voice}): "${text}"`);

  try {
    const args = ["-a", device, "-v", voice];
    if (config.ttsRate) args.push("-r", String(config.ttsRate));
    args.push(text);

    await execFileAsync("say", args);
    console.log("[Audio] Playback complete.");
  } catch (err) {
    console.error("[Audio] Failed to play audio:", err);
  }
}
