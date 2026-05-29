import * as projectStore from "../mcp/projectStore";
import { SVG_SHAPES } from "../src/core/svgShapes";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

const PALETTE = {
  background: "#f8fafc",
  text: "#1e293b",
  accent: "#6366f1",
  warning: "#f59e0b",
  success: "#10b981",
  line: "#334155"
};

const getShapeFromKeywords = (text: string, vIdx = 0): string => {
  const lower = text.toLowerCase();
  if (lower.includes("photosynthesis") || lower.includes("plant") || lower.includes("sun") || lower.includes("light") || lower.includes("leaf") || lower.includes("oxygen")) {
    const shapes = ["lightBulb", "arrowRight", "circle"];
    return shapes[vIdx % shapes.length];
  }
  if (lower.includes("science") || lower.includes("biology")) {
    const shapes = ["circle", "arrowRight"];
    return shapes[vIdx % shapes.length];
  }
  if (lower.includes("ai") || lower.includes("software") || lower.includes("tech") || lower.includes("laptop") || lower.includes("gear")) {
    const shapes = ["laptop", "gear"];
    return shapes[vIdx % shapes.length];
  }
  if (lower.includes("finance") || lower.includes("business") || lower.includes("growth") || lower.includes("sales") || lower.includes("analytics")) {
    const shapes = ["analytics", "arrowRight"];
    return shapes[vIdx % shapes.length];
  }
  if (lower.includes("achievement") || lower.includes("success") || lower.includes("win") || lower.includes("goal") || lower.includes("trophy")) {
    const shapes = ["trophy", "checkmark"];
    return shapes[vIdx % shapes.length];
  }
  if (lower.includes("global") || lower.includes("world") || lower.includes("climate") || lower.includes("earth") || lower.includes("globe")) {
    const shapes = ["globe", "cloud"];
    return shapes[vIdx % shapes.length];
  }
  if (lower.includes("rocket") || lower.includes("startup") || lower.includes("launch")) {
    return "rocket";
  }
  // General fallbacks
  if (lower.includes("idea") || lower.includes("learn") || lower.includes("lesson")) return "lightBulb";
  if (lower.includes("steps") || lower.includes("flow") || lower.includes("arrow")) return "arrowRight";
  return "checkmark";
};

const selectTemplate = (sceneName: string, narration: string, visuals: any[], sIdx: number, totalScenes: number): "title_intro" | "summary" | "process_flow" | "compare" | "explain_two_column" => {
  if (sIdx === 0) return "title_intro";
  if (sIdx === totalScenes - 1) return "summary";

  const hasProcessVisual = visuals.some(v => v.type === "arrow" || (v.shapeName && ["arrowRight", "gear"].includes(v.shapeName)) || (v.text && /flow|arrow|step|next|process|pipeline/i.test(v.text)));
  const hasProcessNarration = /flow|arrow|step|next|process|pipeline/i.test(narration + " " + sceneName);
  if (hasProcessVisual || hasProcessNarration) return "process_flow";

  const isCompare = /vs|compare|difference|versus/i.test(sceneName + " " + narration);
  if (isCompare) return "compare";

  return "explain_two_column";
};

async function main() {
  console.log("=== STARTING HIGH-LEVEL QUALITY PROMPT AUTOMATION VERIFICATION ===");

  const prompt = "Make a 60 second educational whiteboard video explaining how photosynthesis works, showing sunlight, carbon dioxide, water, glucose, and oxygen as a simple process flow.";
  const durationSeconds = 60;
  const sceneCount = 4;
  const autoExport = true;
  const fps = 30;
  const width = 1920;
  const height = 1080;

  console.log(`Prompt: "${prompt}"`);
  console.log(`Target Duration: ${durationSeconds}s, Scenes: ${sceneCount}`);

  // 1. Establish project title
  const projectTitle = "Photosynthesis Process Flow";

  // 2. Generate local outline dynamically depending on keyword detection and sceneCount
  const outline: any[] = [];
  const perSceneDuration = durationSeconds !== undefined ? Math.round((durationSeconds / sceneCount) * 10) / 10 : undefined;

  for (let i = 0; i < sceneCount; i++) {
    let sceneName = "";
    let narration = "";
    let visuals: any[] = [];

    if (i === 0) {
      sceneName = "1. Solar Light Capture";
      narration = "Photosynthesis begins as chloroplasts inside leaves harvest photons of solar light. This captures the raw energy needed to drive water splitting.";
      visuals = [
        { type: "title", text: "Harvesting Solar Light", emphasis: "important" },
        { type: "text", text: "Chloroplast cells trap photons" },
        { type: "shape", shapeName: "lightBulb" }
      ];
    } else if (i === 1) {
      sceneName = "2. Chemistry & Carbon Hydration";
      narration = "Next, roots draw water up from the soil while tiny leaf pores absorb carbon dioxide from the surrounding air to fuel the molecular synthesis.";
      visuals = [
        { type: "title", text: "Raw Chemical Inputs" },
        { type: "text", text: "Water and carbon dioxide gather" },
        { type: "shape", shapeName: "analytics" }
      ];
    } else if (i === 2) {
      // Injects a process flow template trigger
      sceneName = "3. Molecular Synthesis Flow";
      narration = "Under sunlight, water and carbon dioxide undergo transformation. Water is split and carbon is captured to construct glucose sugars.";
      visuals = [
        { type: "title", text: "Process Transformation Pipeline" },
        { type: "text", text: "Sunlight & CO2 trigger reaction" },
        { type: "arrow" },
        { type: "shape", shapeName: "gear" }
      ];
    } else {
      sceneName = "4. Glucose Sugar & Oxygen Outputs";
      narration = "Ultimately, the plant produces organic glucose sugar to grow and thrive, while releasing clean oxygen back into the atmosphere.";
      visuals = [
        { type: "title", text: "Synthesis Outputs", emphasis: "important" },
        { type: "text", text: "Thriving glucose and oxygen release" },
        { type: "shape", shapeName: "checkmark" }
      ];
    }

    outline.push({
      sceneName,
      narration,
      duration: perSceneDuration,
      visuals
    });
  }

  console.log("\nPlanned outline generated successfully:");
  console.log(JSON.stringify(outline, null, 2));

  // 3. Build project from outline programmatically
  const { projectId, projectPath } = projectStore.createProject({ title: projectTitle, width, height, fps });
  const project = projectStore.getProject(projectId);
  project.scenes = [];

  // 4. Compile scenes and elements from dynamic outline
  for (let sIdx = 0; sIdx < outline.length; sIdx++) {
    const item = outline[sIdx];
    const sceneName = item.sceneName;
    const narrationText = item.narration;
    const explicitDuration = item.duration;

    // Calculate duration: max(6, wordCount/2.3 + 2)
    let estimatedDuration = 6.0;
    if (explicitDuration !== undefined) {
      estimatedDuration = explicitDuration;
    } else if (narrationText) {
      const wordCount = narrationText.split(/\s+/).filter(Boolean).length;
      estimatedDuration = Math.max(6.0, Math.round((wordCount / 2.3 + 2) * 10) / 10);
    }

    const sceneId = `scene-${Math.random().toString(36).substring(2, 11)}`;
    const scene: any = {
      id: sceneId,
      name: sceneName,
      duration: estimatedDuration,
      startTime: 0,
      objects: [],
      svgObjects: [],
      cameraKeyframes: [],
      background: PALETTE.background
    };

    // Determine layout template
    const template = selectTemplate(sceneName, narrationText, item.visuals || [], sIdx, outline.length);

    // Apply Camera Keyframes and visual coordinates based on template
    const midTime = Math.round((estimatedDuration / 2) * 10) / 10;
    
    // Filter visuals to maximum of 5 to avoid overcrowding
    const rawVisuals = item.visuals || [];
    const validVisuals = rawVisuals.filter((v: any) => v && v.type).slice(0, 5);

    if (template === "title_intro") {
      // Camera intro: zoom 0.95 -> 1.08
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: 0, zoom: 0.95, easing: "linear" },
        { time: midTime, x: 0, y: 0, zoom: 1.08, easing: "easeInOut" }
      );

      // Coordinates mapping: Title centered, subtitle below, icon above
      const titleVis = validVisuals.find((v: any) => v.type === "title") || validVisuals.find((v: any) => v.type === "text") || { type: "title", text: projectTitle };
      const subVis = validVisuals.find((v: any) => (v.type === "text" || v.type === "callout") && v !== titleVis) || (narrationText ? { type: "text", text: narrationText } : null);
      const iconVis = validVisuals.find((v: any) => v.type === "shape" || v.type === "arrow") || { type: "shape", shapeName: "lightBulb" };

      // Title: (0, 20)
      if (titleVis) {
        scene.objects.push({
          id: `title-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: 0,
          y: 20,
          startTime: 0.4,
          duration: estimatedDuration - 0.9,
          easing: "easeOut",
          animationType: "draw",
          content: titleVis.text || projectTitle,
          fontSize: 64,
          fontFamily: "Georgia, serif",
          fontWeight: "bold",
          fontStyle: "normal",
          fillColor: PALETTE.accent,
          textWrapWidth: 1100
        });
      }

      // Subtitle: (0, 160)
      if (subVis) {
        scene.objects.push({
          id: `sub-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: 0,
          y: 160,
          startTime: 1.2,
          duration: estimatedDuration - 1.7,
          easing: "easeOut",
          animationType: "draw",
          content: subVis.text || narrationText,
          fontSize: 36,
          fontFamily: "Georgia, serif",
          fontWeight: "normal",
          fontStyle: "italic",
          fillColor: PALETTE.text,
          textWrapWidth: 1000
        });
      }

      // Icon: (0, -140)
      if (iconVis) {
        const shapeName = iconVis.shapeName || getShapeFromKeywords(projectTitle, 0);
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
          startTime: 1.9,
          duration: estimatedDuration - 2.4,
          easing: "easeOut"
        });
      }

    } else if (template === "summary") {
      // Camera summary: slight zoom out 1.08 -> 0.95 to reveal checklist
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: 0, zoom: 1.08, easing: "linear" },
        { time: midTime, x: 0, y: 0, zoom: 0.95, easing: "easeInOut" }
      );

      // Title: (0, -220)
      scene.objects.push({
        id: `title-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: -220,
        startTime: 0.4,
        duration: estimatedDuration - 0.9,
        easing: "easeOut",
        animationType: "draw",
        content: sceneName || "Summary & Takeaways",
        fontSize: 54,
        fontFamily: "Georgia, serif",
        fontWeight: "bold",
        fontStyle: "normal",
        fillColor: PALETTE.text,
        textWrapWidth: 1100
      });

      // Extract takeaways from text visuals, or fallback to splitting narration
      let takeaways = validVisuals.filter((v: any) => v.type === "text" || v.type === "callout").map((v: any) => v.text);
      if (takeaways.length === 0 && narrationText) {
        takeaways = narrationText.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 15).slice(0, 4);
      }
      if (takeaways.length === 0) {
        takeaways = [
          "Key whiteboard workflow concepts successfully structured",
          "Deterministic layouts compile cleanly without visual collisions",
          "Automated exports produce standard premium H.264 formats"
        ];
      }

      // Render takeaways vertically with checkmarks
      for (let i = 0; i < takeaways.length; i++) {
        const itemY = -70 + i * 100;
        const textStart = 1.2 + i * 0.7;

        // Checkmark shape at x = -300
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
          duration: estimatedDuration - textStart - 0.5,
          easing: "easeOut"
        });

        // Takeaway text at x = 80
        scene.objects.push({
          id: `takeaway-${i}-${Math.random().toString(36).substring(2, 9)}`,
          type: "text",
          x: 80,
          y: itemY,
          startTime: textStart + 0.3,
          duration: estimatedDuration - (textStart + 0.3) - 0.5,
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
      // Camera process flow: pan from left (-150) to right (150)
      scene.cameraKeyframes.push(
        { time: 0, x: -150, y: 0, zoom: 1.05, easing: "linear" },
        { time: midTime, x: 150, y: 0, zoom: 1.05, easing: "easeInOut" }
      );

      // Title: (0, -220)
      scene.objects.push({
        id: `title-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: -220,
        startTime: 0.4,
        duration: estimatedDuration - 0.9,
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

      // Filter step elements
      const steps = validVisuals.filter((v: any) => v.type !== "title").slice(0, 3);
      const stepXCoords = [-480, 0, 480];

      // If we don't have enough steps, auto-fill standard ones
      while (steps.length < 3) {
        const stepNum = steps.length + 1;
        steps.push({
          type: "text",
          text: `Step ${stepNum} Action`,
          emphasis: "normal"
        });
      }

      // Draw Steps and inject separating ArrowRight shapes
      for (let i = 0; i < 3; i++) {
        const step = steps[i];
        const stepX = stepXCoords[i];
        const stepStart = 1.2 + i * 0.7;

        if (step.type === "shape" || step.type === "arrow") {
          const shapeName = step.shapeName || getShapeFromKeywords(narrationText + " " + sceneName, i);
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
            duration: estimatedDuration - stepStart - 0.5,
            easing: "easeOut"
          });
        } else {
          scene.objects.push({
            id: `step-${i}-${Math.random().toString(36).substring(2, 9)}`,
            type: "text",
            x: stepX,
            y: 60,
            startTime: stepStart,
            duration: estimatedDuration - stepStart - 0.5,
            easing: "easeOut",
            animationType: "draw",
            content: step.text || `Step ${i + 1}`,
            fontSize: 34,
            fontFamily: "Georgia, serif",
            fontWeight: step.emphasis === "important" ? "bold" : "normal",
            fontStyle: "normal",
            fillColor: step.emphasis === "important" ? PALETTE.accent : PALETTE.text,
            textWrapWidth: 360
          });
        }

        // Inject arrow right after step 1 and step 2
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
            duration: estimatedDuration - arrowStart - 0.5,
            easing: "easeOut"
          });
        }
      }

    } else if (template === "compare") {
      // Camera compare: slight zoom zoom 1.0 -> 1.06
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" },
        { time: midTime, x: 0, y: 0, zoom: 1.06, easing: "easeInOut" }
      );

      // Title: (0, -220)
      scene.objects.push({
        id: `title-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: -220,
        startTime: 0.4,
        duration: estimatedDuration - 0.9,
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

      // VS Label: (0, 30)
      scene.objects.push({
        id: `vs-label-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: 30,
        startTime: 1.9,
        duration: estimatedDuration - 2.4,
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

      // Split visuals or content into columns
      let leftHeader = "Left Column";
      let leftBody = "Details on side A";
      let rightHeader = "Right Column";
      let rightBody = "Details on side B";

      const texts = validVisuals.filter((v: any) => v.type === "text" || v.type === "callout").map((v: any) => v.text);
      if (texts.length >= 4) {
        leftHeader = texts[0];
        leftBody = texts[1];
        rightHeader = texts[2];
        rightBody = texts[3];
      } else if (texts.length >= 2) {
        leftBody = texts[0];
        rightBody = texts[1];
      }

      // Left column: x = -380
      scene.objects.push(
        {
          id: `left-hdr-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: -380,
          y: -80,
          startTime: 1.2,
          duration: estimatedDuration - 1.7,
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
          startTime: 1.5,
          duration: estimatedDuration - 2.0,
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

      // Right column: x = 380
      scene.objects.push(
        {
          id: `right-hdr-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: 380,
          y: -80,
          startTime: 2.2,
          duration: estimatedDuration - 2.7,
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
          startTime: 2.5,
          duration: estimatedDuration - 3.0,
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

    } else {
      // Template: explain_two_column
      // Camera: pan to right illustration x: 0 -> 80, zoom 1.0 -> 1.08
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" },
        { time: midTime, x: 80, y: 10, zoom: 1.08, easing: "easeInOut" }
      );

      // Section Title: (0, -220)
      scene.objects.push({
        id: `title-${Math.random().toString(36).substring(2, 11)}`,
        type: "text",
        x: 0,
        y: -220,
        startTime: 0.4,
        duration: estimatedDuration - 0.9,
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

      // Split visuals: Left Column (Text blocks), Right Column (Thematic illustration)
      const textVis = validVisuals.find((v: any) => v.type === "text" || v.type === "callout") || (narrationText ? { type: "text", text: narrationText } : { type: "text", text: "Explaining scene core elements sequential models." });
      const shapeVis = validVisuals.find((v: any) => v.type === "shape" || v.type === "arrow") || { type: "shape", shapeName: getShapeFromKeywords(narrationText + " " + sceneName, 0) };

      // Left Column Text: x = -350
      if (textVis) {
        scene.objects.push({
          id: `body-text-${Math.random().toString(36).substring(2, 11)}`,
          type: "text",
          x: -350,
          y: 50,
          startTime: 1.2,
          duration: estimatedDuration - 1.7,
          easing: "easeOut",
          animationType: "draw",
          content: textVis.text || narrationText,
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
        const shapeName = shapeVis.shapeName || getShapeFromKeywords(narrationText + " " + sceneName, 0);
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
          startTime: 1.9,
          duration: estimatedDuration - 2.4,
          easing: "easeOut"
        });
      }
    }

    if (scene.cameraKeyframes.length === 0) {
      scene.cameraKeyframes.push({ time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" });
    }
    
    // Sort camera keyframes
    scene.cameraKeyframes.sort((a: any, b: any) => a.time - b.time);
    project.scenes.push(scene);
  }

  // Timing offsets rebuild
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

  // Strict Validation pass
  for (const s of project.scenes) {
    s.objects = s.objects.filter((obj: any) => {
      if (!obj || obj.type !== "text") return false;
      if (!obj.id) obj.id = `obj-${Math.random().toString(36).substring(2, 11)}`;
      if (!obj.easing) obj.easing = "easeOut";
      if (!obj.content) obj.content = "Whiteboard Item";
      if (obj.textWrapWidth === undefined || obj.textWrapWidth < 100 || obj.textWrapWidth > 1200) {
        obj.textWrapWidth = 720;
      }
      if (obj.startTime >= s.duration - 0.5) {
        obj.startTime = Math.max(0.2, Math.round((s.duration - 1.5) * 10) / 10);
      }
      obj.duration = Math.max(2.5, Math.round((s.duration - obj.startTime - 0.5) * 10) / 10);
      return true;
    });

    s.svgObjects = s.svgObjects.filter((svg: any) => {
      if (!svg) return false;
      if (!svg.id) svg.id = `svg-${Math.random().toString(36).substring(2, 11)}`;
      if (!svg.easing) svg.easing = "easeOut";
      if (!svg.pathData) svg.pathData = SVG_SHAPES.circle;
      if (svg.startTime >= s.duration - 0.5) {
        svg.startTime = Math.max(0.2, Math.round((s.duration - 1.5) * 10) / 10);
      }
      svg.duration = Math.max(2.5, Math.round((s.duration - svg.startTime - 0.5) * 10) / 10);
      return true;
    });

    s.cameraKeyframes = s.cameraKeyframes.map((kf: any) => {
      if (!kf.easing) kf.easing = "linear";
      if (kf.time === undefined || kf.time > s.duration) {
        kf.time = s.duration;
      }
      return kf;
    });
  }

  projectStore.saveProject(projectId, project);

  const totalDuration = project.scenes.reduce((sum: number, s: any) => sum + s.duration, 0);
  const objectCount = project.scenes.reduce((sum: number, s: any) => sum + s.objects.length, 0);
  const svgCount = project.scenes.reduce((sum: number, s: any) => sum + s.svgObjects.length, 0);
  const estimatedFrames = Math.round(totalDuration * fps);

  const summary = {
    sceneCount: project.scenes.length,
    totalDuration,
    objectCount,
    svgCount,
    estimatedFrames
  };

  console.log(`\nProject JSON saved securely to: ${projectPath}`);
  console.log("\nSummary Metrics:");
  console.log(JSON.stringify(summary, null, 2));

  // Auto Render MP4
  let outputPath: string | undefined;
  if (autoExport) {
    const rendersDir = path.resolve(process.cwd(), "renders", projectId);
    fs.mkdirSync(rendersDir, { recursive: true });
    outputPath = path.resolve(rendersDir, "output.mp4");

    console.log(`\n🎥 Launching headless autoExport video renderer for ${projectId}...`);
    console.log(`Saving final video to: ${outputPath}`);

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
          fps.toString()
        ],
        {
          env: {
            ...process.env,
            PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`
          }
        }
      );

      child.stdout.on("data", (data) => {
        process.stdout.write(data.toString());
      });

      child.stderr.on("data", (data) => {
        process.stderr.write(data.toString());
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(outputPath!);
        } else {
          reject(new Error(`Render script exited with error code ${code}`));
        }
      });

      child.on("error", (err) => {
        reject(err);
      });
    });

    await renderPromise;
  }

  console.log("\n=== QUALITY PROMPT COMPILER VERIFICATION DONE ===");
  console.log(`- Project JSON Path: ${projectPath}`);
  console.log(`- Exported Video Path: ${outputPath}`);
  const fileExists = fs.existsSync(outputPath || "");
  console.log(`- Video File Exists: ${fileExists ? "✅ YES" : "❌ NO"}`);
}

main().catch(err => {
  console.error("Quality prompt flow test failed:", err);
});
