import { getAnimatedObjectBBox, getSvgObjectBBox } from "./hitTest";
import type { BoundingBox } from "./hitTest";
import { applyCameraTransform } from "./camera";
import type { Camera } from "./camera";
import type { Scene } from "./sceneManager";
import type { SelectedObject } from "../store/editorStore";

// Draw a single selection box with handles
function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  box: BoundingBox,
  isPrimary: boolean,
  zoom: number,
) {
  const { x, y, w, h } = box;
  const pad = 5 / zoom;

  const bx = x - pad, by = y - pad, bw = w + pad * 2, bh = h + pad * 2;

  // Animated dashed border
  ctx.save();
  ctx.strokeStyle = isPrimary ? "#18181b" : "rgba(24, 24, 27, 0.4)";
  ctx.lineWidth   = 1.5 / zoom;
  ctx.setLineDash([5 / zoom, 3 / zoom]);
  ctx.lineDashOffset = -(Date.now() / 80) % (8 / zoom);
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.stroke();

  if (!isPrimary) { ctx.restore(); return; }

  // Solid inner border
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(24, 24, 27, 0.1)";
  ctx.lineWidth   = 0.5 / zoom;
  ctx.beginPath(); ctx.rect(bx + 1/zoom, by + 1/zoom, bw - 2/zoom, bh - 2/zoom); ctx.stroke();

  // 8 corner + edge handles
  const hs = 7 / zoom;
  const handles = [
    [bx,          by         ], [bx + bw/2,   by         ], [bx + bw,     by         ],
    [bx,          by + bh/2  ],                              [bx + bw,     by + bh/2  ],
    [bx,          by + bh    ], [bx + bw/2,   by + bh    ], [bx + bw,     by + bh    ],
  ];

  for (const [hx, hy] of handles) {
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(hx - hs/2 + 0.5/zoom, hy - hs/2 + 0.5/zoom, hs, hs);
    // White fill
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(hx - hs/2, hy - hs/2, hs, hs);
    // Accent border (Sleek dark charcoal handle borders)
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth   = 1.5 / zoom;
    ctx.strokeRect(hx - hs/2, hy - hs/2, hs, hs);
  }

  // Label above box
  ctx.save();
  ctx.scale(1 / zoom, 1 / zoom);
  const lx = bx * zoom, ly = (by * zoom) - 6;
  ctx.fillStyle = "#18181b";
  ctx.font      = "bold 10px monospace";
  ctx.textBaseline = "bottom";
  ctx.fillText(
    `${Math.round(x)}, ${Math.round(y)}`,
    lx, ly,
  );
  ctx.restore();

  ctx.restore();
}

export function drawEditorOverlay(
  ctx:      CanvasRenderingContext2D,
  camera:   Camera,
  scene:    Scene | null,
  selected: SelectedObject | null,
  W:        number,
  H:        number,
  multiSelected?: SelectedObject[],
  snapGuides?: { x?: number; y?: number },
): void {
  if (!scene) return;
  const multi = multiSelected ?? (selected ? [selected] : []);
  if (multi.length === 0) return;

  ctx.save();
  applyCameraTransform(ctx, camera, W, H);

  // Draw non-primary selections first (dimmer)
  for (const sel of multi) {
    if (sel.id === selected?.id) continue;
    const obj = sel.type === "animated"
      ? scene.objects.find(o => o.id === sel.id)
      : scene.svgObjects?.find(o => o.id === sel.id);
    if (!obj) continue;
    const box = sel.type === "animated"
      ? getAnimatedObjectBBox(obj as any)
      : getSvgObjectBBox(obj as any);
    drawSelectionBox(ctx, box, false, camera.zoom);
  }

  // Draw primary selection on top
  if (selected) {
    const obj = selected.type === "animated"
      ? scene.objects.find(o => o.id === selected.id)
      : scene.svgObjects?.find(o => o.id === selected.id);
    if (obj) {
      const box = selected.type === "animated"
        ? getAnimatedObjectBBox(obj as any)
        : getSvgObjectBBox(obj as any);
      drawSelectionBox(ctx, box, true, camera.zoom);
    }
  }

  // Snap guide lines (drawn over everything)
  if (snapGuides) {
    ctx.save();
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth   = 1 / camera.zoom;
    ctx.setLineDash([4 / camera.zoom, 3 / camera.zoom]);
    if (snapGuides.x !== undefined) {
      ctx.beginPath();
      ctx.moveTo(snapGuides.x, -10000);
      ctx.lineTo(snapGuides.x,  10000);
      ctx.stroke();
    }
    if (snapGuides.y !== undefined) {
      ctx.beginPath();
      ctx.moveTo(-10000, snapGuides.y);
      ctx.lineTo( 10000, snapGuides.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}
