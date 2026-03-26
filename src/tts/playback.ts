import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { unlink } from "node:fs/promises";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);

/**
 * Play an audio file to the configured audio device (BlackHole 2ch).
 *
 * Temporarily switches the system default output to BlackHole via
 * SwitchAudioSource, plays with afplay, then restores the previous output.
 * This is needed because afplay doesn't support targeting a specific device.
 */
export async function playFileToDevice(filePath: string): Promise<void> {
  const device = config.audioDevice;
  if (!device) return;

  let previousOutput: string | null = null;

  try {
    // Save current output device
    const { stdout } = await execFileAsync("SwitchAudioSource", ["-c", "-t", "output"]);
    previousOutput = stdout.trim();

    // Switch to BlackHole
    if (previousOutput !== device) {
      await execFileAsync("SwitchAudioSource", ["-t", "output", "-s", device]);
    }

    // Play the file
    await execFileAsync("afplay", [filePath]);

    // Let the audio buffer flush through BlackHole before switching back
    await new Promise((r) => setTimeout(r, 500));
  } finally {
    // Restore previous output device
    if (previousOutput && previousOutput !== device) {
      try {
        await execFileAsync("SwitchAudioSource", ["-t", "output", "-s", previousOutput]);
      } catch {
        console.warn("[Playback] Failed to restore audio output device.");
      }
    }
  }
}

/** Play a file to the device and then clean it up. */
export async function playAndCleanup(filePath: string): Promise<void> {
  try {
    await playFileToDevice(filePath);
  } finally {
    try {
      await unlink(filePath);
    } catch {
      // Temp file cleanup is best-effort
    }
  }
}
