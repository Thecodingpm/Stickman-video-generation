import React, { useState } from "react";
import { sceneStore } from "../store/sceneStore";
import type { AnimatedObject } from "../core/timeline";
import type { SvgPathObject } from "../core/svgPath";
import type { TransformKeyframe } from "../core/transformInterpolator";
import { newKfId, getValuesAtTime } from "../core/transformInterpolator";

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

// Custom number input helper matching PropertyInspector styles
function EditorNumInput({
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const [localVal, setLocalVal] = useState(value !== undefined ? String(value) : "");

  React.useEffect(() => {
    setLocalVal(value !== undefined ? String(value) : "");
  }, [value]);

  const handleBlur = () => {
    if (localVal === "") {
      onChange(undefined);
      return;
    }
    let parsed = parseFloat(localVal);
    if (isNaN(parsed)) {
      onChange(undefined);
      return;
    }
    if (min !== undefined) parsed = Math.max(min, parsed);
    if (max !== undefined) parsed = Math.min(max, parsed);
    onChange(parsed);
  };

  return (
    <input
      type="number"
      value={localVal}
      placeholder="—"
      step={step}
      onChange={e => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => e.stopPropagation()}
      style={{
        width: 60,
        padding: "3px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontFamily: "monospace",
        textAlign: "right",
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        color: value !== undefined ? COLORS.text : COLORS.muted,
        outline: "none",
        transition: "border-color 0.15s",
      }}
      onFocus={e => (e.target.style.borderColor = COLORS.accent)}
    />
  );
}

interface TransformKeyframeEditorProps {
  selectedObj: AnimatedObject | SvgPathObject;
  activeScene: { id: string; duration: number };
  localTime: number;
}

export function TransformKeyframeEditor({
  selectedObj,
  activeScene,
  localTime,
}: TransformKeyframeEditorProps) {
  const tracks = selectedObj.transformTracks;
  const kfs = tracks?.keyframes ?? [];

  // Capture current state to add keyframe
  const handleAddKeyframe = () => {
    // Current local time within object
    const t = Math.max(0, Math.min(selectedObj.duration, localTime - selectedObj.startTime));

    // Get interpolated or default values
    const currentValues = getValuesAtTime(tracks, t);

    // Populate missing defaults from the object itself if tracks are empty
    if (kfs.length === 0) {
      if (currentValues.x === undefined) currentValues.x = selectedObj.x;
      if (currentValues.y === undefined) currentValues.y = selectedObj.y;
      
      const sX = ("scaleX" in selectedObj ? selectedObj.scaleX : 1) ?? 1;
      const sY = ("scaleY" in selectedObj ? selectedObj.scaleY : 1) ?? 1;
      if (currentValues.scaleX === undefined) currentValues.scaleX = sX;
      if (currentValues.scaleY === undefined) currentValues.scaleY = sY;

      const rot = ("rotation" in selectedObj ? selectedObj.rotation : 0) ?? 0;
      if (currentValues.rotation === undefined) currentValues.rotation = rot;

      const op = ("opacity" in selectedObj ? selectedObj.opacity : 1) ?? 1;
      if (currentValues.opacity === undefined) currentValues.opacity = op;
    }

    const newKf: TransformKeyframe = {
      id: newKfId(),
      time: Math.round(t * 100) / 100, // round to 2 decimal places (10ms steps)
      x: currentValues.x,
      y: currentValues.y,
      scaleX: currentValues.scaleX,
      scaleY: currentValues.scaleY,
      rotation: currentValues.rotation,
      opacity: currentValues.opacity,
      easing: "easeInOut",
    };

    sceneStore.addObjectKeyframe(activeScene.id, selectedObj.id, newKf);
  };

  const handleRemoveKeyframe = (kfId: string) => {
    sceneStore.removeObjectKeyframe(activeScene.id, selectedObj.id, kfId);
  };

  const handleUpdateKeyframe = (kfId: string, patch: Partial<TransformKeyframe>) => {
    sceneStore.updateObjectKeyframe(activeScene.id, selectedObj.id, kfId, patch);
  };

  const Icons = {
    Transform: () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    Plus: () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    Info: () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    Trash: () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    )
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
      {/* Title Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.green }}>
          <Icons.Transform />
          <span style={{ fontSize: 9, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "sans-serif" }}>
            Transform Keyframes
          </span>
        </div>
        
        <button
          onClick={handleAddKeyframe}
          style={{
            background: COLORS.green,
            color: COLORS.bg,
            border: "none",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: 9,
            fontWeight: "bold",
            cursor: "pointer",
            fontFamily: "sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 4,
            boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <Icons.Plus />
          <span>Add Keyframe</span>
        </button>
      </div>

      {/* Helper text if no keyframes */}
      {kfs.length === 0 && (
        <div style={{ display: "flex", gap: 8, fontSize: 10, color: COLORS.muted, padding: "8px 10px", background: COLORS.bg, border: `1px dashed ${COLORS.border}`, borderRadius: 6, lineHeight: 1.4, fontFamily: "sans-serif" }}>
          <div style={{ color: COLORS.accent, display: "flex", alignItems: "center" }}>
            <Icons.Info />
          </div>
          <span>No keyframes defined yet. The object will remain static. Click "Add Keyframe" to create custom animations (position, scale, rotation, opacity).</span>
        </div>
      )}

      {/* Keyframes list */}
      {kfs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto", paddingRight: 2 }}>
          {kfs.map((kf, idx) => (
            <div
              key={kf.id}
              style={{
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
              }}
            >
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 4, marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 8, background: COLORS.accentDim, color: COLORS.accent, padding: "1px 4px", borderRadius: 3, fontWeight: "bold", fontFamily: "sans-serif" }}>
                    KF #{idx + 1}
                  </span>
                  <span style={{ fontSize: 10, color: COLORS.text, fontWeight: "bold" }}>
                    @ {kf.time.toFixed(2)}s
                  </span>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {/* Local Time Input */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 8, color: COLORS.muted }}>t:</span>
                    <input
                      type="number"
                      value={kf.time}
                      step={0.1}
                      min={0}
                      max={selectedObj.duration}
                      onChange={e => {
                        const parsed = Math.max(0, Math.min(selectedObj.duration, parseFloat(e.target.value) || 0));
                        handleUpdateKeyframe(kf.id, { time: Math.round(parsed * 100) / 100 });
                      }}
                      onKeyDown={e => e.stopPropagation()}
                      style={{
                        width: 44,
                        padding: "2px 4px",
                        borderRadius: 3,
                        fontSize: 9,
                        fontFamily: "monospace",
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.text,
                        textAlign: "center",
                        outline: "none",
                      }}
                    />
                  </div>

                  <button
                    onClick={() => handleRemoveKeyframe(kf.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: COLORS.red,
                      cursor: "pointer",
                      fontSize: 10,
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Delete keyframe"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              </div>

              {/* Position Row */}
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 9, color: COLORS.muted }}>X:</span>
                  <EditorNumInput
                    value={kf.x}
                    onChange={v => handleUpdateKeyframe(kf.id, { x: v })}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 9, color: COLORS.muted }}>Y:</span>
                  <EditorNumInput
                    value={kf.y}
                    onChange={v => handleUpdateKeyframe(kf.id, { y: v })}
                  />
                </div>
              </div>

              {/* Scale Row */}
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 9, color: COLORS.muted }}>ScaleX:</span>
                  <EditorNumInput
                    value={kf.scaleX}
                    step={0.1}
                    min={0.01}
                    max={10}
                    onChange={v => handleUpdateKeyframe(kf.id, { scaleX: v })}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 9, color: COLORS.muted }}>ScaleY:</span>
                  <EditorNumInput
                    value={kf.scaleY}
                    step={0.1}
                    min={0.01}
                    max={10}
                    onChange={v => handleUpdateKeyframe(kf.id, { scaleY: v })}
                  />
                </div>
              </div>

              {/* Rotation & Opacity Row */}
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 9, color: COLORS.muted }}>Rot°:</span>
                  {/* Value in radians, show in degrees for user friendliness */}
                  <EditorNumInput
                    value={kf.rotation !== undefined ? Math.round(kf.rotation * 180 / Math.PI) : undefined}
                    onChange={v => {
                      const rad = v !== undefined ? (v * Math.PI / 180) : undefined;
                      handleUpdateKeyframe(kf.id, { rotation: rad });
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 9, color: COLORS.muted }}>Opac%:</span>
                  {/* Value 0-1, show 0-100 */}
                  <EditorNumInput
                    value={kf.opacity !== undefined ? Math.round(kf.opacity * 100) : undefined}
                    min={0}
                    max={100}
                    onChange={v => {
                      const op = v !== undefined ? (v / 100) : undefined;
                      handleUpdateKeyframe(kf.id, { opacity: op });
                    }}
                  />
                </div>
              </div>

              {/* Easing Select */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 8, color: COLORS.muted, textTransform: "uppercase", fontFamily: "sans-serif" }}>Transition Easing:</span>
                <select
                  value={kf.easing}
                  onChange={e => handleUpdateKeyframe(kf.id, { easing: e.target.value as any })}
                  style={{
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    borderRadius: 4,
                    fontSize: 8,
                    padding: "2px 4px",
                    cursor: "pointer",
                    outline: "none",
                    fontFamily: "monospace",
                    width: 90,
                  }}
                >
                  {["linear", "easeIn", "easeOut", "easeInOut", "spring"].map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
