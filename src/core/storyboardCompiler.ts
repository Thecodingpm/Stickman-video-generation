/**
 * Storyboard compiler & layout engine.
 * Converts high-level AI Director JSON storyboards into concrete,
 * fully styled whiteboard scenes, coordinates, and sequential timings.
 */

import { SVG_SHAPES } from "./svgShapes";
import type { AnimatedObject, CameraKeyframe } from "./timeline";
import type { SvgPathObject } from "./svgPath";

// ── Types for high-level storyboard JSON ──────────────────────────────────────

export interface DirectorVisual {
  type: "text" | "diagram" | "icon" | "object";
  content: string;
  animation: "fade_in" | "write_on" | "draw" | "appear" | "highlight";
  emphasis: "low" | "medium" | "high";
  customSvg?: string;
}

export interface DirectorScene {
  scene_id: number;
  narration: string;
  key_idea: string;
  visuals: DirectorVisual[];
  camera: "zoom_in" | "zoom_out" | "pan_center" | "static";
  duration: "short" | "medium" | "long";
  notes?: string;
}

export interface DirectorStoryboard {
  video_title: string;
  scenes: DirectorScene[];
}

// ── Theme Palettes ────────────────────────────────────────────────────────────

export interface ColorPalette {
  primaryText: string;
  accent: string;
  accentSecondary: string;
  boxBg: string;
  lineWidth: number;
}

export const THEME_PALETTES: Record<string, ColorPalette> = {
  techIndigo: {
    primaryText: "#1e293b",
    accent: "#4f46e5", // Indigo
    accentSecondary: "#2563eb", // Blue
    boxBg: "rgba(99, 102, 241, 0.05)",
    lineWidth: 3,
  },
  forestGreen: {
    primaryText: "#0f2f1d",
    accent: "#15803d", // Emerald Green
    accentSecondary: "#047857", // Teal
    boxBg: "rgba(16, 185, 129, 0.05)",
    lineWidth: 3,
  },
  sunsetOrange: {
    primaryText: "#2d1500",
    accent: "#ea580c", // Orange
    accentSecondary: "#db2777", // Pink
    boxBg: "rgba(249, 115, 22, 0.05)",
    lineWidth: 3,
  },
  minimalCharcoal: {
    primaryText: "#0f172a",
    accent: "#334155", // Slate
    accentSecondary: "#020617", // Dark Slate
    boxBg: "rgba(100, 116, 139, 0.05)",
    lineWidth: 2,
  },
};

// Helper to look up SVG shapes by keyword matching
function getMatchingSvgPath(keyword: string): string {
  const norm = keyword.toLowerCase();
  
  // Custom premium whiteboard assets
  if (norm.includes("brain") || norm.includes("mind") || norm.includes("intelligence") || norm.includes("cortex")) return SVG_SHAPES.aiBrain;
  if (norm.includes("neural") || norm.includes("nodes") || norm.includes("network") || norm.includes("connection")) return SVG_SHAPES.neuralNetwork;
  if (norm.includes("learning") || norm.includes("data") || norm.includes("database") || norm.includes("server") || norm.includes("model")) return SVG_SHAPES.machineLearning;
  if (norm.includes("robot") || norm.includes("bot") || norm.includes("assistant")) return SVG_SHAPES.robot;

  if (norm.includes("star") || norm.includes("favorite")) return SVG_SHAPES.star;
  if (norm.includes("check") || norm.includes("success") || norm.includes("done")) return SVG_SHAPES.checkmark;
  if (norm.includes("arrow")) return SVG_SHAPES.arrowRight;
  if (norm.includes("light") || norm.includes("idea") || norm.includes("bulb") || norm.includes("thought")) return SVG_SHAPES.lightBulb;
  if (norm.includes("speech") || norm.includes("chat") || norm.includes("message") || norm.includes("talk")) return SVG_SHAPES.speechBubble;
  if (norm.includes("cloud") || norm.includes("weather")) return SVG_SHAPES.cloud;
  if (norm.includes("user") || norm.includes("person") || norm.includes("people")) return SVG_SHAPES.character;
  if (norm.includes("setting") || norm.includes("gear") || norm.includes("cog")) return SVG_SHAPES.gear;
  if (norm.includes("rocket") || norm.includes("launch") || norm.includes("start")) return SVG_SHAPES.rocket;
  if (norm.includes("cup") || norm.includes("trophy") || norm.includes("win") || norm.includes("award")) return SVG_SHAPES.trophy;
  if (norm.includes("world") || norm.includes("globe") || norm.includes("earth") || norm.includes("global")) return SVG_SHAPES.globe;
  if (norm.includes("computer") || norm.includes("laptop") || norm.includes("screen")) return SVG_SHAPES.laptop;
  if (norm.includes("chart") || norm.includes("graph") || norm.includes("analytics")) return SVG_SHAPES.analytics;

  // Defaults based on shape tags
  if (norm.includes("circle")) return SVG_SHAPES.circle;
  if (norm.includes("triangle")) return SVG_SHAPES.triangle;
  
  // Ultimate default: a beautiful lightbulb icon represent whiteboard ideas
  return SVG_SHAPES.lightBulb;
}

// ── Storyboard Layout Hydration ────────────────────────────────────────────────

export function compileStoryboardToProject(
  storyboard: DirectorStoryboard,
  paletteName: string = "techIndigo"
): string {
  const palette = THEME_PALETTES[paletteName] || THEME_PALETTES.techIndigo;
  const projectScenes = storyboard.scenes.map((scene, sceneIdx) => {
    // 1. Scene settings
    const sceneId = `scene-gen-${scene.scene_id || sceneIdx + 1}`;
    const sceneName = scene.key_idea || `Scene ${scene.scene_id}`;
    
    // Map timing defaults
    let duration = 8.0; // medium default
    if (scene.duration === "short") duration = 5.0;
    if (scene.duration === "long") duration = 12.0;

    const objects: AnimatedObject[] = [];
    const svgObjects: SvgPathObject[] = [];

    // 2. Add Scene Title at the top center
    const titleId = `obj-title-${sceneId}`;
    objects.push({
      id: titleId,
      type: "text",
      x: -240,
      y: -160,
      content: sceneName,
      fontSize: 24,
      fontFamily: "serif",
      fillColor: palette.primaryText,
      startTime: 0.5,
      duration: 1.5,
      animationType: "draw",
      easing: "easeOut",
    });

    // 3. Spatially position visuals in a clean grid/flow layout
    const visuals = scene.visuals || [];
    const N = visuals.length;

    // Timeline cursor timing setup
    let timeCursor = 2.0;
    const timeStep = Math.max(1.0, (duration - 3.0) / Math.max(1, N));

    // Handle single or zero visual cases gracefully
    if (N === 0) {
      // Just keep empty objects
    } else if (N === 1) {
      // Single central visual placement
      const vis = visuals[0];
      hydrateSingleVisual(vis, 0, 0, timeCursor, timeStep, objects, svgObjects, palette, sceneId);
    } else if (N === 2) {
      // Flow layout side-by-side
      hydrateSingleVisual(visuals[0], -150, -20, timeCursor, timeStep, objects, svgObjects, palette, sceneId + "-l");
      // Connecting arrow in middle
      svgObjects.push({
        id: `arrow-connect-${sceneId}`,
        pathData: SVG_SHAPES.arrowRight,
        x: -40,
        y: -40,
        scaleX: 1.5,
        scaleY: 1.5,
        strokeColor: palette.accent,
        strokeWidth: 3,
        startTime: timeCursor + timeStep * 0.6,
        duration: 0.8,
      });
      hydrateSingleVisual(visuals[1], 110, -20, timeCursor + timeStep * 0.8, timeStep, objects, svgObjects, palette, sceneId + "-r");
    } else {
      // 3 or more visuals -> Arrange in horizontal/grid flow layout
      const startX = -200;
      const xSpacing = Math.min(220, 440 / (N - 1));
      
      visuals.forEach((vis, idx) => {
        const x = startX + idx * xSpacing;
        // Alternate y positions slightly for a clean casual whiteboard feel
        const y = -10 + (idx % 2 === 0 ? 0 : 25);
        hydrateSingleVisual(vis, x, y, timeCursor, timeStep, objects, svgObjects, palette, `${sceneId}-${idx}`);
        
        // Draw connecting arrow to next step if sequential
        if (idx < N - 1) {
          svgObjects.push({
            id: `arrow-step-${sceneId}-${idx}`,
            pathData: SVG_SHAPES.arrowRight,
            x: x + 60,
            y: -10,
            scaleX: 0.8,
            scaleY: 0.8,
            strokeColor: palette.accentSecondary,
            strokeWidth: 2,
            startTime: timeCursor + timeStep * 0.7,
            duration: 0.5,
          });
        }
        
        timeCursor += timeStep;
      });
    }

    // 4. Map camera keyframes
    let cameraKeyframes: CameraKeyframe[] = [{ time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" }];
    if (scene.camera === "zoom_in") {
      cameraKeyframes = [
        { time: 0, x: 0, y: 0, zoom: 1.0, easing: "easeInOut" },
        { time: duration * 0.5, x: 0, y: 0, zoom: 1.2, easing: "easeInOut" },
      ];
    } else if (scene.camera === "zoom_out") {
      cameraKeyframes = [
        { time: 0, x: 0, y: 0, zoom: 1.15, easing: "easeInOut" },
        { time: duration * 0.6, x: 0, y: 0, zoom: 0.95, easing: "easeInOut" },
      ];
    } else if (scene.camera === "pan_center") {
      cameraKeyframes = [
        { time: 0, x: -60, y: 0, zoom: 1.0, easing: "easeInOut" },
        { time: duration * 0.8, x: 60, y: 0, zoom: 1.0, easing: "easeInOut" },
      ];
    }

    return {
      id: sceneId,
      name: sceneName,
      duration,
      startTime: 0, // rebuilt by sceneStore
      objects,
      svgObjects,
      cameraKeyframes,
    };
  });

  const projectData = {
    version: 1,
    savedAt: new Date().toISOString(),
    scenes: projectScenes,
  };

  return JSON.stringify(projectData, null, 2);
}

// ── Visual block generators ────────────────────────────────────────────────────

function hydrateSingleVisual(
  vis: DirectorVisual,
  x: number,
  y: number,
  startTime: number,
  maxDuration: number,
  objects: AnimatedObject[],
  svgObjects: SvgPathObject[],
  palette: ColorPalette,
  idSuffix: string
) {
  const drawDuration = Math.max(0.8, maxDuration * 0.8);
  const animType = vis.animation === "fade_in" ? "fade" as any : "draw";

  switch (vis.type) {
    case "text":
      objects.push({
        id: `text-${idSuffix}`,
        type: "text",
        x: x - 40,
        y: y,
        content: vis.content,
        fontSize: vis.emphasis === "high" ? 20 : 16,
        fontFamily: "sans-serif",
        fillColor: vis.emphasis === "high" ? palette.accent : palette.primaryText,
        startTime,
        duration: drawDuration,
        animationType: animType,
        easing: "easeOut",
      });
      break;

    case "icon":
      // Generate a beautiful SVG illustration matched from content description or custom AI drawings
      const pathData = vis.customSvg || getMatchingSvgPath(vis.content || "");
      svgObjects.push({
        id: `svg-icon-${idSuffix}`,
        pathData,
        x: x - 35,
        y: y - 40,
        scaleX: 1.25,
        scaleY: 1.25,
        strokeColor: vis.emphasis === "high" ? palette.accent : palette.accentSecondary,
        strokeWidth: palette.lineWidth,
        startTime,
        duration: drawDuration,
      });
      
      // Accompanying label text below icon
      objects.push({
        id: `text-lbl-${idSuffix}`,
        type: "text",
        x: x - 45,
        y: y + 35,
        content: vis.content.split(" ").slice(0, 2).join(" "), // first 2 words
        fontSize: 12,
        fontFamily: "monospace",
        fillColor: palette.primaryText,
        startTime: startTime + drawDuration * 0.4,
        duration: drawDuration * 0.6,
        animationType: "draw",
        easing: "easeOut",
      });
      break;

    case "diagram":
      if (vis.customSvg) {
        // Draw custom single-stroke diagram drawn by AI
        svgObjects.push({
          id: `svg-diag-${idSuffix}`,
          pathData: vis.customSvg,
          x: x - 35,
          y: y - 40,
          scaleX: 1.25,
          scaleY: 1.25,
          strokeColor: palette.accent,
          strokeWidth: palette.lineWidth,
          startTime,
          duration: drawDuration,
        });
      } else {
        // Draw a neat diagram layout: box outline with central label
        objects.push({
          id: `rect-diag-${idSuffix}`,
          type: "rect",
          x: x - 55,
          y: y - 35,
          width: 110,
          height: 70,
          fillColor: "transparent",
          strokeColor: palette.accent,
          lineWidth: palette.lineWidth,
          startTime,
          duration: drawDuration * 0.6,
          animationType: "draw",
          easing: "easeOut",
        });
      }
      objects.push({
        id: `text-diag-lbl-${idSuffix}`,
        type: "text",
        x: x - 40,
        y: y - 10,
        content: vis.content,
        fontSize: 13,
        fontFamily: "sans-serif",
        fillColor: palette.primaryText,
        startTime: startTime + drawDuration * 0.4,
        duration: drawDuration * 0.6,
        animationType: "draw",
        easing: "easeOut",
      });
      break;

    case "object":
    default:
      // Standard shape or object (circle / card rect)
      const isHigh = vis.emphasis === "high";
      objects.push({
        id: `obj-shape-${idSuffix}`,
        type: isHigh ? "circle" : "rect",
        x: x - 35,
        y: y - 35,
        radius: isHigh ? 35 : undefined,
        width: isHigh ? undefined : 70,
        height: isHigh ? undefined : 70,
        fillColor: palette.boxBg,
        strokeColor: palette.accentSecondary,
        lineWidth: palette.lineWidth - 1,
        startTime,
        duration: drawDuration * 0.7,
        animationType: "draw",
        easing: "spring",
      });
      objects.push({
        id: `text-obj-lbl-${idSuffix}`,
        type: "text",
        x: x - 30,
        y: y - 10,
        content: vis.content,
        fontSize: 12,
        fontFamily: "sans-serif",
        fillColor: palette.primaryText,
        startTime: startTime + drawDuration * 0.5,
        duration: drawDuration * 0.5,
        animationType: "draw",
        easing: "easeOut",
      });
      break;
  }
}
