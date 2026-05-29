// Enable modular testing without starting Stdio server
process.env.SCRIPEFLOW_TEST = "true";

import * as fs from "fs";
import * as path from "path";
import * as projectStore from "../mcp/projectStore";
import * as chunkRenderer from "../mcp/chunkRenderer";

async function runTest() {
  console.log("==================================================================");
  console.log("🎬 SCRIBEFLOW PARALLEL CHUNK RENDERER E2E INTEGRATION TEST");
  console.log("==================================================================\n");

  const title = "Parallel Chunk Render E2E Demo";

  // 1. Create a 4-scene, 40-second educational blueprint project
  console.log("🏗️ Creating 4-scene 40s project blueprint...");
  const { projectId, projectPath } = projectStore.createProject({
    title,
    width: 1280, // Lower resolution for faster test execution
    height: 720,
    fps: 30
  });

  // Scene 1
  const project = projectStore.getProject(projectId);
  project.scenes[0].name = "1. Welcome & Introduction";
  project.scenes[0].duration = 10.0;
  project.scenes[0].objects.push({
    id: `txt-s1-${Math.random().toString(36).substring(2, 11)}`,
    type: "text",
    content: "Parallel whiteboards render faster!",
    x: 0,
    y: 0,
    fontSize: 48,
    fontFamily: "Outfit",
    color: "#6366f1",
    startTime: 1.0,
    duration: 8.0,
    easing: "easeOut"
  });
  projectStore.saveProject(projectId, project);

  // Scene 2
  projectStore.addScene(projectId, {
    name: "2. Controlled Concurrency Layers",
    duration: 10.0
  });
  const projectS2 = projectStore.getProject(projectId);
  projectS2.scenes[1].objects.push({
    id: `txt-s2-${Math.random().toString(36).substring(2, 11)}`,
    type: "text",
    content: "Multiple headless instances run concurrently.",
    x: 0,
    y: 0,
    fontSize: 48,
    fontFamily: "Outfit",
    color: "#10b981",
    startTime: 1.0,
    duration: 8.0,
    easing: "easeOut"
  });
  projectStore.saveProject(projectId, projectS2);

  // Scene 3
  projectStore.addScene(projectId, {
    name: "3. Robust Error Cascade Blockers",
    duration: 10.0
  });
  const projectS3 = projectStore.getProject(projectId);
  projectS3.scenes[2].objects.push({
    id: `txt-s3-${Math.random().toString(36).substring(2, 11)}`,
    type: "text",
    content: "Cascade abort triggers prevent incomplete stitches.",
    x: 0,
    y: 0,
    fontSize: 48,
    fontFamily: "Outfit",
    color: "#f59e0b",
    startTime: 1.0,
    duration: 8.0,
    easing: "easeOut"
  });
  projectStore.saveProject(projectId, projectS3);

  // Scene 4
  projectStore.addScene(projectId, {
    name: "4. E2E Compilation & Summary",
    duration: 10.0
  });
  const finalProject = projectStore.getProject(projectId);
  finalProject.scenes[3].objects.push({
    id: `txt-s4-${Math.random().toString(36).substring(2, 11)}`,
    type: "text",
    content: "Final demuxer merges all parallel pieces together.",
    x: 0,
    y: 0,
    fontSize: 48,
    fontFamily: "Outfit",
    color: "#ec4899",
    startTime: 1.0,
    duration: 8.0,
    easing: "easeOut"
  });
  projectStore.saveProject(projectId, finalProject);

  const updatedProject = projectStore.getProject(projectId);
  const totalDuration = updatedProject.scenes.reduce((acc, s) => acc + s.duration, 0);

  console.log(`✅ Parallel Project created successfully!`);
  console.log(`   👉 Project ID: ${projectId}`);
  console.log(`   👉 Scenes Count: ${updatedProject.scenes.length}`);
  console.log(`   👉 Total Project Duration: ${totalDuration}s`);

  // 2. Perform parallel chunked render with concurrency = 2 and maxChunkDuration = 10s
  console.log("\n==================================================================");
  console.log("🏃 Executing Controlled Parallel Chunk Rendering Pipeline...");
  console.log("==================================================================\n");

  const chunkOptions = {
    maxChunkDurationSeconds: 10,
    fps: 30,
    chunkByScene: true,
    concurrency: 2
  };

  const renderResult = await chunkRenderer.renderProjectInChunks(projectId, chunkOptions);

  console.log("\n==================================================================");
  console.log("🔍 Verifying Parallel Render Outputs on Disk...");
  console.log("==================================================================\n");

  console.log(`   👉 Final Stitched Output Path: ${renderResult.outputPath}`);
  console.log(`   👉 Total Chunks rendered: ${renderResult.chunkCount}`);
  console.log(`   👉 Total Render Time: ${renderResult.renderSeconds.toFixed(1)}s`);

  // Verify chunk files exist
  let chunksExist = true;
  renderResult.chunks.forEach((chunk) => {
    const chunkPath = path.resolve(process.cwd(), "renders", projectId, "chunks", `${chunk.chunkId}.mp4`);
    const exists = fs.existsSync(chunkPath);
    console.log(`   [Chunk Check] ${chunk.chunkId} (${chunk.startTime}s - ${chunk.endTime}s) at ${chunkPath} $\\to$ ${exists ? "✅ EXISTS" : "❌ MISSING"}`);
    if (!exists) {
      chunksExist = false;
    }
    
    // Frames directories MUST be fully cleaned up
    const chunkFramesDir = path.resolve(process.cwd(), "renders", projectId, "chunks", chunk.chunkId);
    const framesFolderExists = fs.existsSync(chunkFramesDir);
    console.log(`   [Frames Cleanup Check] ${chunk.chunkId} frames folder at ${chunkFramesDir} $\\to$ ${!framesFolderExists ? "✅ CLEANED UP" : "❌ STILL EXISTS"}`);
    if (framesFolderExists) {
      chunksExist = false;
    }
  });

  // Verify final stitched file exists
  const finalExists = fs.existsSync(renderResult.outputPath);
  console.log(`   [Final Check] Final stitched file at ${renderResult.outputPath} $\\to$ ${finalExists ? "✅ EXISTS" : "❌ MISSING"}`);

  if (chunksExist && finalExists && renderResult.chunkCount >= 4) {
    console.log(`\n🎉 E2E PARALLEL CHUNKED RENDER TEST COMPLETED SUCCESSFULLY!`);
    console.log("==================================================================");
    console.log("Controlled concurrency works perfectly! Frames cleaned up and output stitched.");
  } else {
    console.error(`\n❌ Error: Parallel render outputs validation failed.`);
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
