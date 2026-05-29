import React, { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCamera, createCameraTarget,
  panTarget, zoomTargetToPoint, lerpCamera,
  MIN_ZOOM, MAX_ZOOM,
} from "../core/camera";
import type { Camera, CameraTarget } from "../core/camera";
import { sceneStore } from "../store/sceneStore";
import { editorStore } from "../store/editorStore";
import type { CursorMode, SelectedObject } from "../store/editorStore";
import { renderFrame, imageCache } from "../core/render";
import { drawEditorOverlay } from "../core/editorOverlay";
import { createHandState } from "../core/handDrawer";

declare global {
  interface Window {
    ScribeFlowRender?: {
      hydrateProject: (projectJson: string | any) => boolean;
      seekTo: (timeSeconds: number) => void;
      renderFrameAt: (timeSeconds: number) => boolean;
      isReadyToRender: () => boolean;
      getCanvasDataUrl: () => string;
      getProjectJson: () => any;
    };
  }
}
import { exportVideo, DEFAULT_EXPORT_OPTIONS } from "../core/videoExporter";
import type { ExportProgress } from "../core/videoExporter";
import { exportWithFFmpeg, DEFAULT_FFMPEG_OPTIONS } from "../core/ffmpegExporter";
import type { ExportFormat, ExportProgress as FFmpegProgress } from "../core/ffmpegExporter";
import { screenToWorld, hitTestScene, getAnimatedObjectBBox, getSvgObjectBBox, snapXY, snapToObjects, getObjectCenter } from "../core/hitTest";
import { TimelinePanel } from "../components/TimelinePanel";
import { ScenePanel } from "../components/ScenePanel";
import { AssetLibrary } from "../components/AssetLibrary";
import { AiPanel } from "../components/AiPanel";
import { PropertyInspector } from "../components/PropertyInspector";
import type { AnimatedObject } from "../core/timeline";
import type { SvgPathObject } from "../core/svgPath";
import { getValuesAtTime, newKfId } from "../core/transformInterpolator";
import { AudioSynchronizer } from "../components/AudioSynchronizer";


const PAN_SPEED        = 8;
const KEY_ZOOM_STEP    = 0.05;
const WHEEL_SENSITIVITY = 0.001;
const PINCH_SENSITIVITY = 0.005;

// ── Toolbar items ─────────────────────────────────────────────────────────────

const TOOLBAR_ITEMS: { mode: CursorMode; icon: string; label: string }[] = [
  { mode: "select",    icon: "⬡",  label: "Select"    },
  { mode: "pan",       icon: "✥",  label: "Pan"       },
  { mode: "addText",   icon: "T",  label: "Text"      },
  { mode: "addRect",   icon: "▭",  label: "Rectangle" },
  { mode: "addCircle", icon: "○",  label: "Circle"    },
  { mode: "addSvg",    icon: "✦",  label: "SVG"       },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const COLORS = {
  bg:       "#0c1117",
  surface:  "#141920",
  border:   "rgba(99,102,241,0.18)",
  accent:   "#6366f1",
  accentDim:"rgba(99,102,241,0.12)",
  text:     "#e2e8f0",
  muted:    "#64748b",
  dimmer:   "#1e2530",
};

const panel: React.CSSProperties = {
  background:  COLORS.surface,
  borderRight: `1px solid ${COLORS.border}`,
  display:     "flex",
  flexDirection: "column",
};

function getResizeCursor(handle: string): string {
  switch (handle) {
    case "tl": case "br": return "nwse-resize";
    case "tr": case "bl": return "nesw-resize";
    case "tc": case "bc": return "ns-resize";
    case "ml": case "mr": return "ew-resize";
    default: return "default";
  }
}

function getResizedBox(
  handle: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br",
  startBox: { x: number; y: number; w: number; h: number },
  dx: number,
  dy: number,
  minW = 10,
  minH = 10,
): { x: number; y: number; w: number; h: number } {
  const right = startBox.x + startBox.w;
  const bottom = startBox.y + startBox.h;

  let x = startBox.x;
  let y = startBox.y;
  let w = startBox.w;
  let h = startBox.h;

  if (handle.includes("l")) {
    x = Math.min(startBox.x + dx, right - minW);
    w = right - x;
  }

  if (handle.includes("r")) {
    w = Math.max(minW, startBox.w + dx);
  }

  if (handle.includes("t")) {
    y = Math.min(startBox.y + dy, bottom - minH);
    h = bottom - y;
  }

  if (handle.includes("b")) {
    h = Math.max(minH, startBox.h + dy);
  }

  return { x, y, w, h };
}

function makeSquareBoxFromHandle(
  handle: string,
  box: { x: number; y: number; w: number; h: number },
  startBox: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const size = Math.max(box.w, box.h);
  const right = startBox.x + startBox.w;
  const bottom = startBox.y + startBox.h;

  let x = box.x;
  let y = box.y;

  if (handle.includes("l")) x = right - size;
  if (handle.includes("t")) y = bottom - size;

  return { x, y, w: size, h: size };
}

export default function Editor() {
  const navigate = useNavigate();

  const [totalDuration, setTotalDuration] = useState(sceneStore.totalDuration);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState("");
  const formatDuration = (secNum: number) => {
    const m = Math.floor(secNum / 60).toString().padStart(2, "0");
    const s = Math.floor(secNum % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days === 1) return "yesterday";
      return `${days}d ago`;
    } catch {
      return "recently";
    }
  };

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const cameraRef  = useRef<Camera>(createCamera());
  const targetRef  = useRef<CameraTarget>(createCameraTarget());
  const keysRef    = useRef<Set<string>>(new Set());
  const rafRef     = useRef<number>(0);
  const lastTRef   = useRef<number>(0);
  const handRef    = useRef(createHandState("/handimg1.png"));
  const resizeRef  = useRef<{
    active: boolean;
    handle: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br" | null;
    startWorld: { x: number; y: number };
    startBox: { x: number; y: number; w: number; h: number };
    startScaleX: number;
    startScaleY: number;
    startRadius: number;
    startFontSize: number;
    startObjX: number;
    startObjY: number;
    startTextWrapWidth: number;
  }>({
    active: false,
    handle: null,
    startWorld: { x: 0, y: 0 },
    startBox: { x: 0, y: 0, w: 0, h: 0 },
    startScaleX: 1,
    startScaleY: 1,
    startRadius: 40,
    startFontSize: 16,
    startObjX: 0,
    startObjY: 0,
    startTextWrapWidth: 360,
  });

  const [handSrc,  setHandSrc]  = useState("/handimg1.png");
  const [rightTab, setRightTab] = useState<"properties" | "assets" | "scenes" | "ai">("properties");

  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const isResizingRightRef = useRef(false);



  const startResizeRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRightRef.current = true;
    
    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizingRightRef.current) return;
      const nextWidth = window.innerWidth - ev.clientX;
      setRightPanelWidth(Math.max(220, Math.min(600, nextWidth)));
    };
    
    const onMouseUp = () => {
      isResizingRightRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  useEffect(() => {
    if (handSrc) handRef.current = createHandState(handSrc);
  }, [handSrc]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRenderMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("render") === "true";
  const [exportDimensions, setExportDimensions] = useState({ width: 1920, height: 1080 });
  const [isProjectHydrated, setIsProjectHydrated] = useState(false);

  // Register the headless render bridge
  useEffect(() => {
    if (!isRenderMode) return;

    window.ScribeFlowRender = {
      hydrateProject: (projectJson: string | any) => {
        try {
          let data = projectJson;
          if (typeof projectJson === "string") {
            data = JSON.parse(projectJson);
          }
          if (data && data.metadata && data.metadata.width && data.metadata.height) {
            setExportDimensions({
              width: data.metadata.width,
              height: data.metadata.height,
            });
          } else {
            setExportDimensions({ width: 1920, height: 1080 });
          }
          
          sceneStore.hydrateProjectData(data);
          setIsProjectHydrated(true);
          console.log("☁️ Project hydrated successfully via bridge!");
          return true;
        } catch (err) {
          console.error("Failed to hydrate project via bridge:", err);
          return false;
        }
      },

      seekTo: (timeSeconds: number) => {
        sceneStore.pause();
        sceneStore.seek(timeSeconds);

        // Snap camera instantly to avoid interpolation lag
        const camTarget = sceneStore.getCameraTarget();
        cameraRef.current = { x: camTarget.x, y: camTarget.y, zoom: camTarget.zoom };
        targetRef.current = { x: camTarget.x, y: camTarget.y, zoom: camTarget.zoom };
      },

      renderFrameAt: (timeSeconds: number) => {
        try {
          // 1. Seek exactly
          window.ScribeFlowRender?.seekTo(timeSeconds);

          // 2. Redraw instantly
          const canvas = canvasRef.current;
          if (!canvas) return false;
          
          const ctx = canvas.getContext("2d");
          if (!ctx) return false;

          const scene = sceneStore.getActiveScene();
          const localTime = sceneStore.getLocalTime();
          const globalTime = sceneStore.getCurrentTime();

          // Standardize width/height
          canvas.width = exportDimensions.width;
          canvas.height = exportDimensions.height;

          // Draw the clean frame (isExport = true)
          renderFrame(
            ctx,
            cameraRef.current,
            scene,
            localTime,
            canvas.width,
            canvas.height,
            handRef.current,
            globalTime,
            totalDuration,
            true // isExport is true, hiding HUD/Grid
          );

          // Render subtitles directly on the canvas in export mode if they exist
          const projectJson = sceneStore.getProjectJson();
          if (projectJson && projectJson.subtitles) {
            drawExportSubtitles(
              ctx,
              projectJson.subtitles,
              globalTime,
              canvas.width,
              canvas.height
            );
          }

          return true;
        } catch (err) {
          console.error("Failed to render frame at time:", timeSeconds, err);
          return false;
        }
      },

      isReadyToRender: () => {
        const canvas = canvasRef.current;
        if (!canvas) return false;
        if (canvas.width === 0 || canvas.height === 0) return false;
        if (!isProjectHydrated) return false;

        // Check if hand image is loaded
        if (handRef.current && handRef.current.image && !handRef.current.image.complete) {
          return false;
        }

        // Check if all imageCache elements are loaded
        if (imageCache) {
          for (const img of imageCache.values()) {
            if (!img.complete) return false;
          }
        }

        // Check if all img tags are loaded
        const images = document.querySelectorAll("img");
        for (let i = 0; i < images.length; i++) {
          if (!images[i].complete) return false;
        }

        // Check if fonts are ready
        if (typeof document !== "undefined" && (document as any).fonts && (document as any).fonts.status !== "loaded") {
          return false;
        }

        return true;
      },

      getCanvasDataUrl: () => {
        const canvas = canvasRef.current;
        return canvas ? canvas.toDataURL("image/png") : "";
      },

      getProjectJson: () => {
        return sceneStore.getProjectJson();
      }
    };

    return () => {
      delete window.ScribeFlowRender;
    };
  }, [isRenderMode, exportDimensions, isProjectHydrated, totalDuration]);

  // Auto-save every 30s
  useEffect(() => {
    if (isRenderMode) return;

    // Load autosave on startup
    const loaded = sceneStore.loadAutoSave();
    if (loaded) console.log("[autosave] restored from localStorage");

    const interval = setInterval(() => {
      sceneStore.autoSave();
    }, 30_000);
    return () => clearInterval(interval);
  }, [isRenderMode]);

  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // ── Inline text editing overlay ──────────────────────────────────────────
  const [inlineEdit, setInlineEdit] = useState<{
    objectId: string;
    content: string;
    screenX: number;
    screenY: number;
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    fontStyle: string;
    color: string;
    zoom: number;
  } | null>(null);

  // Live ref so backdrop/blur always reads the current typed value (not stale state)
  const inlineEditValueRef = useRef<string>("");

  const commitInlineEdit = (val: string) => {
    if (!inlineEdit) return;
    const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
    if (scene) {
      if (val.trim() === "") {
        // Fix #10 — delete the object if user never typed anything
        sceneStore.removeObject(scene.id, inlineEdit.objectId);
      } else {
        sceneStore.updateObject(scene.id, inlineEdit.objectId, { content: val });
      }
    }
    setInlineEdit(null);
    inlineEditValueRef.current = "";
  };

  const openInlineEditor = (objectId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
    if (!scene) return;
    const obj = scene.objects.find(o => o.id === objectId);
    if (!obj || obj.type !== "text") return;
    const cam = cameraRef.current;
    // Fix #9 — use CSS pixel dimensions from getBoundingClientRect, not canvas pixel buffer
    const rect = canvas.getBoundingClientRect();
    const zoom = cam.zoom;
    const sx = (obj.x - cam.x) * zoom + rect.width  / 2 + rect.left;
    const sy = (obj.y - cam.y) * zoom + rect.height / 2 + rect.top;
    const content = obj.content ?? "";
    inlineEditValueRef.current = content;
    setInlineEdit({
      objectId,
      content,
      screenX: sx,
      screenY: sy,
      fontSize: (obj.fontSize ?? 24) * zoom,
      fontFamily: obj.fontFamily ?? "Georgia, serif",
      fontWeight: obj.fontWeight ?? "normal",
      fontStyle: obj.fontStyle ?? "normal",
      color: obj.fillColor ?? "#ffffff",
      zoom,
    });
  };

  // Listen to Escape key to close Theater Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTheaterMode) {
        sceneStore.pause();
        setIsTheaterMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTheaterMode]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [editorState,  setEditorState]  = useState(editorStore.getState());
  const [selectedKfTime, setSelectedKfTime] = useState<number | null>(null);

  // Drag refs (not state — no re-render needed mid-drag)

  const dragRef    = useRef({ active: false, lastX: 0, lastY: 0 });
  const pinchRef   = useRef({ active: false, lastDist: 0 });
  const objDragRef = useRef({ active: false });
  const snapGuidesRef = useRef<{ x?: number; y?: number } | null>(null);
  const lastSceneIdRef = useRef<string | null>(null);
  // Multi-drag: store per-object original positions
  const multiDragOriginsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Export state
  const [exporting,       setExporting]       = useState(false);
  const [exportProgress,  setExportProgress]  = useState<ExportProgress | null>(null);
  const [exportFormat]                        = useState<ExportFormat>("mp4");
  const [ffmpegProgress,  setFfmpegProgress]   = useState<FFmpegProgress | null>(null);

  // ── Subscribe to stores ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = sceneStore.subscribe(() => {
      setIsPlaying(sceneStore.isPlaying());
      setCurrentTime(sceneStore.getCurrentTime());
      setTotalDuration(sceneStore.getManager().totalDuration);
    });
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    const unsubscribe = editorStore.subscribe(() => {
      setEditorState(editorStore.getState());
    });
    return () => { unsubscribe(); };
  }, []);

  // ── Resize ────────────────────────────────────────────────────────────────
  const resize = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    if (isRenderMode) {
      c.width  = exportDimensions.width;
      c.height = exportDimensions.height;
    } else {
      c.width  = c.clientWidth;
      c.height = c.clientHeight;
    }
  }, [isRenderMode, exportDimensions]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) return;

      keysRef.current.add(e.key);

      if (e.key === " ") {
        e.preventDefault();
        sceneStore.isPlaying() ? sceneStore.pause() : sceneStore.play();
      }
      if (e.key === "Escape") editorStore.deselect();
      if (e.key === "v" || e.key === "V") editorStore.setMode("select");
      if (e.key === "h" || e.key === "H") editorStore.setMode("pan");

      // Add camera keyframe shortcut: K key
      if (e.key === "k" || e.key === "K") {
        onAddCameraKeyframe();
      }

      // Select all
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const manager = sceneStore.getManager();
        const all: SelectedObject[] = [];
        for (const scene of manager.scenes) {
          all.push(...scene.objects.map(o => ({ id: o.id, type: "animated" as const })));
          all.push(...(scene.svgObjects ?? []).map(o => ({ id: o.id, type: "svg" as const })));
        }
        editorStore.selectAll(all);
      }

      // Delete
      if (e.key === "Delete" || e.key === "Backspace") {
        const activeScene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
        if (selectedKfTime !== null && activeScene) {
          e.preventDefault();
          sceneStore.removeCameraKeyframe(activeScene.id, selectedKfTime);
          setSelectedKfTime(null);
          return;
        }

        const manager = sceneStore.getManager();
        const selectedList = editorStore.getMultiSelected();
        if (selectedList.length > 0) {
          let totalObjectsInProject = 0;
          for (const s of manager.scenes) {
            totalObjectsInProject += s.objects.length + (s.svgObjects?.length ?? 0);
          }
          const isDeletingEverything = selectedList.length === totalObjectsInProject;

          for (const sel of selectedList) {
            for (const scene of manager.scenes) {
              const hasObj = scene.objects.some(o => o.id === sel.id) || scene.svgObjects?.some(o => o.id === sel.id);
              if (hasObj) {
                sceneStore.removeObject(scene.id, sel.id);
                break;
              }
            }
          }

          if (isDeletingEverything) {
            // Clear all audio tracks
            if (manager.audioTracks && manager.audioTracks.length > 0) {
              const ids = manager.audioTracks.map(t => t.id);
              for (const id of ids) {
                sceneStore.removeAudioTrack(id);
              }
            }
            // Reset camera keyframes for all scenes to default
            for (const scene of manager.scenes) {
              scene.cameraKeyframes = [{ time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" }];
            }
            // Reset active camera and target in App to center
            cameraRef.current = { x: 0, y: 0, zoom: 1 };
            targetRef.current = { x: 0, y: 0, zoom: 1 };
            // Set empty scenes' duration to standard 5s
            for (const scene of manager.scenes) {
              scene.duration = 5.0;
            }
            sceneStore.seek(0);
          }
          editorStore.deselect();
        }
      }

      // Copy
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        editorStore.setClipboard([...editorStore.getMultiSelected()]);
      }

      // Paste
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault();
        const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
        if (!scene) return;
        const newSels: typeof editorStore extends { getMultiSelected: () => infer R } ? R : never[] = [];
        for (const clip of editorStore.getClipboard()) {
          const newId = `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          if (clip.type === "animated") {
            const orig = scene.objects.find(o => o.id === clip.id);
            if (orig) {
              sceneStore.addObject(scene.id, { ...orig, id: newId, x: orig.x + 20, y: orig.y + 20 });
              (newSels as any[]).push({ id: newId, type: "animated" });
            }
          } else {
            const orig = scene.svgObjects?.find(o => o.id === clip.id);
            if (orig) {
              sceneStore.addSvgObject(scene.id, { ...orig, id: newId, x: orig.x + 20, y: orig.y + 20 });
              (newSels as any[]).push({ id: newId, type: "svg" });
            }
          }
        }
        if ((newSels as any[]).length > 0) editorStore.selectAll(newSels as any);
      }

      // Duplicate shortcut (Cmd+D / Ctrl+D)
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
        if (scene) {
          const currentSelections = editorStore.getMultiSelected();
          const newSels: typeof editorStore extends { getMultiSelected: () => infer R } ? R : never[] = [];
          for (const clip of currentSelections) {
            const newId = `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            if (clip.type === "animated") {
              const orig = scene.objects.find(o => o.id === clip.id);
              if (orig) {
                const copy = JSON.parse(JSON.stringify(orig));
                copy.id = newId;
                copy.x += 20;
                copy.y += 20;
                sceneStore.addObject(scene.id, copy);
                (newSels as any[]).push({ id: newId, type: "animated" });
              }
            } else {
              const orig = scene.svgObjects?.find(o => o.id === clip.id);
              if (orig) {
                const copy = JSON.parse(JSON.stringify(orig));
                copy.id = newId;
                copy.x += 20;
                copy.y += 20;
                sceneStore.addSvgObject(scene.id, copy);
                (newSels as any[]).push({ id: newId, type: "svg" });
              }
            }
          }
          if ((newSels as any[]).length > 0) editorStore.selectAll(newSels as any);
        }
      }

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        focusOnObject(e.shiftKey); // Shift+F = focus + add keyframe
      }

      // Fix #11 — Enter or F2 opens inline editor for selected text object
      if (e.key === "Enter" || e.key === "F2") {
        const sel = editorStore.getSelected();
        if (sel && sel.type === "animated") {
          const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
          const obj = scene?.objects.find(o => o.id === sel.id);
          if (obj && obj.type === "text") {
            e.preventDefault();
            openInlineEditor(sel.id);
          }
        }
      }

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") { e.preventDefault(); sceneStore.undo(); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey  && e.key === "z") { e.preventDefault(); sceneStore.redo(); }

      // Arrow nudge (1px normal, 10px with Shift)
      const nudge = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -nudge : e.key === "ArrowRight" ? nudge : 0;
      const dy = e.key === "ArrowUp"   ? -nudge : e.key === "ArrowDown"  ? nudge : 0;
      if ((dx !== 0 || dy !== 0) && editorStore.getMultiSelected().length > 0) {
        e.preventDefault(); // prevent canvas pan when object selected
        const manager = sceneStore.getManager();
        for (const sel of editorStore.getMultiSelected()) {
          for (const scene of manager.scenes) {
            if (sel.type === "animated") {
              const obj = scene.objects.find(o => o.id === sel.id);
              if (obj) { obj.x += dx; obj.y += dy; break; }
            } else {
              const obj = scene.svgObjects?.find(o => o.id === sel.id);
              if (obj) { obj.x += dx; obj.y += dy; break; }
            }
          }
        }
        sceneStore.getManager(); // trigger re-render via notify
      }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ── Wheel ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (e.ctrlKey) {
        targetRef.current = zoomTargetToPoint(targetRef.current, 1 - e.deltaY * PINCH_SENSITIVITY, sx, sy, canvas.width, canvas.height);
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        targetRef.current = panTarget(targetRef.current, e.deltaX / targetRef.current.zoom, e.deltaY / targetRef.current.zoom);
      } else {
        targetRef.current = zoomTargetToPoint(targetRef.current, 1 - e.deltaY * WHEEL_SENSITIVITY, sx, sy, canvas.width, canvas.height);
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // ── Pointer (select + drag objects + pan) ─────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);

      const rect  = canvas.getBoundingClientRect();
      const sx    = e.clientX - rect.left;
      const sy    = e.clientY - rect.top;
      const mode  = editorStore.getMode();
      const world = screenToWorld(sx, sy, cameraRef.current, canvas.width, canvas.height);
      const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;

      if (mode === "select" && scene) {
        // First check if user clicked a resize handle of the primary selected object
        const primarySel = editorStore.getSelected();
        if (primarySel) {
          const obj = primarySel.type === "animated"
            ? scene.objects.find(o => o.id === primarySel.id)
            : scene.svgObjects?.find(o => o.id === primarySel.id);
          
          if (obj) {
            const box = primarySel.type === "animated"
              ? getAnimatedObjectBBox(obj as AnimatedObject)
              : getSvgObjectBBox(obj as SvgPathObject);
              
            const zoom = cameraRef.current.zoom;
            const pad = 5 / zoom;
            const bx = box.x - pad;
            const by = box.y - pad;
            const bw = box.w + pad * 2;
            const bh = box.h + pad * 2;
            
            const hs = 7 / zoom;
            const handlePositions: { type: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br"; x: number; y: number }[] = [
              { type: "tl", x: bx,          y: by         },
              { type: "tc", x: bx + bw/2,   y: by         },
              { type: "tr", x: bx + bw,     y: by         },
              { type: "ml", x: bx,          y: by + bh/2  },
              { type: "mr", x: bx + bw,     y: by + bh/2  },
              { type: "bl", x: bx,          y: by + bh    },
              { type: "bc", x: bx + bw/2,   y: by + bh    },
              { type: "br", x: bx + bw,     y: by + bh    },
            ];
            
            let clickedHandle: typeof handlePositions[0] | null = null;
            const tolerance = hs * 1.5;
            for (const h of handlePositions) {
              if (Math.abs(world.x - h.x) <= tolerance && Math.abs(world.y - h.y) <= tolerance) {
                clickedHandle = h;
                break;
              }
            }
            
            if (clickedHandle) {
              resizeRef.current = {
                active: true,
                handle: clickedHandle.type,
                startWorld: { x: world.x, y: world.y },
                startBox: { ...box },
                startScaleX: (obj as any).scaleX ?? 1,
                startScaleY: (obj as any).scaleY ?? 1,
                startRadius: (obj as any).radius ?? 40,
                startFontSize: (obj as any).fontSize ?? 16,
                startObjX: obj.x,
                startObjY: obj.y,
                startTextWrapWidth: (obj as any).textWrapWidth ?? box.w,
              };
              canvas.style.cursor = getResizeCursor(clickedHandle.type);
              return;
            }
          }
        }

        const hit = hitTestScene(world.x, world.y, scene);
        if (hit) {
          // Shift+click = multi-select
          if (e.shiftKey) {
            editorStore.toggleSelect(hit.id, hit.type);
          } else {
            // If clicking something already in multi-selection, keep all selected for drag
            const alreadyInMulti = editorStore.getMultiSelected().some(s => s.id === hit.id);
            if (!alreadyInMulti) editorStore.select(hit.id, hit.type);
          }

          // Record drag origins for ALL selected objects
          const multi = editorStore.getMultiSelected();
          multiDragOriginsRef.current.clear();
          for (const sel of multi) {
            const obj = sel.type === "animated"
              ? scene.objects.find(o => o.id === sel.id)
              : scene.svgObjects?.find(o => o.id === sel.id);
            if (obj) multiDragOriginsRef.current.set(sel.id, { x: obj.x, y: obj.y });
          }

          // Auto-focus camera on clicked object (gentle zoom, not full focus)
          // Soft focus — only nudge camera toward object, don't full zoom
          // Full focus only on F key or button
          const primaryObj = hit.type === "animated" 
            ? scene.objects.find(o => o.id === hit.id)
            : scene.svgObjects?.find(o => o.id === hit.id);
          if (primaryObj) {
            const center = getObjectCenter(primaryObj as any, hit.type);
            targetRef.current = {
              ...targetRef.current,
              x: targetRef.current.x + (center.x - targetRef.current.x) * 0.2,
              y: targetRef.current.y + (center.y - targetRef.current.y) * 0.2,
            };
          }

          if (primaryObj) {
            editorStore.beginDrag(world.x, world.y, primaryObj.x, primaryObj.y);
            objDragRef.current.active = true;
          }
        } else if (!e.shiftKey) {
          editorStore.deselect();
          dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
        }
      } else {
        dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
      }

      // Place new object
      const activeScene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
      if (!activeScene) return;
      const localTime = sceneStore.getLocalTime();
      const newId = `obj-${Date.now()}`;

      if (mode === "addText") {
        // Fix #12 — white default color, visible on dark canvas
        sceneStore.addObject(activeScene.id, { id: newId, type: "text", x: world.x, y: world.y, content: "Text", fontSize: 36, fontFamily: "Georgia, serif", fontWeight: "normal", fontStyle: "normal", textAlign: "left", fillColor: "#ffffff", startTime: localTime, duration: 1.5, animationType: "draw", easing: "easeOut" });
        editorStore.select(newId, "animated"); editorStore.setMode("select");
        // Defer opening the editor slightly so pointerup/click doesn't steal focus instantly
        setTimeout(() => {
          openInlineEditor(newId);
        }, 50);
      }
      if (mode === "addRect") {
        sceneStore.addObject(activeScene.id, { id: newId, type: "rect", x: world.x - 60, y: world.y - 35, width: 120, height: 70, fillColor: "#6366f1", strokeColor: "#4f46e5", lineWidth: 2, startTime: localTime, duration: 1, animationType: "draw", scale: { from: 0, to: 1 }, easing: "spring" });
        editorStore.select(newId, "animated"); editorStore.setMode("select");
      }
      if (mode === "addCircle") {
        sceneStore.addObject(activeScene.id, { id: newId, type: "circle", x: world.x, y: world.y, radius: 50, fillColor: "#f59e0b", strokeColor: "#d97706", lineWidth: 2, startTime: localTime, duration: 1, animationType: "draw", scale: { from: 0, to: 1 }, easing: "spring" });
        editorStore.select(newId, "animated"); editorStore.setMode("select");
      }
      canvas.style.cursor = "grabbing";
    };

    const onMove = (e: PointerEvent) => {
      const rect  = canvas.getBoundingClientRect();
      const sx    = e.clientX - rect.left;
      const sy    = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, cameraRef.current, canvas.width, canvas.height);

      const primary = editorStore.getSelected();

      // Handle Resizing Action
      if (resizeRef.current.active && primary) {
        const {
          handle,
          startWorld,
          startBox,
          startScaleX,
          startScaleY,
          startFontSize,
          startObjX,
          startObjY,
          startTextWrapWidth,
        } = resizeRef.current;

        if (handle && startWorld) {
          const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;
          if (scene) {
            const rawDx = world.x - startWorld.x;
            const rawDy = world.y - startWorld.y;
            const nextBox = getResizedBox(handle, startBox, rawDx, rawDy, 10, 10);

            const obj = primary.type === "animated"
              ? scene.objects.find(o => o.id === primary.id)
              : scene.svgObjects?.find(o => o.id === primary.id);

            if (obj) {
              if (primary.type === "animated") {
                const animObj = obj as AnimatedObject;
                if (animObj.type === "rect") {
                  sceneStore.updateObject(scene.id, animObj.id, {
                    x: nextBox.x,
                    y: nextBox.y,
                    width: nextBox.w,
                    height: nextBox.h,
                  });
                }
                else if (animObj.type === "circle") {
                  const squareBox = makeSquareBoxFromHandle(handle, nextBox, startBox);
                  const radius = Math.max(5, squareBox.w / 2);

                  sceneStore.updateObject(scene.id, animObj.id, {
                    x: squareBox.x + radius,
                    y: squareBox.y + radius,
                    radius,
                  });
                }
                else if (animObj.type === "text") {
                  const widthRatio = nextBox.w / Math.max(1, startBox.w);
                  const heightRatio = nextBox.h / Math.max(1, startBox.h);
                  const isHorizontalOnly = handle === "ml" || handle === "mr";
                  const isVerticalOnly = handle === "tc" || handle === "bc";

                  if (isHorizontalOnly) {
                    sceneStore.updateObject(scene.id, animObj.id, {
                      x: nextBox.x,
                      textWrapWidth: Math.max(60, Math.round(startTextWrapWidth * widthRatio)),
                    });
                  } else if (isVerticalOnly) {
                    sceneStore.updateObject(scene.id, animObj.id, {
                      y: nextBox.y,
                      fontSize: Math.max(6, Math.round(startFontSize * heightRatio)),
                    });
                  } else {
                    const scaleFactor = Math.max(0.1, (widthRatio + heightRatio) / 2);

                    sceneStore.updateObject(scene.id, animObj.id, {
                      x: nextBox.x,
                      y: nextBox.y,
                      textWrapWidth: Math.max(60, Math.round(startTextWrapWidth * widthRatio)),
                      fontSize: Math.max(6, Math.round(startFontSize * scaleFactor)),
                    });
                  }
                }
              }
              else if (primary.type === "svg") {
                const svgObj = obj as SvgPathObject;
                let scaleFactorX = nextBox.w / Math.max(1, startBox.w);
                let scaleFactorY = nextBox.h / Math.max(1, startBox.h);

                if (handle === "tl" || handle === "tr" || handle === "bl" || handle === "br") {
                  const uniform = Math.max(scaleFactorX, scaleFactorY);
                  scaleFactorX = uniform;
                  scaleFactorY = uniform;
                }

                const nextScaleX = Math.max(0.05, Math.round(startScaleX * scaleFactorX * 100) / 100);
                const nextScaleY = Math.max(0.05, Math.round(startScaleY * scaleFactorY * 100) / 100);

                const ratioX = nextScaleX / Math.max(0.0001, startScaleX);
                const ratioY = nextScaleY / Math.max(0.0001, startScaleY);

                const nextObjX = nextBox.x + (startObjX - startBox.x) * ratioX;
                const nextObjY = nextBox.y + (startObjY - startBox.y) * ratioY;

                sceneStore.updateSvgObject(scene.id, svgObj.id, {
                  scaleX: nextScaleX,
                  scaleY: nextScaleY,
                  x: nextObjX,
                  y: nextObjY,
                });
              }
            }
          }
        }
        return;
      }

      if (objDragRef.current.active && editorStore.isDragging()) {
        const { world: startWorld } = editorStore.getDragStart();
        if (!startWorld) return;

        const scene   = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;
        const multi   = editorStore.getMultiSelected();
        const snap    = editorStore.getSnapToGrid();
        const grid    = editorStore.getGridSize();
        const primary = editorStore.getSelected();

        snapGuidesRef.current = null;

        const rawDx = world.x - startWorld.x;
        const rawDy = world.y - startWorld.y;

        for (const sel of multi) {
          const origin = multiDragOriginsRef.current.get(sel.id);
          if (!origin || !scene) continue;

          let nx = origin.x + rawDx;
          let ny = origin.y + rawDy;

          // Grid snap
          const snapped = snapXY(nx, ny, grid, snap);
          nx = snapped.x; ny = snapped.y;

          // Object edge snap (primary object only, to avoid noise)
          if (sel.id === primary?.id && scene) {
            const obj = sel.type === "animated"
              ? scene.objects.find(o => o.id === sel.id)
              : scene.svgObjects?.find(o => o.id === sel.id);
            if (obj) {
              const box = sel.type === "animated"
                ? getAnimatedObjectBBox({ ...obj as any, x: nx, y: ny })
                : getSvgObjectBBox({ ...obj as any, x: nx, y: ny });
              const result = snapToObjects(nx, ny, box.w, box.h, scene, sel.id);
              if (result.snapX) { snapGuidesRef.current = { ...(snapGuidesRef.current || {}), x: result.x }; nx = result.x; }
              if (result.snapY) { snapGuidesRef.current = { ...(snapGuidesRef.current || {}), y: result.y }; ny = result.y; }
            }
          }

          if (sel.type === "animated") {
            const obj = scene.objects.find(o => o.id === sel.id);
            if (obj) {
              const hasKfs = obj.transformTracks && obj.transformTracks.keyframes.length > 0;
              if (hasKfs) {
                const localT = Math.round(Math.max(0, Math.min(obj.duration, sceneStore.getLocalTime() - obj.startTime)) * 100) / 100;
                const existingKf = obj.transformTracks!.keyframes.find(k => Math.abs(k.time - localT) <= 0.05);
                if (existingKf) {
                  existingKf.x = nx;
                  existingKf.y = ny;
                } else {
                  const currentValues = getValuesAtTime(obj.transformTracks, localT);
                  obj.transformTracks!.keyframes.push({
                    id: newKfId(),
                    time: localT,
                    x: nx,
                    y: ny,
                    scaleX: currentValues.scaleX,
                    scaleY: currentValues.scaleY,
                    rotation: currentValues.rotation,
                    opacity: currentValues.opacity,
                    easing: "easeInOut",
                  });
                  obj.transformTracks!.keyframes.sort((a, b) => a.time - b.time);
                }
              } else {
                obj.x = nx;
                obj.y = ny;
              }
            }
          } else {
            const obj = scene.svgObjects?.find(o => o.id === sel.id);
            if (obj) {
              const hasKfs = obj.transformTracks && obj.transformTracks.keyframes.length > 0;
              if (hasKfs) {
                const localT = Math.round(Math.max(0, Math.min(obj.duration, sceneStore.getLocalTime() - obj.startTime)) * 100) / 100;
                const existingKf = obj.transformTracks!.keyframes.find(k => Math.abs(k.time - localT) <= 0.05);
                if (existingKf) {
                  existingKf.x = nx;
                  existingKf.y = ny;
                } else {
                  const currentValues = getValuesAtTime(obj.transformTracks, localT);
                  obj.transformTracks!.keyframes.push({
                    id: newKfId(),
                    time: localT,
                    x: nx,
                    y: ny,
                    scaleX: currentValues.scaleX,
                    scaleY: currentValues.scaleY,
                    rotation: currentValues.rotation,
                    opacity: currentValues.opacity,
                    easing: "easeInOut",
                  });
                  obj.transformTracks!.keyframes.sort((a, b) => a.time - b.time);
                }
              } else {
                obj.x = nx;
                obj.y = ny;
              }
            }
          }
        }
        return;
      }

      if (dragRef.current.active) {
        const dx = e.clientX - dragRef.current.lastX;
        const dy = e.clientY - dragRef.current.lastY;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        targetRef.current = panTarget(targetRef.current, -dx / cameraRef.current.zoom, -dy / cameraRef.current.zoom);
      }

      // Hover cursor handles feedback
      const mode = editorStore.getMode();
      let hoveredHandle = false;
      if (mode === "select" && primary && !objDragRef.current.active && !resizeRef.current.active && !dragRef.current.active) {
        const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;
        if (scene) {
          const obj = primary.type === "animated"
            ? scene.objects.find(o => o.id === primary.id)
            : scene.svgObjects?.find(o => o.id === primary.id);
            
          if (obj) {
            const box = primary.type === "animated"
              ? getAnimatedObjectBBox(obj as AnimatedObject)
              : getSvgObjectBBox(obj as SvgPathObject);
              
            const zoom = cameraRef.current.zoom;
            const pad = 5 / zoom;
            const bx = box.x - pad;
            const by = box.y - pad;
            const bw = box.w + pad * 2;
            const bh = box.h + pad * 2;
            
            const hs = 7 / zoom;
            const handlePositions = [
              { type: "tl", x: bx,          y: by         },
              { type: "tc", x: bx + bw/2,   y: by         },
              { type: "tr", x: bx + bw,     y: by         },
              { type: "ml", x: bx,          y: by + bh/2  },
              { type: "mr", x: bx + bw,     y: by + bh/2  },
              { type: "bl", x: bx,          y: by + bh    },
              { type: "bc", x: bx + bw/2,   y: by + bh    },
              { type: "br", x: bx + bw,     y: by + bh    },
            ];
            
            const tolerance = hs * 1.2;
            for (const h of handlePositions) {
              if (Math.abs(world.x - h.x) <= tolerance && Math.abs(world.y - h.y) <= tolerance) {
                canvas.style.cursor = getResizeCursor(h.type);
                hoveredHandle = true;
                break;
              }
            }
          }
        }
      }
      
      if (!hoveredHandle && !objDragRef.current.active && !resizeRef.current.active && !dragRef.current.active) {
        canvas.style.cursor = mode === "pan" ? "grab" : "default";
      }
    };

    const onUp = () => {
      if (objDragRef.current.active) {
        // Commit to store history on mouseup
        const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
        if (scene) sceneStore.updateObject(scene.id, editorStore.getSelected()?.id ?? "", {});
      }
      if (resizeRef.current.active) {
        // Commit to store history on resize mouseup
        const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
        const selected = editorStore.getSelected();
        if (scene && selected) {
          if (selected.type === "animated") {
            sceneStore.updateObject(scene.id, selected.id, {});
          } else {
            sceneStore.updateSvgObject(scene.id, selected.id, {});
          }
        }
        resizeRef.current.active = false;
        resizeRef.current.handle = null;
      }
      snapGuidesRef.current        = null;
      dragRef.current.active       = false;
      objDragRef.current.active    = false;
      multiDragOriginsRef.current.clear();
      editorStore.endDrag();
      canvas.style.cursor = editorStore.getMode() === "pan" ? "grab" : "default";
    };

    canvas.addEventListener("pointerdown",  onDown);
    canvas.addEventListener("pointermove",  onMove);
    canvas.addEventListener("pointerup",    onUp);
    canvas.addEventListener("pointerleave", onUp);

    // Double-click to inline-edit text objects
    const onDblClick = (e: MouseEvent) => {
      const rect  = canvas.getBoundingClientRect();
      const sx    = e.clientX - rect.left;
      const sy    = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, cameraRef.current, canvas.width, canvas.height);
      const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;
      if (!scene) return;
      const hit = hitTestScene(world.x, world.y, scene);
      if (hit && hit.type === "animated") {
        const obj = scene.objects.find(o => o.id === hit.id);
        if (obj && obj.type === "text") {
          editorStore.select(hit.id, "animated");
          openInlineEditor(hit.id);
        }
      }
    };
    canvas.addEventListener("dblclick", onDblClick);

    return () => {
      canvas.removeEventListener("pointerdown",  onDown);
      canvas.removeEventListener("pointermove",  onMove);
      canvas.removeEventListener("pointerup",    onUp);
      canvas.removeEventListener("pointerleave", onUp);
      canvas.removeEventListener("dblclick",     onDblClick);
    };
  }, []);


  // ── Touch pinch ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ptrs = new Map<number, { x: number; y: number }>();
    const dist = (a: { x: number; y: number }, b: typeof a) => Math.hypot(b.x - a.x, b.y - a.y);
    const mid  = (a: { x: number; y: number }, b: typeof a) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const onD = (e: PointerEvent) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { pinchRef.current = { active: true, lastDist: dist(...([...ptrs.values()] as [{ x: number; y: number }, { x: number; y: number }])) }; dragRef.current.active = false; }
    };
    const onM = (e: PointerEvent) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pinchRef.current.active || ptrs.size < 2) return;
      const [a, b] = [...ptrs.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = dist(a, b); const m = mid(a, b);
      const rect = canvas.getBoundingClientRect();
      if (pinchRef.current.lastDist > 0)
        targetRef.current = zoomTargetToPoint(targetRef.current, d / pinchRef.current.lastDist, m.x - rect.left, m.y - rect.top, canvas.width, canvas.height);
      pinchRef.current.lastDist = d;
    };
    const onU = (e: PointerEvent) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinchRef.current = { active: false, lastDist: 0 }; };
    canvas.addEventListener("pointerdown", onD);
    canvas.addEventListener("pointermove", onM);
    canvas.addEventListener("pointerup",   onU);
    return () => {
      canvas.removeEventListener("pointerdown", onD);
      canvas.removeEventListener("pointermove", onM);
      canvas.removeEventListener("pointerup",   onU);
    };
  }, []);

  // ── RAF loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    const canvas = canvasRef.current!;

    const loop = (timestamp: number) => {
      try {
        const delta = lastTRef.current ? (timestamp - lastTRef.current) / 1000 : 0;
        lastTRef.current = timestamp;

        sceneStore.tick(delta);

        const globalTime = sceneStore.getCurrentTime();
        const scene      = sceneStore.getActiveScene();
        const localTime  = sceneStore.getLocalTime();
        const camTarget  = sceneStore.getCameraTarget();

        // Detect scene change → hard snap camera to avoid lerping from wrong scene position
        if (scene && scene.id !== lastSceneIdRef.current) {
          lastSceneIdRef.current = scene.id;
          if (sceneStore.isPlaying()) {
            // Snap both camera and target instantly to new scene's starting position
            const snapCam = sceneStore.getCameraTarget();
            cameraRef.current  = { x: snapCam.x, y: snapCam.y, zoom: snapCam.zoom };
            targetRef.current  = { x: snapCam.x, y: snapCam.y, zoom: snapCam.zoom };
          }
        }

        const CAM_EPSILON = 0.5;   // world units
        const ZOOM_EPSILON = 0.005;

        if (sceneStore.isPlaying()) {
          const t = targetRef.current;
          const dx   = Math.abs(camTarget.x    - t.x);
          const dy   = Math.abs(camTarget.y    - t.y);
          const dz   = Math.abs(camTarget.zoom - t.zoom);
          if (dx > CAM_EPSILON || dy > CAM_EPSILON || dz > ZOOM_EPSILON) {
            targetRef.current = { x: camTarget.x, y: camTarget.y, zoom: camTarget.zoom };
          }
        }

        if (!sceneStore.isPlaying()) {
          const keys  = keysRef.current;
          const speed = PAN_SPEED / targetRef.current.zoom;
          if (keys.has("ArrowLeft"))  targetRef.current = panTarget(targetRef.current, -speed, 0);
          if (keys.has("ArrowRight")) targetRef.current = panTarget(targetRef.current,  speed, 0);
          if (keys.has("ArrowUp"))    targetRef.current = panTarget(targetRef.current, 0, -speed);
          if (keys.has("ArrowDown"))  targetRef.current = panTarget(targetRef.current, 0,  speed);
          if (keys.has("q") || keys.has("Q")) targetRef.current = { ...targetRef.current, zoom: Math.min(MAX_ZOOM, targetRef.current.zoom + KEY_ZOOM_STEP) };
          if (keys.has("e") || keys.has("E")) targetRef.current = { ...targetRef.current, zoom: Math.max(MIN_ZOOM, targetRef.current.zoom - KEY_ZOOM_STEP) };
        }

        if (isRenderMode) {
          cameraRef.current = { x: camTarget.x, y: camTarget.y, zoom: camTarget.zoom };
          targetRef.current = { x: camTarget.x, y: camTarget.y, zoom: camTarget.zoom };
        } else {
          cameraRef.current = lerpCamera(cameraRef.current, targetRef.current, sceneStore.isPlaying());
        }

        const ctx = canvas.getContext("2d")!;
        renderFrame(
          ctx,
          cameraRef.current,
          scene,
          localTime,
          canvas.width,
          canvas.height,
          handRef.current,
          globalTime,
          totalDuration,
          isRenderMode
        );

        if (isRenderMode) {
          const projectJson = sceneStore.getProjectJson();
          if (projectJson && projectJson.subtitles) {
            drawExportSubtitles(
              ctx,
              projectJson.subtitles,
              globalTime,
              canvas.width,
              canvas.height
            );
          }
        }

        // Editor overlay (selection box)
        if (!isRenderMode) {
          drawEditorOverlay(
            ctx, cameraRef.current, scene,
            editorStore.getSelected(),
            canvas.width, canvas.height,
            editorStore.getMultiSelected(),
            snapGuidesRef.current ?? undefined,
          );
        }
      } catch (err) {
        console.error("[loop] Unhandled error inside RAF loop:", err);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); };
  }, [resize]);

  // ── Scrubber ──────────────────────────────────────────────────────────────
  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => sceneStore.seek(parseFloat(e.target.value));

  // ── Export ────────────────────────────────────────────────────────────────
  const onExport = async () => {
    if (exporting) return;
    sceneStore.pause(); setExporting(true); setExportProgress(null);
    try {
      await exportVideo(sceneStore.getManager(), handRef.current, DEFAULT_EXPORT_OPTIONS, p => setExportProgress({ ...p }));
    } catch (err) {
      setExportProgress({ frame: 0, totalFrames: 0, percent: 0, status: "error", error: String(err), timeSeconds: 0 });
    } finally { setExporting(false); }
  };

  const onFFmpegExport = async () => {
    if (exporting) return;
    sceneStore.pause(); setExporting(true); setFfmpegProgress(null);
    try {
      await exportWithFFmpeg(sceneStore.getManager(), handRef.current, { ...DEFAULT_FFMPEG_OPTIONS, format: exportFormat, fps: exportFormat === "gif" ? 15 : 30 }, p => setFfmpegProgress({ ...p }));
    } catch (err) {
      setFfmpegProgress({ stage: "error", percent: 0, error: String(err) });
    } finally { setExporting(false); }
  };

  const onSave = () => sceneStore.saveProject();

  const onLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        sceneStore.loadProject(ev.target?.result as string);
      } catch {
        alert("Failed to load project — invalid .wbs file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const onNew = () => {
    if (confirm("Start a new project? Unsaved changes will be lost.")) {
      sceneStore.newProject();
      editorStore.deselect();
    }
  };

  const onAddCameraKeyframe = useCallback(() => {
    const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
    if (!scene) return;

    const wasPlaying = sceneStore.isPlaying();
    sceneStore.pause();                                              // freeze time

    const globalTime = sceneStore.getCurrentTime();
    const localTime  = Math.max(0, globalTime - scene.startTime);
    const cam        = cameraRef.current;

    sceneStore.addCameraKeyframe(scene.id, {
      time:   Math.round(localTime * 100) / 100,
      x:      Math.round(cam.x * 10) / 10,
      y:      Math.round(cam.y * 10) / 10,
      zoom:   Math.round(cam.zoom * 1000) / 1000,
      easing: "easeInOut",
    });

    if (wasPlaying) sceneStore.play();                              // resume if was playing
  }, []);

  const focusOnObject = useCallback((createKeyframe = false) => {
    const sel   = editorStore.getSelected();
    const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
    if (!sel || !scene) return;

    const obj = sel.type === "animated"
      ? scene.objects.find(o => o.id === sel.id)
      : scene.svgObjects?.find(o => o.id === sel.id);
    if (!obj) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y, w, h } = getObjectCenter(obj as any, sel.type);

    const PADDING = 0.65;
    const newZoom = Math.min(
      (canvas.width  / Math.max(w, 1)) * PADDING,
      (canvas.height / Math.max(h, 1)) * PADDING,
      8,   // max zoom cap
    );

    // Set camera target — lerpCamera will smoothly animate to it
    targetRef.current = {
      x:    x,
      y:    y,
      zoom: newZoom,
    };

    // Optionally add a keyframe at current time
    if (createKeyframe) {
      const localTime = Math.max(0, sceneStore.getCurrentTime() - scene.startTime);
      sceneStore.addCameraKeyframe(scene.id, {
        time:   Math.round(localTime * 100) / 100,
        x:      Math.round(x * 10) / 10,
        y:      Math.round(y * 10) / 10,
        zoom:   Math.round(newZoom * 1000) / 1000,
        easing: "easeInOut",
      });
    }
  }, []);

  const activeProjId = sceneStore.getCurrentProjectId();

  // ── Layout ────────────────────────────────────────────────────────────────
  if (isRenderMode) {
    return (
      <div 
        style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          width: "100vw", 
          height: "100vh", 
          background: "#0c1117", 
          overflow: "hidden" 
        }}
      >
        <div 
          style={{ 
            width: exportDimensions.width, 
            height: exportDimensions.height, 
            position: "relative", 
            overflow: "hidden", 
            background: "#f8fafc" 
          }}
        >
          <canvas
            id="whiteboard-canvas"
            ref={canvasRef}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              outline: "none",
            }}
            tabIndex={0}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: COLORS.bg, overflow: "hidden", fontFamily: "monospace" }}>
      {/* Logical audio element sync engine */}
      <AudioSynchronizer currentTime={currentTime} isPlaying={isPlaying} />

      {/* ── LEFT TOOLBAR ─────────────────────────────────────────────────── */}
      {!isTheaterMode && (
        <div style={{ ...panel, width: 56, alignItems: "center", gap: 4, padding: "12px 0", borderRight: `1px solid ${COLORS.border}`, userSelect: "none" }}>
          {/* Logo */}
          <div style={{ width: 36, height: 36, borderRadius: 10, background: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, fontSize: 16 }}>
            ✦
          </div>

          <div style={{ width: "100%", height: 1, background: COLORS.border, marginBottom: 8 }} />

          {TOOLBAR_ITEMS.map(item => {
            const active = editorState.cursorMode === item.mode;
            return (
              <button
                key={item.mode}
                title={item.label}
                onClick={() => editorStore.setMode(item.mode)}
                style={{
                  width: 40, height: 40, borderRadius: 8,
                  border: active ? `1px solid ${COLORS.accent}` : "1px solid transparent",
                  background: active ? COLORS.accentDim : "transparent",
                  color: active ? COLORS.accent : COLORS.muted,
                  cursor: "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                {item.icon}
              </button>
            );
          })}

        </div>
      )}

      {/* ── CANVAS ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", minWidth: 0 }}>

        {/* Small dot button — click to go back to Dashboard */}
        {!isTheaterMode && (
          <button
            onClick={() => navigate("/dashboard")}
            title="Back to Dashboard"
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: COLORS.accent,
              border: "none",
              cursor: "pointer",
              zIndex: 1000,
              boxShadow: "0 2px 12px rgba(99,102,241,0.5)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.2)";
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.7)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 2px 12px rgba(99,102,241,0.5)";
            }}
          />
        )}

        <canvas
          id="whiteboard-canvas"
          ref={canvasRef}
          style={{
            display: "block", width: "100%", height: "100%",
            outline: "none",
            cursor: inlineEdit ? "text"
                  : editorState.cursorMode === "pan" ? "grab"
                  : editorState.cursorMode === "select" ? "default"
                  : "crosshair",
          }}
          tabIndex={0}
        />

        {/* ── INLINE TEXT EDITOR OVERLAY ── */}
        {inlineEdit && (
          <>
            {/* Fix #8 — backdrop reads from ref (live value), not stale state snapshot */}
            {/* Use onClick (not onPointerDown) — click only fires when down+up are on the same */}
            {/* element, so the original canvas press that opened the editor won't close it */}
            <div
              style={{ position: "absolute", inset: 0, zIndex: 1999 }}
              onClick={() => commitInlineEdit(inlineEditValueRef.current)}
            />
            <textarea
              autoFocus
              defaultValue={inlineEdit.content}
              onFocus={e => e.target.select()}
              onChange={e => {
                // Fix #6 — always write to ref so backdrop/blur get live value
                inlineEditValueRef.current = e.target.value;
              }}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === "Escape") commitInlineEdit((e.target as HTMLTextAreaElement).value);
              }}
              onBlur={e => commitInlineEdit(e.target.value)}
              onPointerDown={e => e.stopPropagation()}
              style={{
                position: "fixed",
                left: inlineEdit.screenX,
                top: inlineEdit.screenY,
                minWidth: 120,
                minHeight: inlineEdit.fontSize * 1.6,
                padding: "2px 4px",
                fontSize: inlineEdit.fontSize,
                fontFamily: inlineEdit.fontFamily,
                fontWeight: inlineEdit.fontWeight,
                fontStyle: inlineEdit.fontStyle,
                color: "#1e293b",
                background: "rgba(255,255,255,0.95)",
                border: "2px solid #6366f1",
                borderRadius: 4,
                outline: "none",
                resize: "both",
                zIndex: 2000,
                lineHeight: 1.4,
                boxShadow: "0 4px 24px rgba(99,102,241,0.3)",
                backdropFilter: "blur(4px)",
              }}
            />
          </>
        )}

        {/* ── BOTTOM TIMELINE PANEL ─────────────────────────────────────────── */}
        {!isTheaterMode ? (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, pointerEvents: "none" }}>
            <div style={{ pointerEvents: "auto" }}>
              <TimelinePanel
                currentTime={currentTime}
                totalDuration={totalDuration}
                isPlaying={isPlaying}
                exporting={exporting}
                exportFormat={exportFormat}
                onScrub={onScrub}
                onPlay={() => sceneStore.isPlaying() ? sceneStore.pause() : sceneStore.play()}
                onReset={() => sceneStore.reset()}
                onExport={exportFormat === "webm" ? onExport : onFFmpegExport}
                selectedId={editorState.selected?.id ?? null}
                onAddCameraKeyframe={onAddCameraKeyframe}
                onPreviewVideo={() => { sceneStore.reset(); sceneStore.play(); setIsTheaterMode(true); }}
                selectedKfTime={selectedKfTime}
                setSelectedKfTime={setSelectedKfTime}
              />
            </div>
          </div>
        ) : (
          /* ── Beautiful, premium floating media controller for theater preview! ── */
          <div style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(20, 25, 32, 0.85)",
            backdropFilter: "blur(12px)",
            border: `1px solid rgba(99, 102, 241, 0.25)`,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            borderRadius: 16,
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            zIndex: 2000,
            width: "90%",
            maxWidth: 600,
            pointerEvents: "auto",
            userSelect: "none"
          }}>
            {/* Play/Pause Button */}
            <button
              onClick={() => sceneStore.isPlaying() ? sceneStore.pause() : sceneStore.play()}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: COLORS.accent, color: "#ffffff",
                border: "none", cursor: "pointer",
                fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            {/* Reset / Replay Button */}
            <button
              onClick={() => { sceneStore.reset(); sceneStore.play(); }}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(255,255,255,0.08)", color: COLORS.text,
                border: "none", cursor: "pointer",
                fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center"
              }}
              title="Replay from beginning"
            >
              🔄
            </button>

            {/* Time Progress Label */}
            <span style={{ fontSize: 11, color: COLORS.text, fontFamily: "monospace", minWidth: 60 }}>
              {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
            </span>

            {/* Dynamic Progress Scrubber Bar */}
            <input
              type="range"
              min={0}
              max={totalDuration}
              step={0.05}
              value={currentTime}
              onChange={onScrub}
              style={{
                flex: 1,
                accentColor: COLORS.accent,
                cursor: "pointer",
                height: 4,
                borderRadius: 2
              }}
            />

            {/* Close Theater Mode Button */}
            <button
              onClick={() => { sceneStore.pause(); setIsTheaterMode(false); }}
              style={{
                padding: "6px 12px", borderRadius: 8,
                background: "#ef4444", color: "#ffffff",
                border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: "bold"
              }}
            >
              Close Preview [Esc]
            </button>
          </div>
        )}

        {/* Export overlay */}
        {exporting && (ffmpegProgress || exportProgress) && (() => {
          const p       = ffmpegProgress ?? exportProgress;
          const percent = p?.percent ?? 0;
          const stage   = ffmpegProgress ? ffmpegProgress.stage : (exportProgress?.status ?? "rendering");
          const label   = stage === "capturing" ? "🎬 Capturing..." : stage === "encoding" ? "⚙️ Encoding..." : stage === "done" ? "✅ Done!" : "Processing...";
          return (
            <div style={{ position: "absolute", inset: 0, background: "rgba(12,17,23,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
              <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: "28px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, minWidth: 300 }}>
                <span style={{ color: COLORS.text, fontSize: 15, fontWeight: 600 }}>{label}</span>
                <div style={{ width: 260, height: 6, background: COLORS.accentDim, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: COLORS.accent, width: `${percent}%`, transition: "width 0.15s" }} />
                </div>
                <span style={{ color: COLORS.muted, fontSize: 11 }}>{percent}%</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── RIGHT PROPERTIES PANEL ───────────────────────────────────────── */}
      {!isTheaterMode && (
        <div style={{ display: "flex", flexShrink: 0, height: "100%", position: "relative" }}>
          {/* Resize handle bar */}
          <div
            onMouseDown={startResizeRight}
            style={{
              width: 6,
              cursor: "ew-resize",
              background: "transparent",
              position: "absolute",
              left: -3,
              top: 0,
              bottom: 0,
              zIndex: 1000,
            }}
            onMouseEnter={e => e.currentTarget.style.background = COLORS.accent}
            onMouseLeave={e => {
              if (!isResizingRightRef.current) e.currentTarget.style.background = "transparent";
            }}
          />
          <div style={{
            ...panel,
            width: rightPanelWidth,
            flexShrink: 0,
            borderRight: "none",
            borderLeft: `1px solid ${COLORS.border}`,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
            userSelect: "text",
            background: COLORS.bg,
          }}>
            {/* Tab Header */}
            <div style={{
              display: "flex",
              borderBottom: `1px solid ${COLORS.border}`,
              flexShrink: 0,
              background: "rgba(0,0,0,0.15)",
              alignItems: "stretch",
            }}>
              {([
                { id: "properties", label: "⚙️ Inspect" },
                { id: "assets", label: "🎨 Art" },
                { id: "scenes", label: "🎬 Scenes" },
                { id: "ai", label: "🤖 AI" },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: "12px 4px",
                    fontSize: "10px",
                    fontWeight: 600,
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    border: "none",
                    borderBottom: rightTab === tab.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                    background: rightTab === tab.id ? COLORS.accentDim : "transparent",
                    color: rightTab === tab.id ? COLORS.accent : COLORS.muted,
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Body */}
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {rightTab === "properties" ? (
                <PropertyInspector selectedKfTime={selectedKfTime} setSelectedKfTime={setSelectedKfTime} />
              ) : rightTab === "assets" ? (
                <AssetLibrary
                  onHandChange={setHandSrc}
                  currentHand={handSrc}
                  getViewportCenter={() => ({ x: cameraRef.current.x, y: cameraRef.current.y })}
                />
              ) : rightTab === "scenes" ? (
                <ScenePanel
                  currentTime={currentTime}
                  onSceneSelect={() => editorStore.deselect()}
                />
              ) : (
                <AiPanel />
              )}
            </div>

            {/* Project Saving Actions */}
            <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.15)", flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: COLORS.muted }}>Project Actions:</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={onSave} title="Save project" style={{
                  width: 30, height: 30, borderRadius: 6, border: `1px solid ${COLORS.border}`,
                  background: COLORS.dimmer, color: COLORS.text, cursor: "pointer", fontSize: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>💾</button>

                <button onClick={() => fileInputRef.current?.click()} title="Load project" style={{
                  width: 30, height: 30, borderRadius: 6, border: `1px solid ${COLORS.border}`,
                  background: COLORS.dimmer, color: COLORS.text, cursor: "pointer", fontSize: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>📂</button>

                <button onClick={onNew} title="New project" style={{
                  width: 30, height: 30, borderRadius: 6, border: `1px solid ${COLORS.border}`,
                  background: COLORS.dimmer, color: COLORS.text, cursor: "pointer", fontSize: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>🆕</button>
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept=".wbs,.json" style={{ display: "none" }} onChange={onLoad} />

            <div style={{ padding: "8px 14px", borderTop: `1px solid ${COLORS.border}`, fontSize: 9, color: COLORS.muted, textAlign: "center", background: "rgba(0,0,0,0.2)", flexShrink: 0 }}>
              V select · H pan · Cmd+D duplicate · Esc deselect
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export Canvas Subtitle Redrawer ──────────────────────────────────────────
const drawExportSubtitles = (
  ctx: CanvasRenderingContext2D,
  subtitles: any[] | undefined,
  globalTime: number,
  W: number,
  H: number
) => {
  if (!subtitles || subtitles.length === 0) return;
  
  // Find active subtitle cue
  const activeCue = subtitles.find(
    (cue: any) => globalTime >= cue.startTime && globalTime <= cue.endTime
  );
  if (!activeCue || !activeCue.text) return;

  ctx.save();
  
  // Subtitle properties: font size around 36 at 1080p, scaling responsively
  const fontSize = Math.round(H * (36 / 1080));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const text = activeCue.text;
  const maxWidth = W * 0.7; // max width around 70% canvas

  // Measure text and handle word wrapping
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  // Bounding box dimensions
  const lineHeight = fontSize * 1.3;
  const rectHeight = lines.length * lineHeight + 30;
  const rectWidth = Math.min(maxWidth + 40, Math.max(...lines.map(l => ctx.measureText(l).width)) + 60);
  const rectX = (W - rectWidth) / 2;
  const rectY = H - rectHeight - Math.round(H * 0.08); // 8% padding from bottom

  // Draw semi-transparent white rounded rect
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.strokeStyle = "rgba(30, 41, 59, 0.15)";
  ctx.lineWidth = 2;
  
  const radius = 12;
  ctx.beginPath();
  ctx.moveTo(rectX + radius, rectY);
  ctx.lineTo(rectX + rectWidth - radius, rectY);
  ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
  ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
  ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
  ctx.lineTo(rectX + radius, rectY + rectHeight);
  ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
  ctx.lineTo(rectX, rectY + radius);
  ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw dark slate text inside rect
  ctx.fillStyle = "#1e293b";
  lines.forEach((line, idx) => {
    const lineY = rectY + 15 + (idx + 0.5) * lineHeight;
    ctx.fillText(line, W / 2, lineY);
  });

  ctx.restore();
};

// ── Small reusable components ─────────────────────────────────────────────────