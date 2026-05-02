/**
 * SVG Path → Canvas draw animation system.
 * Handles parsing, caching, and progressive stroke reveal.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SvgPathObject {
  id:          string;
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
}

export type EasingFn = (t: number) => number;

export const SvgEasing = {
  linear:    (t: number) => t,
  easeIn:    (t: number) => t * t,
  easeOut:   (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
} as const;

// ── Path cache ────────────────────────────────────────────────────────────────
// We create one offscreen Path2D + measure its length via an offscreen canvas.
// Length is expensive to compute → cache forever by id.

interface CachedPath {
  path2D:      Path2D;
  totalLength: number;
}

const pathCache = new Map<string, CachedPath>();

/**
 * Returns (and caches) a Path2D + its total stroke length for a given object.
 * Length is approximated by sampling points along the path via a hidden SVGPathElement.
 */
export function getCachedPath(obj: SvgPathObject): CachedPath {
  const cacheKey = `${obj.id}__${obj.pathData}`;
  if (pathCache.has(cacheKey)) return pathCache.get(cacheKey)!;

  const path2D = new Path2D(obj.pathData);
  const totalLength = measurePathLength(obj.pathData);

  const entry = { path2D, totalLength };
  pathCache.set(cacheKey, entry);
  return entry;
}

/**
 * Measure SVG path length using a temporary SVGPathElement in the DOM.
 * This is the only reliable cross-browser way to get getTotalLength().
 * Result is cached so it only runs once per unique pathData string.
 */
const lengthCache = new Map<string, number>();

function measurePathLength(pathData: string): number {
  if (lengthCache.has(pathData)) return lengthCache.get(pathData)!;

  try {
    const svgNS  = "http://www.w3.org/2000/svg";
    const svg    = document.createElementNS(svgNS, "svg");
    const path   = document.createElementNS(svgNS, "path");
    svg.style.position = "absolute";
    svg.style.visibility = "hidden";
    svg.style.pointerEvents = "none";
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    document.body.appendChild(svg);
    const len = path.getTotalLength();
    document.body.removeChild(svg);
    lengthCache.set(pathData, len);
    return len;
  } catch {
    // Fallback: crude bounding-box diagonal estimate
    return 1000;
  }
}

// ── Progress helper ───────────────────────────────────────────────────────────

export function getSvgProgress(obj: SvgPathObject, currentTime: number): number | null {
  if (currentTime < obj.startTime) return null;
  if (currentTime > obj.startTime + obj.duration) return 1; // stays fully drawn
  const raw = (currentTime - obj.startTime) / obj.duration;
  const t   = Math.min(1, Math.max(0, raw));
  return obj.easing ? obj.easing(t) : SvgEasing.easeInOut(t);
}

// ── Core draw function ────────────────────────────────────────────────────────

/**
 * Draw one SvgPathObject onto a canvas context at the correct animation progress.
 * The context should already have the camera transform applied.
 */
export function drawSvgPath(
  ctx: CanvasRenderingContext2D,
  obj: SvgPathObject,
  progress: number   // 0 = nothing drawn, 1 = fully drawn
): void {
  if (progress <= 0) return;

  const { path2D, totalLength } = getCachedPath(obj);

  ctx.save();

  // World-space position + scale
  ctx.translate(obj.x, obj.y);
  ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);

  // ── Stroke reveal via dash trick ──────────────────────────────────────────
  // dasharray = totalLength (one full dash, one full gap)
  // dashoffset = totalLength * (1 - progress)
  // As progress → 1, offset → 0, fully revealing the stroke.
  const drawn  = totalLength * progress;
  const offset = totalLength - drawn;

  ctx.lineCap        = "round";
  ctx.lineJoin       = "round";
  ctx.strokeStyle    = obj.strokeColor;
  ctx.lineWidth      = obj.strokeWidth;
  ctx.setLineDash([totalLength, totalLength]);
  ctx.lineDashOffset = offset;

  // Subtle glow during drawing (disappears when complete)
  if (progress < 1) {
    ctx.shadowColor   = obj.strokeColor;
    ctx.shadowBlur    = 6;
  }

  ctx.stroke(path2D);

  // Reset dash before fill
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.shadowBlur     = 0;

  // ── Optional fill (fades in after stroke is complete) ─────────────────────
  if (obj.fillColor && progress === 1) {
    ctx.fillStyle    = obj.fillColor;
    ctx.globalAlpha  = 1;
    ctx.fill(path2D, "evenodd");
  } else if (obj.fillColor && progress > 0.85) {
    // Smooth fill fade-in in the last 15% of animation
    ctx.fillStyle   = obj.fillColor;
    ctx.globalAlpha = (progress - 0.85) / 0.15;
    ctx.fill(path2D, "evenodd");
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ── Batch draw (called from render loop) ─────────────────────────────────────

export function drawAllSvgPaths(
  ctx: CanvasRenderingContext2D,
  objects: SvgPathObject[],
  currentTime: number
): void {
  for (const obj of objects) {
    const progress = getSvgProgress(obj, currentTime);
    if (progress === null) continue;
    drawSvgPath(ctx, obj, progress);
  }
}
