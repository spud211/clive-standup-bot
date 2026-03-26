import { type CommandDef, type CommandContext } from "./registry.js";
import { sendAndSpeak, sendChatMessage } from "../meeting/chat.js";
import { type Language } from "../i18n/messages.js";

interface DiscussionState {
  topic: string;
  timer: ReturnType<typeof setTimeout>;
  warningTimer: ReturnType<typeof setTimeout> | null;
  durationMs: number;
  startedAt: number;
}

let activeDiscussion: DiscussionState | null = null;

// Store a reference to the page so /end and /extend can send messages
let discussionPage: CommandContext["page"] | null = null;
let discussionLang: Language = "en";

const msgs = {
  en: {
    start: (topic: string) =>
      `💬 **Open discussion: ${topic}** — everyone jump in. Type **/end** when we're done.`,
    warning: "⏱️ 2 minutes left on the discussion.",
    timeUp: (topic: string) =>
      `⏱️ Time's up on **${topic}**. Type **/extend {minutes}** to keep going or **/end** to wrap up.`,
    closed: "💬 Discussion closed. Back to business.",
    extended: (mins: number, topic: string) =>
      `⏱️ Discussion on **${topic}** extended by ${mins} minute${mins > 1 ? "s" : ""}.`,
    noDiscussion: "💬 No active discussion.",
    alreadyActive: (topic: string) =>
      `💬 Discussion on **${topic}** is already active. Type **/end** to close it first.`,
  },
  fr: {
    start: (topic: string) =>
      `💬 **Discussion ouverte : ${topic}** — tout le monde peut parler. Tapez **/end** quand c'est fini.`,
    warning: "⏱️ 2 minutes restantes pour la discussion.",
    timeUp: (topic: string) =>
      `⏱️ Le temps est écoulé pour **${topic}**. Tapez **/extend {minutes}** pour continuer ou **/end** pour terminer.`,
    closed: "💬 Discussion terminée. On reprend.",
    extended: (mins: number, topic: string) =>
      `⏱️ Discussion sur **${topic}** prolongée de ${mins} minute${mins > 1 ? "s" : ""}.`,
    noDiscussion: "💬 Aucune discussion en cours.",
    alreadyActive: (topic: string) =>
      `💬 Discussion sur **${topic}** déjà en cours. Tapez **/end** pour la fermer d'abord.`,
  },
};

function clearDiscussion(): void {
  if (activeDiscussion) {
    clearTimeout(activeDiscussion.timer);
    if (activeDiscussion.warningTimer) clearTimeout(activeDiscussion.warningTimer);
    activeDiscussion = null;
  }
}

function setupTimers(durationMs: number): void {
  if (!activeDiscussion || !discussionPage) return;

  const topic = activeDiscussion.topic;
  const page = discussionPage;
  const lang = discussionLang;
  const m = msgs[lang];

  // Warning at 2 minutes remaining (only if duration > 3 min)
  if (durationMs > 3 * 60_000) {
    activeDiscussion.warningTimer = setTimeout(async () => {
      await sendAndSpeak(page, m.warning, lang);
    }, durationMs - 2 * 60_000);
  }

  // Time's up
  activeDiscussion.timer = setTimeout(async () => {
    await sendAndSpeak(page, m.timeUp(topic), lang);
    console.log(`[Conversate] Time's up on "${topic}".`);
    // Don't clear — let the user /end or /extend
  }, durationMs);
}

// ---------------------------------------------------------------------------
// /conversate {topic} or /discuss {topic}
// ---------------------------------------------------------------------------

export const conversateCommand: CommandDef = {
  name: "/conversate",
  allowDuringStandup: false,
  match: (text) => text.startsWith("/conversate ") || text.startsWith("/discuss "),
  async handle(ctx: CommandContext) {
    const m = msgs[ctx.lang];

    if (activeDiscussion) {
      await sendChatMessage(ctx.page, m.alreadyActive(activeDiscussion.topic));
      return;
    }

    const topic = ctx.message.replace(/^\/(conversate|discuss)\s+/i, "").trim();
    if (!topic) return;

    const durationMs = 10 * 60_000; // default 10 minutes

    discussionPage = ctx.page;
    discussionLang = ctx.lang;

    activeDiscussion = {
      topic,
      durationMs,
      startedAt: Date.now(),
      timer: null as unknown as ReturnType<typeof setTimeout>,
      warningTimer: null,
    };

    setupTimers(durationMs);

    await sendAndSpeak(ctx.page, m.start(topic), ctx.lang);
    console.log(`[Conversate] Started: "${topic}" (10 minutes).`);
  },
};

// ---------------------------------------------------------------------------
// /end
// ---------------------------------------------------------------------------

export const endCommand: CommandDef = {
  name: "/end",
  allowDuringStandup: false,
  match: (text) => text === "/end",
  async handle(ctx: CommandContext) {
    const m = msgs[ctx.lang];

    if (!activeDiscussion) {
      await sendChatMessage(ctx.page, m.noDiscussion);
      return;
    }

    console.log(`[Conversate] Discussion on "${activeDiscussion.topic}" closed.`);
    clearDiscussion();
    await sendAndSpeak(ctx.page, m.closed, ctx.lang);
  },
};

// ---------------------------------------------------------------------------
// /extend {minutes}
// ---------------------------------------------------------------------------

export const extendCommand: CommandDef = {
  name: "/extend",
  allowDuringStandup: false,
  match: (text) => text.startsWith("/extend"),
  async handle(ctx: CommandContext) {
    const m = msgs[ctx.lang];

    if (!activeDiscussion) {
      await sendChatMessage(ctx.page, m.noDiscussion);
      return;
    }

    const match = ctx.message.match(/^\/extend\s+(\d+)/i);
    const minutes = match ? parseInt(match[1], 10) : 5;

    // Clear old timers and set new ones
    clearTimeout(activeDiscussion.timer);
    if (activeDiscussion.warningTimer) clearTimeout(activeDiscussion.warningTimer);

    const newDurationMs = minutes * 60_000;
    activeDiscussion.durationMs = newDurationMs;
    activeDiscussion.startedAt = Date.now();
    setupTimers(newDurationMs);

    await sendAndSpeak(ctx.page, m.extended(minutes, activeDiscussion.topic), ctx.lang);
    console.log(`[Conversate] Extended by ${minutes} minutes.`);
  },
};

/** Check if a discussion is currently active. */
export function isDiscussionActive(): boolean {
  return activeDiscussion !== null;
}
