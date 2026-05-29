import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import * as projectStore from "./projectStore";
import { SVG_SHAPES } from "../src/core/svgShapes";
import * as tts from "./tts";
import * as visualDirector from "./visualDirector";
import * as longformPlanner from "./longformPlanner";
import * as chunkRenderer from "./chunkRenderer";
import { validateProject, autoFixProject, validateAndFixProject } from "./qualityValidator";
import { refineSvgWithAi } from "./aiSvgRefiner";

// ── Utility: Map keywords to SVG shape names ────────────────────────────────
function getShapeFromKeywords(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("sun") || lower.includes("light") || lower.includes("energy")) return "lightBulb";
  if (lower.includes("water") || lower.includes("rain") || lower.includes("hydro")) return "waterDrop";
  if (lower.includes("plant") || lower.includes("leaf") || lower.includes("tree")) return "leaf";
  if (lower.includes("code") || lower.includes("software") || lower.includes("dev")) return "laptop";
  if (lower.includes("money") || lower.includes("finance") || lower.includes("dollar")) return "dollar";
  if (lower.includes("health") || lower.includes("medical") || lower.includes("heart")) return "heart";
  if (lower.includes("science") || lower.includes("lab") || lower.includes("research")) return "flask";
  if (lower.includes("music") || lower.includes("sound") || lower.includes("audio")) return "musicNote";
  if (lower.includes("data") || lower.includes("chart") || lower.includes("graph")) return "analytics";
  if (lower.includes("rocket") || lower.includes("launch") || lower.includes("start")) return "rocket";
  if (lower.includes("gear") || lower.includes("engine") || lower.includes("machine")) return "gear";
  return "lightBulb";
}


const server = new Server(
  {
    name: "scribeflow-whiteboard-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── Register MCP Tools ────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_whiteboard_project",
        description: "Creates a new empty whiteboard storyboard project with a starting scene.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "The title of the whiteboard project" },
            width: { type: "number", description: "Visual canvas width (default: 1920)" },
            height: { type: "number", description: "Visual canvas height (default: 1080)" },
            fps: { type: "number", description: "Target frame rate (default: 30)" },
            background: { type: "string", description: "Standard hex code or rgba background color" }
          },
          required: ["title"]
        }
      },
      {
        name: "add_whiteboard_scene",
        description: "Adds a new sequence scene segment to the whiteboard project.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The alphanumeric ID of the target project" },
            sceneName: { type: "string", description: "Descriptive name for the scene" },
            duration: { type: "number", description: "Initial scene duration in seconds" },
            background: { type: "string", description: "Optional background color override for this scene" }
          },
          required: ["projectId", "sceneName", "duration"]
        }
      },
      {
        name: "add_canvas_element",
        description: "Places a drawing element (text, rect, circle, image, or custom svg path) onto a specific scene with beautiful, default animations.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The target project ID" },
            sceneId: { type: "string", description: "The scene ID inside the project" },
            elementType: {
              type: "string",
              enum: ["text", "rect", "circle", "image", "svg"],
              description: "The visual type of element to draw"
            },
            properties: {
              type: "object",
              description: "Geometric, timing, and styling parameters for the element (e.g. content, x, y, scaleX, strokeColor, startTime, duration)"
            }
          },
          required: ["projectId", "sceneId", "elementType", "properties"]
        }
      },
      {
        name: "add_camera_movement",
        description: "Configures or overrides camera coordinate panning and zoom focal keys on a scene.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The project ID" },
            sceneId: { type: "string", description: "The target scene ID" },
            time: { type: "number", description: "Local scene timestamp in seconds for the keyframe" },
            x: { type: "number", description: "Camera focus X center offset" },
            y: { type: "number", description: "Camera focus Y center offset" },
            zoom: { type: "number", description: "Visual zoom multiplier (e.g. 1.0, 1.25)" },
            easing: {
              type: "string",
              enum: ["linear", "easeIn", "easeOut", "easeInOut", "spring"],
              description: "Transition camera interpolation function (default: linear)"
            }
          },
          required: ["projectId", "sceneId", "time", "x", "y", "zoom"]
        }
      },
      {
        name: "add_audio_track",
        description: "Adds a background soundtrack or precise localized speech voiceover file to the project timeline.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The project ID" },
            type: {
              type: "string",
              enum: ["voiceover", "background"],
              description: "Audio classification"
            },
            src: { type: "string", description: "Blob URL or local file resource path" },
            startTime: { type: "number", description: "Global timeline start offset in seconds" },
            duration: { type: "number", description: "Length of audio in seconds" },
            volume: { type: "number", description: "Volume amplification (0.0 to 1.0, default: 1.0)" }
          },
          required: ["projectId", "type", "src", "startTime", "duration"]
        }
      },
      {
        name: "add_subtitles",
        description: "Configures full subtitle cue logs onto the whiteboard storyboard.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The target project ID" },
            subtitles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  startTime: { type: "number", description: "Timeline start in seconds" },
                  endTime: { type: "number", description: "Timeline end in seconds" },
                  text: { type: "string", description: "Subtitle caption text" }
                },
                required: ["startTime", "endTime", "text"]
              },
              description: "List of chronologically ordered subtitles"
            }
          },
          required: ["projectId", "subtitles"]
        }
      },
      {
        name: "get_whiteboard_project",
        description: "Retrieves the full structural project configuration JSON state from disk.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The project ID to load" }
          },
          required: ["projectId"]
        }
      },
      {
        name: "list_whiteboard_projects",
        description: "Lists all locally saved whiteboard project storyboards.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "export_whiteboard_video",
        description: "Headlessly renders the whiteboard project into a broadcast-quality MP4 movie.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The project ID to render" },
            fps: { type: "number", description: "Target export frame rate (default: 30)" },
            format: { type: "string", enum: ["mp4"], description: "Export media format (default: mp4)" },
            outputName: { type: "string", description: "Custom filename for the rendered video (default: output.mp4)" },
            chunked: { type: "boolean", description: "If true, renders scenes/chunks separately and stitches them (recommended for >5m videos)" },
            maxChunkDurationSeconds: { type: "number", description: "Max duration of each chunk in seconds (default: 90)" },
            concurrency: { type: "number", description: "Number of concurrent chunk render jobs (Min: 1, Max: 4, Default: 2)" }
          },
          required: ["projectId"]
        }
      },
      {
        name: "create_whiteboard_video_from_outline",
        description: "High-level visual compiler tool that creates a full storyboard whiteboard project from a structured outline, layouts elements, sequences animations, and headlessly renders an MP4 video.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "The title of the whiteboard video project" },
            width: { type: "number", description: "Visual canvas width (default: 1920)" },
            height: { type: "number", description: "Visual canvas height (default: 1080)" },
            fps: { type: "number", description: "Target video frame rate (default: 30)" },
            autoExport: { type: "boolean", description: "If true, headlessly renders the finalized video immediately" },
            voiceover: { type: "boolean", description: "Optionally generate offline narration audio tracks using macOS say (default: false)" },
            subtitles: { type: "boolean", description: "Optionally generate flat visual subtitles cues timeline overlays (default: false)" },
            voice: { type: "string", description: "Optionally choose a macOS TTS voice name (e.g. Daniel, Samantha)" },
            outline: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sceneName: { type: "string", description: "The descriptive sequence name for this scene" },
                  narration: { type: "string", description: "The voiceover narrator speech text for this scene segment (optional)" },
                  duration: { type: "number", description: "Explicit scene duration in seconds (optional)" },
                  visuals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          enum: ["title", "text", "shape", "arrow", "callout"],
                          description: "Visual drawing or label element type to render"
                        },
                        text: { type: "string", description: "Required if type is 'title', 'text', or 'callout': typographic text content" },
                        shapeName: { type: "string", description: "Required if type is 'shape': the name of the vector shape (e.g. circle, star, checkmark, arrowRight, lightBulb, character, gear, rocket, laptop, analytics)" },
                        emphasis: {
                          type: "string",
                          enum: ["normal", "important", "subtle"],
                          description: "Styling priority determining scaling, outlines, and colors (default: normal)"
                        }
                      },
                      required: ["type"]
                    },
                    description: "Visual elements appearing sequentially inside the scene"
                  },
                  cameraIntent: {
                    type: "string",
                    enum: ["static", "zoom_in", "zoom_out", "pan_center"],
                    description: "Transition camera interpolation behavior (default: static)"
                  }
                },
                required: ["sceneName", "visuals"]
              },
              description: "List of scenes forming the storyboard script"
            }
          },
          required: ["title", "outline"]
        }
      },
      {
        name: "create_whiteboard_video_from_prompt",
        description: "Generates a complete multi-scene whiteboard project and exports it as an MP4 video from a high-level natural language prompt topic.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The natural language topic or description of the video to create" },
            title: { type: "string", description: "Optional title for the project (derived from prompt if missing)" },
            durationSeconds: { type: "number", description: "Optional target duration in seconds for the entire video" },
            sceneCount: { type: "number", description: "Optional specific number of scenes to generate" },
            width: { type: "number", description: "Visual canvas width (default: 1920)" },
            height: { type: "number", description: "Visual canvas height (default: 1080)" },
            fps: { type: "number", description: "Target video frame rate (default: 30)" },
            autoExport: { type: "boolean", description: "If true, headlessly renders the finalized video immediately" },
            style: {
              type: "string",
              enum: ["educational", "business", "story", "tutorial"],
              description: "Narrative scripting theme style"
            },
            voiceover: { type: "boolean", description: "Optionally generate offline narration audio tracks using macOS say (default: false)" },
            subtitles: { type: "boolean", description: "Optionally generate flat visual subtitles cues timeline overlays (default: false)" },
            voice: { type: "string", description: "Optionally choose a macOS TTS voice name (e.g. Daniel, Samantha)" },
            narrationStyle: {
              type: "string",
              enum: ["simple", "teacher", "professional"],
              description: "Narrative speech pacing style (default: simple)"
            }
          },
          required: ["prompt"]
        }
      },
      {
        name: "create_longform_whiteboard_video",
        description: "Creates a structured long-form whiteboard video project with multiple chapters and scenes, distributing target durations mathematically, synthesizing narration voiceovers and subtitle tracks, and exporting standard H.264 MP4 videos.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The natural language educational masterclass topic or prompt" },
            targetDurationMinutes: { type: "number", description: "The target duration of the video in minutes (e.g. 5, 10, 15)" },
            quality: {
              type: "string",
              enum: ["draft", "standard", "premium"],
              description: "Optional visual assets and templates fidelity level (default: standard)"
            },
            voiceover: { type: "boolean", description: "Optionally generate offline narration audio tracks using macOS say (default: false)" },
            subtitles: { type: "boolean", description: "Optionally generate flat visual subtitles cues timeline overlays (default: false)" },
            autoExport: { type: "boolean", description: "If true, headlessly renders the finalized video immediately if it is <= 5 minutes (default: false)" },
            width: { type: "number", description: "Visual canvas width (default: 1920)" },
            height: { type: "number", description: "Visual canvas height (default: 1080)" },
            fps: { type: "number", description: "Target video frame rate (default: 30)" }
          },
          required: ["prompt", "targetDurationMinutes"]
        }
      },
      {
        name: "validate_whiteboard_project",
        description: "Validates a whiteboard project for quality, consistency, and render-readiness. Returns warnings/errors and a summary.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The project ID to validate" }
          },
          required: ["projectId"]
        }
      },
      {
        name: "auto_fix_whiteboard_project",
        description: "Automatically repairs known quality issues in a whiteboard project (missing IDs, empty texts, invalid timings, SVG defaults, easing fallbacks). Returns the fixed project and list of repairs applied.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The project ID to auto-fix" }
          },
          required: ["projectId"]
        }
      },
      {
        name: "refine_svg_with_ai",
        description: "Optimizes and refines a solid-filled or complex outline SVG path into a beautifully draw-ready, single-stroke centerline sequence using Gemini.",
        inputSchema: {
          type: "object",
          properties: {
            rawSvg: { type: "string", description: "The raw, solid-filled, or outline-based SVG markup to refine" },
            apiKey: { type: "string", description: "Optional Gemini API Key override. Falls back to process.env.GEMINI_API_KEY if not provided." }
          },
          required: ["rawSvg"]
        }
      }
    ]
  };
});

// ── Unified Visual Layout Compiler with Smart Visual Director & TTS ──────────
const PALETTE = {
  background: "#f8fafc",
  text: "#1e293b",
  accent: "#6366f1",
  warning: "#f59e0b",
  success: "#10b981",
  line: "#334155"
};

export async function compileProjectFromOutline(params: {
  title: string;
  outline: any[];
  width?: number;
  height?: number;
  fps?: number;
  voiceover?: boolean;
  subtitles?: boolean;
  voice?: string;
  narrationStyle?: "simple" | "teacher" | "professional";
}) {
  const {
    title,
    outline,
    width = 1920,
    height = 1080,
    fps = 30,
    voiceover = false,
    subtitles = false,
    voice,
    narrationStyle = "simple"
  } = params;

  // 1. Create project
  const { projectId, projectPath } = projectStore.createProject({ title, width, height, fps });
  const project = projectStore.getProject(projectId);

  // Clear starter scene and initialize arrays
  project.scenes = [];
  project.audioTracks = [];
  project.subtitles = [];

  let globalSceneStartTime = 0;

  // 2. Loop through outline scenes
  for (let sIdx = 0; sIdx < outline.length; sIdx++) {
    const item = outline[sIdx];
    const sceneName = item.sceneName || `Scene ${sIdx + 1}`;
    
    // Auto-generate narration if missing
    let narration = item.narration || "";
    if (!narration) {
      const mainVisual = (item.visuals || []).find((v: any) => v && v.text)?.text || "";
      narration = `${sceneName}. ${mainVisual ? `Let's discuss ${mainVisual}.` : "We will explain this key concept step by step."}`;
    }

    // A. Visual Director Planning
    const visualPlan = visualDirector.planSceneVisuals(
      sceneName,
      narration,
      sIdx,
      outline.length,
      item.visuals || []
    );

    const { template, visuals, cameraIntent } = visualPlan;

    // B. Validation Check: Scene must have at least 2 visuals unless it is intro/outro
    if (sIdx > 0 && sIdx < outline.length - 1 && visuals.length < 2) {
      visuals.push({
        type: "text",
        text: "Key supporting detail",
        semanticRole: "supporting_detail",
        animation: "fade",
        emphasis: "normal",
        startTimeOffset: 1.9
      });
      visuals.push({
        type: "shape",
        shapeName: "gear",
        semanticRole: "decoration",
        animation: "static",
        emphasis: "subtle",
        startTimeOffset: 2.2
      });
    }

    // C. Voiceover Synthesis or Pacing Estimation
    let voiceoverDuration = 0;

    if (voiceover && tts.isMacSayAvailable()) {
      const audioDir = path.resolve(process.cwd(), "renders", projectId, "audio");
      fs.mkdirSync(audioDir, { recursive: true });
      const audioFile = path.join(audioDir, `scene-${sIdx + 1}.mp3`);

      try {
        console.error(`[Director] Synthesizing TTS narration for scene ${sIdx + 1}: "${narration.substring(0, 30)}..."`);
        const ttsResult = await tts.synthesizeWithMacSay(narration, audioFile, voice);
        voiceoverDuration = ttsResult.duration;
      } catch (err: any) {
        console.error(`[Director] Voiceover synthesis failed: ${err.message}. Gracefully falling back to estimation.`);
      }
    }

    const estimatedDuration = tts.estimateNarrationDuration(narration);
    
    // Set actual duration: max of voiceover duration + 1.0 (for padding) or explicit/estimated pacing
    const explicitDuration = item.duration;
    let sceneDuration = Math.max(6.0, estimatedDuration);
    if (voiceoverDuration > 0) {
      sceneDuration = Math.max(6.0, voiceoverDuration + 1.0);
    } else if (explicitDuration !== undefined) {
      sceneDuration = explicitDuration;
    }

    sceneDuration = Math.round(sceneDuration * 10) / 10;

    const sceneId = `scene-${Math.random().toString(36).substring(2, 11)}`;
    const scene: any = {
      id: sceneId,
      name: sceneName,
      duration: sceneDuration,
      startTime: globalSceneStartTime,
      objects: [],
      svgObjects: [],
      cameraKeyframes: [],
      background: PALETTE.background
    };

    // D. Timed Subtitle Cues Generation
    if (subtitles) {
      const cues = tts.createSubtitleCues(
        narration,
        globalSceneStartTime + 0.3,
        voiceoverDuration > 0 ? voiceoverDuration : estimatedDuration
      );
      project.subtitles = project.subtitles!.concat(cues);
    }

    // E. Audio Track Addition
    if (voiceoverDuration > 0) {
      project.audioTracks.push({
        id: `voiceover-scene-${sIdx + 1}`,
        name: "voiceover",
        type: "voiceover",
        src: `../renders/${projectId}/audio/scene-${sIdx + 1}.mp3`,
        volume: 1.0,
        startTime: globalSceneStartTime + 0.3,
        duration: voiceoverDuration
      } as any);
    }

    // F. Camera Keyframes Interpolation
    const midTime = Math.round((sceneDuration / 2) * 10) / 10;
    if (cameraIntent === "zoom_in") {
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: 0, zoom: 0.95, easing: "linear" },
        { time: midTime, x: 0, y: 0, zoom: 1.08, easing: "easeInOut" }
      );
    } else if (cameraIntent === "zoom_out") {
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: 0, zoom: 1.08, easing: "linear" },
        { time: midTime, x: 0, y: 0, zoom: 0.95, easing: "easeInOut" }
      );
    } else if (cameraIntent === "pan_left_to_right") {
      scene.cameraKeyframes.push(
        { time: 0, x: -150, y: 0, zoom: 1.05, easing: "linear" },
        { time: midTime, x: 150, y: 0, zoom: 1.05, easing: "easeInOut" }
      );
    } else if (cameraIntent === "slight_zoom_out") {
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: 0, zoom: 1.04, easing: "linear" },
        { time: midTime, x: 0, y: 0, zoom: 0.98, easing: "easeInOut" }
      );
    } else if (cameraIntent === "focus_main_then_reveal") {
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: -50, zoom: 1.25, easing: "linear" },
        { time: midTime, x: 0, y: 0, zoom: 0.95, easing: "easeInOut" }
      );
    } else if (cameraIntent === "pan_to_diagram") {
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" },
        { time: midTime, x: 80, y: 10, zoom: 1.08, easing: "easeInOut" }
      );
    } else {
      scene.cameraKeyframes.push({ time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" });
    }

    // G. Visual Layout Rendering based on planned template
    if (template === "title_intro") {
      const titleVis = visuals.find(v => v.semanticRole === "title") || { type: "title", text: title };
      const subVis = visuals.find(v => v.semanticRole === "supporting_detail" || v.type === "text") || (narration ? { type: "text", text: narration } : null);
      const iconVis = visuals.find(v => v.type === "shape") || { type: "shape", shapeName: "lightBulb" };

      // Center Title (0, 20)
      scene.objects.push({
        id: `title-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: 20,
        startTime: 0.4,
        duration: sceneDuration - 0.9,
        easing: "easeOut",
        animationType: "draw",
        content: titleVis.text || title,
        fontSize: 64,
        fontFamily: "Georgia, serif",
        fontWeight: "bold",
        fontStyle: "normal",
        fillColor: PALETTE.accent,
        textWrapWidth: 1100
      });

      // Subtitle (0, 160)
      if (subVis) {
        scene.objects.push({
          id: `sub-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: 0,
          y: 160,
          startTime: 1.0,
          duration: sceneDuration - 1.5,
          easing: "easeOut",
          animationType: "draw",
          content: subVis.text || narration,
          fontSize: 36,
          fontFamily: "Georgia, serif",
          fontWeight: "normal",
          fontStyle: "italic",
          fillColor: PALETTE.text,
          textWrapWidth: 1000
        });
      }

      // Icon (0, -140)
      if (iconVis) {
        const shapeName = iconVis.shapeName || "lightBulb";
        const pathData = (SVG_SHAPES as any)[shapeName] || SVG_SHAPES.lightBulb;
        scene.svgObjects.push({
          id: `icon-${Math.random().toString(36).substring(2, 11)}`,
          pathData,
          x: 0,
          y: -140,
          scaleX: 1.8,
          scaleY: 1.8,
          strokeColor: PALETTE.accent,
          strokeWidth: 3.5,
          fillColor: "transparent",
          startTime: 1.7,
          duration: sceneDuration - 2.2,
          easing: "easeOut"
        });
      }

    } else if (template === "summary_checklist") {
      // Checklist template
      scene.objects.push({
        id: `title-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: -220,
        startTime: 0.4,
        duration: sceneDuration - 0.9,
        easing: "easeOut",
        animationType: "draw",
        content: sceneName,
        fontSize: 54,
        fontFamily: "Georgia, serif",
        fontWeight: "bold",
        fontStyle: "normal",
        fillColor: PALETTE.text,
        textWrapWidth: 1100
      });

      let takeaways = visuals.filter(v => v.type === "text" || v.type === "callout").map(v => v.text || "");
      if (takeaways.length === 0) {
        takeaways = narration.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10).slice(0, 4);
      }
      if (takeaways.length === 0) {
        takeaways = [
          "Completed fully structured conceptual scenes",
          "Automated visual animations and layout grids",
          "Generated timed local voiceovers and subtitle cues"
        ];
      }

      for (let i = 0; i < takeaways.length; i++) {
        const itemY = -70 + i * 100;
        const textStart = 1.0 + i * 0.7;

        scene.svgObjects.push({
          id: `check-${i}-${Math.random().toString(36).substring(2, 9)}`,
          pathData: SVG_SHAPES.checkmark,
          x: -300,
          y: itemY - 30,
          scaleX: 1.2,
          scaleY: 1.2,
          strokeColor: PALETTE.success,
          strokeWidth: 3.5,
          fillColor: "transparent",
          startTime: textStart,
          duration: sceneDuration - textStart - 0.5,
          easing: "easeOut"
        });

        scene.objects.push({
          id: `takeaway-${i}-${Math.random().toString(36).substring(2, 9)}`,
          type: "text",
          x: 80,
          y: itemY,
          startTime: textStart + 0.3,
          duration: sceneDuration - (textStart + 0.3) - 0.5,
          easing: "easeOut",
          animationType: "draw",
          content: takeaways[i],
          fontSize: 34,
          fontFamily: "Georgia, serif",
          fontWeight: "normal",
          fontStyle: "normal",
          fillColor: PALETTE.text,
          textWrapWidth: 750
        });
      }

    } else if (template === "process_flow") {
      // Horizontal flow template
      scene.objects.push({
        id: `title-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: -220,
        startTime: 0.4,
        duration: sceneDuration - 0.9,
        easing: "easeOut",
        animationType: "draw",
        content: sceneName,
        fontSize: 54,
        fontFamily: "Georgia, serif",
        fontWeight: "bold",
        fontStyle: "normal",
        fillColor: PALETTE.text,
        textWrapWidth: 1100
      });

      const steps = visuals.filter(v => v.type !== "title").slice(0, 3);
      const stepXCoords = [-480, 0, 480];

      while (steps.length < 3) {
        steps.push({
          type: "text",
          text: `Concept Step ${steps.length + 1}`,
          semanticRole: "supporting_detail",
          animation: "draw",
          emphasis: "normal",
          startTimeOffset: 1.0 + steps.length * 0.7
        });
      }

      for (let i = 0; i < 3; i++) {
        const step = steps[i];
        const stepX = stepXCoords[i];
        const stepStart = 1.0 + i * 0.7;

        if (step.type === "shape" || step.type === "arrow") {
          const shapeName = step.shapeName || "circle";
          const pathData = (SVG_SHAPES as any)[shapeName] || SVG_SHAPES.circle;
          scene.svgObjects.push({
            id: `step-${i}-${Math.random().toString(36).substring(2, 9)}`,
            pathData,
            x: stepX,
            y: 60 - 30,
            scaleX: 1.6,
            scaleY: 1.6,
            strokeColor: step.emphasis === "important" ? PALETTE.accent : PALETTE.line,
            strokeWidth: 3,
            fillColor: "transparent",
            startTime: stepStart,
            duration: sceneDuration - stepStart - 0.5,
            easing: "easeOut"
          });
        } else {
          scene.objects.push({
            id: `step-${i}-${Math.random().toString(36).substring(2, 9)}`,
            type: "text",
            x: stepX,
            y: 60,
            startTime: stepStart,
            duration: sceneDuration - stepStart - 0.5,
            easing: "easeOut",
            animationType: step.animation === "fade" ? "fade" : "draw",
            content: step.text || `Step ${i + 1}`,
            fontSize: 34,
            fontFamily: "Georgia, serif",
            fontWeight: step.emphasis === "important" ? "bold" : "normal",
            fontStyle: "normal",
            fillColor: step.emphasis === "important" ? PALETTE.accent : PALETTE.text,
            textWrapWidth: 360
          });
        }

        if (i < 2) {
          const arrowX = i === 0 ? -240 : 240;
          const arrowStart = stepStart + 0.4;
          scene.svgObjects.push({
            id: `arrow-flow-${i}-${Math.random().toString(36).substring(2, 9)}`,
            pathData: SVG_SHAPES.arrowRight,
            x: arrowX,
            y: 30,
            scaleX: 1.3,
            scaleY: 1.3,
            strokeColor: PALETTE.accent,
            strokeWidth: 3,
            fillColor: "transparent",
            startTime: arrowStart,
            duration: sceneDuration - arrowStart - 0.5,
            easing: "easeOut"
          });
        }
      }

    } else if (template === "compare") {
      // Comparison template
      scene.objects.push({
        id: `title-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: -220,
        startTime: 0.4,
        duration: sceneDuration - 0.9,
        easing: "easeOut",
        animationType: "draw",
        content: sceneName,
        fontSize: 54,
        fontFamily: "Georgia, serif",
        fontWeight: "bold",
        fontStyle: "normal",
        fillColor: PALETTE.text,
        textWrapWidth: 1100
      });

      scene.objects.push({
        id: `vs-label-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: 30,
        startTime: 1.8,
        duration: sceneDuration - 2.3,
        easing: "easeOut",
        animationType: "draw",
        content: "VS",
        fontSize: 48,
        fontFamily: "Georgia, serif",
        fontWeight: "bold",
        fontStyle: "normal",
        fillColor: PALETTE.accent,
        textWrapWidth: 200
      });

      let leftHeader = "Left Column";
      let leftBody = "Details on side A";
      let rightHeader = "Right Column";
      let rightBody = "Details on side B";

      const texts = visuals.filter(v => v.type === "text" || v.type === "callout").map(v => v.text || "");
      if (texts.length >= 4) {
        leftHeader = texts[0];
        leftBody = texts[1];
        rightHeader = texts[2];
        rightBody = texts[3];
      } else if (texts.length >= 2) {
        leftBody = texts[0];
        rightBody = texts[1];
      }

      // Left column
      scene.objects.push(
        {
          id: `left-hdr-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: -380,
          y: -80,
          startTime: 1.0,
          duration: sceneDuration - 1.5,
          easing: "easeOut",
          animationType: "draw",
          content: leftHeader,
          fontSize: 40,
          fontFamily: "Georgia, serif",
          fontWeight: "bold",
          fontStyle: "normal",
          fillColor: PALETTE.warning,
          textWrapWidth: 480
        },
        {
          id: `left-body-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: -380,
          y: 80,
          startTime: 1.3,
          duration: sceneDuration - 1.8,
          easing: "easeOut",
          animationType: "draw",
          content: leftBody,
          fontSize: 34,
          fontFamily: "Georgia, serif",
          fontWeight: "normal",
          fontStyle: "normal",
          fillColor: PALETTE.text,
          textWrapWidth: 480
        }
      );

      // Right column
      scene.objects.push(
        {
          id: `right-hdr-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: 380,
          y: -80,
          startTime: 2.1,
          duration: sceneDuration - 2.6,
          easing: "easeOut",
          animationType: "draw",
          content: rightHeader,
          fontSize: 40,
          fontFamily: "Georgia, serif",
          fontWeight: "bold",
          fontStyle: "normal",
          fillColor: PALETTE.success,
          textWrapWidth: 480
        },
        {
          id: `right-body-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: 380,
          y: 80,
          startTime: 2.4,
          duration: sceneDuration - 2.9,
          easing: "easeOut",
          animationType: "draw",
          content: rightBody,
          fontSize: 34,
          fontFamily: "Georgia, serif",
          fontWeight: "normal",
          fontStyle: "normal",
          fillColor: PALETTE.text,
          textWrapWidth: 480
        }
      );

    } else if (template === "diagram_explain") {
      // Central Interactive Diagram template
      scene.objects.push({
        id: `title-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: -240,
        startTime: 0.4,
        duration: sceneDuration - 0.9,
        easing: "easeOut",
        animationType: "draw",
        content: sceneName,
        fontSize: 54,
        fontFamily: "Georgia, serif",
        fontWeight: "bold",
        fontStyle: "normal",
        fillColor: PALETTE.text,
        textWrapWidth: 1100
      });

      const centerShape = visuals.find(v => v.type === "shape" || v.semanticRole === "main_subject") || { type: "shape", shapeName: "lightBulb" };
      const leftText = visuals.find(v => (v.type === "text" || v.type === "callout") && v.startTimeOffset < 1.6) || { type: "text", text: "Input process models" };
      const rightText = visuals.find(v => (v.type === "text" || v.type === "callout") && v.startTimeOffset >= 1.6) || { type: "text", text: "Output final result keys" };

      // Center concept shape (0, -40)
      if (centerShape) {
        const shapeName = centerShape.shapeName || "lightBulb";
        const pathData = (SVG_SHAPES as any)[shapeName] || SVG_SHAPES.circle;
        scene.svgObjects.push({
          id: `diagram-center-${Math.random().toString(36).substring(2, 11)}`,
          pathData,
          x: 0,
          y: -40,
          scaleX: 2.2,
          scaleY: 2.2,
          strokeColor: PALETTE.accent,
          strokeWidth: 3.5,
          fillColor: "transparent",
          startTime: 1.0,
          duration: sceneDuration - 1.5,
          easing: "easeOut"
        });
      }

      // Supporting details flanking left (-400, 60)
      if (leftText) {
        scene.objects.push({
          id: `diagram-left-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: -400,
          y: 60,
          startTime: 1.4,
          duration: sceneDuration - 1.9,
          easing: "easeOut",
          animationType: "draw",
          content: leftText.text || "Interactive details A",
          fontSize: 32,
          fontFamily: "Georgia, serif",
          fontWeight: "normal",
          fontStyle: "normal",
          fillColor: PALETTE.text,
          textWrapWidth: 380
        });
      }

      // Supporting details flanking right (400, 60)
      if (rightText) {
        scene.objects.push({
          id: `diagram-right-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: 400,
          y: 60,
          startTime: 2.0,
          duration: sceneDuration - 2.5,
          easing: "easeOut",
          animationType: "draw",
          content: rightText.text || "Interactive details B",
          fontSize: 32,
          fontFamily: "Georgia, serif",
          fontWeight: "normal",
          fontStyle: "normal",
          fillColor: PALETTE.text,
          textWrapWidth: 380
        });
      }

    } else {
      // Template: explain_two_column
      scene.objects.push({
        id: `title-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: -220,
        startTime: 0.4,
        duration: sceneDuration - 0.9,
        easing: "easeOut",
        animationType: "draw",
        content: sceneName,
        fontSize: 54,
        fontFamily: "Georgia, serif",
        fontWeight: "bold",
        fontStyle: "normal",
        fillColor: PALETTE.text,
        textWrapWidth: 1100
      });

      const textVis = visuals.find(v => v.type === "text" || v.type === "callout") || { type: "text", text: narration };
      const shapeVis = visuals.find(v => v.type === "shape") || { type: "shape", shapeName: "checkmark" };

      // Left Column Text: x = -350
      if (textVis) {
        scene.objects.push({
          id: `body-text-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: -350,
          y: 50,
          startTime: 1.0,
          duration: sceneDuration - 1.5,
          easing: "easeOut",
          animationType: textVis.animation === "fade" ? "fade" : "draw",
          content: textVis.text || narration,
          fontSize: 38,
          fontFamily: "Georgia, serif",
          fontWeight: textVis.emphasis === "important" ? "bold" : "normal",
          fontStyle: textVis.type === "callout" ? "italic" : "normal",
          fillColor: textVis.emphasis === "important" ? PALETTE.accent : PALETTE.text,
          textWrapWidth: 520
        });
      }

      // Right Column Shape: x = 350
      if (shapeVis) {
        const shapeName = shapeVis.shapeName || "checkmark";
        const pathData = (SVG_SHAPES as any)[shapeName] || SVG_SHAPES.circle;
        scene.svgObjects.push({
          id: `body-shape-${Math.random().toString(36).substring(2, 11)}`,
          pathData,
          x: 350,
          y: 20,
          scaleX: 2.0,
          scaleY: 2.0,
          strokeColor: shapeVis.emphasis === "important" ? PALETTE.accent : PALETTE.line,
          strokeWidth: 3,
          fillColor: "transparent",
          startTime: 1.7,
          duration: sceneDuration - 2.2,
          easing: "easeOut"
        });
      }
    }

    // Default static keyframe fallback if keyframes list is empty
    if (scene.cameraKeyframes.length === 0) {
      scene.cameraKeyframes.push({ time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" });
    }
    
    // Sort camera keyframes
    scene.cameraKeyframes.sort((a: any, b: any) => a.time - b.time);
    project.scenes.push(scene);
    
    // Accumulate the start times
    globalSceneStartTime += sceneDuration;
  }

  // 3. Rebuild Timing offsets & Deep Validation
  let cursor = 0;
  for (const s of project.scenes) {
    let max = 0.5;
    for (const obj of s.objects) max = Math.max(max, obj.startTime + obj.duration);
    for (const obj of s.svgObjects) max = Math.max(max, obj.startTime + obj.duration);

    if (s.objects.length > 0 || s.svgObjects.length > 0) {
      s.duration = Math.max(s.duration || 4.0, max + 0.5);
    }
    s.duration = Math.max(3.0, Math.round(s.duration * 10) / 10);

    s.startTime = cursor;
    cursor += s.duration;
  }

  // 4. Strict Validation Pass & Safe Fallback Corrections
  for (const s of project.scenes) {
    // Correct text object structures
    s.objects = s.objects.filter((obj: any) => {
      if (!obj || obj.type !== "text") return false; 
      
      // Validation Check: no empty text
      if (!obj.content || !obj.content.trim()) return false; 

      if (!obj.id) obj.id = `obj-${Math.random().toString(36).substring(2, 11)}`;
      
      // Validation Check: every visual has easing
      obj.easing = obj.easing || "easeOut";
      
      // Clamp text wrap width sanely
      if (obj.textWrapWidth === undefined || obj.textWrapWidth < 100 || obj.textWrapWidth > 1200) {
        obj.textWrapWidth = 720;
      }
      // Clamp startTime within scene duration
      if (obj.startTime >= s.duration - 0.5) {
        obj.startTime = Math.max(0.2, Math.round((s.duration - 1.5) * 10) / 10);
      }
      
      // Validation Check: every object has duration extending near scene end
      obj.duration = Math.max(2.5, Math.round((s.duration - obj.startTime - 0.5) * 10) / 10);
      return true;
    });

    // Correct svg path structures
    s.svgObjects = s.svgObjects.filter((svg: any) => {
      if (!svg) return false;
      
      // Validation Check: no missing SVG pathData
      if (!svg.pathData) {
        svg.pathData = SVG_SHAPES.circle;
      }

      if (!svg.id) svg.id = `svg-${Math.random().toString(36).substring(2, 11)}`;
      
      // Validation Check: every visual has easing
      svg.easing = svg.easing || "easeOut";
      
      // Clamp startTime within scene duration
      if (svg.startTime >= s.duration - 0.5) {
        svg.startTime = Math.max(0.2, Math.round((s.duration - 1.5) * 10) / 10);
      }
      
      // Validation Check: every object has duration extending near scene end
      svg.duration = Math.max(2.5, Math.round((s.duration - svg.startTime - 0.5) * 10) / 10);
      return true;
    });

    // Make sure camera keyframes are validated and within range
    s.cameraKeyframes = s.cameraKeyframes.map((kf: any) => {
      kf.easing = kf.easing || "linear";
      
      // Validation Check: camera keyframes must be inside scene duration
      if (kf.time === undefined || kf.time > s.duration) {
        kf.time = s.duration;
      }
      return kf;
    });
  }

  // ── Quality Validation & Auto-Fix Pass ──────────────────────────────────
  console.error(`[QualityValidator] Running validateAndFixProject on "${projectId}"...`);
  const qualityResult = validateAndFixProject(project);
  const fixedProject = qualityResult.project;

  if (qualityResult.fixesApplied.length > 0) {
    console.error(`[QualityValidator] Applied ${qualityResult.fixesApplied.length} auto-fixes:`);
    qualityResult.fixesApplied.forEach(fix => console.error(`   ✔ ${fix}`));
  }

  if (!qualityResult.after.valid) {
    const hardErrors = qualityResult.after.warnings.filter(w => w.severity === "error");
    console.error(`[QualityValidator] ⚠️ ${hardErrors.length} hard errors remain after auto-fix:`);
    hardErrors.forEach(e => console.error(`   ✘ [${e.code}] ${e.message}`));
  } else {
    console.error(`[QualityValidator] ✅ Project passed quality validation after auto-fix.`);
  }

  // Save the validated and fixed project
  projectStore.saveProject(projectId, fixedProject);

  const totalDuration = fixedProject.scenes.reduce((sum: number, s: any) => sum + s.duration, 0);
  const objectCount = fixedProject.scenes.reduce((sum: number, s: any) => sum + s.objects.length, 0);
  const svgCount = fixedProject.scenes.reduce((sum: number, s: any) => sum + s.svgObjects.length, 0);
  const estimatedFrames = Math.round(totalDuration * fps);

  return {
    projectId,
    projectPath,
    project: fixedProject,
    summary: { sceneCount: fixedProject.scenes.length, totalDuration, objectCount, svgCount, estimatedFrames },
    qualityReport: {
      fixesApplied: qualityResult.fixesApplied,
      warningsBefore: qualityResult.before.warnings.length,
      warningsAfter: qualityResult.after.warnings.length,
      valid: qualityResult.after.valid
    }
  };
}

// ── Tool Execution Handler ───────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_whiteboard_project": {
        const { title, width, height, fps, background } = args as any;
        const result = projectStore.createProject({ title, width, height, fps, background });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      case "add_whiteboard_scene": {
        const { projectId, sceneName, duration, background } = args as any;
        const result = projectStore.addScene(projectId, { name: sceneName, duration, background });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      case "add_canvas_element": {
        const { projectId, sceneId, elementType, properties } = args as any;
        const result = projectStore.addCanvasElement(projectId, sceneId, elementType, properties);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      case "add_camera_movement": {
        const { projectId, sceneId, time, x, y, zoom, easing } = args as any;
        const result = projectStore.addCameraMovement(projectId, sceneId, { time, x, y, zoom, easing });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      case "add_audio_track": {
        const { projectId, type, src, startTime, duration, volume } = args as any;
        const result = projectStore.addAudioTrack(projectId, { type, src, startTime, duration, volume });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      case "add_subtitles": {
        const { projectId, subtitles } = args as any;
        const result = projectStore.addSubtitles(projectId, subtitles);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      case "get_whiteboard_project": {
        const { projectId } = args as any;
        const result = projectStore.getProject(projectId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      case "list_whiteboard_projects": {
        const projects = projectStore.listProjects();
        return {
          content: [{ type: "text", text: JSON.stringify({ projects }, null, 2) }]
        };
      }

      case "export_whiteboard_video": {
        const { projectId, fps = 30 } = args as any;
        
        // Safety checks
        const projectPath = projectStore.resolveProjectPath ? projectStore.resolveProjectPath(projectId) : projectStore.validateProjectId(projectId);
        if (!fs.existsSync(projectPath)) {
          throw new Error(`Project file not found: ${projectPath}`);
        }

        const project = projectStore.getProject(projectId);

        // ── Pre-render Quality Validation ────────────────────────────────
        console.error(`[Export] Running quality validation before rendering "${projectId}"...`);
        const preValidation = validateProject(project);
        const hardErrors = preValidation.warnings.filter(w => w.severity === "error");
        if (hardErrors.length > 0) {
          console.error(`[Export] ❌ Refusing render: ${hardErrors.length} hard error(s) detected.`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                error: "Render refused: project has quality errors that must be fixed before export.",
                hardErrors: hardErrors.map(e => ({ code: e.code, sceneId: e.sceneId, objectId: e.objectId, message: e.message })),
                hint: "Call auto_fix_whiteboard_project first, or fix manually.",
                summary: preValidation.summary
              }, null, 2)
            }]
          };
        }
        const preWarnings = preValidation.warnings.filter(w => w.severity === "warning");
        if (preWarnings.length > 0) {
          console.error(`[Export] ⚠️ ${preWarnings.length} warning(s) detected (non-blocking):`);
          preWarnings.forEach(w => console.error(`   ⚠ [${w.code}] ${w.message}`));
        } else {
          console.error(`[Export] ✅ Project passed quality validation.`);
        }

        const totalDuration = project.scenes.reduce((acc, s) => acc + (s.duration || 0), 0);

        let chunked = args.chunked;
        if (chunked === undefined) {
          chunked = totalDuration > 300; // Default chunked = true if duration > 300s
        }

        if (chunked) {
          console.error(`[Server] Starting chunked export for project "${projectId}" (Total Duration: ${totalDuration}s)...`);
          const chunkedResult = await chunkRenderer.renderProjectInChunks(projectId, {
            maxChunkDurationSeconds: args.maxChunkDurationSeconds,
            concurrency: args.concurrency,
            fps
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: "Chunked render E2E completed successfully!",
                    projectId,
                    outputPath: chunkedResult.outputPath,
                    chunkCount: chunkedResult.chunkCount,
                    renderSeconds: chunkedResult.renderSeconds,
                    chunks: chunkedResult.chunks
                  },
                  null,
                  2
                )
              }
            ]
          };
        }

        const rendersDir = path.resolve(process.cwd(), "renders", projectId);
        fs.mkdirSync(rendersDir, { recursive: true });
        const outputPath = path.resolve(rendersDir, "output.mp4");

        console.error(`Starting headless render job for project "${projectId}" to "${outputPath}"...`);

        const renderPromise = new Promise<string>((resolve, reject) => {
          const child = spawn(
            "node",
            [
              "scripts/renderVideo.js",
              "--project",
              projectPath,
              "--out",
              outputPath,
              "--fps",
              fps.toString(),
            ],
            {
              env: {
                ...process.env,
                PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`,
              },
            }
          );

          let stderrLogs = "";
          let stdoutLogs = "";

          child.stdout.on("data", (data) => {
            stdoutLogs += data.toString();
          });

          child.stderr.on("data", (data) => {
            stderrLogs += data.toString();
          });

          child.on("close", (code) => {
            if (code === 0) {
              resolve(outputPath);
            } else {
              reject(
                new Error(
                  `Render script exited with error code ${code}.\nSTDOUT:\n${stdoutLogs}\nSTDERR:\n${stderrLogs}`
                )
              );
            }
          });

          child.on("error", (err) => {
            reject(err);
          });
        });

        const jobResult = await renderPromise;

        return {
          content: [{ type: "text", text: JSON.stringify({ outputPath: jobResult }, null, 2) }]
        };
      }

      case "create_whiteboard_video_from_outline": {
        const {
          title,
          outline,
          width = 1920,
          height = 1080,
          fps = 30,
          autoExport = false,
          voiceover = false,
          subtitles = false,
          voice
        } = args as any;

        // Compile project dynamically using unified compiler
        const compilation = await compileProjectFromOutline({
          title,
          outline,
          width,
          height,
          fps,
          voiceover,
          subtitles,
          voice
        });
        const { projectId, projectPath, project, summary } = compilation;

        // Auto Export Headless Video Rendering
        let outputPath: string | undefined;
        if (autoExport) {
          const rendersDir = path.resolve(process.cwd(), "renders", projectId);
          fs.mkdirSync(rendersDir, { recursive: true });
          outputPath = path.resolve(rendersDir, "output.mp4");

          console.error(`Starting autoExport headless render job for project "${projectId}" to "${outputPath}"...`);

          const renderPromise = new Promise<string>((resolve, reject) => {
            const child = spawn(
              "node",
              [
                "scripts/renderVideo.js",
                "--project",
                projectPath,
                "--out",
                outputPath!,
                "--fps",
                fps.toString(),
              ],
              {
                env: {
                  ...process.env,
                  PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`,
                },
              }
            );

            let stderrLogs = "";
            let stdoutLogs = "";

            child.stdout.on("data", (data) => {
              stdoutLogs += data.toString();
            });

            child.stderr.on("data", (data) => {
              stderrLogs += data.toString();
            });

            child.on("close", (code) => {
              if (code === 0) {
                resolve(outputPath!);
              } else {
                reject(
                  new Error(
                    `Render script exited with error code ${code}.\nSTDOUT:\n${stdoutLogs}\nSTDERR:\n${stderrLogs}`
                  )
                );
              }
            });

            child.on("error", (err) => {
              reject(err);
            });
          });

          await renderPromise;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  projectId,
                  projectPath,
                  outputPath,
                  outline,
                  project,
                  summary
                },
                null,
                2
              )
            }
          ]
        };
      }

      case "create_whiteboard_video_from_prompt": {
        const {
          prompt,
          title: customTitle,
          durationSeconds,
          sceneCount: customSceneCount,
          width = 1920,
          height = 1080,
          fps = 30,
          autoExport = false,
          style = "educational"
        } = args as any;

        // 1. Establish project title
        const projectTitle = customTitle || prompt.substring(0, 30) + (prompt.length > 30 ? "..." : "");

        // 2. Determine scene count
        let sceneCount = 3;
        if (customSceneCount !== undefined) {
          sceneCount = customSceneCount;
        } else if (durationSeconds !== undefined) {
          if (durationSeconds <= 60) sceneCount = 3;
          else if (durationSeconds <= 180) sceneCount = 5;
          else sceneCount = 8;
        }

        // 3. Generate local outline dynamically depending on keyword detection and sceneCount
        const outline: any[] = [];
        const lowerPrompt = prompt.toLowerCase();

        // Topic detection
        const isPhotosynthesis = lowerPrompt.includes("photosynthesis") || lowerPrompt.includes("plant") || lowerPrompt.includes("leaf");
        const isSoftware = lowerPrompt.includes("software") || lowerPrompt.includes("ai") || lowerPrompt.includes("coding") || lowerPrompt.includes("developer") || lowerPrompt.includes("tech");
        const isBusiness = lowerPrompt.includes("marketing") || lowerPrompt.includes("growth") || lowerPrompt.includes("startup") || lowerPrompt.includes("product") || lowerPrompt.includes("sales") || lowerPrompt.includes("business");

        // Distribute duration evenly if provided
        const perSceneDuration = durationSeconds !== undefined ? Math.round((durationSeconds / sceneCount) * 10) / 10 : undefined;

        for (let i = 0; i < sceneCount; i++) {
          let sceneName = `Scene ${i + 1}`;
          let narration = "";
          let visuals: any[] = [];

          // Customize outline content based on topic & progress
          if (isPhotosynthesis) {
            if (i === 0) {
              sceneName = "1. Solar Energy Input";
              narration = "Photosynthesis begins as plants absorb light from the sun to power their biological engines. This solar energy is the fundamental fuel.";
              visuals = [
                { type: "title", text: "Solar Light Absorption", emphasis: "important" },
                { type: "text", text: "Leaves harvest light wave photons" },
                { type: "shape", shapeName: "lightBulb" }
              ];
            } else if (i === 1) {
              sceneName = "2. Roots & Hydration";
              narration = "Roots draw water from the soil up to the leaves, supplying vital chemical nutrients and water molecules for the synthesis process.";
              visuals = [
                { type: "title", text: "Water Absorption Systems" },
                { type: "text", text: "Roots gather chemical nutrients" },
                { type: "shape", shapeName: "analytics" }
              ];
            } else if (i === 2 && sceneCount === 3) {
              sceneName = "3. Sugar & Oxygen Release";
              narration = "Finally, plants combine water and carbon dioxide to produce glucose sugars for their growth, releasing clean oxygen for us to breathe.";
              visuals = [
                { type: "title", text: "Glucose & Oxygen Release", emphasis: "important" },
                { type: "text", text: "Clean oxygen feeds our atmosphere" },
                { type: "shape", shapeName: "checkmark" }
              ];
            } else if (i === 2) {
              sceneName = "3. Chloroplast Chemistry";
              narration = "Under sunlight inside plant cells, carbon dioxide and water molecules undergo a complex chemical transformation.";
              visuals = [
                { type: "title", text: "Molecular Transformation" },
                { type: "arrow" },
                { type: "shape", shapeName: "gear" }
              ];
            } else {
              sceneName = `${i + 1}. Glucose Sugar & Clean Air`;
              narration = "This chemical reaction yields organic glucose sugar to grow the plant, while releasing vital oxygen back into the atmosphere.";
              visuals = [
                { type: "title", text: "Sugar & Air Output", emphasis: "important" },
                { type: "text", text: "Healthy plant systems thrive" },
                { type: "shape", shapeName: "checkmark" }
              ];
            }
          } else if (isSoftware) {
            if (i === 0) {
              sceneName = "1. The AI Revolution";
              narration = "Modern software systems are undergoing a massive transformation powered by advanced agentic AI models.";
              visuals = [
                { type: "title", text: "AI & Software Engineering", emphasis: "important" },
                { type: "text", text: "Agentic models automate coding workflows" },
                { type: "shape", shapeName: "lightBulb" }
              ];
            } else if (i === sceneCount - 1) {
              sceneName = `${i + 1}. Future Scale & Conclude`;
              narration = "In summary, mastering automated AI processes is the key to launching scalable, future-proof software solutions.";
              visuals = [
                { type: "title", text: "Scale & Growth Success" },
                { type: "text", text: "Unlocking advanced software agility" },
                { type: "shape", shapeName: "trophy", emphasis: "important" }
              ];
            } else {
              sceneName = `${i + 1}. Programmatic Logic Nodes`;
              narration = "AI agents build secure modules by editing files, checking types, and running local execution testing pipelines.";
              visuals = [
                { type: "title", text: "Continuous Test Pipelines" },
                { type: "arrow" },
                { type: "shape", shapeName: "laptop" }
              ];
            }
          } else if (isBusiness) {
            if (i === 0) {
              sceneName = "1. The Startup Pitch";
              narration = "Creating a successful startup begins by identifying a massive market problem and designing an optimized solution.";
              visuals = [
                { type: "title", text: "Identify Market Demands", emphasis: "important" },
                { type: "text", text: "Finding pain points and user needs" },
                { type: "shape", shapeName: "lightBulb" }
              ];
            } else if (i === sceneCount - 1) {
              sceneName = `${i + 1}. Sales Goals Achieved`;
              narration = "By aligning standard product loops with scalable models, we reach our growth goals and secure massive sales wins.";
              visuals = [
                { type: "title", text: "Startup Launch Success", emphasis: "important" },
                { type: "text", text: "Scale, grow, and win the market" },
                { type: "shape", shapeName: "trophy" }
              ];
            } else {
              sceneName = `${i + 1}. Performance Metrics`;
              narration = "We measure operational progress using real-time charts, conversion funnels, and data stats arrays.";
              visuals = [
                { type: "title", text: "Funnels & Conversion Ratios" },
                { type: "text", text: "Data-driven growth stats analytics" },
                { type: "shape", shapeName: "analytics" }
              ];
            }
          } else {
            // General Fallback
            if (i === 0) {
              sceneName = `1. Introducing ${projectTitle}`;
              narration = `Let's explore the essential concepts behind ${prompt} and see how it operates in the real world.`;
              visuals = [
                { type: "title", text: `Welcome to ${projectTitle}` },
                { type: "text", text: "Learning core conceptual layouts" },
                { type: "shape", shapeName: getShapeFromKeywords(prompt) }
              ];
            } else if (i === sceneCount - 1) {
              sceneName = `${i + 1}. Summary & Goals`;
              narration = "In summary, mastering these core principles enables builders to design scalable, optimized whiteboard storyboards.";
              visuals = [
                { type: "title", text: "Summary & Final Wins", emphasis: "important" },
                { type: "text", text: "Whiteboard explanation keys successfully completed" },
                { type: "shape", shapeName: "checkmark" }
              ];
            } else {
              sceneName = `${i + 1}. Concept ${i} Mechanics`;
              narration = "At its foundation, this system functions through a series of structured guidelines and sequential workflows.";
              visuals = [
                { type: "title", text: `Concept Segment ${i}` },
                { type: "arrow" },
                { type: "shape", shapeName: "gear" }
              ];
            }
          }

          outline.push({
            sceneName,
            narration,
            duration: perSceneDuration,
            visuals
          });
        }

        // Compile project dynamically using unified compiler
        const compilation = await compileProjectFromOutline({
          title: projectTitle,
          outline,
          width,
          height,
          fps,
          voiceover,
          subtitles,
          voice,
          narrationStyle
        });
        const { projectId, projectPath, project, summary } = compilation;

        // Auto Export Headless Video Rendering
        let outputPath: string | undefined;
        if (autoExport) {
          const rendersDir = path.resolve(process.cwd(), "renders", projectId);
          fs.mkdirSync(rendersDir, { recursive: true });
          outputPath = path.resolve(rendersDir, "output.mp4");

          console.error(`Starting autoExport headless render job for project "${projectId}" to "${outputPath}"...`);

          const renderPromise = new Promise<string>((resolve, reject) => {
            const child = spawn(
              "node",
              [
                "scripts/renderVideo.js",
                "--project",
                projectPath,
                "--out",
                outputPath!,
                "--fps",
                fps.toString(),
              ],
              {
                env: {
                  ...process.env,
                  PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`,
                },
              }
            );

            let stderrLogs = "";
            let stdoutLogs = "";

            child.stdout.on("data", (data) => {
              stdoutLogs += data.toString();
            });

            child.stderr.on("data", (data) => {
              stderrLogs += data.toString();
            });

            child.on("close", (code) => {
              if (code === 0) {
                resolve(outputPath!);
              } else {
                reject(
                  new Error(
                    `Render script exited with error code ${code}.\nSTDOUT:\n${stdoutLogs}\nSTDERR:\n${stderrLogs}`
                  )
                );
              }
            });

            child.on("error", (err) => {
              reject(err);
            });
          });

          await renderPromise;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  projectId,
                  projectPath,
                  outputPath,
                  outline,
                  project,
                  summary
                },
                null,
                2
              )
            }
          ]
        };
      }

      case "create_longform_whiteboard_video": {
        const {
          prompt,
          targetDurationMinutes,
          quality = "standard",
          voiceover = false,
          subtitles = false,
          autoExport = false,
          width = 1920,
          height = 1080,
          fps = 30
        } = args as any;

        // 1. Compile long-form outline plan
        const longformPlan = longformPlanner.compileLongformOutline(prompt, targetDurationMinutes);
        const { title: projectTitle, chapters, scenes } = longformPlan;

        // 2. Translate long-form scene visual beats into compiler outlines
        const compiledOutline = scenes.map((s) => {
          const visuals = s.visualBeats!.map((beat) => {
            if (beat.beatType === "title") {
              return { type: "title", text: beat.text, emphasis: "important" };
            } else if (beat.beatType === "definition" || beat.beatType === "callout" || beat.beatType === "summary") {
              return { type: "text", text: beat.text, emphasis: beat.importance === "primary" ? "important" : "normal" };
            } else {
              const shapeName = visualDirector.chooseAssetsForConcept(beat.concept);
              return { type: "shape", text: beat.text, shapeName, emphasis: beat.importance === "primary" ? "important" : "normal" };
            }
          });

          return {
            sceneName: s.sceneName,
            narration: s.narration,
            duration: s.duration,
            visuals,
            cameraIntent: s.cameraIntent
          };
        });

        // 3. Compile project JSON using asynchronous visual compiler
        const compilation = await compileProjectFromOutline({
          title: projectTitle,
          outline: compiledOutline,
          width,
          height,
          fps,
          voiceover,
          subtitles
        });

        const { projectId, projectPath, project, summary } = compilation;

        // 4. Enforce export constraints
        let outputPath: string | undefined;
        let warnings: string[] = [];

        if (autoExport) {
          if (targetDurationMinutes <= 5.0) {
            const rendersDir = path.resolve(process.cwd(), "renders", projectId);
            fs.mkdirSync(rendersDir, { recursive: true });
            outputPath = path.resolve(rendersDir, "output.mp4");

            console.error(`[Director] Starting long-form autoExport render job for project "${projectId}" to "${outputPath}"...`);

            const renderPromise = new Promise<string>((resolve, reject) => {
              const child = spawn(
                "node",
                [
                  "scripts/renderVideo.js",
                  "--project",
                  projectPath,
                  "--out",
                  outputPath!,
                  "--fps",
                  fps.toString(),
                ],
                {
                  env: {
                    ...process.env,
                    PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`,
                  },
                }
              );

              child.on("close", (code) => {
                if (code === 0) resolve(outputPath!);
                else reject(new Error(`Render process exited with error code ${code}`));
              });
              child.on("error", reject);
            });

            await renderPromise;
          } else {
            warnings.push("Headless rendering for videos longer than 5 minutes is blocked to prevent timeout/OOM. Chunk rendering is recommended.");
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  projectId,
                  projectPath,
                  outputPath,
                  title: projectTitle,
                  chapters,
                  sceneCount: scenes.length,
                  estimatedDuration: summary.totalDuration,
                  estimatedFrames: summary.estimatedFrames,
                  warnings,
                  project
                },
                null,
                2
              )
            }
          ]
        };
      }

      case "validate_whiteboard_project": {
        const { projectId } = args as any;
        const validationProject = projectStore.getProject(projectId);
        const validationResult = validateProject(validationProject);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              projectId,
              valid: validationResult.valid,
              warnings: validationResult.warnings,
              summary: validationResult.summary
            }, null, 2)
          }]
        };
      }

      case "auto_fix_whiteboard_project": {
        const { projectId: fixProjectId } = args as any;
        const fixProject = projectStore.getProject(fixProjectId);
        const fixResult = validateAndFixProject(fixProject);

        // Save the fixed project
        const fixProjectPath = projectStore.resolveProjectPath ? projectStore.resolveProjectPath(fixProjectId) : projectStore.validateProjectId(fixProjectId);
        projectStore.saveProject(fixProjectId, fixResult.project);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              projectId: fixProjectId,
              fixesApplied: fixResult.fixesApplied,
              before: {
                valid: fixResult.before.valid,
                warningCount: fixResult.before.warnings.length,
                warnings: fixResult.before.warnings
              },
              after: {
                valid: fixResult.after.valid,
                warningCount: fixResult.after.warnings.length,
                warnings: fixResult.after.warnings
              },
              summary: fixResult.after.summary
            }, null, 2)
          }]
        };
      }

      case "refine_svg_with_ai": {
        const { rawSvg, apiKey } = args as any;
        const result = await refineSvgWithAi(rawSvg, apiKey);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Tool "${name}" is not registered.`);
    }
  } catch (err: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error running tool "${name}": ${err.message}` }]
    };
  }
});

// ── Start Server ─────────────────────────────────────────────────────────────
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ScribeFlow Whiteboard MCP Server fully running on stdio!");
}

if (process.env.SCRIPEFLOW_TEST !== "true") {
  run().catch((err) => {
    console.error("Fatal error starting ScribeFlow Whiteboard MCP Server:", err);
    process.exit(1);
  });
}
