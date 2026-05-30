/**
 * ScenePanel — manage scenes: add, delete, rename, reorder.
 * Lives in the left sidebar below the toolbar.
 */

import { useState, useRef } from "react";
import { sceneStore } from "../store/sceneStore";
import type { Scene } from "../core/sceneManager";

const COLORS = {
  bg:        "#121214",
  surface:   "#1a1a1e",
  border:    "rgba(255, 255, 255, 0.08)",
  accent:    "#ffffff",
  accentDim: "rgba(255, 255, 255, 0.06)",
  text:      "#f4f4f5",
  muted:     "#8e8e93",
  dimmer:    "#222226",
  danger:    "#ef4444",
};

interface ScenePanelProps {
  currentTime: number;
  onSceneSelect: (scene: Scene) => void;
}

export function ScenePanel({ currentTime: _currentTime, onSceneSelect }: ScenePanelProps) {
  const scenes      = sceneStore.getManager().scenes;
  const activeScene = sceneStore.getActiveScene();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName,  setEditName]  = useState("");
  const [dragOver,  setDragOver]  = useState<number | null>(null);
  const dragIdx     = useRef<number | null>(null);

  const handleRename = (scene: Scene) => {
    setEditingId(scene.id);
    setEditName(scene.name);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      sceneStore.renameScene(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver  = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOver(idx); };
  const handleDrop      = (idx: number) => {
    if (dragIdx.current !== null && dragIdx.current !== idx) {
      sceneStore.reorderScenes(dragIdx.current, idx);
    }
    dragIdx.current = null;
    setDragOver(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Scenes</span>
        <button
          onClick={() => {
            const id = sceneStore.addScene();
            sceneStore.seek(sceneStore.getManager().scenes.find(s => s.id === id)?.startTime ?? 0);
          }}
          title="Add scene"
          style={{ width: 18, height: 18, borderRadius: 4, border: "none", background: COLORS.accent, color: "#08080a", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
        >+</button>
      </div>

      {/* Scene list */}
      <div style={{ overflowY: "auto", maxHeight: 280 }}>
        {scenes.map((scene, idx) => {
          const isActive  = activeScene?.id === scene.id;
          const isEditing = editingId === scene.id;
          const isDragTarget = dragOver === idx;

          return (
            <div
              key={scene.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(idx)}
              onClick={() => { if (editingId) return; sceneStore.seek(scene.startTime); onSceneSelect(scene); }}
              style={{
                display: "flex", flexDirection: "column", gap: 2,
                padding: "7px 10px",
                borderBottom: `1px solid ${COLORS.border}`,
                borderLeft: isActive ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                background: isDragTarget ? COLORS.accentDim : isActive ? COLORS.accentDim : "transparent",
                cursor: "pointer",
                transition: "background 0.1s",
              }}
            >
              {/* Scene name row */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Drag handle */}
                <span style={{ color: COLORS.dimmer, fontSize: 10, cursor: "grab", flexShrink: 0 }}>⠿</span>

                {/* Name or input */}
                {isEditing ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null); }}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, background: COLORS.dimmer, border: `1px solid ${COLORS.accent}`, borderRadius: 4, color: COLORS.text, fontSize: 10, padding: "2px 5px", fontFamily: "monospace", outline: "none" }}
                  />
                ) : (
                  <span
                    style={{ flex: 1, fontSize: 10, color: isActive ? COLORS.text : COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    onDoubleClick={e => { e.stopPropagation(); e.preventDefault(); handleRename(scene); }}
                  >
                    {scene.name}
                  </span>
                )}

                {/* Delete button */}
                {scenes.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); sceneStore.deleteScene(scene.id); }}
                    title="Delete scene"
                    style={{ width: 14, height: 14, borderRadius: 3, border: "none", background: "transparent", color: COLORS.muted, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.6 }}
                    onMouseEnter={e => (e.currentTarget.style.color = COLORS.danger)}
                    onMouseLeave={e => (e.currentTarget.style.color = COLORS.muted)}
                  >✕</button>
                )}
              </div>

              {/* Duration badge */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 16 }}>
                <span style={{ fontSize: 8, color: COLORS.dimmer, fontFamily: "monospace" }}>
                  {scene.duration.toFixed(1)}s · {scene.objects.length + (scene.svgObjects?.length ?? 0)} obj
                </span>
                {/* Mini progress bar showing scene position in total */}
                <div style={{ flex: 1, height: 2, background: COLORS.dimmer, borderRadius: 1, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: isActive ? COLORS.accent : COLORS.muted, width: `${(scene.duration / sceneStore.getManager().totalDuration) * 100}%`, borderRadius: 1 }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
