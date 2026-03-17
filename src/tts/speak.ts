import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export type TtsBackend = "say" | "espeak";

export interface TtsOptions {
  backend?: TtsBackend;
  voice?: string;
  rate?: number; // words per minute (say) or speed (espeak)
}

/**
 * Generate a WAV audio file from text using the configured TTS backend.
 * Returns the path to the generated WAV file. Caller is responsible for cleanup.
 */
export async function speak(text: string, options: TtsOptions = {}): Promise<string> {
  const backend = options.backend ?? "say";
  console.log(`[TTS] Generating speech (${backend}): "${text}"`);

  switch (backend) {
    case "say":
      return speakWithSay(text, options);
    case "espeak":
      return speakWithEspeak(text, options);
    default:
      throw new Error(`Unknown TTS backend: ${backend}`);
  }
}

/**
 * Clean up a temporary audio file after playback.
 */
export async function cleanupAudioFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // File may already be gone
  }
}

// ---------------------------------------------------------------------------
// macOS `say` backend
// ---------------------------------------------------------------------------

async function speakWithSay(text: string, options: TtsOptions): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "clive-tts-"));
  const outPath = join(dir, "speech.aiff");

  const args = ["-o", outPath];
  if (options.voice) args.push("-v", options.voice);
  if (options.rate) args.push("-r", String(options.rate));
  args.push(text);

  await execFileAsync("say", args);
  console.log(`[TTS] Generated audio: ${outPath}`);
  return outPath;
}

// ---------------------------------------------------------------------------
// espeak / espeak-ng backend (Linux / Docker)
// ---------------------------------------------------------------------------

async function speakWithEspeak(text: string, options: TtsOptions): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "clive-tts-"));
  const outPath = join(dir, "speech.wav");

  const args = ["-w", outPath];
  if (options.voice) args.push("-v", options.voice);
  if (options.rate) args.push("-s", String(options.rate ?? 160));
  args.push(text);

  // Try espeak-ng first, fall back to espeak
  try {
    await execFileAsync("espeak-ng", args);
  } catch {
    await execFileAsync("espeak", args);
  }

  console.log(`[TTS] Generated audio: ${outPath}`);
  return outPath;
}
