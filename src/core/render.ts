import { applyCameraTransform } from "./camera";
import type { Camera } from "./camera";
import type { Scene } from "./sceneManager";
import { getObjectProgress, getCameraAtTime, lerp } from "./timeline";
import type { TimelineState, AnimatedObject } from "./timeline";
import { drawAllSvgPaths } from "./svgPath";
import type { SvgPathObject } from "./svgPath";
import { drawAllHands } from "./handDrawer";
import type { HandState } from "./handDrawer";

// ── Grid ──────────────────────────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, camera: Camera, W: number, H: number): void {
  const SPACING = 100;
  const majorEvery = 5;
  const halfW = W / 2 / camera.zoom;
  const halfH = H / 2 / camera.zoom;
  const left = camera.x - halfW, right = camera.x + halfW;
  const top = camera.y - halfH, bottom = camera.y + halfH;
  const startX = Math.floor(left / SPACING) * SPACING;
  const startY = Math.floor(top / SPACING) * SPACING;

  ctx.save();
  ctx.lineWidth = 1 / camera.zoom;
  for (let wx = startX; wx <= right; wx += SPACING) {
    ctx.strokeStyle = Math.round(wx / SPACING) % majorEvery === 0
      ? "rgba(100,116,139,0.28)" : "rgba(148,163,184,0.13)";
    ctx.beginPath(); ctx.moveTo(wx, top); ctx.lineTo(wx, bottom); ctx.stroke();
  }
  for (let wy = startY; wy <= bottom; wy += SPACING) {
    ctx.strokeStyle = Math.round(wy / SPACING) % majorEvery === 0
      ? "rgba(100,116,139,0.28)" : "rgba(148,163,184,0.13)";
    ctx.beginPath(); ctx.moveTo(left, wy); ctx.lineTo(right, wy); ctx.stroke();
  }
  // Origin crosshair
  ctx.strokeStyle = "rgba(239,68,68,0.45)";
  ctx.lineWidth = 2 / camera.zoom;
  const cs = 14 / camera.zoom;
  ctx.beginPath(); ctx.moveTo(-cs, 0); ctx.lineTo(cs, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -cs); ctx.lineTo(0, cs); ctx.stroke();
  ctx.restore();
}

// ── Animated object renderer ──────────────────────────────────────────────────

function renderAnimatedObject(
  ctx: CanvasRenderingContext2D,
  obj: AnimatedObject,
  progress: number
): void {
  ctx.save();
  let cx = obj.x, cy = obj.y, alpha = 1, scale = 1;

  switch (obj.animationType) {
    case "fade": alpha = progress; break;
    case "draw": alpha = progress; break;
    case "move":
      if (obj.move) { cx = lerp(obj.move.fromX, obj.move.toX, progress); cy = lerp(obj.move.fromY, obj.move.toY, progress); }
      break;
    case "scale":
      scale = obj.scale ? lerp(obj.scale.from, obj.scale.to, progress) : progress;
      break;
  }

  ctx.globalAlpha = Math.min(1, Math.max(0, alpha));

  if (scale !== 1) {
    const pivotX = obj.type === "rect" ? cx + (obj.width ?? 0) / 2 : cx;
    const pivotY = obj.type === "rect" ? cy + (obj.height ?? 0) / 2 : cy;
    ctx.translate(pivotX, pivotY); ctx.scale(scale, scale); ctx.translate(-pivotX, -pivotY);
  }

  ctx.fillStyle = obj.fillColor ?? "#6366f1";
  ctx.strokeStyle = obj.strokeColor ?? "transparent";
  ctx.lineWidth = obj.lineWidth ?? 1;
  ctx.shadowColor = "rgba(0,0,0,0.18)"; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;

  switch (obj.type) {
    case "rect": {
      const w = obj.width ?? 100, h = obj.height ?? 60, r = 8;
      if (obj.animationType === "draw") {
        ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, w * progress, h); ctx.clip();
      }
      ctx.beginPath();
      ctx.moveTo(cx + r, cy); ctx.lineTo(cx + w - r, cy); ctx.quadraticCurveTo(cx + w, cy, cx + w, cy + r);
      ctx.lineTo(cx + w, cy + h - r); ctx.quadraticCurveTo(cx + w, cy + h, cx + w - r, cy + h);
      ctx.lineTo(cx + r, cy + h); ctx.quadraticCurveTo(cx, cy + h, cx, cy + h - r);
      ctx.lineTo(cx, cy + r); ctx.quadraticCurveTo(cx, cy, cx + r, cy); ctx.closePath();
      ctx.fill(); if (obj.strokeColor !== "transparent") ctx.stroke();
      if (obj.animationType === "draw") ctx.restore();
      break;
    }
    case "circle":
      ctx.beginPath(); ctx.arc(cx, cy, obj.radius ?? 40, 0, Math.PI * 2);
      ctx.fill(); if (obj.strokeColor !== "transparent") ctx.stroke();
      break;
    case "text":
      ctx.shadowColor = "transparent";
      ctx.font = `${obj.fontSize ?? 16}px ${obj.fontFamily ?? "sans-serif"}`;
      ctx.fillStyle = obj.fillColor ?? "#1e293b";
      ctx.textBaseline = "top";
      ctx.fillText(obj.content ?? "", cx, cy);
      break;
  }
  ctx.restore();
}

// ── HUD ───────────────────────────────────────────────────────────────────────

function drawSceneHUD(
  ctx:           CanvasRenderingContext2D,
  camera:        Camera,
  scene:         Scene | null,
  globalTime:    number,
  totalDuration: number,
  W:             number,
): void {
  ctx.save();
  const px = 16, py = 16, pw = 320, ph = 90;
  ctx.fillStyle   = "rgba(15,23,42,0.82)";
  ctx.strokeStyle = "rgba(99,102,241,0.45)";
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 10); ctx.fill(); ctx.stroke();

  ctx.fillStyle = "#94a3b8"; ctx.font = "11px monospace"; ctx.textBaseline = "top";
  ctx.fillText(`Scene   ${scene?.name ?? "—"}`, px + 14, py + 12);
  ctx.fillText(`Camera  x:${camera.x.toFixed(1)}  y:${camera.y.toFixed(1)}  zoom:${camera.zoom.toFixed(3)}`, px + 14, py + 30);
  ctx.fillText(`Time    ${globalTime.toFixed(2)}s / ${totalDuration.toFixed(1)}s`, px + 14, py + 48);
  ctx.fillStyle = "#334155";
  ctx.fillText("Space play/pause · Drag pan · Wheel zoom", px + 14, py + 68);
  ctx.restore();
}

// ── Main export ───────────────────────────────────────────────────────────────

export function renderFrame(
  ctx:        CanvasRenderingContext2D,
  camera:     Camera,
  scene:      Scene | null,
  localTime:  number,
  W:          number,
  H:          number,
  hand?:      HandState,
  globalTime?: number,
  totalDuration?: number,
): void {
  ctx.clearRect(0, 0, W, H);

  // Per-scene background or default
  ctx.fillStyle = scene?.background ?? "#f8fafc";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  applyCameraTransform(ctx, camera, W, H);
  drawGrid(ctx, camera, W, H);

  if (scene) {
    // Render animated objects using LOCAL time
    for (const obj of scene.objects) {
      const progress = getObjectProgress(obj, localTime);
      if (progress === null) continue;
      renderAnimatedObject(ctx, obj, progress);
    }

    // Render SVG draw objects using LOCAL time
    if (scene.svgObjects) {
      drawAllSvgPaths(ctx, scene.svgObjects, localTime);
    }

    // Render hand cursors
    if (hand && scene.svgObjects) {
      drawAllHands(ctx, scene.svgObjects, localTime, hand, camera.zoom);
    }
  }

  ctx.restore();

  // HUD
  drawSceneHUD(ctx, camera, scene, globalTime ?? 0, totalDuration ?? 0, W);
}