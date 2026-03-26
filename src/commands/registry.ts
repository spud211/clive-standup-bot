import { type Page } from "playwright";
import { type Language } from "../i18n/messages.js";

/** Context passed to every command handler. */
export interface CommandContext {
  sender: string;
  message: string;
  participants: string[];
  page: Page;
  lang: Language;
}

/** A registered command definition. */
export interface CommandDef {
  /** Human-readable name for logging. */
  name: string;
  /** Return true if this command matches the message. */
  match: (text: string, lang: Language) => boolean;
  /** Handle the command. Use sendAndSpeak from chat.ts for output. */
  handle: (ctx: CommandContext) => Promise<void>;
  /** If true, the command fires even during an active standup. */
  allowDuringStandup: boolean;
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
    ctx: Omit<CommandContext, "message">,
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
      try {
        await cmd.handle({ ...ctx, message: text });
      } catch (err) {
        console.error(`[Command] Error in ${cmd.name}:`, err);
      }
      return true;
    }

    return false;
  }
}
