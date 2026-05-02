/**
 * TimelinePanel — visual timeline showing all objects as draggable bars.
 * Drag bar body      → change startTime
 * Drag bar right edge→ change duration
 * Click bar          → select object
 * Click track area   → seek to time
 * Click scene header → collapse / expand that scene's tracks
 */

import { useRef, useState, useCallback } from "react";
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
  bg: "#0c1117",
  surface: "#141920",
  border: "rgba(99,102,241,0.18)",
  accent: "#6366f1",
  accentDim: "rgba(99,102,241,0.18)",
  text: "#e2e8f0",
  muted: "#64748b",
  dimmer: "#1e2530",
  animated: "#6366f1",
  svg: "#10b981",
  playhead: "#f43f5e",
  hdrActive: "rgba(99,102,241,0.14)",
  hdrIdle: "rgba(255,255,255,0.03)",
};

type AnyObj = (AnimatedObject & { _kind: "animated" }) | (SvgPathObject & { _kind: "svg" });

function getObjects(scene: Scene): AnyObj[] {
  const animated = scene.objects.map(o => ({ ...o, _kind: "animated" as const }));
  const svg = (scene.svgObjects ?? []).map(o => ({ ...o, _kind: "svg" as const }));
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

  const onMouseDown = (e: React.MouseEvent, kind: "move" | "resize") => {
    e.stopPropagation();
    onSelect();
    dragKind.current = kind;
    dragStart.current = { mouseX: e.clientX, startTime: obj.startTime, duration: obj.duration };

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStart.current.mouseX;
      const dtSecs = dx / pxPerSec;
      const sceneDur = scene.duration;
      if (dragKind.current === "move") {
        const newStart = Math.max(0, Math.min(sceneDur - dragStart.current.duration, dragStart.current.startTime + dtSecs));
        onUpdate(Math.round(newStart * 100) / 100, dragStart.current.duration);
      } else {
        const newDur = Math.max(MIN_DURATION, Math.min(sceneDur - dragStart.current.startTime, dragStart.current.duration + dtSecs));
        onUpdate(dragStart.current.startTime, Math.round(newDur * 100) / 100);
      }
    };
    const onUp = () => {
      dragKind.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
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
      <span style={{ fontSize: 9, color: "#fff", padding: "0 5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none", fontFamily: "monospace" }}>
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

// ── SceneSection ──────────────────────────────────────────────────────────────

interface SceneSectionProps {
  scene: Scene;
  currentTime: number;
  selectedId: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
  onSeek: (t: number) => void;
}

function SceneSection({ scene, currentTime, selectedId, isCollapsed, onToggle, onSeek }: SceneSectionProps) {
  const objects = getObjects(scene);
  const pxPerSec = PX_PER_SEC;
  const totalW = scene.duration * pxPerSec;
  const localTime = Math.max(0, currentTime - scene.startTime);
  const isActive = currentTime >= scene.startTime && currentTime < scene.startTime + scene.duration;
  const playheadX = Math.min(localTime * pxPerSec, totalW);

  const handleUpdate = (obj: AnyObj, startTime: number, duration: number) => {
    if (obj._kind === "animated") {
      sceneStore.updateObject(scene.id, obj.id, { startTime, duration });
    } else {
      const svgObj = scene.svgObjects?.find(o => o.id === obj.id);
      if (svgObj) { svgObj.startTime = startTime; svgObj.duration = duration; }
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
          {objects.map(obj => (
            <div
              key={obj.id}
              style={{ display: "flex", height: TRACK_H, alignItems: "center", borderBottom: `1px solid ${COLORS.border}11` }}
            >
              {/* Label */}
              <div
                style={{ width: LABEL_W, flexShrink: 0, padding: "0 10px", fontSize: 9, color: selectedId === obj.id ? COLORS.accent : COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                onClick={() => editorStore.select(obj.id, obj._kind)}
              >
                {objLabel(obj)}
              </div>

              {/* Track area */}
              <div
                style={{ position: "relative", height: "100%", width: totalW, flexShrink: 0, cursor: "crosshair" }}
                onClick={e => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  onSeek(scene.startTime + (e.clientX - rect.left) / pxPerSec);
                }}
              >
                <ObjectBar
                  obj={obj}
                  scene={scene}
                  pxPerSec={pxPerSec}
                  isSelected={selectedId === obj.id}
                  onSelect={() => editorStore.select(obj.id, obj._kind)}
                  onUpdate={(st, dur) => handleUpdate(obj, st, dur)}
                />
              </div>
            </div>
          ))}

          {objects.length === 0 && (
            <div style={{ display: "flex", height: TRACK_H }}>
              <div style={{ width: LABEL_W, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 10px" }}>
                <span style={{ fontSize: 9, color: COLORS.muted, opacity: 0.4 }}>no objects</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Playhead overlay (active scene only) ── */}
      {isActive && (
        <div style={{
          position: "absolute",
          left: LABEL_W + playheadX,
          top: 0, width: 1, height: "100%",
          background: COLORS.playhead,
          pointerEvents: "none",
          zIndex: 10,
        }} />
      )}
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
}

export function TimelinePanel({
  currentTime, totalDuration, isPlaying, exporting,
  exportFormat, onScrub, onPlay, onReset, onExport, selectedId,
}: TimelinePanelProps) {
  const [panelExpanded, setPanelExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scenes = sceneStore.getManager().scenes;

  // Per-scene collapse state: Set of scene IDs that are collapsed
  const [collapsedScenes, setCollapsedScenes] = useState<Set<string>>(() => new Set());

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

        {/* Time */}
        <span style={{ color: COLORS.muted, fontSize: 10, minWidth: 80, fontFamily: "monospace" }}>
          {currentTime.toFixed(2)}s / {totalDuration}s
        </span>

        {/* Scrubber */}
        <input
          type="range" min={0} max={totalDuration} step={0.01}
          value={currentTime} onChange={onScrub}
          style={{ flex: 1, accentColor: COLORS.accent, cursor: "pointer" }}
        />

        {/* Scene pills */}
        <div style={{ display: "flex", gap: 4 }}>
          {scenes.map(s => {
            const active = sceneStore.getActiveScene()?.id === s.id;
            return (
              <button key={s.id} onClick={() => sceneStore.seek(s.startTime)} style={{
                padding: "2px 8px", borderRadius: 20, fontSize: 9,
                fontFamily: "monospace", cursor: "pointer",
                border: active ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                background: active ? COLORS.accent : "transparent",
                color: active ? "#fff" : COLORS.muted,
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
          style={{ overflowX: "auto", overflowY: "auto", maxHeight: 240, position: "relative" }}
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
            />
          ))}
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
    color: primary ? "#fff" : COLORS.muted,
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