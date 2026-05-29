/**
 * ScribeFlow Headless Whiteboard Video Renderer (Phase 1 MVP Exporter)
 * Spawns Puppeteer, hydates projects deterministically, grabs frames, and encodes with FFmpeg.
 *
 * Usage:
 *   node scripts/renderVideo.js --project projects/demo.json --out renders/demo.mp4 --fps 30
 */

import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// 1. Simple Command Line Argument Parser
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    project: "",
    out: "",
    fps: 30,
    editorUrl: "http://localhost:5173/editor?render=true",
    start: undefined,
    end: undefined,
    framesDir: ""
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
    } else if (args[i] === "--url" && args[i + 1]) {
      params.editorUrl = args[i + 1];
      i++;
    } else if (args[i] === "--start" && args[i + 1]) {
      params.start = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === "--end" && args[i + 1]) {
      params.end = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === "--framesDir" && args[i + 1]) {
      params.framesDir = args[i + 1];
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

  let projectData;
  try {
    projectData = JSON.parse(fs.readFileSync(projectPath, "utf8"));
  } catch (err) {
    console.error(`❌ Error: Failed to parse project JSON from ${projectPath}:`, err);
    process.exit(1);
  }

  console.log(`🎬 Loaded project data: "${projectData.name || "Untitled Storyboard"}"`);

  // 2. Launch Puppeteer Headless Browser
  console.log("🌐 Launching headless browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    
    // Debugging helpers to catch any frontend crashes
    page.on("console", (msg) => {
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      console.error(`[BROWSER CRITICAL ERROR]: ${err.message}`);
    });

    console.log(`🧭 Navigating to editor render mode: ${params.editorUrl}`);
    await page.goto(params.editorUrl, { waitUntil: "networkidle0" });

    // 3. Hydrate Project JSON via Bridge API
    console.log("💧 Injecting and hydrating project data via bridge...");
    const hydrated = await page.evaluate((json) => {
      if (!window.ScribeFlowRender) {
        throw new Error("window.ScribeFlowRender is not defined. Are you sure you are on ?render=true page?");
      }
      return window.ScribeFlowRender.hydrateProject(json);
    }, projectData);

    if (!hydrated) {
      throw new Error("ScribeFlowRender.hydrateProject returned false.");
    }

    // 4. Wait for Assets & Fonts Readiness
    console.log("⏳ Waiting for web fonts, hand styles, and cache images to load...");
    await page.waitForFunction(() => {
      return window.ScribeFlowRender && window.ScribeFlowRender.isReadyToRender() === true;
    }, { timeout: 45000 });

    const metadata = await page.evaluate(() => {
      const proj = window.ScribeFlowRender.getProjectJson();
      const dur = proj.scenes.reduce((acc, s) => acc + s.duration, 0);
      return {
        width: proj.metadata?.width || 1920,
        height: proj.metadata?.height || 1080,
        duration: dur
      };
    });

    const fps = params.fps;
    const startSec = params.start !== undefined ? params.start : 0;
    const endSec = params.end !== undefined ? params.end : metadata.duration;
    const chunkDuration = endSec - startSec;
    const totalFrames = Math.floor(chunkDuration * fps);
    const timeStep = 1 / fps;

    console.log(`✅ Ready to render! Canvas: ${metadata.width}x${metadata.height}, Render Slice: ${startSec.toFixed(2)}s - ${endSec.toFixed(2)}s (dur: ${chunkDuration.toFixed(2)}s)`);

    // 5. Create temporary directories for frame captures
    const jobId = `export-${Date.now()}`;
    const tempDir = path.join(process.cwd(), "renders", jobId);
    const framesDir = params.framesDir ? path.resolve(params.framesDir) : path.join(tempDir, "frames");
    fs.mkdirSync(framesDir, { recursive: true });

    console.log(`📸 Capturing ${totalFrames} frames at ${fps} FPS into: ${framesDir}`);

    for (let frameIdx = 1; frameIdx <= totalFrames; frameIdx++) {
      const globalTime = startSec + (frameIdx - 1) * timeStep;

      // Deterministically seek and render single frame on canvas
      const rendered = await page.evaluate((t) => {
        return window.ScribeFlowRender.renderFrameAt(t);
      }, globalTime);

      if (!rendered) {
        throw new Error(`Failed to render frame ${frameIdx} at time ${globalTime.toFixed(3)}s`);
      }

      // Capture frame base64 buffer
      const dataUrl = await page.evaluate(() => {
        return window.ScribeFlowRender.getCanvasDataUrl();
      });

      if (!dataUrl.startsWith("data:image/png;base64,")) {
        throw new Error(`Invalid frame buffer retrieved at frame ${frameIdx}`);
      }

      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      const framePath = path.join(framesDir, `frame-${String(frameIdx).padStart(6, "0")}.png`);
      fs.writeFileSync(framePath, base64Data, "base64");

      if (frameIdx % 15 === 0 || frameIdx === totalFrames) {
        const percent = ((frameIdx / totalFrames) * 100).toFixed(1);
        console.log(`   Captured frame ${frameIdx}/${totalFrames} (${percent}%) - ${globalTime.toFixed(2)}s`);
      }
    }

    // 6. Encode with FFmpeg (including dynamic Audio Track Overlay support)
    console.log("🎥 Stitching png frames and encoding final MP4 with FFmpeg...");
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    const audioTracks = projectData.audioTracks || [];
    let ffmpegCmd = "";

    if (audioTracks.length === 0) {
      ffmpegCmd = `ffmpeg -y -r ${fps} -i "${path.join(framesDir, "frame-%06d.png")}" -c:v libx264 -pix_fmt yuv420p -vf "scale=${metadata.width}:${metadata.height}" -t ${chunkDuration.toFixed(3)} "${outputPath}"`;
    } else {
      const inputs = [];
      // Video frames (input 0)
      inputs.push(`-i "${path.join(framesDir, "frame-%06d.png")}"`);

      // Audio files (input 1, 2, ...)
      const delayFilters = [];
      const mixLabels = [];

      audioTracks.forEach((track, idx) => {
        let trackPath = path.resolve(track.src);
        if (!fs.existsSync(trackPath)) {
          trackPath = path.resolve(path.dirname(projectPath), track.src);
        }
        inputs.push(`-i "${trackPath}"`);

        const inputIdx = idx + 1; // 0 is video
        const relativeStart = track.startTime - startSec;
        const outLabel = `a${inputIdx}`;

        if (relativeStart >= 0) {
          const delayMs = Math.round(relativeStart * 1000);
          delayFilters.push(`[${inputIdx}:a]adelay=${delayMs}:all=1[${outLabel}]`);
        } else {
          const trimStartSec = -relativeStart;
          delayFilters.push(`[${inputIdx}:a]atrim=start=${trimStartSec},asetpts=PTS-STARTPTS[${outLabel}]`);
        }
        mixLabels.push(`[${outLabel}]`);
      });

      let filterComplex = delayFilters.join("; ");
      if (audioTracks.length > 1) {
        filterComplex += `; ${mixLabels.join("")}amix=inputs=${audioTracks.length}:dropout_transition=99999[aout]`;
      } else {
        filterComplex += `[aout]`;
      }

      ffmpegCmd = `ffmpeg -y -r ${fps} ${inputs.join(" ")} -filter_complex "${filterComplex}" -map 0:v -map "[aout]" -c:v libx264 -pix_fmt yuv420p -vf "scale=${metadata.width}:${metadata.height}" -t ${chunkDuration.toFixed(3)} "${outputPath}"`;
    }
    
    console.log(`🏃 Running: ${ffmpegCmd}`);
    execSync(ffmpegCmd, {
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:${process.env.PATH || ""}`
      }
    });

    // 7. Cleanup frames
    if (!params.framesDir) {
      console.log("🧹 Cleaning up temporary export directories...");
      fs.rmSync(tempDir, { recursive: true, force: true });
    } else {
      console.log("📂 Custom framesDir path was specified; skipping frames cleanup.");
    }

    console.log(`\n🎉 Whiteboard video successfully generated and saved to:\n👉 ${outputPath}\n`);

  } catch (err) {
    console.error("\n❌ Whiteboard Video Export Failed:", err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
