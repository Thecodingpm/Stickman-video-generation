/**
 * AssetLibrary — SVG shapes, premium illustrations, online icon search, uploads, and hand styles.
 * Highly polished, premium glassmorphism tabbed design for a streamlined user experience.
 */

import { useRef, useState, useEffect } from "react";
import { sceneStore } from "../store/sceneStore";
import { editorStore } from "../store/editorStore";
import { SVG_SHAPES } from "../core/svgShapes";
import type { ShapeName } from "../core/svgShapes";
import { SvgEasing, getPathDrawDuration, splitCompoundPath } from "../core/svgPath";
import { fetchCloudSvgs, uploadSvgToCloud, deleteSvgFromCloud, isCloudConfigured } from "../core/firebase";
import type { CloudSvgAsset } from "../core/firebase";
import { HandCalibrator } from "./HandCalibrator";

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

// Shape preview helper
function ShapePreview({ pathData, stroke = COLORS.accent }: { pathData: string; stroke?: string }) {
  return (
    <svg viewBox="-10 -10 120 120" width="100%" height="100%" style={{ display: "block" }}>
      <path d={pathData} fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const HAND_STYLES = [
  { id: "hand1", src: "/handimg1.png",  label: "Hand 1" },
  { id: "hand2", src: "/handimg2.png",  label: "Hand 2" },
  { id: "hand3", src: "/hand1.png",     label: "Hand 3" },
  { id: "hand4", src: "/style.png",     label: "Hand 4" },
  { id: "hand5", src: "/style 3.png",   label: "Hand 5" },
  { id: "hand6", src: "/style4.png",    label: "Hand 6" },
];

const PREMIUM_ILLUSTRATIONS = {
  character: [
    "M 50 20 C 35 20 30 30 30 45 C 30 65 40 75 50 75 C 60 75 70 65 70 45 C 70 30 65 20 50 20 Z",
    "M 30 45 C 15 50 10 70 15 90 L 85 90 C 90 70 85 50 70 45",
    "M 42 42 A 2 2 0 1 1 42 46",
    "M 58 42 A 2 2 0 1 1 58 46",
    "M 45 58 Q 50 64 55 58",
    "M 50 -10 C 45 -10 40 -6 40 -1 C 40 2 43 5 46 6 L 46 9 L 54 9 L 54 6 C 57 5 60 2 60 -1 C 60 -6 55 -10 50 -10 Z",
    "M 45 10 L 55 10",
    "M 35 -15 L 38 -12 M 65 -15 L 62 -12 M 50 -20 L 50 -16"
  ].join(" "),

  rocket: [
    "M 50 5 C 45 25 35 45 35 65 C 35 78 42 85 50 85 C 58 85 66 78 66 65 C 66 45 55 25 50 5 Z",
    "M 50 30 A 8 8 0 1 1 50 46 A 8 8 0 1 1 50 30 Z",
    "M 35 60 C 25 65 15 75 20 85 C 26 88 35 80 35 80 Z",
    "M 66 60 C 76 65 86 75 81 85 C 75 88 66 80 66 80 Z",
    "M 45 88 Q 50 105 55 88"
  ].join(" "),

  trophy: [
    "M 30 15 L 70 15 C 70 45 30 45 30 15 Z",
    "M 50 45 L 50 75",
    "M 35 75 L 65 75",
    "M 30 20 C 15 20 15 35 30 35",
    "M 70 20 C 85 20 85 35 70 35",
    "M 50 22 L 53 28 L 60 28 L 55 32 L 57 38 L 50 34 L 43 38 L 45 32 L 40 28 L 47 28 Z"
  ].join(" "),

  laptop: [
    "M 15 15 L 85 15 L 85 65 L 15 65 Z",
    "M 5 65 L 95 65 L 90 78 L 10 78 Z",
    "M 44 70 L 56 70 L 56 75 L 44 75 Z",
    "M 25 35 L 35 30 L 25 25 M 75 25 L 65 30 L 75 35"
  ].join(" "),

  analytics: [
    "M 10 10 L 90 10 L 90 60 L 10 60 Z",
    "M 50 60 L 50 85",
    "M 30 85 L 70 85",
    "M 20 50 L 30 50 L 30 35 L 20 35 Z",
    "M 40 50 L 50 50 L 50 25 L 40 25 Z",
    "M 60 50 L 70 50 L 70 15 L 60 15 Z",
    "M 15 52 L 25 40 L 45 30 L 65 18 L 85 18"
  ].join(" "),

  globe: [
    "M 50 10 A 40 40 0 1 1 50 90 A 40 40 0 1 1 50 10 Z",
    "M 10 50 L 90 50",
    "M 16 30 Q 50 40 84 30",
    "M 16 70 Q 50 60 84 70",
    "M 50 10 Q 30 50 50 90",
    "M 50 10 Q 70 50 50 90"
  ].join(" ")
};

interface CloudDatabasePanelProps {
  COLORS: any;
  insertShape: (pathData: string, name: string, subPaths?: string[]) => void;
}

function CloudDatabasePanel({ COLORS, insertShape }: CloudDatabasePanelProps) {
  const [assets, setAssets] = useState<CloudSvgAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newTags, setNewTags] = useState("");

  const isConfigured = isCloudConfigured();

  // Load assets from database on mount
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const list = await fetchCloudSvgs();
        if (active) setAssets(list);
      } catch (err) {
        console.error("Failed to load cloud assets:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const handleSaveToCloud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPath.trim()) {
      alert("Please provide both a name and valid SVG path data.");
      return;
    }

    setUploading(true);
    try {
      const segments = newPath.split(/(?=[Mm])/).filter(s => s.trim());
      const subPaths = segments.length > 1 ? segments : undefined;

      const created = await uploadSvgToCloud({
        name: newName.trim(),
        pathData: newPath.trim(),
        strokeColor: "#1e293b",
        strokeWidth: 3,
        fillColor: "transparent",
        subPaths,
        tags: newTags.split(",").map(t => t.trim()).filter(Boolean),
        isCustom: true
      });

      setAssets(prev => [...prev, created]);
      setNewName("");
      setNewPath("");
      setNewTags("");
      setIsAdding(false);
    } catch (err) {
      console.error("Failed to publish SVG to cloud:", err);
      alert("Failed to upload to the database. Running locally?");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from the database?`)) return;
    try {
      await deleteSvgFromCloud(id);
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error("Failed to delete cloud asset:", err);
      alert("Failed to delete asset from the database.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ── Status Badge ── */}
      <div 
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 8px",
          borderRadius: 6,
          background: isConfigured ? "rgba(99,102,241,0.08)" : "rgba(245,158,11,0.06)",
          border: `1px solid ${isConfigured ? "rgba(99,102,241,0.18)" : "rgba(245,158,11,0.15)"}`,
          fontSize: 8,
          fontWeight: "bold",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: isConfigured ? COLORS.accent : COLORS.yellow }}>●</span>
          <span style={{ color: COLORS.text, fontSize: 8 }}>
            {isConfigured ? "Firebase Cloud Connected" : "Local Offline Database Mode"}
          </span>
        </div>
        {!isConfigured && (
          <span 
            title="Add VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_API_KEY environment variables to connect Firestore"
            style={{ color: COLORS.muted, cursor: "help", borderBottom: `1px dotted ${COLORS.muted}` }}
          >
            Config Guide
          </span>
        )}
      </div>

      {/* ── Action Bar ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Cloud SVG Assets ({assets.length})
        </div>
        <button
          onClick={() => setIsAdding(prev => !prev)}
          style={{
            padding: "3px 8px",
            borderRadius: 4,
            background: isAdding ? COLORS.surface : COLORS.accent,
            color: "#ffffff",
            border: `1px solid ${isAdding ? COLORS.border : "transparent"}`,
            cursor: "pointer",
            fontSize: 8,
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: 2,
            transition: "all 0.15s"
          }}
        >
          {isAdding ? "✕ Cancel" : "➕ Add Custom"}
        </button>
      </div>

      {/* ── Add Custom SVG Form ── */}
      {isAdding && (
        <form 
          onSubmit={handleSaveToCloud}
          style={{
            padding: 8,
            borderRadius: 6,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}
        >
          <div style={{ fontSize: 8, color: COLORS.text, fontWeight: "bold" }}>Save Vector Shape to Cloud</div>
          
          <input
            type="text"
            required
            placeholder="Asset Name (e.g. Spiral Arrow)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{
              padding: "4px 6px",
              borderRadius: 4,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.dimmer,
              color: COLORS.text,
              fontSize: 9,
              outline: "none"
            }}
          />

          <textarea
            required
            placeholder="SVG Path d-data (e.g. M 10 10 L 90 90)"
            rows={3}
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
            style={{
              padding: "4px 6px",
              borderRadius: 4,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.dimmer,
              color: COLORS.text,
              fontSize: 8,
              outline: "none",
              fontFamily: "monospace",
              resize: "vertical"
            }}
          />

          <input
            type="text"
            placeholder="Tags comma separated (e.g. arrow, spiral)"
            value={newTags}
            onChange={e => setNewTags(e.target.value)}
            style={{
              padding: "4px 6px",
              borderRadius: 4,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.dimmer,
              color: COLORS.text,
              fontSize: 9,
              outline: "none"
            }}
          />

          <button
            type="submit"
            disabled={uploading}
            style={{
              width: "100%",
              padding: "5px 0",
              borderRadius: 4,
              background: COLORS.green,
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
              fontSize: 9,
              fontWeight: "bold"
            }}
          >
            {uploading ? "Uploading..." : "💾 Save to Database"}
          </button>
        </form>
      )}

      {/* ── Assets Display ── */}
      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: COLORS.muted, fontSize: 10 }}>
          <span className="animate-pulse">Loading Cloud database...</span>
        </div>
      ) : assets.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: COLORS.muted, fontSize: 9, border: `1.5px dashed ${COLORS.border}`, borderRadius: 6 }}>
          No vector assets in cloud yet. Click "Add Custom" to create one.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {assets.map(asset => (
            <div
              key={asset.id}
              style={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                padding: 6,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = COLORS.accent;
                e.currentTarget.style.background = COLORS.accentDim;
                e.currentTarget.style.transform = "scale(1.03)";
                const btn = e.currentTarget.querySelector(".del-btn") as HTMLElement;
                if (btn) btn.style.opacity = "1";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = COLORS.border;
                e.currentTarget.style.background = COLORS.surface;
                e.currentTarget.style.transform = "scale(1)";
                const btn = e.currentTarget.querySelector(".del-btn") as HTMLElement;
                if (btn) btn.style.opacity = "0";
              }}
            >
              {/* Delete Button */}
              {(asset.isCustom || !asset.id.startsWith("seeded-")) && (
                <button
                  className="del-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(asset.id, asset.name);
                  }}
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: COLORS.red,
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0,
                    transition: "opacity 0.15s",
                    zIndex: 2,
                  }}
                  title="Delete from database"
                >
                  ✕
                </button>
              )}

              {/* Click-to-insert Area */}
              <button
                onClick={() => insertShape(asset.pathData, asset.name, asset.subPaths)}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: 0,
                  margin: 0,
                }}
              >
                <div style={{ width: "90%", flex: 1 }}>
                  <ShapePreview pathData={asset.pathData} stroke={COLORS.accent} />
                </div>
                <span 
                  style={{ 
                    fontSize: 7, 
                    color: COLORS.muted, 
                    textTransform: "capitalize", 
                    overflow: "hidden", 
                    textOverflow: "ellipsis", 
                    whiteSpace: "nowrap", 
                    width: "100%",
                    textAlign: "center"
                  }}
                  title={asset.name}
                >
                  {asset.name}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AssetLibraryProps {
  onHandChange:       (src: string) => void;
  currentHand:        string;
  getViewportCenter?: () => { x: number; y: number };
}

export function AssetLibrary({ onHandChange, currentHand, getViewportCenter }: AssetLibraryProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const svgFileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"search" | "illustrations" | "shapes" | "hands" | "upload" | "cloud">("illustrations");
  const [isCalibratorOpen, setIsCalibratorOpen] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [iconsList, setIconsList] = useState<{ rawName: string; name: string; url: string }[]>([]);
  const [importingIcon, setImportingIcon] = useState<string | null>(null);

  const getInsertScene = () =>
    sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);

  const getLocalTime = () => sceneStore.getLocalTime();

  // Insert SVG shape
  const insertShape = (name: ShapeName) => {
    const scene = getInsertScene();
    if (!scene) return;
    const center = getViewportCenter ? getViewportCenter() : { x: 0, y: 0 };
    const id = `svg-${name}-${Date.now()}`;
    const pathData = SVG_SHAPES[name];
    const subPaths = splitCompoundPath(pathData);
    const hasSubPaths = subPaths.length > 1;

    sceneStore.addSvgObject(scene.id, {
      id,
      pathData,
      subPaths:    hasSubPaths ? subPaths : undefined,
      x: center.x - 75,
      y: center.y - 75,
      scaleX: 1.5, scaleY: 1.5,
      strokeColor: "#1e293b",
      strokeWidth: 3,
      fillColor:   "transparent",
      startTime:   getLocalTime(),
      duration:    1.2,
      easing:      SvgEasing.easeInOut,
    });
    editorStore.select(id, "svg");
    editorStore.setMode("select");
  };

  // Insert Premium Whiteboard Illustration
  const insertPremiumIllustration = (name: keyof typeof PREMIUM_ILLUSTRATIONS) => {
    const scene = getInsertScene();
    if (!scene) return;
    const center = getViewportCenter ? getViewportCenter() : { x: 0, y: 0 };
    const id = `svg-premium-${name}-${Date.now()}`;
    const pathData = PREMIUM_ILLUSTRATIONS[name];
    const subPaths = splitCompoundPath(pathData);
    const hasSubPaths = subPaths.length > 1;

    sceneStore.addSvgObject(scene.id, {
      id,
      pathData,
      subPaths:    hasSubPaths ? subPaths : undefined,
      x: center.x - 100,
      y: center.y - 100,
      scaleX: 2.0, scaleY: 2.0,
      strokeColor: "#1e293b",
      strokeWidth: 3,
      fillColor:   "transparent",
      startTime:   getLocalTime(),
      duration:    2.0,
      easing:      SvgEasing.easeInOutCubic,
    });
    editorStore.select(id, "svg");
    editorStore.setMode("select");
  };

  // Insert Image
  const insertImage = (file: File) => {
    const scene = getInsertScene();
    if (!scene) return;
    const center = getViewportCenter ? getViewportCenter() : { x: 0, y: 0 };
    const url = URL.createObjectURL(file);
    const id  = `img-${Date.now()}`;
    sceneStore.addObject(scene.id, {
      id,
      type:          "image" as any,
      x:             center.x - 80,
      y:             center.y - 60,
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

  // ── SVG element → path data converters ────────────────────────────────────
  // Converts every drawable SVG element type into a "d" path string so the
  // hand-draw engine can animate it stroke-by-stroke. This is the "auto-boom"
  // pipeline: drop any SVG → all shapes become animated paths.

  const _circleToPath = (el: Element): string | null => {
    const cx = parseFloat(el.getAttribute("cx") ?? "0");
    const cy = parseFloat(el.getAttribute("cy") ?? "0");
    const r  = parseFloat(el.getAttribute("r")  ?? "0");
    if (r <= 0) return null;
    // Two-arc circle: M cx-r,cy a r,r 0 1,0 2r,0 a r,r 0 1,0 -2r,0
    return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
  };

  const _ellipseToPath = (el: Element): string | null => {
    const cx = parseFloat(el.getAttribute("cx") ?? "0");
    const cy = parseFloat(el.getAttribute("cy") ?? "0");
    const rx = parseFloat(el.getAttribute("rx") ?? "0");
    const ry = parseFloat(el.getAttribute("ry") ?? "0");
    if (rx <= 0 || ry <= 0) return null;
    return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
  };

  const _rectToPath = (el: Element): string | null => {
    const x  = parseFloat(el.getAttribute("x")      ?? "0");
    const y  = parseFloat(el.getAttribute("y")      ?? "0");
    const w  = parseFloat(el.getAttribute("width")  ?? "0");
    const h  = parseFloat(el.getAttribute("height") ?? "0");
    let   rx = parseFloat(el.getAttribute("rx")     ?? "0");
    let   ry = parseFloat(el.getAttribute("ry")     ?? "0");
    if (w <= 0 || h <= 0) return null;
    // Clamp radii
    rx = Math.min(rx, w / 2);
    ry = Math.min(ry || rx, h / 2);
    rx = rx || ry;
    if (rx > 0 && ry > 0) {
      // Rounded rectangle
      return `M ${x + rx} ${y} L ${x + w - rx} ${y} A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry} L ${x + w} ${y + h - ry} A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} L ${x + rx} ${y + h} A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry} L ${x} ${y + ry} A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`;
    }
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
  };

  const _lineToPath = (el: Element): string | null => {
    const x1 = el.getAttribute("x1") ?? "0";
    const y1 = el.getAttribute("y1") ?? "0";
    const x2 = el.getAttribute("x2") ?? "0";
    const y2 = el.getAttribute("y2") ?? "0";
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  };

  const _polyToPath = (el: Element, close: boolean): string | null => {
    const raw = el.getAttribute("points")?.trim();
    if (!raw) return null;
    const nums = raw.split(/[\s,]+/).map(Number);
    if (nums.length < 4) return null;
    let d = `M ${nums[0]} ${nums[1]}`;
    for (let i = 2; i < nums.length; i += 2) {
      d += ` L ${nums[i]} ${nums[i + 1]}`;
    }
    if (close) d += " Z";
    return d;
  };

  /** Convert any drawable SVG element into a path "d" string */
  const _elementToPathData = (el: Element): string | null => {
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case "path":     return el.getAttribute("d") || null;
      case "circle":   return _circleToPath(el);
      case "ellipse":  return _ellipseToPath(el);
      case "rect":     return _rectToPath(el);
      case "line":     return _lineToPath(el);
      case "polygon":  return _polyToPath(el, true);
      case "polyline": return _polyToPath(el, false);
      default:         return null;
    }
  };

  /** Walk up the DOM to resolve an inherited attribute (stroke, fill, etc.) */
  const _resolveAttr = (el: Element, attr: string): string | null => {
    let node: Element | null = el;
    while (node) {
      const val = node.getAttribute(attr) || (node as HTMLElement).style?.[attr as any];
      if (val && val !== "inherit") return val as string;
      node = node.parentElement;
    }
    return null;
  };

  // SVG parser helper — now handles ALL drawable SVG elements
  const parseAndInsertSvgText = (text: string) => {
    const scene = getInsertScene();
    if (!scene) return;

    const parser  = new DOMParser();
    const doc     = parser.parseFromString(text, "image/svg+xml");
    const svgEl   = doc.querySelector("svg");

    // Collect every drawable element (not just <path>)
    const DRAWABLE = "path, circle, ellipse, rect, line, polygon, polyline";
    const elements = Array.from(doc.querySelectorAll(DRAWABLE));

    if (elements.length === 0) {
      alert("No drawable vector elements found in this SVG.");
      return;
    }

    let vbW = 100, vbH = 100;
    const vb = svgEl?.getAttribute("viewBox");
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4) { vbW = parts[2]; vbH = parts[3]; }
    }
    // Fallback: use width/height if no viewBox
    if (!vb && svgEl) {
      const w = parseFloat(svgEl.getAttribute("width") ?? "0");
      const h = parseFloat(svgEl.getAttribute("height") ?? "0");
      if (w > 0 && h > 0) { vbW = w; vbH = h; }
    }

    const TARGET = 300;
    const scaleX = TARGET / Math.max(vbW, 1);
    const scaleY = TARGET / Math.max(vbH, 1);
    const scale  = Math.min(scaleX, scaleY);

    const offsetX = -(vbW * scale) / 2;
    const offsetY = -(vbH * scale) / 2;

    const MICRO_PAUSE  = 0.08;
    const localTime    = getLocalTime();
    const groupId      = `svg-group-${Date.now()}`;
    let cursor         = localTime;
    let insertCount    = 0;

    elements.forEach((el, i) => {
      const d = _elementToPathData(el);
      if (!d || !d.trim()) return;

      // Resolve styles — walk up parent <g> elements for inherited attrs
      const stroke = _resolveAttr(el, "stroke") ?? "#1e293b";
      const fill   = _resolveAttr(el, "fill") ?? "none";
      const sw     = parseFloat(_resolveAttr(el, "stroke-width") ?? "2") * scale;
      const opacity = parseFloat(_resolveAttr(el, "opacity") ?? "1");
      const duration = getPathDrawDuration(d);
      const id = `svg-import-${groupId}-${i}`;

      const subPaths = splitCompoundPath(d);
      const hasSubPaths = subPaths.length > 1;

      sceneStore.addSvgObject(scene.id, {
        id,
        groupId,
        pathData:    d,
        x:           offsetX,
        y:           offsetY,
        scaleX:      scale,
        scaleY:      scale,
        strokeColor: stroke === "none" ? "#1e293b" : stroke,
        strokeWidth: Math.max(1, isNaN(sw) ? 2 : sw),
        fillColor:   fill === "none" ? undefined : fill,
        startTime:   cursor,
        duration,
        easing:      SvgEasing.easeOut,
        drawOrder:   i,
        subPaths:    hasSubPaths ? subPaths : undefined,
        handVisible: true,
        opacity:     opacity < 1 ? opacity : undefined,
      });

      cursor += duration + MICRO_PAUSE;
      insertCount++;
    });

    if (insertCount === 0) {
      alert("SVG contained elements but none had valid geometry.");
      return;
    }

    editorStore.setMode("select");
  };

  const importSvg = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      if (text) parseAndInsertSvgText(text);
    };
    reader.readAsText(file);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    try {
      const url = `https://api.iconify.design/search?query=${encodeURIComponent(searchQuery)}&limit=36`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.icons) {
        const mapped = data.icons.map((item: string) => {
          const [prefix, name] = item.split(":");
          return {
            rawName: item,
            name: name.replace(/-/g, " "),
            url: `https://api.iconify.design/${prefix}/${name}.svg`
          };
        });
        setIconsList(mapped);
      } else {
        setIconsList([]);
      }
    } catch (err) {
      console.error("Icon search failed:", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const selectOnlineIcon = async (icon: { rawName: string; url: string }) => {
    setImportingIcon(icon.rawName);
    try {
      const res = await fetch(icon.url);
      const text = await res.text();
      parseAndInsertSvgText(text);
    } catch (err) {
      console.error("Failed to load online SVG:", err);
      alert("Failed to load this SVG icon. Please try another one.");
    } finally {
      setImportingIcon(null);
    }
  };

  const shapeNames = Object.keys(SVG_SHAPES) as ShapeName[];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "monospace",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* ── Visual Tab Bar ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          background: "rgba(0,0,0,0.2)",
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "4px 6px",
          gap: 2,
        }}
      >
        {[
          { id: "illustrations", label: "🎨 Art" },
          { id: "shapes", label: "⬡ Shapes" },
          { id: "cloud", label: "☁️ Db" },
          { id: "search", label: "🔍 Find" },
          { id: "upload", label: "📤 Import" },
          { id: "hands", label: "✋ Hand" },
        ].map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 4,
                padding: "6px 2px",
                fontSize: 8,
                fontWeight: "bold",
                cursor: "pointer",
                background: active ? COLORS.accentDim : "transparent",
                color: active ? COLORS.accent : COLORS.muted,
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Scrollable Tab Content Container ───────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>

        {/* ── TAB: CLOUD / DATABASE ── */}
        {activeTab === "cloud" && (
          <CloudDatabasePanel 
            COLORS={COLORS} 
            insertShape={(pathData, name, subPaths) => {
              const scene = getInsertScene();
              if (!scene) return;
              const center = getViewportCenter ? getViewportCenter() : { x: 0, y: 0 };
              const id = `svg-cloud-${Date.now()}`;
              sceneStore.addSvgObject(scene.id, {
                id,
                pathData,
                subPaths,
                x: center.x - 75,
                y: center.y - 75,
                scaleX: 1.5, scaleY: 1.5,
                strokeColor: "#1e293b",
                strokeWidth: 3,
                fillColor: "transparent",
                startTime: getLocalTime(),
                duration: 1.5,
                easing: SvgEasing.easeInOut,
              });
              editorStore.select(id, "svg");
              editorStore.setMode("select");
            }}
          />
        )}

        {/* ── TAB: ILLUSTRATIONS ── */}
        {activeTab === "illustrations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
              Whiteboard Illustrations
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
              {(Object.keys(PREMIUM_ILLUSTRATIONS) as Array<keyof typeof PREMIUM_ILLUSTRATIONS>).map(name => (
                <button
                  key={name}
                  onClick={() => insertPremiumIllustration(name)}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    cursor: "pointer",
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = COLORS.accent;
                    e.currentTarget.style.background = COLORS.accentDim;
                    e.currentTarget.style.transform = "scale(1.03)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = COLORS.border;
                    e.currentTarget.style.background = COLORS.surface;
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <div style={{ width: "80%", flex: 1 }}>
                    <ShapePreview pathData={PREMIUM_ILLUSTRATIONS[name]} stroke={COLORS.accent} />
                  </div>
                  <span style={{ fontSize: 8, color: COLORS.text, fontWeight: "bold", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                    {name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: SHAPES ── */}
        {activeTab === "shapes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
              Standard Shapes
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {shapeNames.map(name => (
                <button
                  key={name}
                  onClick={() => insertShape(name)}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    cursor: "pointer",
                    padding: 6,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = COLORS.accent;
                    e.currentTarget.style.background = COLORS.accentDim;
                    e.currentTarget.style.transform = "scale(1.03)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = COLORS.border;
                    e.currentTarget.style.background = COLORS.surface;
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <div style={{ width: "90%", flex: 1 }}>
                    <ShapePreview pathData={SVG_SHAPES[name]} stroke={COLORS.accent} />
                  </div>
                  <span style={{ fontSize: 7, color: COLORS.muted, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                    {name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: SEARCH ONLINE ── */}
        {activeTab === "search" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Search 200,000+ Online Icons
            </div>
            
            <form onSubmit={handleSearch} style={{ display: "flex", gap: 4 }}>
              <input
                type="text"
                placeholder="Find icons (e.g. coffee, house)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  borderRadius: 5,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.dimmer,
                  color: COLORS.text,
                  fontSize: 10,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={loadingSearch}
                style={{
                  padding: "0 10px",
                  borderRadius: 5,
                  background: COLORS.accent,
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 9,
                  fontWeight: "bold",
                }}
              >
                {loadingSearch ? "..." : "Search"}
              </button>
            </form>

            {iconsList.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 5,
                marginTop: 4,
                maxHeight: 280,
                overflowY: "auto",
                border: `1px solid rgba(255, 255, 255, 0.05)`,
                borderRadius: 6,
                padding: 6,
                background: "rgba(0, 0, 0, 0.2)"
              }}>
                {iconsList.map(icon => {
                  const isImporting = importingIcon === icon.rawName;
                  return (
                    <button
                      key={icon.rawName}
                      title={icon.name}
                      onClick={() => selectOnlineIcon(icon)}
                      disabled={!!importingIcon}
                      style={{
                        aspectRatio: "1",
                        borderRadius: 5,
                        border: `1px solid ${isImporting ? COLORS.accent : COLORS.border}`,
                        background: isImporting ? COLORS.accentDim : COLORS.surface,
                        cursor: "pointer",
                        padding: 5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e => {
                        if (!importingIcon) {
                          e.currentTarget.style.borderColor = COLORS.accent;
                          e.currentTarget.style.background = COLORS.accentDim;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!importingIcon) {
                          e.currentTarget.style.borderColor = COLORS.border;
                          e.currentTarget.style.background = COLORS.surface;
                        }
                      }}
                    >
                      {isImporting ? (
                        <span style={{ fontSize: 9, color: COLORS.accent, fontWeight: "bold" }}>↓</span>
                      ) : (
                        <img
                          src={icon.url}
                          alt={icon.name}
                          style={{
                            width: "90%",
                            height: "90%",
                            objectFit: "contain",
                            filter: "invert(65%) sepia(21%) saturate(1450%) hue-rotate(215deg) brightness(98%) contrast(92%)"
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: UPLOAD / LOCAL ── */}
        {activeTab === "upload" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Upload Local Assets
            </div>

            {/* Image upload zone */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
                  width: "100%",
                  padding: "16px 0",
                  borderRadius: 8,
                  border: `1.5px dashed ${COLORS.border}`,
                  background: COLORS.surface,
                  color: COLORS.text,
                  cursor: "pointer",
                  fontSize: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = COLORS.accent;
                  e.currentTarget.style.background = COLORS.accentDim;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = COLORS.border;
                  e.currentTarget.style.background = COLORS.surface;
                }}
              >
                <span style={{ fontSize: 16 }}>📷</span>
                <span>Upload Custom Image</span>
              </button>
            </div>

            {/* SVG import zone */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <input
                ref={svgFileRef}
                type="file"
                accept=".svg,image/svg+xml"
                style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) importSvg(file);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => svgFileRef.current?.click()}
                style={{
                  width: "100%",
                  padding: "16px 0",
                  borderRadius: 8,
                  border: `1.5px dashed ${COLORS.border}`,
                  background: COLORS.surface,
                  color: COLORS.text,
                  cursor: "pointer",
                  fontSize: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = COLORS.green;
                  e.currentTarget.style.background = "rgba(16,185,129,0.06)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = COLORS.border;
                  e.currentTarget.style.background = COLORS.surface;
                }}
              >
                <span style={{ fontSize: 16 }}>🎨</span>
                <span>Import SVG Path Vector</span>
              </button>
              <div style={{ fontSize: 8, color: COLORS.muted, textAlign: "center", marginTop: 2 }}>
                Vector lines are analyzed and drawn one-by-one by the hand cursor.
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: HANDS STYLES ── */}
        {activeTab === "hands" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
              Whiteboard Drawing Hand Styles
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
              {HAND_STYLES.map(h => {
                const active = currentHand === h.src;
                return (
                  <button
                    key={h.id}
                    onClick={() => onHandChange(h.src)}
                    style={{
                      borderRadius: 8,
                      border: `2px solid ${active ? COLORS.accent : COLORS.border}`,
                      background: active ? COLORS.accentDim : COLORS.surface,
                      cursor: "pointer",
                      padding: 6,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      if (!active) e.currentTarget.style.borderColor = COLORS.accent;
                    }}
                    onMouseLeave={e => {
                      if (!active) e.currentTarget.style.borderColor = COLORS.border;
                    }}
                  >
                    <img
                      src={h.src}
                      alt={h.label}
                      style={{
                        width: "100%",
                        height: 50,
                        objectFit: "contain",
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    />
                    <span style={{ fontSize: 8, color: active ? COLORS.accent : COLORS.text, fontWeight: active ? "bold" : "normal" }}>
                      {h.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {currentHand && (
              <button
                onClick={() => setIsCalibratorOpen(true)}
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: "bold",
                  border: `1px solid ${COLORS.accent}`,
                  background: COLORS.accentDim,
                  color: COLORS.accent,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  transition: "background 0.2s, color 0.2s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = COLORS.accent;
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = COLORS.accentDim;
                  e.currentTarget.style.color = COLORS.accent;
                }}
              >
                ✋ Calibrate Stylus tip...
              </button>
            )}

            <HandCalibrator
              isOpen={isCalibratorOpen}
              onClose={() => setIsCalibratorOpen(false)}
              handSrc={currentHand}
            />
          </div>
        )}

      </div>
    </div>
  );
}
