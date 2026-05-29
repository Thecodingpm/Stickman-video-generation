/**
 * transformInterpolator.ts
 *
 * Pure, framework-agnostic keyframe interpolation engine.
 * Used by ALL object types (text, rect, circle, SVG).
 *
 * Design:
 *  - Objects store an optional `transformTracks` with a flat array of keyframes.
 *  - Each keyframe records values for any subset of the 6 animatable properties.
 *  - At render time, `interpolateTransform()` finds the surrounding pair and lerps.
 *  - Missing properties fall back to identity values (dx=0, scale=1, opacity=1, etc.).
 */

import { Easing } from "./timeline";
import type { EasingName } from "./timeline";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A single keyframe in a transform track.
 * All animated properties are optional — only specify what changes at this keyframe.
 * Time is in LOCAL object seconds (0 = object startTime, obj.duration = object end).
 */
export interface TransformKeyframe {
  id:        string;         // Unique ID (for UI drag/select)
  time:      number;         // Local time (seconds) within object lifetime

  // Animatable transform properties (all optional — undefined = "not set at this keyframe")
  x?:        number;         // World-space absolute X position override
  y?:        number;         // World-space absolute Y position override
  scaleX?:   number;         // Uniform or X scale multiplier (1 = no change)
  scaleY?:   number;         // Y scale multiplier (1 = no change)
  rotation?: number;         // Rotation in radians
  opacity?:  number;         // 0 (invisible) → 1 (fully opaque)

  easing:    EasingName;     // Easing applied FROM this keyframe TO the next
}

/**
 * Container for all keyframe tracks on one object.
 * Currently stores all tracks as a single flat list (one keyframe can set multiple props).
 * This makes it easy to add "full-state" keyframes (like After Effects) while still
 * allowing sparse per-property keyframes.
 */
export interface TransformTracks {
  keyframes: TransformKeyframe[];   // Must be sorted by time (store keeps them sorted)
}

/**
 * The resolved transform state at a specific time.
 * All fields always have values — defaults applied when keyframes don't cover a property.
 */
export interface TransformState {
  x:        number | null;   // null = use object's base x (no override)
  y:        number | null;   // null = use object's base y (no override)
  scaleX:   number;          // 1 = identity
  scaleY:   number;          // 1 = identity
  rotation: number;          // 0 = no rotation (radians)
  opacity:  number;          // 1 = fully opaque
}

/** Identity transform — no change to any property */
export const IDENTITY_TRANSFORM: TransformState = {
  x:        null,
  y:        null,
  scaleX:   1,
  scaleY:   1,
  rotation: 0,
  opacity:  1,
};

// ── Core interpolation ────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path interpolation for angles (avoids spinning the long way around) */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff >  Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

/**
 * Interpolate a single optional number property between two keyframes.
 * If only one side is defined, clamp to that side.
 * If neither is defined, return `defaultVal`.
 */
function interpProp(
  fromVal: number | undefined,
  toVal:   number | undefined,
  t:       number,
  defaultVal: number,
  isAngle  = false,
): number {
  if (fromVal === undefined && toVal === undefined) return defaultVal;
  const from = fromVal ?? defaultVal;
  const to   = toVal   ?? defaultVal;
  return isAngle ? lerpAngle(from, to, t) : lerp(from, to, t);
}

/**
 * Resolve the full transform state at `localTime` from a set of keyframe tracks.
 *
 * @param tracks   The object's transform tracks (may be undefined)
 * @param localTime  Seconds since object startTime (0 = object begins)
 * @returns A fully-resolved TransformState
 */
export function interpolateTransform(
  tracks:    TransformTracks | undefined,
  localTime: number,
): TransformState {
  if (!tracks || tracks.keyframes.length === 0) {
    return { ...IDENTITY_TRANSFORM };
  }

  const kfs = tracks.keyframes; // caller keeps sorted, but we'll be safe

  // ── Single keyframe → clamp to it ────────────────────────────────────────
  if (kfs.length === 1) {
    const kf = kfs[0];
    return {
      x:        kf.x        !== undefined ? kf.x        : null,
      y:        kf.y        !== undefined ? kf.y        : null,
      scaleX:   kf.scaleX   !== undefined ? kf.scaleX   : 1,
      scaleY:   kf.scaleY   !== undefined ? kf.scaleY   : 1,
      rotation: kf.rotation !== undefined ? kf.rotation : 0,
      opacity:  kf.opacity  !== undefined ? kf.opacity  : 1,
    };
  }

  // ── Before first keyframe ─────────────────────────────────────────────────
  if (localTime <= kfs[0].time) {
    const kf = kfs[0];
    return {
      x:        kf.x        !== undefined ? kf.x        : null,
      y:        kf.y        !== undefined ? kf.y        : null,
      scaleX:   kf.scaleX   !== undefined ? kf.scaleX   : 1,
      scaleY:   kf.scaleY   !== undefined ? kf.scaleY   : 1,
      rotation: kf.rotation !== undefined ? kf.rotation : 0,
      opacity:  kf.opacity  !== undefined ? kf.opacity  : 1,
    };
  }

  // ── After last keyframe ───────────────────────────────────────────────────
  const last = kfs[kfs.length - 1];
  if (localTime >= last.time) {
    return {
      x:        last.x        !== undefined ? last.x        : null,
      y:        last.y        !== undefined ? last.y        : null,
      scaleX:   last.scaleX   !== undefined ? last.scaleX   : 1,
      scaleY:   last.scaleY   !== undefined ? last.scaleY   : 1,
      rotation: last.rotation !== undefined ? last.rotation : 0,
      opacity:  last.opacity  !== undefined ? last.opacity  : 1,
    };
  }

  // ── Find surrounding pair ─────────────────────────────────────────────────
  let fromIdx = 0;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (localTime >= kfs[i].time && localTime < kfs[i + 1].time) {
      fromIdx = i;
      break;
    }
  }

  const from = kfs[fromIdx];
  const to   = kfs[fromIdx + 1];

  const rawT = (localTime - from.time) / (to.time - from.time);
  const t    = (Easing[to.easing] || Easing.easeInOut)(Math.min(1, Math.max(0, rawT)));

  // ── Per-property interpolation ────────────────────────────────────────────
  // For position: if either side defines x/y, interpolate; otherwise return null (use base)
  const hasX = from.x !== undefined || to.x !== undefined;
  const hasY = from.y !== undefined || to.y !== undefined;

  return {
    x:        hasX ? interpProp(from.x,        to.x,        t, 0) : null,
    y:        hasY ? interpProp(from.y,        to.y,        t, 0) : null,
    scaleX:   interpProp(from.scaleX,   to.scaleX,   t, 1),
    scaleY:   interpProp(from.scaleY,   to.scaleY,   t, 1),
    rotation: interpProp(from.rotation, to.rotation, t, 0, true),
    opacity:  interpProp(from.opacity,  to.opacity,  t, 1),
  };
}

// ── Keyframe management helpers ───────────────────────────────────────────────

const TIME_TOLERANCE = 0.005; // 5ms — "same time" threshold

/** Insert or replace a keyframe (by time, within tolerance). Keeps array sorted. */
export function upsertKeyframe(
  tracks: TransformTracks,
  kf:     TransformKeyframe,
): TransformTracks {
  const filtered = tracks.keyframes.filter(
    k => Math.abs(k.time - kf.time) > TIME_TOLERANCE
  );
  const next = [...filtered, kf].sort((a, b) => a.time - b.time);
  return { ...tracks, keyframes: next };
}

/** Remove keyframe by ID. */
export function removeKeyframeById(
  tracks: TransformTracks,
  id:     string,
): TransformTracks {
  return { ...tracks, keyframes: tracks.keyframes.filter(k => k.id !== id) };
}

/** Remove keyframe by time (within tolerance). */
export function removeKeyframeAtTime(
  tracks: TransformTracks,
  time:   number,
): TransformTracks {
  return {
    ...tracks,
    keyframes: tracks.keyframes.filter(k => Math.abs(k.time - time) > TIME_TOLERANCE),
  };
}

/** Patch a keyframe's values by ID. */
export function patchKeyframe(
  tracks: TransformTracks,
  id:     string,
  patch:  Partial<TransformKeyframe>,
): TransformTracks {
  const next = tracks.keyframes.map(k => k.id === id ? { ...k, ...patch } : k);
  // Re-sort in case time changed
  next.sort((a, b) => a.time - b.time);
  return { ...tracks, keyframes: next };
}

/** Create a new keyframe ID */
export function newKfId(): string {
  return `kf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Get the keyframe values at or nearest to a given time (for "capture current" button) */
export function getValuesAtTime(
  tracks: TransformTracks | undefined,
  localTime: number,
): Omit<TransformKeyframe, "id" | "time" | "easing"> {
  const state = interpolateTransform(tracks, localTime);
  return {
    x:        state.x        !== null ? state.x        : undefined,
    y:        state.y        !== null ? state.y        : undefined,
    scaleX:   state.scaleX   !== 1    ? state.scaleX   : undefined,
    scaleY:   state.scaleY   !== 1    ? state.scaleY   : undefined,
    rotation: state.rotation !== 0    ? state.rotation : undefined,
    opacity:  state.opacity  !== 1    ? state.opacity  : undefined,
  };
}
