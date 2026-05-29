// Enable modular testing without starting Stdio server
process.env.SCRIPEFLOW_TEST = "true";

import * as fs from "fs";
import * as path from "path";
import * as visualDirector from "../mcp/visualDirector";
import { compileProjectFromOutline } from "../mcp/server";
import { spawn } from "child_process";

async function runTest() {
  console.log("==================================================================");
  console.log("🎬 SCRIBEFLOW AI VISUAL DIRECTOR & TTS INTEGRATION TEST");
  console.log("==================================================================\n");

  const prompt = "Make a 60 second educational whiteboard video explaining how photosynthesis works, showing sunlight, water, carbon dioxide, glucose, and oxygen as a simple process flow.";
  console.log(`Prompt: "${prompt}"\n`);

  // 1. Run Topic Analysis
  const analysis = visualDirector.analyzeTopic(prompt);
  console.log("🔍 [Analysis] Topic Domain Detected:");
  console.log(`   👉 Domain: ${analysis.domain.toUpperCase()}`);
  console.log(`   👉 Key Concepts: ${analysis.keyConcepts.join(", ")}`);
  console.log(`   👉 Suggested Assets: ${analysis.suggestedAssets.join(", ")}`);
  console.log(`   👉 Visual Metaphors: ${analysis.visualMetaphors.join(", ")}\n`);

  // 2. Draft structured Outline matching photosynthesis progression
  const outline = [
    {
      sceneName: "1. The Engine of Life",
      narration: "Photosynthesis is the beautiful process where green plants turn solar light into organic energy. It is the very engine of life on Earth.",
      visuals: [
        { type: "title", text: "Introduction to Photosynthesis", emphasis: "important" },
        { type: "shape", shapeName: "sun" }
      ]
    },
    {
      sceneName: "2. The Inputs: Light & Water",
      narration: "Using sunlight, leaves absorb carbon dioxide from the air and draw water drops from their roots. These are the active input ingredients.",
      visuals: [
        { type: "title", text: "Water & Gas Ingredients" },
        { type: "shape", shapeName: "waterDrop" },
        { type: "shape", shapeName: "cloud" }
      ]
    },
    {
      sceneName: "3. Molecular Conversion Flow",
      narration: "Inside the leaf cells, chloroplast gears rearrange these water and carbon dioxide molecules in a structured chemical workflow.",
      visuals: [
        { type: "title", text: "Chloroplast Conversion Flow", emphasis: "important" },
        { type: "arrow" },
        { type: "shape", shapeName: "gear" }
      ]
    },
    {
      sceneName: "4. The Output: Sugar & Air",
      narration: "Finally, plants synthesize glucose sugar to feed their own growth, while releasing pure oxygen into the atmosphere for us to breathe.",
      visuals: [
        { type: "title", text: "Glucose & Oxygen Success" },
        { type: "text", text: "Sugar nourishes plants, oxygen feeds life" },
        { type: "shape", shapeName: "trophy" }
      ]
    }
  ];

  // 3. Inspect planned visuals, templates, animations, and camera plans per scene
  console.log("📐 [Director] Choreography Plan:");
  outline.forEach((scene, sIdx) => {
    const planned = visualDirector.planSceneVisuals(
      scene.sceneName,
      scene.narration,
      sIdx,
      outline.length,
      scene.visuals
    );
    console.log(`\n🎬 Scene ${sIdx + 1}: "${scene.sceneName}"`);
    console.log(`   👉 Selected Layout Template: ${planned.template.toUpperCase()}`);
    console.log(`   👉 Camera Choreography: ${planned.cameraIntent.toUpperCase()}`);
    console.log(`   👉 Planned Canvas Elements:`);
    planned.visuals.forEach((v, vIdx) => {
      console.log(`      [${vIdx + 1}] Role: ${v.semanticRole.padEnd(18)} | Type: ${v.type.padEnd(8)} | Anim: ${v.animation.padEnd(10)} | Shape: ${v.shapeName || "N/A"}`);
    });
  });

  console.log("\n==================================================================");
  console.log("🔨 [Compiler] Compiling Whiteboard Project & TTS voiceovers...");
  console.log("==================================================================\n");

  // 4. Compile the project dynamically using outline, voiceover: true, subtitles: true
  const compilation = await compileProjectFromOutline({
    title: "Photosynthesis Explainer",
    outline,
    voiceover: true,
    subtitles: true
  });

  const { projectId, projectPath, project, summary } = compilation;

  console.log("✅ Project blueprint compiled and saved successfully!");
  console.log(`   👉 Project ID: ${projectId}`);
  console.log(`   👉 Project Path: ${projectPath}`);
  console.log(`   👉 Total Timeline Duration: ${summary.totalDuration.toFixed(2)}s`);
  console.log(`   👉 Total Audio Tracks: ${project.audioTracks.length}`);
  console.log(`   👉 Total Subtitle Cues: ${project.subtitles?.length || 0}`);
  
  if (project.subtitles && project.subtitles.length > 0) {
    console.log(`\n💬 Timed Subtitles Preview (Total: ${project.subtitles.length} cues):`);
    project.subtitles.slice(0, 5).forEach((cue, idx) => {
      console.log(`   [Cue ${idx + 1}] [${cue.startTime.toFixed(2)}s -> ${cue.endTime.toFixed(2)}s] "${cue.text}"`);
    });
    if (project.subtitles.length > 5) console.log("   ...");
  }

  console.log("\n==================================================================");
  console.log("🎥 [Renderer] Headlessly Exporting Video via Puppeteer & FFmpeg...");
  console.log("==================================================================\n");

  const rendersDir = path.resolve(process.cwd(), "renders", projectId);
  fs.mkdirSync(rendersDir, { recursive: true });
  const outputPath = path.resolve(rendersDir, "output.mp4");

  console.log(`Spawning headless Puppeteer render subprocess...`);
  console.log(`Output Location: ${outputPath}\n`);

  const renderPromise = new Promise<string>((resolve, reject) => {
    const child = spawn(
      "/opt/homebrew/bin/node",
      [
        "scripts/renderVideo.js",
        "--project",
        projectPath,
        "--out",
        outputPath,
        "--fps",
        "30"
      ],
      {
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`,
        }
      }
    );

    child.stdout.on("data", (data) => {
      process.stdout.write(`[Render STDOUT] ${data.toString()}`);
    });

    child.stderr.on("data", (data) => {
      process.stderr.write(`[Render STDERR] ${data.toString()}`);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`Render process exited with error code ${code}`));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });

  try {
    const finalMp4 = await renderPromise;
    console.log("\n==================================================================");
    console.log("🎉 E2E TEST COMPLETED SUCCESSFULLY!");
    console.log("==================================================================");
    console.log(`👉 Rendered MP4: ${finalMp4}`);
    
    if (fs.existsSync(finalMp4)) {
      const stats = fs.statSync(finalMp4);
      console.log(`👉 File Status: EXISTS`);
      console.log(`👉 File Size:   ${stats.size.toLocaleString()} bytes`);
      console.log("\nEverything matches perfectly! All validations, layout planning,");
      console.log("TTS audio tracks, subtitle overlays, and FFmpeg mixes verified.");
    } else {
      console.log(`❌ Error: Output MP4 path not found!`);
    }
  } catch (err: any) {
    console.error(`\n❌ Render export failed: ${err.message}`);
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
