import * as fs from "fs";
import * as path from "path";
import {
  WhiteboardProject,
  WhiteboardScene,
  AnimatedObject,
  SvgPathObject,
  CameraKeyframe,
  AudioTrack,
  SubtitleCue
} from "./schema";

const PROJECTS_DIR = path.resolve(process.cwd(), "projects");
const RENDERS_DIR = path.resolve(process.cwd(), "renders");
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

// Ensure directories exist
fs.mkdirSync(PROJECTS_DIR, { recursive: true });
fs.mkdirSync(RENDERS_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/**
 * Validates the projectId to prevent path traversal and ensures it contains
 * only secure alphanumeric characters, dashes, and underscores.
 */
export function validateProjectId(projectId: string): string {
  if (typeof projectId !== "string" || !/^[a-zA-Z0-9-_]+$/.test(projectId)) {
    throw new Error("Invalid projectId. Only alphanumeric, dashes, and underscores are allowed.");
  }
  const resolvedPath = path.resolve(PROJECTS_DIR, `${projectId}.json`);
  if (!resolvedPath.startsWith(PROJECTS_DIR)) {
    throw new Error("Access denied: Path traversal detected.");
  }
  return resolvedPath;
}

/**
 * Recalculates startTimes and guarantees that scene durations accommodate
 * all internal canvas element animation envelopes.
 */
function rebuildProjectTimings(project: WhiteboardProject): void {
  let cursor = 0;
  for (const s of project.scenes) {
    let max = 0;
    for (const obj of s.objects) {
      max = Math.max(max, obj.startTime + obj.duration);
    }
    for (const obj of s.svgObjects) {
      max = Math.max(max, obj.startTime + obj.duration);
    }

    if (s.objects.length > 0 || s.svgObjects.length > 0) {
      s.duration = Math.max(s.duration || 0.5, max);
    }

    s.startTime = cursor;
    cursor += s.duration;
  }
}

/**
 * Helper to retrieve a project file safely.
 */
export function getProject(projectId: string): WhiteboardProject {
  const filePath = validateProjectId(projectId);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Project with ID "${projectId}" not found.`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

/**
 * Helper to save a project safely.
 */
export function saveProject(projectId: string, project: WhiteboardProject): WhiteboardProject {
  const filePath = validateProjectId(projectId);
  project.lastUpdated = new Date().toISOString();
  project.savedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(project, null, 2), "utf8");
  return project;
}

/**
 * Creates a brand new empty whiteboard project.
 */
export function createProject({
  title,
  width = 1920,
  height = 1080,
  fps = 30,
  background
}: {
  title: string;
  width?: number;
  height?: number;
  fps?: number;
  background?: string;
}): { projectId: string; projectPath: string; project: WhiteboardProject } {
  const projectId = `proj-${Math.random().toString(36).substring(2, 11)}`;
  const filePath = validateProjectId(projectId);

  const newProject: WhiteboardProject = {
    id: projectId,
    name: title,
    metadata: {
      width,
      height,
      fps
    },
    scenes: [
      {
        id: `scene-${Math.random().toString(36).substring(2, 11)}`,
        name: "Scene 1",
        duration: 5.0,
        startTime: 0,
        objects: [],
        svgObjects: [],
        cameraKeyframes: [
          { time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" }
        ],
        background
      }
    ],
    audioTracks: [],
    subtitles: [],
    lastUpdated: new Date().toISOString(),
    version: 1,
    savedAt: new Date().toISOString()
  };

  saveProject(projectId, newProject);

  return {
    projectId,
    projectPath: filePath,
    project: newProject
  };
}

/**
 * Lists all projects stored locally.
 */
export function listProjects(): Array<{ projectId: string; title: string; projectPath: string; updatedAt: string }> {
  const files = fs.readdirSync(PROJECTS_DIR);
  const result: Array<{ projectId: string; title: string; projectPath: string; updatedAt: string }> = [];

  for (const file of files) {
    if (file.endsWith(".json")) {
      try {
        const filePath = path.join(PROJECTS_DIR, file);
        const content = fs.readFileSync(filePath, "utf8");
        const project: WhiteboardProject = JSON.parse(content);
        const projectId = file.replace(".json", "");
        result.push({
          projectId,
          title: project.name || "Untitled",
          projectPath: filePath,
          updatedAt: project.lastUpdated || new Date().toISOString()
        });
      } catch (err) {
        // Skip unparseable files
      }
    }
  }

  return result;
}

/**
 * Appends a new scene segment to the storyboard sequence.
 */
export function addScene(
  projectId: string,
  scene: { name: string; duration: number; background?: string }
): { sceneId: string; project: WhiteboardProject } {
  const project = getProject(projectId);

  let totalDuration = 0;
  for (const s of project.scenes) {
    totalDuration += s.duration;
  }

  const sceneId = `scene-${Math.random().toString(36).substring(2, 11)}`;
  const newScene: WhiteboardScene = {
    id: sceneId,
    name: scene.name || `Scene ${project.scenes.length + 1}`,
    duration: scene.duration || 5.0,
    startTime: totalDuration,
    objects: [],
    svgObjects: [],
    cameraKeyframes: [
      { time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" }
    ],
    background: scene.background
  };

  project.scenes.push(newScene);
  rebuildProjectTimings(project);
  saveProject(projectId, project);

  return {
    sceneId,
    project
  };
}

/**
 * Adds an element (text, rect, circle, image, svg) to a specific scene with high-quality styling defaults.
 */
export function addCanvasElement(
  projectId: string,
  sceneId: string,
  elementType: "text" | "rect" | "circle" | "image" | "svg",
  properties: Record<string, any>
): { objectId: string; project: WhiteboardProject } {
  const project = getProject(projectId);
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) {
    throw new Error(`Scene with ID "${sceneId}" not found in project "${projectId}".`);
  }

  const elementId = properties.id || `${elementType}-${Math.random().toString(36).substring(2, 11)}`;

  if (elementType === "svg") {
    // Default SVG properties
    const svgObj: SvgPathObject = {
      id: elementId,
      pathData: properties.pathData || "M 0 50 L 100 50", // fallback single line
      x: properties.x !== undefined ? properties.x : 0,
      y: properties.y !== undefined ? properties.y : 0,
      scaleX: properties.scaleX !== undefined ? properties.scaleX : 1.0,
      scaleY: properties.scaleY !== undefined ? properties.scaleY : 1.0,
      strokeColor: properties.strokeColor || "#1e293b",
      strokeWidth: properties.strokeWidth !== undefined ? properties.strokeWidth : 3,
      fillColor: properties.fillColor || "transparent",
      startTime: properties.startTime !== undefined ? properties.startTime : 0,
      duration: properties.duration !== undefined ? properties.duration : 2.0,
      easing: properties.easing || "easeOut",
      drawOrder: properties.drawOrder,
      handVisible: properties.handVisible,
      handOffsetX: properties.handOffsetX,
      handOffsetY: properties.handOffsetY,
      startDelay: properties.startDelay,
      subPaths: properties.subPaths,
      opacity: properties.opacity,
      rotation: properties.rotation
    };

    scene.svgObjects.push(svgObj);
  } else {
    // Default Non-SVG AnimatedObject properties
    const animObj: AnimatedObject = {
      id: elementId,
      type: elementType,
      x: properties.x !== undefined ? properties.x : 0,
      y: properties.y !== undefined ? properties.y : 0,
      startTime: properties.startTime !== undefined ? properties.startTime : 0,
      duration: properties.duration !== undefined ? properties.duration : 2.0,
      easing: properties.easing || "easeOut",
      animationType: properties.animationType || (elementType === "image" ? "fade" : "draw"),
      move: properties.move,
      scale: properties.scale,
      exit: properties.exit
    };

    // Apply element-specific styling details
    if (elementType === "text") {
      animObj.content = properties.content || "Hello World";
      animObj.fontSize = properties.fontSize !== undefined ? properties.fontSize : 42;
      animObj.fontFamily = properties.fontFamily || "Georgia, serif";
      animObj.fillColor = properties.fillColor || "#1e293b";
      animObj.textWrapWidth = properties.textWrapWidth !== undefined ? properties.textWrapWidth : 700;
      animObj.fontWeight = properties.fontWeight;
      animObj.fontStyle = properties.fontStyle;
      animObj.textAlign = properties.textAlign;
      animObj.strokeText = properties.strokeText;
      animObj.strokeColor = properties.strokeColor;
    } else if (elementType === "rect") {
      animObj.width = properties.width !== undefined ? properties.width : 100;
      animObj.height = properties.height !== undefined ? properties.height : 100;
      animObj.fillColor = properties.fillColor || "#3b82f6";
      animObj.strokeColor = properties.strokeColor || "#1d4ed8";
      animObj.lineWidth = properties.lineWidth !== undefined ? properties.lineWidth : 2;
    } else if (elementType === "circle") {
      animObj.radius = properties.radius !== undefined ? properties.radius : 50;
      animObj.fillColor = properties.fillColor || "#f59e0b";
      animObj.strokeColor = properties.strokeColor || "#d97706";
      animObj.lineWidth = properties.lineWidth !== undefined ? properties.lineWidth : 2;
    } else if (elementType === "image") {
      animObj.src = properties.src || "";
      animObj.width = properties.width !== undefined ? properties.width : 150;
      animObj.height = properties.height !== undefined ? properties.height : 150;
    }

    scene.objects.push(animObj);
  }

  rebuildProjectTimings(project);
  saveProject(projectId, project);

  return {
    objectId: elementId,
    project
  };
}

/**
 * Appends or overwrites a camera keyframe in a specific scene.
 */
export function addCameraMovement(
  projectId: string,
  sceneId: string,
  keyframe: { time: number; x: number; y: number; zoom: number; easing?: string }
): { project: WhiteboardProject } {
  const project = getProject(projectId);
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) {
    throw new Error(`Scene with ID "${sceneId}" not found in project "${projectId}".`);
  }

  const newKf: CameraKeyframe = {
    time: keyframe.time !== undefined ? keyframe.time : 0,
    x: keyframe.x !== undefined ? keyframe.x : 0,
    y: keyframe.y !== undefined ? keyframe.y : 0,
    zoom: keyframe.zoom !== undefined ? keyframe.zoom : 1.0,
    easing: keyframe.easing || "linear"
  };

  // Overwrite existing keyframe at exactly this time, or push a new one
  const existingIdx = scene.cameraKeyframes.findIndex((kf) => Math.abs(kf.time - newKf.time) < 0.001);
  if (existingIdx !== -1) {
    scene.cameraKeyframes[existingIdx] = newKf;
  } else {
    scene.cameraKeyframes.push(newKf);
  }

  // Sort by time chronologically
  scene.cameraKeyframes.sort((a, b) => a.time - b.time);

  saveProject(projectId, project);

  return {
    project
  };
}

/**
 * Injects a new voiceover or background audio track into the project.
 */
export function addAudioTrack(
  projectId: string,
  audioTrack: { type: "voiceover" | "background"; src: string; startTime: number; duration: number; volume?: number }
): { audioTrackId: string; project: WhiteboardProject } {
  const project = getProject(projectId);

  const trackId = `audio-${Math.random().toString(36).substring(2, 11)}`;
  const track: AudioTrack = {
    id: trackId,
    name: audioTrack.type || "background",
    src: audioTrack.src,
    startTime: audioTrack.startTime !== undefined ? audioTrack.startTime : 0,
    duration: audioTrack.duration !== undefined ? audioTrack.duration : 5.0,
    volume: audioTrack.volume !== undefined ? audioTrack.volume : 1.0,
    isMuted: false
  };

  project.audioTracks.push(track);
  saveProject(projectId, project);

  return {
    audioTrackId: trackId,
    project
  };
}

/**
 * Completely replaces or initializes the project's subtitle track lists.
 */
export function addSubtitles(
  projectId: string,
  subtitlesList: Array<{ startTime: number; endTime: number; text: string }>
): { project: WhiteboardProject } {
  const project = getProject(projectId);

  project.subtitles = subtitlesList.map((sub) => ({
    startTime: sub.startTime,
    endTime: sub.endTime,
    text: sub.text
  }));

  saveProject(projectId, project);

  return {
    project
  };
}
