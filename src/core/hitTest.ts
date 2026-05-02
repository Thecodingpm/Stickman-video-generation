/**
 * World-space hit testing.
 * Converts a screen-space click → world coords → finds which object was clicked.
 * Returns the topmost object (last in array = rendered on top).
 */

import type { Camera } from "./camera";
import type { AnimatedObject } from "./timeline";
import type { SvgPathObject } from "./svgPath";
import type { Scene } from "./sceneManager";
import { getCachedPath } from "./svgPath";

// ── Screen → World ────────────────────────────────────────────────────────────

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera:  Camera,
  W:       number,
  H:       number,
): { x: number; y: number } {
  return {
    x: (screenX - W / 2) / camera.zoom + camera.x,
    y: (screenY - H / 2) / camera.zoom + camera.y,
  };
}

// ── Bounding boxes ────────────────────────────────────────────────────────────

export interface BoundingBox {
  x: number; y: number; w: number; h: number;
}

export function getAnimatedObjectBBox(obj: AnimatedObject): BoundingBox {
  switch (obj.type) {
    case "rect":
      return { x: obj.x, y: obj.y, w: obj.width ?? 100, h: obj.height ?? 60 };
    case "circle": {
      const r = obj.radius ?? 40;
      return { x: obj.x - r, y: obj.y - r, w: r * 2, h: r * 2 };
    }
    case "text":
      // Approximate: fontSize × content length for width, fontSize for height
      return { x: obj.x, y: obj.y, w: (obj.fontSize ?? 16) * (obj.content?.length ?? 4) * 0.6, h: (obj.fontSize ?? 16) * 1.4 };
    default:
      return { x: obj.x, y: obj.y, w: 60, h: 60 };
  }
}

export function getSvgObjectBBox(obj: SvgPathObject): BoundingBox {
  // Estimate from path using a temporary SVGPathElement
  try {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg   = document.createElementNS(svgNS, "svg");
    const path  = document.createElementNS(svgNS, "path");
    svg.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    path.setAttribute("d", obj.pathData);
    svg.appendChild(path);
    document.body.appendChild(svg);
    const bb = path.getBBox();
    document.body.removeChild(svg);
    const sx = obj.scaleX ?? 1, sy = obj.scaleY ?? 1;
    return {
      x: obj.x + bb.x * sx,
      y: obj.y + bb.y * sy,
      w: bb.width  * sx,
      h: bb.height * sy,
    };
  } catch {
    return { x: obj.x, y: obj.y, w: 80, h: 80 };
  }
}

function pointInBox(px: number, py: number, box: BoundingBox, pad = 20): boolean {
  return px >= box.x - pad && px <= box.x + box.w + pad
      && py >= box.y - pad && py <= box.y + box.h + pad;
}

// ── Hit test ──────────────────────────────────────────────────────────────────

export interface HitResult {
  id:   string;
  type: "animated" | "svg";
}

export function hitTestScene(
  worldX: number,
  worldY: number,
  scene:  Scene,
): HitResult | null {
  // Test SVG objects (rendered on top) first — reverse order for topmost
  if (scene.svgObjects) {
    for (let i = scene.svgObjects.length - 1; i >= 0; i--) {
      const obj = scene.svgObjects[i];
      const box = getSvgObjectBBox(obj);
      if (pointInBox(worldX, worldY, box)) {
        return { id: obj.id, type: "svg" };
      }
    }
  }

  // Then animated objects — reverse order
  for (let i = scene.objects.length - 1; i >= 0; i--) {
    const obj = scene.objects[i];
    const box = getAnimatedObjectBBox(obj);
    if (pointInBox(worldX, worldY, box)) {
      return { id: obj.id, type: "animated" };
    }
  }

  return null;
}

// ── Snap to grid ──────────────────────────────────────────────────────────────

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapXY(
  x: number, y: number,
  gridSize: number,
  enabled: boolean,
): { x: number; y: number } {
  if (!enabled) return { x, y };
  return { x: snapToGrid(x, gridSize), y: snapToGrid(y, gridSize) };
}

// ── Snap to nearby object edges/centers ──────────────────────────────────────

const SNAP_THRESHOLD = 8; // world-space pixels

export interface SnapResult {
  x: number;
  y: number;
  snapX: boolean;
  snapY: boolean;
}

export function snapToObjects(
  x: number,
  y: number,
  w: number,
  h: number,
  scene: Scene,
  excludeId: string,
): SnapResult {
  let outX = x, outY = y, snapX = false, snapY = false;

  const allBoxes: BoundingBox[] = [
    ...scene.objects.filter(o => o.id !== excludeId).map(getAnimatedObjectBBox),
    ...(scene.svgObjects ?? []).filter(o => o.id !== excludeId).map(getSvgObjectBBox),
  ];

  // Candidate snaps: left, center, right of moving box vs same of each target
  for (const box of allBoxes) {
    const targets = {
      x: [box.x, box.x + box.w / 2, box.x + box.w],
      y: [box.y, box.y + box.h / 2, box.y + box.h],
    };
    const mine = {
      x: [x, x + w / 2, x + w],
      y: [y, y + h / 2, y + h],
    };

    for (let mi = 0; mi < 3; mi++) {
      for (let ti = 0; ti < 3; ti++) {
        const dX = Math.abs(mine.x[mi] - targets.x[ti]);
        if (!snapX && dX < SNAP_THRESHOLD) {
          outX = x + (targets.x[ti] - mine.x[mi]);
          snapX = true;
        }
        const dY = Math.abs(mine.y[mi] - targets.y[ti]);
        if (!snapY && dY < SNAP_THRESHOLD) {
          outY = y + (targets.y[ti] - mine.y[mi]);
          snapY = true;
        }
      }
    }
    if (snapX && snapY) break;
  }

  return { x: outX, y: outY, snapX, snapY };
}
