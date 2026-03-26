import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { type Language } from "../i18n/messages.js";
import { type TtsProvider } from "./provider.js";
import { playAndCleanup } from "./playback.js";

const API_BASE = "https://api.elevenlabs.io/v1";

/**
 * ElevenLabs TTS provider — high-quality cloud-based speech synthesis.
 * Generates MP3 via the ElevenLabs API, then plays to BlackHole.
 */
export class ElevenLabsTtsProvider implements TtsProvider {
  readonly name = "elevenlabs";

  async speak(text: string, lang: Language): Promise<void> {
    const voiceId = config.elevenLabsVoiceId;
    const apiKey = config.elevenLabsApiKey;

    if (!apiKey || !voiceId) {
      console.error("[TTS:elevenlabs] Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID.");
      throw new Error("ElevenLabs not configured");
    }

    console.log(`[TTS:elevenlabs] Generating speech: "${text}" (lang: ${lang})`);
    const startMs = Date.now();

    const url = `${API_BASE}/text-to-speech/${voiceId}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ElevenLabs API error ${response.status}: ${body}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const elapsedMs = Date.now() - startMs;

    // Estimate duration from MP3 bitrate (~128kbps)
    const estimatedDuration = ((audioBuffer.length * 8) / 128_000).toFixed(1);
    console.log(`[TTS:elevenlabs] Generated ~${estimatedDuration}s of audio in ${elapsedMs}ms`);

    // Write to temp file and play
    const tmpPath = join(tmpdir(), `clive-tts-${Date.now()}.mp3`);
    await writeFile(tmpPath, audioBuffer);
    await playAndCleanup(tmpPath);

    console.log("[TTS:elevenlabs] Playback complete.");
  }
}
