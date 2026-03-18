export type Language = "en" | "fr";

export interface Messages {
  welcome: string;
  noParticipants: string;
  prompt: string;
  thanks: string;
  skipped: string;
  complete: string;
}

const en: Messages = {
  welcome: "Good morning team! Type **start daily** when you're ready.",
  noParticipants: "No participants found — skipping standup.",
  prompt: "**{name}**, you're up! Give us your update.",
  thanks: "Thanks {name}! ✓",
  skipped: "{name} has left — skipping. 👋",
  complete: "That's everyone! Thanks team, have a great day. 👋",
};

const fr: Messages = {
  welcome: "Bonjour l'équipe ! Tapez **commencer daily** quand vous êtes prêts.",
  noParticipants: "Aucun participant trouvé — on passe le standup.",
  prompt: "**{name}**, c'est à toi ! Donne-nous ton update.",
  thanks: "Merci {name} ! ✓",
  skipped: "{name} est parti(e) — on passe. 👋",
  complete: "C'est tout le monde ! Merci l'équipe, bonne journée. 👋",
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

/** Format a message template, replacing {name} with the given value. */
export function fmt(template: string, name: string): string {
  return template.replace(/\{name\}/g, name);
}
