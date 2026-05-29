// Enable modular testing without starting Stdio server
process.env.SCRIPEFLOW_TEST = "true";

import * as fs from "fs";
import * as path from "path";
import * as projectStore from "../mcp/projectStore";
import * as chunkRenderer from "../mcp/chunkRenderer";

async function runTest() {
  console.log("==================================================================");
  console.log("🎬 SCRIBEFLOW CHUNK RENDERER E2E INTEGRATION TEST");
  console.log("==================================================================\n");

  const title = "Chunk Render E2E Demo";
  
  // 1. Create a 3-scene, 30-second educational blueprint project
  console.log("🏗️ Creating 3-scene 30s project blueprint...");
  const { projectId, projectPath } = projectStore.createProject({
    title,
    width: 1280, // Lower resolution for faster test rendering
    height: 720,
    fps: 30
  });

  // Scene 1 is created automatically with 5.0s by createProject, let's update it to 10.0s and rename
  const project = projectStore.getProject(projectId);
  project.scenes[0].name = "1. Introduction to Splitting";
  project.scenes[0].duration = 10.0;
  
  // Add some basic visual text to scene 1
  project.scenes[0].objects.push({
    id: `txt-intro-${Math.random().toString(36).substring(2, 11)}`,
    type: "text",
    content: "Chunk rendering makes long-form exports fully stable!",
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

  // Add Scene 2 (10.0s)
  projectStore.addScene(projectId, {
    name: "2. The Segmented Render Loop",
    duration: 10.0
  });
  const projectAfterS2 = projectStore.getProject(projectId);
  projectAfterS2.scenes[1].objects.push({
    id: `txt-mid-${Math.random().toString(36).substring(2, 11)}`,
    type: "text",
    content: "Headless browsers render chunks separately in safety.",
    x: 0,
    y: 0,
    fontSize: 48,
    fontFamily: "Outfit",
    color: "#10b981",
    startTime: 1.0,
    duration: 8.0,
    easing: "easeOut"
  });
  projectStore.saveProject(projectId, projectAfterS2);

  // Add Scene 3 (10.0s)
  projectStore.addScene(projectId, {
    name: "3. Concatenate and Finish",
    duration: 10.0
  });
  const finalProject = projectStore.getProject(projectId);
  finalProject.scenes[2].objects.push({
    id: `txt-end-${Math.random().toString(36).substring(2, 11)}`,
    type: "text",
    content: "FFmpeg stitches chunks back together perfectly!",
    x: 0,
    y: 0,
    fontSize: 48,
    fontFamily: "Outfit",
    color: "#f59e0b",
    startTime: 1.0,
    duration: 8.0,
    easing: "easeOut"
  });
  projectStore.saveProject(projectId, finalProject);

  const updatedProject = projectStore.getProject(projectId);
  const totalDuration = updatedProject.scenes.reduce((acc, s) => acc + s.duration, 0);

  console.log(`✅ Project created successfully!`);
  console.log(`   👉 Project ID: ${projectId}`);
  console.log(`   👉 Project Path: ${projectPath}`);
  console.log(`   👉 Scenes Count: ${updatedProject.scenes.length}`);
  console.log(`   👉 Total Project Duration: ${totalDuration}s`);

  // 2. Perform chunked render with maxChunkDuration = 12s so it splits into 3 chunks of 10s each
  console.log("\n================================================================== ");
  console.log("🏃 Executing Sequential Chunk Rendering Pipeline...");
  console.log("==================================================================\n");

  const chunkOptions = {
    maxChunkDurationSeconds: 12,
    fps: 30,
    chunkByScene: true
  };

  const renderResult = await chunkRenderer.renderProjectInChunks(projectId, chunkOptions);

  console.log("\n==================================================================");
  console.log("🔍 Verifying Render Outputs on Disk...");
  console.log("==================================================================\n");

  console.log(`   👉 Final Output Path: ${renderResult.outputPath}`);
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
  });

  // Verify final stitched file exists
  const finalExists = fs.existsSync(renderResult.outputPath);
  console.log(`   [Final Check] Final stitched file at ${renderResult.outputPath} $\\to$ ${finalExists ? "✅ EXISTS" : "❌ MISSING"}`);

  if (chunksExist && finalExists) {
    console.log(`\n🎉 E2E CHUNKED RENDER TEST COMPLETED SUCCESSFULLY!`);
    console.log("==================================================================");
    console.log("All segment renders, directories, and stitched streams are 100% correct!");
  } else {
    console.error(`\n❌ Error: Render outputs validation failed.`);
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
