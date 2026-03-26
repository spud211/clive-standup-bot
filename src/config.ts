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
  ttsBackend: (process.env.TTS_BACKEND ?? "say") as "say" | "espeak",
  ttsVoice: process.env.TTS_VOICE ?? "",
  ttsVoiceFr: process.env.TTS_VOICE_FR ?? "Thomas",
  ttsRate: process.env.TTS_RATE ? parseInt(process.env.TTS_RATE, 10) : undefined,
  avatarImagePath: process.env.AVATAR_IMAGE_PATH ?? "",
  avatarVideoPath: process.env.AVATAR_VIDEO_PATH ?? "",
  audioDevice: process.env.AUDIO_DEVICE ?? "BlackHole 2ch",
  scrumBoardPrompt: process.env.SCRUM_BOARD_PROMPT !== "false",
  scrumBoardUrl: process.env.SCRUM_BOARD_URL ?? "",
};
