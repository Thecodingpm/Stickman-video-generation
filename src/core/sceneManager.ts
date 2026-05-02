/**
 * Scene management system.
 * A Scene is a self-contained animation unit with its own objects,
 * SVG paths, and camera keyframes. The global timeline flows through
 * all scenes sequentially.
 */

import { getCameraAtTime, lerp } from "./timeline";
import type { AnimatedObject, CameraKeyframe } from "./timeline";
import type { SvgPathObject } from "./svgPath";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Scene {
  id:              string;
  name:            string;
  duration:        number;          // seconds this scene lasts
  startTime:       number;          // global time when scene begins (set by sceneManager)
  objects:         AnimatedObject[];
  svgObjects:      SvgPathObject[];
  cameraKeyframes: CameraKeyframe[];
  background?:     string;          // optional bg color override
}

export interface SceneManager {
  scenes:        Scene[];
  totalDuration: number;
}

// ── Build manager ─────────────────────────────────────────────────────────────
// Calculates startTime for each scene based on cumulative duration.

export function buildSceneManager(scenes: Omit<Scene, "startTime">[]): SceneManager {
  let cursor = 0;
  const built: Scene[] = scenes.map(s => {
    const scene = { ...s, startTime: cursor };
    cursor += s.duration;
    return scene;
  });
  return { scenes: built, totalDuration: cursor };
}

// ── Active scene query ─────────────────────────────────────────────────────────

export function getActiveScene(manager: SceneManager, globalTime: number): Scene | null {
  for (const scene of manager.scenes) {
    const end = scene.startTime + scene.duration;
    if (globalTime >= scene.startTime && globalTime < end) return scene;
  }
  // Return last scene if at/past end
  if (manager.scenes.length > 0 && globalTime >= manager.totalDuration) {
    return manager.scenes[manager.scenes.length - 1];
  }
  return null;
}

// ── Local time ────────────────────────────────────────────────────────────────
// Each scene's objects use local time (0 = scene start).

export function getLocalTime(scene: Scene, globalTime: number): number {
  return Math.max(0, globalTime - scene.startTime);
}

// ── Camera at global time (with cross-scene transition) ───────────────────────
// Within a scene: interpolate its own keyframes.
// At scene boundary: lerp between last cam of prev scene and first cam of next.

const TRANSITION_DURATION = 0.4; // seconds of cross-fade between scenes

export function getCameraForGlobalTime(
  manager: SceneManager,
  globalTime: number,
): { x: number; y: number; zoom: number } {
  const { scenes } = manager;
  if (scenes.length === 0) return { x: 0, y: 0, zoom: 1 };

  // Find which scene we're in
  let sceneIdx = scenes.findIndex(
    s => globalTime >= s.startTime && globalTime < s.startTime + s.duration
  );

  // Past end — return final camera of last scene
  if (sceneIdx === -1) {
    if (globalTime >= manager.totalDuration) {
      const last = scenes[scenes.length - 1];
      const localTime = last.duration;
      return getCameraAtTime(last.cameraKeyframes, localTime);
    }
    sceneIdx = 0;
  }

  const scene     = scenes[sceneIdx];
  const localTime = getLocalTime(scene, globalTime);
  const sceneCam  = getCameraAtTime(scene.cameraKeyframes, localTime);

  // Check if we're near the END of this scene → blend into next scene's start
  const timeUntilEnd = (scene.startTime + scene.duration) - globalTime;
  const nextScene    = scenes[sceneIdx + 1];

  if (nextScene && timeUntilEnd < TRANSITION_DURATION) {
    const t       = 1 - timeUntilEnd / TRANSITION_DURATION; // 0→1 as we approach boundary
    const nextCam = getCameraAtTime(nextScene.cameraKeyframes, 0);
    return {
      x:    lerp(sceneCam.x,    nextCam.x,    smoothstep(t)),
      y:    lerp(sceneCam.y,    nextCam.y,    smoothstep(t)),
      zoom: lerp(sceneCam.zoom, nextCam.zoom, smoothstep(t)),
    };
  }

  return sceneCam;
}

// ── Smooth transition easing ──────────────────────────────────────────────────

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}
