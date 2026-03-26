export type Language = "en" | "fr";

export interface Messages {
  welcome: string[];
  welcomeMonday: string;
  welcomeFriday: string;
  noParticipants: string;
  prompt: string;
  thanks: string;
  skipped: string;
  complete: string[];
  completeFriday: string;
  ops: string;
  boardPrompt: string;
  boardPromptWithUrl: string;
}

const en: Messages = {
  welcome: [
    "Good morning team! I feel lucky to be here today, and I am ready with my brew. Type **start daily** when you're ready.",
    "Morning all. Kettle's on, standups wait for no one. Type **start daily** when you're ready.",
    "Right then. Another day, another standup. Type **start daily** when you're ready.",
    "Good morning! I've been here since 5am. Just kidding. Type **start daily** when you're ready.",
  ],
  welcomeMonday: "Happy Monday team. Let's ease into it. Type **start daily** when you're ready.",
  welcomeFriday: "Happy Friday! Let's keep this one snappy. Type **start daily** when you're ready.",
  noParticipants: "No participants found — skipping standup.",
  prompt: "**{name}**, you're up! Give us your update.",
  thanks: "Thanks {name}! ✓",
  skipped: "{name} has left — skipping. 👋",
  complete: [
    "That's everyone! Thanks team, have a great day. 👋",
    "And we're done! Not bad. Have a good one. 👋",
    "All done. Go forth and be productive. Or don't. I'm a bot, not your manager. 👋",
    "That's everyone! Thanks team, have a great day. I'm off now it's time for Homes Under the Hammer! 👋",
  ],
  completeFriday: "That's a wrap! Enjoy the weekend, you've earned it. 👋",
  ops: "⚡ Mode +o {name} — you have the conn today, {firstName}. Keep us honest.",
  boardPrompt: "🖥️ **{name}**, fancy sharing the board? I'll wait 10 seconds, or type **go** to skip.",
  boardPromptWithUrl: "🖥️ **{name}**, fancy sharing the board? ({url}) I'll wait 10 seconds, or type **go** to skip.",
};

const fr: Messages = {
  welcome: [
    "Bonjour l'équipe ! Tapez **commencer daily** quand vous êtes prêts.",
    "Salut tout le monde. Le café est prêt, les standups n'attendent pas. Tapez **commencer daily** quand vous êtes prêts.",
    "Allez, c'est reparti. Tapez **commencer daily** quand vous êtes prêts.",
    "Bonjour ! Je suis là depuis 5h. Non je rigole. Tapez **commencer daily** quand vous êtes prêts.",
  ],
  welcomeMonday: "Bon lundi l'équipe. On y va doucement. Tapez **commencer daily** quand vous êtes prêts.",
  welcomeFriday: "Bon vendredi ! On fait ça vite. Tapez **commencer daily** quand vous êtes prêts.",
  noParticipants: "Aucun participant trouvé — on passe le standup.",
  prompt: "**{name}**, c'est à toi ! Donne-nous ton update.",
  thanks: "Merci {name} ! ✓",
  skipped: "{name} est parti(e) — on passe. 👋",
  complete: [
    "C'est tout le monde ! Merci l'équipe, bonne journée. 👋",
    "Et voilà ! Pas mal. Bonne journée à tous. 👋",
    "C'est fini. Allez bosser. Ou pas. Je suis un bot, pas votre manager. 👋",
  ],
  completeFriday: "C'est fini ! Bon weekend, vous l'avez mérité. 👋",
  ops: "⚡ Mode +o {name} — c'est toi le chef aujourd'hui, {firstName}. Garde-nous sur les rails.",
  boardPrompt: "🖥️ **{name}**, tu veux partager le board ? J'attends 10 secondes, ou tape **go** pour passer.",
  boardPromptWithUrl: "🖥️ **{name}**, tu veux partager le board ? ({url}) J'attends 10 secondes, ou tape **go** pour passer.",
};

const allMessages: Record<Language, Messages> = { en, fr };

/** Trigger phrases that start the standup, per language. */
export const startTriggers: Record<Language, string[]> = {
  en: ["start daily"],
  fr: ["commencer daily"],
};

/** Trigger phrases that advance to the next speaker, per language. */
export const advanceTriggers: Record<Language, string[]> = {
  en: ["done", "next"],
  fr: ["fini", "suivant", "terminé", "done", "next"],
};

/** Default TTS voices per language (macOS `say` command). */
export const defaultVoices: Record<Language, string> = {
  en: "Jamie (Enhanced)",
  fr: "Thomas",
};

export function getMessages(lang: Language): Messages {
  return allMessages[lang];
}

import { pick } from "../utils.js";

/** Pick a welcome message, with day-of-week specials. */
export function pickWelcome(msg: Messages): string {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, 5=Fri
  if (day === 1) return msg.welcomeMonday;
  if (day === 5) return msg.welcomeFriday;
  return pick(msg.welcome);
}

/** Pick a sign-off message, with Friday special. */
export function pickComplete(msg: Messages): string {
  const day = new Date().getDay();
  if (day === 5) return msg.completeFriday;
  return pick(msg.complete);
}

/** Format a message template, replacing {name}, {firstName}, and {url} placeholders. */
export function fmt(template: string, name: string, extra?: Record<string, string>): string {
  const firstName = name.split(/\s+/)[0];
  let result = template.replace(/\{name\}/g, name).replace(/\{firstName\}/g, firstName);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
  }
  return result;
}
