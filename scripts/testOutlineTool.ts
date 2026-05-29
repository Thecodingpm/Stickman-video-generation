import * as projectStore from "../mcp/projectStore";
import { SVG_SHAPES } from "../src/core/svgShapes";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

async function main() {
  console.log("=== STARTING ADVANCED OUTLINE COMPILER VERIFICATION ===");

  const title = "Photosynthesis Made Simple";
  const autoExport = true;
  const fps = 30;

  const outline = [
    {
      sceneName: "The Intake",
      narration: "Photosynthesis begins as leaves absorb solar light and draw water from the soil to prepare for energy production.",
      cameraIntent: "zoom_in" as const,
      visuals: [
        { type: "title" as const, text: "Photosynthesis: The Intake" },
        { type: "text" as const, text: "Leaves harvest solar fuel" },
        { type: "shape" as const, shapeName: "lightBulb", emphasis: "important" as const }
      ]
    },
    {
      sceneName: "The Process",
      narration: "Carbon dioxide combines with water under sunlight inside chloroplasts, transforming molecules into chemical sugars.",
      cameraIntent: "pan_center" as const,
      visuals: [
        { type: "title" as const, text: "The Molecular Chemistry" },
        { type: "arrow" as const },
        { type: "shape" as const, shapeName: "gear", emphasis: "normal" as const }
      ]
    },
    {
      sceneName: "The Output",
      narration: "The final step releases vital oxygen back into our atmosphere, producing healthy organic glucose for the plant.",
      cameraIntent: "zoom_out" as const,
      visuals: [
        { type: "title" as const, text: "Glucose & Oxygen Output" },
        { type: "text" as const, text: "Healthy plant systems thrive" },
        { type: "shape" as const, shapeName: "checkmark", emphasis: "important" as const }
      ]
    }
  ];

  console.log("Input Title:", title);
  console.log("Outline Scenes count:", outline.length);

  // 1. Create base project
  const { projectId, projectPath } = projectStore.createProject({ title, width: 1920, height: 1080, fps });
  const project = projectStore.getProject(projectId);

  // Clear default starter scene to build dynamically from outline
  project.scenes = [];

  // 2. Compile scenes and elements from outline
  for (let sIdx = 0; sIdx < outline.length; sIdx++) {
    const item = outline[sIdx];
    const sceneName = item.sceneName;
    const narration = item.narration;
    const cameraIntent = item.cameraIntent;

    // Estimate scene duration: max(6, wordCount / 2.3 + 2)
    const wordCount = narration.split(/\s+/).filter(Boolean).length;
    const estimatedDuration = Math.max(6.0, Math.round((wordCount / 2.3 + 2) * 10) / 10);

    console.log(`🎬 Compiling scene "${sceneName}" (${estimatedDuration}s, ${wordCount} words)`);

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

    // Configure Camera Keyframes based on cameraIntent
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

    // Lay out visuals using templates
    const visuals = item.visuals;
    const N = visuals.length;

    for (let vIdx = 0; vIdx < N; vIdx++) {
      const vis = visuals[vIdx];
      const elementId = `element-${Math.random().toString(36).substring(2, 11)}`;
      const emphasis = (vis as any).emphasis || "normal";

      // Determine templates layout
      let x = 0;
      let y = 0;
      if (N === 1) {
        x = 0; y = 0;
      } else if (N === 2) {
        x = vIdx === 0 ? -250 : 250;
        y = 0;
      } else if (N === 3) {
        // title top + two columns
        if (vIdx === 0) {
          x = 0; y = -220;
        } else if (vIdx === 1) {
          x = -250; y = 80;
        } else {
          x = 250; y = 80;
        }
      } else {
        // Grid layout
        const row = Math.floor(vIdx / 2);
        const col = vIdx % 2;
        x = col === 0 ? -250 : 250;
        y = -180 + row * 250;
      }

      // Stagger timings
      const startTime = 0.5 + vIdx * 0.8;
      const elementDuration = 2.5;

      // Color scaling emphasis
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

      // Convert visual types
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

  // Rebuild timings
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

  // Auto-export rendering
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

  console.log("\n=== OUTLINE COMPILER VERIFICATION DONE ===");
  console.log(`- Project JSON Path: ${projectPath}`);
  console.log(`- Exported Video Path: ${outputPath}`);
  const fileExists = fs.existsSync(outputPath || "");
  console.log(`- Video File Exists: ${fileExists ? "✅ YES" : "❌ NO"}`);
}

main().catch(err => {
  console.error("Outline flow test failed:", err);
});
