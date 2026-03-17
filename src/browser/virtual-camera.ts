import { type Page } from "playwright";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { selectors } from "./selectors.js";

/**
 * Install a getUserMedia override that serves a static image as a looping
 * video stream. Must be called via page.addInitScript BEFORE the page
 * navigates to Teams, so the override is in place when Teams requests
 * camera access.
 *
 * The image is embedded as a base64 data URL in the init script so it
 * doesn't need to be served over HTTP.
 */
export async function installVirtualCamera(page: Page, imagePath: string): Promise<void> {
  const absPath = resolve(imagePath);
  const imageBuffer = await readFile(absPath);
  const base64 = imageBuffer.toString("base64");

  // Detect format from extension
  const ext = absPath.split(".").pop()?.toLowerCase() ?? "png";
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  const dataUrl = `data:${mime};base64,${base64}`;

  console.log(`[VirtualCamera] Installing avatar override from ${absPath}`);

  await page.addInitScript((avatarDataUrl: string) => {
    // Override getUserMedia to inject our avatar as a video stream
    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

    navigator.mediaDevices.getUserMedia = async function (constraints?: MediaStreamConstraints): Promise<MediaStream> {
      // If video is requested, return our fake video stream
      if (constraints?.video) {
        const stream = await createAvatarStream(avatarDataUrl);

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

      // No video requested — pass through to original
      return origGetUserMedia(constraints);
    };

    async function createAvatarStream(dataUrl: string): Promise<MediaStream> {
      // Create an offscreen canvas and draw the avatar image on it
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext("2d")!;

      // Draw the image centered/scaled to fill the canvas
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width - img.width * scale) / 2;
      const y = (canvas.height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

      // Capture the canvas as a video stream at 5fps (low — it's a static image)
      const stream = canvas.captureStream(5);

      // Redraw periodically to keep the stream alive
      setInterval(() => {
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      }, 200);

      return stream;
    }
  }, dataUrl);

  console.log("[VirtualCamera] getUserMedia override installed.");
}

/**
 * Turn the camera ON in the Teams meeting by clicking the camera toggle.
 */
export async function enableCamera(page: Page): Promise<void> {
  console.log("[VirtualCamera] Enabling camera in meeting...");
  try {
    const camBtn = page.locator(selectors.inMeetingCameraToggle);
    await camBtn.waitFor({ state: "visible", timeout: 10000 });

    // Check if camera is currently off
    const ariaLabel = await camBtn.getAttribute("aria-label") ?? "";
    const isOff = ariaLabel.toLowerCase().includes("turn on") ||
                  ariaLabel.toLowerCase().includes("camera off") ||
                  ariaLabel.toLowerCase().includes("start camera");

    if (isOff) {
      await camBtn.click();
      console.log("[VirtualCamera] Camera turned ON.");
    } else {
      console.log("[VirtualCamera] Camera appears to already be ON.");
    }
  } catch (err) {
    console.error("[VirtualCamera] Failed to enable camera:", err);
  }
}
