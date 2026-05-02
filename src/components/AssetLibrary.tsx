/**
 * AssetLibrary — SVG shapes, image upload, hand styles.
 * Click a shape → inserts into current scene at world center.
 * Click image upload → adds image object to scene.
 */

import { useRef } from "react";
import { sceneStore } from "../store/sceneStore";
import { editorStore } from "../store/editorStore";
import { SVG_SHAPES } from "../core/svgShapes";
import type { ShapeName } from "../core/svgShapes";
import { SvgEasing } from "../core/svgPath";

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
};

// ── Shape preview using inline SVG ────────────────────────────────────────────

function ShapePreview({ pathData }: { pathData: string }) {
  return (
    <svg viewBox="-10 -10 120 120" width="100%" height="100%" style={{ display: "block" }}>
      <path d={pathData} fill="none" stroke="#6366f1" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Hand style options ────────────────────────────────────────────────────────

const HAND_STYLES = [
  { id: "hand1", src: "/hand1.png", label: "Default" },
  { id: "hand2", src: "/hand2.png", label: "Pen"     },
  { id: "hand3", src: "/hand3.png", label: "Marker"  },
];

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ padding: "8px 10px 4px", fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {label}
    </div>
  );
}

// ── AssetLibrary ──────────────────────────────────────────────────────────────

interface AssetLibraryProps {
  onHandChange: (src: string) => void;
  currentHand:  string;
}

export function AssetLibrary({ onHandChange, currentHand }: AssetLibraryProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const getInsertScene = () =>
    sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);

  const getLocalTime = () => sceneStore.getLocalTime();

  // ── Insert SVG shape ──────────────────────────────────────────────────────
  const insertShape = (name: ShapeName) => {
    console.log('[asset] insertShape', name);
    const scene = getInsertScene();
    console.log('[asset] scene', scene?.id);
    if (!scene) return;
    const id = `svg-${name}-${Date.now()}`;
    sceneStore.addSvgObject(scene.id, {
      id,
      pathData:    SVG_SHAPES[name],
      x: 0, y: 0,
      scaleX: 1.5, scaleY: 1.5,
      strokeColor: "#6366f1",
      strokeWidth: 4,
      startTime:   getLocalTime(),
      duration:    1.2,
      easing:      SvgEasing.easeInOut,
    });
    editorStore.select(id, "svg");
    editorStore.setMode("select");
  };

  // ── Insert image ──────────────────────────────────────────────────────────
  const insertImage = (file: File) => {
    const scene = getInsertScene();
    if (!scene) return;
    const url = URL.createObjectURL(file);
    const id  = `img-${Date.now()}`;
    sceneStore.addObject(scene.id, {
      id,
      type:          "image" as any,
      x:             -80, y: -60,
      width:         160, height: 120,
      src:           url,
      fillColor:     "transparent",
      startTime:     getLocalTime(),
      duration:      1.5,
      animationType: "fade",
      easing:        "easeOut",
    });
    editorStore.select(id, "animated");
    editorStore.setMode("select");
  };

  const shapeNames = Object.keys(SVG_SHAPES) as ShapeName[];

  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── SVG Shapes ────────────────────────────────────────────────────── */}
      <SectionHeader label="Shapes" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, padding: "0 8px 8px" }}>
        {shapeNames.map(name => (
          <button
            key={name}
            title={name}
            onClick={() => insertShape(name)}
            style={{
              aspectRatio: "1",
              borderRadius: 6,
              border: `1px solid ${COLORS.border}`,
              background:   COLORS.dimmer,
              cursor:       "pointer",
              padding:      6,
              display:      "flex",
              flexDirection: "column",
              alignItems:   "center",
              gap:          2,
              transition:   "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.accent;
              (e.currentTarget as HTMLButtonElement).style.background  = COLORS.accentDim;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.border;
              (e.currentTarget as HTMLButtonElement).style.background  = COLORS.dimmer;
            }}
          >
            <div style={{ width: "100%", flex: 1 }}>
              <ShapePreview pathData={SVG_SHAPES[name]} />
            </div>
            <span style={{ fontSize: 7, color: COLORS.muted, textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%", textAlign: "center" }}>
              {name}
            </span>
          </button>
        ))}
      </div>

      {/* ── Image Upload ──────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: COLORS.border, margin: "0 8px" }} />
      <SectionHeader label="Image" />
      <div style={{ padding: "0 8px 8px" }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) insertImage(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            width: "100%", padding: "8px 0", borderRadius: 6,
            border: `1px dashed ${COLORS.border}`,
            background: COLORS.dimmer, color: COLORS.muted,
            cursor: "pointer", fontSize: 10, fontFamily: "monospace",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.accent;
            (e.currentTarget as HTMLButtonElement).style.color       = COLORS.accent;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.border;
            (e.currentTarget as HTMLButtonElement).style.color       = COLORS.muted;
          }}
        >
          ↑ Upload Image
        </button>
      </div>

      {/* ── Hand Styles ───────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: COLORS.border, margin: "0 8px" }} />
      <SectionHeader label="Hand Style" />
      <div style={{ display: "flex", gap: 6, padding: "0 8px 8px" }}>
        {HAND_STYLES.map(h => {
          const active = currentHand === h.src;
          return (
            <button
              key={h.id}
              title={h.label}
              onClick={() => onHandChange(h.src)}
              style={{
                flex: 1, padding: "6px 4px", borderRadius: 6,
                border:     `1px solid ${active ? COLORS.accent : COLORS.border}`,
                background: active ? COLORS.accentDim : COLORS.dimmer,
                cursor:     "pointer",
                display:    "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 4, background: COLORS.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                ✍️
              </div>
              <span style={{ fontSize: 8, color: active ? COLORS.accent : COLORS.muted, fontFamily: "monospace" }}>
                {h.label}
              </span>
            </button>
          );
        })}
      </div>

    </div>
  );
}
