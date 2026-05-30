/**
 * Hand/Pen follow animation — VideoScribe accurate.
 * Solves the hand teleportation issue using continuous paths (entrance, gaps, exits).
 * Supports organic wrist tilting, standard shape tracing, and flipped eraser sweeps.
 */

import type { SvgPathObject } from "./svgPath";
import { getSvgTipAtProgress, getSvgProgress, handDrawQuality } from "./svgPath";
import type { AnimatedObject } from "./timeline";
import { Easing } from "./timeline";
import type { Scene } from "./sceneManager";
import type { Camera } from "./camera";
import { interpolateTransform } from "./transformInterpolator";

export interface HandState {
  image:  HTMLImageElement | null;
  loaded: boolean;
  error:  boolean;
}

export function createHandState(src: string): HandState {
  const state: HandState = { image: null, loaded: false, error: false };
  const img = new Image();
  img.onload  = () => { state.image = img; state.loaded = true; };
  img.onerror = () => { state.error = true; };
  img.src = src;
  return state;
}

// ── Configuration ─────────────────────────────────────────────────────────────

const HAND_ANGLE = 0.35; // default base rotation — overridden per hand via HAND_CONFIGS.angle
const LERP = 0.25; // responsive following smoothing

// ── Hand Style Configurations ─────────────────────────────────────────────────
//
// normX / normY  — pen tip as fraction (0–1) of image width/height.
//                  Size-independent: works regardless of source PNG resolution.
// angle          — rotation (radians) to apply for this specific hand image.
//                  Each hand photo has a different natural pen tilt baked in.
//                  Positive = clockwise.
//
// How to measure normX/normY:
//   tipPixelX / imageWidth   and   tipPixelY / imageHeight

export const HAND_CONFIGS: Record<string, { normX: number; normY: number; angle: number; sizeMult?: number }> = {
  // handimg1.png  608×410   — stylus pointing lower-left, tip at ~(206,265)
  "/handimg1.png": { normX: 0.3388, normY: 0.6463, angle: 0.35              },
  // handimg2.png  608×410   — stylus pointing lower-left, tip at ~(183,152)
  "/handimg2.png": { normX: 0.3010, normY: 0.3707, angle: 0.30              },
  // hand1.png     3264×2816 — tip at bottom of very tall image
  "/hand1.png":    { normX: 0.0389, normY: 0.9510, angle: 0.40              },
  // style.png     1387×1134 — pen pointing lower-left, tip at ~(130,490)
  "/style.png":    { normX: 0.0937, normY: 0.4321, angle: 0.38              },
  // style 3.png   1536×1024 — pen tip left edge; tip pixel ~(115,430) = 42% from top
  "/style 3.png":  { normX: 0.055,  normY: 0.42,   angle: 0.28, sizeMult: 0.85 },
  // style4.png    552×452   — pen tip left side, ~60% from top
  "/style4.png":   { normX: 0.1178, normY: 0.60,   angle: 0.32              },
};

export function getHandConfig(src: string): { normX: number; normY: number; angle: number; sizeMult: number } {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const saved = window.localStorage.getItem("scribeflow-hand-calibration");
      if (saved) {
        const parsed = JSON.parse(saved);
        for (const key in parsed) {
          if (src.endsWith(key) || src.includes(key)) {
            const cfg = parsed[key];
            return {
              normX: cfg.normX,
              normY: cfg.normY,
              angle: cfg.angle,
              sizeMult: cfg.sizeMult ?? 1.0
            };
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load hand calibration override:", e);
    }
  }

  for (const key in HAND_CONFIGS) {
    if (src.endsWith(key) || src.includes(key)) {
      const cfg = HAND_CONFIGS[key];
      return { ...cfg, sizeMult: cfg.sizeMult ?? 1.0 };
    }
  }
  return { normX: 0.3388, normY: 0.6463, angle: HAND_ANGLE, sizeMult: 1.0 }; // fallback
}

/** @deprecated use getHandConfig */
export function getHandTipOffset(src: string) { return getHandConfig(src); }

// ── Easing & Helpers ──────────────────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// ── Unified Text Trajectory + Reveal Solver ───────────────────────────────────
//
// This is the single source of truth for BOTH the hand position AND the text
// reveal clip mask. They use the same math so they are always in perfect sync.
//
// How it works (VideoScribe model):
//  - Progress 0→1 maps across all lines + small inter-line "lift" gaps
//  - While drawing a line: pen X = right edge of revealed pixels, pen Y = baseline
//  - Between lines: pen lifts smoothly and sweeps to start of next line
//  - The lineReveals[] array is used by render.ts as the clip mask width per line

interface TextWrapEntry {
  cacheKey: string;
  lines: string[];
}
const textWrapCache = new Map<string, TextWrapEntry>();

/** Generate standard CSS font string for measuring/rendering text */
export function getTextFontString(obj: AnimatedObject): string {
  const style = obj.fontStyle ?? "normal";
  const weight = obj.fontWeight ?? "normal";
  const size = obj.fontSize ?? 16;
  const family = obj.fontFamily ?? "sans-serif";
  return `${style} ${weight} ${size}px ${family}`;
}

/** Wraps text into lines exactly matching the render pipeline */
export function getTextDrawLines(
  ctx: CanvasRenderingContext2D,
  obj: AnimatedObject
): string[] {
  const content = obj.content ?? "";
  const wrapWidth = obj.textWrapWidth ?? 0;
  const fontStr = getTextFontString(obj);
  const cacheKey = `${content}||${fontStr}||${wrapWidth}`;
  const cached = textWrapCache.get(obj.id);

  if (cached && cached.cacheKey === cacheKey) return cached.lines;

  ctx.save();
  ctx.font = fontStr;

  const lines: string[] = [];
  if (wrapWidth <= 0) {
    ctx.restore();
    const split = content.split("\n");
    textWrapCache.set(obj.id, { cacheKey, lines: split });
    return split;
  }

  for (const para of content.split("\n")) {
    const words = para.split(" ");
    let line = "";

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;

      if (ctx.measureText(test).width > wrapWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }

  ctx.restore();
  textWrapCache.set(obj.id, { cacheKey, lines });
  return lines;
}

/** Get standard exit duration for an animated object */
export function getObjectExitDuration(obj: AnimatedObject): number {
  if (!obj.duration) return 0;
  return obj.exit ? Math.min(obj.exit.duration, obj.duration * 0.9) : 0;
}

/** Get duration of the active drawing phase (excludes exit transition time) */
export function getObjectDrawDuration(obj: AnimatedObject): number {
  const exitDur = getObjectExitDuration(obj);
  return Math.max(0.01, obj.duration - exitDur);
}

/** Get draw-phase progress (0 to 1) for the active sketch effect */
export function getObjectDrawProgress(obj: AnimatedObject, localTime: number): number {
  const drawDur = getObjectDrawDuration(obj);
  return Math.min(1, Math.max(0, (localTime - obj.startTime) / drawDur));
}

export interface TextSolvedState {
  pen: { x: number; y: number; dx: number; dy: number };
  lineReveals: number[];
}

export function solveTextProgress(
  ctx: CanvasRenderingContext2D,
  content: string,
  progress: number,
  fontSize: number,
  lineH: number,
  objX: number,
  objY: number
): TextSolvedState {
  const lines   = content.split("\n");
  const widths  = lines.map(line => ctx.measureText(line).width);

  // Small time budget between lines for the pen to lift and move back
  const LINE_GAP   = fontSize * 2.5;
  const totalLen   = widths.reduce((s, w) => s + w, 0) + Math.max(0, lines.length - 1) * LINE_GAP;
  const currentLen = Math.min(1, Math.max(0, progress)) * totalLen;

  const baseline   = fontSize * 0.55; // center Y around writing path
  // Smooth, elegant cursive-style sweeps instead of high-frequency vibration
  const WOBBLE_AMP  = fontSize * 0.16; // subtle, realistic height (~32% total letter height)
  const WOBBLE_FREQ = 2 * Math.PI / (fontSize * 1.5); // sweeps gently once every 2-3 letters

  const lineReveals: number[] = widths.map(() => 0);
  let penX = objX;
  let penY = objY + baseline;
  let dx   = 1;
  let dy   = 0;
  let solved = false;
  let accumulated = 0;

  for (let i = 0; i < lines.length; i++) {
    const w = widths[i];

    // ── Phase A: drawing line i ──────────────────────────────────────────────
    if (currentLen <= accumulated + w) {
      const rawRevealPx = Math.max(0, currentLen - accumulated);

      // Simulate a highly organic, rhythmic "write-and-jump" handwriting cadence
      const charWidth = fontSize * 0.44;
      const charIdx = Math.floor(rawRevealPx / charWidth);
      const charFrac = (rawRevealPx % charWidth) / charWidth;
      // Cubic step-like easing: pen lingers over the letter body and dashes quickly to the next
      const easedFrac = charFrac < 0.5 ? 4 * charFrac * charFrac * charFrac : 1 - Math.pow(-2 * charFrac + 2, 3) / 2;
      const revealPx = Math.min(w, (charIdx + easedFrac) * charWidth);

      // All previous lines fully revealed
      for (let j = 0; j < i; j++) lineReveals[j] = widths[j];
      lineReveals[i] = revealPx;

      // Pen tip = right edge of revealed text on this line, + wobble
      penX = objX + revealPx;
      penY = objY + i * lineH + baseline + Math.sin(revealPx * WOBBLE_FREQ) * WOBBLE_AMP;
      // tangent direction for wrist angle
      dx   = 1;
      dy   = Math.cos(revealPx * WOBBLE_FREQ) * WOBBLE_AMP * WOBBLE_FREQ;

      solved = true;
      break;
    }

    lineReveals[i] = w;
    accumulated   += w;

    // ── Phase B: lifting pen and sweeping to next line ───────────────────────
    if (i < lines.length - 1) {
      if (currentLen <= accumulated + LINE_GAP) {
        const gapFrac = (currentLen - accumulated) / LINE_GAP;
        const t       = easeInOutCubic(gapFrac);

        // All lines up to and including i are fully drawn
        for (let j = 0; j <= i; j++) lineReveals[j] = widths[j];

        const sx = objX + w;            // end of line i
        const sy = objY + i * lineH + baseline;
        const ex = objX;               // start of line i+1
        const ey = objY + (i + 1) * lineH + baseline;

        // Bell-curve lift: pen rises then falls as it sweeps to next line
        const lift = Math.sin(t * Math.PI) * fontSize * 0.6;

        penX = sx + (ex - sx) * t;
        penY = sy + (ey - sy) * t - lift;
        dx   = ex - sx;
        dy   = ey - sy;

        solved = true;
        break;
      }
      accumulated += LINE_GAP;
    }
  }

  // Fallback: everything fully drawn
  if (!solved) {
    for (let j = 0; j < lines.length; j++) lineReveals[j] = widths[j];
    const li = lines.length - 1;
    penX = objX + widths[li];
    penY = objY + li * lineH + baseline;
  }

  return { pen: { x: penX, y: penY, dx, dy }, lineReveals };
}

// ── Coordinate Solvers for Standard Shapes ─────────────────────────────────────

export function getRectPathPoint(
  obj: AnimatedObject,
  progress: number
): { x: number; y: number; dx: number; dy: number } {
  const w = obj.width ?? 100;
  const h = obj.height ?? 60;
  const perimeter = 2 * (w + h);
  const len = Math.min(1, Math.max(0, progress)) * perimeter;
  let x = obj.x;
  let y = obj.y;
  let dx = 1;
  let dy = 0;

  if (len <= w) {
    x = obj.x + len;
    y = obj.y;
    dx = 1;
    dy = 0;
  } else if (len <= w + h) {
    x = obj.x + w;
    y = obj.y + (len - w);
    dx = 0;
    dy = 1;
  } else if (len <= 2 * w + h) {
    x = obj.x + w - (len - (w + h));
    y = obj.y + h;
    dx = -1;
    dy = 0;
  } else {
    x = obj.x;
    y = obj.y + h - (len - (2 * w + h));
    dx = 0;
    dy = -1;
  }
  return { x, y, dx, dy };
}

export function getCirclePathPoint(
  obj: AnimatedObject,
  progress: number
): { x: number; y: number; dx: number; dy: number } {
  const r = obj.radius ?? 40;
  const theta = -Math.PI / 2 + Math.min(1, Math.max(0, progress)) * 2 * Math.PI;
  const x = obj.x + r * Math.cos(theta);
  const y = obj.y + r * Math.sin(theta);
  const dx = -Math.sin(theta);
  const dy = Math.cos(theta);
  return { x, y, dx, dy };
}

export function getImageRevealPoint(
  obj: AnimatedObject,
  progress: number
): { x: number; y: number; dx: number; dy: number } {
  const w = obj.width ?? 160;
  const h = obj.height ?? 120;
  const p = Math.min(1, Math.max(0, progress));

  // Small organic vertical wobble to make the horizontal wipe look natural and hand-drawn
  const wobbleAmp = h * 0.05;
  const freq = 4 * Math.PI; // 2 waves across width
  const wobble = Math.sin(p * freq) * wobbleAmp;
  const dy = Math.cos(p * freq) * wobbleAmp * freq / w;

  return {
    x: obj.x + w * p,
    y: obj.y + h * 0.5 + wobble,
    dx: 1,
    dy,
  };
}

export function getTextPathPoint(
  ctx: CanvasRenderingContext2D,
  obj: AnimatedObject,
  progress: number
): { x: number; y: number; dx: number; dy: number } {
  const fontSize   = obj.fontSize   ?? 16;
  const lineH = fontSize * 1.4;
  ctx.save();
  ctx.font = getTextFontString(obj);

  const lines = getTextDrawLines(ctx, obj);
  const solved = solveTextProgress(ctx, lines.join("\n"), progress, fontSize, lineH, obj.x, obj.y);
  ctx.restore();

  return solved.pen;
}

// ── Chronological Drawing Sequencer ───────────────────────────────────────────

export interface SceneDrawElement {
  id: string;
  type: "svg" | "rect" | "circle" | "text" | "image";
  startTime: number;
  duration: number;
  endTime: number;
  raw: SvgPathObject | AnimatedObject;
  isErase?: boolean;
}

export function getSortedDrawElements(_ctx: CanvasRenderingContext2D, scene: Scene): SceneDrawElement[] {
  const list: SceneDrawElement[] = [];

  // SVG paths (always drawn)
  if (scene.svgObjects) {
    for (const svg of scene.svgObjects) {
      list.push({
        id: svg.id,
        type: "svg",
        startTime: svg.startTime,
        duration: svg.duration,
        endTime: svg.startTime + svg.duration,
        raw: svg,
      });
    }
  }

  // Standard shapes (if animationType is "draw")
  if (scene.objects) {
    for (const obj of scene.objects) {
      const drawDur = getObjectDrawDuration(obj);
      const exitDur = obj.duration - drawDur;

      if (obj.animationType === "draw") {
        list.push({
          id: `${obj.id}-draw`,
          type: obj.type as any,
          startTime: obj.startTime,
          duration: drawDur,
          endTime: obj.startTime + drawDur,
          raw: obj,
        });
      }

      // Add erasing phase if exit animation sweeps
      if (obj.exit && obj.exit.type !== "none" && exitDur > 0) {
        list.push({
          id: `${obj.id}-erase`,
          type: obj.type as any,
          startTime: obj.startTime + drawDur,
          duration: exitDur,
          endTime: obj.startTime + obj.duration,
          raw: obj,
          isErase: true,
        });
      }
    }
  }

  return list.sort((a, b) => a.startTime - b.startTime);
}

// ── SVG Path Sampler ──────────────────────────────────────────────────────────

/**
 * Get the world-space pen tip position for an SVG object at a given progress.
 * Handles both simple and compound (multi-sub-path) SVG objects.
 * Respects handOffsetX/Y for fine-tuning tip alignment per object.
 */
function getTipWorldPos(obj: SvgPathObject, progress: number): { x: number; y: number; dx: number; dy: number; isPause?: boolean } {
  const tip = getSvgTipAtProgress(obj, progress);
  return {
    x:  tip.x + (obj.handOffsetX ?? 0),
    y:  tip.y + (obj.handOffsetY ?? 0),
    dx: tip.dx,
    dy: tip.dy,
    isPause: tip.isPause,
  };
}

// ── Eraser Zigzag Scrubbing Solver ────────────────────────────────────────────

function getEraserPoint(
  ctx: CanvasRenderingContext2D,
  obj: AnimatedObject,
  progress: number
): { x: number; y: number; dx: number; dy: number } {
  let w = 120;
  let h = 80;
  let cx = obj.x;
  let cy = obj.y;

  if (obj.type === "rect") {
    w = obj.width ?? 100;
    h = obj.height ?? 60;
    cx = obj.x + w / 2;
    cy = obj.y + h / 2;
  } else if (obj.type === "circle") {
    const r = obj.radius ?? 40;
    w = r * 2;
    h = r * 2;
    cx = obj.x;
    cy = obj.y;
  } else if (obj.type === "text") {
    const fontSize   = obj.fontSize   ?? 16;
    const fontFamily = obj.fontFamily ?? "sans-serif";
    const fontWeight = (obj as any).fontWeight ?? "normal";
    const fontStyle  = (obj as any).fontStyle  ?? "normal";
    ctx.save();
    // Must match the actual render font so measureText gives correct line widths
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    const lines = (obj.content ?? "").split("\n");
    const maxW = Math.max(...lines.map(l => ctx.measureText(l).width), 50);
    h = lines.length * fontSize * 1.4;
    w = maxW;
    cx = obj.x + w / 2;
    cy = obj.y + h / 2;
    ctx.restore();
  }

  // Rapid zigzag sweep back and forth horizontally, moving top to bottom
  const freqX = 14;
  const sweepW = w * 1.15;
  const sweepX = Math.sin(progress * Math.PI * freqX) * (sweepW / 2);
  const sweepY = -h / 2 + progress * h;

  const dx = Math.cos(progress * Math.PI * freqX) * (sweepW / 2) * (freqX * Math.PI);
  const dy = h;

  return {
    x: cx + sweepX,
    y: cy + sweepY,
    dx,
    dy,
  };
}

// ── Main Smooth Position Tracker ──────────────────────────────────────────────

let lastHandPos = { x: 0, y: 0 };
let lastHandAngle = HAND_ANGLE;
let activeLerpFactor = 0.5; // Smooth gear shifting tracking coefficient
let lastSceneId: string | null = null;
let lastLocalTime = 0;

// ── Helper to apply object-level keyframe transform to hand coordinates ────────
function applyTransformToPoint(
  pt: { x: number; y: number; dx: number; dy: number },
  obj: AnimatedObject | SvgPathObject,
  localT: number
): { x: number; y: number; dx: number; dy: number } {
  if (!obj.transformTracks) return pt;
  const tf = interpolateTransform(obj.transformTracks, localT);

  // Calculate pivot point
  let pivotX = obj.x;
  let pivotY = obj.y;

  let w = 0, h = 0;
  if ("type" in obj && obj.type === "rect") {
    const rect = obj as AnimatedObject;
    w = rect.width ?? 100;
    h = rect.height ?? 60;
    pivotX = obj.x + w / 2;
    pivotY = obj.y + h / 2;
  } else if ("type" in obj && obj.type === "circle") {
    pivotX = obj.x;
    pivotY = obj.y;
  } else if (!("type" in obj) || (obj as any).type === "svg") {
    const svg = obj as SvgPathObject;
    const sx = svg.scaleX ?? 1;
    const sy = svg.scaleY ?? 1;
    pivotX = obj.x + sx * 50;
    pivotY = obj.y + sy * 50;
  }

  // 1. Shift by translation (override obj.x / obj.y if tf.x / tf.y not null)
  let newPtX = pt.x;
  let newPtY = pt.y;

  let shiftX = 0;
  let shiftY = 0;
  if (tf.x !== null) {
    shiftX = tf.x - obj.x;
    pivotX += shiftX;
    newPtX += shiftX;
  }
  if (tf.y !== null) {
    shiftY = tf.y - obj.y;
    pivotY += shiftY;
    newPtY += shiftY;
  }

  // 2. Scale relative to pivot
  if (tf.scaleX !== 1 || tf.scaleY !== 1) {
    newPtX = pivotX + (newPtX - pivotX) * tf.scaleX;
    newPtY = pivotY + (newPtY - pivotY) * tf.scaleY;
  }

  // 3. Rotate relative to pivot
  if (tf.rotation !== 0) {
    const cos = Math.cos(tf.rotation);
    const sin = Math.sin(tf.rotation);
    const rx = newPtX - pivotX;
    const ry = newPtY - pivotY;
    newPtX = pivotX + (rx * cos - ry * sin);
    newPtY = pivotY + (rx * sin + ry * cos);

    // Rotate the tangent vector dx/dy too!
    const rdx = pt.dx * cos - pt.dy * sin;
    const rdy = pt.dx * sin + pt.dy * cos;
    return { x: newPtX, y: newPtY, dx: rdx, dy: rdy };
  }

  return { x: newPtX, y: newPtY, dx: pt.dx, dy: pt.dy };
}

// ── Unified Hand Drawing Engine ────────────────────────────────────────────────
export function drawUnifiedHand(
  ctx:         CanvasRenderingContext2D,
  scene:       Scene | null,
  localTime:   number,
  hand:        HandState,
  cameraZoom:  number,
  W:           number,
  H:           number,
  camera:      Camera,
): void {
  if (!hand.loaded || !hand.image || !scene) return;

  // ── HAND STATE RESET TRIGGERS ──
  // Resets tracking position instantly when scene changes or localTime jumps (e.g. timeline scrubbing/looping)
  const sceneId = scene.id;
  const timeJump = Math.abs(localTime - lastLocalTime);

  if (
    sceneId !== lastSceneId ||
    localTime < lastLocalTime ||
    timeJump > 0.5
  ) {
    lastHandPos = { x: 0, y: 0 };
    lastHandAngle = HAND_ANGLE;
    activeLerpFactor = 0.5;
  }

  lastSceneId = sceneId;
  lastLocalTime = localTime;

  const elements = getSortedDrawElements(ctx, scene);
  if (elements.length === 0) return;

  // Offscreen bottom-right resting position in world units (screen-consistent)
  const halfW = W / 2 / cameraZoom;
  const halfH = H / 2 / cameraZoom;
  const HAND_SCREEN_SIZE = 280;
  const handOffset = HAND_SCREEN_SIZE / cameraZoom;
  const offscreenPos = {
    x: camera.x + halfW + handOffset,
    y: camera.y + halfH + handOffset,
  };

  let targetX = offscreenPos.x;
  let targetY = offscreenPos.y;
  let strokeAngle = 0;
  let visible = true;
  let isEraser = false;
  let activeDrawing = false;
  let isText = false;
  let liftOffset = { x: 0, y: 0 };

  const first = elements[0];
  const last = elements[elements.length - 1];

  // 1. Offscreen Entrance Phase
  if (localTime < first.startTime) {
    const entranceDur = Math.min(0.6, first.startTime);
    const entranceStart = first.startTime - entranceDur;

    if (localTime < entranceStart) {
      visible = false;
    } else {
      const progress = easeInOutCubic((localTime - entranceStart) / entranceDur);
      // Sample start of first element
      let startPoint = { x: 0, y: 0, dx: 1, dy: 0 };
      if (first.type === "svg") startPoint = getTipWorldPos(first.raw as SvgPathObject, 0);
      else if (first.type === "image") startPoint = getImageRevealPoint(first.raw as AnimatedObject, 0);
      else if (first.type === "rect") startPoint = getRectPathPoint(first.raw as AnimatedObject, 0);
      else if (first.type === "circle") startPoint = getCirclePathPoint(first.raw as AnimatedObject, 0);
      else if (first.type === "text") startPoint = getTextPathPoint(ctx, first.raw as AnimatedObject, 0);

      startPoint = applyTransformToPoint(startPoint, first.raw, 0);

      targetX = lerp(offscreenPos.x, startPoint.x, progress);
      targetY = lerp(offscreenPos.y, startPoint.y, progress);
      strokeAngle = Math.atan2(startPoint.y - offscreenPos.y, startPoint.x - offscreenPos.x);
    }
  }
  // 2. Offscreen Exit Phase
  else if (localTime > last.endTime) {
    const exitDur = Math.min(0.6, scene.duration - last.endTime);
    const exitEnd = last.endTime + exitDur;

    if (localTime > exitEnd) {
      visible = false;
    } else {
      const progress = easeInOutCubic((localTime - last.endTime) / exitDur);
      // Sample end of last element
      let endPoint = { x: 0, y: 0, dx: 1, dy: 0 };
      if (last.isErase) endPoint = getEraserPoint(ctx, last.raw as AnimatedObject, 1);
      else if (last.type === "svg") endPoint = getTipWorldPos(last.raw as SvgPathObject, 1);
      else if (last.type === "image") endPoint = getImageRevealPoint(last.raw as AnimatedObject, 1);
      else if (last.type === "rect") endPoint = getRectPathPoint(last.raw as AnimatedObject, 1);
      else if (last.type === "circle") endPoint = getCirclePathPoint(last.raw as AnimatedObject, 1);
      else if (last.type === "text") endPoint = getTextPathPoint(ctx, last.raw as AnimatedObject, 1);

      endPoint = applyTransformToPoint(endPoint, last.raw, last.duration);

      targetX = lerp(endPoint.x, offscreenPos.x, progress);
      targetY = lerp(endPoint.y, offscreenPos.y, progress);
      strokeAngle = Math.atan2(offscreenPos.y - endPoint.y, offscreenPos.x - endPoint.x);
    }
  }
  // 3. Active Drawing / Erasing / Travel Gaps
  else {
    // Find if we are currently drawing an element
    let activeIdx = -1;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (localTime >= el.startTime && localTime <= el.endTime) {
        activeIdx = i;
        break;
      }
    }

    if (activeIdx !== -1) {
      activeDrawing = true;
      // ── ACTIVE DRAWING OR ERASING PHASE ──
      const el = elements[activeIdx];
      isText = el.type === "text";
      const progress = (localTime - el.startTime) / el.duration;

      // If this SVG object has handVisible=false, treat it as not active for hand display
      const isHandHidden = el.type === "svg" && (el.raw as SvgPathObject).handVisible === false;

      if (el.isErase) {
        isEraser = true;
        // Erasing phase (zig-zag scrub) uses eased entry progress
        const rawProgress = (localTime - el.startTime) / el.duration;
        const easingFn = Easing[(el.raw as AnimatedObject).easing || "easeOut"] || Easing.easeOut;
        const easedProgress = easingFn(Math.min(1, Math.max(0, rawProgress)));
        let pt = getEraserPoint(ctx, el.raw as AnimatedObject, easedProgress);
        pt = applyTransformToPoint(pt, el.raw, localTime - el.startTime);
        targetX = pt.x;
        targetY = pt.y;
        strokeAngle = Math.atan2(pt.dy, pt.dx);
      } else if (isHandHidden) {
        // Hand hidden for this object: park off-screen so it glides away invisibly
        visible = false;
      } else {
        let pt: { x: number; y: number; dx: number; dy: number; isPause?: boolean } = { x: 0, y: 0, dx: 1, dy: 0, isPause: false };
        if (el.type === "svg") {
          const svgObj = el.raw as SvgPathObject;
          const svgProgress = getSvgProgress(svgObj, localTime) ?? 0;
          pt = getTipWorldPos(svgObj, svgProgress);
          if (pt.isPause) {
            activeDrawing = false; // Glide smoothly in the air using base travel LERP
          }
        } else {
          // For rect/circle/image draw animations, make hand progress match render.ts eased entry progress exactly.
          // For text, keep using raw progress (which matches render.ts).
          if (el.type === "text") {
            pt = getTextPathPoint(ctx, el.raw as AnimatedObject, progress);
          } else {
            const rawProgress = (localTime - el.startTime) / el.duration;
            const easingFn = Easing[(el.raw as AnimatedObject).easing || "easeOut"] || Easing.easeOut;
            const easedProgress = easingFn(Math.min(1, Math.max(0, rawProgress)));
            if (el.type === "image") {
              pt = getImageRevealPoint(el.raw as AnimatedObject, easedProgress);
            } else if (el.type === "rect") {
              pt = getRectPathPoint(el.raw as AnimatedObject, easedProgress);
            } else if (el.type === "circle") {
              pt = getCirclePathPoint(el.raw as AnimatedObject, easedProgress);
            }
          }
        }

        pt = applyTransformToPoint(pt, el.raw, localTime - el.startTime);
        targetX = pt.x;
        targetY = pt.y;
        strokeAngle = Math.atan2(pt.dy, pt.dx);
      }
    } else {
      // ── TRAVEL GAP PHASE ──
      // Find surrounding elements
      let prev = elements[0];
      let next = elements[0];
      for (let i = 0; i < elements.length - 1; i++) {
        if (localTime > elements[i].endTime && localTime < elements[i + 1].startTime) {
          prev = elements[i];
          next = elements[i + 1];
          break;
        }
      }

      // Previous end point
      let prevEnd = { x: 0, y: 0, dx: 1, dy: 0 };
      if (prev.isErase) prevEnd = getEraserPoint(ctx, prev.raw as AnimatedObject, 1);
      else if (prev.type === "svg") prevEnd = getTipWorldPos(prev.raw as SvgPathObject, 1);
      else if (prev.type === "image") prevEnd = getImageRevealPoint(prev.raw as AnimatedObject, 1);
      else if (prev.type === "rect") prevEnd = getRectPathPoint(prev.raw as AnimatedObject, 1);
      else if (prev.type === "circle") prevEnd = getCirclePathPoint(prev.raw as AnimatedObject, 1);
      else if (prev.type === "text") prevEnd = getTextPathPoint(ctx, prev.raw as AnimatedObject, 1);

      prevEnd = applyTransformToPoint(prevEnd, prev.raw, prev.duration);

      // Next start point
      let nextStart = { x: 0, y: 0, dx: 1, dy: 0 };
      if (next.type === "svg") nextStart = getTipWorldPos(next.raw as SvgPathObject, 0);
      else if (next.type === "image") nextStart = getImageRevealPoint(next.raw as AnimatedObject, 0);
      else if (next.type === "rect") nextStart = getRectPathPoint(next.raw as AnimatedObject, 0);
      else if (next.type === "circle") nextStart = getCirclePathPoint(next.raw as AnimatedObject, 0);
      else if (next.type === "text") nextStart = getTextPathPoint(ctx, next.raw as AnimatedObject, 0);

      nextStart = applyTransformToPoint(nextStart, next.raw, 0);

      const rawGap = next.startTime - prev.endTime;
      const dist = Math.hypot(nextStart.x - prevEnd.x, nextStart.y - prevEnd.y);

      if (rawGap < 0.15 && dist > 80) {
        // Fast transition gap with large distance: hide and snap instantly
        visible = false;
        targetX = nextStart.x;
        targetY = nextStart.y;
        strokeAngle = Math.atan2(nextStart.y - prevEnd.y, nextStart.x - prevEnd.x);
        lastHandPos = { x: nextStart.x, y: nextStart.y };
      } else {
        const gapDur = Math.max(0.01, rawGap);
        const progress = easeInOutCubic(Math.min(1, Math.max(0, (localTime - prev.endTime) / gapDur)));

        targetX = lerp(prevEnd.x, nextStart.x, progress);
        targetY = lerp(prevEnd.y, nextStart.y, progress);
        strokeAngle = Math.atan2(nextStart.y - prevEnd.y, nextStart.x - prevEnd.x);

        // Nudge hand tip up-and-right (lift offset) during travel phase
        const liftHeight = Math.sin(progress * Math.PI);
        liftOffset.x = liftHeight * (12 / cameraZoom);
        liftOffset.y = -liftHeight * (18 / cameraZoom);
      }
    }
  }

  if (!visible) {
    lastHandPos = { x: offscreenPos.x, y: offscreenPos.y };
    return;
  }

  // Nudge drawing tip forward slightly along tangent direction
  const nudge = 3;
  const h = Math.hypot(Math.cos(strokeAngle), Math.sin(strokeAngle)) || 1;
  const nudgeX = (Math.cos(strokeAngle) / h) * nudge;
  const nudgeY = (Math.sin(strokeAngle) / h) * nudge;

  const finalX = targetX + nudgeX + liftOffset.x;
  const finalY = targetY + nudgeY + liftOffset.y;

  // LERP following to smooth coordinates (high responsive snap during active drawing, smooth during transitions)
  const baseLerp = handDrawQuality === "premiumSmooth" ? 0.45 : LERP;
  
  // Custom tailored LERP factors to eliminate text jittering while keeping detail paths precise
  const drawLerp = isText
    ? (handDrawQuality === "premiumSmooth" ? 0.88 : 0.84)
    : (handDrawQuality === "premiumSmooth" ? 0.96 : 0.94);
    
  const targetLerp = activeDrawing ? drawLerp : baseLerp;
  
  // Smooth gear shifting LERP factor (interpolate activeLerpFactor to avoid visual sudden jerks)
  activeLerpFactor = activeLerpFactor + (targetLerp - activeLerpFactor) * 0.15;

  if (activeDrawing && !isText) {
    // Snap instantly during active SVG/shape drawing to prevent any visible lag behind ink lines
    lastHandPos = { x: finalX, y: finalY };
    activeLerpFactor = targetLerp; // Sync factor instantly
  } else {
    if (lastHandPos.x === 0 && lastHandPos.y === 0) {
      lastHandPos = { x: finalX, y: finalY };
    } else {
      lastHandPos.x = lastHandPos.x + (finalX - lastHandPos.x) * activeLerpFactor;
      lastHandPos.y = lastHandPos.y + (finalY - lastHandPos.y) * activeLerpFactor;
    }
  }

  // Per-hand tilt: each image has its natural pen angle baked in.
  // We use the config's angle as the base, then nudge slightly based on stroke direction.
  const handCfg = getHandConfig(hand.image.src);
  const baseAngle = isEraser ? handCfg.angle + Math.PI : handCfg.angle;
  let targetAngle = baseAngle;
  if (strokeAngle !== 0) {
    const tilt = Math.cos(strokeAngle) * 0.10 + Math.sin(strokeAngle) * 0.06;
    targetAngle = baseAngle + tilt;
  }
  lastHandAngle = lerpAngle(lastHandAngle, targetAngle, activeLerpFactor);

  // Compute draw size. sizeMult lets each hand scale independently while keeping
  // the tip anchor correct (tipX/tipY scale with drawW/drawH so alignment is preserved).
  const imgW   = hand.image.naturalWidth  || 500;
  const imgH   = hand.image.naturalHeight || 500;
  const sz     = (HAND_SCREEN_SIZE / cameraZoom) * handCfg.sizeMult;
  const drawW  = sz;
  const drawH  = sz * (imgH / imgW);

  const tipX = handCfg.normX * drawW;
  const tipY = handCfg.normY * drawH;

  ctx.save();
  ctx.translate(lastHandPos.x, lastHandPos.y);
  ctx.rotate(lastHandAngle);

  // Draw hand — the tip pixel (normX, normY) in image space lands exactly on lastHandPos
  ctx.globalAlpha = 1;
  ctx.drawImage(hand.image, -tipX, -tipY, drawW, drawH);

  ctx.restore();
}
