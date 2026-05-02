/**
 * Video Export System — frame-accurate, real-time paced.
 *
 * Root cause of speed bug:
 *   MediaRecorder records wall-clock time from captureStream().
 *   setTimeout(0) renders frames faster than real time,
 *   so 12s of content gets recorded in ~2s of wall time → 6x speedup.
 *
 * Fix:
 *   Drive rendering with requestAnimationFrame.
 *   Each RAF callback checks if enough wall time has passed to
 *   advance to the next frame (1000/fps ms per frame).
 *   This keeps render pace locked to real time so MediaRecorder
 *   captures exactly the right duration.
 */

import { getActiveScene, getLocalTime, getCameraForGlobalTime } from "./sceneManager";
import type { SceneManager } from "./sceneManager";
import { renderFrame } from "./render";
import { createCamera, createCameraTarget, lerpCamera } from "./camera";
import type { HandState } from "./handDrawer";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExportOptions {
  fps:          number;
  width:        number;
  height:       number;
  videoBitrate: number;
}

export interface ExportProgress {
  frame:       number;
  totalFrames: number;
  percent:     number;
  timeSeconds: number;
  status:      "rendering" | "encoding" | "done" | "error";
  error?:      string;
}

export type ProgressCallback = (p: ExportProgress) => void;

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  fps:          30,
  width:        1280,
  height:       720,
  videoBitrate: 8_000_000,
};

// ── MIME type ─────────────────────────────────────────────────────────────────

function getSupportedMimeType(): string | null {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportVideo(
  manager:    SceneManager,
  hand:       HandState,
  options:    ExportOptions = DEFAULT_EXPORT_OPTIONS,
  onProgress: ProgressCallback = () => {},
): Promise<void> {

  const { fps, width, height, videoBitrate } = options;
  const { totalDuration } = manager;
  const totalFrames  = Math.ceil(totalDuration * fps);
  const msPerFrame   = 1000 / fps;   // wall-clock ms each frame must occupy

  // ── Offscreen canvas ────────────────────────────────────────────────────────
  const canvas  = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // ── MediaRecorder ───────────────────────────────────────────────────────────
  const mimeType = getSupportedMimeType();
  if (!mimeType) {
    onProgress({
      frame: 0, totalFrames, percent: 0, timeSeconds: 0,
      status: "error",
      error: "WebM MediaRecorder not supported in this browser. Try Chrome or Edge.",
    });
    return;
  }

  // captureStream(fps) tells the browser the expected frame rate.
  // MediaRecorder then records at real wall-clock speed.
  const stream   = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: videoBitrate,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  const recordingDone = new Promise<void>(resolve => {
    recorder.onstop = () => resolve();
  });

  // ── Camera state ────────────────────────────────────────────────────────────
  let camera = createCamera();
  let target = createCameraTarget();

  // ── Real-time paced render loop ─────────────────────────────────────────────
  // We use RAF so rendering stays in sync with wall-clock time.
  // frameIndex tracks which animation frame we're on.
  // We only advance frameIndex when enough real time has elapsed.

  await new Promise<void>((resolve, reject) => {
    let frameIndex    = 0;
    let rafHandle     = 0;
    let exportStart   = -1;           // wall-clock ms when export began
    let lastRenderedFrame = -1;       // avoid rendering same frame twice

    recorder.start();

    function loop(now: number) {
      try {
        // Record start time on first RAF call
        if (exportStart < 0) exportStart = now;

        const elapsed     = now - exportStart;          // ms since export started
        const targetFrame = Math.floor(elapsed / msPerFrame); // which frame should be showing now

        // Render all frames we've fallen behind on (usually just 1)
        while (frameIndex <= Math.min(targetFrame, totalFrames) && frameIndex > lastRenderedFrame) {
          const globalTime = frameIndex / fps;           // deterministic: frame → time

          const scene     = getActiveScene(manager, globalTime);
          const localTime = scene ? getLocalTime(scene, globalTime) : 0;
          const camTarget = getCameraForGlobalTime(manager, globalTime);

          // Snap camera instantly (no lerp drift across frames)
          target = { ...target, ...camTarget };
          camera = lerpCamera(camera, target);

          renderFrame(ctx, camera, scene, localTime, width, height, hand, globalTime, totalDuration);

          lastRenderedFrame = frameIndex;

          onProgress({
            frame:       frameIndex,
            totalFrames,
            percent:     Math.round((frameIndex / totalFrames) * 100),
            timeSeconds: parseFloat(globalTime.toFixed(2)),
            status:      "rendering",
          });

          frameIndex++;
        }

        if (frameIndex <= totalFrames) {
          rafHandle = requestAnimationFrame(loop);
        } else {
          // All frames rendered — stop recording
          onProgress({
            frame: totalFrames, totalFrames, percent: 100,
            timeSeconds: totalDuration, status: "encoding",
          });
          recorder.stop();
          resolve();
        }
      } catch (err) {
        cancelAnimationFrame(rafHandle);
        recorder.stop();
        reject(err);
      }
    }

    rafHandle = requestAnimationFrame(loop);
  });

  // ── Wait for final encoded chunks ────────────────────────────────────────────
  await recordingDone;

  // ── Download ─────────────────────────────────────────────────────────────────
  const blob  = new Blob(chunks, { type: mimeType });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href      = url;
  a.download  = "animation.webm";
  a.click();
  URL.revokeObjectURL(url);

  onProgress({
    frame: totalFrames, totalFrames, percent: 100,
    timeSeconds: totalDuration, status: "done",
  });
}


