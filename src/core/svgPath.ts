/**
 * SVG Path -> Canvas draw animation system.
 * VideoScribe-quality: variable speed, pressure simulation, organic feel.
 */

import { interpolateTransform } from "./transformInterpolator";
import type { TransformTracks } from "./transformInterpolator";

export interface SvgPathObject {
  id: string;
  groupId?: string;
  pathData: string;
  x: number;
  y: number;
  scaleX?: number;
  scaleY?: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
  startTime: number;
  duration: number;
  easing?: EasingFn;

  drawOrder?: number;
  handVisible?: boolean;
  handOffsetX?: number;
  handOffsetY?: number;
  startDelay?: number;
  subPaths?: string[];
  opacity?: number;
  rotation?: number;
  transformTracks?: TransformTracks;

  // "stroke" = real path sketch, "fill" = brush fill reveal, "image" = mask-style reveal
  drawMode?: "stroke" | "fill" | "image";
}

export type HandDrawQuality = "organic" | "premiumSmooth";
export let handDrawQuality: HandDrawQuality = "organic";
export function setHandDrawQuality(q: HandDrawQuality) {
  handDrawQuality = q;
}

export type EasingFn = (t: number) => number;

export const SvgEasing = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
} as const;

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CachedPath {
  path2D: Path2D;
  totalLength: number;
  pathEl: SVGPathElement;
  svgEl: SVGSVGElement;
  bounds: Bounds;
}

interface SubPathCache {
  subs: string[];
  paths: CachedPath[];
  lengths: number[];
  totalLength: number;
  boundaries: { start: number; end: number; drawEnd: number }[];
}

interface SpeedMap {
  cumulativeAdjusted: Float64Array;
  totalAdjusted: number;
  sampleCount: number;
}

const pathCache = new Map<string, CachedPath>();
const subPathCache = new Map<string, SubPathCache>();
const speedMapCache = new Map<string, SpeedMap>();
const SPEED_SAMPLES = 200;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function isDrawableColor(color: string | undefined | null): boolean {
  if (!color) return false;
  const c = color.trim().toLowerCase();
  return !!c && c !== "none" && c !== "transparent" && !c.startsWith("url(");
}

function hasDrawableStroke(obj: SvgPathObject): boolean {
  return isDrawableColor(obj.strokeColor) && (obj.strokeWidth ?? 0) > 0;
}

export function getSvgDrawMode(obj: SvgPathObject): "stroke" | "fill" | "image" {
  if (obj.drawMode) return obj.drawMode;
  if (!hasDrawableStroke(obj) && isDrawableColor(obj.fillColor)) return "fill";
  return "stroke";
}

function getActiveStrokeColor(obj: SvgPathObject): string {
  if (isDrawableColor(obj.strokeColor)) return obj.strokeColor;
  if (isDrawableColor(obj.fillColor)) return obj.fillColor!;
  return "#334155";
}

function makeBounds(x: number, y: number, width: number, height: number): Bounds {
  return {
    x,
    y,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function samplePathBounds(pathEl: SVGPathElement, totalLength: number): Bounds {
  if (!Number.isFinite(totalLength) || totalLength <= 0) return makeBounds(0, 0, 1, 1);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const samples = 96;

  for (let i = 0; i <= samples; i++) {
    const p = pathEl.getPointAtLength((i / samples) * totalLength);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  if (!Number.isFinite(minX)) return makeBounds(0, 0, 1, 1);
  return makeBounds(minX, minY, maxX - minX, maxY - minY);
}

function getPathBounds(pathEl: SVGPathElement, totalLength: number): Bounds {
  try {
    const b = pathEl.getBBox();
    if (b && Number.isFinite(b.x) && Number.isFinite(b.y)) {
      return makeBounds(b.x, b.y, b.width, b.height);
    }
  } catch {
    // Fall through to sampling.
  }
  return samplePathBounds(pathEl, totalLength);
}

export function splitCompoundPath(pathData: string): string[] {
  if (!pathData || !pathData.trim()) return [pathData];

  const parts: string[] = [];
  const segments = pathData.split(/(?=[Mm])/).filter((s) => s.trim());

  if (segments.length <= 1) return [pathData];

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

export function optimizeSubPaths(subs: string[], objId: string): string[] {
  if (subs.length <= 1) return subs;

  const entries = subs.map((sub, idx) => {
    const c = getCachedPath(`tsp_temp_${objId}__sub${idx}`, sub);
    let startPt = { x: 0, y: 0 };
    let endPt = { x: 0, y: 0 };

    try {
      if (typeof document !== "undefined") {
        startPt = c.pathEl.getPointAtLength(0);
        endPt = c.pathEl.getPointAtLength(c.totalLength);
      } else {
        const mMatch = sub.match(/[Mm]\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)/);
        if (mMatch) startPt = { x: parseFloat(mMatch[1]), y: parseFloat(mMatch[2]) };

        const allNums = sub.match(/(-?\d+\.?\d*)/g);
        if (allNums && allNums.length >= 2) {
          endPt = {
            x: parseFloat(allNums[allNums.length - 2]),
            y: parseFloat(allNums[allNums.length - 1]),
          };
        }

        if (sub.trim().endsWith("Z") || sub.trim().endsWith("z")) endPt = { ...startPt };
      }
    } catch {
      // Keep fallback points.
    }

    return { sub, startPt, endPt };
  });

  const optimized: string[] = [];
  const visited = new Set<number>();

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
      const dist = Math.hypot(targetStart.x - currentEnd.x, targetStart.y - currentEnd.y);
      if (dist < minDist) {
        minDist = dist;
        nextIdx = i;
      }
    }

    if (nextIdx === -1) break;
    optimized.push(entries[nextIdx].sub);
    visited.add(nextIdx);
    currentIdx = nextIdx;
  }

  return optimized;
}

export function getCachedPath(obj: SvgPathObject): CachedPath;
export function getCachedPath(id: string, pathData: string): CachedPath;
export function getCachedPath(objOrId: SvgPathObject | string, pathData?: string): CachedPath {
  const id = typeof objOrId === "string" ? objOrId : objOrId.id;
  const data = typeof objOrId === "string" ? pathData! : objOrId.pathData;
  const cacheKey = `${id}__${data}`;
  if (pathCache.has(cacheKey)) return pathCache.get(cacheKey)!;

  if (typeof document === "undefined") {
    const fallbackLength = Math.max(10, data.length * 0.5);
    const entry = {
      path2D: {} as any,
      totalLength: fallbackLength,
      pathEl: {
        getPointAtLength: () => ({ x: 0, y: 0 }),
        getTotalLength: () => fallbackLength,
        getAttribute: () => data,
        setAttribute: () => { },
      } as any,
      svgEl: {
        appendChild: () => { },
      } as any,
      bounds: makeBounds(0, 0, fallbackLength, fallbackLength),
    };
    pathCache.set(cacheKey, entry);
    return entry;
  }

  const path2D = new Path2D(data);
  const svgNS = "http://www.w3.org/2000/svg";
  const svgEl = document.createElementNS(svgNS, "svg") as SVGSVGElement;
  const pathEl = document.createElementNS(svgNS, "path") as SVGPathElement;

  Object.assign(svgEl.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    width: "0",
    height: "0",
    overflow: "hidden",
  });

  pathEl.setAttribute("d", data);
  svgEl.appendChild(pathEl);
  document.body.appendChild(svgEl);

  let totalLength = 0;
  try {
    totalLength = pathEl.getTotalLength();
    if (!Number.isFinite(totalLength) || totalLength <= 0) {
      totalLength = Math.max(10, data.length * 0.5);
    }
  } catch (e) {
    console.warn("Failed to get total path length, using fallback estimation:", e);
    totalLength = Math.max(10, data.length * 0.5);
  }

  const bounds = getPathBounds(pathEl, totalLength);
  const entry = { path2D, totalLength, pathEl, svgEl, bounds };
  pathCache.set(cacheKey, entry);
  return entry;
}

function getEffectiveSubPaths(obj: SvgPathObject): string[] {
  if (obj.subPaths && obj.subPaths.length > 1) return obj.subPaths;
  return splitCompoundPath(obj.pathData);
}

function getSubPathCache(obj: SvgPathObject): SubPathCache {
  const subKey = obj.subPaths?.join("|") ?? "";
  const cacheKey = `sub__${obj.id}__${obj.pathData}__${subKey}`;
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

  const maxPauseBudget = 0.25;
  const rawPauseBudget = (n - 1) * 0.015;
  const pauseBudget = Math.min(maxPauseBudget, rawPauseBudget);
  const actualPause = n > 1 ? pauseBudget / (n - 1) : 0;
  const drawBudget = 1 - pauseBudget;

  const boundaries: { start: number; end: number; drawEnd: number }[] = [];
  let cursor = 0;

  for (let i = 0; i < n; i++) {
    const fraction = (lengths[i] / totalLength) * drawBudget;
    const start = cursor;
    const drawEnd = cursor + fraction;
    const end = drawEnd + (i < n - 1 ? actualPause : 0);
    boundaries.push({ start, drawEnd, end });
    cursor = end;
  }

  const entry: SubPathCache = { subs, paths, lengths, totalLength, boundaries };
  subPathCache.set(cacheKey, entry);
  return entry;
}

export function getSubPathProgress(
  obj: SvgPathObject,
  globalProgress: number
): {
  subIdx: number;
  localProgress: number;
  cached: CachedPath;
  isPause?: boolean;
  pauseProgress?: number;
  nextCached?: CachedPath;
} | null {
  const subs = getEffectiveSubPaths(obj);
  if (subs.length <= 1) {
    return { subIdx: 0, localProgress: globalProgress, cached: getCachedPath(obj) };
  }

  const sc = getSubPathCache(obj);

  for (let i = 0; i < sc.boundaries.length; i++) {
    const b = sc.boundaries[i];
    if (globalProgress >= b.start && globalProgress <= b.end) {
      if (globalProgress > b.drawEnd) {
        const nextIdx = Math.min(sc.boundaries.length - 1, i + 1);
        const pauseProgress = (globalProgress - b.drawEnd) / (b.end - b.drawEnd);
        return {
          subIdx: i,
          localProgress: 1,
          cached: sc.paths[i],
          isPause: true,
          pauseProgress: clamp01(pauseProgress),
          nextCached: sc.paths[nextIdx],
        };
      }

      const localProgress = (globalProgress - b.start) / (b.drawEnd - b.start);
      return {
        subIdx: i,
        localProgress: clamp01(localProgress),
        cached: sc.paths[i],
      };
    }
  }

  const last = sc.boundaries.length - 1;
  return { subIdx: last, localProgress: 1, cached: sc.paths[last] };
}

function applyStaticSvgTransform(
  obj: SvgPathObject,
  lx: number,
  ly: number,
  ldx: number,
  ldy: number
): { x: number; y: number; dx: number; dy: number } {
  const sx = obj.scaleX ?? 1;
  const sy = obj.scaleY ?? 1;

  let x = obj.x + lx * sx;
  let y = obj.y + ly * sy;
  let dx = ldx * sx;
  let dy = ldy * sy;

  const rot = obj.rotation ?? 0;
  if (rot !== 0) {
    const pivotX = obj.x + sx * 50;
    const pivotY = obj.y + sy * 50;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    const rx = x - pivotX;
    const ry = y - pivotY;
    x = pivotX + rx * cos - ry * sin;
    y = pivotY + rx * sin + ry * cos;

    const rdx = dx * cos - dy * sin;
    const rdy = dx * sin + dy * cos;
    dx = rdx;
    dy = rdy;
  }

  return { x, y, dx, dy };
}

function getFillSweepSettings(cached: CachedPath, obj: SvgPathObject) {
  const b = cached.bounds;
  const minSide = Math.max(1, Math.min(b.width, b.height));
  const pad = Math.max(5, minSide * 0.05);
  const left = b.x - pad;
  const top = b.y - pad;
  const width = b.width + pad * 2;
  const height = b.height + pad * 2;

  // Use 8-20 rows depending on shape height
  const rows = Math.max(8, Math.min(20, Math.round(8 + ((height - 50) / 350) * 12)));
  const rowH = height / rows;

  // Brush size based on object size (rowH)
  const brush = Math.max(10, rowH * 1.8);

  return { left, top, width, height, rows, rowH, brush };
}

function getFillSweepCoords(
  s: ReturnType<typeof getFillSweepSettings>,
  row: number,
  rowFrac: number
): { x: number; y: number } {
  const forward = row % 2 === 0;
  const x = forward
    ? s.left + s.width * rowFrac
    : s.left + s.width * (1 - rowFrac);

  const wobbleFreq = 3; // number of cycles per row
  const wobbleAmp = s.rowH * 0.15; // 15% of row height
  const wobble = Math.sin(rowFrac * Math.PI * 2 * wobbleFreq + row) * wobbleAmp;

  const y = s.top + row * s.rowH + s.rowH * 0.5 + wobble;
  return { x, y };
}

function getFillSweepTip(
  cached: CachedPath,
  obj: SvgPathObject,
  progress: number
): { x: number; y: number; dx: number; dy: number } {
  const s = getFillSweepSettings(cached, obj);
  const p = clamp01(progress);
  if (p <= 0) {
    const start = getFillSweepCoords(s, 0, 0);
    return { x: start.x, y: start.y, dx: 1, dy: 0 };
  }
  const sweep = p * s.rows;
  const row = Math.min(s.rows - 1, Math.floor(sweep));
  const rowFrac = p >= 1 ? 1 : sweep - row;

  const pt1 = getFillSweepCoords(s, row, rowFrac);
  const deltaFrac = 0.01;
  const prevFrac = Math.max(0, rowFrac - deltaFrac);
  const pt0 = getFillSweepCoords(s, row, prevFrac);

  return {
    x: pt1.x,
    y: pt1.y,
    dx: pt1.x - pt0.x || (row % 2 === 0 ? 1 : -1),
    dy: pt1.y - pt0.y || 0,
  };
}

export function getSvgTipAtProgress(
  obj: SvgPathObject,
  globalProgress: number
): { x: number; y: number; dx: number; dy: number; isPause?: boolean } {
  const mode = getSvgDrawMode(obj);

  if (mode === "fill" || mode === "image") {
    const c = getCachedPath(obj);
    const tip = getFillSweepTip(c, obj, globalProgress);
    return { ...applyStaticSvgTransform(obj, tip.x, tip.y, tip.dx, tip.dy), isPause: false };
  }

  const sp = getSubPathProgress(obj, globalProgress);
  if (!sp) {
    const c = getCachedPath(obj);
    const p = c.pathEl.getPointAtLength(0);
    return { ...applyStaticSvgTransform(obj, p.x, p.y, 1, 0), isPause: false };
  }

  if (sp.isPause && sp.pauseProgress !== undefined && sp.nextCached) {
    let pEnd = { x: 0, y: 0 };
    let pStart = { x: 0, y: 0 };

    try {
      pEnd = sp.cached.pathEl.getPointAtLength(sp.cached.totalLength);
      pStart = sp.nextCached.pathEl.getPointAtLength(0);
    } catch {
      const scSubs = getSubPathCache(obj).subs;
      const endSub = scSubs[sp.subIdx];
      const nextSub = scSubs[Math.min(scSubs.length - 1, sp.subIdx + 1)];

      const endNums = endSub.match(/(-?\d+\.?\d*)/g);
      if (endNums && endNums.length >= 2) {
        pEnd = {
          x: parseFloat(endNums[endNums.length - 2]),
          y: parseFloat(endNums[endNums.length - 1]),
        };
      }

      const mMatchStart = nextSub.match(/[Mm]\s*(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)/);
      if (mMatchStart) {
        pStart = { x: parseFloat(mMatchStart[1]), y: parseFloat(mMatchStart[2]) };
      }
    }

    const t = sp.pauseProgress;
    const easedT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const lift = Math.sin(easedT * Math.PI) * 15;

    const lx = pEnd.x + (pStart.x - pEnd.x) * easedT + lift * 0.3;
    const ly = pEnd.y + (pStart.y - pEnd.y) * easedT - lift;
    const dx = pStart.x - pEnd.x;
    const dy = pStart.y - pEnd.y;

    return { ...applyStaticSvgTransform(obj, lx, ly, dx, dy), isPause: true };
  }

  const { cached, localProgress } = sp;
  const smKey = `${obj.id}__sub${sp.subIdx}__${cached.pathEl.getAttribute("d") || ""}`;
  const speedMap = getSpeedMap(cached.pathEl, cached.totalLength, smKey);
  const warpedLocalProgress = applyVariableSpeed(localProgress, speedMap);

  const len = cached.totalLength * clamp01(warpedLocalProgress);
  const p1 = cached.pathEl.getPointAtLength(len);
  const p2 = cached.pathEl.getPointAtLength(Math.min(len + 2, cached.totalLength));

  return {
    ...applyStaticSvgTransform(obj, p1.x, p1.y, p2.x - p1.x, p2.y - p1.y),
    isPause: false,
  };
}

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
    cumulativeAdjusted[i] = cumulativeAdjusted[i - 1] + segLen / speedMult;
  }

  const entry: SpeedMap = {
    cumulativeAdjusted,
    totalAdjusted: cumulativeAdjusted[N],
    sampleCount: N,
  };

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
  const segEnd = cumulativeAdjusted[lo];
  const segFrac = segEnd - segStart > 0 ? (targetAdjusted - segStart) / (segEnd - segStart) : 0;

  return ((lo - 1) + segFrac) / sampleCount;
}

export function getSvgProgress(obj: SvgPathObject, currentTime: number): number | null {
  const effectiveStart = obj.startTime + (obj.startDelay ?? 0);
  if (currentTime < effectiveStart) return null;
  if (currentTime > effectiveStart + obj.duration) return 1;
  const raw = (currentTime - effectiveStart) / obj.duration;
  const t = clamp01(raw);
  return obj.easing ? obj.easing(t) : SvgEasing.easeInOutCubic(t);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function getPressureWidth(baseWidth: number, progress: number, seed: number): number {
  const variation1 = Math.sin(progress * Math.PI * 7.3 + seed) * 0.4;
  const variation2 = Math.sin(progress * Math.PI * 13.7 + seed * 2.7) * 0.2;
  const taper = Math.min(1, progress / 0.05) * Math.min(1, (1 - progress) / 0.05);
  return Math.max(0.5, baseWidth * taper + variation1 + variation2);
}

function getAlphaColor(color: string | undefined | null, opacity: number): string {
  if (!isDrawableColor(color)) return `rgba(99, 102, 241, ${opacity})`;

  const trimmed = color!.trim().toLowerCase();

  if (trimmed.startsWith("#")) {
    const hex = trimmed.substring(1);
    const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, "0");
    if (hex.length === 3) return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}${alphaHex}`;
    if (hex.length === 6) return `#${hex}${alphaHex}`;
    if (hex.length === 8) return `#${hex.substring(0, 6)}${alphaHex}`;
  }

  if (trimmed.startsWith("rgb")) {
    const matches = trimmed.match(/\d+(\.\d+)?/g);
    if (matches && matches.length >= 3) return `rgba(${matches[0]}, ${matches[1]}, ${matches[2]}, ${opacity})`;
  }

  const namedColors: Record<string, string> = {
    black: "0,0,0",
    white: "255,255,255",
    red: "255,0,0",
    green: "0,255,0",
    blue: "0,0,255",
    yellow: "255,255,0",
    orange: "255,165,0",
    purple: "128,0,128",
    gray: "128,128,128",
    grey: "128,128,128",
  };

  if (namedColors[trimmed]) return `rgba(${namedColors[trimmed]}, ${opacity})`;
  return color!;
}

function addRoundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (w <= 0 || h <= 0) return;

  const anyCtx = ctx as any;
  if (typeof anyCtx.roundRect === "function") {
    anyCtx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
    return;
  }

  ctx.rect(x, y, w, h);
}

function drawFillBrushMask(
  ctx: CanvasRenderingContext2D,
  obj: SvgPathObject,
  progress: number,
  pathData: string,
  cached: CachedPath
): void {
  const fillColor = isDrawableColor(obj.fillColor)
    ? obj.fillColor!
    : isDrawableColor(obj.strokeColor)
      ? obj.strokeColor
      : "#334155";

  const p = clamp01(progress);
  const path = new Path2D(pathData);

  if (p >= 0.995) {
    ctx.fillStyle = fillColor;
    ctx.fill(path, "evenodd");
    return;
  }

  const s = getFillSweepSettings(cached, obj);
  const sweep = p * s.rows;
  const activeRow = Math.min(s.rows - 1, Math.floor(sweep));
  const rowFrac = sweep - activeRow;

  ctx.save();
  ctx.clip(path, "evenodd");

  ctx.beginPath();
  let first = true;
  for (let row = 0; row <= activeRow; row++) {
    const isActive = row === activeRow;
    const maxFrac = isActive ? rowFrac : 1;
    if (maxFrac <= 0 && isActive) continue;

    // Sample points along the row to draw a smooth wobbled line
    const steps = Math.max(10, Math.ceil(s.width / 10)); // sample every 10px
    for (let step = 0; step <= steps; step++) {
      const frac = (step / steps) * maxFrac;
      const pt = getFillSweepCoords(s, row, frac);
      if (first) {
        ctx.moveTo(pt.x, pt.y);
        first = false;
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
  }

  ctx.strokeStyle = fillColor;
  ctx.lineWidth = s.brush;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.restore();
}

export function drawSvgPath(
  ctx: CanvasRenderingContext2D,
  obj: SvgPathObject,
  progress: number,
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

  ctx.globalAlpha *= clamp01(opacity);

  if (rotation !== 0) {
    const pivotX = cx + scaleX * 50;
    const pivotY = cy + scaleY * 50;
    ctx.translate(pivotX, pivotY);
    ctx.rotate(rotation);
    ctx.translate(-pivotX, -pivotY);
  }

  ctx.translate(cx, cy);
  ctx.scale(scaleX, scaleY);

  const mode = getSvgDrawMode(obj);

  if (mode === "fill" || mode === "image") {
    drawFillBrushMask(ctx, obj, progress, obj.pathData, getCachedPath(obj));
    ctx.restore();
    return;
  }

  const subs = getEffectiveSubPaths(obj);
  if (subs.length > 1) {
    drawCompoundPath(ctx, obj, progress);
  } else {
    drawSingleStrokePath(ctx, obj, progress, obj.pathData, getCachedPath(obj));
  }

  ctx.restore();
}

function drawSingleStrokePath(
  ctx: CanvasRenderingContext2D,
  obj: SvgPathObject,
  progress: number,
  pathData: string,
  cached: CachedPath
): void {
  const { pathEl, totalLength } = cached;
  const speedMap = getSpeedMap(pathEl, totalLength, `${obj.id}__${pathData}`);
  const warpedProgress = applyVariableSpeed(progress, speedMap);
  const path = new Path2D(pathData);

  if (progress >= 1) {
    if (hasDrawableStroke(obj)) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = obj.strokeColor;
      ctx.lineWidth = obj.strokeWidth;
      ctx.setLineDash([]);
      ctx.stroke(path);
    }

    if (isDrawableColor(obj.fillColor)) {
      ctx.fillStyle = obj.fillColor!;
      ctx.fill(path, "evenodd");
    }

    return;
  }

  const drawnLength = totalLength * clamp01(warpedProgress);
  const seed = hashCode(obj.id);
  const segCount = Math.max(10, Math.min(150, Math.floor(drawnLength / 3)));
  const segLen = segCount > 0 ? drawnLength / segCount : 0;
  const strokeColor = getActiveStrokeColor(obj);
  const baseWidth = obj.strokeWidth > 0 ? obj.strokeWidth : 2;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

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
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  if (handDrawQuality !== "premiumSmooth" && progress > 0 && progress < 1) {
    const tipPt = pathEl.getPointAtLength(drawnLength);
    const gradient = ctx.createRadialGradient(tipPt.x, tipPt.y, 0, tipPt.x, tipPt.y, baseWidth * 3);
    gradient.addColorStop(0, getAlphaColor(strokeColor, 0.25));
    gradient.addColorStop(1, getAlphaColor(strokeColor, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(tipPt.x, tipPt.y, baseWidth * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isDrawableColor(obj.fillColor) && progress > 0.85) {
    const fillAlpha = (progress - 0.85) / 0.15;
    ctx.save();
    ctx.globalAlpha *= clamp01(fillAlpha);
    ctx.fillStyle = obj.fillColor!;
    ctx.fill(path, "evenodd");
    ctx.restore();
  }
}

function drawCompoundPath(
  ctx: CanvasRenderingContext2D,
  obj: SvgPathObject,
  globalProgress: number
): void {
  const sc = getSubPathCache(obj);

  for (let i = 0; i < sc.paths.length; i++) {
    const b = sc.boundaries[i];
    if (globalProgress < b.start) break;

    const localProg =
      globalProgress >= b.drawEnd ? 1 : (globalProgress - b.start) / (b.drawEnd - b.start);

    drawSingleStrokePath(
      ctx,
      { ...obj, id: `${obj.id}__sub${i}` },
      clamp01(localProg),
      sc.subs[i],
      sc.paths[i]
    );
  }

  if (isDrawableColor(obj.fillColor)) {
    const lastB = sc.boundaries[sc.boundaries.length - 1];
    const fillStart = lastB.start + (lastB.drawEnd - lastB.start) * 0.85;
    if (globalProgress > fillStart) {
      const fillAlpha = globalProgress >= 1 ? 1 : clamp01((globalProgress - fillStart) / 0.15);
      ctx.save();
      ctx.globalAlpha *= fillAlpha;
      ctx.fillStyle = obj.fillColor!;
      ctx.fill(new Path2D(obj.pathData), "evenodd");
      ctx.restore();
    }
  }
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash;
}

function modeRank(obj: SvgPathObject): number {
  const mode = getSvgDrawMode(obj);
  if (mode === "stroke") return 0;
  if (mode === "fill") return 1;
  return 2;
}

export function drawAllSvgPaths(
  ctx: CanvasRenderingContext2D,
  objects: SvgPathObject[],
  currentTime: number
): void {
  const sorted = [...objects].sort((a, b) => {
    const oa = a.drawOrder ?? a.startTime * 1000;
    const ob = b.drawOrder ?? b.startTime * 1000;
    if (oa !== ob) return oa - ob;
    return modeRank(a) - modeRank(b);
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

export function getPathDrawDuration(pathData: string): number {
  try {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    const path = document.createElementNS(svgNS, "path");

    svg.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    document.body.appendChild(svg);

    const len = path.getTotalLength();
    document.body.removeChild(svg);

    if (!Number.isFinite(len) || len <= 0) return 1.5;
    return Math.min(6.5, Math.max(1.0, len / 350));
  } catch (e) {
    console.warn("Failed to measure path length for duration:", e);
    return Math.min(6.5, Math.max(1.0, pathData.length * 0.008));
  }
}

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
