/**
 * SVG Path → Canvas draw animation system.
 * VideoScribe-quality: variable speed, pressure simulation, organic feel.
 */

import { interpolateTransform } from "./transformInterpolator";
import type { TransformTracks } from "./transformInterpolator";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SvgPathObject {
  id:          string;
  groupId?:    string;       // groups paths imported together
  pathData:    string;       // raw SVG d="..." string
  x:           number;       // world-space offset
  y:           number;
  scaleX?:     number;       // default 1
  scaleY?:     number;
  strokeColor: string;
  strokeWidth: number;
  fillColor?:  string;       // fill shown after draw completes (optional)
  startTime:   number;
  duration:    number;
  easing?:     EasingFn;

  // ── VideoScribe-quality draw controls ─────────────────────────────────────
  drawOrder?:    number;     // Configurable draw order (lower = drawn first)
  handVisible?:  boolean;    // If false, hand is hidden while this object draws
  handOffsetX?:  number;     // World-unit nudge of hand tip X from path point
  handOffsetY?:  number;     // World-unit nudge of hand tip Y from path point
  startDelay?:   number;     // Extra delay (seconds) before this path begins
  subPaths?:     string[];   // Pre-split sub-paths for compound shapes (M…Z M…Z)
  opacity?:      number;     // Global opacity (0–1, default 1)
  rotation?:     number;     // Rotation in radians around object center

  // ── Per-object keyframe transform tracks ─────────────────────────────────
  // Optional — drives smooth position/scale/rotation/opacity animation
  // using the same unified keyframe engine as AnimatedObject.
  transformTracks?: TransformTracks;
}

export type HandDrawQuality = "organic" | "premiumSmooth";
export let handDrawQuality: HandDrawQuality = "organic";
export function setHandDrawQuality(q: HandDrawQuality) {
  handDrawQuality = q;
}

export type EasingFn = (t: number) => number;

export const SvgEasing = {
  linear:    (t: number) => t,
  easeIn:    (t: number) => t * t,
  easeOut:   (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  // Smoother cubic — best for drawing animations
  easeInOutCubic: (t: number) => t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2,
} as const;

// ── Compound path splitting ───────────────────────────────────────────────────

/**
 * Splits a compound path (multiple M commands separated by Z or implicit)
 * into individual sub-paths. Used for VideoScribe-style sequential sub-path drawing.
 *
 * Example: "M 0 0 L 10 0 Z M 20 0 L 30 0" → ["M 0 0 L 10 0 Z", "M 20 0 L 30 0"]
 */
export function splitCompoundPath(pathData: string): string[] {
  if (!pathData || !pathData.trim()) return [pathData];

  // Split on M/m commands that aren't the first character
  // We find each move-to that starts a new sub-path
  const parts: string[] = [];
  // Regex: split before uppercase M or lowercase m that follows at least one non-whitespace char
  const segments = pathData.split(/(?=[Mm])/).filter(s => s.trim());

  if (segments.length <= 1) return [pathData];

  // Recombine segments that are just coordinate continuations (no actual move)
  let current = "";
  for (const seg of segments) {
    if ((seg.startsWith("M") || seg.startsWith("m")) && current) {
      parts.push(current.trim());
      current = seg;
    } else {
      current += (current ? " " : "") + seg;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts.length > 1 ? parts : [pathData];
}

/**
 * Optimizes the drawing sequence of compound SVG sub-paths using a Nearest-Neighbor TSP heuristic.
 * Sorts segments to minimize visual hand teleportation.
 */
export function optimizeSubPaths(subs: string[], objId: string): string[] {
  if (subs.length <= 1) return subs;

  // Measure start and end coordinates of each sub-path segment
  const entries = subs.map((sub, idx) => {
    // Generate a temporary CachedPath to measure coordinates
    const c = getCachedPath(`tsp_temp_${objId}__sub${idx}`, sub);
    let startPt = { x: 0, y: 0 };
    let endPt = { x: 0, y: 0 };
    try {
      if (typeof document !== "undefined") {
        startPt = c.pathEl.getPointAtLength(0);
        endPt = c.pathEl.getPointAtLength(c.totalLength);
      } else {
        // High-fidelity fallback coordinate parser for headless environments
        const mMatch = sub.match(/[Mm]\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)/);
        if (mMatch) {
          startPt = { x: parseFloat(mMatch[1]), y: parseFloat(mMatch[2]) };
        }
        // Match numbers at the end of the path
        const coordsMatches = Array.from(sub.matchAll(/(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*$/g));
        if (coordsMatches.length > 0) {
          const last = coordsMatches[coordsMatches.length - 1];
          endPt = { x: parseFloat(last[1]), y: parseFloat(last[2]) };
        } else {
          const allNums = sub.match(/(-?\d+\.?\d*)/g);
          if (allNums && allNums.length >= 2) {
            endPt = {
              x: parseFloat(allNums[allNums.length - 2]),
              y: parseFloat(allNums[allNums.length - 1])
            };
          } else {
            endPt = { ...startPt };
          }
        }
        if (sub.trim().endsWith("Z") || sub.trim().endsWith("z")) {
          endPt = { ...startPt };
        }
      }
    } catch (e) {
      // Fallback if measurement fails in mock environment
    }
    return { sub, startPt, endPt };
  });

  const optimized: string[] = [];
  const visited = new Set<number>();

  // Find the segment that starts closest to the top-left (0,0) as the starting point
  let currentIdx = 0;
  let minVal = Infinity;
  for (let i = 0; i < entries.length; i++) {
    const val = entries[i].startPt.x + entries[i].startPt.y;
    if (val < minVal) {
      minVal = val;
      currentIdx = i;
    }
  }

  optimized.push(entries[currentIdx].sub);
  visited.add(currentIdx);

  while (optimized.length < entries.length) {
    let nextIdx = -1;
    let minDist = Infinity;
    const currentEnd = entries[currentIdx].endPt;

    for (let i = 0; i < entries.length; i++) {
      if (visited.has(i)) continue;
      const targetStart = entries[i].startPt;
      const dx = targetStart.x - currentEnd.x;
      const dy = targetStart.y - currentEnd.y;
      const dist = Math.max(0.001, Math.hypot(dx, dy));
      if (dist < minDist) {
        minDist = dist;
        nextIdx = i;
      }
    }

    if (nextIdx !== -1) {
      optimized.push(entries[nextIdx].sub);
      visited.add(nextIdx);
      currentIdx = nextIdx;
    } else {
      break;
    }
  }

  return optimized;
}

// ── Path cache ────────────────────────────────────────────────────────────────

interface CachedPath {
  path2D:      Path2D;
  totalLength: number;
  pathEl:      SVGPathElement;   // keep for point sampling
  svgEl:       SVGSVGElement;    // parent SVG element
}

const pathCache = new Map<string, CachedPath>();

/**
 * Returns (and caches) a Path2D + SVGPathElement + its total stroke length.
 * Accepts either an SvgPathObject or explicit (id, pathData) pair for sub-path caching.
 */
export function getCachedPath(obj: SvgPathObject): CachedPath;
export function getCachedPath(id: string, pathData: string): CachedPath;
export function getCachedPath(objOrId: SvgPathObject | string, pathData?: string): CachedPath {
  const id   = typeof objOrId === "string" ? objOrId : objOrId.id;
  const data = typeof objOrId === "string" ? pathData! : objOrId.pathData;
  const cacheKey = `${id}__${data}`;
  if (pathCache.has(cacheKey)) return pathCache.get(cacheKey)!;

  // Headless/Node environment safety guard
  if (typeof document === "undefined") {
    const entry = {
      path2D: {} as any,
      totalLength: Math.max(10, data.length * 0.5),
      pathEl: {
        getPointAtLength: () => ({ x: 0, y: 0 }),
        getTotalLength: () => Math.max(10, data.length * 0.5),
        setAttribute: () => {},
      } as any,
      svgEl: {
        appendChild: () => {},
      } as any
    };
    pathCache.set(cacheKey, entry);
    return entry;
  }

  const path2D = new Path2D(data);

  const svgNS = "http://www.w3.org/2000/svg";
  const svgEl = document.createElementNS(svgNS, "svg") as SVGSVGElement;
  const pathEl = document.createElementNS(svgNS, "path") as SVGPathElement;

  Object.assign(svgEl.style, {
    position: "absolute", visibility: "hidden",
    pointerEvents: "none", width: "0", height: "0", overflow: "hidden",
  });

  pathEl.setAttribute("d", data);
  svgEl.appendChild(pathEl);
  document.body.appendChild(svgEl);

  let totalLength = 0;
  try {
    totalLength = pathEl.getTotalLength();
    if (isNaN(totalLength) || totalLength <= 0) {
      totalLength = Math.max(10, data.length * 0.5);
    }
  } catch (e) {
    console.warn("Failed to get total path length, using fallback estimation:", e);
    totalLength = Math.max(10, data.length * 0.5);
  }

  const entry = { path2D, totalLength, pathEl, svgEl };
  pathCache.set(cacheKey, entry);
  return entry;
}

// ── Sub-path cache ────────────────────────────────────────────────────────────

interface SubPathCache {
  paths:        CachedPath[];   // one per sub-path
  lengths:      number[];       // raw SVG length of each sub-path
  totalLength:  number;         // sum of all sub-path lengths
  // Boundaries in [0,1] progress space (including micro-pauses)
  boundaries:   { start: number; end: number; drawEnd: number }[];
}

const subPathCache = new Map<string, SubPathCache>();
const SUB_PATH_PAUSE = 0.04; // fraction of total adjusted duration for inter-sub-path pause

function getEffectiveSubPaths(obj: SvgPathObject): string[] {
  if (obj.subPaths && obj.subPaths.length > 1) {
    return obj.subPaths;
  }
  return splitCompoundPath(obj.pathData);
}

function getSubPathCache(obj: SvgPathObject): SubPathCache {
  const cacheKey = `sub__${obj.id}__${obj.pathData}`;
  if (subPathCache.has(cacheKey)) return subPathCache.get(cacheKey)!;

  const rawSubs = getEffectiveSubPaths(obj);
  const subs = optimizeSubPaths(rawSubs, obj.id);
  const paths: CachedPath[] = [];
  const lengths: number[] = [];

  for (let i = 0; i < subs.length; i++) {
    const c = getCachedPath(`${obj.id}__sub${i}`, subs[i]);
    paths.push(c);
    lengths.push(c.totalLength);
  }

  const totalLength = lengths.reduce((s, l) => s + l, 0) || 1;
  const n = subs.length;
  // Total pause budget: n-1 pauses, each SUB_PATH_PAUSE of total
  const pauseBudget = (n - 1) * SUB_PATH_PAUSE;
  const drawBudget  = 1 - pauseBudget;

  const boundaries: { start: number; end: number; drawEnd: number }[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    const fraction = (lengths[i] / totalLength) * drawBudget;
    const start    = cursor;
    const drawEnd  = cursor + fraction;
    const end      = drawEnd + (i < n - 1 ? SUB_PATH_PAUSE : 0);
    boundaries.push({ start, drawEnd, end });
    cursor = end;
  }

  const entry: SubPathCache = { paths, lengths, totalLength, boundaries };
  subPathCache.set(cacheKey, entry);
  return entry;
}

/**
 * For a compound SVG object, map a global progress value (0→1) to:
 * - which sub-path is currently being drawn
 * - local progress within that sub-path (0→1)
 */
export function getSubPathProgress(
  obj: SvgPathObject,
  globalProgress: number
): { subIdx: number; localProgress: number; cached: CachedPath; isPause?: boolean; pauseProgress?: number; nextCached?: CachedPath } | null {
  const subs = getEffectiveSubPaths(obj);
  if (subs.length <= 1) {
    // Single path — trivial
    return { subIdx: 0, localProgress: globalProgress, cached: getCachedPath(obj) };
  }

  const sc = getSubPathCache(obj);

  for (let i = 0; i < sc.boundaries.length; i++) {
    const b = sc.boundaries[i];
    if (globalProgress >= b.start && globalProgress <= b.end) {
      if (globalProgress > b.drawEnd) {
        // We are in the pause between sub-path i and i+1
        const nextIdx = Math.min(sc.boundaries.length - 1, i + 1);
        const pauseProgress = (globalProgress - b.drawEnd) / (b.end - b.drawEnd);
        return {
          subIdx: i,
          localProgress: 1,
          cached: sc.paths[i],
          isPause: true,
          pauseProgress: Math.min(1, Math.max(0, pauseProgress)),
          nextCached: sc.paths[nextIdx],
        };
      }
      const localProgress = (globalProgress - b.start) / (b.drawEnd - b.start);
      return {
        subIdx: i,
        localProgress: Math.min(1, Math.max(0, localProgress)),
        cached: sc.paths[i],
      };
    }
  }

  const last = sc.boundaries.length - 1;
  return { subIdx: last, localProgress: 1, cached: sc.paths[last] };
}

/**
 * Get the active drawing tip point for a compound SVG at global progress.
 * Used by handDrawer for precise hand placement.
 */
export function getSvgTipAtProgress(
  obj: SvgPathObject,
  globalProgress: number
): { x: number; y: number; dx: number; dy: number } {
  const sp = getSubPathProgress(obj, globalProgress);
  if (!sp) {
    const c = getCachedPath(obj);
    const p = c.pathEl.getPointAtLength(0);
    return { x: obj.x + p.x * (obj.scaleX ?? 1), y: obj.y + p.y * (obj.scaleY ?? 1), dx: 1, dy: 0 };
  }

  const sx = obj.scaleX ?? 1;
  const sy = obj.scaleY ?? 1;

  if (sp.isPause && sp.pauseProgress !== undefined && sp.nextCached) {
    // ── LIFT TRANSITION PATH INTERPOLATOR ──
    // Organically sweep the pen in the air from end of current sub-path to start of next sub-path
    let pEnd = { x: 0, y: 0 };
    let pStart = { x: 0, y: 0 };
    try {
      if (typeof document !== "undefined") {
        pEnd = sp.cached.pathEl.getPointAtLength(sp.cached.totalLength);
        pStart = sp.nextCached.pathEl.getPointAtLength(0);
      } else {
        // Headless coordinate fallback parser
        const endSub = getEffectiveSubPaths(obj)[sp.subIdx];
        const nextSub = getEffectiveSubPaths(obj)[Math.min(getEffectiveSubPaths(obj).length - 1, sp.subIdx + 1)];
        const mMatchEnd = endSub.match(/(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)\s*$/);
        if (mMatchEnd) pEnd = { x: parseFloat(mMatchEnd[1]), y: parseFloat(mMatchEnd[2]) };
        const mMatchStart = nextSub.match(/[Mm]\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)/);
        if (mMatchStart) pStart = { x: parseFloat(mMatchStart[1]), y: parseFloat(mMatchStart[2]) };
      }
    } catch (e) {
      // Fallback
    }

    const t = sp.pauseProgress;
    const easedT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const targetX = pEnd.x + (pStart.x - pEnd.x) * easedT;
    const targetY = pEnd.y + (pStart.y - pEnd.y) * easedT;

    const airLiftMax = 15; // arc upward height
    const lift = Math.sin(easedT * Math.PI) * airLiftMax;

    return {
      x: obj.x + targetX * sx + lift * 0.3,
      y: obj.y + targetY * sy - lift,
      dx: (pStart.x - pEnd.x) * sx,
      dy: (pStart.y - pEnd.y) * sy,
    };
  }

  const { cached, localProgress } = sp;
  const len   = cached.totalLength * Math.min(1, Math.max(0, localProgress));
  const p1    = cached.pathEl.getPointAtLength(len);
  const p2    = cached.pathEl.getPointAtLength(Math.min(len + 2, cached.totalLength));

  const sx = obj.scaleX ?? 1;
  const sy = obj.scaleY ?? 1;

  return {
    x:  obj.x + p1.x * sx,
    y:  obj.y + p1.y * sy,
    dx: (p2.x - p1.x) * sx,
    dy: (p2.y - p1.y) * sy,
  };
}

// ── Curvature map cache ───────────────────────────────────────────────────────

interface SpeedMap {
  cumulativeAdjusted: Float64Array;
  totalAdjusted:      number;
  sampleCount:        number;
}

const speedMapCache = new Map<string, SpeedMap>();
const SPEED_SAMPLES = 200;

function getSpeedMap(pathEl: SVGPathElement, totalLength: number, cacheKey: string): SpeedMap {
  if (speedMapCache.has(cacheKey)) return speedMapCache.get(cacheKey)!;

  const N = SPEED_SAMPLES;
  const cumulativeAdjusted = new Float64Array(N + 1);
  cumulativeAdjusted[0] = 0;

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const pt = pathEl.getPointAtLength((i / N) * totalLength);
    points.push({ x: pt.x, y: pt.y });
  }

  for (let i = 1; i <= N; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);

    let curvature = 0;
    if (i >= 2) {
      const pp = points[i - 2];
      const angle1 = Math.atan2(prev.y - pp.y, prev.x - pp.x);
      const angle2 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      let dAngle = Math.abs(angle2 - angle1);
      if (dAngle > Math.PI) dAngle = 2 * Math.PI - dAngle;
      curvature = Math.min(1, dAngle / Math.PI);
    }

    const speedMult = 0.3 + (1 - curvature) * 1.2;
    const adjustedSeg = segLen / speedMult;
    cumulativeAdjusted[i] = cumulativeAdjusted[i - 1] + adjustedSeg;
  }

  const totalAdjusted = cumulativeAdjusted[N];
  const entry: SpeedMap = { cumulativeAdjusted, totalAdjusted, sampleCount: N };
  speedMapCache.set(cacheKey, entry);
  return entry;
}

function applyVariableSpeed(uniformProgress: number, speedMap: SpeedMap): number {
  const { cumulativeAdjusted, totalAdjusted, sampleCount } = speedMap;
  const targetAdjusted = uniformProgress * totalAdjusted;

  let lo = 0;
  let hi = sampleCount;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cumulativeAdjusted[mid] < targetAdjusted) lo = mid + 1;
    else hi = mid;
  }

  if (lo === 0) return 0;
  if (lo >= sampleCount) return 1;

  const segStart = cumulativeAdjusted[lo - 1];
  const segEnd   = cumulativeAdjusted[lo];
  const segFrac  = (segEnd - segStart) > 0
    ? (targetAdjusted - segStart) / (segEnd - segStart)
    : 0;

  return ((lo - 1) + segFrac) / sampleCount;
}

// ── Progress helper ───────────────────────────────────────────────────────────

export function getSvgProgress(obj: SvgPathObject, currentTime: number): number | null {
  const effectiveStart = obj.startTime + (obj.startDelay ?? 0);
  if (currentTime < effectiveStart) return null;
  if (currentTime > effectiveStart + obj.duration) return 1;
  const raw = (currentTime - effectiveStart) / obj.duration;
  const t   = Math.min(1, Math.max(0, raw));

  const eased = obj.easing ? obj.easing(t) : SvgEasing.easeInOutCubic(t);

  const { pathEl, totalLength } = getCachedPath(obj);
  const smKey = `${obj.id}__${obj.pathData}`;
  const speedMap = getSpeedMap(pathEl, totalLength, smKey);
  return applyVariableSpeed(eased, speedMap);
}

// ── Seeded pseudo-random for consistent micro-imperfections ───────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ── Pressure simulation ──────────────────────────────────────────────────────

function getPressureWidth(baseWidth: number, progress: number, seed: number): number {
  const freq1 = 7.3;
  const freq2 = 13.7;
  const variation1 = Math.sin(progress * Math.PI * freq1 + seed) * 0.4;
  const variation2 = Math.sin(progress * Math.PI * freq2 + seed * 2.7) * 0.2;
  const taper = Math.min(1, progress / 0.05) * Math.min(1, (1 - progress) / 0.05);
  return Math.max(0.5, baseWidth * taper + variation1 + variation2);
}

function getAlphaColor(color: string | undefined | null, opacity: number): string {
  if (!color || typeof color !== "string") {
    return `rgba(99, 102, 241, ${opacity})`;
  }

  const trimmed = color.trim().toLowerCase();

  if (!trimmed || trimmed === "currentcolor" || trimmed === "none" || trimmed.startsWith("url")) {
    return `rgba(99, 102, 241, ${opacity})`;
  }

  if (trimmed.startsWith("#")) {
    const hex = trimmed.substring(1);
    const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, "0");
    if (hex.length === 3) {
      const r = hex[0], g = hex[1], b = hex[2];
      return `#${r}${r}${g}${g}${b}${b}${alphaHex}`;
    }
    if (hex.length === 6) return `#${hex}${alphaHex}`;
    if (hex.length === 8) return `#${hex.substring(0, 6)}${alphaHex}`;
  }

  if (trimmed.startsWith("rgb")) {
    const matches = trimmed.match(/\d+(\.\d+)?/g);
    if (matches && matches.length >= 3) {
      const r = matches[0], g = matches[1], b = matches[2];
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  }

  const namedColors: Record<string, string> = {
    black: "0,0,0", white: "255,255,255", red: "255,0,0",
    green: "0,255,0", blue: "0,0,255", yellow: "255,255,0",
    orange: "255,165,0", purple: "128,0,128", gray: "128,128,128", grey: "128,128,128",
  };
  if (namedColors[trimmed]) return `rgba(${namedColors[trimmed]}, ${opacity})`;

  return color;
}

// ── Core draw function ────────────────────────────────────────────────────────

/**
 * Draw one SvgPathObject with organic, hand-drawn quality.
 * Supports compound paths (sub-paths drawn sequentially with natural pauses).
 */
export function drawSvgPath(
  ctx: CanvasRenderingContext2D,
  obj: SvgPathObject,
  progress: number,   // 0 = nothing drawn, 1 = fully drawn
  currentTime?: number
): void {
  if (progress <= 0) return;

  ctx.save();

  let cx = obj.x;
  let cy = obj.y;
  let scaleX = obj.scaleX ?? 1;
  let scaleY = obj.scaleY ?? 1;
  let opacity = obj.opacity ?? 1;
  let rotation = obj.rotation ?? 0;

  if (obj.transformTracks && currentTime !== undefined) {
    const localT = currentTime - obj.startTime;
    const tf = interpolateTransform(obj.transformTracks, localT);
    if (tf.x !== null) cx = tf.x;
    if (tf.y !== null) cy = tf.y;
    scaleX *= tf.scaleX;
    scaleY *= tf.scaleY;
    opacity *= tf.opacity;
    rotation += tf.rotation;
  }

  if (opacity !== 1) ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

  if (rotation !== 0) {
    const pivotX = cx + scaleX * 50;
    const pivotY = cy + scaleY * 50;
    ctx.translate(pivotX, pivotY);
    ctx.rotate(rotation);
    ctx.translate(-pivotX, -pivotY);
  }

  ctx.translate(cx, cy);
  ctx.scale(scaleX, scaleY);

  const subs = getEffectiveSubPaths(obj);
  const hasSubs = subs.length > 1;

  if (hasSubs) {
    _drawCompoundPath(ctx, obj, progress);
  } else {
    _drawSinglePath(ctx, obj, progress, obj.pathData, getCachedPath(obj));
  }

  ctx.restore();
}

/** Draw a single-path object */
function _drawSinglePath(
  ctx: CanvasRenderingContext2D,
  obj: SvgPathObject,
  progress: number,
  pathData: string,
  cached: CachedPath
): void {
  const { pathEl, totalLength } = cached;

  if (progress >= 1) {
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.strokeStyle = obj.strokeColor;
    ctx.lineWidth   = obj.strokeWidth;
    ctx.setLineDash([]);
    ctx.stroke(new Path2D(pathData));

    if (obj.fillColor) {
      ctx.fillStyle   = obj.fillColor;
      ctx.globalAlpha = 1;
      ctx.fill(new Path2D(pathData), "evenodd");
    }
    return;
  }

  const drawnLength = totalLength * Math.min(1, progress);
  const seed = hashCode(obj.id);
  const segCount = Math.max(10, Math.min(150, Math.floor(drawnLength / 3)));
  const segLen   = drawnLength / segCount;

  const activeStrokeColor = obj.strokeColor && obj.strokeColor !== "none" && obj.strokeColor !== "transparent"
    ? obj.strokeColor
    : (obj.fillColor && obj.fillColor !== "transparent" ? obj.fillColor : "#334155");
  const baseWidth = obj.strokeWidth > 0 ? obj.strokeWidth : 2;

  ctx.lineCap   = "round";
  ctx.lineJoin  = "round";

  for (let i = 0; i < segCount; i++) {
    const len1 = i * segLen;
    const len2 = Math.min((i + 1) * segLen, drawnLength);

    if (len2 <= 0) break;

    const pt1 = pathEl.getPointAtLength(len1);
    const pt2 = pathEl.getPointAtLength(len2);

    const segProgress = len2 / totalLength;
    const width = getPressureWidth(baseWidth, segProgress, seed);

    const jitterScale = handDrawQuality === "premiumSmooth" ? 0.04 : 0.15;
    const j1x = (seededRandom(seed + i * 3) - 0.5) * jitterScale;
    const j1y = (seededRandom(seed + i * 3 + 1) - 0.5) * jitterScale;
    const j2x = (seededRandom(seed + i * 3 + 2) - 0.5) * jitterScale;
    const j2y = (seededRandom(seed + i * 3 + 3) - 0.5) * jitterScale;

    ctx.beginPath();
    ctx.moveTo(pt1.x + j1x, pt1.y + j1y);
    ctx.lineTo(pt2.x + j2x, pt2.y + j2y);
    ctx.strokeStyle = activeStrokeColor;
    ctx.lineWidth   = width;
    ctx.stroke();
  }

  // Soft glow at drawing tip
  if (handDrawQuality !== "premiumSmooth" && progress > 0 && progress < 1) {
    const tipPt = pathEl.getPointAtLength(drawnLength);
    const gradient = ctx.createRadialGradient(
      tipPt.x, tipPt.y, 0,
      tipPt.x, tipPt.y, baseWidth * 3,
    );
    gradient.addColorStop(0, getAlphaColor(activeStrokeColor, 0.25));
    gradient.addColorStop(1, getAlphaColor(activeStrokeColor, 0.0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(tipPt.x, tipPt.y, baseWidth * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (obj.fillColor && progress > 0.85) {
    const fillAlpha = progress >= 1 ? 1 : (progress - 0.85) / 0.15;
    ctx.fillStyle   = obj.fillColor;
    ctx.globalAlpha = fillAlpha;
    ctx.fill(new Path2D(pathData), "evenodd");
    ctx.globalAlpha = 1;
  }
}

/** Draw a compound path — each sub-path reveals sequentially */
function _drawCompoundPath(
  ctx: CanvasRenderingContext2D,
  obj: SvgPathObject,
  globalProgress: number
): void {
  const sc = getSubPathCache(obj);
  const subs = getEffectiveSubPaths(obj);

  for (let i = 0; i < sc.paths.length; i++) {
    const b = sc.boundaries[i];
    if (globalProgress < b.start) break;

    let localProg: number;
    if (globalProgress >= b.drawEnd) {
      localProg = 1;
    } else {
      localProg = (globalProgress - b.start) / (b.drawEnd - b.start);
    }

    _drawSinglePath(
      ctx,
      { ...obj, id: `${obj.id}__sub${i}` },
      Math.min(1, Math.max(0, localProg)),
      subs[i],
      sc.paths[i]
    );
  }

  // Fill — fade in once the last sub-path is near completion
  if (obj.fillColor) {
    const lastB = sc.boundaries[sc.boundaries.length - 1];
    const fillStartThreshold = lastB.start + (lastB.drawEnd - lastB.start) * 0.85;
    if (globalProgress > fillStartThreshold) {
      const fillAlpha = globalProgress >= 1
        ? 1
        : Math.min(1, (globalProgress - fillStartThreshold) / 0.15);
      ctx.fillStyle   = obj.fillColor;
      ctx.globalAlpha = fillAlpha;
      ctx.fill(new Path2D(obj.pathData), "evenodd");
      ctx.globalAlpha = 1;
    }
  }
}

// ── Simple string hash for stable randomness ─────────────────────────────────

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash;
}

// ── Batch draw (called from render loop) ─────────────────────────────────────

export function drawAllSvgPaths(
  ctx: CanvasRenderingContext2D,
  objects: SvgPathObject[],
  currentTime: number
): void {
  // Sort by drawOrder (lower = drawn first), fall back to startTime order
  const sorted = [...objects].sort((a, b) => {
    const oa = a.drawOrder ?? a.startTime * 1000;
    const ob = b.drawOrder ?? b.startTime * 1000;
    return oa - ob;
  });

  for (const obj of sorted) {
    try {
      const progress = getSvgProgress(obj, currentTime);
      if (progress === null) continue;
      drawSvgPath(ctx, obj, progress, currentTime);
    } catch (err) {
      console.warn("[svgPath] Failed to process or draw SVG path:", obj.id, err);
    }
  }
}

// ── Path-length utilities (used by asset import + hand cursor) ────────────────

/**
 * Compute ideal draw duration based on path length.
 * Longer paths take more time, clamped to a sane range.
 */
export function getPathDrawDuration(pathData: string): number {
  try {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg   = document.createElementNS(svgNS, "svg");
    const path  = document.createElementNS(svgNS, "path");
    svg.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    document.body.appendChild(svg);
    const len = path.getTotalLength();
    document.body.removeChild(svg);
    if (isNaN(len) || len <= 0) return 1.5;
    // Organic whiteboard drawing pace: length / 350, capped at a premium 6.5s limit
    return Math.min(6.5, Math.max(1.0, len / 350));
  } catch (e) {
    console.warn("Failed to measure path length for duration:", e);
    return Math.min(6.5, Math.max(1.0, pathData.length * 0.008));
  }
}

/**
 * Get the world-space point at the current draw tip (for hand cursor).
 */
export function getPathTipPoint(
  obj: SvgPathObject,
  progress: number
): { x: number; y: number } | null {
  if (progress <= 0 || progress >= 1) return null;
  try {
    const tip = getSvgTipAtProgress(obj, progress);
    return { x: tip.x, y: tip.y };
  } catch {
    return null;
  }
}
