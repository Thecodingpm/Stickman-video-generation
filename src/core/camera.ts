export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

// Separate "target" state for smooth lerp interpolation
export interface CameraTarget {
  x: number;
  y: number;
  zoom: number;
}

export function createCamera(): Camera {
  return { x: 0, y: 0, zoom: 1 };
}

export function createCameraTarget(): CameraTarget {
  return { x: 0, y: 0, zoom: 1 };
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 20;

// Lerp factor per frame (0–1). Higher = snappier, lower = more inertia.
// At 60fps: 0.12 feels like Figma, 0.08 feels like Miro.
const LERP_FACTOR          = 0.12;  // manual pan (smooth/inertia feel)
const LERP_FACTOR_PLAYBACK = 0.18;  // keyframe playback (tighter tracking)

// Threshold below which we snap to target (prevents infinite micro-lerp)
const LERP_EPSILON = 0.0001;

// ── Transform ─────────────────────────────────────────────────────────────────
export function applyCameraTransform(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
}

// ── Target mutations (always modify target, never camera directly) ─────────────
export function panTarget(target: CameraTarget, dx: number, dy: number): CameraTarget {
  return { ...target, x: target.x + dx, y: target.y + dy };
}

export function zoomTargetToPoint(
  target: CameraTarget,
  scaleFactor: number,
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number
): CameraTarget {
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, target.zoom * scaleFactor));

  // World point under cursor before zoom
  const worldX = (screenX - canvasWidth / 2) / target.zoom + target.x;
  const worldY = (screenY - canvasHeight / 2) / target.zoom + target.y;

  // Reanchor: same world point stays under cursor after zoom
  const newX = worldX - (screenX - canvasWidth / 2) / newZoom;
  const newY = worldY - (screenY - canvasHeight / 2) / newZoom;

  return { x: newX, y: newY, zoom: newZoom };
}

// ── Interpolation ─────────────────────────────────────────────────────────────

export function lerpCamera(camera: Camera, target: CameraTarget, fast = false): Camera {
  const f  = fast ? LERP_FACTOR_PLAYBACK : LERP_FACTOR;
  const dx = target.x    - camera.x;
  const dy = target.y    - camera.y;
  const dz = target.zoom - camera.zoom;

  return {
    x:    Math.abs(dx) < LERP_EPSILON ? target.x    : camera.x    + dx * f,
    y:    Math.abs(dy) < LERP_EPSILON ? target.y    : camera.y    + dy * f,
    zoom: Math.abs(dz) < LERP_EPSILON ? target.zoom : camera.zoom + dz * f,
  };
}

// ── Legacy helpers (keyboard pan/zoom still update target) ────────────────────
export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

export function zoomCamera(camera: Camera, delta: number): Camera {
  return {
    ...camera,
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom + delta)),
  };
}