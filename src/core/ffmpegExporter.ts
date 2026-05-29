/**
 * Export pipeline — no FFmpeg, no WASM, no CORS headaches.
 *
 * MP4  → WebCodecs VideoEncoder + mp4-muxer  (Chrome 94+, Edge 94+)
 * GIF  → gif.js web worker                   (all browsers)
 *
 * Frame capture is identical to the old pipeline:
 *   offscreen canvas → PNG blob per frame → encode
 */

import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import GIF from "gif.js";
import { getActiveScene, getLocalTime, getCameraForGlobalTime } from "./sceneManager";
import type { SceneManager } from "./sceneManager";
import { renderFrame } from "./render";
import { createCamera, createCameraTarget, lerpCamera } from "./camera";
import type { HandState } from "./handDrawer";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExportFormat = "webm" | "mp4" | "gif";

export interface FFmpegExportOptions {
  fps: number;
  width: number;
  height: number;
  format: ExportFormat;
}

export interface ExportProgress {
  stage: "capturing" | "encoding" | "done" | "error";
  frame?: number;
  totalFrames?: number;
  percent: number;
  error?: string;
}

export type ProgressCallback = (p: ExportProgress) => void;

export const DEFAULT_FFMPEG_OPTIONS: FFmpegExportOptions = {
  fps: 30,
  width: 1280,
  height: 720,
  format: "mp4",
};

// ── Shared frame renderer ─────────────────────────────────────────────────────

function makeOffscreenCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function renderAllFrames(
  manager: SceneManager,
  hand: HandState,
  options: FFmpegExportOptions,
  onProgress: ProgressCallback,
  onFrame: (canvas: HTMLCanvasElement, frameIndex: number) => Promise<void>,
): Promise<void> {
  const { fps, width, height } = options;
  const { totalDuration } = manager;
  const totalFrames = Math.ceil(totalDuration * fps);

  const canvas = makeOffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;

  let camera = createCamera();
  let target = createCameraTarget();

  for (let i = 0; i <= totalFrames; i++) {
    const globalTime = i / fps;
    const scene = getActiveScene(manager, globalTime);
    const localTime = scene ? getLocalTime(scene, globalTime) : 0;
    const camTarget = getCameraForGlobalTime(manager, globalTime);

    target = { ...target, ...camTarget };
    camera = lerpCamera(camera, target);

    renderFrame(ctx, camera, scene, localTime, width, height, hand, globalTime, totalDuration, true);

    await onFrame(canvas, i);

    onProgress({
      stage: "capturing",
      frame: i,
      totalFrames,
      percent: Math.round((i / totalFrames) * 60), // 0–60% = capture
    });

    if (i % 5 === 0) await sleep(0); // keep UI responsive
  }
}

// ── MP4 export (WebCodecs + mp4-muxer) ───────────────────────────────────────

async function exportMP4(
  manager: SceneManager,
  hand: HandState,
  options: FFmpegExportOptions,
  onProgress: ProgressCallback,
): Promise<Blob> {
  const { fps, width, height } = options;

  // mp4-muxer target — accumulates bytes in memory
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",       // H.264
      width,
      height,
    },
    fastStart: "in-memory",
  });

  // WebCodecs VideoEncoder
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw e; },
  });

  encoder.configure({
    codec: "avc1.42001f",   // H.264 Baseline
    width,
    height,
    bitrate: 8_000_000,
    framerate: fps,
  });

  await renderAllFrames(manager, hand, options, onProgress, async (canvas, i) => {
    const frame = new VideoFrame(canvas, {
      timestamp: (i / fps) * 1_000_000, // microseconds
      duration: (1 / fps) * 1_000_000,
    });
    const keyFrame = i % (fps * 2) === 0; // keyframe every 2s
    encoder.encode(frame, { keyFrame });
    frame.close();
  });

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  onProgress({ stage: "encoding", percent: 95 });

  const { buffer } = target;
  return new Blob([buffer], { type: "video/mp4" });
}

// ── GIF export (gif.js) ───────────────────────────────────────────────────────

async function exportGIF(
  manager: SceneManager,
  hand: HandState,
  options: FFmpegExportOptions,
  onProgress: ProgressCallback,
): Promise<Blob> {
  const gifFps = Math.min(options.fps, 15); // GIF looks fine at 15fps
  const gifOptions = { ...options, fps: gifFps };
  const delay = Math.round(1000 / gifFps);

  const gif = new GIF({
    workers: 4,
    quality: 4,           // 1=best, 10=worst
    workerScript: "/gif.worker.js",
    width: options.width,
    height: options.height,
    dither: "FloydSteinberg",
  });

  await renderAllFrames(manager, hand, gifOptions, onProgress, async (canvas) => {
    gif.addFrame(canvas, { delay, copy: true });
  });

  onProgress({ stage: "encoding", percent: 65 });

  // gif.js renders asynchronously in workers
  return new Promise<Blob>((resolve, reject) => {
    gif.on("progress", (p: number) => {
      onProgress({
        stage: "encoding",
        percent: 65 + Math.round(p * 30), // 65–95%
      });
    });
    gif.on("finished", (blob: Blob) => resolve(blob));
    gif.on("error", (err: Error) => reject(err));
    gif.render();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function exportWithFFmpeg(
  manager: SceneManager,
  hand: HandState,
  options: FFmpegExportOptions = DEFAULT_FFMPEG_OPTIONS,
  onProgress: ProgressCallback = () => { },
): Promise<void> {
  try {
    onProgress({ stage: "capturing", percent: 0 });

    if (options.format === "gif") {
      const blob = await exportGIF(manager, hand, options, onProgress);
      download(blob, "animation.gif");
    } else {
      const blob = await exportMP4(manager, hand, options, onProgress);
      download(blob, "animation.mp4");
    }

    onProgress({ stage: "done", percent: 100 });
  } catch (err) {
    onProgress({ stage: "error", percent: 0, error: String(err) });
    throw err;
  }
}

// No-op — kept so App.tsx doesn't need changes
export async function preloadFFmpeg(): Promise<void> { }