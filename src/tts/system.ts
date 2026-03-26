import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";
import { type Language, defaultVoices } from "../i18n/messages.js";
import { type TtsProvider } from "./provider.js";

const execFileAsync = promisify(execFile);

function resolveVoice(lang: Language): string {
  if (lang === "fr") {
    return config.ttsVoiceFr || defaultVoices.fr;
  }
  return config.ttsVoice || defaultVoices.en;
}

/**
 * System TTS provider — uses macOS `say` or Linux `espeak`.
 * Speaks directly to the configured audio device via `say -a`.
 */
export class SystemTtsProvider implements TtsProvider {
  readonly name = "system";

  async speak(text: string, lang: Language): Promise<void> {
    const device = config.audioDevice;
    const voice = resolveVoice(lang);

    console.log(`[TTS:system] Speaking (voice: ${voice}): "${text}"`);

    const args = ["-a", device, "-v", voice];
    if (config.ttsRate) args.push("-r", String(config.ttsRate));
    args.push(text);

    await execFileAsync("say", args);

    // Brief pause to let the audio buffer flush through BlackHole
    // before the next action. Without this, the tail of the utterance
    // can get clipped when something else starts immediately after.
    await new Promise((r) => setTimeout(r, 500));

    console.log("[TTS:system] Playback complete.");
  }
}
