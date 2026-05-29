import { spawn, exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { SubtitleCue } from "./schema";

/**
 * Checks if the macOS native 'say' command is available on this system.
 */
export function isMacSayAvailable(): boolean {
  return process.platform === "darwin" && fs.existsSync("/usr/bin/say");
}

/**
 * Estimates speech duration based on word count.
 * Average speaking rate: ~140 words per minute (~2.3 words per second)
 */
export function estimateNarrationDuration(text: string): number {
  if (!text) return 3.0;
  const words = text.split(/\s+/).filter(Boolean).length;
  // ~2.3 words/sec + 1.5 seconds padding for pauses
  return Math.max(3.0, Math.round((words / 2.3 + 1.5) * 10) / 10);
}

/**
 * Splits text into chunks of 6-10 words and distributes them evenly across a duration.
 */
export function createSubtitleCues(text: string, startTime: number, duration: number): SubtitleCue[] {
  if (!text) return [];

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // Optimal chunk size around 8 words
  const chunkSize = 8;
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }

  const N = chunks.length;
  const chunkDuration = duration / N;
  const cues: SubtitleCue[] = [];

  for (let i = 0; i < N; i++) {
    const cueStart = Math.round((startTime + i * chunkDuration) * 100) / 100;
    const cueEnd = i === N - 1 
      ? Math.round((startTime + duration) * 100) / 100
      : Math.round((startTime + (i + 1) * chunkDuration) * 100) / 100;

    cues.push({
      startTime: cueStart,
      endTime: cueEnd,
      text: chunks[i]
    });
  }

  return cues;
}

/**
 * Synthesizes text to an MP3 file using macOS 'say' and converts it with 'ffmpeg'.
 * Returns the final audio path and its actual duration in seconds.
 */
export function synthesizeWithMacSay(
  text: string,
  outputPath: string,
  voice?: string
): Promise<{ audioPath: string; duration: number }> {
  return new Promise((resolve, reject) => {
    if (!isMacSayAvailable()) {
      return reject(new Error("macOS 'say' utility is not available on this platform."));
    }

    const parentDir = path.dirname(outputPath);
    fs.mkdirSync(parentDir, { recursive: true });

    // 1. Generate unique temporary AIFF file next to final MP3
    const tempAiffPath = path.resolve(parentDir, `temp-${Math.random().toString(36).substring(2, 9)}.aiff`);

    // Build macOS say arguments
    const sayArgs = ["-o", tempAiffPath];
    if (voice) {
      sayArgs.push("-v", voice);
    }
    sayArgs.push(text);

    console.error(`[TTS] Synthesizing text to AIFF: "${text.substring(0, 30)}..."`);
    const sayProcess = spawn("/usr/bin/say", sayArgs);

    sayProcess.on("close", (code) => {
      if (code !== 0) {
        // Fallback: try say without specific voice in case selected voice name is invalid
        if (voice) {
          console.error(`[TTS] Voice '${voice}' failed or not found. Falling back to default system voice.`);
          const fallbackProcess = spawn("/usr/bin/say", ["-o", tempAiffPath, text]);
          fallbackProcess.on("close", (fallbackCode) => {
            if (fallbackCode !== 0) {
              cleanupTempFile(tempAiffPath);
              return reject(new Error(`macOS say fallback exited with code ${fallbackCode}`));
            }
            convertToMp3AndGetDuration(tempAiffPath, outputPath, text, resolve, reject);
          });
          return;
        }
        cleanupTempFile(tempAiffPath);
        return reject(new Error(`macOS say process exited with code ${code}`));
      }

      convertToMp3AndGetDuration(tempAiffPath, outputPath, text, resolve, reject);
    });

    sayProcess.on("error", (err) => {
      cleanupTempFile(tempAiffPath);
      reject(err);
    });
  });
}

function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[TTS] Failed to delete temp file ${filePath}:`, err);
  }
}

/**
 * Converts the AIFF file to MP3 using ffmpeg, and queries duration using ffprobe.
 */
function convertToMp3AndGetDuration(
  tempAiffPath: string,
  outputPath: string,
  text: string,
  resolve: (res: { audioPath: string; duration: number }) => void,
  reject: (err: any) => void
) {
  // Try locating homebrew ffmpeg, otherwise fallback to system ffmpeg
  const homebrewFfmpeg = "/opt/homebrew/bin/ffmpeg";
  const ffmpegCmd = fs.existsSync(homebrewFfmpeg) ? homebrewFfmpeg : "ffmpeg";

  console.error(`[TTS] Converting AIFF to MP3: ${outputPath}`);

  const convertProcess = spawn(ffmpegCmd, [
    "-y",
    "-i",
    tempAiffPath,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    outputPath
  ]);

  convertProcess.on("close", (code) => {
    cleanupTempFile(tempAiffPath);

    if (code !== 0) {
      return reject(new Error(`ffmpeg conversion process exited with code ${code}`));
    }

    // 2. Query true audio duration using ffprobe
    const homebrewFfprobe = "/opt/homebrew/bin/ffprobe";
    const ffprobeCmd = fs.existsSync(homebrewFfprobe) ? homebrewFfprobe : "ffprobe";

    const ffprobeArgs = [
      "-i",
      outputPath,
      "-show_entries",
      "format=duration",
      "-v",
      "quiet",
      "-of",
      "csv=p=0"
    ];

    exec(`"${ffprobeCmd}" ${ffprobeArgs.join(" ")}`, (err, stdout) => {
      let duration = estimateNarrationDuration(text);
      if (!err && stdout) {
        const parsed = parseFloat(stdout.trim());
        if (!isNaN(parsed) && parsed > 0) {
          duration = Math.round(parsed * 10) / 10;
          console.error(`[TTS] True audio duration retrieved via ffprobe: ${duration}s`);
        }
      } else {
        console.error(`[TTS] ffprobe query failed or skipped. Falling back to estimated duration: ${duration}s`);
      }

      resolve({
        audioPath: outputPath,
        duration
      });
    });
  });

  convertProcess.on("error", (err) => {
    cleanupTempFile(tempAiffPath);
    reject(err);
  });
}
