// ── Easing ────────────────────────────────────────────────────────────────────

import type { TransformTracks } from "./transformInterpolator";

export type EasingFn = (t: number) => number;

export const Easing = {
  linear:    (t: number) => t,
  easeIn:    (t: number) => t * t,
  easeOut:   (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  spring:    (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
} as const;

export type EasingName = keyof typeof Easing;

// ── Animation types ───────────────────────────────────────────────────────────

export type AnimationType = "fade" | "draw" | "move" | "scale" | "static" | "slideLeft" | "slideRight" | "slideUp" | "slideDown";

export type ExitType  = "fade" | "slideLeft" | "slideRight" | "slideUp" | "slideDown" | "none";
export type EntryType = "fade" | "draw" | "scale" | "slideLeft" | "slideRight" | "slideUp" | "slideDown" | "static";

export interface ExitConfig {
  type:     ExitType;
  duration: number;      // seconds — carved from END of object duration
  easing:   EasingName;
}

export interface MoveConfig {
  fromX: number;
  fromY: number;
  toX:   number;
  toY:   number;
}

export interface ScaleConfig {
  from: number;
  to:   number;
}

// ── Animated world object ─────────────────────────────────────────────────────

export interface AnimatedObject {
  id:            string;
  type:          "rect" | "circle" | "text" | "image";

  // Base world position (used for static / fade / draw)
  x:             number;
  y:             number;
  width?:        number;  // rect
  height?:       number;  // rect
  radius?:       number;  // circle
  content?:      string;  // text
  src?:          string;  // image source url
  fontSize?:     number;
  fontFamily?:   string;
  fontWeight?:   "normal" | "bold";        // text
  fontStyle?:    "normal" | "italic";      // text
  textAlign?:    "left" | "center" | "right"; // text
  textWrapWidth?: number;                  // text wrap (px, world units)
  strokeText?:   boolean;                  // text outline

  fillColor?:    string;
  strokeColor?:  string;
  lineWidth?:    number;

  // Timeline
  startTime:     number;  // seconds
  duration:      number;  // seconds
  easing?:       EasingName;

  // Animation
  animationType: AnimationType;
  move?:         MoveConfig;   // for "move"
  scale?:        ScaleConfig;  // for "scale"
  exit?:         ExitConfig;

  // ── Per-object keyframe transform tracks ─────────────────────────────────
  // Optional — when present, drives smooth position/scale/rotation/opacity
  // animation on top of the existing entry/exit animation system.
  transformTracks?: TransformTracks;
}

// ── Camera keyframe ───────────────────────────────────────────────────────────

export interface CameraKeyframe {
  time:   number;
  x:      number;
  y:      number;
  zoom:   number;
  easing: EasingName;
}

// ── Timeline state ────────────────────────────────────────────────────────────

export interface TimelineState {
  currentTime:      number;
  totalDuration:    number;
  isPlaying:        boolean;
  objects:          AnimatedObject[];
  cameraKeyframes:  CameraKeyframe[];
}

// ── Interpolation helpers ─────────────────────────────────────────────────────

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface ObjectRenderState {
  phase:    "before" | "entry" | "hold" | "exit" | "after";
  progress: number;   // 0-1 within current phase
  alpha:    number;   // final computed alpha (entry/exit handle this)
  entryProgress: number; // 0-1 of entry phase (for draw/scale/slide)
  exitProgress:  number; // 0-1 of exit phase
}

export function getObjectRenderState(
  obj: AnimatedObject,
  currentTime: number,
): ObjectRenderState | null {
  const start = obj.startTime;
  const end   = start + obj.duration;

  // Outside lifetime entirely
  if (currentTime < start || currentTime > end) return null;



  // Entry duration = full object duration (legacy behaviour)
  // BUT if exit exists, entry = duration - exit.duration (clamped)
  const exitDur  = obj.exit ? Math.min(obj.exit.duration, obj.duration * 0.9) : 0;
  const rawEntry = obj.duration - exitDur;
  const actualEntryDur = Math.max(0.01, rawEntry);

  const localT = currentTime - start;

  // ── Exit phase ──
  if (exitDur > 0 && localT >= actualEntryDur) {
    const exitT    = localT - actualEntryDur;
    const exitRaw  = Math.min(1, exitT / exitDur);
    const exitEase = obj.exit ? (Easing[obj.exit.easing] || Easing.easeOut)(exitRaw) : exitRaw;
    return {
      phase:         "exit",
      progress:      exitEase,
      alpha:         1 - exitEase,   // 1→0 during exit
      entryProgress: 1,
      exitProgress:  exitEase,
    };
  }

  // ── Entry phase ──
  const entryRaw  = Math.min(1, localT / actualEntryDur);
  const entryEase = (Easing[obj.easing || "easeOut"] || Easing.easeOut)(entryRaw);

  return {
    phase:         entryRaw < 1 ? "entry" : "hold",
    progress:      entryEase,
    alpha:         entryEase,
    entryProgress: entryEase,
    exitProgress:  0,
  };
}

// Keep getObjectProgress for backward compat (used by existing scenes)
export function getObjectProgress(
  obj: AnimatedObject,
  currentTime: number,
): number | null {
  const state = getObjectRenderState(obj, currentTime);
  if (!state) return null;
  return state.progress;
}

/** Interpolate camera position from keyframes at currentTime */
export function getCameraAtTime(
  keyframes: CameraKeyframe[],
  currentTime: number
): { x: number; y: number; zoom: number } {
  if (keyframes.length === 0) return { x: 0, y: 0, zoom: 1 };
  if (keyframes.length === 1) return keyframes[0];

  // Sort once (caller should keep sorted, but be safe)
  const kf = [...keyframes].sort((a, b) => a.time - b.time);

  // Before first keyframe
  if (currentTime <= kf[0].time) return { x: kf[0].x, y: kf[0].y, zoom: kf[0].zoom };

  // After last keyframe
  const last = kf[kf.length - 1];
  if (currentTime >= last.time) return { x: last.x, y: last.y, zoom: last.zoom };

  // Find surrounding pair
  let fromIdx = 0;
  for (let i = 0; i < kf.length - 1; i++) {
    if (currentTime >= kf[i].time && currentTime < kf[i + 1].time) {
      fromIdx = i;
      break;
    }
  }

  const from = kf[fromIdx];
  const to   = kf[fromIdx + 1];
  const raw  = (currentTime - from.time) / (to.time - from.time);
  const t    = (Easing[to.easing] || Easing.easeInOut)(Math.min(1, Math.max(0, raw)));

  return {
    x:    lerp(from.x,    to.x,    t),
    y:    lerp(from.y,    to.y,    t),
    zoom: lerp(from.zoom, to.zoom, t),
  };
}
