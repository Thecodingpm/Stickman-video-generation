// ── Easing ────────────────────────────────────────────────────────────────────

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

export type AnimationType = "fade" | "draw" | "move" | "scale" | "static";

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
  type:          "rect" | "circle" | "text";

  // Base world position (used for static / fade / draw)
  x:             number;
  y:             number;
  width?:        number;  // rect
  height?:       number;  // rect
  radius?:       number;  // circle
  content?:      string;  // text
  fontSize?:     number;
  fontFamily?:   string;

  fillColor?:    string;
  strokeColor?:  string;
  lineWidth?:    number;

  // Timeline
  startTime:     number;  // seconds
  duration:      number;  // seconds
  easing:        EasingName;

  // Animation
  animationType: AnimationType;
  move?:         MoveConfig;   // for "move"
  scale?:        ScaleConfig;  // for "scale"
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

/** Returns progress [0,1] of an object at currentTime, or null if not active */
export function getObjectProgress(
  obj: AnimatedObject,
  currentTime: number
): number | null {
  if (currentTime < obj.startTime) return null;
  if (currentTime > obj.startTime + obj.duration) return null;
  const raw = (currentTime - obj.startTime) / obj.duration;
  return Easing[obj.easing](Math.min(1, Math.max(0, raw)));
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
  const t    = Easing[to.easing](Math.min(1, Math.max(0, raw)));

  return {
    x:    lerp(from.x,    to.x,    t),
    y:    lerp(from.y,    to.y,    t),
    zoom: lerp(from.zoom, to.zoom, t),
  };
}
