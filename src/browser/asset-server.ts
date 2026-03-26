import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/**
 * Tiny local HTTP server to serve avatar assets to the Playwright browser.
 * This avoids base64-encoding large files into the init script.
 */
export class AssetServer {
  private server: Server | null = null;
  private port = 0;
  private files = new Map<string, string>(); // url path → absolute file path

  /** Register a file to be served at the given URL path. */
  addFile(urlPath: string, filePath: string): void {
    this.files.set(urlPath, resolve(filePath));
  }

  /** Start the server on a random available port. */
  async start(): Promise<number> {
    return new Promise((resolvePort, reject) => {
      this.server = createServer(async (req, res) => {
        const filePath = this.files.get(req.url ?? "");
        if (!filePath) {
          res.writeHead(404);
          res.end();
          return;
        }

        try {
          const data = await readFile(filePath);
          const ext = extname(filePath).toLowerCase();
          const mime = MIME_TYPES[ext] ?? "application/octet-stream";
          const fileStats = await stat(filePath);

          res.writeHead(200, {
            "Content-Type": mime,
            "Content-Length": fileStats.size,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
          });
          res.end(data);
        } catch {
          res.writeHead(500);
          res.end();
        }
      });

      this.server.on("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server!.address();
        if (typeof addr === "object" && addr) {
          this.port = addr.port;
          console.log(`[AssetServer] Serving on http://127.0.0.1:${this.port}`);
          resolvePort(this.port);
        }
      });
    });
  }

  /** Get the full URL for a registered file. */
  getUrl(urlPath: string): string {
    return `http://127.0.0.1:${this.port}${urlPath}`;
  }

  /** Stop the server. */
  async stop(): Promise<void> {
    return new Promise((res) => {
      if (this.server) {
        this.server.close(() => res());
      } else {
        res();
      }
    });
  }
}
