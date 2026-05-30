import React, { useRef, useState, useEffect } from "react";
import { sceneStore } from "../store/sceneStore";
import { editorStore } from "../store/editorStore";
import type { AudioTrack } from "../core/sceneManager";

const COLORS = {
  bg:      "#121214",
  surface: "#1a1a1e",
  border:  "rgba(255,255,255,0.08)",
  accent:  "#ffffff",
  accentDim:"rgba(255,255,255,0.06)",
  text:    "#f4f4f5",
  muted:   "#8e8e93",
  green:   "#34d399",
  red:     "#ef4444",
};

// ── Preset Premium Tracks ───────────────────────────────────────────────────
const PRESET_TRACKS = [
  {
    name: "🎵 Ambient Chill Lofi",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    duration: 372,
  },
  {
    name: "⚡ Upbeat Creative Sketch",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    duration: 425,
  },
  {
    name: "🌌 Soft Tech Space",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    duration: 302,
  },
];

export function AudioLibrary() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    return sceneStore.subscribe(() => forceUpdate(n => n + 1));
  }, []);

  const activeTracks = sceneStore.getManager().audioTracks ?? [];
  const selectedObj = editorStore.getSelected();

  // Cleanup preview audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to local Blob URL
    const blobUrl = URL.createObjectURL(file);
    
    // Create pre-loaded audio helper to measure natural duration
    const tempAudio = new Audio(blobUrl);
    tempAudio.addEventListener("loadedmetadata", () => {
      sceneStore.addAudioTrack({
        name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
        src: blobUrl,
        startTime: sceneStore.getLocalTime(), // insert at current editor cursor time
        duration: tempAudio.duration || 10,
        volume: 0.8,
      });
      // Force refresh file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const handleAddPreset = (preset: typeof PRESET_TRACKS[number]) => {
    sceneStore.addAudioTrack({
      name: preset.name.substring(2), // remove emoji
      src: preset.src,
      startTime: sceneStore.getLocalTime(),
      duration: preset.duration,
      volume: 0.7,
    });
  };

  const handleTogglePreview = (track: AudioTrack) => {
    if (playingPreviewId === track.id) {
      // Pause
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPlayingPreviewId(null);
    } else {
      // Play new preview
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      previewAudioRef.current = new Audio(track.src);
      previewAudioRef.current.volume = track.volume;
      previewAudioRef.current.play()
        .then(() => {
          setPlayingPreviewId(track.id);
          previewAudioRef.current?.addEventListener("ended", () => {
            setPlayingPreviewId(null);
          });
        })
        .catch(err => {
          console.warn("Audio preview blocked by browser policy:", err);
        });
    }
  };

  return (
    <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflowY: "auto" }}>
      
      {/* ── SECTION 1: Local Upload ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        borderRadius: "10px",
        border: `1px solid ${COLORS.border}`,
        padding: "16px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onClick={() => fileInputRef.current?.click()}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = COLORS.accent;
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = COLORS.border;
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
      }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <span style={{ fontSize: "11px", fontWeight: "bold", color: COLORS.text }}>Import Local Audio</span>
        <span style={{ fontSize: "9px", color: COLORS.muted }}>Supports MP3, WAV, M4A, OGG</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: "none" }}
          onChange={handleLocalUpload}
        />
      </div>

      {/* ── SECTION 2: Preset Library ── */}
      <div>
        <span style={{ fontSize: "9px", fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>
          🎼 Preset Studio Beats
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {PRESET_TRACKS.map(preset => (
            <div
              key={preset.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: "8px",
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: "10px", color: COLORS.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {preset.name}
                </span>
                <span style={{ fontSize: "8px", color: COLORS.muted }}>
                  {Math.floor(preset.duration / 60)}:{(preset.duration % 60).toString().padStart(2, "0")}s
                </span>
              </div>
              <button
                onClick={() => handleAddPreset(preset)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  background: COLORS.accentDim,
                  border: `1px solid rgba(255,255,255,0.15)`,
                  color: COLORS.accent,
                  cursor: "pointer",
                  fontSize: "9px",
                  fontWeight: "bold",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = COLORS.accent;
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = COLORS.accentDim;
                  e.currentTarget.style.color = COLORS.accent;
                }}
              >
                + Load
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 3: Active Project Audio ── */}
      <div>
        <span style={{ fontSize: "9px", fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>
          🔊 Active Scene Audio ({activeTracks.length})
        </span>
        
        {activeTracks.length === 0 ? (
          <div style={{
            padding: "20px 10px",
            borderRadius: "8px",
            border: `1px dashed ${COLORS.border}`,
            textAlign: "center",
            fontSize: "10px",
            color: COLORS.muted,
          }}>
            No audio tracks added to the timeline yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {activeTracks.map(track => {
              const isSelected = selectedObj?.type === "audio" && selectedObj?.id === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => editorStore.select(track.id, "audio")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: isSelected ? "rgba(255,255,255,0.04)" : COLORS.surface,
                    border: isSelected ? `1.5px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {/* Play preview button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTogglePreview(track); }}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: playingPreviewId === track.id ? COLORS.green : "rgba(255,255,255,0.06)",
                      color: playingPreviewId === track.id ? "#fff" : COLORS.text,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "9px",
                      flexShrink: 0,
                    }}
                  >
                    {playingPreviewId === track.id ? "⏸" : "▶"}
                  </button>

                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "10px", color: COLORS.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {track.name}
                    </span>
                    <span style={{ fontSize: "8px", color: COLORS.muted }}>
                      Start: {track.startTime.toFixed(1)}s · Dur: {track.duration.toFixed(1)}s
                    </span>
                  </div>

                  {/* Remove audio button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); sceneStore.removeAudioTrack(track.id); }}
                    title="Remove audio track"
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "4px",
                      background: "rgba(239,68,68,0.08)",
                      border: "none",
                      color: COLORS.red,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      flexShrink: 0,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = COLORS.red;
                      e.currentTarget.style.color = "#fff";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                      e.currentTarget.style.color = COLORS.red;
                    }}
                  >
                    🗑
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
