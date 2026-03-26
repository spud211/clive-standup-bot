import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { type Language } from "../i18n/messages.js";
import { type TtsProvider } from "./provider.js";
import { playAndCleanup } from "./playback.js";

const execAsync = promisify(exec);

function resolveVoice(lang: Language): string {
  if (lang === "fr") {
    return config.piperVoiceFr;
  }
  return config.piperVoice;
}

/**
 * Piper TTS provider — high-quality offline neural TTS.
 * Generates WAV via the `piper` CLI, then plays to BlackHole.
 *
 * Requires `piper` to be installed (pip install piper-tts, or binary from GitHub).
 * Voice models are downloaded automatically on first use.
 */
export class PiperTtsProvider implements TtsProvider {
  readonly name = "piper";

  async speak(text: string, lang: Language): Promise<void> {
    const voice = resolveVoice(lang);
    const tmpPath = join(tmpdir(), `clive-tts-${Date.now()}.wav`);

    console.log(`[TTS:piper] Generating speech (voice: ${voice}): "${text}"`);
    const startMs = Date.now();

    // piper reads from stdin, writes WAV to --output_file
    const safeText = text.replace(/'/g, "'\\''");
    await execAsync(
      `echo '${safeText}' | piper --model ${JSON.stringify(voice)} --output_file ${JSON.stringify(tmpPath)}`,
      { timeout: 30_000 },
    );

    const elapsedMs = Date.now() - startMs;
    console.log(`[TTS:piper] Generated audio in ${elapsedMs}ms`);

    await playAndCleanup(tmpPath);
    console.log("[TTS:piper] Playback complete.");
  }
}
