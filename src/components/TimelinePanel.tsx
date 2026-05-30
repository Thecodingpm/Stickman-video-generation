/**
 * TimelinePanel — visual timeline showing all objects as draggable bars.
 * Drag bar body      → change startTime
 * Drag bar right edge→ change duration
 * Click bar          → select object
 * Click track area   → seek to time
 * Click scene header → collapse / expand that scene's tracks
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { sceneStore } from "../store/sceneStore";
import { editorStore } from "../store/editorStore";
import type { Scene } from "../core/sceneManager";
import type { AnimatedObject } from "../core/timeline";
import type { SvgPathObject } from "../core/svgPath";

// ── Constants ─────────────────────────────────────────────────────────────────

const TRACK_H = 26;   // height of each object row (expanded)
const COMPACT_BAND_H = 28;   // height of the mini bar strip when collapsed
const LABEL_W = 110;  // left label column width
const SCENE_HDR_H = 22;   // scene header row height
const HEADER_H = 18;   // time ruler height
const MIN_DURATION = 0.1;
const PX_PER_SEC = 80;

const COLORS = {
  bg:        "#121214",
  surface:   "#1a1a1e",
  border:    "rgba(255,255,255,0.08)",
  accent:    "#ffffff",
  accentDim: "rgba(255,255,255,0.06)",
  text:      "#f4f4f5",
  muted:     "#8e8e93",
  dimmer:    "#222226",
  animated:  "#d4d4d8",         // Sleek zinc gray for animated text/shapes
  svg:       "#34d399",         // Premium sage/emerald green for SVGs
  audio:     "#c084fc",         // Soft lavender/purple for timeline audio tracks
  playhead:  "#ef4444",         // Crisp red playhead
  hdrActive: "rgba(255,255,255,0.04)",
  hdrIdle:   "rgba(255,255,255,0.01)",
};

type AnyObj = (AnimatedObject & { _kind: "animated" }) | (SvgPathObject & { _kind: "svg" });

function getObjects(scene: Scene): AnyObj[] {
  const animated = scene.objects.map(o => Object.assign(o, { _kind: "animated" as const }));
  const svg      = (scene.svgObjects ?? []).map(o => Object.assign(o, { _kind: "svg" as const }));
  return [...animated, ...svg];
}

function objLabel(obj: AnyObj): string {
  if (obj._kind === "animated") {
    const o = obj as AnimatedObject & { _kind: "animated" };
    if (o.type === "text") return `"${(o.content ?? "text").slice(0, 10)}"`;
    return `${o.type} · ${o.id.slice(-4)}`;
  }
  return `svg · ${obj.id.slice(-4)}`;
}

// ── TimeRuler ─────────────────────────────────────────────────────────────────

function TimeRuler({ duration, pxPerSec }: { duration: number; pxPerSec: number }) {
  const ticks: number[] = [];
  const step = pxPerSec >= 60 ? 0.5 : 1;
  for (let t = 0; t <= duration; t = Math.round((t + step) * 10) / 10) ticks.push(t);

  return (
    <div style={{ position: "relative", height: HEADER_H, background: COLORS.dimmer, borderBottom: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
      {ticks.map(t => (
        <div key={t} style={{ position: "absolute", left: t * pxPerSec, top: 0, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ width: 1, height: t % 1 === 0 ? 10 : 5, background: COLORS.muted, marginTop: "auto" }} />
          {t % 1 === 0 && (
            <span style={{ position: "absolute", top: 2, left: 3, fontSize: 8, color: COLORS.muted, fontFamily: "monospace", whiteSpace: "nowrap" }}>
              {t}s
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── ObjectBar ─────────────────────────────────────────────────────────────────

interface ObjectBarProps {
  obj: AnyObj;
  scene: Scene;
  pxPerSec: number;
  isSelected: boolean;
  height?: number;   // allow override for compact mode
  onSelect: () => void;
  onUpdate: (startTime: number, duration: number) => void;
}

function ObjectBar({ obj, scene, pxPerSec, isSelected, height = TRACK_H - 6, onSelect, onUpdate }: ObjectBarProps) {
  const dragKind = useRef<"move" | "resize" | null>(null);
  const dragStart = useRef({ mouseX: 0, startTime: 0, duration: 0 });

  const left = obj.startTime * pxPerSec;
  const width = Math.max(obj.duration * pxPerSec, 8);
  const color = obj._kind === "svg" ? COLORS.svg : COLORS.animated;

  const barRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent, kind: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    dragKind.current  = kind;
    dragStart.current = { mouseX: e.clientX, startTime: obj.startTime, duration: obj.duration };

    // Live values mutated during drag (no React re-render)
    let liveStart    = obj.startTime;
    let liveDuration = obj.duration;

    const onMove = (ev: MouseEvent) => {
      const dx     = ev.clientX - dragStart.current.mouseX;
      const dtSecs = dx / pxPerSec;

      if (kind === "move") {
        liveStart     = Math.max(0, dragStart.current.startTime + dtSecs);
        obj.startTime = liveStart;
        if (barRef.current) barRef.current.style.left = `${liveStart * pxPerSec}px`;
      } else {
        liveDuration = Math.max(MIN_DURATION, dragStart.current.duration + dtSecs);
        obj.duration = liveDuration;
        if (barRef.current) barRef.current.style.width = `${Math.max(8, liveDuration * pxPerSec)}px`;
        // Extend scene duration live during resize drag
        const clipEnd = obj.startTime + liveDuration;
        if (clipEnd > scene.duration) {
          sceneStore.extendSceneDuration(scene.id, clipEnd + 0.5);
        }
      }
    };

    const onUp = () => {
      dragKind.current = null;
      // Only notify once on release → single React re-render
      onUpdate(liveStart, liveDuration);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  };

  return (
    <div
      ref={barRef}
      style={{
        position: "absolute",
        left, width,
        top: 3, height,
        borderRadius: 4,
        background: isSelected ? color : `${color}99`,
        border: isSelected ? `1.5px solid ${color}` : `1px solid ${color}66`,
        cursor: "grab", overflow: "hidden",
        display: "flex", alignItems: "center",
        boxShadow: isSelected ? `0 0 0 2px ${color}44` : "none",
        transition: "box-shadow 0.1s",
      }}
      onMouseDown={e => onMouseDown(e, "move")}
    >
      <span style={{ fontSize: 9, color: "#000", padding: "0 5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none", fontFamily: "monospace" }}>
        {objLabel(obj)}
      </span>
      <div
        style={{ position: "absolute", right: 0, top: 0, width: 6, height: "100%", cursor: "ew-resize", background: `${color}cc`, borderRadius: "0 4px 4px 0" }}
        onMouseDown={e => onMouseDown(e, "resize")}
      />
    </div>
  );
}

// ── CompactBand — mini stacked bars shown when scene is collapsed ──────────────

interface CompactBandProps {
  objects: AnyObj[];
  scene: Scene;
  pxPerSec: number;
  selectedId: string | null;
}

function CompactBand({ objects, scene, pxPerSec, selectedId }: CompactBandProps) {
  const totalW = scene.duration * pxPerSec;

  return (
    <div style={{ display: "flex", height: COMPACT_BAND_H, alignItems: "center", borderBottom: `1px solid ${COLORS.border}` }}>
      {/* Label spacer */}
      <div style={{ width: LABEL_W, flexShrink: 0, padding: "0 10px" }}>
        <span style={{ fontSize: 8, color: COLORS.muted, fontFamily: "monospace" }}>
          {objects.length} obj{objects.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Single track showing all bars overlaid */}
      <div style={{ position: "relative", height: "100%", width: totalW, flexShrink: 0 }}>
        {objects.map((obj, i) => {
          // Stagger vertically in the compact band: 3 rows max, cycle
          const row = i % 3;
          const rowH = Math.floor((COMPACT_BAND_H - 8) / 3);
          const topOff = 4 + row * rowH;
          const barH = rowH - 2;
          const color = obj._kind === "svg" ? COLORS.svg : COLORS.animated;
          const isSelected = selectedId === obj.id;

          return (
            <div
              key={obj.id}
              style={{
                position: "absolute",
                left: obj.startTime * pxPerSec,
                width: Math.max(obj.duration * pxPerSec, 6),
                top: topOff,
                height: barH,
                borderRadius: 2,
                background: isSelected ? color : `${color}88`,
                border: isSelected ? `1px solid ${color}` : `1px solid ${color}55`,
                cursor: "pointer",
                transition: "background 0.1s",
              }}
              title={objLabel(obj)}
              onClick={() => editorStore.select(obj.id, obj._kind)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── CameraKeyframeRow ─────────────────────────────────────────────────────────

interface CameraKeyframeRowProps {
  scene: Scene;
  pxPerSec: number;
  currentTime: number;
  selectedKfTime: number | null;
  onSelect: (time: number) => void;
  onSeek: (t: number) => void;
}

interface KfDiamondProps {
  kf: { time: number; x: number; y: number; zoom: number; easing: string };
  x: number;
  isSel: boolean;
  isHov: boolean;
  pxPerSec: number;
  scene: Scene;
  trackRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (time: number) => void;
  onHover: (time: number | null) => void;
}

function KfDiamond({ kf, x, isSel, isHov, pxPerSec, scene, trackRef: _trackRef, onSelect, onHover }: KfDiamondProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(kf.time);
    sceneStore.seek(scene.startTime + kf.time);

    const startMouseX = e.clientX;
    const startKfTime = kf.time;
    const maxTime     = scene.duration;
    let   latestTime  = startKfTime;
    let   didDrag     = false;

    // Capture the wrapper DOM node NOW — stable reference for the whole drag
    const wrapEl = wrapRef.current;
    if (!wrapEl) return;

    const onMove = (ev: MouseEvent) => {
      didDrag = true;
      const dx      = ev.clientX - startMouseX;
      const dtSecs  = dx / pxPerSec;
      latestTime    = Math.max(0, Math.min(maxTime, startKfTime + dtSecs));
      // Direct DOM mutation — no React re-render during drag
      wrapEl.style.left = `${latestTime * pxPerSec}px`;
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      if (!didDrag) return;
      const roundedTime = Math.round(latestTime * 100) / 100;
      // Single store commit on release
      sceneStore.removeCameraKeyframe(scene.id, startKfTime);
      sceneStore.addCameraKeyframe(scene.id, {
        ...kf,
        time: roundedTime,
        easing: kf.easing as any,
      });
      onSelect(roundedTime);
      sceneStore.seek(scene.startTime + roundedTime);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  };

  return (
    <div
      ref={wrapRef}
      style={{
        position: "absolute",
        left: x,
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: 20, height: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 5, cursor: "ew-resize",
      }}
      onMouseEnter={() => onHover(kf.time)}
      onMouseLeave={() => onHover(null)}
      onClick={e => {
        e.stopPropagation();
        onSelect(kf.time);
        sceneStore.seek(scene.startTime + kf.time);
      }}
      onMouseDown={onMouseDown}
    >
      {/* Diamond shape */}
      <div style={{
        width: 10, height: 10,
        transform: "rotate(45deg)",
        background: isSel ? "#f59e0b" : isHov ? "#fbbf24" : "rgba(245,158,11,0.6)",
        border: `1.5px solid ${isSel ? "#fef3c7" : "#f59e0b"}`,
        borderRadius: 2,
        boxShadow: isSel ? "0 0 0 3px rgba(245,158,11,0.3)" : "none",
        transition: "background 0.1s",
        flexShrink: 0,
        pointerEvents: "none",
      }} />

      {/* ✕ delete */}
      {(isHov || isSel) && (
        <div
          style={{
            position: "absolute",
            top: -8, right: -8,
            width: 14, height: 14,
            borderRadius: "50%",
            background: "#ef4444",
            border: "1px solid #fca5a5",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, color: "#fff", fontWeight: 700,
            cursor: "pointer", zIndex: 10, lineHeight: 1,
          }}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            sceneStore.removeCameraKeyframe(scene.id, kf.time);
            onHover(null);
          }}
          title={`Delete keyframe at ${kf.time.toFixed(2)}s`}
        >
          ✕
        </div>
      )}
    </div>
  );
}

function CameraKeyframeRow({
  scene, pxPerSec, currentTime: _currentTime, selectedKfTime, onSelect, onSeek,
}: CameraKeyframeRowProps) {
  const totalW = scene.duration * pxPerSec;
  const [hoveredKfTime, setHoveredKfTime] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{
      display: "flex", height: TRACK_H, alignItems: "center",
      borderBottom: `1px solid ${COLORS.border}11`,
      background: "rgba(245,158,11,0.03)",
    }}>
      {/* Label */}
      <div style={{
        width: LABEL_W, flexShrink: 0, padding: "0 10px",
        fontSize: 9, color: "#f59e0b", fontFamily: "monospace",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <span>🎥</span>
        <span>camera</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        style={{
          position: "relative", height: "100%",
          width: totalW, flexShrink: 0, cursor: "crosshair",
        }}
        onDoubleClick={e => {
          const localT = Math.max(0, Math.min(e.nativeEvent.offsetX / pxPerSec, scene.duration));
          onSeek(scene.startTime + localT);
        }}
      >
        {/* Baseline */}
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0,
          height: 1, background: "rgba(245,158,11,0.2)",
          transform: "translateY(-50%)", pointerEvents: "none",
        }} />

        {/* Interpolation lines */}
        {scene.cameraKeyframes.length > 1 &&
          scene.cameraKeyframes.slice(0, -1).map((kf, i) => {
            const x1 = kf.time * pxPerSec;
            const x2 = scene.cameraKeyframes[i + 1].time * pxPerSec;
            return (
              <div key={`line-${i}`} style={{
                position: "absolute",
                left: x1, top: "50%",
                width: Math.max(0, x2 - x1), height: 1,
                background: "rgba(245,158,11,0.35)",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }} />
            );
          })
        }

        {/* Keyframe diamonds */}
        {scene.cameraKeyframes.map(kf => {
          const x     = kf.time * pxPerSec;
          const isSel = selectedKfTime !== null && Math.abs(selectedKfTime - kf.time) < 0.05;
          const isHov = hoveredKfTime !== null && Math.abs(hoveredKfTime - kf.time) < 0.05;

          return (
            <KfDiamond
              key={kf.time}
              kf={kf}
              x={x}
              isSel={isSel}
              isHov={isHov}
              pxPerSec={pxPerSec}
              scene={scene}
              trackRef={trackRef}
              onSelect={onSelect}
              onHover={setHoveredKfTime}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── SceneSection ──────────────────────────────────────────────────────────────

interface SceneSectionProps {
  scene: Scene;
  currentTime: number;
  selectedId: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
  onSeek: (t: number) => void;
  selectedKfTime: number | null;
  onSelectKf: (time: number) => void;
}

function SceneSection({ scene, currentTime, selectedId, isCollapsed, onToggle, onSeek, selectedKfTime, onSelectKf }: SceneSectionProps) {
  const objects = getObjects(scene);
  const pxPerSec = PX_PER_SEC;
  const totalW = scene.duration * pxPerSec;
  const localTime = Math.max(0, currentTime - scene.startTime);
  const isActive = currentTime >= scene.startTime && currentTime < scene.startTime + scene.duration;
  const playheadX = Math.min(localTime * pxPerSec, totalW);

  // ── Collapsible Grouping State & Logic ──
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const groups: Record<string, AnyObj[]> = {};
  const ungrouped: AnyObj[] = [];

  objects.forEach(obj => {
    const groupId = (obj as any).groupId;
    if (groupId) {
      if (!groups[groupId]) groups[groupId] = [];
      groups[groupId].push(obj);
    } else {
      ungrouped.push(obj);
    }
  });

  const groupBounds = Object.keys(groups).reduce((acc, gId) => {
    const items = groups[gId];
    let minStart = Infinity;
    let maxEnd = -Infinity;
    items.forEach(item => {
      minStart = Math.min(minStart, item.startTime);
      maxEnd = Math.max(maxEnd, item.startTime + item.duration);
    });
    
    // Create a beautiful short name based on timestamp
    let cleanName = "AI Sketch Group";
    const firstObj = items[0];
    if (firstObj && firstObj.id) {
      const match = firstObj.id.match(/^svg-import-svg-group-(\d+)-/);
      if (match) {
        cleanName = `AI Sketch #${match[1].slice(-4)}`;
      } else {
        const localMatch = firstObj.id.match(/^svg-import-local-(\d+)-/);
        if (localMatch) cleanName = `Imported Vector #${localMatch[1].slice(-4)}`;
      }
    }
    
    acc[gId] = {
      startTime: minStart,
      duration: Math.max(0.2, maxEnd - minStart),
      name: cleanName,
    };
    return acc;
  }, {} as Record<string, { startTime: number; duration: number; name: string }>);

  const toggleGroup = (gId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [gId]: !prev[gId],
    }));
  };

  interface TimelineRow {
    id: string;
    type: "single" | "groupHeader" | "groupChild";
    name: string;
    groupId?: string;
    obj?: AnyObj;
    startTime: number;
    duration: number;
  }

  const rows: TimelineRow[] = [];
  const processedGroups = new Set<string>();

  objects.forEach(obj => {
    const gId = (obj as any).groupId;
    if (!gId) {
      rows.push({
        id: obj.id,
        type: "single",
        name: objLabel(obj),
        startTime: obj.startTime,
        duration: obj.duration,
        obj,
      });
    } else if (!processedGroups.has(gId)) {
      processedGroups.add(gId);
      const groupItems = groups[gId];
      const bounds = groupBounds[gId];
      const isGroupCollapsed = collapsedGroups[gId] !== false; // Default to collapsed!

      // 1. Group Header Row
      rows.push({
        id: `group-hdr-${gId}`,
        type: "groupHeader",
        name: bounds.name,
        groupId: gId,
        startTime: bounds.startTime,
        duration: bounds.duration,
      });

      // 2. Child Rows
      if (!isGroupCollapsed) {
        groupItems.forEach((item, idx) => {
          rows.push({
            id: item.id,
            type: "groupChild",
            name: `  ↳ Line Stroke ${idx + 1}`,
            groupId: gId,
            startTime: item.startTime,
            duration: item.duration,
            obj: item,
          });
        });
      }
    }
  });

  const handleUpdate = (obj: AnyObj, startTime: number, duration: number) => {
    const newStart = Math.max(0, startTime);
    const newDur   = Math.max(MIN_DURATION, duration);
    obj.startTime  = newStart;
    obj.duration   = newDur;
    // Auto-extend scene if clip goes past end
    const clipEnd  = newStart + newDur;
    if (clipEnd > scene.duration) {
      sceneStore.extendSceneDuration(scene.id, Math.round((clipEnd + 0.5) * 10) / 10);
    }
    if (obj._kind === "animated") {
      sceneStore.updateObject(scene.id, obj.id, { startTime: newStart, duration: newDur });
    } else if (obj._kind === "svg") {
      sceneStore.updateSvgObject(scene.id, obj.id, { startTime: newStart, duration: newDur });
    }
  };

  const handleGroupUpdate = (gId: string, newStart: number, newDur: number) => {
    const bounds = groupBounds[gId];
    if (!bounds) return;
    const deltaStart = newStart - bounds.startTime;
    const scaleFactor = bounds.duration > 0 ? newDur / bounds.duration : 1;

    groups[gId].forEach(item => {
      const localStartOffset = item.startTime - bounds.startTime;
      const nextItemStart = newStart + localStartOffset * scaleFactor;
      const nextItemDur = item.duration * scaleFactor;

      const nextStartClamped = Math.max(0, nextItemStart);
      const nextDurClamped = Math.max(0.1, nextItemDur);

      item.startTime = nextStartClamped;
      item.duration = nextDurClamped;

      if (item._kind === "animated") {
        sceneStore.updateObject(scene.id, item.id, { startTime: nextStartClamped, duration: nextDurClamped });
      } else if (item._kind === "svg") {
        sceneStore.updateSvgObject(scene.id, item.id, { startTime: nextStartClamped, duration: nextDurClamped });
      }
    });

    // Auto-extend scene if group clip goes past end
    const clipEnd = newStart + newDur;
    if (clipEnd > scene.duration) {
      sceneStore.extendSceneDuration(scene.id, Math.round((clipEnd + 0.5) * 10) / 10);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", borderBottom: `1px solid ${COLORS.border}`, position: "relative" }}>

      {/* ── Scene header row ── */}
      <div
        style={{
          display: "flex", height: SCENE_HDR_H, alignItems: "center",
          background: isActive ? COLORS.hdrActive : COLORS.hdrIdle,
          borderBottom: `1px solid ${COLORS.border}`,
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onClick={onToggle}
      >
        {/* Chevron + name */}
        <div style={{ width: LABEL_W, flexShrink: 0, padding: "0 8px 0 10px", display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
          {/* Animated chevron */}
          <span style={{
            fontSize: 8,
            color: isActive ? COLORS.accent : COLORS.muted,
            display: "inline-block",
            transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            lineHeight: 1,
            marginTop: 1,
          }}>
            ▼
          </span>
          <span style={{
            fontSize: 9,
            color: isActive ? COLORS.accent : COLORS.muted,
            fontWeight: isActive ? 700 : 400,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {scene.name}
          </span>
        </div>

        {/* Ruler in header row */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden", height: "100%" }}>
          <TimeRuler duration={scene.duration} pxPerSec={pxPerSec} />
        </div>
      </div>

      {/* ── Collapsed: compact band ── */}
      {isCollapsed && (
        <CompactBand
          objects={objects}
          scene={scene}
          pxPerSec={pxPerSec}
          selectedId={selectedId}
        />
      )}

      {/* ── Expanded: full track rows ── */}
      {!isCollapsed && (
        <>
          {/* ── Camera keyframe row ── */}
          <CameraKeyframeRow
            scene={scene}
            pxPerSec={pxPerSec}
            currentTime={currentTime}
            selectedKfTime={selectedKfTime}
            onSelect={onSelectKf}
            onSeek={onSeek}
          />
          {rows.map(row => (
            <div
              key={row.id}
              style={{
                display: "flex",
                height: TRACK_H,
                alignItems: "center",
                borderBottom: `1px solid ${COLORS.border}11`,
                background: row.type === "groupHeader" ? "rgba(255,255,255,0.015)" : "transparent",
              }}
            >
              {/* Label */}
              <div
                style={{
                  width: LABEL_W,
                  flexShrink: 0,
                  padding: "0 10px",
                  fontSize: 9,
                  color: row.type === "groupHeader" ? (selectedId && groups[row.groupId!]?.some(item => item.id === selectedId) ? COLORS.accent : COLORS.muted) : selectedId === row.id ? COLORS.accent : COLORS.muted,
                  fontWeight: row.type === "groupHeader" ? 600 : 400,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onClick={() => {
                  if (row.type === "groupHeader" && row.groupId) {
                    toggleGroup(row.groupId);
                    const firstItem = groups[row.groupId]?.[0];
                    if (firstItem) {
                      editorStore.select(firstItem.id, firstItem._kind);
                    }
                  } else if (row.obj) {
                    editorStore.select(row.obj.id, row.obj._kind);
                  }
                }}
              >
                {row.type === "groupHeader" && (
                  <span style={{ fontSize: 7, color: COLORS.muted, marginRight: 2 }}>
                    {collapsedGroups[row.groupId!] !== false ? "▶" : "▼"}
                  </span>
                )}
                {row.name}
              </div>

              {/* Track area */}
              <div
                style={{ position: "relative", height: "100%", width: totalW, flexShrink: 0, cursor: "crosshair" }}
                onClick={e => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  onSeek(scene.startTime + (e.clientX - rect.left) / pxPerSec);
                }}
              >
                {row.type === "groupHeader" ? (
                  <ObjectBar
                    obj={{
                      id: row.id,
                      groupId: row.groupId,
                      pathData: "",
                      x: 0, y: 0,
                      strokeColor: "#38bdf8", // Sky blue for grouping highlight
                      strokeWidth: 3,
                      startTime: row.startTime,
                      duration: row.duration,
                      _kind: "svg" as const,
                      drawMode: "stroke" as const,
                    }}
                    scene={scene}
                    pxPerSec={pxPerSec}
                    isSelected={selectedId && groups[row.groupId!]?.some(item => item.id === selectedId)}
                    height={TRACK_H - 10}
                    onSelect={() => {
                      if (row.groupId) {
                        const firstItem = groups[row.groupId]?.[0];
                        if (firstItem) {
                          editorStore.select(firstItem.id, firstItem._kind);
                        }
                      }
                    }}
                    onUpdate={(st, dur) => row.groupId && handleGroupUpdate(row.groupId, st, dur)}
                  />
                ) : (
                  row.obj && (
                    <ObjectBar
                      obj={row.obj}
                      scene={scene}
                      pxPerSec={pxPerSec}
                      isSelected={selectedId === row.obj.id}
                      onSelect={() => row.obj && editorStore.select(row.obj.id, row.obj._kind)}
                      onUpdate={(st, dur) => row.obj && handleUpdate(row.obj, st, dur)}
                    />
                  )
                )}
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div style={{ display: "flex", height: TRACK_H }}>
              <div style={{ width: LABEL_W, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 10px" }}>
                <span style={{ fontSize: 9, color: COLORS.muted, opacity: 0.4 }}>no objects</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Playhead — draggable */}
      {isActive && (() => {
        const lineRef = { current: null as HTMLDivElement | null };
        return (
          <div
            ref={el => { lineRef.current = el; }}
            style={{
              position: "absolute",
              left: LABEL_W + playheadX + 16,
              top: 0,
              width: 1,
              height: "100%",
              zIndex: 20,
              cursor: "ew-resize",
              // Wide invisible hit area so it's easy to grab
              padding: "0 8px",
              marginLeft: -8,
              boxSizing: "content-box",
              background: "transparent",
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none", // Allow clicks to pass through to underlying elements
            }}
          >
            {/* Visible line */}
            <div style={{
              width: 1,
              height: "100%",
              background: COLORS.playhead,
              pointerEvents: "none",
            }} />
            {/* Diamond handle — easy to see and grab */}
            <div
              style={{
                position: "absolute",
                top: 6,
                left: "50%",
                transform: "translateX(-50%) rotate(45deg)",
                width: 12, height: 12,
                background: COLORS.playhead,
                border: "2px solid #fff",
                borderRadius: 2,
                pointerEvents: "auto", // Intercept pointer events strictly on the diamond
                cursor: "ew-resize",
              }}
              onMouseDown={e => {
                e.stopPropagation();
                e.preventDefault();

                // Capture the playhead wrapper element (parent of this handle)
                const playheadEl = (e.currentTarget as HTMLDivElement).parentElement!;
                
                // Capture the scene section container — grandparent of this handle
                const sectionEl = playheadEl.parentElement!;
                const sectionRect = sectionEl.getBoundingClientRect();
                
                const scrollEl   = sectionEl.closest("[data-timeline-scroll]") as HTMLElement;
                const scrollLeft = scrollEl ? scrollEl.scrollLeft : 0;
                const trackLeft  = sectionRect.left + LABEL_W - scrollLeft + 14;

                const onMove = (ev: MouseEvent) => {
                  const rawX    = ev.clientX - trackLeft;
                  const localT  = Math.max(0, Math.min(scene.duration, rawX / pxPerSec));
                  const globalT = scene.startTime + localT;

                  // Direct DOM update — no React re-render during drag
                  if (playheadEl) {
                    playheadEl.style.left = `${LABEL_W + localT * pxPerSec + 16}px`;
                  }

                  // Throttle store seek to avoid flooding
                  onSeek(globalT);
                };

                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup",   onUp);
                };

                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup",   onUp);
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}

// ── TimelinePanel ─────────────────────────────────────────────────────────────

interface TimelinePanelProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  exporting: boolean;
  exportFormat: string;
  onScrub: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPlay: () => void;
  onReset: () => void;
  onExport: () => void;
  selectedId: string | null;
  onAddCameraKeyframe: () => void;
  selectedKfTime: number | null;
  setSelectedKfTime: (time: number | null) => void;
  onPreviewVideo?: () => void;
}

export function TimelinePanel({
  currentTime, totalDuration, isPlaying, exporting,
  exportFormat, onScrub, onPlay, onReset, onExport, selectedId, onAddCameraKeyframe,
  selectedKfTime, setSelectedKfTime,
}: TimelinePanelProps) {
  const [panelExpanded, setPanelExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scenes = sceneStore.getManager().scenes;

  const [collapsedScenes, setCollapsedScenes] = useState<Set<string>>(() => new Set());

  const [panelHeight, setPanelHeight] = useState(160);
  const isResizingPanelRef = useRef(false);

  const startResizePanel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingPanelRef.current = true;
    
    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizingPanelRef.current) return;
      const nextHeight = window.innerHeight - ev.clientY - 40;
      setPanelHeight(Math.max(60, Math.min(500, nextHeight)));
    };
    
    const onMouseUp = () => {
      isResizingPanelRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const unsubscribe = sceneStore.subscribe(() => forceUpdate(n => n + 1));
    return () => { unsubscribe(); };
  }, []);

  const handleSelectKf = useCallback((time: number) => {
    setSelectedKfTime((selectedKfTime !== null && Math.abs(selectedKfTime - time) < 0.05) ? null : time);
  }, [selectedKfTime, setSelectedKfTime]);

  const toggleScene = useCallback((sceneId: string) => {
    setCollapsedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  }, []);

  // Collapse all / expand all helpers
  const collapseAll = useCallback(() => {
    setCollapsedScenes(new Set(scenes.map(s => s.id)));
  }, [scenes]);

  const expandAll = useCallback(() => {
    setCollapsedScenes(new Set());
  }, []);

  const allCollapsed = scenes.every(s => collapsedScenes.has(s.id));

  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      background: COLORS.bg,
      borderTop: `1px solid ${COLORS.border}`,
      zIndex: 20,
      display: "flex", flexDirection: "column",
      userSelect: "none",
    }}>
      {/* Top Resize handle bar for vertical height resizing */}
      <div
        onMouseDown={startResizePanel}
        style={{
          height: 6,
          cursor: "ns-resize",
          background: "transparent",
          position: "absolute",
          top: -3,
          left: 0,
          right: 0,
          zIndex: 1000,
          transition: "background 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = COLORS.accent}
        onMouseLeave={e => {
          if (!isResizingPanelRef.current) e.currentTarget.style.background = "transparent";
        }}
      />

      {/* ── Top control bar ──────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "6px 12px",
        borderBottom: `1px solid ${COLORS.border}`,
        height: 40, flexShrink: 0,
      }}>

        {/* Panel expand/collapse toggle */}
        <button
          onClick={() => setPanelExpanded(e => !e)}
          title={panelExpanded ? "Hide timeline" : "Show timeline"}
          style={iconBtn()}
        >
          {panelExpanded ? "▾" : "▸"}
        </button>

        {/* Reset + Play */}
        <button onClick={onReset} disabled={exporting} style={ctrlBtn()}>⏮</button>
        <button onClick={onPlay} disabled={exporting} style={ctrlBtn(true)}>
          {isPlaying ? "⏸" : "▶"}
        </button>

        {/* Add camera keyframe button */}
        <button
          onClick={onAddCameraKeyframe}
          title="Add camera keyframe at current time"
          style={{
            ...ctrlBtn(),
            color: "#f59e0b",
            border: "1px solid rgba(245,158,11,0.4)",
            background: "rgba(245,158,11,0.08)",
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          🎥 +KF
        </button>

        {/* Delete camera keyframe button */}
        {selectedKfTime !== null && (
          <button
            onClick={() => {
              const activeScene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
              if (activeScene) {
                sceneStore.removeCameraKeyframe(activeScene.id, selectedKfTime);
                setSelectedKfTime(null);
              }
            }}
            title={`Delete selected camera keyframe at ${selectedKfTime.toFixed(2)}s`}
            style={{
              ...ctrlBtn(),
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.4)",
              background: "rgba(239,68,68,0.08)",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            🎥 -KF
          </button>
        )}

        {/* Time */}
        <span style={{ color: COLORS.muted, fontSize: 10, minWidth: 80, fontFamily: "monospace" }}>
          {currentTime.toFixed(2)}s / {totalDuration}s
        </span>

        {/* Beautiful premium Timeline Slider */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", position: "relative" }}>
          <style dangerouslySetInnerHTML={{ __html: `
            .timeline-scrub-slider {
              width: 100%;
              -webkit-appearance: none;
              appearance: none;
              height: 6px;
              border-radius: 3px;
              outline: none;
              cursor: pointer;
              background: rgba(99, 102, 241, 0.18);
              transition: background 0.15s ease-in-out;
            }
            .timeline-scrub-slider::-webkit-slider-runnable-track {
              width: 100%;
              height: 6px;
              cursor: pointer;
              background: transparent;
              border-radius: 3px;
            }
            .timeline-scrub-slider::-webkit-slider-thumb {
              height: 14px;
              width: 14px;
              border-radius: 50%;
              background: #ffffff;
              border: 2.5px solid #ffffff;
              cursor: pointer;
              -webkit-appearance: none;
              margin-top: -4px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
              transition: transform 0.1s ease, background-color 0.1s ease;
            }
            .timeline-scrub-slider::-webkit-slider-thumb:hover {
              transform: scale(1.2);
              background: #ffffff;
            }
            .timeline-scrub-slider::-moz-range-thumb {
              height: 10px;
              width: 10px;
              border-radius: 50%;
              background: #ffffff;
              border: 2.5px solid #ffffff;
              cursor: pointer;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
              transition: transform 0.1s ease, background-color 0.1s ease;
            }
            .timeline-scrub-slider::-moz-range-thumb:hover {
              transform: scale(1.2);
              background: #ffffff;
            }
          ` }} />
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.01}
            value={currentTime}
            onChange={onScrub}
            className="timeline-scrub-slider"
            style={{
              background: `linear-gradient(to right, ${COLORS.accent} 0%, ${COLORS.accent} ${(currentTime / Math.max(0.1, totalDuration)) * 100}%, ${COLORS.border} ${(currentTime / Math.max(0.1, totalDuration)) * 100}%, ${COLORS.border} 100%)`
            }}
          />
        </div>

        {/* Scene pills */}
        <div style={{ display: "flex", gap: 4 }}>
          {scenes.map(s => {
            const active = sceneStore.getActiveScene()?.id === s.id;
            return (
              <button key={s.id} onClick={() => sceneStore.seek(s.startTime)} style={{
                padding: "2px 8px", borderRadius: 20, fontSize: 9,
                cursor: "pointer",
                border: active ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                background: active ? COLORS.accent : "transparent",
                color: active ? "#000" : COLORS.muted,
              }}>
                {s.name}
              </button>
            );
          })}
        </div>

        {/* Collapse-all / Expand-all */}
        {panelExpanded && (
          <button
            onClick={allCollapsed ? expandAll : collapseAll}
            title={allCollapsed ? "Expand all scenes" : "Collapse all scenes"}
            style={iconBtn()}
          >
            {allCollapsed ? "⊞" : "⊟"}
          </button>
        )}

        {/* Export */}
        <button onClick={onExport} disabled={exporting} style={ctrlBtn()}>
          ⬇ {exportFormat.toUpperCase()}
        </button>
      </div>

      {/* ── Timeline tracks ──────────────────────────────────────────── */}
      {panelExpanded && (
        <div
          ref={scrollRef}
          data-timeline-scroll=""
          style={{ overflowX: "auto", overflowY: "auto", height: panelHeight, position: "relative" }}
        >
          {scenes.map(scene => (
            <SceneSection
              key={scene.id}
              scene={scene}
              currentTime={currentTime}
              selectedId={selectedId}
              isCollapsed={collapsedScenes.has(scene.id)}
              onToggle={() => toggleScene(scene.id)}
              onSeek={t => sceneStore.seek(t)}
              selectedKfTime={selectedKfTime}
              onSelectKf={handleSelectKf}
            />
          ))}

          {/* Global Audio Tracks Section */}
          {(() => {
            const audioTracks = sceneStore.getManager().audioTracks ?? [];
            if (audioTracks.length === 0) return null;

            return (
              <div style={{ borderTop: `1.5px dashed ${COLORS.border}`, background: "rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>
                {audioTracks.map((track) => {
                  const isSelected = selectedId === track.id;
                  const trackLeft = track.startTime * PX_PER_SEC;
                  const trackWidth = Math.max(8, track.duration * PX_PER_SEC);

                  return (
                    <div
                      key={track.id}
                      style={{
                        display: "flex",
                        height: 32,
                        alignItems: "center",
                        position: "relative",
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {/* Left Column Label spacer */}
                      <div
                        style={{
                          width: LABEL_W,
                          flexShrink: 0,
                          padding: "0 10px",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          background: COLORS.dimmer,
                          height: "100%",
                          borderRight: `1px solid ${COLORS.border}`,
                          zIndex: 5,
                        }}
                      >
                        <span style={{ fontSize: 9, color: COLORS.audio, fontWeight: "bold", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          🔊 {track.name}
                        </span>
                      </div>

                      {/* Right Timeline Area where the audio block is rendered */}
                      <div style={{ position: "relative", height: "100%", width: totalDuration * PX_PER_SEC, flexShrink: 0 }}>
                        <div
                          style={{
                            position: "absolute",
                            left: trackLeft,
                            width: trackWidth,
                            top: 4,
                            bottom: 4,
                            borderRadius: 4,
                            background: isSelected ? "rgba(192, 132, 252, 0.25)" : "rgba(192, 132, 252, 0.12)",
                            border: isSelected ? `1.5px solid ${COLORS.audio}` : "1px solid rgba(192, 132, 252, 0.35)",
                            cursor: "grab",
                            display: "flex",
                            alignItems: "center",
                            padding: "0 6px",
                            boxSizing: "border-box",
                            overflow: "hidden",
                            userSelect: "none",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            editorStore.select(track.id, "audio");
                          }}
                          onMouseDown={(e) => {
                            // Draggable logic for Audio Block start time
                            e.stopPropagation();
                            e.preventDefault();
                            editorStore.select(track.id, "audio");

                            const startX = e.clientX;
                            const initialStart = track.startTime;

                            const onMouseMove = (ev: MouseEvent) => {
                              const dx = ev.clientX - startX;
                              const dt = dx / PX_PER_SEC;
                              const nextStart = Math.max(0, initialStart + dt);
                              sceneStore.updateAudioTrack(track.id, { startTime: nextStart });
                            };

                            const onMouseUp = () => {
                              window.removeEventListener("mousemove", onMouseMove);
                              window.removeEventListener("mouseup", onMouseUp);
                            };

                            window.addEventListener("mousemove", onMouseMove);
                            window.addEventListener("mouseup", onMouseUp);
                          }}
                        >
                          {/* Left Trim Handle */}
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 6,
                              cursor: "ew-resize",
                              background: "rgba(192, 132, 252, 0.25)",
                            }}
                            onMouseDown={(e) => {
                              // Drag to crop/trim start
                              e.stopPropagation();
                              e.preventDefault();
                              const startX = e.clientX;
                              const initialStart = track.startTime;
                              const initialDuration = track.duration;

                              const onMouseMove = (ev: MouseEvent) => {
                                const dx = ev.clientX - startX;
                                const dt = dx / PX_PER_SEC;
                                const nextStart = Math.max(0, initialStart + dt);
                                const nextDuration = Math.max(0.1, initialDuration - (nextStart - initialStart));
                                sceneStore.updateAudioTrack(track.id, {
                                  startTime: nextStart,
                                  duration: nextDuration,
                                });
                              };

                              const onMouseUp = () => {
                                window.removeEventListener("mousemove", onMouseMove);
                                window.removeEventListener("mouseup", onMouseUp);
                              };

                              window.addEventListener("mousemove", onMouseMove);
                              window.addEventListener("mouseup", onMouseUp);
                            }}
                          />

                          {/* Waveform Lines Representation */}
                          <div style={{ display: "flex", gap: 2, alignItems: "center", flex: 1, opacity: 0.5, pointerEvents: "none", margin: "0 8px" }}>
                            <div style={{ height: 6, width: 1.5, background: COLORS.audio }} />
                            <div style={{ height: 12, width: 1.5, background: COLORS.audio }} />
                            <div style={{ height: 8, width: 1.5, background: COLORS.audio }} />
                            <div style={{ height: 14, width: 1.5, background: COLORS.audio }} />
                            <div style={{ height: 10, width: 1.5, background: COLORS.audio }} />
                            <div style={{ height: 16, width: 1.5, background: COLORS.audio }} />
                            <div style={{ height: 8, width: 1.5, background: COLORS.audio }} />
                            <div style={{ height: 12, width: 1.5, background: COLORS.audio }} />
                          </div>

                          <span style={{ fontSize: 8, color: "#000", fontWeight: 500, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", pointerEvents: "none" }}>
                            {track.name} ({track.duration.toFixed(1)}s)
                          </span>

                          {/* Right Trim Handle */}
                          <div
                            style={{
                              position: "absolute",
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: 6,
                              cursor: "ew-resize",
                              background: "rgba(192, 132, 252, 0.25)",
                            }}
                            onMouseDown={(e) => {
                              // Drag to crop/trim duration
                              e.stopPropagation();
                              e.preventDefault();
                              const startX = e.clientX;
                              const initialDuration = track.duration;

                              const onMouseMove = (ev: MouseEvent) => {
                                const dx = ev.clientX - startX;
                                const dt = dx / PX_PER_SEC;
                                const nextDuration = Math.max(0.1, initialDuration + dt);
                                sceneStore.updateAudioTrack(track.id, { duration: nextDuration });
                              };

                              const onMouseUp = () => {
                                window.removeEventListener("mousemove", onMouseMove);
                                window.removeEventListener("mouseup", onMouseUp);
                              };

                              window.addEventListener("mousemove", onMouseMove);
                              window.addEventListener("mouseup", onMouseUp);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function ctrlBtn(primary = false): React.CSSProperties {
  return {
    padding: "3px 10px", borderRadius: 6, fontSize: 10,
    fontFamily: "monospace", cursor: "pointer", border: "none",
    background: primary ? COLORS.accent : COLORS.accentDim,
    color: primary ? "#000" : COLORS.muted,
  };
}

function iconBtn(): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: 4, border: `1px solid ${COLORS.border}`,
    background: "transparent", color: COLORS.muted, cursor: "pointer",
    fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
  };
}