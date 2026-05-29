import * as projectStore from "../mcp/projectStore";
import { SVG_SHAPES } from "../src/core/svgShapes";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

async function main() {
  console.log("=== STARTING HIGH-LEVEL PROMPT AUTOMATION VERIFICATION ===");

  const prompt = "Make a 45 second educational whiteboard video explaining photosynthesis for beginners";
  const durationSeconds = 45;
  const sceneCount = 4;
  const autoExport = true;
  const fps = 30;
  const width = 1920;
  const height = 1080;

  console.log(`Prompt: "${prompt}"`);
  console.log(`Target Duration: ${durationSeconds}s, Scenes: ${sceneCount}`);

  // 1. Establish project title
  const projectTitle = "Photosynthesis for Beginners";

  // 2. Helper to fetch shape key from prompt/text matching keyword rules
  const getShapeFromKeywords = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes("idea") || lower.includes("learn") || lower.includes("lesson") || lower.includes("know") || lower.includes("think")) return "lightBulb";
    if (lower.includes("business") || lower.includes("growth") || lower.includes("sales") || lower.includes("data") || lower.includes("stat") || lower.includes("analytics") || lower.includes("chart")) return "analytics";
    if (lower.includes("success") || lower.includes("win") || lower.includes("goal") || lower.includes("trophy") || lower.includes("achieve") || lower.includes("award")) return "trophy";
    if (lower.includes("tech") || lower.includes("software") || lower.includes("ai") || lower.includes("code") || lower.includes("computer") || lower.includes("laptop")) return "laptop";
    if (lower.includes("gear") || lower.includes("machine") || lower.includes("system") || lower.includes("process") || lower.includes("engine")) return "gear";
    if (lower.includes("world") || lower.includes("global") || lower.includes("climate") || lower.includes("nature") || lower.includes("earth") || lower.includes("space")) return "globe";
    if (lower.includes("steps") || lower.includes("flow") || lower.includes("next") || lower.includes("arrow")) return "arrowRight";
    return "checkmark";
  };

  // 3. Generate local outline dynamically depending on keyword detection and sceneCount
  const outline: any[] = [];
  const lowerPrompt = prompt.toLowerCase();

  // Topic detection
  const isPhotosynthesis = lowerPrompt.includes("photosynthesis") || lowerPrompt.includes("plant") || lowerPrompt.includes("leaf");
  const isSoftware = lowerPrompt.includes("software") || lowerPrompt.includes("ai") || lowerPrompt.includes("coding") || lowerPrompt.includes("developer");
  const isBusiness = lowerPrompt.includes("marketing") || lowerPrompt.includes("growth") || lowerPrompt.includes("startup") || lowerPrompt.includes("product") || lowerPrompt.includes("sales");

  // Distribute duration evenly
  const perSceneDuration = durationSeconds !== undefined ? Math.round((durationSeconds / sceneCount) * 10) / 10 : undefined;

  for (let i = 0; i < sceneCount; i++) {
    let sceneName = `Scene ${i + 1}`;
    let narration = "";
    let visuals: any[] = [];
    let cameraIntent: "static" | "zoom_in" | "zoom_out" | "pan_center" = "static";

    // Adapt scene progressions
    if (i === 0) {
      sceneName = "1. Solar Energy Input";
      cameraIntent = "zoom_in";
    } else if (i === sceneCount - 1) {
      sceneName = `${i + 1}. Sugar & Air Output`;
      cameraIntent = "zoom_out";
    } else {
      sceneName = `${i + 1}. Key Concept ${i}`;
      cameraIntent = i % 2 === 0 ? "pan_center" : "static";
    }

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
      } else if (i === 2) {
        sceneName = "3. Chloroplast Chemistry";
        narration = "Under sunlight inside plant cells, carbon dioxide and water molecules undergo a complex chemical transformation.";
        visuals = [
          { type: "title", text: "Molecular Transformation" },
          { type: "arrow" },
          { type: "shape", shapeName: "gear" }
        ];
      } else {
        sceneName = "4. Glucose Sugar & Clean Air";
        narration = "This chemical reaction yields organic glucose sugar to grow the plant, while releasing vital oxygen back into the atmosphere.";
        visuals = [
          { type: "title", text: "Sugar & Air Output", emphasis: "important" },
          { type: "text", text: "Healthy plant systems thrive" },
          { type: "shape", shapeName: "checkmark" }
        ];
      }
    } else {
      // General fallback
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
      visuals,
      cameraIntent
    });
  }

  console.log("\nPlanned outline generated successfully:");
  console.log(JSON.stringify(outline, null, 2));

  // 5. Build project from outline programmatically
  const { projectId, projectPath } = projectStore.createProject({ title: projectTitle, width, height, fps });
  const project = projectStore.getProject(projectId);
  project.scenes = [];

  // 6. Compile scenes and elements from dynamic outline
  for (let sIdx = 0; sIdx < outline.length; sIdx++) {
    const item = outline[sIdx];
    const sceneName = item.sceneName;
    const narrationText = item.narration;
    const explicitDuration = item.duration;
    const cameraIntent = item.cameraIntent;

    // timing estimation
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
      background: "#ffffff"
    };

    // camera Intent
    const midTime = Math.round((estimatedDuration / 2) * 10) / 10;
    if (cameraIntent === "zoom_in") {
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" },
        { time: midTime, x: 0, y: 0, zoom: 1.2, easing: "easeInOut" }
      );
    } else if (cameraIntent === "zoom_out") {
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: 0, zoom: 1.2, easing: "linear" },
        { time: midTime, x: 0, y: 0, zoom: 1.0, easing: "easeInOut" }
      );
    } else if (cameraIntent === "pan_center") {
      scene.cameraKeyframes.push(
        { time: 0, x: -80, y: 0, zoom: 1.1, easing: "linear" },
        { time: midTime, x: 80, y: 0, zoom: 1.1, easing: "easeInOut" }
      );
    } else {
      scene.cameraKeyframes.push(
        { time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" }
      );
    }

    // lay out visuals
    const visualsList = item.visuals || [];
    const N = visualsList.length;

    for (let vIdx = 0; vIdx < N; vIdx++) {
      const vis = visualsList[vIdx];
      const elementId = `element-${Math.random().toString(36).substring(2, 11)}`;
      const emphasis = vis.emphasis || "normal";

      let x = 0; let y = 0;
      if (N === 1) {
        x = 0; y = 0;
      } else if (N === 2) {
        x = vIdx === 0 ? -250 : 250; y = 0;
      } else if (N === 3) {
        if (vIdx === 0) {
          x = 0; y = -220;
        } else if (vIdx === 1) {
          x = -250; y = 80;
        } else {
          x = 250; y = 80;
        }
      } else {
        const row = Math.floor(vIdx / 2);
        const col = vIdx % 2;
        x = col === 0 ? -250 : 250;
        y = -180 + row * 250;
      }

      const startTime = 0.5 + vIdx * 0.8;
      const elementDuration = 2.5;

      let emphasisColor = "#1e293b";
      let strokeColor = "#1e293b";
      let scaleMultiplier = 1.5;
      let weightStyle: "normal" | "bold" = "normal";

      if (emphasis === "important") {
        emphasisColor = "#ef4444";
        strokeColor = "#ef4444";
        scaleMultiplier = 1.8;
        weightStyle = "bold";
      } else if (emphasis === "subtle") {
        emphasisColor = "#64748b";
        strokeColor = "#64748b";
        scaleMultiplier = 1.2;
      }

      if (vis.type === "title" || vis.type === "text" || vis.type === "callout") {
        const textContent = vis.text || "ScribeFlow";
        let fontSize = 32;
        let fontStyle: "normal" | "italic" = "normal";
        let textWrapWidth = 720;

        if (vis.type === "title") {
          fontSize = 48;
          weightStyle = "bold";
          textWrapWidth = 800;
        } else if (vis.type === "callout") {
          fontSize = 36;
          fontStyle = "italic";
          textWrapWidth = 600;
        }

        scene.objects.push({
          id: elementId,
          type: "text",
          x,
          y,
          startTime,
          duration: elementDuration,
          easing: "easeOut",
          animationType: "draw",
          content: textContent,
          fontSize,
          fontFamily: "Georgia, serif",
          fontWeight: weightStyle,
          fontStyle,
          fillColor: emphasisColor,
          textWrapWidth
        });
      } else if (vis.type === "shape" || vis.type === "arrow") {
        let shapeName = vis.shapeName || "circle";
        if (vis.type === "arrow") {
          shapeName = "arrowRight";
        }
        const pathData = (SVG_SHAPES as any)[shapeName] || SVG_SHAPES.circle;

        scene.svgObjects.push({
          id: elementId,
          pathData,
          x,
          y: y - 30,
          scaleX: scaleMultiplier,
          scaleY: scaleMultiplier,
          strokeColor: strokeColor,
          strokeWidth: 3,
          fillColor: "transparent",
          startTime,
          duration: elementDuration,
          easing: "easeOut"
        });
      }
    }

    scene.cameraKeyframes.sort((a: any, b: any) => a.time - b.time);
    project.scenes.push(scene);
  }

  // timings Rebuild
  let cursor = 0;
  for (const s of project.scenes) {
    let max = 0;
    for (const obj of s.objects) max = Math.max(max, obj.startTime + obj.duration);
    for (const obj of s.svgObjects) max = Math.max(max, obj.startTime + obj.duration);

    if (s.objects.length > 0 || s.svgObjects.length > 0) {
      s.duration = Math.max(s.duration || 0.5, max + 0.5);
    }
    s.startTime = cursor;
    cursor += s.duration;
  }

  projectStore.saveProject(projectId, project);
  console.log(`\nProject JSON saved securely to: ${projectPath}`);

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

  console.log("\n=== PROMPT COMPILER VERIFICATION DONE ===");
  console.log(`- Project JSON Path: ${projectPath}`);
  console.log(`- Exported Video Path: ${outputPath}`);
  const fileExists = fs.existsSync(outputPath || "");
  console.log(`- Video File Exists: ${fileExists ? "✅ YES" : "❌ NO"}`);
}

main().catch(err => {
  console.error("Prompt flow test failed:", err);
});
