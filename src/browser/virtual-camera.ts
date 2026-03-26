import { type Page } from "playwright";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { selectors } from "./selectors.js";

/**
 * Install a getUserMedia override that serves either a looping video or a
 * static image as a fake camera stream. Must be called via page.addInitScript
 * BEFORE the page navigates to Teams.
 *
 * Video takes priority over image. The asset is embedded as a base64 data URL
 * in the init script so it doesn't need to be served over HTTP.
 */
export async function installVirtualCamera(
  page: Page,
  opts: { imagePath?: string; videoPath?: string },
): Promise<void> {
  const isVideo = !!opts.videoPath;
  const assetPath = isVideo ? opts.videoPath! : opts.imagePath!;
  const absPath = resolve(assetPath);
  const assetBuffer = await readFile(absPath);
  const base64 = assetBuffer.toString("base64");

  const ext = absPath.split(".").pop()?.toLowerCase() ?? "";
  let mime: string;
  if (isVideo) {
    mime = ext === "webm" ? "video/webm" : "video/mp4";
  } else {
    mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  }
  const dataUrl = `data:${mime};base64,${base64}`;

  const mode = isVideo ? "video (loop)" : "static image";
  console.log(`[VirtualCamera] Installing ${mode} override from ${absPath}`);

  await page.addInitScript(
    ({ avatarDataUrl, isVideoMode }: { avatarDataUrl: string; isVideoMode: boolean }) => {
      const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

      navigator.mediaDevices.getUserMedia = async function (
        constraints?: MediaStreamConstraints,
      ): Promise<MediaStream> {
        if (constraints?.video) {
          const stream = isVideoMode
            ? await createVideoStream(avatarDataUrl)
            : await createImageStream(avatarDataUrl);

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
      async function createImageStream(dataUrl: string): Promise<MediaStream> {
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
          img.src = dataUrl;
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
      async function createVideoStream(dataUrl: string): Promise<MediaStream> {
        const video = document.createElement("video");
        video.src = dataUrl;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;

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

        // Start playback
        try {
          await video.play();
        } catch {
          // Autoplay might be blocked — we'll still draw frames
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
    { avatarDataUrl: dataUrl, isVideoMode: isVideo },
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
