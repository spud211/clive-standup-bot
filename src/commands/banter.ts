import { type CommandDef, type CommandContext } from "./registry.js";
import { sendAndSpeak } from "../meeting/chat.js";
import { type Language } from "../i18n/messages.js";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Greeting — "good morning clive", "hi clive", etc.
// ---------------------------------------------------------------------------

const greetingPatterns = [
  /\b(good morning|morning|hello|hi|hey|hiya)\b.*\bclive\b/,
  /\bclive\b.*\b(good morning|morning|hello|hi|hey|hiya)\b/,
];

const greetingResponses: Record<Language, string[]> = {
  en: [
    "Morning! 👋",
    "Hello! Ready when you are.",
    "Morning. I've had three coffees already.",
    "👋 Morning! Let's do this.",
  ],
  fr: [
    "Bonjour ! 👋",
    "Salut ! Prêt quand vous voulez.",
    "Bonjour. J'ai déjà bu trois cafés.",
    "👋 Salut ! C'est parti.",
  ],
};

export const greetingCommand: CommandDef = {
  name: "greeting",
  allowDuringStandup: true,
  match: (text) => greetingPatterns.some((p) => p.test(text)),
  async handle(ctx: CommandContext) {
    await sendAndSpeak(ctx.page, pick(greetingResponses[ctx.lang]), ctx.lang);
  },
};

// ---------------------------------------------------------------------------
// Thanks — "thanks clive", "cheers clive", "good job clive", etc.
// ---------------------------------------------------------------------------

const thanksPatterns = [
  /\b(thanks|thank you|cheers|ta|good job|nice one|well done)\b.*\bclive\b/,
  /\bclive\b.*\b(thanks|thank you|cheers|ta|good job|nice one|well done)\b/,
];

const thanksResponses: Record<Language, string[]> = {
  en: [
    "Just doing my job. ☕",
    "You're welcome. That'll be £5.",
    "All in a day's work.",
    "I live to serve. Literally.",
    "No worries. I'll add it to your tab.",
  ],
  fr: [
    "C'est mon boulot. ☕",
    "De rien. Ça fera 5€.",
    "Tout dans une journée de travail.",
    "Je vis pour servir. Littéralement.",
  ],
};

export const thanksCommand: CommandDef = {
  name: "thanks",
  allowDuringStandup: true,
  match: (text) => thanksPatterns.some((p) => p.test(text)),
  async handle(ctx: CommandContext) {
    await sendAndSpeak(ctx.page, pick(thanksResponses[ctx.lang]), ctx.lang);
  },
};
