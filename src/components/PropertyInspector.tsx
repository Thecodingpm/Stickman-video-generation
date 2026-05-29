import React, { useState, useEffect, useRef, useMemo } from "react";
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
  bg:        "#0c1117",
  surface:   "#141920",
  border:    "rgba(99,102,241,0.18)",
  accent:    "#6366f1",
  accentDim: "rgba(99,102,241,0.12)",
  text:      "#e2e8f0",
  muted:     "#64748b",
  dimmer:    "#1e2530",
  green:     "#10b981",
  yellow:    "#f59e0b",
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

interface PropertyInspectorProps {
  selectedKfTime: number | null;
  setSelectedKfTime: (time: number | null) => void;
}

export function PropertyInspector({ selectedKfTime, setSelectedKfTime }: PropertyInspectorProps) {
  const [editorState, setEditorState] = useState(editorStore.getState());
  const [sceneVer, setSceneVer] = useState(0);

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

  // Compute selected object
  const selectedObj = useMemo(() => {
    const sel = editorState.selected;
    const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;
    if (!sel || !scene) return null;
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

  if (!selectedObj && !activeKf) {
    return (
      <div style={{ padding: 24, color: COLORS.muted, fontSize: 11, textAlign: "center", lineHeight: 1.6, fontFamily: "monospace" }}>
        Select an object or camera keyframe to edit its properties.
      </div>
    );
  }

  // Trigger re-render of canvas by telling store to update with empty patch (or trigger redraw)
  const commitChange = () => {
    if (!activeScene || !selectedObj) return;
    if (isAnimated(selectedObj)) {
      sceneStore.updateObject(activeScene.id, selectedObj.id, {});
    } else if (isSvg(selectedObj)) {
      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, {});
    }
  };

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
        <div style={{ display: "flex", flexDirection: "column", gap: 10, borderBottom: `2px dashed ${COLORS.border}`, paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.yellow }}>
            <span style={{ fontSize: 14 }}>🎥</span>
            <span style={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Camera Keyframe @ {activeKf.time.toFixed(2)}s
            </span>
          </div>

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
              padding: "6px 0",
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
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
          >
            🗑 Delete Camera Keyframe
          </button>
        </div>
      )}

      {/* ── Object Inspector Section ── */}
      {selectedObj && activeScene && (
        <>
          {/* Header Summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Selected Element
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: COLORS.accent, fontSize: 11, fontWeight: "bold", wordBreak: "break-all", maxWidth: "60%" }}>
                {selectedObj.id}
              </span>
              <span
                style={{
                  background: COLORS.accentDim,
                  color: COLORS.accent,
                  border: `1px solid ${COLORS.border}`,
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 8,
                  textTransform: "uppercase",
                  fontWeight: "bold",
                }}
              >
                {isAnimated(selectedObj) ? selectedObj.type : "svg path"}
              </span>
            </div>
          </div>

          <div style={{ height: 1, background: COLORS.border }} />

          {/* Position Parameters */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <PropRow label="X">
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
              <PropRow label="Y">
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

          {/* ── Object Specific Dimensions ── */}
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

          {/* ── Text Editing Controls ── */}
          {isAnimated(selectedObj) && selectedObj.type === "text" && (
            <>
              <div style={{ height: 1, background: COLORS.border }} />

              <PropRow label="Text content">
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
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                {/* Bold */}
                <button
                  onClick={() => {
                    const next = selectedObj.fontWeight === "bold" ? "normal" : "bold";
                    sceneStore.updateObject(activeScene.id, selectedObj.id, { fontWeight: next });
                  }}
                  title="Bold"
                  style={{
                    width: 30, height: 30, borderRadius: 6, border: "none", cursor: "pointer",
                    fontWeight: "bold", fontSize: 14, fontFamily: "serif",
                    background: selectedObj.fontWeight === "bold" ? COLORS.accent : COLORS.dimmer,
                    color: selectedObj.fontWeight === "bold" ? "#fff" : COLORS.muted,
                    transition: "all 0.15s",
                  }}
                >B</button>

                {/* Italic */}
                <button
                  onClick={() => {
                    const next = selectedObj.fontStyle === "italic" ? "normal" : "italic";
                    sceneStore.updateObject(activeScene.id, selectedObj.id, { fontStyle: next });
                  }}
                  title="Italic"
                  style={{
                    width: 30, height: 30, borderRadius: 6, border: "none", cursor: "pointer",
                    fontStyle: "italic", fontSize: 14, fontFamily: "serif",
                    background: selectedObj.fontStyle === "italic" ? COLORS.accent : COLORS.dimmer,
                    color: selectedObj.fontStyle === "italic" ? "#fff" : COLORS.muted,
                    transition: "all 0.15s",
                  }}
                >I</button>

                <div style={{ width: 1, height: 20, background: COLORS.border }} />

                {/* Alignment buttons */}
                {(["left", "center", "right"] as const).map(align => (
                  <button
                    key={align}
                    onClick={() => sceneStore.updateObject(activeScene.id, selectedObj.id, { textAlign: align })}
                    title={`Align ${align}`}
                    style={{
                      width: 30, height: 30, borderRadius: 6, border: "none", cursor: "pointer",
                      fontSize: 13,
                      background: (selectedObj.textAlign ?? "left") === align ? COLORS.accent : COLORS.dimmer,
                      color: (selectedObj.textAlign ?? "left") === align ? "#fff" : COLORS.muted,
                      transition: "all 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {align === "left" ? "⬅" : align === "center" ? "⬛" : "➡"}
                  </button>
                ))}
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
            </>
          )}


          {/* ── Colors & Stroke Panel ── */}
          <div style={{ height: 1, background: COLORS.border }} />

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

          {/* ── Timeline Timing (Starts & Durations) ── */}
          <div style={{ height: 1, background: COLORS.border }} />

          <div style={{ fontSize: 9, color: COLORS.muted, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 2px" }}>
            ⏱ Timeline & Duration
          </div>

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

          {/* ── Entry Animation configuration ── */}
          <div style={{ height: 1, background: COLORS.border }} />

          <div style={{ fontSize: 9, color: COLORS.muted, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 2px" }}>
            🎬 Entry Transition
          </div>

          <PropRow label="Style">
            <select
              value={isAnimated(selectedObj) ? (selectedObj.animationType ?? "fade") : "draw"}
              disabled={isSvg(selectedObj)}
              onChange={e => {
                if (isAnimated(selectedObj)) {
                  sceneStore.updateObject(activeScene.id, selectedObj.id, {
                    animationType: e.target.value as any,
                  });
                }
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
              value={isAnimated(selectedObj) ? (selectedObj.easing ?? "easeOut") : "easeOut"}
              onChange={e => {
                const val = e.target.value;
                if (isAnimated(selectedObj)) {
                  sceneStore.updateObject(activeScene.id, selectedObj.id, { easing: val as any });
                } else if (isSvg(selectedObj)) {
                  // SVGs map to SvgEasing which has easeInOutCubic instead of spring
                  sceneStore.updateSvgObject(activeScene.id, selectedObj.id, {
                    easing: SvgEasing[val as keyof typeof SvgEasing] ?? SvgEasing.easeOut,
                  });
                }
              }}
              style={selectStyle}
            >
              {isAnimated(selectedObj)
                ? ["linear", "easeIn", "easeOut", "easeInOut", "spring"].map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))
                : ["linear", "easeIn", "easeOut", "easeInOut", "easeInOutCubic"].map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
            </select>
          </PropRow>

          {/* ── VideoScribe Draw Animation Controls (SVG only) ── */}
          {isSvg(selectedObj) && (
            <>
              <div style={{ height: 1, background: COLORS.border }} />

              <div style={{ fontSize: 9, color: "#a78bfa", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 2px", display: "flex", alignItems: "center", gap: 6 }}>
                <span>✍</span> Draw Animation
              </div>

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
                  <span style={{ fontSize: 9, color: COLORS.muted }}>s</span>
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
                  }}
                >
                  {selectedObj.handVisible !== false ? "✋ Visible" : "🚫 Hidden"}
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
                  background: "rgba(167,139,250,0.12)",
                  border: "1px solid rgba(167,139,250,0.3)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 10,
                  color: "#a78bfa",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <span>⛓</span>
                  <span>Compound path: {selectedObj.subPaths.length} sub-paths — draws sequentially</span>
                </div>
              )}
            </>
          )}

          {isAnimated(selectedObj) && (
            <>
              <div style={{ height: 1, background: COLORS.border }} />

              <div style={{ fontSize: 9, color: COLORS.muted, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 2px" }}>
                🚪 Exit Transition
              </div>

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
            </>
          )}

          {/* Transform Keyframes Editor */}
          <div style={{ height: 1, background: COLORS.border, marginTop: 4 }} />
          <TransformKeyframeEditor
            selectedObj={selectedObj}
            activeScene={activeScene}
            localTime={sceneStore.getLocalTime()}
          />

          {/* Duplicate & Delete Action buttons */}
          <div style={{ height: 1, background: COLORS.border, marginTop: 4 }} />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
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
                padding: "8px 0",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                border: "none",
                background: COLORS.accentDim,
                color: COLORS.accent,
                borderTop: `1px solid rgba(99, 102, 241, 0.25)`,
                fontFamily: "monospace",
                fontWeight: "bold",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(99, 102, 241, 0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = COLORS.accentDim)}
            >
              👯 Duplicate
            </button>
            <button
              onClick={() => {
                sceneStore.removeObject(activeScene.id, selectedObj.id);
                editorStore.deselect();
              }}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                border: "none",
                background: "rgba(239,68,68,0.1)",
                color: COLORS.red,
                borderTop: `1px solid rgba(239,68,68,0.25)`,
                fontFamily: "monospace",
                fontWeight: "bold",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
            >
              🗑 Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
