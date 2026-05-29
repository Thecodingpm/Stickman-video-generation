import React, { useState, useEffect, useRef } from "react";
import { getHandConfig } from "../core/handDrawer";

interface HandCalibratorProps {
  isOpen: boolean;
  onClose: () => void;
  handSrc: string;
  onSaveComplete?: () => void;
}

const COLORS = {
  surface:   "#1e293b",
  surfaceLight: "#2d3748",
  border:    "#334155",
  dimmer:    "rgba(255, 255, 255, 0.03)",
  text:      "#f1f5f9",
  muted:     "#94a3b8",
  accent:    "#6366f1",
  accentDim: "rgba(99, 102, 241, 0.15)",
  red:       "#ef4444",
  redDim:    "rgba(239, 68, 68, 0.12)",
  green:     "#22c55e",
  greenDim:  "rgba(34, 197, 94, 0.12)",
};

export const HandCalibrator: React.FC<HandCalibratorProps> = ({
  isOpen,
  onClose,
  handSrc,
  onSaveComplete,
}) => {
  const [normX, setNormX] = useState(0.3388);
  const [normY, setNormY] = useState(0.6463);
  const [angle, setAngle] = useState(0.35); // in radians
  const [sizeMult, setSizeMult] = useState(1.0);

  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load existing configuration (either localStorage override or static config)
  useEffect(() => {
    if (isOpen && handSrc) {
      const cfg = getHandConfig(handSrc);
      setNormX(cfg.normX);
      setNormY(cfg.normY);
      setAngle(cfg.angle);
      setSizeMult(cfg.sizeMult);
    }
  }, [isOpen, handSrc]);

  if (!isOpen) return null;

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setNormX(parseFloat(x.toFixed(4)));
    setNormY(parseFloat(y.toFixed(4)));
  };

  const handleSave = () => {
    try {
      const saved = localStorage.getItem("scribeflow-hand-calibration") || "{}";
      const parsed = JSON.parse(saved);
      
      // Determine match key from image source
      let key = handSrc;
      // Use clean filename suffix to match keys like "/handimg1.png"
      const slashIdx = handSrc.lastIndexOf("/");
      if (slashIdx !== -1) {
        key = handSrc.substring(slashIdx);
      }

      parsed[key] = {
        normX,
        normY,
        angle,
        sizeMult,
      };

      localStorage.setItem("scribeflow-hand-calibration", JSON.stringify(parsed));
      
      if (onSaveComplete) onSaveComplete();
      onClose();
    } catch (e) {
      console.error("Failed to save hand calibration:", e);
      alert("Error saving calibration: " + e);
    }
  };

  const handleReset = () => {
    try {
      const saved = localStorage.getItem("scribeflow-hand-calibration") || "{}";
      const parsed = JSON.parse(saved);
      
      let key = handSrc;
      const slashIdx = handSrc.lastIndexOf("/");
      if (slashIdx !== -1) {
        key = handSrc.substring(slashIdx);
      }

      delete parsed[key];
      localStorage.setItem("scribeflow-hand-calibration", JSON.stringify(parsed));
      
      // Reset values to original defaults
      const cfg = getHandConfig(handSrc);
      setNormX(cfg.normX);
      setNormY(cfg.normY);
      setAngle(cfg.angle);
      setSizeMult(cfg.sizeMult);

      if (onSaveComplete) onSaveComplete();
      onClose();
    } catch (e) {
      console.error("Failed to reset hand calibration:", e);
    }
  };

  const degVal = Math.round(angle * (180 / Math.PI));

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.4)",
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            borderBottom: `1px solid ${COLORS.border}`,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>✋</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: COLORS.text, fontWeight: "bold", fontSize: 14 }}>Hand Calibration Assistant</span>
              <span style={{ color: COLORS.muted, fontSize: 9 }}>Set exact pen-tip coordinate, tilt angle, and draw size multiplier.</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              color: COLORS.muted,
              fontSize: 16,
              cursor: "pointer",
              padding: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = COLORS.text}
            onMouseLeave={e => e.currentTarget.style.color = COLORS.muted}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ display: "flex", flex: 1, overflowY: "auto", padding: 20, gap: 20 }}>
          
          {/* Left panel - Image coordinate selector */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 10, fontWeight: "bold", color: COLORS.muted, alignSelf: "flex-start", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              🎯 Click exact Pen Tip Pixel:
            </div>
            
            <div
              onClick={handleImageClick}
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "4/3",
                background: "rgba(0,0,0,0.25)",
                border: `2px dashed ${COLORS.border}`,
                borderRadius: 12,
                overflow: "hidden",
                cursor: "crosshair",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                userSelect: "none",
              }}
            >
              <img
                ref={imgRef}
                src={handSrc}
                alt="Calibration stylus"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  pointerEvents: "none",
                }}
              />
              
              {/* Anchor point target indicator */}
              <div
                style={{
                  position: "absolute",
                  left: `${normX * 100}%`,
                  top: `${normY * 100}%`,
                  width: 14,
                  height: 14,
                  marginLeft: -7,
                  marginTop: -7,
                  borderRadius: "50%",
                  border: "2px solid #fff",
                  background: COLORS.red,
                  boxShadow: "0 0 10px rgba(239, 68, 68, 0.8), 0 0 0 4px rgba(255,255,255,0.3)",
                  pointerEvents: "none",
                  transition: "left 0.1s ease, top 0.1s ease",
                }}
              />

              {/* Pulsing indicator crosshairs */}
              <div style={{
                position: "absolute",
                left: `${normX * 100}%`,
                top: 0,
                bottom: 0,
                width: 1,
                borderLeft: "1px dashed rgba(255,255,255,0.25)",
                pointerEvents: "none"
              }}/>
              <div style={{
                position: "absolute",
                top: `${normY * 100}%`,
                left: 0,
                right: 0,
                height: 1,
                borderTop: "1px dashed rgba(255,255,255,0.25)",
                pointerEvents: "none"
              }}/>
            </div>
            
            <div style={{
              display: "flex", 
              justifyContent: "space-between", 
              width: "100%",
              fontSize: 10,
              color: COLORS.muted,
              background: COLORS.surfaceLight,
              padding: "6px 12px",
              borderRadius: 6,
              fontFamily: "monospace",
              border: `1px solid ${COLORS.border}`
            }}>
              <span>normX: <b>{normX}</b></span>
              <span>normY: <b>{normY}</b></span>
            </div>
          </div>

          {/* Right panel - Sliders & Previews */}
          <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 16 }}>
            
            {/* Live Anchor Test Preview */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                🔍 Live Angle & Size Anchor Preview:
              </div>
              <div style={{
                height: 120,
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <div style={{
                  position: "absolute",
                  width: 8,
                  height: 8,
                  background: COLORS.green,
                  borderRadius: "50%",
                  boxShadow: `0 0 8px ${COLORS.green}`,
                  zIndex: 2,
                }}/>
                {/* Simulated Hand */}
                <div style={{
                  position: "absolute",
                  transform: `rotate(${angle}rad)`,
                  transformOrigin: "left top",
                  width: 140 * sizeMult,
                  height: 110 * sizeMult,
                  // Offset by the negative tip coordinate
                  left: 150 - (normX * 140 * sizeMult),
                  top: 60 - (normY * 110 * sizeMult),
                  transition: "transform 0.1s ease",
                  opacity: 0.85
                }}>
                  <img 
                    src={handSrc} 
                    alt="simulate" 
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 8, color: COLORS.muted, textAlign: "center", fontStyle: "italic" }}>
                Green dot is draw position. The pen tip should align exactly on top.
              </div>
            </div>

            {/* Slider Controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              
              {/* Angle Slider */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: COLORS.text, fontWeight: "bold" }}>Pen Tilt Angle</span>
                  <span style={{ fontSize: 10, color: COLORS.accent, fontWeight: "bold", fontFamily: "monospace" }}>{degVal}° ({angle.toFixed(2)} rad)</span>
                </div>
                <input
                  type="range"
                  min={-Math.PI}
                  max={Math.PI}
                  step={0.01}
                  value={angle}
                  onChange={e => setAngle(parseFloat(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: COLORS.accent }}
                />
              </div>

              {/* Size Slider */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: COLORS.text, fontWeight: "bold" }}>Hand Size Factor</span>
                  <span style={{ fontSize: 10, color: COLORS.accent, fontWeight: "bold", fontFamily: "monospace" }}>{sizeMult.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={sizeMult}
                  onChange={e => setSizeMult(parseFloat(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: COLORS.accent }}
                />
              </div>

            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div
          style={{
            borderTop: `1px solid ${COLORS.border}`,
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            background: "rgba(0,0,0,0.15)",
            gap: 10,
          }}
        >
          <button
            onClick={handleReset}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: "bold",
              border: `1px solid ${COLORS.border}`,
              background: COLORS.redDim,
              color: COLORS.red,
              cursor: "pointer",
              fontFamily: "monospace",
              transition: "background 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = COLORS.redDim}
          >
            🗑 Reset Defaults
          </button>
          
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 11,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.dimmer,
                color: COLORS.text,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              onMouseLeave={e => e.currentTarget.style.background = COLORS.dimmer}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: "bold",
                border: "none",
                background: COLORS.accent,
                color: "#fff",
                cursor: "pointer",
                boxShadow: "0 4px 6px -1px rgba(99, 102, 241, 0.3)",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              💾 Save Calibration
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
