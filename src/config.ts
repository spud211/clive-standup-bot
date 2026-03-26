import { config as dotenvConfig } from "dotenv";
import { type Language } from "./i18n/messages.js";

dotenvConfig();

const SUPPORTED_LANGUAGES: readonly string[] = ["en", "fr"];

function parseLanguage(value: string | undefined): Language {
  const lang = value ?? "en";
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.warn(`[Config] Unsupported language "${lang}" — falling back to "en". Supported: ${SUPPORTED_LANGUAGES.join(", ")}`);
    return "en";
  }
  return lang as Language;
}

export const config = {
  teamsUrl: process.env.TEAMS_MEETING_URL ?? "",
  botDisplayName: process.env.BOT_DISPLAY_NAME ?? "Clive: Standup AI",
  headless: process.env.HEADLESS === "true",
  lastSpeakerName: process.env.LAST_SPEAKER_NAME ?? "Kinder",
  mode: (process.env.MODE ?? "direct") as "direct" | "api",
  apiPort: parseInt(process.env.API_PORT ?? "3002", 10),
  apiHost: process.env.API_HOST ?? "0.0.0.0",
  language: parseLanguage(process.env.LANGUAGE),
  ttsEnabled: process.env.TTS_ENABLED !== "false",
  ttsProvider: (process.env.TTS_PROVIDER ?? "system") as "system" | "elevenlabs" | "piper",
  ttsVoice: process.env.TTS_VOICE ?? "",
  ttsVoiceFr: process.env.TTS_VOICE_FR ?? "Thomas",
  ttsRate: process.env.TTS_RATE ? parseInt(process.env.TTS_RATE, 10) : undefined,
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "",
  piperBin: (process.env.PIPER_BIN ?? "~/.piper-venv/bin/piper").replace(/^~/, process.env.HOME ?? ""),
  piperVoice: (process.env.PIPER_VOICE ?? "~/.piper-voices/en_GB-alan-medium.onnx").replace(/^~/, process.env.HOME ?? ""),
  piperVoiceFr: process.env.PIPER_VOICE_FR ? (process.env.PIPER_VOICE_FR).replace(/^~/, process.env.HOME ?? "") : "",
  avatarImagePath: process.env.AVATAR_IMAGE_PATH ?? "",
  avatarVideoPath: process.env.AVATAR_VIDEO_PATH ?? "",
  audioDevice: process.env.AUDIO_DEVICE ?? "BlackHole 2ch",
  scrumBoardPrompt: process.env.SCRUM_BOARD_PROMPT !== "false",
  scrumBoardUrl: process.env.SCRUM_BOARD_URL ?? "",
};
