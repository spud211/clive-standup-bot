import { type CommandDef, type CommandContext } from "./registry.js";
import { sendAndSpeak, sendChatMessage } from "../meeting/chat.js";
import { type Language } from "../i18n/messages.js";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

// ---------------------------------------------------------------------------
// /timer {minutes} {label}
// ---------------------------------------------------------------------------

interface ActiveTimer {
  label: string;
  timeout: ReturnType<typeof setTimeout>;
  warningTimeout?: ReturnType<typeof setTimeout>;
}

const activeTimers: ActiveTimer[] = [];

export const timerCommand: CommandDef = {
  name: "/timer",
  allowDuringStandup: true,
  speakResponse: false,
  match: (text) => text.startsWith("/timer"),
  async handle(ctx: CommandContext) {
    const args = ctx.message.replace(/^\/timer\s*/i, "").trim();

    if (args.toLowerCase() === "cancel") {
      if (activeTimers.length === 0) {
        await ctx.respond("⏱️ No active timers to cancel.");
        return;
      }
      const count = activeTimers.length;
      for (const t of activeTimers) {
        clearTimeout(t.timeout);
        if (t.warningTimeout) clearTimeout(t.warningTimeout);
      }
      activeTimers.length = 0;
      await ctx.respond(`⏱️ Cancelled ${count} timer(s).`);
      return;
    }

    const match = args.match(/^(\d+)\s*(.*)?$/);
    if (!match) {
      await ctx.respond("⏱️ Usage: /timer {minutes} {label}");
      return;
    }

    const minutes = parseInt(match[1], 10);
    const label = match[2]?.trim() || "timer";

    if (minutes < 1 || minutes > 120) {
      await ctx.respond("⏱️ Timer must be between 1 and 120 minutes.");
      return;
    }

    await ctx.respond(`⏱️ Timer set: ${minutes} minute${minutes > 1 ? "s" : ""} — ${label}`);

    const timer: ActiveTimer = {
      label,
      timeout: setTimeout(async () => {
        // Timer expiry is spoken aloud to get attention
        await sendAndSpeak(ctx.page, `⏱️ Time's up! ${label} is over.`, ctx.lang);
        const idx = activeTimers.indexOf(timer);
        if (idx >= 0) activeTimers.splice(idx, 1);
        console.log(`[Timer] "${label}" completed.`);
      }, minutes * 60_000),
    };

    // Warning at 2 minutes remaining if timer is > 3 minutes
    if (minutes > 3) {
      timer.warningTimeout = setTimeout(async () => {
        await sendChatMessage(ctx.page, `⏱️ 2 minutes left on ${label}.`);
      }, (minutes - 2) * 60_000);
    }

    activeTimers.push(timer);
    console.log(`[Timer] "${label}" set for ${minutes} minutes.`);
  },
};

// ---------------------------------------------------------------------------
// /poll {question} | {option1} | {option2} | ...
// ---------------------------------------------------------------------------

interface ActivePoll {
  question: string;
  options: string[];
  votes: Map<string, number>; // sender → option index
}

let activePoll: ActivePoll | null = null;

export const pollCommand: CommandDef = {
  name: "/poll",
  allowDuringStandup: false,
  speakResponse: false,
  match: (text) => text.startsWith("/poll"),
  async handle(ctx: CommandContext) {
    const args = ctx.message.replace(/^\/poll\s*/i, "").trim().toLowerCase();

    if (args === "results") {
      if (!activePoll) {
        await ctx.respond("📊 No active poll.");
        return;
      }
      await ctx.respond(formatPollResults(activePoll, false));
      return;
    }

    if (args === "close") {
      if (!activePoll) {
        await ctx.respond("📊 No active poll to close.");
        return;
      }
      await ctx.respond(formatPollResults(activePoll, true));
      activePoll = null;
      return;
    }

    // Parse new poll: /poll Question | Option1 | Option2
    const rawArgs = ctx.message.replace(/^\/poll\s*/i, "").trim();
    const parts = rawArgs.split("|").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) {
      await ctx.respond("📊 Usage: /poll Question | Option1 | Option2 | ...");
      return;
    }

    const question = parts[0];
    const options = parts.slice(1);

    if (options.length > 10) {
      await ctx.respond("📊 Maximum 10 options per poll.");
      return;
    }

    activePoll = { question, options, votes: new Map() };

    const lines = [`📊 **Poll: ${question}**`];
    options.forEach((opt, i) => {
      lines.push(`${numberEmojis[i]} ${opt}`);
    });
    lines.push("Reply with the number to vote!");

    await ctx.respond(lines.join("\n"));
    console.log(`[Poll] Started: "${question}" with ${options.length} options.`);
  },
};

/** Command to capture vote numbers (1-10) when a poll is active. */
export const pollVoteCommand: CommandDef = {
  name: "poll-vote",
  allowDuringStandup: false,
  speakResponse: false,
  match: (text) => {
    if (!activePoll) return false;
    const num = parseInt(text.trim(), 10);
    return num >= 1 && num <= (activePoll?.options.length ?? 0);
  },
  async handle(ctx: CommandContext) {
    if (!activePoll) return;
    const num = parseInt(ctx.message.trim(), 10);
    const prev = activePoll.votes.get(ctx.sender);
    activePoll.votes.set(ctx.sender, num - 1);
    if (prev !== undefined) {
      console.log(`[Poll] ${ctx.sender} changed vote from ${prev + 1} to ${num}`);
    } else {
      console.log(`[Poll] ${ctx.sender} voted ${num}`);
    }
    await ctx.respond(`📊 ${ctx.sender} voted for ${activePoll.options[num - 1]}.`);
  },
};

function formatPollResults(poll: ActivePoll, isFinal: boolean): string {
  const tally = new Array<number>(poll.options.length).fill(0);
  for (const idx of poll.votes.values()) {
    tally[idx]++;
  }
  const total = poll.votes.size;
  const header = isFinal ? `📊 **Final results: ${poll.question}**` : `📊 **Results: ${poll.question}**`;
  const lines = [header];
  poll.options.forEach((opt, i) => {
    const bar = "█".repeat(tally[i]) || "░";
    lines.push(`${numberEmojis[i]} ${opt}: ${tally[i]} vote${tally[i] !== 1 ? "s" : ""} ${bar}`);
  });
  lines.push(`Total: ${total} vote${total !== 1 ? "s" : ""}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// /quote
// ---------------------------------------------------------------------------

const quotes = [
  "The only way to do great work is to love what you do. — Steve Jobs",
  "It works on my machine. — Every developer ever",
  "There are only two hard things in computer science: cache invalidation, naming things, and off-by-one errors.",
  "A meeting is an event where minutes are kept and hours are lost.",
  "Talk is cheap. Show me the code. — Linus Torvalds",
  "First, solve the problem. Then, write the code. — John Johnson",
  "Any fool can write code that a computer can understand. Good programmers write code that humans can understand. — Martin Fowler",
  "Give a man a program, frustrate him for a day. Teach a man to program, frustrate him for a lifetime.",
  "99 little bugs in the code. 99 little bugs. Take one down, patch it around. 127 little bugs in the code.",
  "It's not a bug — it's an undocumented feature.",
  "The best thing about a boolean is even if you are wrong, you are only off by a bit.",
  "Weeks of coding can save you hours of planning.",
  "In theory, there is no difference between theory and practice. But, in practice, there is. — Jan L. A. van de Snepscheut",
  "A good programmer is someone who always looks both ways before crossing a one-way street. — Doug Linder",
  "Debugging is twice as hard as writing the code in the first place. — Brian Kernighan",
  "Software and cathedrals are much the same — first we build them, then we pray.",
  "The best error message is the one that never shows up. — Thomas Fuchs",
  "I don't always test my code, but when I do, I do it in production.",
  "To err is human, but to really foul things up you need a computer. — Paul R. Ehrlich",
  "Measuring programming progress by lines of code is like measuring aircraft building progress by weight. — Bill Gates",
];

export const quoteCommand: CommandDef = {
  name: "/quote",
  allowDuringStandup: false,
  speakResponse: false,
  match: (text) => text === "/quote",
  async handle(ctx: CommandContext) {
    await ctx.respond(`💬 ${pick(quotes)}`);
  },
};

// ---------------------------------------------------------------------------
// /8ball {question}
// ---------------------------------------------------------------------------

const eightBallResponses = [
  "It is certain.",
  "It is decidedly so.",
  "Without a doubt.",
  "Yes — definitely.",
  "You may rely on it.",
  "As I see it, yes.",
  "Most likely.",
  "Outlook good.",
  "Yes.",
  "Signs point to yes.",
  "Reply hazy, try again.",
  "Ask again later.",
  "Better not tell you now.",
  "Cannot predict now.",
  "Concentrate and ask again.",
  "Don't count on it.",
  "My reply is no.",
  "My sources say no.",
  "Outlook not so good.",
  "Very doubtful.",
];

export const eightBallCommand: CommandDef = {
  name: "/8ball",
  allowDuringStandup: false,
  speakResponse: false,
  match: (text) => text.startsWith("/8ball"),
  async handle(ctx: CommandContext) {
    await ctx.respond(`🎱 ${pick(eightBallResponses)}`);
  },
};

// ---------------------------------------------------------------------------
// /flip
// ---------------------------------------------------------------------------

export const flipCommand: CommandDef = {
  name: "/flip",
  allowDuringStandup: true,
  speakResponse: false,
  match: (text) => text === "/flip",
  async handle(ctx: CommandContext) {
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    await ctx.respond(`🪙 ${result}!`);
  },
};

// ---------------------------------------------------------------------------
// /help
// ---------------------------------------------------------------------------

const helpText: Record<Language, string> = {
  en: [
    "📋 **Available Commands:**",
    "**/slap {name}** — IRC classic trout slap",
    "**/me {action}** — express yourself",
    "**/timer {minutes} {label}** — set a countdown timer",
    "**/timer cancel** — cancel all timers",
    "**/poll {question} | {opt1} | {opt2}** — start a poll",
    "**/poll results** — show current poll results",
    "**/poll close** — close and show final results",
    "**/quote** — random dev quote",
    "**/8ball {question}** — ask the magic 8-ball",
    "**/flip** — flip a coin",
    "**/conversate {topic}** — open discussion mode",
    "**/help** — this message",
  ].join("\n"),
  fr: [
    "📋 **Commandes disponibles :**",
    "**/slap {nom}** — la claque à la truite IRC",
    "**/me {action}** — exprimez-vous",
    "**/timer {minutes} {label}** — lancer un minuteur",
    "**/timer cancel** — annuler tous les minuteurs",
    "**/poll {question} | {opt1} | {opt2}** — lancer un sondage",
    "**/poll results** — résultats actuels du sondage",
    "**/poll close** — fermer et afficher les résultats",
    "**/quote** — citation dev aléatoire",
    "**/8ball {question}** — la boule magique",
    "**/flip** — pile ou face",
    "**/conversate {sujet}** — mode discussion ouverte",
    "**/help** — ce message",
  ].join("\n"),
};

export const helpCommand: CommandDef = {
  name: "/help",
  allowDuringStandup: true,
  speakResponse: false,
  match: (text) => text === "/help",
  async handle(ctx: CommandContext) {
    await ctx.respond(helpText[ctx.lang]);
  },
};
