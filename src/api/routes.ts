import { type FastifyInstance } from "fastify";
import { SessionManager } from "../meeting/session.js";
import { type Language } from "../i18n/messages.js";

interface CreateSessionBody {
  meetingUrl: string;
  botName?: string;
  lastSpeaker?: string;
  language?: Language;
}

export function registerRoutes(app: FastifyInstance, sessions: SessionManager): void {
  // Health check
  app.get("/health", async () => {
    return { status: "ok", activeSessions: sessions.activeCount };
  });

  // Create session (join a meeting)
  app.post<{ Body: CreateSessionBody }>("/sessions", async (request, reply) => {
    const { meetingUrl, botName, lastSpeaker, language } = request.body ?? {};

    if (!meetingUrl || typeof meetingUrl !== "string") {
      return reply.status(400).send({ error: "meetingUrl is required" });
    }

    try {
      new URL(meetingUrl);
    } catch {
      return reply.status(400).send({ error: "meetingUrl must be a valid URL" });
    }

    if (language && language !== "en" && language !== "fr") {
      return reply.status(400).send({ error: "language must be 'en' or 'fr'" });
    }

    console.log(`[API] POST /sessions — meetingUrl: ${meetingUrl}, lang: ${language ?? "default"}`);
    const session = await sessions.create(meetingUrl, botName, lastSpeaker, language);
    return reply.status(201).send(session);
  });

  // List all sessions
  app.get("/sessions", async () => {
    console.log("[API] GET /sessions");
    return sessions.list();
  });

  // Get single session
  app.get<{ Params: { id: string } }>("/sessions/:id", async (request, reply) => {
    const { id } = request.params;
    console.log(`[API] GET /sessions/${id}`);
    const session = sessions.get(id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return session;
  });

  // Delete session (leave meeting)
  app.delete<{ Params: { id: string } }>("/sessions/:id", async (request, reply) => {
    const { id } = request.params;
    console.log(`[API] DELETE /sessions/${id}`);
    const destroyed = await sessions.destroy(id);
    if (!destroyed) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return { status: "destroyed", id };
  });
}
