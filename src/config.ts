import { config as dotenvConfig } from "dotenv";

dotenvConfig();

export const config = {
  teamsUrl: process.env.TEAMS_MEETING_URL ?? "",
  botDisplayName: process.env.BOT_DISPLAY_NAME ?? "Clive: Standup AI",
  headless: process.env.HEADLESS === "true",
  lastSpeakerName: process.env.LAST_SPEAKER_NAME ?? "Kinder",
  mode: (process.env.MODE ?? "direct") as "direct" | "api",
  apiPort: parseInt(process.env.API_PORT ?? "3002", 10),
  apiHost: process.env.API_HOST ?? "0.0.0.0",
};
