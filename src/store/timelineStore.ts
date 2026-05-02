import type { AnimatedObject, CameraKeyframe, TimelineState } from "../core/timeline";
import type { SvgPathObject } from "../core/svgPath";
import { SvgEasing } from "../core/svgPath";
import { SVG_SHAPES } from "../core/svgShapes";

// ── Animated world objects (non-SVG) ─────────────────────────────────────────

const DEMO_OBJECTS: AnimatedObject[] = [
  {
    id: "title", type: "text",
    x: -220, y: -220,
    content: "SVG Draw Animation",
    fontSize: 28, fontFamily: "Georgia, serif",
    fillColor: "#1e293b",
    startTime: 0, duration: 1,
    animationType: "fade", easing: "easeOut",
  },
  {
    id: "sub", type: "text",
    x: -160, y: -180,
    content: "Watch shapes draw themselves",
    fontSize: 14, fontFamily: "monospace",
    fillColor: "#64748b",
    startTime: 0.5, duration: 0.8,
    animationType: "fade", easing: "easeOut",
  },
];

// ── SVG path objects ──────────────────────────────────────────────────────────

export const DEMO_SVG_OBJECTS: SvgPathObject[] = [
  // 1. Speech bubble — draws first, top-left
  {
    id: "speech",
    pathData: SVG_SHAPES.speechBubble,
    x: -320, y: -120,
    scaleX: 1.8, scaleY: 1.8,
    strokeColor: "#6366f1",
    strokeWidth: 3,
    fillColor: "rgba(99,102,241,0.08)",
    startTime: 1.0,
    duration: 1.8,
    easing: SvgEasing.easeInOut,
  },
  // 2. Star — center stage
  {
    id: "star",
    pathData: SVG_SHAPES.star,
    x: -60, y: -100,
    scaleX: 1.4, scaleY: 1.4,
    strokeColor: "#f59e0b",
    strokeWidth: 3,
    fillColor: "rgba(245,158,11,0.1)",
    startTime: 1.6,
    duration: 1.4,
    easing: SvgEasing.easeInOut,
  },
  // 3. Circle — right side
  {
    id: "circle",
    pathData: SVG_SHAPES.circle,
    x: 120, y: -110,
    scaleX: 1.6, scaleY: 1.6,
    strokeColor: "#10b981",
    strokeWidth: 3,
    fillColor: "rgba(16,185,129,0.08)",
    startTime: 2.2,
    duration: 1.2,
    easing: SvgEasing.easeInOut,
  },
  // 4. Arrow pointing right — below center
  {
    id: "arrow",
    pathData: SVG_SHAPES.arrowRight,
    x: -200, y: 80,
    scaleX: 2.2, scaleY: 2.2,
    strokeColor: "#ec4899",
    strokeWidth: 4,
    startTime: 3.0,
    duration: 0.9,
    easing: SvgEasing.easeOut,
  },
  // 5. Light bulb
  {
    id: "bulb",
    pathData: SVG_SHAPES.lightBulb,
    x: 60, y: 50,
    scaleX: 1.6, scaleY: 1.6,
    strokeColor: "#f59e0b",
    strokeWidth: 2.5,
    fillColor: "rgba(245,158,11,0.06)",
    startTime: 3.6,
    duration: 1.4,
    easing: SvgEasing.easeInOut,
  },
  // 6. Triangle
  {
    id: "triangle",
    pathData: SVG_SHAPES.triangle,
    x: 200, y: 40,
    scaleX: 1.4, scaleY: 1.4,
    strokeColor: "#8b5cf6",
    strokeWidth: 3,
    fillColor: "rgba(139,92,246,0.08)",
    startTime: 4.2,
    duration: 1.0,
    easing: SvgEasing.easeInOut,
  },
  // 7. Checkmark — final flourish
  {
    id: "check",
    pathData: SVG_SHAPES.checkmark,
    x: 300, y: 60,
    scaleX: 2, scaleY: 2,
    strokeColor: "#10b981",
    strokeWidth: 5,
    startTime: 5.0,
    duration: 0.8,
    easing: SvgEasing.easeOut,
  },
];

// ── Camera keyframes ──────────────────────────────────────────────────────────

const DEMO_KEYFRAMES: CameraKeyframe[] = [
  { time: 0, x: -80, y: -60, zoom: 0.9, easing: "linear" },
  { time: 2, x: 0, y: -30, zoom: 1.0, easing: "easeInOut" },
  { time: 3.5, x: -60, y: 60, zoom: 1.1, easing: "easeInOut" },
  { time: 5, x: 100, y: 50, zoom: 1.0, easing: "easeInOut" },
  { time: 6.5, x: 0, y: 0, zoom: 0.85, easing: "easeInOut" },
];

const TOTAL_DURATION = 7;

// ── Store ─────────────────────────────────────────────────────────────────────

function createTimelineStore() {
  const state: TimelineState & { svgObjects: SvgPathObject[] } = {
    currentTime: 0,
    totalDuration: TOTAL_DURATION,
    isPlaying: false,
    objects: DEMO_OBJECTS,
    cameraKeyframes: DEMO_KEYFRAMES,
    svgObjects: DEMO_SVG_OBJECTS,
  };

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(fn => fn());

  return {
    subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
    getState: () => state,
    play: () => { if (state.currentTime >= state.totalDuration) state.currentTime = 0; state.isPlaying = true; notify(); },
    pause: () => { state.isPlaying = false; notify(); },
    reset: () => { state.isPlaying = false; state.currentTime = 0; notify(); },
    seek: (t: number) => { state.currentTime = Math.min(state.totalDuration, Math.max(0, t)); notify(); },
    tick: (dt: number) => {
      if (!state.isPlaying) return;
      state.currentTime = Math.min(state.totalDuration, state.currentTime + dt);
      if (state.currentTime >= state.totalDuration) state.isPlaying = false;
      notify();
    },
  };
}

export const timelineStore = createTimelineStore();
export type TimelineStore = ReturnType<typeof createTimelineStore>;