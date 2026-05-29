import { applyCameraTransform } from "./camera";
import type { Camera } from "./camera";
import type { Scene } from "./sceneManager";
import { getObjectRenderState, lerp } from "./timeline";
import type { AnimatedObject } from "./timeline";
import { drawAllSvgPaths } from "./svgPath";
import { drawUnifiedHand, getRectPathPoint, getCirclePathPoint, solveTextProgress } from "./handDrawer";
import type { HandState } from "./handDrawer";
import { interpolateTransform } from "./transformInterpolator";
import type { TransformState } from "./transformInterpolator";

// Simple image loader cache to draw uploaded images at 60fps without lag
export const imageCache: Map<string, HTMLImageElement> = new Map();

// ── Text wrap cache ────────────────────────────────────────────────────────────
// Perf fix: wrapLines + measureText are expensive. Cache per object keyed by the
// values that affect layout. Cache is invalidated when any key property changes.
interface TextWrapEntry {
  cacheKey: string;
  lines: string[];
}
const textWrapCache: Map<string, TextWrapEntry> = new Map();

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  content: string,
  wrapWidth: number,
): string[] {
  if (wrapWidth <= 0) return content.split("\n");

  const lines: string[] = [];

  for (const para of content.split("\n")) {
    const words = para.split(" ");
    let line = "";

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;

      if (ctx.measureText(test).width > wrapWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }

    lines.push(line);
  }

  return lines;
}

function getCachedWrappedLines(
  ctx: CanvasRenderingContext2D,
  obj: AnimatedObject,
): string[] {
  const content = obj.content ?? "";
  const wrapWidth = obj.textWrapWidth ?? 0;
  const fontStr = `${obj.fontStyle ?? "normal"} ${obj.fontWeight ?? "normal"} ${obj.fontSize ?? 16}px ${obj.fontFamily ?? "sans-serif"}`;
  const cacheKey = `${content}||${fontStr}||${wrapWidth}`;
  const cached = textWrapCache.get(obj.id);

  if (cached && cached.cacheKey === cacheKey) return cached.lines;

  ctx.font = fontStr;
  const lines = wrapTextLines(ctx, content, wrapWidth);

  textWrapCache.set(obj.id, { cacheKey, lines });
  return lines;
}


function getCachedImage(src: string): HTMLImageElement | null {
  if (imageCache.has(src)) {
    const img = imageCache.get(src)!;
    if (img.complete) return img;
    return null;
  }
  
  const img = new Image();
  img.onload = () => {
    // When loaded, the running requestAnimationFrame loop will automatically draw it in the next frame
  };
  img.src = src;
  imageCache.set(src, img);
  return null;
}

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

const SLIDE_DIST = 60; // world units for slide animations

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash;
}

function drawOrganicStroke(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  strokeColor: string,
  lineWidth: number,
  seed: number
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const seedI = seed + i;
    const rx = seededRandom(seedI);
    const ry = seededRandom(seedI + 17);
    const jitterX = (rx - 0.5) * 0.8;
    const jitterY = (ry - 0.5) * 0.8;

    if (i === 0) {
      ctx.moveTo(pt.x + jitterX, pt.y + jitterY);
    } else {
      ctx.lineTo(pt.x + jitterX, pt.y + jitterY);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function renderAnimatedObject(
  ctx: CanvasRenderingContext2D,
  obj: AnimatedObject,
  state: import("./timeline").ObjectRenderState,
  localTime: number,
): void {
  ctx.save();

  let cx    = obj.x;
  let cy    = obj.y;
  let alpha = state.alpha;
  let scale = 1;

  const ep = state.entryProgress;  // 0→1 during entry (eased)
  const xp = state.exitProgress;   // 0→1 during exit
  // Raw linear progress — used for "draw" so hand & clip mask stay in perfect sync
  const rawEp = obj.duration > 0 ? Math.min(1, Math.max(0, (localTime - obj.startTime) / obj.duration)) : 1;

  // ── Entry animation ──
  switch (obj.animationType) {
    case "fade":
      alpha = state.phase === "exit" ? state.alpha : ep;
      break;

    case "draw":
      alpha = state.phase === "exit" ? state.alpha : ep;
      break;

    case "scale":
      scale = obj.scale ? lerp(obj.scale.from, obj.scale.to, ep) : ep;
      if (state.phase === "exit") alpha = state.alpha;
      break;

    case "move":
      if (obj.move) {
        cx = lerp(obj.move.fromX, obj.move.toX, ep);
        cy = lerp(obj.move.fromY, obj.move.toY, ep);
      }
      if (state.phase === "exit") alpha = state.alpha;
      break;

    case "slideLeft":
      cx = lerp(obj.x - SLIDE_DIST, obj.x, ep);
      alpha = state.phase === "exit" ? state.alpha : ep;
      break;

    case "slideRight":
      cx = lerp(obj.x + SLIDE_DIST, obj.x, ep);
      alpha = state.phase === "exit" ? state.alpha : ep;
      break;

    case "slideUp":
      cy = lerp(obj.y - SLIDE_DIST, obj.y, ep);
      alpha = state.phase === "exit" ? state.alpha : ep;
      break;

    case "slideDown":
      cy = lerp(obj.y + SLIDE_DIST, obj.y, ep);
      alpha = state.phase === "exit" ? state.alpha : ep;
      break;

    case "static":
      alpha = 1;
      break;
  }

  // ── Exit animation overrides position ──
  if (state.phase === "exit" && obj.exit) {
    switch (obj.exit.type) {
      case "fade":
        // alpha already set by state.alpha = 1 - exitProgress
        break;
      case "slideLeft":
        cx = lerp(obj.x, obj.x - SLIDE_DIST, xp);
        break;
      case "slideRight":
        cx = lerp(obj.x, obj.x + SLIDE_DIST, xp);
        break;
      case "slideUp":
        cy = lerp(obj.y, obj.y - SLIDE_DIST, xp);
        break;
      case "slideDown":
        cy = lerp(obj.y, obj.y + SLIDE_DIST, xp);
        break;
      case "none":
        alpha = xp < 1 ? 1 : 0;
        break;
    }
  }

  // ── Apply per-object keyframe transform tracks ─────────────────────────────────
  // These layer ON TOP of the entry/exit system above.
  // Position keyframes override cx/cy; scale/rotation multiply existing values.
  let tfRotation = 0;
  let tfScaleY = 1;
  if (obj.transformTracks) {
    const localT = localTime - obj.startTime;
    const tf: TransformState = interpolateTransform(obj.transformTracks, localT);

    // Position: override cx/cy if keyframes specify absolute position
    if (tf.x !== null) cx = tf.x;
    if (tf.y !== null) cy = tf.y;

    // Scale: multiply (keyframe scale of 2 makes object twice as big)
    scale *= tf.scaleX;
    tfScaleY = tf.scaleY;

    // Opacity: multiply (keyframe opacity of 0.5 makes object half-transparent)
    alpha *= tf.opacity;

    // Rotation: stored for ctx.rotate() call below
    tfRotation = tf.rotation;
  }

  ctx.globalAlpha = Math.min(1, Math.max(0, alpha));

  // Scale transform
  if (scale !== 1 || tfScaleY !== 1) {
    const pivotX = obj.type === "rect" ? cx + (obj.width ?? 0) / 2 : cx;
    const pivotY = obj.type === "rect" ? cy + (obj.height ?? 0) / 2 : cy;
    ctx.translate(pivotX, pivotY);
    ctx.scale(scale, scale * tfScaleY);
    ctx.translate(-pivotX, -pivotY);
  }

  // Rotation transform (from keyframe tracks)
  if (tfRotation !== 0) {
    const pivotX = obj.type === "rect" ? cx + (obj.width ?? 0) / 2
                 : obj.type === "circle" ? cx
                 : cx;
    const pivotY = obj.type === "rect" ? cy + (obj.height ?? 0) / 2
                 : obj.type === "circle" ? cy
                 : cy;
    ctx.translate(pivotX, pivotY);
    ctx.rotate(tfRotation);
    ctx.translate(-pivotX, -pivotY);
  }

  ctx.fillStyle   = obj.fillColor   ?? "#6366f1";
  ctx.strokeStyle = obj.strokeColor ?? "transparent";
  ctx.lineWidth   = obj.lineWidth   ?? 1;
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur  = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // ── Apply eraser exit clipping mask ──
  let clippedExit = false;
  if (state.phase === "exit" && obj.exit && obj.exit.type !== "none") {
    clippedExit = true;
    ctx.save();
    ctx.beginPath();
    if (obj.type === "rect") {
      const h = obj.height ?? 60;
      const eraserY = cy + xp * h;
      ctx.rect(cx - 20, eraserY, (obj.width ?? 100) + 40, h + 20);
    } else if (obj.type === "circle") {
      const r = obj.radius ?? 40;
      const eraserY = cy - r + xp * 2 * r;
      ctx.rect(cx - r - 20, eraserY, 2 * r + 40, 2 * r + 40);
    } else if (obj.type === "text") {
      const fontSize  = obj.fontSize ?? 16;
      const exitLines = getCachedWrappedLines(ctx, obj);
      const lineH   = fontSize * 1.4;
      const totalH  = exitLines.length * lineH;
      const eraserY = cy + xp * totalH;
      ctx.rect(cx - 20, eraserY, 10000, totalH + 20);
    }
    ctx.clip();
  }

  switch (obj.type) {
    case "rect": {
      const w = obj.width ?? 100, h = obj.height ?? 60, r = 8;
      if (obj.animationType === "draw" && state.phase === "entry") {
        // Organic Sketching Outline
        const perimeter = 2 * (w + h);
        const numPoints = Math.ceil((perimeter * ep) / 3) + 1;
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < numPoints; i++) {
          const p = (i / (numPoints - 1 || 1)) * ep;
          const pt = getRectPathPoint(obj, p);
          points.push({ x: cx + (pt.x - obj.x), y: cy + (pt.y - obj.y) });
        }
        const seed = hashCode(obj.id);
        const sketchColor = obj.strokeColor && obj.strokeColor !== "transparent"
          ? obj.strokeColor
          : (obj.fillColor && obj.fillColor !== "transparent" ? obj.fillColor : "#334155");
        drawOrganicStroke(ctx, points, sketchColor, obj.lineWidth ?? 2, seed);

        // Delayed Fill Fade-in during the final 15%
        if (ep > 0.85) {
          const fillAlpha = (ep - 0.85) / 0.15;
          ctx.save();
          ctx.globalAlpha = Math.min(1, Math.max(0, alpha)) * fillAlpha;
          ctx.beginPath();
          ctx.moveTo(cx + r, cy); ctx.lineTo(cx + w - r, cy);
          ctx.quadraticCurveTo(cx + w, cy, cx + w, cy + r);
          ctx.lineTo(cx + w, cy + h - r);
          ctx.quadraticCurveTo(cx + w, cy + h, cx + w - r, cy + h);
          ctx.lineTo(cx + r, cy + h);
          ctx.quadraticCurveTo(cx, cy + h, cx, cy + h - r);
          ctx.lineTo(cx, cy + r);
          ctx.quadraticCurveTo(cx, cy, cx + r, cy);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else {
        // Standard Completed Vector Layout
        ctx.beginPath();
        ctx.moveTo(cx + r, cy); ctx.lineTo(cx + w - r, cy);
        ctx.quadraticCurveTo(cx + w, cy, cx + w, cy + r);
        ctx.lineTo(cx + w, cy + h - r);
        ctx.quadraticCurveTo(cx + w, cy + h, cx + w - r, cy + h);
        ctx.lineTo(cx + r, cy + h);
        ctx.quadraticCurveTo(cx, cy + h, cx, cy + h - r);
        ctx.lineTo(cx, cy + r);
        ctx.quadraticCurveTo(cx, cy, cx + r, cy);
        ctx.closePath();
        ctx.fill();
        if (obj.strokeColor !== "transparent") ctx.stroke();
      }
      break;
    }
    case "circle": {
      const r = obj.radius ?? 40;
      if (obj.animationType === "draw" && state.phase === "entry") {
        // Organic Sketching Outline
        const perimeter = 2 * Math.PI * r;
        const numPoints = Math.ceil((perimeter * ep) / 3) + 1;
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < numPoints; i++) {
          const p = (i / (numPoints - 1 || 1)) * ep;
          const pt = getCirclePathPoint(obj, p);
          points.push({ x: cx + (pt.x - obj.x), y: cy + (pt.y - obj.y) });
        }
        const seed = hashCode(obj.id);
        const sketchColor = obj.strokeColor && obj.strokeColor !== "transparent"
          ? obj.strokeColor
          : (obj.fillColor && obj.fillColor !== "transparent" ? obj.fillColor : "#334155");
        drawOrganicStroke(ctx, points, sketchColor, obj.lineWidth ?? 2, seed);

        // Delayed Fill Fade-in during the final 15%
        if (ep > 0.85) {
          const fillAlpha = (ep - 0.85) / 0.15;
          ctx.save();
          ctx.globalAlpha = Math.min(1, Math.max(0, alpha)) * fillAlpha;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else {
        // Standard Completed Circle Layout
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        if (obj.strokeColor !== "transparent") ctx.stroke();
      }
      break;
    }
    case "text": {
      ctx.shadowColor  = "transparent";
      ctx.shadowBlur   = 0;
      const fontSize   = obj.fontSize ?? 16;
      const fontFamily = obj.fontFamily ?? "sans-serif";
      const fontWeight = obj.fontWeight ?? "normal";
      const fontStyle  = obj.fontStyle  ?? "normal";
      const textAlign  = obj.textAlign  ?? "left";
      const wrapWidth  = obj.textWrapWidth ?? 0;
      ctx.font         = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle    = obj.fillColor ?? "#1e293b";
      ctx.textBaseline = "top";
      // textAlign is set per-branch: "left" during draw animation, user-chosen after
      const lineH      = fontSize * 1.4;

      // Perf fix: use cached wrapped lines — no measureText every frame
      const allLines = getCachedWrappedLines(ctx, obj);

      // X position offset based on alignment
      const alignOffsetX = textAlign === "center" ? (wrapWidth / 2) : textAlign === "right" ? wrapWidth : 0;
      const drawX = cx + alignOffsetX;

      if (obj.animationType === "draw" && state.phase === "entry") {
        // During the draw reveal, always render left-to-right so the clip rect
        // and hand position are in sync regardless of final textAlign setting.
        ctx.textAlign = "left";
        const drawLines = allLines;
        const drawContent = drawLines.join("\n");
        const solved = solveTextProgress(ctx, drawContent, rawEp, fontSize, lineH, cx, cy);

        for (let i = 0; i < drawLines.length; i++) {
          const lineDrawnWidth = solved.lineReveals[i] ?? 0;

          if (lineDrawnWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(cx, cy + i * lineH, lineDrawnWidth, lineH * 1.5);
            ctx.clip();
            ctx.fillText(drawLines[i], cx, cy + i * lineH);

            if (obj.strokeText && obj.strokeColor) {
              ctx.strokeStyle = obj.strokeColor;
              ctx.lineWidth = Math.max(1, fontSize * 0.04);
              ctx.strokeText(drawLines[i], cx, cy + i * lineH);
            }

            ctx.restore();
          }
        }
      } else {
        // Idle / after animation: use the user's chosen alignment
        ctx.textAlign = textAlign;
        for (let i = 0; i < allLines.length; i++) {
          ctx.fillText(allLines[i], drawX, cy + i * lineH);
          if (obj.strokeText && obj.strokeColor) {
            ctx.strokeStyle = obj.strokeColor;
            ctx.lineWidth   = Math.max(1, fontSize * 0.04);
            ctx.strokeText(allLines[i], drawX, cy + i * lineH);
          }
        }
      }
      // Reset textAlign to default
      ctx.textAlign = "left";
      break;
    }
    case "image": {
      if (obj.src) {
        // Fetch or load the image asynchronously into canvas memory
        const img = getCachedImage(obj.src);
        if (img) {
          const w = obj.width ?? 160;
          const h = obj.height ?? 120;
          
          try {
            if (obj.animationType === "draw" && state.phase === "entry") {
              // Draw a sliding reveal clip mask (wipe) to simulate organic pen sketching
              ctx.save();
              ctx.beginPath();
              ctx.rect(cx, cy, w * ep, h);
              ctx.clip();
              ctx.drawImage(img, cx, cy, w, h);
              ctx.restore();
            } else {
              // Standard completed layout image
              ctx.drawImage(img, cx, cy, w, h);
            }
          } catch (err) {
            console.warn("[Render] Failed to draw image (might be an expired blob URL or broken source):", obj.src, err);
            // Draw a subtle placeholder box so the user knows an image is supposed to be here
            ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.rect(cx, cy, w, h);
            ctx.stroke();
            ctx.fillStyle = "rgba(239, 68, 68, 0.05)";
            ctx.fillRect(cx, cy, w, h);
            ctx.fillStyle = "#ef4444";
            ctx.font = "10px monospace";
            ctx.fillText("⚠️ Broken Image Link", cx + 8, cy + 8);
          }
        }
      }
      break;
    }
  }

  if (clippedExit) {
    ctx.restore();
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
  _W:             number,
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
  isExport?:   boolean,
): void {
  ctx.clearRect(0, 0, W, H);

  // Per-scene background or default
  ctx.fillStyle = scene?.background ?? "#f8fafc";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  applyCameraTransform(ctx, camera, W, H);
  if (!isExport) {
    drawGrid(ctx, camera, W, H);
  }

  if (scene) {
    // Render animated objects using LOCAL time
    for (const obj of scene.objects) {
      const state = getObjectRenderState(obj, localTime);
      if (!state) continue;
      renderAnimatedObject(ctx, obj, state, localTime);
    }

    // Render SVG draw objects using LOCAL time
    if (scene.svgObjects) {
      drawAllSvgPaths(ctx, scene.svgObjects, localTime);
    }

    // Render hand cursors
    if (hand) {
      drawUnifiedHand(ctx, scene, localTime, hand, camera.zoom, W, H, camera);
    }
  }

  ctx.restore();

  // HUD
  if (!isExport) {
    drawSceneHUD(ctx, camera, scene, globalTime ?? 0, totalDuration ?? 0, W);
  }
}