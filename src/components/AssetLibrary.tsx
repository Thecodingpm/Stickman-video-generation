/**
 * AssetLibrary — Unified library panel: search, upload, drag-and-drop, save to DB, hand styles.
 */

import { useRef, useState, useEffect, useCallback, DragEvent } from "react";
import { sceneStore } from "../store/sceneStore";
import { editorStore } from "../store/editorStore";
import { SVG_SHAPES } from "../core/svgShapes";
import type { ShapeName } from "../core/svgShapes";
import { SvgEasing, getPathDrawDuration, splitCompoundPath } from "../core/svgPath";
import { fetchCloudSvgs, uploadSvgToCloud, deleteSvgFromCloud, isCloudConfigured } from "../core/firebase";
import type { CloudSvgAsset } from "../core/firebase";
import { HandCalibrator } from "./HandCalibrator";

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:        "#121214",
  surface:   "#1a1a1e",
  surfaceHi: "#222226",          // Darker card background
  border:    "rgba(255,255,255,0.08)",
  borderHi:  "rgba(255,255,255,0.15)",
  accent:    "#ffffff",
  accentDim: "rgba(255,255,255,0.06)",
  text:      "#f4f4f5",
  textMuted: "#8e8e93",
  dimmer:    "#16161a",
  green:     "#34d399",
  greenDim:  "rgba(52,211,153,0.1)",
  yellow:    "#fbbf24",
  red:       "#ef4444",
  redDim:    "rgba(239,68,68,0.1)",
};

// ─── SVG Icon Components ───────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const SaveIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
);
const CloudIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
  </svg>
);
const HandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
  </svg>
);
const LibraryIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const StylusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
    <path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
  </svg>
);
const XIcon = () => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// ─── Helpers ───────────────────────────────────────────────────────────────────
function ShapePreview({ pathData, stroke = C.accent }: { pathData: string; stroke?: string }) {
  return (
    <svg viewBox="-10 -10 120 120" width="100%" height="100%" style={{ display: "block" }}>
      <path d={pathData} fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SvgPreview({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      style={{
        width: "100%", height: "100%", objectFit: "contain",
        filter: "invert(65%) sepia(21%) saturate(1450%) hue-rotate(215deg) brightness(98%) contrast(92%)"
      }}
    />
  );
}

// ─── Search Helpers ────────────────────────────────────────────────────────────
function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  const t = text.trim().toLowerCase();
  if (!q) return 1;

  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let totalScore = 0;
  for (const word of words) {
    let wordScore = 0;
    if (t === word) {
      wordScore = 100;
    } else if (t.startsWith(word)) {
      wordScore = 80 - (t.length - word.length);
    } else if (t.includes(word)) {
      wordScore = 60 - t.indexOf(word);
    } else {
      // fuzzy character sequence matching for the word
      let qi = 0;
      let lastMatchIdx = -1;
      let totalGap = 0;
      for (let ti = 0; ti < t.length && qi < word.length; ti++) {
        if (t[ti] === word[qi]) {
          if (lastMatchIdx !== -1) {
            totalGap += (ti - lastMatchIdx - 1);
          }
          lastMatchIdx = ti;
          qi++;
        }
      }
      if (qi === word.length) {
        const gapPenalty = Math.min(15, totalGap);
        const lengthPenalty = Math.min(10, t.length - word.length);
        wordScore = 30 - gapPenalty - lengthPenalty;
      }
    }
    if (wordScore <= 0) return 0; // all words must match at least somewhat
    totalScore += wordScore;
  }
  return totalScore / words.length;
}

function renderHighlightedText(text: string, query: string, accentColor: string) {
  const q = query.trim().toLowerCase();
  if (!q) return <span style={{ textTransform: "capitalize" }}>{text}</span>;

  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return <span style={{ textTransform: "capitalize" }}>{text}</span>;

  const tLower = text.toLowerCase();
  const matchedIndices = new Set<number>();

  for (const word of words) {
    const subIdx = tLower.indexOf(word);
    if (subIdx !== -1) {
      for (let i = 0; i < word.length; i++) {
        matchedIndices.add(subIdx + i);
      }
    } else {
      let qi = 0;
      for (let ti = 0; ti < tLower.length && qi < word.length; ti++) {
        if (tLower[ti] === word[qi]) {
          matchedIndices.add(ti);
          qi++;
        }
      }
    }
  }

  return (
    <span style={{ textTransform: "capitalize" }}>
      {text.split("").map((char, idx) => {
        const isHighlighted = matchedIndices.has(idx);
        return (
          <span
            key={idx}
            style={{
              color: isHighlighted ? accentColor : "inherit",
              fontWeight: isHighlighted ? "700" : "inherit",
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const HAND_STYLES = [
  { id: "hand1", src: "/handimg1.png",  label: "Hand 1" },
  { id: "hand2", src: "/handimg2.png",  label: "Hand 2" },
  { id: "hand3", src: "/hand1.png",     label: "Hand 3" },
  { id: "hand4", src: "/style.png",     label: "Hand 4" },
  { id: "hand5", src: "/style 3.png",   label: "Hand 5" },
  { id: "hand6", src: "/style4.png",    label: "Hand 6" },
];

// Shape "library" entries from built-in shapes
const SHAPE_ENTRIES = (Object.keys(SVG_SHAPES) as ShapeName[]).map(n => ({
  id: `shape:${n}`,
  name: n,
  pathData: SVG_SHAPES[n],
  type: "shape" as const,
}));

// ─── Types ────────────────────────────────────────────────────────────────────
type LibraryTab = "library" | "hands";

interface LocalAsset {
  id: string;
  name: string;
  pathData?: string;
  svgUrl?: string;       // object URL for raster images
  type: "shape" | "svg" | "image" | "cloud" | "icon";
  isCustom?: boolean;
  cloudId?: string;      // if already saved to cloud
  pendingSave?: boolean; // show "save to DB" prompt
  svgText?: string;      // raw SVG text for cloud save
}

// ── Path converters (Exported for drag and drop parsing in Editor) ───────────
export const _circleToPath = (el: Element): string | null => {
  const cx = parseFloat(el.getAttribute("cx") ?? "0");
  const cy = parseFloat(el.getAttribute("cy") ?? "0");
  const r  = parseFloat(el.getAttribute("r")  ?? "0");
  if (r <= 0) return null;
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
};
export const _ellipseToPath = (el: Element): string | null => {
  const cx = parseFloat(el.getAttribute("cx") ?? "0");
  const cy = parseFloat(el.getAttribute("cy") ?? "0");
  const rx = parseFloat(el.getAttribute("rx") ?? "0");
  const ry = parseFloat(el.getAttribute("ry") ?? "0");
  if (rx <= 0 || ry <= 0) return null;
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
};
export const _rectToPath = (el: Element): string | null => {
  const x  = parseFloat(el.getAttribute("x")      ?? "0");
  const y  = parseFloat(el.getAttribute("y")      ?? "0");
  const w  = parseFloat(el.getAttribute("width")  ?? "0");
  const h  = parseFloat(el.getAttribute("height") ?? "0");
  let   rx = parseFloat(el.getAttribute("rx")     ?? "0");
  let   ry = parseFloat(el.getAttribute("ry")     ?? "0");
  if (w <= 0 || h <= 0) return null;
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry || rx, h / 2);
  rx = rx || ry;
  if (rx > 0 && ry > 0) {
    return `M ${x + rx} ${y} L ${x + w - rx} ${y} A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry} L ${x + w} ${y + h - ry} A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} L ${x + rx} ${y + h} A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry} L ${x} ${y + ry} A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`;
  }
  return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
};
export const _lineToPath  = (el: Element): string | null => {
  const x1 = el.getAttribute("x1") ?? "0";
  const y1 = el.getAttribute("y1") ?? "0";
  const x2 = el.getAttribute("x2") ?? "0";
  const y2 = el.getAttribute("y2") ?? "0";
  return `M ${x1} ${y1} L ${x2} ${y2}`;
};
export const _polyToPath  = (el: Element, close: boolean): string | null => {
  const raw = el.getAttribute("points")?.trim();
  if (!raw) return null;
  const nums = raw.split(/[\s,]+/).map(Number);
  if (nums.length < 4) return null;
  let d = `M ${nums[0]} ${nums[1]}`;
  for (let i = 2; i < nums.length; i += 2) d += ` L ${nums[i]} ${nums[i + 1]}`;
  if (close) d += " Z";
  return d;
};
export const _elementToPathData = (el: Element): string | null => {
  switch (el.tagName.toLowerCase()) {
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
export const _resolveAttr = (el: Element, attr: string): string | null => {
  let node: Element | null = el;
  while (node) {
    const val = node.getAttribute(attr) || (node as HTMLElement).style?.[attr as any];
    if (val && val !== "inherit") return val as string;
    node = node.parentElement;
  }
  return null;
};


// ─── Main Component ───────────────────────────────────────────────────────────
interface AssetLibraryProps {
  onHandChange:       (src: string) => void;
  currentHand:        string;
  getViewportCenter?: () => { x: number; y: number };
}

export function AssetLibrary({ onHandChange, currentHand, getViewportCenter }: AssetLibraryProps) {
  const fileRef    = useRef<HTMLInputElement>(null);
  const svgFileRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<LibraryTab>("library");
  const [isCalibratorOpen, setIsCalibratorOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search
  const [searchQuery, setSearchQuery]     = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<{ rawName: string; name: string; url: string }[]>([]);

  // Local library: cloud + shapes + recently added
  const [cloudAssets, setCloudAssets]     = useState<CloudSvgAsset[]>([]);
  const [loadingCloud, setLoadingCloud]   = useState(true);
  const [localAssets, setLocalAssets]     = useState<LocalAsset[]>(() => {
    try {
      const saved = localStorage.getItem("scribe_flow_recent_assets");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("scribe_flow_recent_assets", JSON.stringify(localAssets));
    } catch {
      // ignore
    }
  }, [localAssets]);

  // Upload state
  const [isDragOver, setIsDragOver]       = useState(false);
  const [savingToCloud, setSavingToCloud] = useState<string | null>(null);
  const [importingIcon, setImportingIcon] = useState<string | null>(null);
  const [pastedSvgCode, setPastedSvgCode] = useState("");
  const [showPasteBox, setShowPasteBox]   = useState(false);
  const [showShapesLibrary, setShowShapesLibrary] = useState(true);
  const [showDbLibrary, setShowDbLibrary] = useState(true);

  // Math LaTeX state
  const [latexInput, setLatexInput] = useState("");
  const [latexPreviewUrl, setLatexPreviewUrl] = useState("");
  const [loadingFormula, setLoadingFormula] = useState(false);

  // ── Scene helpers ──────────────────────────────────────────────────────────
  const getInsertScene = () =>
    sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
  const getLocalTime = () => sceneStore.getLocalTime();

  // ── Sync localAssets on storage updates (for canvas drag-and-drop addition notifications) ──
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem("scribe_flow_recent_assets");
        if (saved) setLocalAssets(JSON.parse(saved));
      } catch {}
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("scribe_recent_assets_update", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("scribe_recent_assets_update", handleStorageChange);
    };
  }, []);

  // ── Insert helpers ─────────────────────────────────────────────────────────
  const insertSvgPath = useCallback((pathData: string, name: string, subPaths?: string[]) => {
    const scene = getInsertScene();
    if (!scene) return;
    const center = getViewportCenter ? getViewportCenter() : { x: 0, y: 0 };
    const id = `svg-lib-${Date.now()}`;
    sceneStore.addSvgObject(scene.id, {
      id,
      pathData,
      subPaths,
      x: center.x - 75, y: center.y - 75,
      scaleX: 1.5, scaleY: 1.5,
      strokeColor: "#1e293b",
      strokeWidth: 3,
      fillColor: "transparent",
      startTime: getLocalTime(),
      duration: getPathDrawDuration(pathData),
      easing: SvgEasing.easeInOut,
    });
    editorStore.select(id, "svg");
    editorStore.setMode("select");
  }, [getViewportCenter]);

  const insertShape = useCallback((name: ShapeName) => {
    const pathData = SVG_SHAPES[name];
    const subPaths = splitCompoundPath(pathData);
    insertSvgPath(pathData, name, subPaths.length > 1 ? subPaths : undefined);

    const assetId = `seeded-${name}`;
    setLocalAssets(prev => {
      const filtered = prev.filter(x => x.id !== assetId);
      return [
        {
          id: assetId,
          name: name.replace(/-/g, " "),
          pathData,
          type: "shape",
        },
        ...filtered,
      ].slice(0, 12);
    });
  }, [insertSvgPath]);

  const insertImage = useCallback((file: File) => {
    const scene = getInsertScene();
    if (!scene) return;
    const center = getViewportCenter ? getViewportCenter() : { x: 0, y: 0 };
    const url = URL.createObjectURL(file);
    const id  = `img-${Date.now()}`;
    sceneStore.addObject(scene.id, {
      id, type: "image" as any,
      x: center.x - 80, y: center.y - 60,
      width: 160, height: 120,
      src: url, fillColor: "transparent",
      startTime: getLocalTime(), duration: 1.5,
      animationType: "fade", easing: "easeOut",
    });
    editorStore.select(id, "animated");
    editorStore.setMode("select");
  }, [getViewportCenter]);

  // ── SVG Parser ─────────────────────────────────────────────────────────────
  const parseAndInsertSvgText = useCallback((text: string, opts?: { pendingSave?: boolean; filename?: string }) => {
    const scene = getInsertScene();
    if (!scene) return;

    // ── Sanitization & Cleaning ──
    let cleanText = text.trim();
    // Strip markdown code fences (e.g. ```xml ... ``` or ```svg ... ``` or ``` ... ```)
    cleanText = cleanText.replace(/^```[a-zA-Z]*\n?/, "");
    cleanText = cleanText.replace(/```$/, "");
    cleanText = cleanText.trim();

    // Extract precise <svg>...</svg> block case-insensitively if it is surrounded by outer text/garbage
    const lowerText = cleanText.toLowerCase();
    const startIdx = lowerText.indexOf("<svg");
    if (startIdx !== -1) {
      const endIdx = lowerText.lastIndexOf("</svg>");
      if (endIdx !== -1) {
        cleanText = cleanText.substring(startIdx, endIdx + 6);
      } else {
        // Heal truncated SVG code automatically
        cleanText = cleanText.substring(startIdx) + "\n</svg>";
      }
    }

    const parser  = new DOMParser();
    let doc       = parser.parseFromString(cleanText, "image/svg+xml");

    // Check for standard XML parsing errors
    const parseError = doc.querySelector("parsererror");
    const DRAWABLE_NAMES = new Set(["path", "circle", "ellipse", "rect", "line", "polygon", "polyline"]);
    let allElements = Array.from(doc.getElementsByTagName("*"));
    let elements = allElements.filter(el => DRAWABLE_NAMES.has(el.localName.toLowerCase()));

    // Highly robust fallback: if XML parser fails or returns 0 drawables due to strict namespace/casing/unclosed tags,
    // fallback to HTML parser which is extremely forgiving and creates a perfect DOM tree for any malformed code!
    if (parseError || elements.length === 0) {
      doc = parser.parseFromString(cleanText, "text/html");
      allElements = Array.from(doc.getElementsByTagName("*"));
      elements = allElements.filter(el => DRAWABLE_NAMES.has(el.localName.toLowerCase()));
    }

    const svgEl = doc.querySelector("svg") || allElements.find(el => el.localName.toLowerCase() === "svg") || null;

    if (elements.length === 0) {
      alert("No drawable vector elements found. Please ensure the SVG contains stroke paths (<path>, <circle>, <rect>, etc.).");
      return;
    }

    let vbW = 100, vbH = 100;
    const vb = svgEl?.getAttribute("viewBox");
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4) { vbW = parts[2]; vbH = parts[3]; }
    }
    if (!vb && svgEl) {
      const w = parseFloat(svgEl.getAttribute("width") ?? "0");
      const h = parseFloat(svgEl.getAttribute("height") ?? "0");
      if (w > 0 && h > 0) { vbW = w; vbH = h; }
    }

    const TARGET = 300;
    const scale  = Math.min(TARGET / Math.max(vbW, 1), TARGET / Math.max(vbH, 1));
    const offsetX = -(vbW * scale) / 2;
    const offsetY = -(vbH * scale) / 2;
    const MICRO_PAUSE = 0.08;
    const localTime   = getLocalTime();
    const groupId     = `svg-group-${Date.now()}`;
    let cursor        = localTime;
    let insertCount   = 0;

    const hasAnyStroke = elements.some(el => {
      const s = _resolveAttr(el, "stroke");
      return s && s !== "none";
    });

    // Helper to recursively parse nested parent transforms (translate and scale)
    const getCombinedTransform = (el: Element) => {
      let x = 0, y = 0, scaleX = 1, scaleY = 1;
      let node: Element | null = el;
      while (node) {
        const transform = node.getAttribute("transform");
        if (transform) {
          // Parse translate(x, y) or translate(x)
          const translateMatch = transform.match(/translate\(\s*(-?\d+\.?\d*)\s*[, ]?\s*(-?\d+\.?\d*)?\s*\)/);
          if (translateMatch) {
            x += parseFloat(translateMatch[1]);
            y += parseFloat(translateMatch[2] ?? "0");
          }
          // Parse scale(sx, sy) or scale(s)
          const scaleMatch = transform.match(/scale\(\s*(-?\d+\.?\d*)\s*[, ]?\s*(-?\d+\.?\d*)?\s*\)/);
          if (scaleMatch) {
            const sx = parseFloat(scaleMatch[1]);
            const sy = parseFloat(scaleMatch[2] ?? scaleMatch[1]);
            scaleX *= sx;
            scaleY *= sy;
          }
        }
        node = node.parentElement;
      }
      return { x, y, scaleX, scaleY };
    };

    elements.forEach((el, i) => {
      // 1. Skip elements inside utility groups like <defs>, <clipPath>, <maskKey>, etc.
      let parent = el.parentElement;
      let isUtility = false;
      while (parent) {
        const tag = parent.tagName.toLowerCase();
        if (tag === "defs" || tag === "clippath" || tag === "mask" || tag === "metadata") {
          isUtility = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (isUtility) return;

      const d = _elementToPathData(el);
      if (!d || !d.trim()) return;

      const stroke  = _resolveAttr(el, "stroke") ?? "none";
      const fill    = _resolveAttr(el, "fill")   ?? "none";

      // 2. Skip giant background bounding boxes or empty viewbox rectangles
      if (el.tagName.toLowerCase() === "rect") {
        const w = parseFloat(el.getAttribute("width") ?? "0");
        const h = parseFloat(el.getAttribute("height") ?? "0");
        if ((Math.abs(w - vbW) < 2 && Math.abs(h - vbH) < 2) || (stroke === "none" && fill === "none")) {
          return; // Skip this background frame
        }
      }

      // 3. Resolve parent transforms
      const { x: tX, y: tY, scaleX: tSX, scaleY: tSY } = getCombinedTransform(el);
      const finalX = offsetX + tX * scale;
      const finalY = offsetY + tY * scale;
      const finalScaleX = scale * tSX;
      const finalScaleY = scale * tSY;

      const sw      = parseFloat(_resolveAttr(el, "stroke-width") ?? "2") * finalScaleX;
      const opacity = parseFloat(_resolveAttr(el, "opacity") ?? "1");
      const duration = getPathDrawDuration(d);
      const baseId   = `svg-import-${groupId}-${i}`;
      const subPaths = splitCompoundPath(d);
      const hasSubPaths = subPaths.length > 1;
      const hasStroke = stroke !== "none";
      const hasFill   = fill   !== "none";

      if (hasStroke && hasFill) {
        const strokeDur = duration * 0.7;
        const fillDur   = duration * 0.5;
        sceneStore.addSvgObject(scene.id, {
          id: `${baseId}-stroke`, groupId, pathData: d,
          x: finalX, y: finalY, scaleX: finalScaleX, scaleY: finalScaleY,
          strokeColor: stroke, strokeWidth: Math.max(1, isNaN(sw) ? 2 : sw),
          fillColor: undefined, startTime: cursor, duration: strokeDur,
          easing: SvgEasing.easeOut, drawOrder: i * 2,
          subPaths: hasSubPaths ? subPaths : undefined, handVisible: true,
          opacity: opacity < 1 ? opacity : undefined, drawMode: "stroke",
        });
        cursor += strokeDur;
        sceneStore.addSvgObject(scene.id, {
          id: `${baseId}-fill`, groupId, pathData: d,
          x: finalX, y: finalY, scaleX: finalScaleX, scaleY: finalScaleY,
          strokeColor: "none", strokeWidth: 0, fillColor: fill,
          startTime: cursor, duration: fillDur, easing: SvgEasing.easeOut,
          drawOrder: i * 2 + 1, subPaths: hasSubPaths ? subPaths : undefined,
          handVisible: true, opacity: opacity < 1 ? opacity : undefined, drawMode: "fill",
        });
        cursor += fillDur + MICRO_PAUSE;
        insertCount += 2;
      } else if (hasStroke) {
        sceneStore.addSvgObject(scene.id, {
          id: baseId, groupId, pathData: d,
          x: finalX, y: finalY, scaleX: finalScaleX, scaleY: finalScaleY,
          strokeColor: stroke, strokeWidth: Math.max(1, isNaN(sw) ? 2 : sw),
          fillColor: undefined, startTime: cursor, duration, easing: SvgEasing.easeOut,
          drawOrder: i * 2, subPaths: hasSubPaths ? subPaths : undefined,
          handVisible: true, opacity: opacity < 1 ? opacity : undefined, drawMode: "stroke",
        });
        cursor += duration + MICRO_PAUSE;
        insertCount++;
      } else {
        const drawMode = hasAnyStroke ? "fill" : "stroke";
        sceneStore.addSvgObject(scene.id, {
          id: baseId, groupId, pathData: d,
          x: finalX, y: finalY, scaleX: finalScaleX, scaleY: finalScaleY,
          strokeColor: stroke === "none" ? "#1e293b" : stroke,
          strokeWidth: Math.max(1, isNaN(sw) ? 2 : sw),
          fillColor: fill === "none" ? undefined : fill,
          startTime: cursor, duration, easing: SvgEasing.easeOut,
          drawOrder: i * 2, subPaths: hasSubPaths ? subPaths : undefined,
          handVisible: true, opacity: opacity < 1 ? opacity : undefined, drawMode,
        });
        cursor += duration + MICRO_PAUSE;
        insertCount++;
      }
    });

    if (insertCount === 0) {
      alert("SVG contained elements but none had valid geometry.");
      return;
    }

    editorStore.setMode("select");

    // If requested, add to local assets list with pendingSave
    if (opts?.pendingSave) {
      const assetId = `local-${Date.now()}`;
      const combinedPathData = elements.map(el => _elementToPathData(el)).filter(Boolean).join(" ");
      setLocalAssets(prev => {
        const filtered = prev.filter(x => x.name !== (opts.filename ?? "Imported SVG"));
        return [
          {
            id: assetId,
            name: opts.filename ?? "Imported SVG",
            type: "svg",
            pathData: combinedPathData,
            pendingSave: true,
            svgText: text,
          },
          ...filtered,
        ].slice(0, 12);
      });
    }
  }, [getViewportCenter]);

  const handleUniversalImport = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const scene = getInsertScene();
    if (!scene) return;
    const center = getViewportCenter ? getViewportCenter() : { x: 0, y: 0 };
    const localTime = getLocalTime();

    // ── Case 1: Image URL or Base64 Image ──
    const isBase64Image = /^data:image\//i.test(trimmed);
    const isRasterUrl = /\.(png|jpg|jpeg|gif|webp)$/i.test(trimmed);
    const isGenericUrl = trimmed.startsWith("http") && !trimmed.toLowerCase().includes("<svg") && !trimmed.toLowerCase().endsWith(".svg");

    if (isBase64Image || isRasterUrl || isGenericUrl) {
      const id = `img-paste-${Date.now()}`;
      sceneStore.addObject(scene.id, {
        id, type: "image" as any,
        x: center.x - 80, y: center.y - 60,
        width: 160, height: 120,
        src: trimmed, fillColor: "transparent",
        startTime: localTime, duration: 1.5,
        animationType: "fade", easing: "easeOut",
      });
      // Add to local assets as image
      const assetId = `local-paste-${Date.now()}`;
      setLocalAssets(prev => {
        const filtered = prev.filter(x => x.id !== assetId);
        return [
          {
            id: assetId,
            name: "Pasted Image",
            type: "image",
            svgUrl: trimmed,
            pendingSave: true,
            svgText: trimmed,
          },
          ...filtered,
        ].slice(0, 12);
      });
      editorStore.select(id, "animated");
      editorStore.setMode("select");
      return;
    }

    // ── Case 2: SVG URL ──
    if (trimmed.startsWith("http") && trimmed.toLowerCase().endsWith(".svg")) {
      try {
        const res = await fetch(trimmed);
        const svgText = await res.text();
        parseAndInsertSvgText(svgText, { pendingSave: true, filename: "Fetched SVG" });
      } catch {
        alert("Failed to fetch SVG from the URL. Please ensure the URL is public and allows CORS.");
      }
      return;
    }

    // ── Case 3: Raw SVG XML Code ──
    const lower = trimmed.toLowerCase();
    if (lower.includes("<svg") || lower.includes("<path") || lower.includes("<rect")) {
      parseAndInsertSvgText(trimmed, { pendingSave: true, filename: "Pasted AI Sketch" });
      return;
    }

    // ── Case 3.5: Paste Math Equation ──
    const isMathFormula = (str: string): boolean => {
      const s = str.trim();
      if (s.startsWith("\\") || s.startsWith("$$") || s.startsWith("$")) return true;
      if (s.includes("^") || s.includes("_") || /[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱˣ√]/.test(s)) return true;
      if (s.includes("=") && (s.includes("+") || s.includes("-") || s.includes("*") || s.includes("/") || /[a-z]/i.test(s))) return true;
      const mathRegex = /(\\frac|\\sqrt|\\sum|\\int|\\alpha|\\beta|\\pi|\\theta|\\infty|\\partial|\\cdot|\\times)/i;
      return mathRegex.test(s);
    };

    if (isMathFormula(trimmed)) {
      try {
        let formula = trimmed;
        
        // 1. Translate literal Unicode superscripts to LaTeX exponents
        const superscripts: Record<string, string> = {
          "⁰": "^0", "¹": "^1", "²": "^2", "³": "^3", "⁴": "^4",
          "⁵": "^5", "⁶": "^6", "⁷": "^7", "⁸": "^8", "⁹": "^9",
          "ⁿ": "^n", "ⁱ": "^i", "ˣ": "^x"
        };
        for (const [char, replacement] of Object.entries(superscripts)) {
          formula = formula.replaceAll(char, replacement);
        }

        // 2. Translate literal Unicode square root "√" to LaTeX "\sqrt"
        // Case A: √ followed by parenthesized term, e.g., √(x + y) -> \sqrt{x + y}
        formula = formula.replace(/√\(([^)]+)\)/g, "\\sqrt{$1}");
        // Case B: √ followed by single letter or digit, e.g., √x -> \sqrt{x}
        formula = formula.replace(/√([a-zA-Z0-9])/g, "\\sqrt{$1}");

        // 3. Translate multiplication asterisk to standard math \times cross
        formula = formula.replace(/\*/g, "\\times");

        const url = `https://math.vercel.app/?from=${encodeURIComponent(formula)}&color=black`;
        const res = await fetch(url);
        const svgText = await res.text();
        parseAndInsertSvgText(svgText, { pendingSave: true, filename: `Formula: ${trimmed.slice(0, 24)}` });
        return;
      } catch (err) {
        console.warn("LaTeX fetch failed, falling back to plain text", err);
      }
    }

    // ── Case 4: Plain Text ──
    const textId = `text-paste-${Date.now()}`;
    sceneStore.addObject(scene.id, {
      id: textId,
      type: "text" as any,
      x: center.x - 100, y: center.y - 20,
      content: trimmed,
      fontSize: 24,
      fontFamily: "Outfit",
      fillColor: "#0f172a",
      startTime: localTime,
      duration: 1.0,
      animationType: "write",
    } as any);
    editorStore.select(textId, "animated");
    editorStore.setMode("select");
  }, [getViewportCenter, parseAndInsertSvgText]);

  // ── Load cloud assets ──────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingCloud(true);
      try {
        const list = await fetchCloudSvgs();
        if (active) setCloudAssets(list);
      } catch {
        // silent
      } finally {
        if (active) setLoadingCloud(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    try {
      const url = `https://api.iconify.design/search?query=${encodeURIComponent(searchQuery)}&limit=48`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data?.icons) {
        const mapped = data.icons.map((item: string) => {
          const [prefix, name] = item.split(":");
          return { rawName: item, name: name.replace(/-/g, " "), url: `https://api.iconify.design/${prefix}/${name}.svg` };
        });
        setSearchResults(mapped);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  const selectOnlineIcon = async (icon: { rawName: string; name: string; url: string }) => {
    setImportingIcon(icon.rawName);
    try {
      const res  = await fetch(icon.url);
      const text = await res.text();
      parseAndInsertSvgText(text, { pendingSave: true, filename: icon.name });
    } catch {
      alert("Failed to load this SVG icon. Please try another one.");
    } finally {
      setImportingIcon(null);
    }
  };

  // ── File handlers ──────────────────────────────────────────────────────────
  const handleSvgFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      if (text) parseAndInsertSvgText(text, { pendingSave: true, filename: file.name.replace(/\.svg$/i, "") });
    };
    reader.readAsText(file);
  };

  const handleImageFile = (file: File) => {
    insertImage(file);
    const assetId = `local-img-${Date.now()}`;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      setLocalAssets(prev => {
        const filtered = prev.filter(x => x.name !== file.name.replace(/\.[^/.]+$/, ""));
        return [
          {
            id: assetId,
            name: file.name.replace(/\.[^/.]+$/, ""),
            type: "image",
            svgUrl: base64data,
            pendingSave: true,
            svgText: base64data,
          },
          ...filtered,
        ].slice(0, 12);
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
        handleSvgFile(file);
      } else if (file.type.startsWith("image/")) {
        handleImageFile(file);
      }
    });
  };

  // ── Drag and drop ──────────────────────────────────────────────────────────
  const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = () => setIsDragOver(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // ── Save to cloud ──────────────────────────────────────────────────────────
  const saveToCloud = async (asset: LocalAsset) => {
    if (!asset.svgText) { alert("No data to save."); return; }
    setSavingToCloud(asset.id);
    try {
      let created: CloudSvgAsset;

      if (asset.type === "image") {
        created = await uploadSvgToCloud({
          name: asset.name,
          pathData: asset.svgText,
          strokeColor: "none",
          strokeWidth: 0,
          fillColor: "transparent",
          tags: ["image", "custom"],
          isCustom: true,
          type: "image",
        });
      } else {
        const parser = new DOMParser();
        const doc = parser.parseFromString(asset.svgText, "image/svg+xml");
        const el  = doc.querySelector("path");
        const d   = el?.getAttribute("d") ?? "";
        const segments = d.split(/(?=[Mm])/).filter(s => s.trim());

        created = await uploadSvgToCloud({
          name: asset.name,
          pathData: d || "M 0 0",
          strokeColor: "#1e293b",
          strokeWidth: 3,
          fillColor: "transparent",
          subPaths: segments.length > 1 ? segments : undefined,
          tags: ["svg", "custom"],
          isCustom: true,
          type: "svg",
        });
      }

      setCloudAssets(prev => [...prev, created]);
      setLocalAssets(prev => prev.map(a => a.id === asset.id ? { ...a, pendingSave: false, cloudId: created.id } : a));
    } catch {
      alert("Failed to save to database. Is Firebase configured?");
    } finally {
      setSavingToCloud(null);
    }
  };

  // ── Delete cloud asset ─────────────────────────────────────────────────────
  const deleteCloudAsset = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" from the database?`)) return;
    try {
      await deleteSvgFromCloud(id);
      setCloudAssets(prev => prev.filter(a => a.id !== id));
    } catch {
      alert("Failed to delete.");
    }
  };

  // ── Insert cloud asset ─────────────────────────────────────────────────────
  const insertCloudAsset = (asset: CloudSvgAsset) => {
    const scene = getInsertScene();
    if (!scene) return;
    const center = getViewportCenter ? getViewportCenter() : { x: 0, y: 0 };
    const isImage = asset.type === "image" || asset.pathData.startsWith("data:image/");
    const id = isImage ? `img-cloud-${Date.now()}` : `svg-cloud-${Date.now()}`;

    if (isImage) {
      sceneStore.addObject(scene.id, {
        id,
        type: "image" as any,
        x: center.x - 80, y: center.y - 60,
        width: 160, height: 120,
        src: asset.pathData,
        fillColor: "transparent",
        startTime: getLocalTime(), duration: 1.5,
        animationType: "fade", easing: "easeOut",
      });
      editorStore.select(id, "animated");
      editorStore.setMode("select");
    } else {
      sceneStore.addSvgObject(scene.id, {
        id, pathData: asset.pathData, subPaths: asset.subPaths,
        x: center.x - 75, y: center.y - 75,
        scaleX: 1.5, scaleY: 1.5,
        strokeColor: "#1e293b", strokeWidth: 3, fillColor: "transparent",
        startTime: getLocalTime(), duration: 1.5, easing: SvgEasing.easeInOut,
      });
      editorStore.select(id, "svg");
      editorStore.setMode("select");
    }

    setLocalAssets(prev => {
      const filtered = prev.filter(x => x.id !== asset.id);
      return [
        {
          id: asset.id,
          name: asset.name,
          pathData: isImage ? undefined : asset.pathData,
          svgUrl: isImage ? asset.pathData : undefined,
          type: "cloud",
          cloudId: asset.id,
        },
        ...filtered,
      ].slice(0, 12);
    });
  };

  const handleSelectAsset = (asset: any) => {
    if (asset.type === "shape") {
      insertShape(asset.name as ShapeName);
    } else if (asset.type === "svg") {
      if (asset.svgText) {
        parseAndInsertSvgText(asset.svgText);
      } else if (asset.pathData) {
        insertSvgPath(asset.pathData, asset.name);
      }
    } else if (asset.type === "image") {
      const src = asset.svgUrl || asset.pathData || "";
      if (src) {
        const scene = getInsertScene();
        if (!scene) return;
        const center = getViewportCenter ? getViewportCenter() : { x: 0, y: 0 };
        const id = `img-click-${Date.now()}`;
        sceneStore.addObject(scene.id, {
          id, type: "image" as any,
          x: center.x - 80, y: center.y - 60,
          width: 160, height: 120,
          src, fillColor: "transparent",
          startTime: getLocalTime(), duration: 1.5,
          animationType: "fade", easing: "easeOut",
        });
        editorStore.select(id, "animated");
        editorStore.setMode("select");
      }
    } else if (asset.type === "cloud") {
      insertCloudAsset(asset as CloudSvgAsset);
    }

    // Update in recent assets list
    setLocalAssets(prev => {
      const filtered = prev.filter(x => x.id !== asset.id && x.name !== asset.name);
      return [
        {
          id: asset.id,
          name: asset.name,
          type: asset.type,
          pathData: asset.pathData,
          svgUrl: asset.svgUrl || (asset.type === "image" ? asset.pathData : undefined),
          svgText: asset.svgText,
          cloudId: asset.cloudId || (asset.type === "cloud" ? asset.id : undefined),
          pendingSave: asset.pendingSave,
        },
      ].slice(0, 12);
    });
  };

  // ── Derived: filtered assets ──────────────────────────────────────────────
  const q = searchQuery.trim().toLowerCase();
  const showSearchResults = q.length > 0 && searchResults.length > 0;

  const isConfigured = isCloudConfigured();

  // ── Shared styles ──────────────────────────────────────────────────────────
  const tabBtn = (active: boolean) => ({
    flex: 1,
    border: "none",
    borderRadius: 6,
    padding: "7px 4px",
    fontSize: 10,
    fontWeight: "600" as const,
    cursor: "pointer",
    background: active ? C.accentDim : "transparent",
    color: active ? C.accent : C.textMuted,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    transition: "all 0.15s",
    letterSpacing: "0.02em",
  });

  const gridCard = {
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.surface,
    cursor: "pointer",
    padding: 6,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    transition: "all 0.15s",
    position: "relative" as const,
    overflow: "hidden",
  };

  const sectionLabel = {
    fontSize: 9,
    fontWeight: "700" as const,
    color: C.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.10em",
    padding: "2px 0",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "Inter, system-ui, sans-serif", boxSizing: "border-box", overflow: "hidden", background: C.bg }}>

      {/* ── Tab Bar ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", background: "rgba(0,0,0,0.25)", borderBottom: `1px solid ${C.border}`, padding: "5px 8px", gap: 4 }}>
        <button style={tabBtn(activeTab === "library")} onClick={() => setActiveTab("library")}>
          <LibraryIcon /> Library
        </button>
        <button style={tabBtn(activeTab === "hands")} onClick={() => setActiveTab("hands")}>
          <HandIcon /> Hands
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ══════════════ LIBRARY TAB ══════════════ */}
        {activeTab === "library" && (
          <>
            {/* ── Quick Canvas Elements ── */}
            <div>
              <span style={{ fontSize: "9px", fontWeight: "bold", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>
                ➕ Add Canvas Elements
              </span>
              <div style={{ display: "flex", gap: "8px", marginBottom: 6 }}>
                {/* Add Text Box */}
                <button
                  onClick={() => {
                    const scene = getInsertScene();
                    if (scene) {
                      const center = getViewportCenter ? getViewportCenter() : { x: 0, y: 0 };
                      const textId = `text-${Date.now()}`;
                      sceneStore.addObject(scene.id, {
                        id: textId,
                        type: "text",
                        x: center.x - 100, y: center.y - 20,
                        content: "Add text here",
                        fontSize: 36,
                        fontFamily: "Outfit",
                        fillColor: "#ffffff",
                        startTime: getLocalTime(),
                        duration: 1.5,
                        animationType: "write",
                      } as any);
                      editorStore.select(textId, "animated");
                      editorStore.setMode("select");
                    }
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    padding: "8px 0",
                    borderRadius: "8px",
                    background: C.accentDim,
                    border: `1px solid ${C.borderHi}`,
                    color: C.text,
                    cursor: "pointer",
                    fontSize: "10px",
                    fontWeight: "bold",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = C.accent;
                    e.currentTarget.style.color = "#000";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = C.accentDim;
                    e.currentTarget.style.color = C.text;
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20V4M18 4H6" />
                  </svg>
                  <span>Text Box</span>
                </button>

                {/* Add Rectangle */}
                <button
                  onClick={() => insertShape("rectangle")}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    padding: "8px 0",
                    borderRadius: "8px",
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    cursor: "pointer",
                    fontSize: "10px",
                    fontWeight: "bold",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = C.accent;
                    e.currentTarget.style.background = C.surfaceHi;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.background = C.surface;
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  </svg>
                  <span>Rect</span>
                </button>

                {/* Add Circle */}
                <button
                  onClick={() => insertShape("circle")}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    padding: "8px 0",
                    borderRadius: "8px",
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    cursor: "pointer",
                    fontSize: "10px",
                    fontWeight: "bold",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = C.accent;
                    e.currentTarget.style.background = C.surfaceHi;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.background = C.surface;
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  <span>Circle</span>
                </button>
              </div>
            </div>

            {/* ── Recent Assets Section (At the top of all assets) ── */}
            {localAssets.length > 0 && (
              <div>
                <span style={sectionLabel}>🕒 Recent Assets</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6 }}>
                  {localAssets.map(asset => {
                    const isImg = asset.type === "image" || !!asset.svgUrl;
                    const hasOutline = !isImg && !!asset.pathData;

                    return (
                      <div
                        key={asset.id}
                        onClick={() => handleSelectAsset(asset)}
                        draggable={true}
                        onDragStart={e => {
                          e.dataTransfer.setData("application/json", JSON.stringify({
                            type: asset.type,
                            name: asset.name,
                            pathData: asset.pathData,
                            svgUrl: asset.svgUrl,
                            svgText: asset.svgText,
                            cloudId: asset.cloudId,
                          }));
                        }}
                        title={asset.name}
                        style={{
                          borderRadius: 8,
                          border: `1px solid ${C.border}`,
                          background: C.surface,
                          cursor: "grab",
                          padding: 6,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                          transition: "all 0.15s ease",
                          position: "relative",
                          overflow: "hidden",
                          height: 72,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = C.accent;
                          e.currentTarget.style.background = C.surfaceHi;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = C.border;
                          e.currentTarget.style.background = C.surface;
                        }}
                      >
                        {/* Visual Preview */}
                        <div style={{ width: "100%", height: 42, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                          {isImg ? (
                            <img src={asset.svgUrl || asset.pathData} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          ) : hasOutline ? (
                            <ShapePreview pathData={asset.pathData!} stroke={C.accent} />
                          ) : (
                            <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700 }}>SVG</span>
                          )}
                        </div>

                        {/* Title Caption */}
                        <div style={{ fontSize: 8, color: C.textMuted, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", textTransform: "capitalize" }}>
                          {asset.name}
                        </div>

                        {/* Database Save Button/Overlay for Local unsaved items */}
                        {asset.pendingSave && !asset.cloudId && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              saveToCloud(asset);
                            }}
                            disabled={savingToCloud === asset.id}
                            title="Save to database"
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              background: C.greenDim,
                              border: `1px solid ${C.green}`,
                              borderRadius: 4,
                              width: 14,
                              height: 14,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: C.green,
                              cursor: "pointer",
                              padding: 0,
                              zIndex: 10,
                            }}
                          >
                            <SaveIcon />
                          </button>
                        )}

                        {/* Saved to Cloud checkmark/icon */}
                        {asset.cloudId && (
                          <div style={{ position: "absolute", top: 4, right: 4, color: C.green, display: "flex", pointerEvents: "none" }}>
                            <CloudIcon />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Vector & Image Import (Drag-and-Drop Dropzone - Always Open/Visible) ── */}
            <div>
              <span style={sectionLabel}>📥 Vector & Image Import</span>
              <div
                ref={dropZoneRef}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                style={{
                  marginTop: 5, borderRadius: 10,
                  border: `2px dashed ${isDragOver ? C.accent : C.border}`,
                  background: isDragOver ? C.accentDim : "rgba(255,255,255,0.02)",
                  padding: "16px 12px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onClick={() => svgFileRef.current?.click()}
              >
                <span style={{ color: isDragOver ? C.accent : C.textMuted, display: "flex" }}><UploadIcon /></span>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>Drop files here</div>
                  <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>SVG vectors or raster images</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); svgFileRef.current?.click(); }} style={{ padding: "4px 10px", borderRadius: 5, fontSize: 9, fontWeight: 600, border: `1px solid ${C.border}`, background: C.surfaceHi, color: C.text, cursor: "pointer" }}>SVG Vector</button>
                  <button onClick={e => { e.stopPropagation(); fileRef.current?.click(); }} style={{ padding: "4px 10px", borderRadius: 5, fontSize: 9, fontWeight: 600, border: `1px solid ${C.border}`, background: C.surfaceHi, color: C.text, cursor: "pointer" }}>Image</button>
                </div>
                <input ref={svgFileRef} type="file" accept=".svg,image/svg+xml" style={{ display: "none" }} onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
              </div>
            </div>

            {/* ── Paste Code / URL / Text Option (Always Open/Visible) ── */}
            <div>
              <button
                onClick={() => setShowPasteBox(o => !o)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`,
                  background: showPasteBox ? C.accentDim : "rgba(255,255,255,0.01)",
                  color: showPasteBox ? C.accent : C.text, cursor: "pointer",
                  fontSize: 10, fontWeight: 600, transition: "all 0.15s",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                  </svg>
                  Paste & Import Anything
                </span>
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  style={{ transform: showPasteBox ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", opacity: 0.6 }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showPasteBox && (
                <div style={{
                  marginTop: 6, display: "flex", flexDirection: "column", gap: 6,
                  padding: 8, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface,
                }}>
                  <textarea
                    placeholder="Paste anything here: raw SVG vector code, image URLs (PNG, JPG, SVG), Base64 data URLs, or plain text to write on screen..."
                    value={pastedSvgCode}
                    onChange={e => setPastedSvgCode(e.target.value)}
                    style={{
                      width: "100%", height: 74, padding: 6, borderRadius: 5, border: `1px solid ${C.border}`,
                      background: C.dimmer, color: C.text, fontSize: 9, fontFamily: "monospace",
                      outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.3,
                    }}
                  />
                  <button
                    disabled={!pastedSvgCode.trim()}
                    onClick={() => {
                      if (!pastedSvgCode.trim()) return;
                      handleUniversalImport(pastedSvgCode);
                      setPastedSvgCode("");
                      setShowPasteBox(false);
                    }}
                    style={{
                      width: "100%", padding: "5px 10px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                      border: "none", background: pastedSvgCode.trim() ? C.accent : C.border,
                      color: pastedSvgCode.trim() ? "#fff" : C.textMuted,
                      cursor: pastedSvgCode.trim() ? "pointer" : "default",
                      transition: "all 0.15s",
                    }}
                  >
                    Import Pasted Asset
                  </button>
                </div>
              )}
            </div>

            {/* ── Online Icon Search (Always Open/Visible) ── */}
            <div>
              <span style={sectionLabel}>🔍 Search Online Icons</span>
              <form onSubmit={handleSearch} style={{ display: "flex", gap: 5, marginTop: 5 }}>
                <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", left: 7, color: C.textMuted, display: "flex" }}>
                    <SearchIcon />
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. coffee, house, user…"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults([]); }}
                    style={{
                      width: "100%", padding: "6px 8px 6px 26px",
                      borderRadius: 6, border: `1px solid ${C.border}`,
                      background: C.dimmer, color: C.text, fontSize: 11,
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
                <button type="submit" disabled={loadingSearch} style={{
                  padding: "0 10px", borderRadius: 6,
                  background: C.accent, color: "#08080a", border: "none",
                  cursor: "pointer", fontSize: 10, fontWeight: "bold",
                  opacity: loadingSearch ? 0.6 : 1,
                }}>
                  {loadingSearch ? "…" : "Go"}
                </button>
              </form>
              {showSearchResults && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginTop: 6 }}>
                  {searchResults.map(icon => {
                    const isImp = importingIcon === icon.rawName;
                    return (
                      <button
                        key={icon.rawName}
                        title={icon.name}
                        onClick={() => selectOnlineIcon(icon)}
                        disabled={!!importingIcon}
                        draggable={true}
                        onDragStart={e => {
                          e.dataTransfer.setData("application/json", JSON.stringify({
                            type: "icon",
                            name: icon.name,
                            svgUrl: icon.url,
                          }));
                        }}
                        style={{ ...gridCard, height: 40, padding: 4, cursor: "grab" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentDim; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.background = C.surface; }}
                      >
                        {isImp
                          ? <span style={{ color: C.accent, fontSize: 11, fontWeight: "bold" }}>↓</span>
                          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><SvgPreview src={icon.url} /></div>
                        }
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Scribe Math Equations (LaTeX to Animating Vector SVG) ── */}
            <div>
              <span style={sectionLabel}>📐 Animating Math Equations</span>
              <div
                style={{
                  marginTop: 5,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <label style={{ fontSize: 9, color: C.textMuted, fontWeight: "bold" }}>TYPE LATEX FORMULA:</label>
                  <input
                    type="text"
                    placeholder="e.g. e^{i\pi} + 1 = 0 or \int_{a}^{b} x^2 dx"
                    value={latexInput}
                    onChange={e => {
                      setLatexInput(e.target.value);
                      setLatexPreviewUrl("");
                    }}
                    style={{
                      width: "100%", padding: "7px 9px",
                      borderRadius: 6, border: `1px solid ${C.border}`,
                      background: C.dimmer, color: C.text, fontSize: 11,
                      outline: "none", boxSizing: "border-box", fontFamily: "monospace",
                    }}
                  />
                </div>

                {/* Formula Quick Presets */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {[
                    { label: "Pythagorean", code: "a^2 + b^2 = c^2" },
                    { label: "Euler", code: "e^{i\\pi} + 1 = 0" },
                    { label: "Relativity", code: "E = mc^2" },
                    { label: "Quadratic", code: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
                    { label: "Integral", code: "\\int x^n dx = \\frac{x^{n+1}}{n+1}" },
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setLatexInput(p.code);
                        setLatexPreviewUrl("");
                      }}
                      style={{
                        padding: "3px 6px", borderRadius: 4, fontSize: 8, fontWeight: 700,
                        background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
                        color: C.textMuted, cursor: "pointer", transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = C.accent; e.currentTarget.style.borderColor = C.borderHi; }}
                      onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Preview & Draw Controls */}
                {latexInput.trim() && (
                  <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                    <button
                      onClick={async () => {
                        const url = `https://math.vercel.app/?from=${encodeURIComponent(latexInput)}&color=white`;
                        setLatexPreviewUrl(url);
                      }}
                      style={{
                        flex: 1, padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                        border: `1px solid ${C.border}`, background: C.surfaceHi, color: C.text, cursor: "pointer",
                      }}
                    >
                      Preview Formula
                    </button>

                    <button
                      onClick={async () => {
                        const formula = latexInput.trim();
                        if (!formula) return;
                        setLoadingFormula(true);
                        try {
                          const url = `https://math.vercel.app/?from=${encodeURIComponent(formula)}&color=black`;
                          const res = await fetch(url);
                          const text = await res.text();
                          
                          // Insert the math formula SVG!
                          parseAndInsertSvgText(text, { pendingSave: true, filename: `Formula: ${formula}` });
                          setLatexInput("");
                          setLatexPreviewUrl("");
                        } catch {
                          alert("Failed to render the math equation. Please check your LaTeX syntax.");
                        } finally {
                          setLoadingFormula(false);
                        }
                      }}
                      disabled={loadingFormula}
                      style={{
                        flex: 1, padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                        border: "none", background: C.accent, color: "#000", cursor: "pointer",
                        opacity: loadingFormula ? 0.6 : 1,
                      }}
                    >
                      {loadingFormula ? "Drawing..." : "Draw Equation"}
                    </button>
                  </div>
                )}

                {/* Math Equation Live Preview Container */}
                {latexPreviewUrl && (
                  <div
                    draggable={true}
                    onDragStart={e => {
                      e.dataTransfer.setData("application/json", JSON.stringify({
                        type: "icon",
                        name: `Math: ${latexInput}`,
                        svgUrl: `https://math.vercel.app/?from=${encodeURIComponent(latexInput)}&color=black`,
                      }));
                    }}
                    title="Drag this formula onto the canvas!"
                    style={{
                      borderRadius: 8, border: `1px solid ${C.border}`,
                      background: "rgba(0,0,0,0.15)", padding: "12px",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      minHeight: 50, cursor: "grab", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                  >
                    <img
                      src={latexPreviewUrl}
                      alt="LaTeX Preview"
                      style={{ maxWidth: "100%", maxHeight: 60, objectFit: "contain" }}
                    />
                    <span style={{ fontSize: 7, color: C.textMuted, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      ↔️ Drag Formula to Canvas
                    </span>
                  </div>
                )}
              </div>
            </div>


            {/* Shapes & DB sections moved to bottom container */}
          </>
        )}

        {/* ══════════════ HANDS TAB ══════════════ */}
        {activeTab === "hands" && (
          <>
            <div style={sectionLabel}>Drawing Hand Styles</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {HAND_STYLES.map(h => {
                const active = currentHand === h.src;
                return (
                  <button
                    key={h.id}
                    onClick={() => onHandChange(h.src)}
                    style={{
                      borderRadius: 10,
                      border: `2px solid ${active ? C.accent : C.border}`,
                      background: active ? C.accentDim : C.surface,
                      cursor: "pointer", padding: 8,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = C.accent; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = C.border; }}
                  >
                    <img src={h.src} alt={h.label} style={{ width: "100%", height: 54, objectFit: "contain", borderRadius: 5, background: "rgba(255,255,255,0.02)" }} />
                    <span style={{ fontSize: 9, color: active ? C.accent : C.text, fontWeight: active ? 700 : 400 }}>{h.label}</span>
                  </button>
                );
              })}
            </div>

            {currentHand && (
              <button
                onClick={() => setIsCalibratorOpen(true)}
                style={{
                  marginTop: 6, padding: "9px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${C.accent}`, background: C.accentDim, color: C.accent,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "background 0.2s, color 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.accentDim; e.currentTarget.style.color = C.accent; }}
              >
                <StylusIcon /> Calibrate Stylus Tip
              </button>
            )}

            <HandCalibrator
              isOpen={isCalibratorOpen}
              onClose={() => setIsCalibratorOpen(false)}
              handSrc={currentHand}
            />
          </>
        )}

      </div>

      {/* ── Docked Bottom Accordion Area (Shapes & DB Libraries with Slide Effect) ── */}
      {activeTab === "library" && (
        <div style={{ borderTop: `1px solid ${C.border}`, background: C.surface, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* ── Shapes Library accordion ── */}
          <div>
            <button
              onClick={() => {
                setShowShapesLibrary(o => !o);
                if (!showShapesLibrary) {
                  setShowDbLibrary(false);
                }
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                border: "none",
                borderBottom: `1px solid ${C.border}`,
                background: showShapesLibrary ? C.accentDim : "transparent",
                color: C.text,
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: "bold",
                transition: "all 0.2s ease-in-out",
                boxSizing: "border-box",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                </svg>
                <span>Shapes Library</span>
              </span>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke={showShapesLibrary ? C.accent : C.textMuted}
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ transform: showShapesLibrary ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <div
              style={{
                maxHeight: showShapesLibrary ? "180px" : "0px",
                opacity: showShapesLibrary ? 1 : 0,
                overflowY: "auto",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
                padding: showShapesLibrary ? "8px" : "0px 8px",
                boxSizing: "border-box",
              }}
            >
              {SHAPE_ENTRIES.map(shape => (
                <div
                  key={shape.id}
                  onClick={() => handleSelectAsset(shape)}
                  draggable={true}
                  onDragStart={e => {
                    e.dataTransfer.setData("application/json", JSON.stringify({
                      type: "shape",
                      name: shape.name,
                      pathData: shape.pathData,
                    }));
                  }}
                  title={shape.name}
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    cursor: "grab",
                    padding: 6,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    transition: "all 0.15s ease",
                    position: "relative",
                    overflow: "hidden",
                    height: 64,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = C.accent;
                    e.currentTarget.style.background = C.surfaceHi;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.background = C.bg;
                  }}
                >
                  <div style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <ShapePreview pathData={shape.pathData} stroke={C.accent} />
                  </div>
                  <div style={{ fontSize: 8, color: C.textMuted, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", textTransform: "capitalize" }}>
                    {shape.name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Saved Cloud Assets Section ── */}
          {cloudAssets.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={() => {
                  setShowDbLibrary(o => !o);
                  if (!showDbLibrary) {
                    setShowShapesLibrary(false);
                  }
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  border: "none",
                  borderBottom: `1px solid ${C.border}`,
                  background: showDbLibrary ? C.accentDim : "transparent",
                  color: C.text,
                  cursor: "pointer",
                  fontSize: "10px",
                  fontWeight: "bold",
                  transition: "all 0.2s ease-in-out",
                  boxSizing: "border-box",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                  </svg>
                  <span>Saved Cloud Assets</span>
                </span>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={showDbLibrary ? C.accent : C.textMuted}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ transform: showDbLibrary ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              <div
                style={{
                  maxHeight: showDbLibrary ? "180px" : "0px",
                  opacity: showDbLibrary ? 1 : 0,
                  overflowY: "auto",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 6,
                  padding: showDbLibrary ? "8px" : "0px 8px",
                  boxSizing: "border-box",
                }}
              >
                {cloudAssets.map(asset => {
                  const isImg = asset.type === "image" || asset.pathData.startsWith("data:image/");
                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleSelectAsset({ ...asset, type: "cloud" })}
                      draggable={true}
                      onDragStart={e => {
                        e.dataTransfer.setData("application/json", JSON.stringify({
                          type: "cloud",
                          name: asset.name,
                          pathData: asset.pathData,
                          subPaths: asset.subPaths,
                          cloudAssetType: asset.type,
                        }));
                      }}
                      title={asset.name}
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: C.bg,
                        cursor: "grab",
                        padding: 6,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        transition: "all 0.15s ease",
                        position: "relative",
                        overflow: "hidden",
                        height: 64,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = C.accent;
                        e.currentTarget.style.background = C.surfaceHi;
                        const trashBtn = e.currentTarget.querySelector(".trash-btn") as HTMLElement;
                        if (trashBtn) trashBtn.style.opacity = "1";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = C.border;
                        e.currentTarget.style.background = C.bg;
                        const trashBtn = e.currentTarget.querySelector(".trash-btn") as HTMLElement;
                        if (trashBtn) trashBtn.style.opacity = "0";
                      }}
                    >
                      <div style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        {isImg ? (
                          <img src={asset.pathData} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        ) : (
                          <ShapePreview pathData={asset.pathData} stroke={C.accent} />
                        )}
                      </div>
                      <div style={{ fontSize: 8, color: C.textMuted, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", textTransform: "capitalize" }}>
                        {asset.name}
                      </div>
                      {(asset.isCustom || !asset.id.startsWith("seeded-")) && (
                        <button
                          className="trash-btn"
                          onClick={e => {
                            e.stopPropagation();
                            deleteCloudAsset(asset.id, asset.name);
                          }}
                          title="Delete from database"
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            background: C.redDim,
                            border: `1px solid ${C.red}`,
                            borderRadius: 4,
                            width: 14,
                            height: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: C.red,
                            cursor: "pointer",
                            padding: 0,
                            zIndex: 10,
                            opacity: 0,
                            transition: "opacity 0.15s ease",
                          }}
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
