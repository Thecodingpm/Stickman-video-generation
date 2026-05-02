/**
 * Editor overlay — draws selection bounding box and handles on top of the canvas.
 * Called AFTER renderFrame() in the RAF loop, only in editor mode.
 */

import type { Camera } from "./camera";
import type { Scene } from "./sceneManager";
import type { SelectedObject } from "../store/editorStore";
import { applyCameraTransform } from "./camera";
import { getAnimatedObjectBBox, getSvgObjectBBox } from "./hitTest";

const HANDLE_SIZE  = 8;
const ACCENT_COLOR = "#6366f1";
const ACCENT_GLOW  = "rgba(99,102,241,0.25)";

function worldToScreen(
  wx: number, wy: number,
  camera: Camera, W: number, H: number,
): { x: number; y: number } {
  return {
    x: Math.round((wx - camera.x) * camera.zoom + W / 2),
    y: Math.round((wy - camera.y) * camera.zoom + H / 2),
  };
}

export function drawEditorOverlay(
  ctx:      CanvasRenderingContext2D,
  camera:   Camera,
  scene:    Scene | null,
  selected: SelectedObject | null,
  W:        number,
  H:        number,
): void {
  if (!scene || !selected) return;

  // Find the selected object
  let bbox: { x: number; y: number; w: number; h: number } | null = null;

  if (selected.type === "animated") {
    const obj = scene.objects.find(o => o.id === selected.id);
    if (obj) bbox = getAnimatedObjectBBox(obj);
  } else {
    const obj = scene.svgObjects?.find(o => o.id === selected.id);
    if (obj) bbox = getSvgObjectBBox(obj);
  }

  if (!bbox) return;

  // Convert world bbox corners to screen coords
  const tl = worldToScreen(bbox.x,          bbox.y,          camera, W, H);
  const br = worldToScreen(bbox.x + bbox.w, bbox.y + bbox.h, camera, W, H);

  const sx = tl.x, sy = tl.y;
  const sw = br.x - tl.x, sh = br.y - tl.y;
  const pad = 6;

  ctx.save();

  // Glow shadow behind box
  ctx.shadowColor  = ACCENT_GLOW;
  ctx.shadowBlur   = 12;

  // Dashed selection rect
  ctx.strokeStyle = ACCENT_COLOR;
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(sx - pad, sy - pad, sw + pad * 2, sh + pad * 2);
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  // Corner handles
  const handles = [
    { x: sx - pad,          y: sy - pad          },
    { x: sx + sw / 2,       y: sy - pad          },
    { x: sx + sw + pad,     y: sy - pad          },
    { x: sx - pad,          y: sy + sh / 2       },
    { x: sx + sw + pad,     y: sy + sh / 2       },
    { x: sx - pad,          y: sy + sh + pad     },
    { x: sx + sw / 2,       y: sy + sh + pad     },
    { x: sx + sw + pad,     y: sy + sh + pad     },
  ];

  for (const h of handles) {
    ctx.fillStyle   = "#fff";
    ctx.strokeStyle = ACCENT_COLOR;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.rect(h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fill();
    ctx.stroke();
  }

  // Label above selection
  const label = selected.type === "animated"
    ? (scene.objects.find(o => o.id === selected.id)?.type ?? "object")
    : "svg path";

  ctx.fillStyle    = ACCENT_COLOR;
  ctx.font         = "10px monospace";
  ctx.textBaseline = "bottom";
  ctx.fillText(label, sx - pad, sy - pad - 4);

  ctx.restore();
}
