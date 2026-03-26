import { type Page } from "playwright";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { selectors } from "./selectors.js";
import { AssetServer } from "./asset-server.js";

/** Shared asset server instance — started once, reused across sessions. */
let assetServer: AssetServer | null = null;

async function getAssetServer(): Promise<AssetServer> {
  if (!assetServer) {
    assetServer = new AssetServer();
    await assetServer.start();
  }
  return assetServer;
}

/**
 * Install a getUserMedia override that serves either a looping video or a
 * static image as a fake camera stream. Must be called via page.addInitScript
 * BEFORE the page navigates to Teams.
 *
 * Videos are served via a local HTTP server (no size limit).
 * Small images are base64-encoded inline.
 */
export async function installVirtualCamera(
  page: Page,
  opts: { imagePath?: string; videoPath?: string },
): Promise<void> {
  const isVideo = !!opts.videoPath;
  const assetPath = isVideo ? opts.videoPath! : opts.imagePath!;
  const absPath = resolve(assetPath);

  let avatarUrl: string;

  if (isVideo) {
    // Serve video via local HTTP — no size limit
    const server = await getAssetServer();
    server.addFile("/avatar", absPath);
    avatarUrl = server.getUrl("/avatar");
    const fileStats = await stat(absPath);
    console.log(`[VirtualCamera] Serving video (${(fileStats.size / 1024 / 1024).toFixed(1)}MB) from ${absPath}`);
  } else {
    // Small images: base64 inline
    const imageBuffer = await readFile(absPath);
    const base64 = imageBuffer.toString("base64");
    const ext = absPath.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    avatarUrl = `data:${mime};base64,${base64}`;
    console.log(`[VirtualCamera] Embedding image from ${absPath}`);
  }

  const mode = isVideo ? "video (loop)" : "static image";
  console.log(`[VirtualCamera] Installing ${mode} override`);

  await page.addInitScript(
    ({ avatarSrc, isVideoMode }: { avatarSrc: string; isVideoMode: boolean }) => {
      const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

      navigator.mediaDevices.getUserMedia = async function (
        constraints?: MediaStreamConstraints,
      ): Promise<MediaStream> {
        if (constraints?.video) {
          const stream = isVideoMode
            ? await createVideoStream(avatarSrc)
            : await createImageStream(avatarSrc);

          // If audio is also requested, get real audio and merge
          if (constraints.audio) {
            try {
              const audioStream = await origGetUserMedia({ audio: constraints.audio });
              for (const track of audioStream.getAudioTracks()) {
                stream.addTrack(track);
              }
            } catch {
              // Audio not available — that's fine
            }
          }

          return stream;
        }

        return origGetUserMedia(constraints);
      };

      /** Static image drawn to canvas at 5fps */
      async function createImageStream(src: string): Promise<MediaStream> {
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
          img.src = src;
        });

        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext("2d")!;

        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        const stream = canvas.captureStream(5);

        setInterval(() => {
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        }, 200);

        return stream;
      }

      /** Looping video drawn to canvas at 30fps */
      async function createVideoStream(src: string): Promise<MediaStream> {
        const video = document.createElement("video");
        video.src = src;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";

        await new Promise<void>((res, rej) => {
          video.onloadeddata = () => res();
          video.onerror = rej;
          video.load();
        });

        // Cap canvas at 1280x720 but preserve aspect ratio
        const maxW = 1280;
        const maxH = 720;
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 360;
        const downscale = Math.min(1, maxW / vw, maxH / vh);
        const cw = Math.round(vw * downscale);
        const ch = Math.round(vh * downscale);

        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d")!;

        const stream = canvas.captureStream(30);

        try {
          await video.play();
        } catch {
          // Autoplay might be blocked
        }

        // Draw loop — use requestVideoFrameCallback if available, else rAF
        if ("requestVideoFrameCallback" in video) {
          const drawFrame = () => {
            ctx.drawImage(video, 0, 0, cw, ch);
            (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void })
              .requestVideoFrameCallback(drawFrame);
          };
          (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void })
            .requestVideoFrameCallback(drawFrame);
        } else {
          const drawFrame = () => {
            ctx.drawImage(video, 0, 0, cw, ch);
            requestAnimationFrame(drawFrame);
          };
          requestAnimationFrame(drawFrame);
        }

        return stream;
      }
    },
    { avatarSrc: avatarUrl, isVideoMode: isVideo },
  );

  console.log(`[VirtualCamera] getUserMedia override installed (${mode}).`);
}

/**
 * Ensure the camera is ON in the Teams meeting.
 * Checks the aria-label before clicking to avoid toggling it off.
 */
export async function enableCamera(page: Page): Promise<void> {
  console.log("[VirtualCamera] Checking camera state...");
  try {
    const camBtn = page.locator(selectors.inMeetingCameraToggle);
    await camBtn.waitFor({ state: "visible", timeout: 10000 });

    const ariaLabel = ((await camBtn.getAttribute("aria-label")) ?? "").toLowerCase();
    console.log(`[VirtualCamera] Camera button aria-label: "${ariaLabel}"`);

    if (ariaLabel.includes("turn camera off")) {
      console.log("[VirtualCamera] Camera is already ON.");
    } else {
      await camBtn.click();
      console.log("[VirtualCamera] Camera was off — turned ON.");
    }
  } catch (err) {
    console.error("[VirtualCamera] Failed to check/enable camera:", err);
  }
}
