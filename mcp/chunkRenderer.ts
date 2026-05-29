import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn, execSync } from "child_process";
import * as projectStore from "./projectStore";

export interface RenderChunk {
  chunkId: string;
  startTime: number;
  endTime: number;
  duration: number;
  sceneIds: string[];
}

/**
 * Splits a project's sequential timeline into individual render chunks based on safety bounds.
 */
export function splitProjectIntoRenderChunks(
  project: any,
  options: { maxChunkDurationSeconds?: number; chunkByScene?: boolean } = {}
): RenderChunk[] {
  const maxChunkDurationSeconds = options.maxChunkDurationSeconds ?? 90;
  const chunkByScene = options.chunkByScene ?? true;

  const chunks: RenderChunk[] = [];
  let currentGlobalTime = 0;
  const scenes = project.scenes || [];

  if (chunkByScene) {
    let activeChunkSceneIds: string[] = [];
    let activeChunkStart = 0;
    let activeChunkDuration = 0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneId = scene.id || `scene-${i}`;
      const sceneDur = scene.duration;

      // If a single scene is longer than the max chunk duration, we must split it by time
      if (sceneDur > maxChunkDurationSeconds) {
        // Flush any active chunk first
        if (activeChunkSceneIds.length > 0) {
          chunks.push({
            chunkId: `chunk-${chunks.length + 1}`,
            startTime: activeChunkStart,
            endTime: activeChunkStart + activeChunkDuration,
            duration: activeChunkDuration,
            sceneIds: [...activeChunkSceneIds]
          });
          activeChunkSceneIds = [];
          activeChunkStart = currentGlobalTime;
          activeChunkDuration = 0;
        }

        // Split this big scene into segments
        let remainingSceneDur = sceneDur;
        let sceneSegmentStart = currentGlobalTime;
        while (remainingSceneDur > 0) {
          const segmentDur = Math.min(maxChunkDurationSeconds, remainingSceneDur);
          chunks.push({
            chunkId: `chunk-${chunks.length + 1}`,
            startTime: sceneSegmentStart,
            endTime: sceneSegmentStart + segmentDur,
            duration: segmentDur,
            sceneIds: [sceneId]
          });
          sceneSegmentStart += segmentDur;
          remainingSceneDur -= segmentDur;
        }
        currentGlobalTime += sceneDur;
        activeChunkStart = currentGlobalTime;
      } else {
        // If adding this scene to the active chunk exceeds max duration, flush it
        if (activeChunkDuration + sceneDur > maxChunkDurationSeconds && activeChunkSceneIds.length > 0) {
          chunks.push({
            chunkId: `chunk-${chunks.length + 1}`,
            startTime: activeChunkStart,
            endTime: activeChunkStart + activeChunkDuration,
            duration: activeChunkDuration,
            sceneIds: [...activeChunkSceneIds]
          });
          activeChunkSceneIds = [];
          activeChunkStart = currentGlobalTime;
          activeChunkDuration = 0;
        }

        activeChunkSceneIds.push(sceneId);
        activeChunkDuration += sceneDur;
        currentGlobalTime += sceneDur;
      }
    }

    // Flush any remaining active chunk
    if (activeChunkSceneIds.length > 0) {
      chunks.push({
        chunkId: `chunk-${chunks.length + 1}`,
        startTime: activeChunkStart,
        endTime: activeChunkStart + activeChunkDuration,
        duration: activeChunkDuration,
        sceneIds: activeChunkSceneIds
      });
    }
  } else {
    // Pure time-based chunking
    const totalDuration = scenes.reduce((acc: number, s: any) => acc + (s.duration || 0), 0);
    let start = 0;
    while (start < totalDuration) {
      const end = Math.min(totalDuration, start + maxChunkDurationSeconds);
      const duration = end - start;

      // Find sceneIds that overlap with this time window
      const sceneIds: string[] = [];
      let tempTime = 0;
      scenes.forEach((s: any, idx: number) => {
        const sStart = tempTime;
        const sEnd = tempTime + (s.duration || 0);
        tempTime = sEnd;

        // Check for overlap
        if (Math.max(start, sStart) < Math.min(end, sEnd)) {
          sceneIds.push(s.id || `scene-${idx}`);
        }
      });

      chunks.push({
        chunkId: `chunk-${chunks.length + 1}`,
        startTime: start,
        endTime: end,
        duration,
        sceneIds
      });
      start = end;
    }
  }

  return chunks;
}

/**
 * Renders a specific chunk's time slice headlessly, outputting it to the chunks directory.
 */
export async function renderChunk(
  projectId: string,
  chunk: RenderChunk,
  options: { projectPath: string; fps?: number; keepFrames?: boolean }
): Promise<string> {
  const fps = options.fps ?? 30;
  const chunksDir = path.resolve(process.cwd(), "renders", projectId, "chunks");
  fs.mkdirSync(chunksDir, { recursive: true });

  const chunkOutputPath = path.resolve(chunksDir, `${chunk.chunkId}.mp4`);
  
  // Make temporary frames directory unique per chunk: renders/<projectId>/chunks/<chunkId>/frames
  const chunkBaseDir = path.resolve(chunksDir, chunk.chunkId);
  const chunkFramesDir = path.resolve(chunkBaseDir, "frames");
  fs.mkdirSync(chunkFramesDir, { recursive: true });

  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      "node",
      [
        "scripts/renderVideo.js",
        "--project",
        options.projectPath,
        "--out",
        chunkOutputPath,
        "--fps",
        fps.toString(),
        "--start",
        chunk.startTime.toString(),
        "--end",
        chunk.endTime.toString(),
        "--framesDir",
        chunkFramesDir
      ],
      {
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`
        }
      }
    );

    let stderr = "";
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0 && fs.existsSync(chunkOutputPath)) {
        // Clean up temporary frame folder unless keepFrames is true
        if (!options.keepFrames) {
          try {
            fs.rmSync(chunkBaseDir, { recursive: true, force: true });
          } catch (cleanErr: any) {
            console.warn(`[ChunkRenderer] Warning: Failed to clean up frames directory for ${chunk.chunkId}: ${cleanErr.message}`);
          }
        }
        resolve(chunkOutputPath);
      } else {
        reject(new Error(`Failed to render chunk "${chunk.chunkId}" (Exit code ${code}). Stderr: ${stderr}`));
      }
    });

    child.on("error", reject);
  });
}

/**
 * Stitch individual chunk videos together using ffmpeg's concat demuxer with a re-encode fallback.
 */
export async function concatChunks(
  projectId: string,
  chunkPaths: string[],
  outputPath: string
): Promise<string> {
  const projectRendersDir = path.resolve(process.cwd(), "renders", projectId);
  fs.mkdirSync(projectRendersDir, { recursive: true });

  const concatListPath = path.resolve(projectRendersDir, "chunks.txt");

  // Format of FFmpeg concat: file '/path/to/file'
  const fileLines = chunkPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  fs.writeFileSync(concatListPath, fileLines, "utf8");

  console.log(`[ChunkRenderer] Created FFmpeg concat file at: ${concatListPath}`);

  // 1. Try Fast Concat Demuxer (-c copy)
  const fastCmd = `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${outputPath}"`;
  console.log(`[ChunkRenderer] Attempting fast chunk concatenation: ${fastCmd}`);

  try {
    execSync(fastCmd, {
      stdio: "pipe",
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`
      }
    });
    console.log(`[ChunkRenderer] Stitched output saved via copy demuxer to: ${outputPath}`);
    try { fs.unlinkSync(concatListPath); } catch {}
    return outputPath;
  } catch (err: any) {
    console.warn(`[ChunkRenderer] Fast concat failed, falling back to re-encoding. Error: ${err.message}`);

    // 2. Fallback to Re-encode Concat
    const fallbackCmd = `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -pix_fmt yuv420p -c:a aac "${outputPath}"`;
    console.log(`[ChunkRenderer] Running fallback re-encode concatenation: ${fallbackCmd}`);

    try {
      execSync(fallbackCmd, {
        stdio: "pipe",
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`
        }
      });
      console.log(`[ChunkRenderer] Stitched output saved via re-encoding to: ${outputPath}`);
      try { fs.unlinkSync(concatListPath); } catch {}
      return outputPath;
    } catch (fallbackErr: any) {
      try { fs.unlinkSync(concatListPath); } catch {}
      throw new Error(`Concatenation completely failed. Fast error: ${err.message}. Fallback error: ${fallbackErr.message}`);
    }
  }
}

/**
 * Controlled Parallel Whiteboard Segment Exporter.
 */
export async function renderProjectInChunks(
  projectId: string,
  options: {
    maxChunkDurationSeconds?: number;
    chunkByScene?: boolean;
    fps?: number;
    concurrency?: number;
    keepFrames?: boolean;
  } = {}
) {
  const startTime = Date.now();

  // 1. Load project details
  const project = await projectStore.getProject(projectId);
  const projectPath = projectStore.validateProjectId(projectId);

  // 2. Determine and clamp concurrency (Min: 1, Max: 4, Default: 2)
  let concurrency = options.concurrency ?? 2;
  if (concurrency < 1) concurrency = 1;
  if (concurrency > 4) concurrency = 4;

  // 3. Fallback to sequential if free system memory is low (< 1.5GB)
  const freeMemGb = os.freemem() / (1024 * 1024 * 1024);
  if (freeMemGb < 1.5 && concurrency > 1) {
    console.warn(`[ChunkRenderer] System memory is low (${freeMemGb.toFixed(2)}GB free). Automatically falling back to sequential rendering.`);
    concurrency = 1;
  }

  // 4. Split project into chunks
  const chunks = splitProjectIntoRenderChunks(project, options);
  console.log(`[ChunkRenderer] Splitting project "${projectId}" into ${chunks.length} chunks. (Active Concurrency: ${concurrency})`);

  const completedChunks: string[] = [];
  const failedChunks: Array<{ chunkId: string; error: string }> = [];
  const chunkPaths: string[] = new Array(chunks.length);

  let hasFailed = false;
  let activePromises = 0;
  let nextIndex = 0;

  return new Promise<{
    outputPath: string;
    chunkCount: number;
    completedChunks: string[];
    failedChunks: any[];
    chunks: RenderChunk[];
    renderSeconds: number;
  }>((resolve, reject) => {
    async function runNext() {
      if (hasFailed) return;
      if (nextIndex >= chunks.length) {
        if (activePromises === 0) {
          finishStitching();
        }
        return;
      }

      const idx = nextIndex++;
      const chunk = chunks[idx];
      activePromises++;

      console.log(`Rendering chunk ${idx + 1}/${chunks.length}: ${chunk.startTime}s-${chunk.endTime}s`);

      try {
        const chunkPath = await renderChunk(projectId, chunk, {
          projectPath,
          fps: options.fps,
          keepFrames: options.keepFrames
        });

        console.log(`Completed chunk ${idx + 1}/${chunks.length}`);
        chunkPaths[idx] = chunkPath;
        completedChunks.push(chunk.chunkId);

        activePromises--;
        runNext();
      } catch (err: any) {
        console.error(`[ChunkRenderer] Error rendering chunk "${chunk.chunkId}": ${err.message}`);

        // Check for Puppeteer launch failures to trigger sequential fallback
        const isBrowserLaunchFail = err.message.toLowerCase().includes("puppeteer") ||
                                    err.message.toLowerCase().includes("browser") ||
                                    err.message.toLowerCase().includes("launch") ||
                                    err.message.toLowerCase().includes("chrome");

        if (isBrowserLaunchFail && concurrency > 1) {
          console.warn(`[ChunkRenderer] Browser launch failed under parallel load. Falling back to sequential execution for remaining slices...`);
          concurrency = 1;
          
          // Reset pointer and retry
          nextIndex = idx;
          activePromises--;
          runNext();
          return;
        }

        hasFailed = true;
        failedChunks.push({ chunkId: chunk.chunkId, error: err.message });
        activePromises--;

        reject(new Error(`Rendering failed at chunk "${chunk.chunkId}" (${chunk.startTime}s - ${chunk.endTime}s). Error: ${err.message}`));
      }
    }

    // Spawn initial concurrent jobs
    const initialWorkers = Math.min(concurrency, chunks.length);
    for (let i = 0; i < initialWorkers; i++) {
      runNext();
    }

    async function finishStitching() {
      try {
        console.log(`Stitching ${chunks.length} chunks`);
        const finalOutputPath = path.resolve(process.cwd(), "renders", projectId, "output.mp4");
        await concatChunks(projectId, chunkPaths, finalOutputPath);

        const renderSeconds = (Date.now() - startTime) / 1000;
        console.log(`[ChunkRenderer] Parallel chunk render E2E finished successfully in ${renderSeconds.toFixed(1)}s!`);

        resolve({
          outputPath: finalOutputPath,
          chunkCount: chunks.length,
          completedChunks,
          failedChunks,
          chunks,
          renderSeconds
        });
      } catch (concatErr: any) {
        reject(new Error(`Failed to stitch chunks during concat: ${concatErr.message}`));
      }
    }
  });
}
