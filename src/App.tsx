import { useEffect, useRef, useCallback, useState } from "react";
import {
  createCamera, createCameraTarget,
  panTarget, zoomTargetToPoint, lerpCamera,
  MIN_ZOOM, MAX_ZOOM,
} from "./core/camera";
import type { Camera, CameraTarget } from "./core/camera";
import { sceneStore } from "./store/sceneStore";
import { editorStore } from "./store/editorStore";
import type { CursorMode } from "./store/editorStore";
import { renderFrame } from "./core/render";
import { drawEditorOverlay } from "./core/editorOverlay";
import { createHandState } from "./core/handDrawer";
import { exportVideo, DEFAULT_EXPORT_OPTIONS } from "./core/videoExporter";
import type { ExportProgress } from "./core/videoExporter";
import { exportWithFFmpeg, preloadFFmpeg, DEFAULT_FFMPEG_OPTIONS } from "./core/ffmpegExporter";
import type { ExportFormat, ExportProgress as FFmpegProgress } from "./core/ffmpegExporter";
import { screenToWorld, hitTestScene, getAnimatedObjectBBox, getSvgObjectBBox } from "./core/hitTest";
import { TimelinePanel } from "./components/TimelinePanel";

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
  userSelect:  "none",
};

export default function App() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const cameraRef  = useRef<Camera>(createCamera());
  const targetRef  = useRef<CameraTarget>(createCameraTarget());
  const keysRef    = useRef<Set<string>>(new Set());
  const rafRef     = useRef<number>(0);
  const lastTRef   = useRef<number>(0);
  const handRef    = useRef(createHandState("/hand1.png"));

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [editorState,  setEditorState]  = useState(editorStore.getState());
  const totalDuration = sceneStore.totalDuration;

  // Drag refs (not state — no re-render needed mid-drag)
  const dragRef  = useRef<{ active: boolean; lastX: number; lastY: number }>({ active: false, lastX: 0, lastY: 0 });
  const pinchRef = useRef<{ active: boolean; lastDist: number }>({ active: false, lastDist: 0 });
  const objDragRef = useRef<{ active: boolean }>({ active: false });

  // Export state
  const [exporting,       setExporting]       = useState(false);
  const [exportProgress,  setExportProgress]  = useState<ExportProgress | null>(null);
  const [exportFormat,    setExportFormat]     = useState<ExportFormat>("mp4");
  const [ffmpegReady,     setFfmpegReady]      = useState(false);
  const [ffmpegProgress,  setFfmpegProgress]   = useState<FFmpegProgress | null>(null);

  // ── Subscribe to stores ───────────────────────────────────────────────────
  useEffect(() => sceneStore.subscribe(() => {
    setIsPlaying(sceneStore.isPlaying());
    setCurrentTime(sceneStore.getCurrentTime());
  }), []);

  useEffect(() => editorStore.subscribe(() => {
    setEditorState(editorStore.getState());
  }), []);

  // ── Resize ────────────────────────────────────────────────────────────────
  const resize = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    c.width  = c.clientWidth;
    c.height = c.clientHeight;
  }, []);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === " ") {
        e.preventDefault();
        sceneStore.isPlaying() ? sceneStore.pause() : sceneStore.play();
      }
      if (e.key === "Escape") editorStore.deselect();
      if (e.key === "v" || e.key === "V") editorStore.setMode("select");
      if (e.key === "h" || e.key === "H") editorStore.setMode("pan");
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
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

      const rect    = canvas.getBoundingClientRect();
      const sx      = e.clientX - rect.left;
      const sy      = e.clientY - rect.top;
      const mode    = editorStore.getMode();
      const world   = screenToWorld(sx, sy, cameraRef.current, canvas.width, canvas.height);
      const scene   = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;

      if (mode === "select" && scene) {
        const hit = hitTestScene(world.x, world.y, scene);
        if (hit) {
          editorStore.select(hit.id, hit.type);
          // Begin object drag
          const obj =
            hit.type === "animated"
              ? scene.objects.find(o => o.id === hit.id)
              : scene.svgObjects?.find(o => o.id === hit.id);
          if (obj) {
            editorStore.beginDrag(world.x, world.y, obj.x, obj.y);
            objDragRef.current.active = true;
          }
        } else {
          editorStore.deselect();
          dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
        }
      } else {
        // Pan mode or any other non-select tool → canvas pan
        dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
      }

      // ── Place new object on canvas click ─────────────────────────────────────
      const activeScene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
      if (!activeScene) return;

      const localTime = sceneStore.getLocalTime();
      const newId = `obj-${Date.now()}`;

      if (mode === "addText") {
        sceneStore.addObject(activeScene.id, {
          id: newId, type: "text",
          x: world.x, y: world.y,
          content: "Text",
          fontSize: 24, fontFamily: "Georgia, serif",
          fillColor: "#1e293b",
          startTime: localTime, duration: 1.5,
          animationType: "fade", easing: "easeOut",
        });
        editorStore.select(newId, "animated");
        editorStore.setMode("select");
      }

      if (mode === "addRect") {
        sceneStore.addObject(activeScene.id, {
          id: newId, type: "rect",
          x: world.x - 60, y: world.y - 35,
          width: 120, height: 70,
          fillColor: "#6366f1", strokeColor: "#4f46e5", lineWidth: 2,
          startTime: localTime, duration: 1,
          animationType: "scale", scale: { from: 0, to: 1 }, easing: "spring",
        });
        editorStore.select(newId, "animated");
        editorStore.setMode("select");
      }

      if (mode === "addCircle") {
        sceneStore.addObject(activeScene.id, {
          id: newId, type: "circle",
          x: world.x, y: world.y, radius: 50,
          fillColor: "#f59e0b", strokeColor: "#d97706", lineWidth: 2,
          startTime: localTime, duration: 1,
          animationType: "scale", scale: { from: 0, to: 1 }, easing: "spring",
        });
        editorStore.select(newId, "animated");
        editorStore.setMode("select");
      }

      canvas.style.cursor = "grabbing";
    };

    const onMove = (e: PointerEvent) => {
      const rect  = canvas.getBoundingClientRect();
      const sx    = e.clientX - rect.left;
      const sy    = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, cameraRef.current, canvas.width, canvas.height);

      if (objDragRef.current.active && editorStore.isDragging()) {
        // Move the selected object in world space
        const { world: startWorld, obj: startObj } = editorStore.getDragStart();
        if (startWorld && startObj) {
          const newX = startObj.x + (world.x - startWorld.x);
          const newY = startObj.y + (world.y - startWorld.y);
          const sel   = editorStore.getSelected();
          const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;
          if (sel && scene) {
            if (sel.type === "animated") {
              const obj = scene.objects.find(o => o.id === sel.id);
              if (obj) { obj.x = newX; obj.y = newY; }
            } else {
              const obj = scene.svgObjects?.find(o => o.id === sel.id);
              if (obj) { obj.x = newX; obj.y = newY; }
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
    };

    const onUp = () => {
      dragRef.current.active    = false;
      objDragRef.current.active = false;
      editorStore.endDrag();
      canvas.style.cursor = editorStore.getMode() === "pan" ? "grab" : "default";
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup",   onUp);
    canvas.addEventListener("pointerleave", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup",   onUp);
      canvas.removeEventListener("pointerleave", onUp);
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
    setFfmpegReady(true);
    window.addEventListener("resize", resize);
    const canvas = canvasRef.current!;

    const loop = (timestamp: number) => {
      const delta = lastTRef.current ? (timestamp - lastTRef.current) / 1000 : 0;
      lastTRef.current = timestamp;

      sceneStore.tick(delta);

      const globalTime = sceneStore.getCurrentTime();
      const scene      = sceneStore.getActiveScene();
      const localTime  = sceneStore.getLocalTime();
      const camTarget  = sceneStore.getCameraTarget();

      if (sceneStore.isPlaying()) {
        targetRef.current = { ...targetRef.current, ...camTarget };
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

      cameraRef.current = lerpCamera(cameraRef.current, targetRef.current);

      const ctx = canvas.getContext("2d")!;
      renderFrame(ctx, cameraRef.current, scene, localTime, canvas.width, canvas.height, handRef.current, globalTime, totalDuration);

      // Editor overlay (selection box)
      drawEditorOverlay(ctx, cameraRef.current, scene, editorStore.getSelected(), canvas.width, canvas.height);

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
      setExportProgress({ frame: 0, totalFrames: 0, percent: 0, status: "error", error: String(err) });
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

  // ── Selected object info (for properties panel) ───────────────────────────
  const selectedObj = (() => {
    const sel   = editorState.selected;
    const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;
    if (!sel || !scene) return null;
    if (sel.type === "animated") return scene.objects.find(o => o.id === sel.id) ?? null;
    return scene.svgObjects?.find(o => o.id === sel.id) ?? null;
  })();

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: COLORS.bg, overflow: "hidden", fontFamily: "monospace" }}>

      {/* ── LEFT TOOLBAR ─────────────────────────────────────────────────── */}
      <div style={{ ...panel, width: 56, alignItems: "center", gap: 4, padding: "12px 0", borderRight: `1px solid ${COLORS.border}` }}>
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

      {/* ── CANVAS ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          style={{
            display: "block", width: "100%", height: "100%",
            outline: "none",
            cursor: editorState.cursorMode === "pan" ? "grab"
                  : editorState.cursorMode === "select" ? "default"
                  : "crosshair",
          }}
          tabIndex={0}
        />

        {/* ── BOTTOM TIMELINE PANEL ─────────────────────────────────────────── */}
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
        />

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
      <div style={{ ...panel, width: 240, borderRight: "none", borderLeft: `1px solid ${COLORS.border}`, overflow: "auto" }}>

        {/* Panel header */}
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}`, fontSize: 10, color: COLORS.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Properties
        </div>

        {selectedObj ? (
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Object ID */}
            <PropRow label="ID">
              <span style={{ color: COLORS.accent, fontSize: 10, wordBreak: "break-all" }}>{selectedObj.id}</span>
            </PropRow>

            {/* Type */}
            <PropRow label="Type">
              <span style={{ color: COLORS.text, fontSize: 11 }}>
                {"type" in selectedObj ? selectedObj.type : "svg path"}
              </span>
            </PropRow>

            {/* Position */}
            <PropRow label="X">
              <NumInput value={Math.round(selectedObj.x)} onChange={v => { selectedObj.x = v; }} />
            </PropRow>
            <PropRow label="Y">
              <NumInput value={Math.round(selectedObj.y)} onChange={v => { selectedObj.y = v; }} />
            </PropRow>

            {/* Timing */}
            <div style={{ width: "100%", height: 1, background: COLORS.border }} />
            <PropRow label="Start">
              <NumInput
                value={"startTime" in selectedObj ? selectedObj.startTime : 0}
                step={0.1}
                onChange={v => { if ("startTime" in selectedObj) (selectedObj as any).startTime = v; }}
              />
            </PropRow>
            <PropRow label="Duration">
              <NumInput
                value={"duration" in selectedObj ? selectedObj.duration : 0}
                step={0.1}
                onChange={v => { if ("duration" in selectedObj) (selectedObj as any).duration = Math.max(0.1, v); }}
              />
            </PropRow>

            {/* Color (animated objects only) */}
            {"fillColor" in selectedObj && selectedObj.fillColor && (
              <>
                <div style={{ width: "100%", height: 1, background: COLORS.border }} />
                <PropRow label="Fill">
                  <input type="color" value={selectedObj.fillColor?.startsWith("#") ? selectedObj.fillColor : "#6366f1"}
                    onChange={e => {
                      (selectedObj as any).fillColor = e.target.value;
                      const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
                      if (scene && editorState.selected?.type === "animated") {
                        sceneStore.updateObject(scene.id, editorState.selected.id, { fillColor: e.target.value });
                      }
                    }}
                    style={{ width: 36, height: 24, borderRadius: 4, border: "none", cursor: "pointer", background: "none" }}
                  />
                </PropRow>
              </>
            )}

            {/* Stroke color */}
            {"strokeColor" in selectedObj && selectedObj.strokeColor && (
              <PropRow label="Stroke">
                <input type="color" value={(selectedObj as any).strokeColor?.startsWith("#") ? (selectedObj as any).strokeColor : "#6366f1"}
                  onChange={e => {
                    (selectedObj as any).strokeColor = e.target.value;
                    const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
                    if (scene && editorState.selected?.type === "animated") {
                      sceneStore.updateObject(scene.id, editorState.selected.id, { strokeColor: e.target.value } as any);
                    }
                  }}
                  style={{ width: 36, height: 24, borderRadius: 4, border: "none", cursor: "pointer", background: "none" }}
                />
              </PropRow>
            )}

          </div>
        ) : (
          <div style={{ padding: 20, color: COLORS.muted, fontSize: 11, textAlign: "center", lineHeight: 1.6 }}>
            Click an object on the canvas to select it
          </div>
        )}

        {/* Scene info at bottom */}
        <div style={{ flex: 1 }} />
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${COLORS.border}`, fontSize: 10, color: COLORS.muted }}>
          <div>Scene: {sceneStore.getActiveScene()?.name ?? "—"}</div>
          <div>Time: {currentTime.toFixed(2)}s / {totalDuration}s</div>
          <div style={{ marginTop: 6, color: COLORS.dimmer }}>V select · H pan · Esc deselect</div>
        </div>
      </div>
    </div>
  );
}

// ── Small reusable components ─────────────────────────────────────────────────

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      defaultValue={value}
      step={step}
      onChange={e => onChange(parseFloat(e.target.value))}
      style={{
        width: 72, padding: "3px 6px", borderRadius: 5, fontSize: 11,
        fontFamily: "monospace", textAlign: "right",
        background: "#1e2530", border: "1px solid rgba(99,102,241,0.2)",
        color: "#e2e8f0", outline: "none",
      }}
    />
  );
}