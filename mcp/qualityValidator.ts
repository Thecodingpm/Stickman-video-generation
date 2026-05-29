import { WhiteboardProject } from "./schema";

export interface ValidationWarning {
  code: string;
  severity: "info" | "warning" | "error";
  sceneId?: string;
  objectId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: ValidationWarning[];
  summary: {
    sceneCount: number;
    objectCount: number;
    svgCount: number;
    audioTrackCount: number;
    subtitleCount: number;
    totalDuration: number;
    estimatedFrames: number;
  };
}

/**
 * Evaluates the quality, consistency, and compliance of a whiteboard project.
 */
export function validateProject(project: any): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const scenes = project.scenes || [];
  const audioTracks = project.audioTracks || [];
  const subtitles = project.subtitles || [];
  const fps = project.metadata?.fps || 30;

  let totalDuration = 0;
  let objectCount = 0;
  let svgCount = 0;

  // 1. Project level validations
  if (scenes.length === 0) {
    warnings.push({
      code: "NO_SCENES",
      severity: "error",
      message: "The project has at least zero scenes. A valid project must contain at least one scene."
    });
  }

  // 2. Scene level validations
  scenes.forEach((scene: any, sIdx: number) => {
    const sceneId = scene.id || `scene-idx-${sIdx}`;
    totalDuration += scene.duration || 0;
    const sceneDur = scene.duration || 0;

    if (sceneDur < 3.0) {
      warnings.push({
        code: "SCENE_TOO_SHORT",
        severity: "warning",
        sceneId,
        message: `Scene ${sIdx + 1} ("${scene.name || "Untitled"}") is too short (${sceneDur.toFixed(1)}s). Every scene should ideally be at least 3.0s.`
      });
    }

    const sObjects = scene.objects || [];
    const sSvgObjects = scene.svgObjects || [];
    const visualsCount = sObjects.length + sSvgObjects.length;

    objectCount += sObjects.length;
    svgCount += sSvgObjects.length;

    // Check for blank scenes unless explicitly named blank or transition
    if (visualsCount === 0) {
      const isIntentional = scene.name?.toLowerCase().includes("blank") || 
                            scene.name?.toLowerCase().includes("pause") || 
                            scene.name?.toLowerCase().includes("transition");
      if (!isIntentional) {
        warnings.push({
          code: "BLANK_SCENE",
          severity: "warning",
          sceneId,
          message: `Scene ${sIdx + 1} ("${scene.name || "Untitled"}") has no visual elements. Design a beautiful illustration or name the scene "blank/pause" intentionally.`
        });
      }
    }

    if (visualsCount > 7) {
      warnings.push({
        code: "SCENE_CROWDED",
        severity: "warning",
        sceneId,
        message: `Scene ${sIdx + 1} ("${scene.name || "Untitled"}") contains ${visualsCount} visual elements, which exceeds the high-quality limit of 7. Consider splitting it to prevent element overlap.`
      });
    }

    // Camera keyframes validation
    const kfs = scene.cameraKeyframes || [];
    kfs.forEach((kf: any, kIdx: number) => {
      if (kf.time < 0 || kf.time > sceneDur) {
        warnings.push({
          code: "CAMERA_KEYFRAME_OUT_OF_BOUNDS",
          severity: "error",
          sceneId,
          message: `Camera keyframe ${kIdx + 1} is at time ${kf.time.toFixed(1)}s, which is outside the scene duration (0.0s - ${sceneDur.toFixed(1)}s).`
        });
      }
    });

    // Object validations
    sObjects.forEach((obj: any, oIdx: number) => {
      validateSceneObject(obj, sceneId, sceneDur, sIdx, oIdx, "objects", warnings);
    });

    sSvgObjects.forEach((obj: any, oIdx: number) => {
      validateSceneObject(obj, sceneId, sceneDur, sIdx, oIdx, "svgObjects", warnings);
    });
  });

  // 3. Subtitles validation
  subtitles.forEach((sub: any, subIdx: number) => {
    if (sub.startTime < 0 || sub.endTime <= sub.startTime) {
      warnings.push({
        code: "SUBTITLE_INVALID_TIMING",
        severity: "warning",
        message: `Subtitle cue ${subIdx + 1} ("${sub.text || ""}") has invalid times: [${sub.startTime}s - ${sub.endTime}s]. startTime must be positive and less than endTime.`
      });
    }
  });

  // 4. Audio tracks validation
  audioTracks.forEach((track: any, tIdx: number) => {
    if (track.startTime < 0) {
      warnings.push({
        code: "AUDIO_INVALID_START",
        severity: "warning",
        message: `Audio track ${tIdx + 1} ("${track.name || track.src}") has negative startTime: ${track.startTime}s.`
      });
    }
  });

  // 5. Warning for OOM danger
  const estimatedFrames = Math.floor(totalDuration * fps);
  const isChunked = project.metadata?.chunked === true || project.chunked === true;
  if (estimatedFrames > 20000 && !isChunked) {
    warnings.push({
      code: "HIGH_FRAME_COUNT_WARN",
      severity: "warning",
      message: `The project estimated frame count is very high (${estimatedFrames} frames) and chunked rendering is disabled. Enable chunked rendering to prevent out-of-memory browser crashes.`
    });
  }

  const valid = !warnings.some(w => w.severity === "error");

  return {
    valid,
    warnings,
    summary: {
      sceneCount: scenes.length,
      objectCount,
      svgCount,
      audioTrackCount: audioTracks.length,
      subtitleCount: subtitles.length,
      totalDuration,
      estimatedFrames
    }
  };
}

/**
 * Validates a single visual object inside a scene.
 */
function validateSceneObject(
  obj: any,
  sceneId: string,
  sceneDur: number,
  sIdx: number,
  oIdx: number,
  typeKey: "objects" | "svgObjects",
  warnings: ValidationWarning[]
): void {
  const objId = obj.id;
  const label = `${typeKey === "svgObjects" ? "SVG object" : "Text/Shape object"} ${oIdx + 1} in Scene ${sIdx + 1}`;

  if (!objId) {
    warnings.push({
      code: "MISSING_OBJECT_ID",
      severity: "error",
      sceneId,
      message: `${label} is missing a unique ID.`
    });
  }

  // Animation parameters
  if (obj.animationType === undefined) {
    warnings.push({
      code: "MISSING_ANIMATION_TYPE",
      severity: "warning",
      sceneId,
      objectId: objId,
      message: `${label} ("${obj.content || obj.name || objId}") is missing animationType property.`
    });
  }

  if (obj.easing === undefined) {
    warnings.push({
      code: "MISSING_EASING",
      severity: "warning",
      sceneId,
      objectId: objId,
      message: `${label} ("${obj.content || obj.name || objId}") is missing easing property.`
    });
  }

  // Text content empty
  if (obj.type === "text" && (!obj.content || obj.content.trim() === "")) {
    warnings.push({
      code: "EMPTY_TEXT_OBJECT",
      severity: "warning",
      sceneId,
      objectId: objId,
      message: `${label} is a text element but contains empty content.`
    });
  }

  // SVG path data check
  if (typeKey === "svgObjects" && (!obj.pathData || obj.pathData.trim() === "")) {
    warnings.push({
      code: "MISSING_SVG_PATH_DATA",
      severity: "error",
      sceneId,
      objectId: objId,
      message: `${label} is an SVG illustration but has empty pathData.`
    });
  }

  // Start times and duration validations
  if (obj.startTime < 0 || obj.startTime >= sceneDur) {
    warnings.push({
      code: "OBJECT_START_OUT_OF_BOUNDS",
      severity: "error",
      sceneId,
      objectId: objId,
      message: `${label} has a startTime of ${obj.startTime.toFixed(1)}s, which is outside the scene duration limits (0s - ${sceneDur.toFixed(1)}s).`
    });
  }

  if (obj.duration <= 0) {
    warnings.push({
      code: "OBJECT_INVALID_DURATION",
      severity: "error",
      sceneId,
      objectId: objId,
      message: `${label} has an invalid or zero duration: ${obj.duration.toFixed(1)}s.`
    });
  }
}

/**
 * Automatically repairs known quality violations or formats elements to high-fidelity defaults.
 */
export function autoFixProject(project: any): { project: any; fixesApplied: string[] } {
  const fixesApplied: string[] = [];
  const scenes = project.scenes || [];
  
  if (scenes.length === 0) {
    // Cannot repair a zero-scene project other than spawning one start scene
    const defaultScene = {
      id: `scene-${Math.random().toString(36).substring(2, 11)}`,
      name: "Scene 1",
      duration: 5.0,
      startTime: 0,
      objects: [],
      svgObjects: [],
      cameraKeyframes: [{ time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" }]
    };
    project.scenes = [defaultScene];
    fixesApplied.push("Added default first scene to blank project.");
  }

  project.scenes.forEach((scene: any, sIdx: number) => {
    const sceneDur = scene.duration || 5.0;

    // 1. Add camera keyframe if missing
    if (!scene.cameraKeyframes || scene.cameraKeyframes.length === 0) {
      scene.cameraKeyframes = [{ time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" }];
      fixesApplied.push(`[Scene ${sIdx + 1}] Restored missing default camera keyframe.`);
    }

    // 2. Clean objects lists
    if (scene.objects) {
      scene.objects = scene.objects.filter((obj: any) => {
        // Remove empty text objects
        if (obj.type === "text" && (!obj.content || obj.content.trim() === "")) {
          fixesApplied.push(`[Scene ${sIdx + 1}] Cleaned up empty text element: "${obj.id || "unknown"}"`);
          return false;
        }
        return true;
      });

      scene.objects.forEach((obj: any) => {
        fixVisualObject(obj, sceneDur, sIdx, "objects", fixesApplied);
      });
    }

    if (scene.svgObjects) {
      scene.svgObjects = scene.svgObjects.filter((obj: any) => {
        // Remove SVGs with empty path data
        if (!obj.pathData || obj.pathData.trim() === "") {
          fixesApplied.push(`[Scene ${sIdx + 1}] Removed invalid SVG outline lacking pathData: "${obj.id || "unknown"}"`);
          return false;
        }
        return true;
      });

      scene.svgObjects.forEach((obj: any) => {
        fixVisualObject(obj, sceneDur, sIdx, "svgObjects", fixesApplied);
      });
    }
  });

  // 3. Subtitles timing cleanups
  if (project.subtitles) {
    const beforeCount = project.subtitles.length;
    project.subtitles = project.subtitles.filter((sub: any) => {
      return sub.startTime >= 0 && sub.endTime > sub.startTime;
    });
    const afterCount = project.subtitles.length;
    if (beforeCount !== afterCount) {
      fixesApplied.push(`Removed ${beforeCount - afterCount} invalid timed subtitles.`);
    }
  }

  // 4. Audio tracks timing clamp
  if (project.audioTracks) {
    project.audioTracks.forEach((track: any, tIdx: number) => {
      if (track.startTime < 0) {
        track.startTime = 0;
        fixesApplied.push(`Clamped negative startTime for audio track ${tIdx + 1} to 0s.`);
      }
    });
  }

  return { project, fixesApplied };
}

/**
 * Repairs a single visual object.
 */
function fixVisualObject(
  obj: any,
  sceneDur: number,
  sIdx: number,
  typeKey: "objects" | "svgObjects",
  fixesApplied: string[]
): void {
  const label = `Scene ${sIdx + 1}`;

  // Unique ID
  if (!obj.id) {
    obj.id = `${typeKey === "svgObjects" ? "svg" : "obj"}-${Math.random().toString(36).substring(2, 11)}`;
    fixesApplied.push(`[${label}] Hydrated missing unique ID for element: ${obj.id}`);
  }

  // Easing Fallbacks
  if (obj.easing === undefined || obj.easing === null || obj.easing === "") {
    obj.easing = "easeOut";
    fixesApplied.push(`[${label}] Set default easing to 'easeOut' for element "${obj.id}"`);
  }

  // Animation Type Fallbacks
  if (obj.animationType === undefined || obj.animationType === null || obj.animationType === "") {
    obj.animationType = "draw";
    fixesApplied.push(`[${label}] Set default animationType to 'draw' for element "${obj.id}"`);
  }

  // Typography details standardizer
  if (obj.type === "text") {
    if (obj.color === undefined || obj.color === null) {
      obj.color = "#1e293b";
      fixesApplied.push(`[${label}] Preset text default color to slate-grey '#1e293b' for element "${obj.id}"`);
    }
    if (obj.textWrapWidth === undefined || obj.textWrapWidth === null) {
      obj.textWrapWidth = 700;
      fixesApplied.push(`[${label}] Preset textWrapWidth default to 700 for element "${obj.id}"`);
    }
  }

  // Whiteboard SVG vector stylings
  if (typeKey === "svgObjects") {
    if (obj.fillColor === undefined || obj.fillColor === null) {
      obj.fillColor = "transparent";
      fixesApplied.push(`[${label}] Preset SVG default fillColor to transparent for element "${obj.id}"`);
    }
    if (obj.strokeColor === undefined || obj.strokeColor === null) {
      obj.strokeColor = "#334155";
      fixesApplied.push(`[${label}] Preset SVG default strokeColor to dark-slate '#334155' for element "${obj.id}"`);
    }
    if (obj.strokeWidth === undefined || obj.strokeWidth === null) {
      obj.strokeWidth = 3;
      fixesApplied.push(`[${label}] Preset SVG default strokeWidth to 3 for element "${obj.id}"`);
    }
  }

  // Time clamps
  if (obj.startTime < 0 || obj.startTime >= sceneDur) {
    const oldStart = obj.startTime;
    obj.startTime = Math.max(0, Math.min(sceneDur - 0.5, obj.startTime));
    fixesApplied.push(`[${label}] Clamped element "${obj.id}" startTime from ${oldStart.toFixed(1)}s to ${obj.startTime.toFixed(1)}s.`);
  }

  if (obj.duration <= 0 || obj.startTime + obj.duration > sceneDur) {
    const oldDur = obj.duration;
    obj.duration = Math.max(0.5, Math.min(sceneDur - obj.startTime, obj.duration));
    fixesApplied.push(`[${label}] Clamped element "${obj.id}" duration from ${oldDur.toFixed(1)}s to ${obj.duration.toFixed(1)}s.`);
  }
}

/**
 * Combines validate and auto-fix sequentially.
 */
export function validateAndFixProject(project: any): { project: any; before: ValidationResult; after: ValidationResult; fixesApplied: string[] } {
  // 1. Initial Validation
  const before = validateProject(project);

  // 2. Perform Repairs
  const { project: fixedProject, fixesApplied } = autoFixProject(project);

  // 3. Final Validation
  const after = validateProject(fixedProject);

  return {
    project: fixedProject,
    before,
    after,
    fixesApplied
  };
}
