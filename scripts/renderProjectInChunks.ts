// Enable modular execution of the chunk renderer via CLI
process.env.SCRIPEFLOW_TEST = "true";

import * as fs from "fs";
import * as path from "path";
import * as chunkRenderer from "../mcp/chunkRenderer";

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    project: "",
    out: "",
    fps: 30,
    concurrency: 2,
    maxChunkDurationSeconds: 90
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project" && args[i + 1]) {
      params.project = args[i + 1];
      i++;
    } else if (args[i] === "--out" && args[i + 1]) {
      params.out = args[i + 1];
      i++;
    } else if (args[i] === "--fps" && args[i + 1]) {
      params.fps = parseInt(args[i + 1], 10) || 30;
      i++;
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      params.concurrency = parseInt(args[i + 1], 10) || 2;
      i++;
    } else if (args[i] === "--maxChunkDurationSeconds" && args[i + 1]) {
      params.maxChunkDurationSeconds = parseFloat(args[i + 1]) || 90;
      i++;
    }
  }

  return params;
}

async function main() {
  const params = parseArgs();

  if (!params.project) {
    console.error("❌ Error: Missing required parameter '--project <path-to-json-file>'");
    process.exit(1);
  }
  if (!params.out) {
    console.error("❌ Error: Missing required parameter '--out <output-mp4-path>'");
    process.exit(1);
  }

  const projectPath = path.resolve(params.project);
  const outputPath = path.resolve(params.out);

  if (!fs.existsSync(projectPath)) {
    console.error(`❌ Error: Project file does not exist at: ${projectPath}`);
    process.exit(1);
  }

  // Find the projectId from the filename
  const projectId = path.basename(projectPath, ".json");

  console.log(`🎬 Loaded CLI chunk renderer for Project ID: "${projectId}"`);
  console.log(`   👉 Output: ${outputPath}`);
  console.log(`   👉 FPS: ${params.fps}`);
  console.log(`   👉 Concurrency: ${params.concurrency}`);
  console.log(`   👉 Max Chunk Duration: ${params.maxChunkDurationSeconds}s\n`);

  try {
    const result = await chunkRenderer.renderProjectInChunks(projectId, {
      maxChunkDurationSeconds: params.maxChunkDurationSeconds,
      fps: params.fps,
      concurrency: params.concurrency
    });

    // Copy stitched output to specified out location if different
    if (path.resolve(result.outputPath) !== outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.copyFileSync(result.outputPath, outputPath);
      console.log(`🚀 Final stitched video copied to target location: ${outputPath}`);
    }

    console.log(`\n🎉 E2E Parallel Chunked Video Render Successful! Saved to ${outputPath}\n`);
    process.exit(0);
  } catch (err: any) {
    console.error(`\n❌ Parallel Chunked Render Failed:`, err.message);
    process.exit(1);
  }
}

main();
