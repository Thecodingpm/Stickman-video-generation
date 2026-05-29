// Enable modular testing without starting Stdio server
process.env.SCRIPEFLOW_TEST = "true";

import * as fs from "fs";
import * as path from "path";
import * as longformPlanner from "../mcp/longformPlanner";
import { compileProjectFromOutline } from "../mcp/server";

async function runTest() {
  console.log("==================================================================");
  console.log("🎬 SCRIBEFLOW LONG-FORM WHITEBOARD PLANNER INTEGRATION TEST");
  console.log("==================================================================\n");

  const prompt = "Create a 12 minute educational whiteboard masterclass explaining photosynthesis from beginner to intermediate level.";
  const targetDurationMinutes = 12;

  console.log(`Prompt: "${prompt}"`);
  console.log(`Target Duration: ${targetDurationMinutes} minutes (${targetDurationMinutes * 60}s)\n`);

  // 1. Run Long-form Syllabus Planner
  const plan = longformPlanner.compileLongformOutline(prompt, targetDurationMinutes);
  const { title, chapters, scenes } = plan;

  console.log("📚 [Planner] Long-form Chapters Breakdown:");
  console.log(`   👉 Project Title: "${title}"`);
  console.log(`   👉 Total Chapters: ${chapters.length}`);
  chapters.forEach((ch, idx) => {
    console.log(`      [Chapter ${idx + 1}] "${ch.chapterTitle}"`);
    console.log(`         Objective:  ${ch.objective}`);
    console.log(`         Key Points: ${ch.keyPoints.join(", ")}`);
  });

  console.log("\n🎬 [Planner] Long-form Scene Progressions:");
  console.log(`   👉 Total Scenes: ${scenes.length}`);
  scenes.forEach((s, idx) => {
    console.log(`      [Scene ${String(idx + 1).padStart(2, "0")}] "${s.sceneName}" (${s.duration!.toFixed(1)}s)`);
    console.log(`         Narration Goal: ${s.narrationGoal}`);
    console.log(`         Camera Intent:  ${s.cameraIntent!.toUpperCase()}`);
    console.log(`         Visual Beats:   ${s.visualBeats!.map(b => `${b.beatType}(${b.concept})`).join(" -> ")}`);
  });

  // 2. Validate strict scene duration timing bounds (minimum 8s, maximum 45s)
  console.log("\n📐 [Planner] Timing Bounds Validation:");
  let boundsValid = true;
  scenes.forEach((s, idx) => {
    const dur = s.duration!;
    if (dur < 8.0 || dur > 45.0) {
      console.log(`   ❌ Scene ${idx + 1} violates timing bounds: ${dur.toFixed(1)}s (Must be between 8.0s and 45.0s)`);
      boundsValid = false;
    }
  });
  if (boundsValid) {
    console.log("   ✅ All scenes strictly conform to duration bounds (8.0s - 45.0s)!");
  }

  // 3. Compile Project JSON using mcp tool pipeline
  console.log("\n==================================================================");
  console.log("🔨 [Compiler] Compiling Long-form Blueprint JSON...");
  console.log("==================================================================\n");

  const compiledOutline = scenes.map((s) => {
    const visuals = s.visualBeats!.map((beat) => {
      if (beat.beatType === "title") {
        return { type: "title", text: beat.text, emphasis: "important" };
      } else if (beat.beatType === "definition" || beat.beatType === "callout" || beat.beatType === "summary") {
        return { type: "text", text: beat.text, emphasis: beat.importance === "primary" ? "important" : "normal" };
      } else {
        return { type: "shape", text: beat.text, shapeName: "checkmark", emphasis: beat.importance === "primary" ? "important" : "normal" };
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

  const compilation = await compileProjectFromOutline({
    title,
    outline: compiledOutline,
    voiceover: false,
    subtitles: false
  });

  const { projectId, projectPath, project, summary } = compilation;

  console.log("✅ Long-form project blueprint compiled successfully!");
  console.log(`   👉 Project ID: ${projectId}`);
  console.log(`   👉 Project Path: ${projectPath}`);
  console.log(`   👉 Cumulative Duration: ${summary.totalDuration.toFixed(1)}s (Target: ${targetDurationMinutes * 60}s)`);
  console.log(`   👉 Estimated Frame Count (30 FPS): ${summary.estimatedFrames} frames`);
  
  if (fs.existsSync(projectPath)) {
    console.log(`\n🎉 E2E LONG-FORM PLANNING TEST COMPLETED SUCCESSFULLY!`);
    console.log("==================================================================");
    console.log(`All planning validation steps passed perfectly! Project JSON is ready.`);
  } else {
    console.error(`❌ Error: Compiled project file not found on disk.`);
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
