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
import type { TransformKeyframe } from "../core/transformInterpolator";
import { upsertKeyframe, removeKeyframeById, patchKeyframe } from "../core/transformInterpolator";

// ── Scene 1: Introduction ─────────────────────────────────────────────────────

const scene1Objects: AnimatedObject[] = [
  {
    id: "s1-title", type: "text",
    x: -180, y: -180,
    content: "Scene 1 — Introduction",
    fontSize: 26, fontFamily: "Georgia, serif",
    fillColor: "#1e293b",
    startTime: 0, duration: 1,
    animationType: "draw", easing: "easeOut",
  },
  {
    id: "s1-rect", type: "rect",
    x: -100, y: -80, width: 200, height: 100,
    fillColor: "#3b82f6", strokeColor: "#1d4ed8", lineWidth: 2,
    startTime: 0.5, duration: 1,
    animationType: "draw", scale: { from: 0, to: 1 }, easing: "spring",
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
    animationType: "draw", easing: "easeOut",
  },
  {
    id: "s2-circle", type: "circle",
    x: -80, y: 20, radius: 55,
    fillColor: "#f59e0b", strokeColor: "#d97706", lineWidth: 2,
    startTime: 0.5, duration: 0.9,
    animationType: "draw", scale: { from: 0, to: 1 }, easing: "spring",
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
    animationType: "draw", easing: "easeOut",
  },
  {
    id: "s3-sub", type: "text",
    x: -150, y: -140,
    content: "VideoScribe Engine ✓",
    fontSize: 18, fontFamily: "monospace",
    fillColor: "#6366f1",
    startTime: 0.8, duration: 1,
    animationType: "draw", easing: "easeOut",
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

/*
function _computeSceneDuration(scene: Scene): number {
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
*/

function buildStore() {
  const manager: SceneManager = buildSceneManager([
    { id: "scene-1", name: "Introduction", duration: 3.3,   objects: scene1Objects, svgObjects: scene1Svg, cameraKeyframes: scene1Camera },
    { id: "scene-2", name: "Shapes",       duration: 3.2, objects: scene2Objects, svgObjects: scene2Svg, cameraKeyframes: scene2Camera },
    { id: "scene-3", name: "Conclusion",   duration: 3.6, objects: scene3Objects, svgObjects: scene3Svg, cameraKeyframes: scene3Camera },
  ]);
  manager.audioTracks = [];

  let currentTime = 0;
  let isPlaying   = false;
  let currentProjectId: string | null = null;

  // ── Undo/Redo history ───────────────────────────────────────────────────
  type Snapshot = string; // JSON of manager state
  const history: Snapshot[] = [];
  let historyIdx = -1;
  let isInitializing = true;

  const snapshot = () => JSON.stringify({
    scenes: manager.scenes.map(s => ({
      ...s,
      objects:    s.objects.map(o => ({ ...o })),
      svgObjects: s.svgObjects.map(o => ({ ...o })),
    })),
    audioTracks: (manager.audioTracks ?? []).map(t => ({ ...t })),
    subtitles: (manager.subtitles ?? []).map(s => ({ ...s })),
  });

  const getProjectName = (id: string) => {
    try {
      const rawMeta = localStorage.getItem("wbs-projects");
      if (rawMeta) {
        const meta = JSON.parse(rawMeta);
        const p = meta.find((x: any) => x.id === id);
        if (p) return p.name;
      }
    } catch {}
    return "Untitled Project";
  };

  const performAutoSave = () => {
    try {
      if (!currentProjectId) return;
      const data = {
        version: 1,
        savedAt: new Date().toISOString(),
        scenes: manager.scenes.map(s => ({
          ...s,
          objects:    s.objects.map(o => ({ ...o })),
          svgObjects: (s.svgObjects ?? []).map(o => ({ ...o, easing: undefined })),
        })),
        audioTracks: manager.audioTracks ?? [],
        subtitles: manager.subtitles ?? [],
      };
      
      // Save individual project data
      localStorage.setItem(`wbs-project-${currentProjectId}`, JSON.stringify({
        id: currentProjectId,
        name: getProjectName(currentProjectId),
        scenes: data.scenes,
        audioTracks: data.audioTracks,
        subtitles: data.subtitles,
        lastUpdated: data.savedAt,
      }));

      // Update metadata list
      const rawMeta = localStorage.getItem("wbs-projects");
      let metaList = rawMeta ? JSON.parse(rawMeta) : [];
      if (!Array.isArray(metaList)) metaList = [];
      
      const idx = metaList.findIndex((p: any) => p.id === currentProjectId);
      const updatedItem = {
        id: currentProjectId,
        name: getProjectName(currentProjectId),
        lastUpdated: data.savedAt,
        duration: manager.totalDuration,
      };
      
      if (idx >= 0) {
        metaList[idx] = updatedItem;
      } else {
        metaList.push(updatedItem);
      }
      
      localStorage.setItem("wbs-projects", JSON.stringify(metaList));
    } catch (e) {
      console.error("Failed performAutoSave:", e);
    }
  };

  const saveHistory = () => {
    // Drop any redo states ahead of current
    history.splice(historyIdx + 1);
    history.push(snapshot());
    historyIdx = history.length - 1;
    // Cap at 50 states
    if (history.length > 50) { history.shift(); historyIdx--; }

    // Instant autosave to localStorage on every change (except initial startup before load!)
    if (!isInitializing) {
      performAutoSave();
    }
  };

  const restoreSnapshot = (snap: Snapshot) => {
    const parsed = JSON.parse(snap);
    if (Array.isArray(parsed)) {
      manager.scenes = parsed;
      manager.audioTracks = [];
    } else {
      manager.scenes = parsed.scenes;
      manager.audioTracks = parsed.audioTracks ?? [];
      manager.subtitles = parsed.subtitles ?? [];
    }
    rebuildStartTimes();
    notify();

    // Instant autosave to localStorage on undo/redo!
    performAutoSave();
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

  const store = {
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

    hydrateProjectData: (data: any) => {
      if (!data || !data.scenes) return false;
      manager.scenes = data.scenes.map((s: any) => ({
        ...s,
        svgObjects: (s.svgObjects ?? []).map((o: any) => ({ ...o, easing: undefined })),
      }));
      manager.audioTracks = data.audioTracks ?? [];
      manager.subtitles = data.subtitles ?? [];
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
      isPlaying = false;
      notify();
      return true;
    },

    getProjectJson: () => {
      return {
        version: 1,
        savedAt: new Date().toISOString(),
        scenes: manager.scenes.map(s => ({
          ...s,
          objects:    s.objects.map(o => ({ ...o })),
          svgObjects: (s.svgObjects ?? []).map(o => ({ ...o, easing: undefined })),
        })),
        audioTracks: manager.audioTracks ?? [],
        subtitles: manager.subtitles ?? [],
      };
    },

    tick: (dt: number) => {
      if (!isPlaying) return;
      currentTime = Math.min(manager.totalDuration, currentTime + dt);
      if (currentTime >= manager.totalDuration) isPlaying = false;
      notify();
    },

    // ── Mutation methods ──────────────────────────────────────────────────────────
    addAudioTrack: (track: Omit<import("../core/sceneManager").AudioTrack, "id">) => {
      if (!manager.audioTracks) manager.audioTracks = [];
      const newTrack = {
        ...track,
        id: `audio-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      };
      manager.audioTracks.push(newTrack);
      notify();
      saveHistory();
    },

    removeAudioTrack: (id: string) => {
      if (!manager.audioTracks) return;
      manager.audioTracks = manager.audioTracks.filter(t => t.id !== id);
      notify();
      saveHistory();
    },

    updateAudioTrack: (id: string, patch: Partial<import("../core/sceneManager").AudioTrack>) => {
      if (!manager.audioTracks) return;
      const track = manager.audioTracks.find(t => t.id === id);
      if (track) {
        Object.assign(track, patch);
        notify();
      }
    },

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

    updateSvgObject: (sceneId: string, objId: string, patch: Partial<SvgPathObject>) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      const obj = scene.svgObjects.find(o => o.id === objId);
      if (obj) Object.assign(obj, patch);
      syncSceneDuration(scene);
      notify();
    },

    // ── Object Keyframe management ───────────────────────────────────────────────
    addObjectKeyframe: (sceneId: string, objId: string, kf: TransformKeyframe) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      const obj = scene.objects.find(o => o.id === objId) || scene.svgObjects.find(o => o.id === objId);
      if (!obj) return;
      if (!obj.transformTracks) {
        obj.transformTracks = { keyframes: [] };
      }
      obj.transformTracks = upsertKeyframe(obj.transformTracks, kf);
      notify();
      saveHistory();
    },

    removeObjectKeyframe: (sceneId: string, objId: string, kfId: string) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      const obj = scene.objects.find(o => o.id === objId) || scene.svgObjects.find(o => o.id === objId);
      if (!obj || !obj.transformTracks) return;
      obj.transformTracks = removeKeyframeById(obj.transformTracks, kfId);
      notify();
      saveHistory();
    },

    updateObjectKeyframe: (sceneId: string, objId: string, kfId: string, patch: Partial<TransformKeyframe>) => {
      const scene = manager.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      const obj = scene.objects.find(o => o.id === objId) || scene.svgObjects.find(o => o.id === objId);
      if (!obj || !obj.transformTracks) return;
      obj.transformTracks = patchKeyframe(obj.transformTracks, kfId, patch);
      notify();
      saveHistory();
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
        audioTracks: manager.audioTracks ?? [],
        subtitles: manager.subtitles ?? [],
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

    loadProject: (param: string): boolean => {
      try {
        if (param.trim().startsWith("{")) {
          // JSON import
          const data = JSON.parse(param);
          if (!data.scenes) return false;
          manager.scenes = data.scenes.map((s: any) => ({
            ...s,
            svgObjects: (s.svgObjects ?? []).map((o: any) => ({ ...o, easing: undefined })),
          }));
          manager.audioTracks = data.audioTracks ?? [];
          manager.subtitles = data.subtitles ?? [];
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
          isPlaying = false;
          history.length = 0;
          historyIdx = -1;
          saveHistory();
          notify();
          return true;
        } else {
          // projectId load
          const raw = localStorage.getItem(`wbs-project-${param}`);
          if (!raw) return false;
          const data = JSON.parse(raw);
          if (!data.scenes) return false;
          
          currentProjectId = param;
          localStorage.setItem("wbs-active-project-id", param);
          
          manager.scenes = data.scenes.map((s: any) => ({
            ...s,
            svgObjects: (s.svgObjects ?? []).map((o: any) => ({ ...o, easing: undefined })),
          }));
          manager.audioTracks = data.audioTracks ?? [];
          manager.subtitles = data.subtitles ?? [];
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
          isPlaying = false;
          history.length = 0;
          historyIdx = -1;
          saveHistory();
          notify();
          return true;
        }
      } catch (err) {
        console.error("Failed to load project:", err);
        return false;
      }
    },

    autoSave: () => {
      performAutoSave();
    },

    loadAutoSave: (): boolean => {
      try {
        if (!currentProjectId) return false;
        const raw = localStorage.getItem(`wbs-project-${currentProjectId}`);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data.scenes) return false;
        manager.scenes = data.scenes.map((s: any) => ({
          ...s,
          svgObjects: (s.svgObjects ?? []).map((o: any) => ({ ...o, easing: undefined })),
        }));
        manager.audioTracks = data.audioTracks ?? [];
        manager.subtitles = data.subtitles ?? [];
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
      store.createProject("Untitled Project");
    },

    getCurrentProjectId: () => currentProjectId,

    listProjects: () => {
      try {
        const raw = localStorage.getItem("wbs-projects");
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },

    createProject: (name: string, templateName?: string): string => {
      const id = "proj-" + Math.random().toString(36).substring(2, 11);
      let startingScenes: Scene[] = [];
      
      if (templateName === "startup-pitch") {
        startingScenes = [
          {
            id: `sc-pitch-1`,
            name: "The Problem",
            duration: 5,
            startTime: 0,
            objects: [
              {
                id: "p1-title", type: "text", x: -200, y: -150,
                content: "The Problem We Face",
                fontSize: 28, fontFamily: "Georgia, serif", fillColor: "#ef4444",
                startTime: 0.5, duration: 1.2, animationType: "draw", easing: "easeOut"
              },
              {
                id: "p1-desc", type: "text", x: -200, y: -90,
                content: "Designing whiteboard explainers is slow and expensive.",
                fontSize: 18, fontFamily: "sans-serif", fillColor: "#64748b",
                startTime: 1.5, duration: 1.8, animationType: "draw", easing: "easeOut"
              }
            ],
            svgObjects: [
              {
                id: "p1-bubble", pathData: SVG_SHAPES.speechBubble, x: -50, y: 30, scaleX: 1.8, scaleY: 1.8,
                strokeColor: "#ef4444", strokeWidth: 3, fillColor: "rgba(239,68,68,0.05)",
                startTime: 2.5, duration: 1.5, easing: SvgEasing.easeInOut
              }
            ],
            cameraKeyframes: [
              { time: 0, x: 0, y: 0, zoom: 1, easing: "linear" },
              { time: 3, x: -30, y: -20, zoom: 1.1, easing: "easeInOut" }
            ]
          },
          {
            id: `sc-pitch-2`,
            name: "Our Solution",
            duration: 5,
            startTime: 5,
            objects: [
              {
                id: "p2-title", type: "text", x: -220, y: -150,
                content: "ScribeFlow Video Engine",
                fontSize: 28, fontFamily: "Georgia, serif", fillColor: "#10b981",
                startTime: 0.5, duration: 1.2, animationType: "draw", easing: "easeOut"
              },
              {
                id: "p2-desc", type: "text", x: -220, y: -90,
                content: "Create beautifully-animated vector explainers in seconds.",
                fontSize: 18, fontFamily: "sans-serif", fillColor: "#64748b",
                startTime: 1.5, duration: 1.8, animationType: "draw", easing: "easeOut"
              }
            ],
            svgObjects: [
              {
                id: "p2-star", pathData: SVG_SHAPES.star, x: 100, y: -40, scaleX: 2.2, scaleY: 2.2,
                strokeColor: "#f59e0b", strokeWidth: 3, fillColor: "rgba(245,158,11,0.08)",
                startTime: 2.2, duration: 1.5, easing: SvgEasing.easeInOut
              },
              {
                id: "p2-check", pathData: SVG_SHAPES.checkmark, x: -80, y: 20, scaleX: 1.3, scaleY: 1.3,
                strokeColor: "#10b981", strokeWidth: 4,
                startTime: 3.2, duration: 1.0, easing: SvgEasing.easeOut
              }
            ],
            cameraKeyframes: [
              { time: 0, x: 0, y: 0, zoom: 1, easing: "linear" },
              { time: 4, x: 20, y: 10, zoom: 1.15, easing: "easeInOut" }
            ]
          }
        ];
      } else if (templateName === "lesson-opener") {
        startingScenes = [
          {
            id: `sc-lesson-1`,
            name: "Title Card",
            duration: 6,
            startTime: 0,
            objects: [
              {
                id: "l1-title", type: "text", x: -220, y: -160,
                content: "Welcome to Astronomy 101",
                fontSize: 28, fontFamily: "Georgia, serif", fillColor: "#6366f1",
                startTime: 0.5, duration: 1.5, animationType: "draw", easing: "easeOut"
              },
              {
                id: "l1-sub", type: "text", x: -220, y: -100,
                content: "Chapter 1: The Cosmic Lifecycle",
                fontSize: 18, fontFamily: "monospace", fillColor: "#8b5cf6",
                startTime: 1.8, duration: 1.2, animationType: "draw", easing: "easeOut"
              }
            ],
            svgObjects: [
              {
                id: "l1-bulb", pathData: SVG_SHAPES.lightBulb, x: 80, y: -30, scaleX: 2.0, scaleY: 2.0,
                strokeColor: "#f59e0b", strokeWidth: 3, fillColor: "rgba(245,158,11,0.08)",
                startTime: 2.5, duration: 1.8, easing: SvgEasing.easeInOut
              }
            ],
            cameraKeyframes: [
              { time: 0, x: 0, y: 0, zoom: 1, easing: "linear" }
            ]
          }
        ];
      } else if (templateName === "product-reveal") {
        startingScenes = [
          {
            id: `sc-reveal-1`,
            name: "Big Reveal",
            duration: 5,
            startTime: 0,
            objects: [
              {
                id: "pr-title", type: "text", x: -200, y: -120,
                content: "Say Hello to BrandX",
                fontSize: 32, fontFamily: "Georgia, serif", fillColor: "#ec4899",
                startTime: 0.5, duration: 1.5, animationType: "draw", easing: "easeOut"
              }
            ],
            svgObjects: [
              {
                id: "pr-arrow", pathData: SVG_SHAPES.arrowRight, x: -40, y: 20, scaleX: 2.2, scaleY: 2.2,
                strokeColor: "#ec4899", strokeWidth: 4,
                startTime: 2.0, duration: 1.2, easing: SvgEasing.easeOut
              }
            ],
            cameraKeyframes: [
              { time: 0, x: 0, y: 0, zoom: 0.9, easing: "linear" },
              { time: 3, x: 10, y: 10, zoom: 1.2, easing: "easeInOut" }
            ]
          }
        ];
      } else {
        startingScenes = [
          {
            id: `sc-blank-1`,
            name: "Scene 1",
            duration: 5,
            startTime: 0,
            objects: [],
            svgObjects: [],
            cameraKeyframes: [
              { time: 0, x: 0, y: 0, zoom: 1, easing: "linear" as const }
            ]
          }
        ];
      }
      
      const newProj = {
        id,
        name,
        scenes: startingScenes,
        audioTracks: [],
        lastUpdated: new Date().toISOString(),
      };
      
      localStorage.setItem(`wbs-project-${id}`, JSON.stringify(newProj));
      
      const rawMeta = localStorage.getItem("wbs-projects");
      let metaList = rawMeta ? JSON.parse(rawMeta) : [];
      if (!Array.isArray(metaList)) metaList = [];
      
      const totalDur = startingScenes.reduce((acc, s) => acc + s.duration, 0);
      metaList.push({
        id,
        name,
        lastUpdated: newProj.lastUpdated,
        duration: Math.round(totalDur * 100) / 100,
      });
      localStorage.setItem("wbs-projects", JSON.stringify(metaList));
      
      store.loadProject(id);
      return id;
    },

    deleteProject: (id: string) => {
      try {
        localStorage.removeItem(`wbs-project-${id}`);
        
        const rawMeta = localStorage.getItem("wbs-projects");
        if (rawMeta) {
          const metaList = JSON.parse(rawMeta);
          if (Array.isArray(metaList)) {
            const filtered = metaList.filter((p: any) => p.id !== id);
            localStorage.setItem("wbs-projects", JSON.stringify(filtered));
            
            if (currentProjectId === id) {
              currentProjectId = null;
              localStorage.removeItem("wbs-active-project-id");
              
              if (filtered.length > 0) {
                store.loadProject(filtered[0].id);
              } else {
                store.createProject("Untitled Project");
              }
            }
          }
        }
        notify();
      } catch (e) {
        console.error("Failed to delete project:", e);
      }
    },

    renameProject: (id: string, newName: string) => {
      try {
        const rawMeta = localStorage.getItem("wbs-projects");
        if (rawMeta) {
          const metaList = JSON.parse(rawMeta);
          if (Array.isArray(metaList)) {
            const idx = metaList.findIndex((p: any) => p.id === id);
            if (idx >= 0) {
              metaList[idx].name = newName;
              metaList[idx].lastUpdated = new Date().toISOString();
              localStorage.setItem("wbs-projects", JSON.stringify(metaList));
            }
          }
        }

        const rawData = localStorage.getItem(`wbs-project-${id}`);
        if (rawData) {
          const data = JSON.parse(rawData);
          data.name = newName;
          data.lastUpdated = new Date().toISOString();
          localStorage.setItem(`wbs-project-${id}`, JSON.stringify(data));
        }

        notify();
      } catch (e) {
        console.error("Failed to rename project:", e);
      }
    },
  };

  // Hydration logic on startup
  try {
    const activeId = localStorage.getItem("wbs-active-project-id");
    const rawProjects = localStorage.getItem("wbs-projects");
    let projectsList = rawProjects ? JSON.parse(rawProjects) : [];
    if (!Array.isArray(projectsList)) projectsList = [];
    
    let loaded = false;
    if (activeId && projectsList.some((p: any) => p.id === activeId)) {
      loaded = store.loadProject(activeId);
    }
    
    if (!loaded && projectsList.length > 0) {
      loaded = store.loadProject(projectsList[0].id);
    }
    
    if (!loaded) {
      const legacyRaw = localStorage.getItem("wbs-autosave");
      if (legacyRaw) {
        try {
          const legacyData = JSON.parse(legacyRaw);
          if (legacyData && legacyData.scenes) {
            store.createProject("My Restored Project");
            manager.scenes = legacyData.scenes;
            manager.audioTracks = legacyData.audioTracks ?? [];
            manager.subtitles = legacyData.subtitles ?? [];
            rebuildStartTimes();
            performAutoSave();
            loaded = true;
            localStorage.removeItem("wbs-autosave");
          }
        } catch {}
      }
      
      if (!loaded) {
        const newId = "proj-starter";
        const startProj = {
          id: newId,
          name: "Example Scribe",
          scenes: [
            { id: "scene-1", name: "Introduction", duration: 3.3, objects: scene1Objects, svgObjects: scene1Svg, cameraKeyframes: scene1Camera },
            { id: "scene-2", name: "Shapes",       duration: 3.2, objects: scene2Objects, svgObjects: scene2Svg, cameraKeyframes: scene2Camera },
            { id: "scene-3", name: "Conclusion",   duration: 3.6, objects: scene3Objects, svgObjects: scene3Svg, cameraKeyframes: scene3Camera },
          ],
          audioTracks: [],
          subtitles: [],
          lastUpdated: new Date().toISOString(),
        };
        
        localStorage.setItem(`wbs-project-${newId}`, JSON.stringify(startProj));
        
        const totalDur = startProj.scenes.reduce((acc, s) => acc + s.duration, 0);
        projectsList = [{
          id: newId,
          name: startProj.name,
          lastUpdated: startProj.lastUpdated,
          duration: Math.round(totalDur * 100) / 100,
        }];
        localStorage.setItem("wbs-projects", JSON.stringify(projectsList));
        store.loadProject(newId);
      }
    }
  } catch (e) {
    console.error("Hydration error on startup:", e);
  }

  isInitializing = false;
  return store;
}

export const sceneStore = buildStore();
