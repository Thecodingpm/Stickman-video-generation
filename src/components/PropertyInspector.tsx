import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { editorStore } from "../store/editorStore";
import { sceneStore } from "../store/sceneStore";
import { SvgEasing } from "../core/svgPath";
import type { AnimatedObject } from "../core/timeline";
import type { SvgPathObject } from "../core/svgPath";
import { TransformKeyframeEditor } from "./TransformKeyframeEditor";
const GOOGLE_FONTS = [
  { name: "Georgia (Serif)", family: "Georgia, serif" },
  { name: "Monospace", family: "monospace" },
  { name: "Arial (Sans)", family: "Arial, sans-serif" },
  { name: "Times New Roman", family: "'Times New Roman', serif" },
  { name: "Courier New", family: "'Courier New', monospace" },
  { name: "Impact", family: "Impact, sans-serif" },

  // Cursive & Handwriting Fonts
  { name: "Caveat (Cursive)", family: "'Caveat', cursive" },
  { name: "Architects Daughter", family: "'Architects Daughter', cursive" },
  { name: "Pacifico", family: "'Pacifico', cursive" },
  { name: "Satisfy", family: "'Satisfy', cursive" },
  { name: "Gloria Hallelujah", family: "'Gloria Hallelujah', cursive" },
  { name: "Kalam", family: "'Kalam', cursive" },

  // Sleek Modern Sans-Serif
  { name: "Inter (Poppins)", family: "'Inter', sans-serif" },
  { name: "Poppins", family: "'Poppins', sans-serif" },
  { name: "Montserrat", family: "'Montserrat', sans-serif" },
  { name: "Roboto", family: "'Roboto', sans-serif" },

  // Classic Serifs
  { name: "Playfair Display", family: "'Playfair Display', serif" },
  { name: "Lora", family: "'Lora', serif" },
];

const COLORS = {
  bg:        "#121214",
  surface:   "#1a1a1e",
  border:    "rgba(255,255,255,0.08)",
  accent:    "#ffffff",
  accentDim: "rgba(255,255,255,0.06)",
  text:      "#f4f4f5",
  muted:     "#8e8e93",
  dimmer:    "#222226",
  green:     "#34d399",
  yellow:    "#fbbf24",
  red:       "#ef4444",
};

// ── PropRow Helper ────────────────────────────────────────────────────────────
function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "6px 0" }}>
      <span style={{ color: COLORS.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0, fontWeight: 600 }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

// ── Custom Input Helper ──────────────────────────────────────────────────────
function StyledNumInput({
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const [localVal, setLocalVal] = useState(String(value));

  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  const handleBlur = () => {
    let parsed = parseFloat(localVal);
    if (isNaN(parsed)) parsed = 0;
    if (min !== undefined) parsed = Math.max(min, parsed);
    if (max !== undefined) parsed = Math.min(max, parsed);
    onChange(parsed);
  };

  return (
    <input
      type="number"
      value={localVal}
      step={step}
      onChange={e => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => e.stopPropagation()}
      style={{
        width: 68,
        padding: "4px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontFamily: "monospace",
        textAlign: "right",
        background: COLORS.dimmer,
        border: `1px solid ${COLORS.border}`,
        color: COLORS.text,
        outline: "none",
        transition: "border-color 0.15s",
      }}
      onFocus={e => (e.target.style.borderColor = COLORS.accent)}
    />
  );
}

// ── Stable TextArea Component ─────────────────────────────────────────────────
const TextEditor = React.memo(function TextEditor({
  objectId,
  initialValue,
  revision,
  onChange,
  onCommit,
}: {
  objectId: string;
  initialValue: string;
  revision: number;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const prevIdRef = useRef(objectId);

  useEffect(() => {
    if (!ref.current) return;

    if (prevIdRef.current !== objectId) {
      prevIdRef.current = objectId;
      ref.current.value = initialValue;
      return;
    }

    if (document.activeElement !== ref.current) {
      ref.current.value = initialValue;
    }
  }, [objectId, initialValue, revision]);

  return (
    <textarea
      ref={ref}
      defaultValue={initialValue}
      placeholder="Type text..."
      onInput={e => onChange((e.target as HTMLTextAreaElement).value)}
      onBlur={e => onCommit(e.target.value)}
      onKeyDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      style={{
        width: 140,
        minHeight: 56,
        padding: "6px 10px",
        borderRadius: 6,
        fontSize: 11,
        fontFamily: "monospace",
        resize: "vertical",
        background: COLORS.dimmer,
        border: `1px solid ${COLORS.border}`,
        color: COLORS.text,
        outline: "none",
        lineHeight: 1.4,
        userSelect: "text",
        transition: "border-color 0.15s",
      }}
      onFocus={e => (e.target.style.borderColor = COLORS.accent)}
    />
  );
});

// ── Select Element Styles ─────────────────────────────────────────────────────
const selectStyle: React.CSSProperties = {
  background: COLORS.dimmer,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 6,
  fontSize: 10,
  padding: "4px 8px",
  cursor: "pointer",
  outline: "none",
  width: 110,
  fontFamily: "monospace",
};

// ── Premium SVG Icons ────────────────────────────────────────────────────────
const Icons = {
  Camera: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Position: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <polyline points="5 9 2 12 5 15" />
      <polyline points="9 5 12 2 15 5" />
      <polyline points="15 19 12 22 9 19" />
      <polyline points="19 9 22 12 19 15" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  ),
  Dimension: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="9" y1="9" x2="21" y2="9" />
    </svg>
  ),
  Text: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  ),
  Color: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
      <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor" />
      <circle cx="11.5" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="16.5" cy="9.5" r="1.5" fill="currentColor" />
    </svg>
  ),
  Timing: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Entry: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  ),
  Draw: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  Exit: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Transform: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Duplicate: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Trash: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  AlignLeft: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <line x1="17" y1="10" x2="3" y2="10" />
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="14" x2="3" y2="14" />
      <line x1="17" y1="18" x2="3" y2="18" />
    </svg>
  ),
  AlignCenter: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <line x1="18" y1="10" x2="6" y2="10" />
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="14" x2="3" y2="14" />
      <line x1="18" y1="18" x2="6" y2="18" />
    </svg>
  ),
  AlignRight: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <line x1="21" y1="10" x2="7" y2="10" />
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="14" x2="3" y2="14" />
      <line x1="21" y1="18" x2="7" y2="18" />
    </svg>
  ),
  Eye: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  ChevronDown: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  ChevronRight: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
};

// ── Premium CollapsibleSection Component ─────────────────────────────────────────
function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", margin: "4px 0" }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderBottomLeftRadius: isOpen ? 0 : 8,
          borderBottomRightRadius: isOpen ? 0 : 8,
          background: isOpen ? "rgba(99, 102, 241, 0.07)" : COLORS.dimmer,
          border: `1px solid ${isOpen ? "rgba(99, 102, 241, 0.25)" : COLORS.border}`,
          cursor: "pointer",
          userSelect: "none",
          transition: "all 0.15s ease-in-out",
        }}
        onMouseEnter={e => {
          if (!isOpen) {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
            e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.3)";
          }
        }}
        onMouseLeave={e => {
          if (!isOpen) {
            e.currentTarget.style.background = COLORS.dimmer;
            e.currentTarget.style.borderColor = COLORS.border;
          }
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: isOpen ? COLORS.accent : COLORS.text }}>
          {icon}
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "sans-serif" }}>
            {title}
          </span>
        </div>
        <div style={{ color: isOpen ? COLORS.accent : COLORS.muted, display: "flex", alignItems: "center" }}>
          {isOpen ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
        </div>
      </div>
      {isOpen && (
        <div
          style={{
            padding: "12px 14px",
            background: "rgba(20, 25, 32, 0.2)",
            border: `1px solid ${COLORS.border}`,
            borderTop: "none",
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface PropertyInspectorProps {
  selectedKfTime: number | null;
  setSelectedKfTime: (time: number | null) => void;
}

export function PropertyInspector({ selectedKfTime, setSelectedKfTime }: PropertyInspectorProps) {
  const [editorState, setEditorState] = useState(editorStore.getState());
  const [sceneVer, setSceneVer] = useState(0);

  // Accordion open/close state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    camera: true,
    transform: true,
    dimensions: true,
    typography: true,
    styling: true,
    timeline: true,
    entry: true,
    scribe: true,
    exit: true,
    transformKf: true,
  });

  const toggleSection = (sec: string) => {
    setCollapsedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Subscribe to selection & scene changes to trigger visual updates
  useEffect(() => {
    const unsubEditor = editorStore.subscribe(() => {
      setEditorState(editorStore.getState());
    });
    const unsubScene = sceneStore.subscribe(() => {
      setSceneVer(v => v + 1);
    });
    return () => {
      unsubEditor();
      unsubScene();
    };
  }, []);

  // Compute selected object or audio track
  const selectedObj = useMemo(() => {
    const sel = editorState.selected;
    if (!sel) return null;
    if (sel.type === "audio") {
      return sceneStore.getManager().audioTracks?.find(t => t.id === sel.id) ?? null;
    }
    const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;
    if (!scene) return null;
    if (sel.type === "animated") return scene.objects.find(o => o.id === sel.id) ?? null;
    return scene.svgObjects?.find(o => o.id === sel.id) ?? null;
  }, [editorState.selected, sceneVer]);

  const activeScene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;

  // Render Camera Keyframe info if selected
  const activeKf = useMemo(() => {
    if (selectedKfTime === null || !activeScene) return null;
    return activeScene.cameraKeyframes.find(k => Math.abs(k.time - selectedKfTime) < 0.05) ?? null;
  }, [selectedKfTime, activeScene, sceneVer]);

  // Object Type Guard helpers
  const isSvg = (obj: any): obj is SvgPathObject =>
    obj && "pathData" in obj;

  const isAnimated = (obj: any): obj is AnimatedObject =>
    obj && !isSvg(obj) && "type" in obj;

  // Find all paths in the same SVG group
  const groupObjects = useMemo(() => {
    if (!activeScene || !selectedObj || !isSvg(selectedObj) || !selectedObj.groupId) return [];
    return (activeScene.svgObjects ?? []).filter(o => o.groupId === selectedObj.groupId);
  }, [activeScene, selectedObj, sceneVer]);

  const groupDuration = useMemo(() => {
    if (groupObjects.length === 0) return 0;
    let minStart = Infinity;
    let maxEnd = -Infinity;
    groupObjects.forEach(o => {
      minStart = Math.min(minStart, o.startTime);
      maxEnd = Math.max(maxEnd, o.startTime + o.duration);
    });
    return Math.max(0.1, maxEnd - minStart);
  }, [groupObjects]);

  const handleGroupDurationUpdate = useCallback((gId: string, newDur: number) => {
    if (!activeScene || !gId) return;
    const items = (activeScene.svgObjects ?? []).filter(o => o.groupId === gId);
    if (items.length === 0) return;

    let minStart = Infinity;
    let maxEnd = -Infinity;
    items.forEach(o => {
      minStart = Math.min(minStart, o.startTime);
      maxEnd = Math.max(maxEnd, o.startTime + o.duration);
    });

    const oldDur = maxEnd - minStart;
    const scaleFactor = oldDur > 0 ? newDur / oldDur : 1;

    items.forEach(item => {
      const localStartOffset = item.startTime - minStart;
      const nextItemStart = minStart + localStartOffset * scaleFactor;
      const nextItemDur = item.duration * scaleFactor;

      const nextStartClamped = Math.max(0, nextItemStart);
      const nextDurClamped = Math.max(0.1, nextItemDur);

      item.startTime = nextStartClamped;
      item.duration = nextDurClamped;

      sceneStore.updateSvgObject(activeScene.id, item.id, { startTime: nextStartClamped, duration: nextDurClamped });
    });

    // Auto-extend scene if group clip goes past end
    const clipEnd = minStart + newDur;
    if (clipEnd > activeScene.duration) {
      sceneStore.extendSceneDuration(activeScene.id, Math.round((clipEnd + 0.5) * 10) / 10);
    }
  }, [activeScene]);

  if (!selectedObj && !activeKf) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 36, color: COLORS.muted, height: "100%", boxSizing: "border-box", textAlign: "center" }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 44, height: 44, color: "rgba(99, 102, 241, 0.2)", marginBottom: 12 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: "600", color: COLORS.text, letterSpacing: "0.02em", fontFamily: "sans-serif" }}>
          No Selection
        </span>
        <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.5, marginTop: 4, maxWidth: 180, fontFamily: "sans-serif" }}>
          Select an canvas object or timeline keyframe to inspect its properties.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        fontFamily: "monospace",
        overflowY: "auto",
        height: "100%",
        boxSizing: "border-box",
      }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* ── Camera Keyframe Sidebar ── */}
      {activeKf && activeScene && (
        <CollapsibleSection
          title={`Camera Keyframe @ ${activeKf.time.toFixed(2)}s`}
          icon={<Icons.Camera />}
          isOpen={collapsedSections.camera}
          onToggle={() => toggleSection("camera")}
        >
          <PropRow label="Cam X">
            <StyledNumInput
              value={Math.round(activeKf.x)}
              onChange={v => {
                sceneStore.updateCameraKeyframe(activeScene.id, activeKf.time, { x: v });
              }}
            />
          </PropRow>

          <PropRow label="Cam Y">
            <StyledNumInput
              value={Math.round(activeKf.y)}
              onChange={v => {
                sceneStore.updateCameraKeyframe(activeScene.id, activeKf.time, { y: v });
              }}
            />
          </PropRow>

          <PropRow label="Zoom">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="range"
                min="0.2"
                max="4"
                step="0.05"
                value={activeKf.zoom}
                onChange={e => {
                  sceneStore.updateCameraKeyframe(activeScene.id, activeKf.time, { zoom: parseFloat(e.target.value) });
                }}
                style={{ width: 60, cursor: "pointer", accentColor: COLORS.yellow }}
              />
              <StyledNumInput
                value={activeKf.zoom}
                step={0.05}
                onChange={v => {
                  sceneStore.updateCameraKeyframe(activeScene.id, activeKf.time, { zoom: Math.max(0.1, v) });
                }}
              />
            </div>
          </PropRow>

          <PropRow label="Easing">
            <select
              value={activeKf.easing}
              onChange={e => {
                sceneStore.updateCameraKeyframe(activeScene.id, activeKf.time, { easing: e.target.value as any });
              }}
              style={{ ...selectStyle, border: `1px solid ${COLORS.border}` }}
            >
              {["linear", "easeIn", "easeOut", "easeInOut", "spring"].map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </PropRow>

          <button
            onClick={() => {
              sceneStore.removeCameraKeyframe(activeScene.id, activeKf.time);
              setSelectedKfTime(null);
            }}
            style={{
              width: "100%",
              padding: "8px 0",
              borderRadius: 6,
              fontSize: 10,
              cursor: "pointer",
              border: "none",
              background: "rgba(239,68,68,0.1)",
              color: COLORS.red,
              borderTop: `1px solid rgba(239,68,68,0.25)`,
              marginTop: 4,
              fontFamily: "monospace",
              fontWeight: "bold",
              transition: "background 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
          >
            <Icons.Trash /> Delete Camera Keyframe
          </button>
        </CollapsibleSection>
      )}

      {/* ── Audio Inspector Section ── */}
      {selectedObj && editorState.selected?.type === "audio" && (() => {
        const track = selectedObj as AudioTrack;
        return (
          <>
            {/* Header Summary */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "rgba(129, 138, 248, 0.04)", padding: "10px 12px", borderRadius: 8, border: `1px solid rgba(129, 138, 248, 0.3)` }}>
              <div style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold" }}>
                Active Selection
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "#818cf8", fontSize: 11, fontWeight: "bold", wordBreak: "break-all", maxWidth: "65%" }}>
                  {track.name}
                </span>
                <span
                  style={{
                    background: "rgba(129, 138, 248, 0.12)",
                    color: "#818cf8",
                    border: `1px solid rgba(129, 138, 248, 0.25)`,
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontSize: 8,
                    textTransform: "uppercase",
                    fontWeight: "bold",
                    fontFamily: "sans-serif",
                  }}
                >
                  Audio Track
                </span>
              </div>
            </div>

            {/* Audio Settings Section */}
            <CollapsibleSection
              title="Playback Properties"
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              }
              isOpen={true}
              onToggle={() => {}}
            >
              {/* Volume Slider */}
              <PropRow label="Volume">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={track.volume ?? 1}
                    onChange={e => sceneStore.updateAudioTrack(track.id, { volume: parseFloat(e.target.value) })}
                    style={{ flex: 1, accentColor: "#818cf8", cursor: "pointer", height: 4, borderRadius: 2 }}
                  />
                  <span style={{ fontSize: 10, color: COLORS.text, fontFamily: "monospace", minWidth: 28, textAlign: "right" }}>
                    {Math.round((track.volume ?? 1) * 100)}%
                  </span>
                </div>
              </PropRow>

              {/* Mute Toggle */}
              <PropRow label="Mute">
                <button
                  onClick={() => sceneStore.updateAudioTrack(track.id, { isMuted: !track.isMuted })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: "bold",
                    border: "none",
                    background: track.isMuted ? COLORS.red : COLORS.dimmer,
                    color: track.isMuted ? "#fff" : COLORS.muted,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {track.isMuted ? "🔇 Muted" : "🔊 Active"}
                </button>
              </PropRow>

              {/* Start Time Numeric Offset */}
              <PropRow label="Start Time">
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={parseFloat(track.startTime.toFixed(2))}
                    onChange={e => sceneStore.updateAudioTrack(track.id, { startTime: Math.max(0, parseFloat(e.target.value) || 0) })}
                    style={{
                      flex: 1,
                      background: COLORS.dimmer,
                      color: COLORS.text,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 10,
                      outline: "none",
                      fontFamily: "monospace",
                    }}
                  />
                  <span style={{ fontSize: 9, color: COLORS.muted }}>secs</span>
                </div>
              </PropRow>

              {/* Duration Offset */}
              <PropRow label="Duration">
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <input
                    type="number"
                    step={0.1}
                    min={0.1}
                    value={parseFloat(track.duration.toFixed(2))}
                    onChange={e => sceneStore.updateAudioTrack(track.id, { duration: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                    style={{
                      flex: 1,
                      background: COLORS.dimmer,
                      color: COLORS.text,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 10,
                      outline: "none",
                      fontFamily: "monospace",
                    }}
                  />
                  <span style={{ fontSize: 9, color: COLORS.muted }}>secs</span>
                </div>
              </PropRow>
            </CollapsibleSection>

            {/* Remove / Delete Button */}
            <div style={{ height: 1, background: COLORS.border, marginTop: 12 }} />
            <button
              onClick={() => {
                sceneStore.removeAudioTrack(track.id);
                editorStore.deselect();
              }}
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 8,
                fontSize: 11,
                cursor: "pointer",
                border: "none",
                background: "rgba(239,68,68,0.1)",
                color: COLORS.red,
                borderTop: `1px solid rgba(239,68,68,0.25)`,
                borderBottom: `1px solid rgba(239,68,68,0.1)`,
                fontFamily: "sans-serif",
                fontWeight: "bold",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 12,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(239,68,68,0.2)";
                e.currentTarget.style.boxShadow = "0 0 8px rgba(239, 68, 68, 0.2)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <span>Delete Audio Track</span>
            </button>
          </>
        );
      })()}

      {/* ── Object Inspector Section ── */}
      {selectedObj && editorState.selected?.type !== "audio" && activeScene && (
        <>
          {/* Header Summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "rgba(255, 255, 255, 0.02)", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "bold" }}>
              Active Selection
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: COLORS.accent, fontSize: 11, fontWeight: "bold", wordBreak: "break-all", maxWidth: "65%" }}>
                {selectedObj.id}
              </span>
              <span
                style={{
                  background: COLORS.accentDim,
                  color: COLORS.accent,
                  border: `1px solid ${COLORS.border}`,
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontSize: 8,
                  textTransform: "uppercase",
                  fontWeight: "bold",
                  fontFamily: "sans-serif",
                }}
              >
                {isAnimated(selectedObj) ? selectedObj.type : "svg path"}
              </span>
            </div>
          </div>

          {/* Position Parameters Section */}
          <CollapsibleSection
            title="Position & Layout"
            icon={<Icons.Position />}
            isOpen={collapsedSections.transform}
            onToggle={() => toggleSection("transform")}
          >
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <div style={{ flex: 1 }}>
                <PropRow label="X Coordinate">
                  <StyledNumInput
                    value={Math.round(selectedObj.x)}
                    onChange={v => {
                      if (isAnimated(selectedObj)) {
                        sceneStore.updateObject(activeScene.id, selectedObj.id, { x: v });
                      } else if (isSvg(selectedObj)) {
                        sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { x: v });
                      }
                    }}
                  />
                </PropRow>
              </div>
              <div style={{ flex: 1 }}>
                <PropRow label="Y Coordinate">
                  <StyledNumInput
                    value={Math.round(selectedObj.y)}
                    onChange={v => {
                      if (isAnimated(selectedObj)) {
                        sceneStore.updateObject(activeScene.id, selectedObj.id, { y: v });
                      } else if (isSvg(selectedObj)) {
                        sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { y: v });
                      }
                    }}
                  />
                </PropRow>
              </div>
            </div>
          </CollapsibleSection>

          {/* ── Object Specific Dimensions Section ── */}
          {((isAnimated(selectedObj) && (selectedObj.type === "rect" || selectedObj.type === "circle")) || isSvg(selectedObj)) && (
            <CollapsibleSection
              title="Size & Scale"
              icon={<Icons.Dimension />}
              isOpen={collapsedSections.dimensions}
              onToggle={() => toggleSection("dimensions")}
            >
              {isAnimated(selectedObj) && selectedObj.type === "rect" && (
                <>
                  <PropRow label="Width">
                    <StyledNumInput
                      value={selectedObj.width ?? 100}
                      min={5}
                      onChange={v => {
                        sceneStore.updateObject(activeScene.id, selectedObj.id, { width: v });
                      }}
                    />
                  </PropRow>
                  <PropRow label="Height">
                    <StyledNumInput
                      value={selectedObj.height ?? 60}
                      min={5}
                      onChange={v => {
                        sceneStore.updateObject(activeScene.id, selectedObj.id, { height: v });
                      }}
                    />
                  </PropRow>
                </>
              )}

              {isAnimated(selectedObj) && selectedObj.type === "circle" && (
                <PropRow label="Radius">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="range"
                      min="5"
                      max="300"
                      value={selectedObj.radius ?? 40}
                      onChange={e => {
                        sceneStore.updateObject(activeScene.id, selectedObj.id, { radius: parseInt(e.target.value) });
                      }}
                      style={{ width: 60, cursor: "pointer", accentColor: COLORS.accent }}
                    />
                    <StyledNumInput
                      value={selectedObj.radius ?? 40}
                      min={5}
                      onChange={v => {
                        sceneStore.updateObject(activeScene.id, selectedObj.id, { radius: v });
                      }}
                    />
                  </div>
                </PropRow>
              )}

              {isSvg(selectedObj) && (
                <>
                  <PropRow label="Scale X">
                    <StyledNumInput
                      value={selectedObj.scaleX ?? 1}
                      step={0.1}
                      min={0.1}
                      onChange={v => {
                        sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { scaleX: v });
                      }}
                    />
                  </PropRow>
                  <PropRow label="Scale Y">
                    <StyledNumInput
                      value={selectedObj.scaleY ?? 1}
                      step={0.1}
                      min={0.1}
                      onChange={v => {
                        sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { scaleY: v });
                      }}
                    />
                  </PropRow>
                </>
              )}
            </CollapsibleSection>
          )}

          {/* ── Text Editing Controls Section ── */}
          {isAnimated(selectedObj) && selectedObj.type === "text" && (
            <CollapsibleSection
              title="Text & Typography"
              icon={<Icons.Text />}
              isOpen={collapsedSections.typography}
              onToggle={() => toggleSection("typography")}
            >
              <PropRow label="Text Content">
                <span />
              </PropRow>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -6 }}>
                <TextEditor
                  objectId={selectedObj.id}
                  initialValue={selectedObj.content ?? ""}
                  revision={sceneVer}
                  onChange={val => {
                    selectedObj.content = val;
                  }}
                  onCommit={val => {
                    sceneStore.updateObject(activeScene.id, selectedObj.id, { content: val });
                  }}
                />
              </div>

              {/* Bold / Italic / Alignment row */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, width: "100%", justifyContent: "flex-end" }}>
                {/* Bold */}
                <button
                  onClick={() => {
                    const next = selectedObj.fontWeight === "bold" ? "normal" : "bold";
                    sceneStore.updateObject(activeScene.id, selectedObj.id, { fontWeight: next });
                  }}
                  title="Bold"
                  style={{
                    width: 30, height: 30, borderRadius: 6, border: "none", cursor: "pointer",
                    fontWeight: "bold", fontSize: 13, fontFamily: "sans-serif",
                    background: selectedObj.fontWeight === "bold" ? COLORS.accent : COLORS.dimmer,
                    color: selectedObj.fontWeight === "bold" ? "#fff" : COLORS.muted,
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}
                >
                  B
                </button>

                {/* Italic */}
                <button
                  onClick={() => {
                    const next = selectedObj.fontStyle === "italic" ? "normal" : "italic";
                    sceneStore.updateObject(activeScene.id, selectedObj.id, { fontStyle: next });
                  }}
                  title="Italic"
                  style={{
                    width: 30, height: 30, borderRadius: 6, border: "none", cursor: "pointer",
                    fontStyle: "italic", fontSize: 13, fontFamily: "serif",
                    background: selectedObj.fontStyle === "italic" ? COLORS.accent : COLORS.dimmer,
                    color: selectedObj.fontStyle === "italic" ? "#fff" : COLORS.muted,
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}
                >
                  I
                </button>

                <div style={{ width: 1, height: 20, background: COLORS.border }} />

                {/* Alignment buttons */}
                <button
                  onClick={() => sceneStore.updateObject(activeScene.id, selectedObj.id, { textAlign: "left" })}
                  title="Align Left"
                  style={{
                    width: 30, height: 30, borderRadius: 6, border: "none", cursor: "pointer",
                    background: (selectedObj.textAlign ?? "left") === "left" ? COLORS.accent : COLORS.dimmer,
                    color: (selectedObj.textAlign ?? "left") === "left" ? "#fff" : COLORS.muted,
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Icons.AlignLeft />
                </button>
                <button
                  onClick={() => sceneStore.updateObject(activeScene.id, selectedObj.id, { textAlign: "center" })}
                  title="Align Center"
                  style={{
                    width: 30, height: 30, borderRadius: 6, border: "none", cursor: "pointer",
                    background: (selectedObj.textAlign ?? "left") === "center" ? COLORS.accent : COLORS.dimmer,
                    color: (selectedObj.textAlign ?? "left") === "center" ? "#fff" : COLORS.muted,
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Icons.AlignCenter />
                </button>
                <button
                  onClick={() => sceneStore.updateObject(activeScene.id, selectedObj.id, { textAlign: "right" })}
                  title="Align Right"
                  style={{
                    width: 30, height: 30, borderRadius: 6, border: "none", cursor: "pointer",
                    background: (selectedObj.textAlign ?? "left") === "right" ? COLORS.accent : COLORS.dimmer,
                    color: (selectedObj.textAlign ?? "left") === "right" ? "#fff" : COLORS.muted,
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Icons.AlignRight />
                </button>
              </div>

              <PropRow label="Font Family">
                <select
                  value={selectedObj.fontFamily ?? "Georgia, serif"}
                  onChange={e => {
                    sceneStore.updateObject(activeScene.id, selectedObj.id, { fontFamily: e.target.value });
                  }}
                  style={{ ...selectStyle, fontFamily: selectedObj.fontFamily }}
                >
                  {GOOGLE_FONTS.map(f => (
                    <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>{f.name}</option>
                  ))}
                </select>
              </PropRow>

              <PropRow label="Font Size">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="range"
                    min="8"
                    max="600"
                    value={selectedObj.fontSize ?? 16}
                    onChange={e => {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, { fontSize: parseInt(e.target.value) });
                    }}
                    style={{ width: 60, cursor: "pointer", accentColor: COLORS.accent }}
                  />
                  <StyledNumInput
                    value={selectedObj.fontSize ?? 16}
                    min={6}
                    max={600}
                    onChange={v => {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, { fontSize: v });
                    }}
                  />
                </div>
              </PropRow>

              <PropRow label="Wrap Width">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="range"
                    min="60"
                    max="1600"
                    step="10"
                    value={selectedObj.textWrapWidth ?? 360}
                    onChange={e => {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, {
                        textWrapWidth: parseInt(e.target.value),
                      });
                    }}
                    style={{ width: 60, cursor: "pointer", accentColor: COLORS.accent }}
                  />
                  <StyledNumInput
                    value={selectedObj.textWrapWidth ?? 360}
                    min={0}
                    step={10}
                    onChange={v => {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, {
                        textWrapWidth: Math.max(0, v),
                      });
                    }}
                  />
                  <button
                    onClick={() => {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, { textWrapWidth: 0 });
                    }}
                    title="Disable wrapping"
                    style={{
                      background: COLORS.dimmer,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 4,
                      color: COLORS.muted,
                      fontSize: 8,
                      padding: "4px 6px",
                      cursor: "pointer",
                      fontFamily: "monospace",
                    }}
                  >
                    none
                  </button>
                </div>
              </PropRow>
            </CollapsibleSection>
          )}

          {/* ── Colors & Stroke Panel Section ── */}
          {("fillColor" in selectedObj || "strokeColor" in selectedObj) && (
            <CollapsibleSection
              title="Styling & Colors"
              icon={<Icons.Color />}
              isOpen={collapsedSections.styling}
              onToggle={() => toggleSection("styling")}
            >
              {/* Fill Color */}
              {("fillColor" in selectedObj) && (
                <PropRow label="Fill Color">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="color"
                      value={
                        selectedObj.fillColor?.startsWith("#")
                          ? selectedObj.fillColor
                          : selectedObj.fillColor === "transparent" || !selectedObj.fillColor
                          ? "#000000"
                          : selectedObj.fillColor
                      }
                      disabled={selectedObj.fillColor === "transparent"}
                      onChange={e => {
                        const val = e.target.value;
                        if (isAnimated(selectedObj)) {
                          sceneStore.updateObject(activeScene.id, selectedObj.id, { fillColor: val });
                        } else if (isSvg(selectedObj)) {
                          sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { fillColor: val });
                        }
                      }}
                      style={{ width: 36, height: 24, borderRadius: 4, border: "none", cursor: "pointer", background: "none" }}
                    />
                    <select
                      value={selectedObj.fillColor === "transparent" || !selectedObj.fillColor ? "none" : "color"}
                      onChange={e => {
                        const isNone = e.target.value === "none";
                        const val = isNone ? "transparent" : "#6366f1";
                        if (isAnimated(selectedObj)) {
                          sceneStore.updateObject(activeScene.id, selectedObj.id, { fillColor: val });
                        } else if (isSvg(selectedObj)) {
                          sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { fillColor: val });
                        }
                      }}
                      style={{ ...selectStyle, width: 68 }}
                    >
                      <option value="color">Solid</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </PropRow>
              )}

              {/* Stroke Color */}
              {("strokeColor" in selectedObj) && selectedObj.strokeColor && (
                <PropRow label="Stroke Color">
                  <input
                    type="color"
                    value={selectedObj.strokeColor.startsWith("#") ? selectedObj.strokeColor : "#6366f1"}
                    onChange={e => {
                      const val = e.target.value;
                      if (isAnimated(selectedObj)) {
                        sceneStore.updateObject(activeScene.id, selectedObj.id, { strokeColor: val });
                      } else if (isSvg(selectedObj)) {
                        sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { strokeColor: val });
                      }
                    }}
                    style={{ width: 36, height: 24, borderRadius: 4, border: "none", cursor: "pointer", background: "none" }}
                  />
                </PropRow>
              )}

              {/* Stroke / Line Width */}
              {("strokeWidth" in selectedObj || "lineWidth" in selectedObj) && (
                <PropRow label="Stroke Width">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="0.5"
                      value={isAnimated(selectedObj) ? (selectedObj.lineWidth ?? 2) : (selectedObj.strokeWidth ?? 2)}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        if (isAnimated(selectedObj)) {
                          sceneStore.updateObject(activeScene.id, selectedObj.id, { lineWidth: v });
                        } else if (isSvg(selectedObj)) {
                          sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { strokeWidth: v });
                        }
                      }}
                      style={{ width: 60, cursor: "pointer", accentColor: COLORS.accent }}
                    />
                    <StyledNumInput
                      value={isAnimated(selectedObj) ? (selectedObj.lineWidth ?? 2) : (selectedObj.strokeWidth ?? 2)}
                      step={0.5}
                      min={0}
                      onChange={v => {
                        if (isAnimated(selectedObj)) {
                          sceneStore.updateObject(activeScene.id, selectedObj.id, { lineWidth: v });
                        } else if (isSvg(selectedObj)) {
                          sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { strokeWidth: v });
                        }
                      }}
                    />
                  </div>
                </PropRow>
              )}
            </CollapsibleSection>
          )}

          {/* ── Timeline Timing (Starts & Durations) Section ── */}
          <CollapsibleSection
            title="Timing & Timeline"
            icon={<Icons.Timing />}
            isOpen={collapsedSections.timeline}
            onToggle={() => toggleSection("timeline")}
          >
            <PropRow label="Start Time">
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => {
                    const curr = selectedObj.startTime;
                    const nextVal = Math.max(0, Math.round((curr - 0.2) * 10) / 10);
                    if (isAnimated(selectedObj)) {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, { startTime: nextVal });
                    } else if (isSvg(selectedObj)) {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { startTime: nextVal });
                    }
                  }}
                  style={{
                    background: COLORS.dimmer,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 4,
                    color: COLORS.text,
                    fontSize: 8,
                    padding: "4px 6px",
                    cursor: "pointer",
                  }}
                >
                  -0.2s
                </button>
                <StyledNumInput
                  value={selectedObj.startTime}
                  step={0.1}
                  min={0}
                  onChange={v => {
                    if (isAnimated(selectedObj)) {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, { startTime: Math.max(0, v) });
                    } else if (isSvg(selectedObj)) {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { startTime: Math.max(0, v) });
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const curr = selectedObj.startTime;
                    const nextVal = Math.round((curr + 0.2) * 10) / 10;
                    if (isAnimated(selectedObj)) {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, { startTime: nextVal });
                    } else if (isSvg(selectedObj)) {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { startTime: nextVal });
                    }
                  }}
                  style={{
                    background: COLORS.dimmer,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 4,
                    color: COLORS.text,
                    fontSize: 8,
                    padding: "4px 6px",
                    cursor: "pointer",
                  }}
                >
                  +0.2s
                </button>
              </div>
            </PropRow>

            <PropRow label="Duration">
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => {
                    const curr = selectedObj.duration;
                    const nextVal = Math.max(0.1, Math.round((curr - 0.2) * 10) / 10);
                    if (isAnimated(selectedObj)) {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, { duration: nextVal });
                    } else if (isSvg(selectedObj)) {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { duration: nextVal });
                    }
                  }}
                  style={{
                    background: COLORS.dimmer,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 4,
                    color: COLORS.text,
                    fontSize: 8,
                    padding: "4px 6px",
                    cursor: "pointer",
                  }}
                >
                  -0.2s
                </button>
                <StyledNumInput
                  value={selectedObj.duration}
                  step={0.1}
                  min={0.1}
                  onChange={v => {
                    const nextV = Math.max(0.1, v);
                    if (isAnimated(selectedObj)) {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, { duration: nextV });
                    } else if (isSvg(selectedObj)) {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { duration: nextV });
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const curr = selectedObj.duration;
                    const nextVal = Math.round((curr + 0.2) * 10) / 10;
                    if (isAnimated(selectedObj)) {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, { duration: nextVal });
                    } else if (isSvg(selectedObj)) {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { duration: nextVal });
                    }
                  }}
                  style={{
                    background: COLORS.dimmer,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 4,
                    color: COLORS.text,
                    fontSize: 8,
                    padding: "4px 6px",
                    cursor: "pointer",
                  }}
                >
                  +0.2s
                </button>
              </div>
            </PropRow>

            {/* ── Group Duration Control ── */}
            {groupObjects.length > 0 && selectedObj && "groupId" in selectedObj && selectedObj.groupId && (
              <PropRow label="Group Duration">
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    onClick={() => {
                      const nextVal = Math.max(0.1, Math.round((groupDuration - 0.2) * 10) / 10);
                      handleGroupDurationUpdate(selectedObj.groupId!, nextVal);
                    }}
                    style={{
                      background: COLORS.dimmer,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 4,
                      color: COLORS.text,
                      fontSize: 8,
                      padding: "4px 6px",
                      cursor: "pointer",
                    }}
                  >
                    -0.2s
                  </button>
                  <StyledNumInput
                    value={parseFloat(groupDuration.toFixed(2))}
                    step={0.1}
                    min={0.1}
                    onChange={v => {
                      const nextV = Math.max(0.1, v);
                      handleGroupDurationUpdate(selectedObj.groupId!, nextV);
                    }}
                  />
                  <button
                    onClick={() => {
                      const nextVal = Math.round((groupDuration + 0.2) * 10) / 10;
                      handleGroupDurationUpdate(selectedObj.groupId!, nextVal);
                    }}
                    style={{
                      background: COLORS.dimmer,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 4,
                      color: COLORS.text,
                      fontSize: 8,
                      padding: "4px 6px",
                      cursor: "pointer",
                    }}
                  >
                    +0.2s
                  </button>
                </div>
              </PropRow>
            )}
          </CollapsibleSection>

          {/* ── Entry Animation Section ── */}
          {isAnimated(selectedObj) && (
            <CollapsibleSection
              title="Entry Transition"
              icon={<Icons.Entry />}
              isOpen={collapsedSections.entry}
              onToggle={() => toggleSection("entry")}
            >
              <PropRow label="Style">
                <select
                  value={selectedObj.animationType ?? "fade"}
                  onChange={e => {
                    sceneStore.updateObject(activeScene.id, selectedObj.id, {
                      animationType: e.target.value as any,
                    });
                  }}
                  style={selectStyle}
                >
                  <option value="fade">Fade In</option>
                  <option value="scale">Scale In</option>
                  <option value="draw">Draw (Hand)</option>
                  <option value="slideLeft">Slide Left ←</option>
                  <option value="slideRight">Slide Right →</option>
                  <option value="slideUp">Slide Up ↑</option>
                  <option value="slideDown">Slide Down ↓</option>
                  <option value="static">None (Static)</option>
                </select>
              </PropRow>

              <PropRow label="Easing">
                <select
                  value={selectedObj.easing ?? "easeOut"}
                  onChange={e => {
                    sceneStore.updateObject(activeScene.id, selectedObj.id, { easing: e.target.value as any });
                  }}
                  style={selectStyle}
                >
                  {["linear", "easeIn", "easeOut", "easeInOut", "spring"].map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </PropRow>
            </CollapsibleSection>
          )}

          {/* ── VideoScribe Draw Animation Controls (SVG only) Section ── */}
          {isSvg(selectedObj) && (
            <CollapsibleSection
              title="Draw Animation"
              icon={<Icons.Draw />}
              isOpen={collapsedSections.scribe}
              onToggle={() => toggleSection("scribe")}
            >
              {/* Start Delay */}
              <PropRow label="Start Delay">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StyledNumInput
                    value={selectedObj.startDelay ?? 0}
                    step={0.05}
                    min={0}
                    onChange={v => {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { startDelay: Math.max(0, v) });
                    }}
                  />
                  <span style={{ fontSize: 9, color: COLORS.muted }}>seconds</span>
                </div>
              </PropRow>

              {/* Draw Order */}
              <PropRow label="Draw Order">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StyledNumInput
                    value={selectedObj.drawOrder ?? 0}
                    step={1}
                    min={0}
                    onChange={v => {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { drawOrder: Math.max(0, Math.round(v)) });
                    }}
                  />
                  <span style={{ fontSize: 9, color: COLORS.muted }}>lower=first</span>
                </div>
              </PropRow>

              {/* Hand Visible Toggle */}
              <PropRow label="Show Hand">
                <button
                  id="svg-hand-visible-toggle"
                  onClick={() => {
                    const curr = selectedObj.handVisible !== false;
                    sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { handVisible: !curr });
                  }}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 10,
                    fontFamily: "monospace",
                    border: `1px solid ${selectedObj.handVisible !== false ? COLORS.accent : COLORS.border}`,
                    background: selectedObj.handVisible !== false ? COLORS.accentDim : COLORS.dimmer,
                    color: selectedObj.handVisible !== false ? COLORS.accent : COLORS.muted,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {selectedObj.handVisible !== false ? (
                    <>
                      <Icons.Eye />
                      <span>Visible</span>
                    </>
                  ) : (
                    <>
                      <Icons.EyeOff />
                      <span>Hidden</span>
                    </>
                  )}
                </button>
              </PropRow>

              {/* Hand Offset X */}
              <PropRow label="Hand Offset X">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StyledNumInput
                    value={selectedObj.handOffsetX ?? 0}
                    step={1}
                    onChange={v => {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { handOffsetX: v });
                    }}
                  />
                  <span style={{ fontSize: 9, color: COLORS.muted }}>px</span>
                </div>
              </PropRow>

              {/* Hand Offset Y */}
              <PropRow label="Hand Offset Y">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StyledNumInput
                    value={selectedObj.handOffsetY ?? 0}
                    step={1}
                    onChange={v => {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { handOffsetY: v });
                    }}
                  />
                  <span style={{ fontSize: 9, color: COLORS.muted }}>px</span>
                </div>
              </PropRow>

              {/* Opacity */}
              <PropRow label="Opacity">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selectedObj.opacity ?? 1}
                    onChange={e => {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { opacity: parseFloat(e.target.value) });
                    }}
                    style={{ width: 60, cursor: "pointer", accentColor: "#a78bfa" }}
                  />
                  <span style={{ fontSize: 10, color: COLORS.text, minWidth: 30 }}>
                    {Math.round((selectedObj.opacity ?? 1) * 100)}%
                  </span>
                </div>
              </PropRow>

              {/* Rotation */}
              <PropRow label="Rotation">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="range"
                    min={-Math.PI}
                    max={Math.PI}
                    step="0.05"
                    value={selectedObj.rotation ?? 0}
                    onChange={e => {
                      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, { rotation: parseFloat(e.target.value) });
                    }}
                    style={{ width: 60, cursor: "pointer", accentColor: "#a78bfa" }}
                  />
                  <span style={{ fontSize: 10, color: COLORS.text, minWidth: 36 }}>
                    {Math.round((selectedObj.rotation ?? 0) * (180 / Math.PI))}°
                  </span>
                </div>
              </PropRow>

              {/* Sub-paths info badge */}
              {selectedObj.subPaths && selectedObj.subPaths.length > 1 && (
                <div style={{
                  background: "rgba(167,139,250,0.08)",
                  border: "1px solid rgba(167,139,250,0.22)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontSize: 10,
                  color: "#a78bfa",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <Icons.Draw />
                  <span style={{ fontFamily: "sans-serif", lineHeight: 1.4 }}>Compound path: {selectedObj.subPaths.length} sub-paths — draws sequentially</span>
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* ── Exit Transition Section ── */}
          {isAnimated(selectedObj) && (
            <CollapsibleSection
              title="Exit Transition"
              icon={<Icons.Exit />}
              isOpen={collapsedSections.exit}
              onToggle={() => toggleSection("exit")}
            >
              <PropRow label="Style">
                <select
                  value={selectedObj.exit?.type ?? "none"}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === "none") {
                      sceneStore.updateObject(activeScene.id, selectedObj.id, { exit: undefined });
                    } else {
                      const prevExit = selectedObj.exit;
                      sceneStore.updateObject(activeScene.id, selectedObj.id, {
                        exit: {
                          type: val as any,
                          duration: prevExit?.duration ?? 0.4,
                          easing: prevExit?.easing ?? "easeIn",
                        },
                      });
                    }
                  }}
                  style={selectStyle}
                >
                  <option value="none">None</option>
                  <option value="fade">Fade Out</option>
                  <option value="slideLeft">Slide Left ←</option>
                  <option value="slideRight">Slide Right →</option>
                  <option value="slideUp">Slide Up ↑</option>
                  <option value="slideDown">Slide Down ↓</option>
                </select>
              </PropRow>

              {selectedObj.exit && selectedObj.exit.type !== "none" && (
                <>
                  <PropRow label="Exit Easing">
                    <select
                      value={selectedObj.exit.easing ?? "easeIn"}
                      onChange={e => {
                        sceneStore.updateObject(activeScene.id, selectedObj.id, {
                          exit: {
                            ...selectedObj.exit!,
                            easing: e.target.value as any,
                          },
                        });
                      }}
                      style={selectStyle}
                    >
                      {["linear", "easeIn", "easeOut", "easeInOut", "spring"].map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </PropRow>

                  <PropRow label="Exit Duration">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="range"
                        min="0.1"
                        max={selectedObj.duration * 0.8}
                        step="0.05"
                        value={selectedObj.exit.duration ?? 0.4}
                        onChange={e => {
                          sceneStore.updateObject(activeScene.id, selectedObj.id, {
                            exit: {
                              ...selectedObj.exit!,
                              duration: parseFloat(e.target.value),
                            },
                          });
                        }}
                        style={{ width: 60, cursor: "pointer", accentColor: COLORS.accent }}
                      />
                      <StyledNumInput
                        value={selectedObj.exit.duration ?? 0.4}
                        step={0.05}
                        min={0.05}
                        max={selectedObj.duration * 0.9}
                        onChange={v => {
                          sceneStore.updateObject(activeScene.id, selectedObj.id, {
                            exit: {
                              ...selectedObj.exit!,
                              duration: Math.max(0.05, Math.min(selectedObj.duration * 0.9, v)),
                            },
                          });
                        }}
                      />
                    </div>
                  </PropRow>
                </>
              )}
            </CollapsibleSection>
          )}

          {/* Transform Keyframes Editor Section */}
          <CollapsibleSection
            title="Motion Path & Keyframes"
            icon={<Icons.Transform />}
            isOpen={collapsedSections.transformKf}
            onToggle={() => toggleSection("transformKf")}
          >
            <TransformKeyframeEditor
              selectedObj={selectedObj}
              activeScene={activeScene}
              localTime={sceneStore.getLocalTime()}
            />
          </CollapsibleSection>

          {/* Duplicate & Delete Action buttons */}
          <div style={{ height: 1, background: COLORS.border, marginTop: 4 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              onClick={() => {
                const newId = `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                if (isAnimated(selectedObj)) {
                  const copy: AnimatedObject = JSON.parse(JSON.stringify(selectedObj));
                  copy.id = newId;
                  copy.x += 20;
                  copy.y += 20;
                  sceneStore.addObject(activeScene.id, copy);
                  editorStore.select(newId, "animated");
                } else if (isSvg(selectedObj)) {
                  const copy: SvgPathObject = JSON.parse(JSON.stringify(selectedObj));
                  copy.id = newId;
                  copy.x += 20;
                  copy.y += 20;
                  sceneStore.addSvgObject(activeScene.id, copy);
                  editorStore.select(newId, "svg");
                }
              }}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                fontSize: 11,
                cursor: "pointer",
                border: "none",
                background: COLORS.accentDim,
                color: COLORS.accent,
                borderTop: `1px solid rgba(99, 102, 241, 0.25)`,
                borderBottom: `1px solid rgba(99, 102, 241, 0.1)`,
                fontFamily: "sans-serif",
                fontWeight: "bold",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(99, 102, 241, 0.2)";
                e.currentTarget.style.boxShadow = "0 0 8px rgba(99, 102, 241, 0.2)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = COLORS.accentDim;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <Icons.Duplicate />
              <span>Duplicate</span>
            </button>
            <button
              onClick={() => {
                sceneStore.removeObject(activeScene.id, selectedObj.id);
                editorStore.deselect();
              }}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                fontSize: 11,
                cursor: "pointer",
                border: "none",
                background: "rgba(239,68,68,0.1)",
                color: COLORS.red,
                borderTop: `1px solid rgba(239,68,68,0.25)`,
                borderBottom: `1px solid rgba(239,68,68,0.1)`,
                fontFamily: "sans-serif",
                fontWeight: "bold",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(239,68,68,0.2)";
                e.currentTarget.style.boxShadow = "0 0 8px rgba(239, 68, 68, 0.2)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <Icons.Trash />
              <span>Delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
