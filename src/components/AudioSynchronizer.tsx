import { useEffect, useRef } from "react";
import { sceneStore } from "../store/sceneStore";
import type { AudioTrack } from "../core/sceneManager";

interface AudioSynchronizerProps {
  currentTime: number;
  isPlaying: boolean;
}

export function AudioSynchronizer({ currentTime, isPlaying }: AudioSynchronizerProps) {
  const audioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const audioTracks: AudioTrack[] = sceneStore.getManager().audioTracks ?? [];

  // ── Sync Audio Instances with Track Configuration ──────────────────────────
  useEffect(() => {
    const activeIds = new Set<string>();

    for (const track of audioTracks) {
      activeIds.add(track.id);

      let audio = audioMapRef.current.get(track.id);

      if (!audio) {
        // Create new Audio instance
        audio = new Audio(track.src);
        audio.preload = "auto";
        audioMapRef.current.set(track.id, audio);
        
        // Listen for metadata to load & set duration if not set
        audio.addEventListener("loadedmetadata", () => {
          if (audio && (!track.duration || isNaN(track.duration))) {
            sceneStore.updateAudioTrack(track.id, { duration: audio.duration });
          }
        });
      } else if (audio.src !== track.src) {
        // Source URL changed
        audio.src = track.src;
        audio.load();
      }

      // Sync volume and mute configurations
      audio.volume = track.volume ?? 1;
      audio.muted = !!track.isMuted;
    }

    // Clean up deleted tracks
    for (const [id, audio] of audioMapRef.current.entries()) {
      if (!activeIds.has(id)) {
        audio.pause();
        audio.src = "";
        audioMapRef.current.delete(id);
      }
    }
  }, [audioTracks]);

  // ── Synchronize Audio Playback with Timeline State ─────────────────────────
  useEffect(() => {
    for (const track of audioTracks) {
      const audio = audioMapRef.current.get(track.id);
      if (!audio) continue;

      const localOffset = currentTime - track.startTime;

      // Check if current playhead is within track duration boundaries
      if (localOffset >= 0 && localOffset <= (track.duration || 1000)) {
        if (isPlaying) {
          // Play state sync
          if (audio.paused && !track.isMuted) {
            audio.play().catch((err) => {
              console.warn("[Audio] Playback blocked by browser autoplay policy:", err);
            });
          }
          // Drift control: adjust playback position if out of sync by > 150ms
          if (Math.abs(audio.currentTime - localOffset) > 0.15) {
            audio.currentTime = localOffset;
          }
        } else {
          // Paused seek synchronization
          if (!audio.paused) {
            audio.pause();
          }
          if (Math.abs(audio.currentTime - localOffset) > 0.05) {
            audio.currentTime = localOffset;
          }
        }
      } else {
        // Outside the active interval for this audio track -> pause it
        if (!audio.paused) {
          audio.pause();
        }
        audio.currentTime = 0;
      }
    }

    // Cleanup pause on unmount
    return () => {
      if (!isPlaying) {
        for (const audio of audioMapRef.current.values()) {
          audio.pause();
        }
      }
    };
  }, [currentTime, isPlaying, audioTracks]);

  return null; // pure logical side-effect component
}
