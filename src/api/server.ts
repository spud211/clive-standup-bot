import Fastify from "fastify";
import { config } from "../config.js";
import { SessionManager } from "../meeting/session.js";
import { registerRoutes } from "./routes.js";

/**
 * Start the Fastify REST API server for multi-meeting control.
 */
export async function startApiServer(): Promise<void> {
  const app = Fastify({ logger: false });
  const sessions = new SessionManager();

  registerRoutes(app, sessions);

  // Log all requests
  app.addHook("onRequest", async (request) => {
    console.log(`[API] ${request.method} ${request.url}`);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n[API] Shutting down...");
    await sessions.destroyAll();
    await app.close();
    console.log("[API] Server closed. Goodbye!");
    process.exit(0);
  });

  await app.listen({ port: config.apiPort, host: config.apiHost });
  console.log(`[API] Server listening on http://${config.apiHost}:${config.apiPort}`);
  console.log("[API] Endpoints:");
  console.log("  GET    /health");
  console.log("  POST   /sessions");
  console.log("  GET    /sessions");
  console.log("  GET    /sessions/:id");
  console.log("  DELETE /sessions/:id");
}
