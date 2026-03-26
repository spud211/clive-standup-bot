import { type CommandDef, type CommandContext } from "./registry.js";
import { sendAndSpeak } from "../meeting/chat.js";
import { type Language } from "../i18n/messages.js";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// /slap {name}
// ---------------------------------------------------------------------------

const slapVariants: Record<Language, ((sender: string, target: string) => string)[]> = {
  en: [
    (s, t) => `🐟 ${s} slaps ${t} around a bit with a large trout`,
    (s, t) => `🧹 ${s} thwacks ${t} with a well-worn broom`,
    (s, t) => `🥖 ${s} gently bops ${t} with a stale baguette`,
    (s, t) => `📎 ${s} prods ${t} with a suspiciously sentient paperclip`,
    (s, t) => `🧤 ${s} challenges ${t} to a duel with a velvet glove`,
  ],
  fr: [
    (s, t) => `🐟 ${s} gifle ${t} avec une grosse truite`,
    (s, t) => `🧹 ${s} frappe ${t} avec un vieux balai`,
    (s, t) => `🥖 ${s} tapote ${t} avec une baguette rassise`,
    (s, t) => `📎 ${s} pique ${t} avec un trombone étrangement vivant`,
    (s, t) => `🧤 ${s} défie ${t} en duel avec un gant de velours`,
  ],
};

const slapSelfResponses: Record<Language, ((sender: string) => string)[]> = {
  en: [
    (s) => `🛡️ Clive deflects the blow. Nice try, ${s}.`,
    (s) => `🛡️ You'll have to do better than that, ${s}.`,
  ],
  fr: [
    (s) => `🛡️ Clive esquive le coup. Bien essayé, ${s}.`,
    (s) => `🛡️ Il va falloir faire mieux que ça, ${s}.`,
  ],
};

export const slapCommand: CommandDef = {
  name: "/slap",
  allowDuringStandup: false,
  match: (text) => text.startsWith("/slap "),
  async handle(ctx: CommandContext) {
    const target = ctx.message.replace(/^\/slap\s+/i, "").trim();
    if (!target) return;

    const isClive = target.toLowerCase().includes("clive");
    const response = isClive
      ? pick(slapSelfResponses[ctx.lang])(ctx.sender)
      : pick(slapVariants[ctx.lang])(ctx.sender, target);

    await sendAndSpeak(ctx.page, response, ctx.lang);
  },
};

// ---------------------------------------------------------------------------
// /me {action}
// ---------------------------------------------------------------------------

export const meCommand: CommandDef = {
  name: "/me",
  allowDuringStandup: true,
  match: (text) => text.startsWith("/me "),
  async handle(ctx: CommandContext) {
    const action = ctx.message.replace(/^\/me\s+/i, "").trim();
    if (!action) return;
    await sendAndSpeak(ctx.page, `✨ ${ctx.sender} ${action}`, ctx.lang);
  },
};
