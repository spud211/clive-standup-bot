import { type CommandDef, type CommandContext } from "./registry.js";
import { sendAndSpeak, sendChatMessage } from "../meeting/chat.js";
import { type Language } from "../i18n/messages.js";

const DEFAULT_DISCUSSION_MINUTES = 10;
const DISCUSSION_WARNING_THRESHOLD_MINUTES = 3;

interface DiscussionState {
  topic: string;
  timer: ReturnType<typeof setTimeout> | null;
  warningTimer: ReturnType<typeof setTimeout> | null;
  page: CommandContext["page"];
  lang: Language;
}

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

/**
 * Creates /conversate, /end, and /extend commands that share discussion state.
 * Each call returns fresh state — safe for multi-session use.
 */
export function createDiscussionCommands(): [CommandDef, CommandDef, CommandDef] {
  let activeDiscussion: DiscussionState | null = null;

  function clearDiscussion(): void {
    if (activeDiscussion) {
      if (activeDiscussion.timer) clearTimeout(activeDiscussion.timer);
      if (activeDiscussion.warningTimer) clearTimeout(activeDiscussion.warningTimer);
      activeDiscussion = null;
    }
  }

  function setupTimers(durationMs: number): void {
    if (!activeDiscussion) return;

    const discussion = activeDiscussion;
    const m = msgs[discussion.lang];

    // Warning at 2 minutes remaining
    if (durationMs > DISCUSSION_WARNING_THRESHOLD_MINUTES * 60_000) {
      discussion.warningTimer = setTimeout(async () => {
        try {
          await sendChatMessage(discussion.page, m.warning);
        } catch (err) {
          console.error("[Conversate] Failed to send warning:", err);
        }
      }, durationMs - 2 * 60_000);
    }

    // Time's up — spoken aloud
    discussion.timer = setTimeout(async () => {
      try {
        await sendAndSpeak(discussion.page, m.timeUp(discussion.topic), discussion.lang);
      } catch (err) {
        console.error("[Conversate] Failed to send time-up message:", err);
      }
      console.log(`[Conversate] Time's up on "${discussion.topic}".`);
    }, durationMs);
  }

  const conversateCommand: CommandDef = {
    name: "/conversate",
    allowDuringStandup: false,
    speakResponse: true,
    match: (text) => text.startsWith("/conversate ") || text.startsWith("/discuss "),
    async handle(ctx: CommandContext) {
      const m = msgs[ctx.lang];

      if (activeDiscussion) {
        await ctx.respond(m.alreadyActive(activeDiscussion.topic));
        return;
      }

      const topic = ctx.message.replace(/^\/(conversate|discuss)\s+/i, "").trim();
      if (!topic) return;

      const durationMs = DEFAULT_DISCUSSION_MINUTES * 60_000;

      activeDiscussion = {
        topic,
        timer: null,
        warningTimer: null,
        page: ctx.page,
        lang: ctx.lang,
      };

      setupTimers(durationMs);

      await ctx.respond(m.start(topic));
      console.log(`[Conversate] Started: "${topic}" (${DEFAULT_DISCUSSION_MINUTES} minutes).`);
    },
  };

  const endCommand: CommandDef = {
    name: "/end",
    allowDuringStandup: false,
    speakResponse: true,
    match: (text) => text === "/end",
    async handle(ctx: CommandContext) {
      const m = msgs[ctx.lang];

      if (!activeDiscussion) {
        await ctx.respond(m.noDiscussion);
        return;
      }

      console.log(`[Conversate] Discussion on "${activeDiscussion.topic}" closed.`);
      clearDiscussion();
      await ctx.respond(m.closed);
    },
  };

  const extendCommand: CommandDef = {
    name: "/extend",
    allowDuringStandup: false,
    speakResponse: false,
    match: (text) => text.startsWith("/extend"),
    async handle(ctx: CommandContext) {
      const m = msgs[ctx.lang];

      if (!activeDiscussion) {
        await ctx.respond(m.noDiscussion);
        return;
      }

      const match = ctx.message.match(/^\/extend\s+(\d+)/i);
      const minutes = match ? parseInt(match[1], 10) : 5;

      // Clear old timers and set new ones
      if (activeDiscussion.timer) clearTimeout(activeDiscussion.timer);
      if (activeDiscussion.warningTimer) clearTimeout(activeDiscussion.warningTimer);
      activeDiscussion.timer = null;
      activeDiscussion.warningTimer = null;

      setupTimers(minutes * 60_000);

      await ctx.respond(m.extended(minutes, activeDiscussion.topic));
      console.log(`[Conversate] Extended by ${minutes} minutes.`);
    },
  };

  return [conversateCommand, endCommand, extendCommand];
}
