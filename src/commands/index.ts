import { type CommandRegistry } from "./registry.js";
import { slapCommand, meCommand } from "./irc.js";
import { greetingCommand, thanksCommand } from "./banter.js";
import {
  timerCommand,
  pollCommand,
  pollVoteCommand,
  quoteCommand,
  eightBallCommand,
  flipCommand,
  helpCommand,
} from "./fun.js";

/**
 * Register all commands with the given registry.
 * Add new commands here — this is the single place to browse all available commands.
 */
export function registerAllCommands(registry: CommandRegistry): void {
  // IRC classics (Story 2.5.2)
  registry.register(slapCommand);
  registry.register(meCommand);

  // Greetings & banter (Story 2.5.3)
  registry.register(greetingCommand);
  registry.register(thanksCommand);

  // Fun commands (Story 2.5.4)
  registry.register(timerCommand);
  registry.register(pollCommand);
  registry.register(pollVoteCommand);
  registry.register(quoteCommand);
  registry.register(eightBallCommand);
  registry.register(flipCommand);
  registry.register(helpCommand);
}
