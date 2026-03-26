import crypto from "node:crypto";
import { type Browser, type BrowserContext, type Page } from "playwright";
import { launchBrowser } from "../browser/launch.js";
import { navigateToMeeting, joinMeeting, leaveMeeting } from "../browser/teams-join.js";
import { ChatMonitor, sendAndSpeak } from "./chat.js";
import { Standup } from "./standup.js";
import { installVirtualCamera, enableCamera } from "../browser/virtual-camera.js";
import { config } from "../config.js";
import { type Language, getMessages, startTriggers, advanceTriggers } from "../i18n/messages.js";

export type SessionStatus =
  | "joining"
  | "in-lobby"
  | "in-meeting"
  | "idle"
  | "standup-active"
  | "disconnected"
  | "error";

export interface SessionInfo {
  id: string;
  meetingUrl: string;
  botName: string;
  lastSpeaker: string;
  language: Language;
  status: SessionStatus;
  createdAt: string;
}

interface ActiveSession {
  id: string;
  meetingUrl: string;
  botName: string;
  lastSpeaker: string;
  language: Language;
  status: SessionStatus;
  createdAt: Date;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  chatMonitor: ChatMonitor;
  standup: Standup;
}

/**
 * Manages multiple concurrent bot sessions, each with its own browser context.
 */
export class SessionManager {
  private sessions = new Map<string, ActiveSession>();

  /** Create a new session and start joining the meeting. */
  async create(
    meetingUrl: string,
    botName = config.botDisplayName,
    lastSpeaker = config.lastSpeakerName,
    language: Language = config.language
  ): Promise<SessionInfo> {
    const id = crypto.randomUUID();
    console.log(`[Session ${id}] Creating session for ${meetingUrl} (lang: ${language})`);

    const { browser, context } = await launchBrowser();
    const page = await context.newPage();
    const chatMonitor = new ChatMonitor(page, botName);
    const standup = new Standup(page, botName, lastSpeaker, language);

    const session: ActiveSession = {
      id,
      meetingUrl,
      botName,
      lastSpeaker,
      language,
      status: "joining",
      createdAt: new Date(),
      browser,
      context,
      page,
      chatMonitor,
      standup,
    };

    this.sessions.set(id, session);

    // Run the join flow in the background
    this.runSession(session).catch((err) => {
      console.error(`[Session ${id}] Fatal error:`, err);
      session.status = "error";
    });

    return this.toInfo(session);
  }

  /** List all sessions. */
  list(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => this.toInfo(s));
  }

  /** Get a single session by ID. */
  get(id: string): SessionInfo | undefined {
    const session = this.sessions.get(id);
    return session ? this.toInfo(session) : undefined;
  }

  /** Destroy a session: leave meeting, close browser, remove from map. */
  async destroy(id: string): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session) return false;

    console.log(`[Session ${id}] Destroying session...`);
    session.chatMonitor.stop();

    try {
      await leaveMeeting(session.page);
    } catch (err) {
      console.error(`[Session ${id}] Error leaving meeting:`, err);
    }

    await session.context.close();
    await session.browser.close();
    this.sessions.delete(id);
    console.log(`[Session ${id}] Session destroyed.`);
    return true;
  }

  /** Destroy all sessions (for graceful process shutdown). */
  async destroyAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    await Promise.all(ids.map((id) => this.destroy(id)));
  }

  get activeCount(): number {
    return this.sessions.size;
  }

  private async runSession(session: ActiveSession): Promise<void> {
    const { id, page, meetingUrl, botName, language, chatMonitor, standup } = session;
    const msg = getMessages(language);
    const starts = startTriggers[language];
    const advances = advanceTriggers[language];

    // Install virtual camera before navigation
    const hasAvatar = !!(config.avatarVideoPath || config.avatarImagePath);
    if (hasAvatar) {
      await installVirtualCamera(page, {
        videoPath: config.avatarVideoPath || undefined,
        imagePath: config.avatarImagePath || undefined,
      });
    }

    // Navigate and join
    await navigateToMeeting(page, meetingUrl);
    session.status = "in-meeting";
    console.log(`[Session ${id}] Joined meeting.`);

    await joinMeeting(page, botName);

    // Enable camera after joining
    if (hasAvatar) {
      await enableCamera(page);
    }

    // Send welcome and start monitoring
    await sendAndSpeak(page, msg.welcome, language);

    session.status = "idle";

    chatMonitor.onMessage(async (chatMsg) => {
      const lower = chatMsg.text.toLowerCase().replace(/\s+/g, " ").trim();

      if (starts.some((t) => lower.includes(t))) {
        if (standup.isRunning) {
          console.log(`[Session ${id}] Standup already running — ignoring.`);
          return;
        }
        console.log(`[Session ${id}] Standup triggered by ${chatMsg.sender}`);
        session.status = "standup-active";
        await standup.run();
        session.status = "idle";
      }

      if (standup.isRunning) {
        if (advances.some((t) => lower.includes(t))) {
          standup.advance();
        }
      }
    });

    chatMonitor.start();
  }

  private toInfo(session: ActiveSession): SessionInfo {
    return {
      id: session.id,
      meetingUrl: session.meetingUrl,
      botName: session.botName,
      lastSpeaker: session.lastSpeaker,
      language: session.language,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
    };
  }
}
