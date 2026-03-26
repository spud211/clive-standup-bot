import { type Page } from "playwright";
import { type Language } from "../i18n/messages.js";
import { sendChatMessage, sendAndSpeak } from "../meeting/chat.js";

/** Context passed to every command handler. */
export interface CommandContext {
  sender: string;
  message: string;
  page: Page;
  lang: Language;
  /** Send a response — routed to chat-only or chat+TTS based on speakResponse flag. */
  respond: (text: string) => Promise<void>;
}

/** A registered command definition. */
export interface CommandDef {
  /** Human-readable name for logging. */
  name: string;
  /** Return true if this command matches the message. */
  match: (text: string, lang: Language) => boolean;
  /** Handle the command. Use ctx.respond() for output. */
  handle: (ctx: CommandContext) => Promise<void>;
  /** If true, the command fires even during an active standup. */
  allowDuringStandup: boolean;
  /** If true, responses are spoken via TTS. Most commands should be false (chat-only). */
  speakResponse: boolean;
}

/**
 * Central registry for chat commands.
 * Commands are checked in registration order — first match wins.
 */
export class CommandRegistry {
  private commands: CommandDef[] = [];

  register(cmd: CommandDef): void {
    this.commands.push(cmd);
    console.log(`[CommandRegistry] Registered: ${cmd.name} (duringStandup: ${cmd.allowDuringStandup})`);
  }

  /**
   * Try to match and execute a command from the given message.
   * Returns true if a command was handled, false otherwise.
   */
  async tryHandle(
    text: string,
    ctx: Omit<CommandContext, "message" | "respond">,
    standupActive: boolean,
  ): Promise<boolean> {
    const lower = text.toLowerCase().trim();

    for (const cmd of this.commands) {
      if (!cmd.match(lower, ctx.lang)) continue;

      if (standupActive && !cmd.allowDuringStandup) {
        console.log(`[Command] ${cmd.name} blocked — standup in progress.`);
        return false;
      }

      console.log(`[Command] ${cmd.name} triggered by ${ctx.sender}`);

      const respond = cmd.speakResponse
        ? (msg: string) => sendAndSpeak(ctx.page, msg, ctx.lang)
        : (msg: string) => sendChatMessage(ctx.page, msg);

      try {
        await cmd.handle({ ...ctx, message: text, respond });
      } catch (err) {
        console.error(`[Command] Error in ${cmd.name}:`, err);
      }
      return true;
    }

    return false;
  }
}
