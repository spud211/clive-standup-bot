import { type Page } from "playwright";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { selectors } from "../browser/selectors.js";

const execFileAsync = promisify(execFile);

/**
 * Play an audio file into the Teams meeting by:
 * 1. Converting to WAV if needed
 * 2. Reading the file as base64
 * 3. Injecting it into the page via Web Audio API, replacing the mic stream
 * 4. Unmuting mic before play, re-muting after
 */
export async function playAudioInMeeting(page: Page, audioPath: string): Promise<void> {
  console.log(`[Audio] Playing audio file: ${audioPath}`);

  // Convert to WAV (PCM 16-bit, 48kHz mono) for consistent decoding
  const wavPath = await convertToWav(audioPath);

  // Read as base64
  const audioBuffer = await readFile(wavPath);
  const base64Audio = audioBuffer.toString("base64");

  // Unmute mic
  await toggleMic(page, true);

  // Inject and play audio via Web Audio API
  try {
    await page.evaluate(async (b64: string) => {
      // Decode base64 to ArrayBuffer
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const audioContext = new AudioContext({ sampleRate: 48000 });
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);

      // Create a media stream destination that acts as a virtual mic
      const dest = audioContext.createMediaStreamDestination();
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(dest);
      source.connect(audioContext.destination); // Also play locally for debug

      // Replace the mic track in any active peer connections
      const stream = dest.stream;
      const audioTrack = stream.getAudioTracks()[0];

      // Find RTCPeerConnections and replace their audio tracks
      // Teams uses RTCPeerConnection under the hood
      if (audioTrack && (window as unknown as Record<string, unknown>).__cliveRtcSenders) {
        const senders = (window as unknown as Record<string, unknown>).__cliveRtcSenders as RTCRtpSender[];
        for (const sender of senders) {
          if (sender.track?.kind === "audio") {
            await sender.replaceTrack(audioTrack);
          }
        }
      }

      // Play and wait for completion
      return new Promise<void>((resolve) => {
        source.onended = () => {
          audioContext.close();
          resolve();
        };
        source.start();
      });
    }, base64Audio);

    console.log("[Audio] Audio playback complete.");
  } catch (err) {
    console.error("[Audio] Error during playback:", err);
  }

  // Re-mute mic
  await toggleMic(page, false);
}

/**
 * Set up interception of RTCPeerConnection to capture audio senders.
 * Call this once after joining the meeting so we can replace audio tracks later.
 */
export async function setupRtcInterception(page: Page): Promise<void> {
  console.log("[Audio] Setting up RTC interception for audio track replacement...");
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__cliveRtcSenders = [];
    const origAddTrack = RTCPeerConnection.prototype.addTrack;
    RTCPeerConnection.prototype.addTrack = function (track: MediaStreamTrack, ...streams: MediaStream[]) {
      const sender = origAddTrack.call(this, track, ...streams);
      if (track.kind === "audio") {
        ((window as unknown as Record<string, unknown>).__cliveRtcSenders as RTCRtpSender[]).push(sender);
      }
      return sender;
    };
  });
  console.log("[Audio] RTC interception ready.");
}

/**
 * Toggle the in-meeting microphone on or off.
 */
async function toggleMic(page: Page, unmute: boolean): Promise<void> {
  const action = unmute ? "Unmuting" : "Muting";
  console.log(`[Audio] ${action} microphone...`);

  try {
    const micBtn = page.locator(selectors.inMeetingMicToggle);
    await micBtn.waitFor({ state: "visible", timeout: 5000 });

    // Check current mute state
    const ariaLabel = await micBtn.getAttribute("aria-label") ?? "";
    const isMuted = ariaLabel.toLowerCase().includes("unmute") ||
                    ariaLabel.toLowerCase().includes("muted");

    if ((unmute && isMuted) || (!unmute && !isMuted)) {
      await micBtn.click();
      console.log(`[Audio] Mic ${unmute ? "unmuted" : "muted"}.`);
    } else {
      console.log(`[Audio] Mic already ${unmute ? "unmuted" : "muted"}.`);
    }
  } catch (err) {
    console.error(`[Audio] Failed to toggle mic:`, err);
  }
}

/**
 * Convert an audio file to WAV 48kHz mono PCM using ffmpeg or afconvert (macOS).
 */
async function convertToWav(inputPath: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "clive-wav-"));
  const outPath = join(dir, "audio.wav");

  try {
    // Try ffmpeg first (works everywhere)
    await execFileAsync("ffmpeg", [
      "-y", "-i", inputPath,
      "-ar", "48000", "-ac", "1", "-f", "wav",
      outPath,
    ]);
  } catch {
    // Fall back to afconvert on macOS
    await execFileAsync("afconvert", [
      "-f", "WAVE", "-d", "LEI16@48000",
      "-c", "1",
      inputPath, outPath,
    ]);
  }

  return outPath;
}
