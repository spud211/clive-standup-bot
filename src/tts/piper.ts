import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { type Language } from "../i18n/messages.js";
import { type TtsProvider } from "./provider.js";
import { playAndCleanup } from "./playback.js";

function resolveVoice(lang: Language): string {
  if (lang === "fr" && config.piperVoiceFr) {
    return config.piperVoiceFr;
  }
  return config.piperVoice;
}

/**
 * Piper TTS provider — high-quality offline neural TTS.
 * Generates WAV via the piper CLI, then plays to BlackHole.
 *
 * Pipeline: echo "text" | piper --model voice.onnx --output_file /tmp/speech.wav
 * Then: afplay via SwitchAudioSource → BlackHole
 */
export class PiperTtsProvider implements TtsProvider {
  readonly name = "piper";

  async speak(text: string, lang: Language): Promise<void> {
    const voice = resolveVoice(lang);
    const piperBin = config.piperBin;
    const tmpPath = join(tmpdir(), `clive-tts-${Date.now()}.wav`);

    console.log(`[TTS:piper] Generating speech (model: ${voice}): "${text}"`);
    const startMs = Date.now();

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(piperBin, [
        "--model", voice,
        "--output_file", tmpPath,
      ], { stdio: ["pipe", "pipe", "pipe"], timeout: 30_000 });

      let stderr = "";
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on("error", (err) => reject(err));
      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`piper exited with code ${code}: ${stderr}`));
        }
      });

      // Write text to stdin and close
      proc.stdin.write(text);
      proc.stdin.end();
    });

    const elapsedMs = Date.now() - startMs;
    console.log(`[TTS:piper] Generated audio in ${elapsedMs}ms`);

    await playAndCleanup(tmpPath);
    console.log("[TTS:piper] Playback complete.");
  }
}
