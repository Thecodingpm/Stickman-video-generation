/**
 * Scene store — replaces timelineStore as the single source of truth.
 * Wraps SceneManager + global playback state.
 */

import { buildSceneManager, getActiveScene, getLocalTime, getCameraForGlobalTime } from "../core/sceneManager";
import type { SceneManager, Scene } from "../core/sceneManager";
import { SvgEasing } from "../core/svgPath";
import { SVG_SHAPES } from "../core/svgShapes";
import type { AnimatedObject, CameraKeyframe } from "../core/timeline";
import type { SvgPathObject } from "../core/svgPath";

// ── Scene 1: Introduction ─────────────────────────────────────────────────────

const scene1Objects: AnimatedObject[] = [
  {
    id: "s1-title", type: "text",
    x: -180, y: -180,
    content: "Scene 1 — Introduction",
    fontSize: 26, fontFamily: "Georgia, serif",
    fillColor: "#1e293b",
    startTime: 0, duration: 1,
    animationType: "fade", easing: "easeOut",
  },
  {
    id: "s1-rect", type: "rect",
    x: -100, y: -80, width: 200, height: 100,
    fillColor: "#3b82f6", strokeColor: "#1d4ed8", lineWidth: 2,
    startTime: 0.5, duration: 1,
    animationType: "scale", scale: { from: 0, to: 1 }, easing: "spring",
  },
];

const scene1Svg: SvgPathObject[] = [
  {
    id: "s1-circle",
    pathData: SVG_SHAPES.circle,
    x: 140, y: -90, scaleX: 1.4, scaleY: 1.4,
    strokeColor: "#10b981", strokeWidth: 3,
    fillColor: "rgba(16,185,129,0.08)",
    startTime: 1.2, duration: 1.2,
    easing: SvgEasing.easeInOut,
  },
  {
    id: "s1-check",
    pathData: SVG_SHAPES.checkmark,
    x: 140, y: -90, scaleX: 0.9, scaleY: 0.9,
    strokeColor: "#10b981", strokeWidth: 4,
    startTime: 2.6, duration: 0.7,
    easing: SvgEasing.easeOut,
  },
];

const scene1Camera: CameraKeyframe[] = [
  { time: 0,   x: 0,   y: 0,  zoom: 1,   easing: "linear"    },
  { time: 2,   x: 40,  y: 10, zoom: 1.1, easing: "easeInOut" },
  { time: 3.5, x: 0,   y: 0,  zoom: 1,   easing: "easeInOut" },
];

// ── Scene 2: Shapes ───────────────────────────────────────────────────────────

const scene2Objects: AnimatedObject[] = [
  {
    id: "s2-title", type: "text",
    x: -160, y: -200,
    content: "Scene 2 — Shapes",
    fontSize: 26, fontFamily: "Georgia, serif",
    fillColor: "#1e293b",
    startTime: 0, duration: 1,
    animationType: "fade", easing: "easeOut",
  },
  {
    id: "s2-circle", type: "circle",
    x: -80, y: 20, radius: 55,
    fillColor: "#f59e0b", strokeColor: "#d97706", lineWidth: 2,
    startTime: 0.5, duration: 0.9,
    animationType: "scale", scale: { from: 0, to: 1 }, easing: "spring",
  },
  {
    id: "s2-rect", type: "rect",
    x: 50, y: -30, width: 160, height: 90,
    fillColor: "#8b5cf6", strokeColor: "#7c3aed", lineWidth: 2,
    startTime: 1.0, duration: 1,
    animationType: "move",
    move: { fromX: 300, fromY: -30, toX: 50, toY: -30 },
    easing: "easeOut",
  },
];

const scene2Svg: SvgPathObject[] = [
  {
    id: "s2-star",
    pathData: SVG_SHAPES.star,
    x: -200, y: -60, scaleX: 1.6, scaleY: 1.6,
    strokeColor: "#f59e0b", strokeWidth: 3,
    fillColor: "rgba(245,158,11,0.1)",
    startTime: 1.6, duration: 1.2,
    easing: SvgEasing.easeInOut,
  },
  {
    id: "s2-arrow",
    pathData: SVG_SHAPES.arrowRight,
    x: -60, y: 110, scaleX: 2, scaleY: 2,
    strokeColor: "#ec4899", strokeWidth: 4,
    startTime: 2.4, duration: 0.8,
    easing: SvgEasing.easeOut,
  },
];

const scene2Camera: CameraKeyframe[] = [
  { time: 0,   x: 0,    y: 0,  zoom: 1,    easing: "linear"    },
  { time: 1.5, x: -30,  y: 20, zoom: 1.15, easing: "easeInOut" },
  { time: 3,   x: 0,    y: 0,  zoom: 1,    easing: "easeInOut" },
];

// ── Scene 3: Conclusion ───────────────────────────────────────────────────────

const scene3Objects: AnimatedObject[] = [
  {
    id: "s3-title", type: "text",
    x: -180, y: -180,
    content: "Scene 3 — Conclusion",
    fontSize: 26, fontFamily: "Georgia, serif",
    fillColor: "#1e293b",
    startTime: 0, duration: 1,
    animationType: "fade", easing: "easeOut",
  },
  {
    id: "s3-sub", type: "text",
    x: -150, y: -140,
    content: "VideoScribe Engine ✓",
    fontSize: 18, fontFamily: "monospace",
    fillColor: "#6366f1",
    startTime: 0.8, duration: 1,
    animationType: "fade", easing: "easeOut",
  },
];

const scene3Svg: SvgPathObject[] = [
  {
    id: "s3-bulb",
    pathData: SVG_SHAPES.lightBulb,
    x: -60, y: -60, scaleX: 1.8, scaleY: 1.8,
    strokeColor: "#f59e0b", strokeWidth: 2.5,
    fillColor: "rgba(245,158,11,0.07)",
    startTime: 1.2, duration: 1.6,
    easing: SvgEasing.easeInOut,
  },
  {
    id: "s3-speech",
    pathData: SVG_SHAPES.speechBubble,
    x: 100, y: -80, scaleX: 1.6, scaleY: 1.6,
    strokeColor: "#6366f1", strokeWidth: 3,
    fillColor: "rgba(99,102,241,0.07)",
    startTime: 2.4, duration: 1.2,
    easing: SvgEasing.easeInOut,
  },
];

const scene3Camera: CameraKeyframe[] = [
  { time: 0,   x: 0,   y: 0,  zoom: 0.95, easing: "linear"    },
  { time: 2,   x: 20,  y: 10, zoom: 1.1,  easing: "easeInOut" },
  { time: 4,   x: 0,   y: 0,  zoom: 1,    easing: "easeInOut" },
];

// ── Build manager ─────────────────────────────────────────────────────────────

function computeSceneDuration(scene: Scene): number {
  if (scene.objects.length === 0 && scene.svgObjects.length === 0) {
    return scene.duration; // keep manual duration for empty scenes
  }
  let max = 0;
  for (const obj of scene.objects) {
    max = Math.max(max, obj.startTime + obj.duration);
  }
  for (const obj of scene.svgObjects) {
    max = Math.max(max, obj.startTime + obj.duration);
  }
  return max > 0 ? max : scene.duration;
}

function buildStore() {
  const manager: SceneManager = buildSceneManager([
    { id: "scene-1", name: "Introduction", duration: 3.3,   objects: scene1Objects, svgObjects: scene1Svg, cameraKeyframes: scene1Camera },
    { id: "scene-2", name: "Shapes",       duration: 3.2, objects: scene2Objects, svgObjects: scene2Svg, cameraKeyframes: scene2Camera },
    { id: "scene-3", name: "Conclusion",   duration: 3.6, objects: scene3Objects, svgObjects: scene3Svg, cameraKeyframes: scene3Camera },
  ]);

  let currentTime = 0;
  let isPlaying   = false;

  // ── Undo/Redo history ───────────────────────────────────────────────────
  type Snapshot = string; // JSON of manager scenes
  const history: Snapshot[] = [];
  let historyIdx = -1;

  const snapshot = () => JSON.stringify(manager.scenes.map(s => ({
    ...s,
    objects:    s.objects.map(o => ({ ...o })),
    svgObjects: s.svgObjects.map(o => ({ ...o })),
  })));

  const saveHistory = () => {
    // Drop any redo states ahead of current
    history.splice(historyIdx + 1);
    history.push(snapshot());
    historyIdx = history.length - 1;
    // Cap at 50 states
    if (history.length > 50) { history.shift(); historyIdx--; }
  };

  const restoreSnapshot = (snap: Snapshot) => {
    const parsed = JSON.parse(snap);
    manager.scenes = parsed;
    rebuildStartTimes();
    notify();
  };

  // Save initial state
  saveHistory();

  const listeners = new Set<() => void>();
  const notify    = () => listeners.forEach(fn => fn());

  const rebuildStartTimes = () => {
    let cursor = 0;
    for (const s of manager.scenes) {
      s.startTime = cursor;
      cursor += s.duration;
    }
    manager.totalDuration = Math.round(cursor * 100) / 100;
  };

  const syncSceneDuration = (scene: Scene) => {
    let max = 0;
    for (const obj of scene.objects) {
      max = Math.max(max, obj.startTime + obj.duration);
    }
    for (const obj of scene.svgObjects) {
      max = Math.max(max, obj.startTime + obj.duration);
    }
    // Only shrink if objects exist, otherwise keep manual duration
    if (scene.objects.length > 0 || scene.svgObjects.length > 0) {
      scene.duration = Math.max(max, 0.5); // minimum 0.5s
    }
    rebuildStartTimes();
  };

  return {
    getManager:    () => manager,
    getCurrentTime:() => currentTime,
    isPlaying:     () => isPlaying,
    get totalDuration() { return manager.totalDuration; },

    // Active scene + local time (used by render)
    getActiveScene: () => getActiveScene(manager, currentTime),
    getLocalTime:   () => {
      const s = getActiveScene(manager, currentTime);
      return s ? getLocalTime(s, currentTime) : 0;
    },
    getCameraTarget: () => getCameraForGlobalTime(manager, currentTime),

    subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },

    play:  () => { if (currentTime >= manager.totalDuration) currentTime = 0; isPlaying = true;  notify(); },
    pause: () => { isPlaying = false; notify(); },
    reset: () => { isPlaying = false; currentTime = 0; notify(); },
    seek:  (t: number) => { currentTime = Math.min(manager.totalDuration, Math.max(0, t)); notify(); },

    tick: (dt: number) => {
      if (!isPlaying) return;
      currentTime = Math.min(manager.totalDuration, currentTime + dt);
      if (currentTime >= manager.totalDuration) isPlaying = false;
      notify();
    },

    // ── Mutation methods ──────────────────────────────────────────────────────────
    addObject: (sceneId: string, obj: AnimatedObject) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      scene.objects.push(obj);
      syncSceneDuration(scene);
      notify();
      saveHistory();
    },

    addSvgObject: (sceneId: string, obj: SvgPathObject) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      scene.svgObjects.push(obj);
      syncSceneDuration(scene);
      notify();
      saveHistory();
    },

    removeObject: (sceneId: string, objId: string) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      scene.objects    = scene.objects.filter(o => o.id !== objId);
      scene.svgObjects = scene.svgObjects.filter(o => o.id !== objId);
      syncSceneDuration(scene);
      notify();
      saveHistory();
    },

    updateObject: (sceneId: string, objId: string, patch: Partial<AnimatedObject>) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      const obj = scene.objects.find(o => o.id === objId);
      if (obj) Object.assign(obj, patch);
      syncSceneDuration(scene);
      notify();
    },

    // ── Camera keyframes ──────────────────────────────────────────────────────────

    addCameraKeyframe: (sceneId: string, kf: import("../core/timeline").CameraKeyframe) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      // Remove any existing keyframe at same time (within 0.05s tolerance)
      scene.cameraKeyframes = scene.cameraKeyframes.filter(k => Math.abs(k.time - kf.time) > 0.05);
      scene.cameraKeyframes.push(kf);
      scene.cameraKeyframes.sort((a, b) => a.time - b.time);
      notify();
      saveHistory();
    },

    removeCameraKeyframe: (sceneId: string, time: number) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      scene.cameraKeyframes = scene.cameraKeyframes.filter(k => Math.abs(k.time - time) > 0.05);
      notify();
      saveHistory();
    },

    updateCameraKeyframe: (
      sceneId: string,
      time: number,
      patch: Partial<import("../core/timeline").CameraKeyframe>
    ) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      const kf = scene.cameraKeyframes.find(k => Math.abs(k.time - time) <= 0.05);
      if (kf) Object.assign(kf, patch);
      notify();
      saveHistory();
    },

    extendSceneDuration: (sceneId: string, minDuration: number) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      if (minDuration > scene.duration) {
        scene.duration = minDuration;
        rebuildStartTimes();
      }
      notify();
    },

    addScene: () => {
      const newId = `scene-${Date.now()}`;
      const newScene = {
        id: newId,
        name: "New Scene",
        duration: 4,
        startTime: manager.totalDuration,
        objects: [],
        svgObjects: [],
        cameraKeyframes: [{ time: 0, x: 0, y: 0, zoom: 1, easing: "linear" as const }],
      };
      manager.scenes.push(newScene);
      rebuildStartTimes();
      notify();
      saveHistory();
      return newId;
    },

    deleteScene: (sceneId: string) => {
      if (manager.scenes.length <= 1) return; // keep at least 1
      manager.scenes = manager.scenes.filter(s => s.id !== sceneId);
      rebuildStartTimes();
      currentTime = Math.min(currentTime, manager.totalDuration);
      notify();
      saveHistory();
    },

    renameScene: (sceneId: string, name: string) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (scene) { scene.name = name; notify(); }
    },

    reorderScenes: (fromIdx: number, toIdx: number) => {
      const scenes = [...manager.scenes];
      const [moved] = scenes.splice(fromIdx, 1);
      scenes.splice(toIdx, 0, moved);
      manager.scenes = scenes;
      rebuildStartTimes();
      notify();
      saveHistory();
    },

    undo: () => {
      if (historyIdx <= 0) return;
      historyIdx--;
      restoreSnapshot(history[historyIdx]);
    },

    redo: () => {
      if (historyIdx >= history.length - 1) return;
      historyIdx++;
      restoreSnapshot(history[historyIdx]);
    },

    // ── Save / Load ───────────────────────────────────────────────────────────────
    saveProject: () => {
      const data = {
        version: 1,
        savedAt: new Date().toISOString(),
        scenes: manager.scenes.map(s => ({
          ...s,
          objects:    s.objects.map(o => ({ ...o })),
          svgObjects: s.svgObjects.map(o => ({
            ...o,
            easing: undefined, // functions can't serialize
          })),
        })),
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "project.wbs";
      a.click();
      URL.revokeObjectURL(url);
    },

    loadProject: (json: string) => {
      try {
        const data = JSON.parse(json);
        if (!data.scenes) throw new Error("Invalid project file");
        manager.scenes = data.scenes.map((s: any) => ({
          ...s,
          svgObjects: (s.svgObjects ?? []).map((o: any) => ({
            ...o,
            easing: undefined,
          })),
        }));
        for (const s of manager.scenes) {
          let max = 0;
          for (const obj of s.objects) max = Math.max(max, obj.startTime + obj.duration);
          for (const obj of s.svgObjects) max = Math.max(max, obj.startTime + obj.duration);
          if (s.objects.length > 0 || s.svgObjects.length > 0) {
            s.duration = Math.max(max, 0.5);
          }
        }
        rebuildStartTimes();
        currentTime = 0;
        isPlaying   = false;
        notify();
        // Auto-save after load
        localStorage.setItem("wbs-autosave", json);
      } catch (err) {
        console.error("Failed to load project:", err);
        throw err;
      }
    },

    autoSave: () => {
      try {
        const data = {
          version: 1,
          savedAt: new Date().toISOString(),
          scenes: manager.scenes.map(s => ({
            ...s,
            objects:    s.objects.map(o => ({ ...o })),
            svgObjects: s.svgObjects.map(o => ({ ...o, easing: undefined })),
          })),
        };
        localStorage.setItem("wbs-autosave", JSON.stringify(data));
      } catch {}
    },

    loadAutoSave: (): boolean => {
      try {
        const raw = localStorage.getItem("wbs-autosave");
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data.scenes) return false;
        manager.scenes = data.scenes.map((s: any) => ({
          ...s,
          svgObjects: (s.svgObjects ?? []).map((o: any) => ({ ...o, easing: undefined })),
        }));
        for (const s of manager.scenes) {
          let max = 0;
          for (const obj of s.objects) max = Math.max(max, obj.startTime + obj.duration);
          for (const obj of s.svgObjects) max = Math.max(max, obj.startTime + obj.duration);
          if (s.objects.length > 0 || s.svgObjects.length > 0) {
            s.duration = Math.max(max, 0.5);
          }
        }
        rebuildStartTimes();
        notify();
        return true;
      } catch { return false; }
    },

    newProject: () => {
      manager.scenes = [{
        id: "scene-1",
        name: "Scene 1",
        duration: 5,
        startTime: 0,
        objects: [],
        svgObjects: [],
        cameraKeyframes: [{ time: 0, x: 0, y: 0, zoom: 1, easing: "linear" as const }],
      }];
      manager.totalDuration = 5;
      currentTime = 0;
      isPlaying   = false;
      localStorage.removeItem("wbs-autosave");
      notify();
    },
  };
}

export const sceneStore = buildStore();
