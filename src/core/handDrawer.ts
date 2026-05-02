/**
 * Hand/Pen follow animation — mirrors drawSvgPath coordinate system exactly.
 */

import type { SvgPathObject } from "./svgPath";
import { getSvgProgress } from "./svgPath";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HandState {
  image:  HTMLImageElement | null;
  loaded: boolean;
  error:  boolean;
}

// ── Loader ────────────────────────────────────────────────────────────────────

export function createHandState(src: string): HandState {
  const state: HandState = { image: null, loaded: false, error: false };
  const img = new Image();
  img.onload  = () => { state.image = img; state.loaded = true; };
  img.onerror = () => { state.error = true; };
  img.src = src;
  return state;
}

// ── Per-object SVG path element cache (for getPointAtLength) ──────────────────
// One dedicated SVGPathElement per object id — never shared between objects.

const svgPathElements = new Map<string, SVGPathElement>();

function getPathElement(obj: SvgPathObject): SVGPathElement {
  if (svgPathElements.has(obj.id)) return svgPathElements.get(obj.id)!;

  const ns   = "http://www.w3.org/2000/svg";
  const svg  = document.createElementNS(ns, "svg") as SVGSVGElement;
  const path = document.createElementNS(ns, "path") as SVGPathElement;

  Object.assign(svg.style, {
    position:      "absolute",
    visibility:    "hidden",
    pointerEvents: "none",
    width:         "0",
    height:        "0",
    overflow:      "hidden",
  });

  // Use EXACTLY the same pathData as drawSvgPath uses
  path.setAttribute("d", obj.pathData);
  svg.appendChild(path);
  document.body.appendChild(svg);

  svgPathElements.set(obj.id, path);
  return path;
}

// ── Point sampler ─────────────────────────────────────────────────────────────

interface PathPoint {
  x:     number; // local path coordinates (before obj offset/scale)
  y:     number;
  angle: number; // stroke direction in radians
}

const DELTA = 1.5; // px ahead for tangent sampling

function getPointAtProgress(obj: SvgPathObject, progress: number): PathPoint {
  const pathEl      = getPathElement(obj);
  const totalLength = pathEl.getTotalLength();

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const length           = totalLength * clampedProgress;

  const pt = pathEl.getPointAtLength(length);

  // Sample slightly ahead for tangent (clamp to path end)
  const aheadLength = Math.min(length + DELTA, totalLength);
  const pt2         = pathEl.getPointAtLength(aheadLength);

  const angle = Math.atan2(pt2.y - pt.y, pt2.x - pt.x);

  return { x: pt.x, y: pt.y, angle };
}

// ── Hand render settings ──────────────────────────────────────────────────────

const HAND_SIZE    = 72;  // screen pixels
const TIP_OFFSET_X =  0;  // horizontal tip alignment
const TIP_OFFSET_Y = -HAND_SIZE * 0.85; // tip near top of image

// ── Draw hand for one object ──────────────────────────────────────────────────

export function drawHandForObject(
  ctx:         CanvasRenderingContext2D,
  obj:         SvgPathObject,
  currentTime: number,
  hand:        HandState,
  cameraZoom:  number,
): void {
  if (!hand.loaded || !hand.image) return;

  const progress = getSvgProgress(obj, currentTime);

  // Only visible while actively drawing
  if (progress === null || progress <= 0 || progress >= 1) return;

  const { x: localX, y: localY, angle } = getPointAtProgress(obj, progress);

  const scaleX = obj.scaleX ?? 1;
  const scaleY = obj.scaleY ?? 1;

  // ── Mirror drawSvgPath transform exactly ─────────────────────────────────
  // drawSvgPath does:
  //   ctx.translate(obj.x, obj.y)
  //   ctx.scale(obj.scaleX, obj.scaleY)
  //   ... draws path (localX, localY are in path space)
  //
  // So world position of tip = obj offset + local * scale:
  const worldX = obj.x + localX * scaleX;
  const worldY = obj.y + localY * scaleY;

  ctx.save();

  // 1. Move to world position (camera transform already applied by render.ts)
  ctx.translate(worldX, worldY);

  // 2. Rotate to follow stroke direction
  ctx.rotate(angle - Math.PI / 2);

  // 3. Undo camera zoom so hand stays fixed screen size
  const s = 1 / cameraZoom;
  ctx.scale(s, s);

  // 4. Smooth fade at start/end of each stroke
  const edgeFade    = Math.min(progress * 12, 1) * Math.min((1 - progress) * 12, 1);
  ctx.globalAlpha   = edgeFade;

  // 5. Draw image with tip aligned to stroke point
  ctx.drawImage(
    hand.image,
    TIP_OFFSET_X - HAND_SIZE / 2,
    TIP_OFFSET_Y,
    HAND_SIZE,
    HAND_SIZE,
  );

  ctx.restore();
}

// ── Draw all hands ────────────────────────────────────────────────────────────

export function drawAllHands(
  ctx:         CanvasRenderingContext2D,
  objects:     SvgPathObject[],
  currentTime: number,
  hand:        HandState,
  cameraZoom:  number,
): void {
  for (const obj of objects) {
    drawHandForObject(ctx, obj, currentTime, hand, cameraZoom);
  }
}
