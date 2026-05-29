import { useState, useEffect } from "react";
import { sceneStore } from "../store/sceneStore";
import { editorStore } from "../store/editorStore";
import { compileStoryboardToProject } from "../core/storyboardCompiler";

const COLORS = {
  bg: "#0c1117",
  surface: "#141920",
  border: "rgba(99,102,241,0.18)",
  accent: "#6366f1",
  accentDim: "rgba(99,102,241,0.12)",
  text: "#e2e8f0",
  muted: "#64748b",
  success: "#10b981",
  error: "#ef4444",
  glassBg: "rgba(20, 25, 32, 0.7)",
};

const SUGGESTIONS = [
  "Explain photosynthesis with a sun and leaf diagram",
  "Show how gravity keeps planets in orbit",
  "A simple flowchart of how a website loads",
  "Introduce the water cycle with heat and cloud icons",
];

export function AiPanel() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gemini-flash-latest");
  const [vibe, setVibe] = useState("educational");
  const [palette, setPalette] = useState("techIndigo");

  // Selection state
  const [selectedObj, setSelectedObj] = useState<any>(null);
  const [, setSceneVer] = useState(0);

  // SVG optimization states
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState("");
  const [optimizeSuccess, setOptimizeSuccess] = useState(false);

  useEffect(() => {
    const getSelectedSvg = () => {
      const sel = editorStore.getSelected();
      const scene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1) ?? null;
      if (!sel || !scene) return null;
      if (sel.type === "svg") {
        return scene.svgObjects?.find(o => o.id === sel.id) ?? null;
      }
      return null;
    };

    setSelectedObj(getSelectedSvg());

    const unsubEditor = editorStore.subscribe(() => {
      setSelectedObj(getSelectedSvg());
    });
    const unsubScene = sceneStore.subscribe(() => {
      setSelectedObj(getSelectedSvg());
      setSceneVer(v => v + 1);
    });
    return () => {
      unsubEditor();
      unsubScene();
    };
  }, []);

  const handleOptimizeSvg = async () => {
    if (!selectedObj) return;
    if (!apiKey.trim()) {
      setOptimizeError("API Key required. Please set it in 'API Key Settings' above.");
      return;
    }

    setOptimizing(true);
    setOptimizeError("");
    setOptimizeSuccess(false);

    try {
      const activeScene = sceneStore.getActiveScene() ?? sceneStore.getManager().scenes.at(-1);
      if (!activeScene) throw new Error("No active scene found");

      let rawSvg = selectedObj.pathData.trim();
      if (!rawSvg.startsWith("<svg")) {
        rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><path d="${rawSvg}" /></svg>`;
      }

      // ── Client-side Gemini API call for SVG Centerline Refinement ──
      const systemPrompt = `
You are a master Vector Stylus Engineer for high-fidelity whiteboard animation systems.
Your job is to optimize and refine a messy, solid-filled, or complex outline-filled SVG representation into a beautiful, single-stroke, centerline drawing sequence.

Whiteboard drawing hands cannot sketch filled solid blocks or thick dual-boundary outline shapes cleanly. They need clean, single-line stroked vector paths.

Instructions:
1. Inspect the input SVG structure.
2. Translate solid polygons, fat filled circles, and thick outline paths into elegant, single-stroke centerlines (skeleton paths). For example, replace a thick filled arrow polygon with a single centerline arrow path.
3. Ensure every path has fill="none" or fill="transparent" and a standard strokeColor and strokeWidth set.
4. Sort and order the paths sequentially so they draw naturally (outline borders first, inner details second, flowing organically).
5. Return ONLY a valid JSON object holding the optimized SVG string under the key "optimizedSvg".

Output JSON format:
{
  "optimizedSvg": "<svg>...</svg>"
}
`;

      const userPrompt = `
Here is the raw SVG string to optimize and refine into single-stroke centerlines:
\`\`\`xml
${rawSvg}
\`\`\`
`;

      const payload = {
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: userPrompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              optimizedSvg: { type: "STRING" }
            },
            required: ["optimizedSvg"]
          }
        }
      };

      const modelName = "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP error ${res.status}`);
      }

      const responseJson = await res.json();
      const text = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response returned from Gemini API.");
      }

      let cleanText = text.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      cleanText = cleanText.trim();

      const parsed = JSON.parse(cleanText);
      const optimizedSvg = parsed.optimizedSvg;
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(optimizedSvg, "image/svg+xml");
      
      const paths = doc.querySelectorAll("path");
      let dVal = "";
      if (paths.length > 0) {
        const dAttrs: string[] = [];
        paths.forEach(p => {
          const d = p.getAttribute("d");
          if (d) dAttrs.push(d);
        });
        dVal = dAttrs.join(" ");
      } else {
        const match = optimizedSvg.match(/d="([^"]+)"/);
        if (match) {
          dVal = match[1];
        } else {
          throw new Error("Could not find any path data in the optimized SVG returned by AI.");
        }
      }

      if (!dVal.trim()) {
        throw new Error("Extracted path data is empty.");
      }

      const { splitCompoundPath } = await import("../core/svgPath");
      const newSubPaths = splitCompoundPath(dVal);
      const hasSubPaths = newSubPaths.length > 1;

      sceneStore.updateSvgObject(activeScene.id, selectedObj.id, {
        pathData: dVal,
        subPaths: hasSubPaths ? newSubPaths : undefined,
        fillColor: "transparent",
      });

      setOptimizeSuccess(true);
      setTimeout(() => setOptimizeSuccess(false), 3000);
    } catch (err: any) {
      console.error("AI SVG Refiner failed:", err);
      setOptimizeError(err?.message || "Failed to optimize SVG. Check API key or network.");
    } finally {
      setOptimizing(false);
    }
  };
  
  // API key state: check environment first, then localStorage
  const [apiKey, setApiKey] = useState(() => {
    return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem("wbs-gemini-apikey") || "";
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const loadingMessages = [
    "🧠 AI is scripting the storyboard...",
    "📐 Designing sequential whiteboard layout...",
    "🎨 Rendering custom SVG diagrams & arrows...",
    "✍️ Hydrating your timeline & drawing paths...",
    "✨ Almost ready for play..."
  ];

  // Cycle loading messages
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 3000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleSaveApiKey = () => {
    localStorage.setItem("wbs-gemini-apikey", apiKey.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setErrorMsg("Please enter a script or topic description for your video.");
      return;
    }
    if (!apiKey.trim()) {
      setErrorMsg("API Key required. Click 'Settings' to paste your free Gemini API key.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const systemPrompt = `
You are an AI "Video Director" for a whiteboard animation engine.

Your job is NOT to create a video.
Your job is ONLY to convert a script or topic request into a structured animation plan that the rendering engine will execute.

The engine already handles:
- text box rendering
- font selection
- color system
- animation execution
- zoom/pan logic
- layout positioning
- timeline rendering
- SVG drawing animations

DO NOT repeat or redefine these capabilities.

-------------------------
RULES
-------------------------
1. DO NOT output pixel coordinates.
2. DO NOT manually design layouts.
3. DO NOT specify exact fonts or hex colors unless explicitly required.
4. DO NOT create frame-by-frame animations.
5. DO NOT assume missing engine features exist.
6. DO NOT repeat tasks already handled by the engine.

-------------------------
WHAT YOU MUST DO
-------------------------
1. Split the script into scenes
- Each scene = one clear idea
- Keep scenes simple and focused

2. Extract meaning
For each scene identify:
- key concept (key_idea)
- important keywords
- required visuals (diagram, icon, object, text)
- emphasis level

3. Choose animation INTENT (not execution)

TEXT ANIMATIONS:
- fade_in
- write_on
- highlight
- slide_up

OBJECT ANIMATIONS:
- appear
- draw
- zoom_focus
- pulse

CAMERA:
- zoom_in
- zoom_out
- pan_center
- static

4. Diagram handling
- Only describe diagram type (ERD, flowchart, cycle, etc.)
- DO NOT draw diagrams
- DO NOT position diagrams

5. Timing
Use:
- short (3–5 sec)
- medium (5–8 sec)
- long (8–12 sec)

-------------------------
OUTPUT FORMAT (STRICT JSON ONLY)
-------------------------
Return ONLY valid JSON matching this schema:
{
  "video_title": "String",
  "scenes": [
    {
      "scene_id": 1,
      "narration": "Narration text",
      "key_idea": "Key concept summary",
      "visuals": [
        {
          "type": "text" | "diagram" | "icon" | "object",
          "content": "Description of the visual (e.g. sun, startup idea, user interface)",
          "animation": "fade_in" | "write_on" | "draw" | "appear" | "highlight",
          "emphasis": "low" | "medium" | "high"
        }
      ],
      "camera": "zoom_in" | "zoom_out" | "pan_center" | "static",
      "duration": "short" | "medium" | "long",
      "notes": "optional engine guidance"
    }
  ]
}
`;

    const userPrompt = `
Generate a structured video storyboard for the topic: "${prompt}"

Vibe requirement: ${vibe}
`;

    try {
      const payload = {
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: userPrompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              video_title: { type: "STRING" },
              scenes: {
                type: "ARRAY",
                description: "Sequential list of director scenes",
                items: {
                  type: "OBJECT",
                  properties: {
                    scene_id: { type: "NUMBER" },
                    narration: { type: "STRING" },
                    key_idea: { type: "STRING" },
                    visuals: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          type: { type: "STRING", enum: ["text", "diagram", "icon", "object"] },
                          content: { type: "STRING" },
                          animation: { type: "STRING", enum: ["fade_in", "write_on", "draw", "appear", "highlight"] },
                          emphasis: { type: "STRING", enum: ["low", "medium", "high"] }
                        },
                        required: ["type", "content", "animation", "emphasis"]
                      }
                    },
                    camera: { type: "STRING", enum: ["zoom_in", "zoom_out", "pan_center", "static"] },
                    duration: { type: "STRING", enum: ["short", "medium", "long"] },
                    notes: { type: "STRING" }
                  },
                  required: ["scene_id", "narration", "key_idea", "visuals", "camera", "duration"]
                }
              }
            },
            required: ["video_title", "scenes"]
          }
        }
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response from AI. Please try again.");
      }

      let cleanText = text.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      cleanText = cleanText.trim();

      // Compile the high-level storyboard plan into actual coordinates and elements
      const parsedStoryboard = JSON.parse(cleanText);
      const compiledProjectJson = compileStoryboardToProject(parsedStoryboard, palette);

      // Load into the sceneStore
      sceneStore.loadProject(compiledProjectJson);
      
      const firstScene = sceneStore.getManager().scenes[0];
      if (firstScene) {
        sceneStore.seek(0);
      }

      setPrompt("");
    } catch (err: any) {
      console.error("AI Video Director failed:", err);
      setErrorMsg(err?.message || "Failed to generate storyboard. Check network or API Key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        color: COLORS.text,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ── AI VECTOR REFINER SECTION ── */}
      {selectedObj && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "rgba(167, 139, 250, 0.08)",
            border: `1px solid rgba(167, 139, 250, 0.25)`,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            boxShadow: "0 4px 16px rgba(167, 139, 250, 0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: 11, fontWeight: "bold", color: "#a78bfa", display: "flex", alignItems: "center", gap: 6 }}>
              ✨ SVG AI Optimizer
            </span>
            <span style={{ fontSize: 9, color: COLORS.muted }}>ID: {selectedObj.id}</span>
          </div>
          
          <div style={{ fontSize: 10, color: COLORS.text, lineHeight: "1.4" }}>
            Clean up messy paths or convert filled shapes into elegant, single-stroke centerline drawings using Gemini AI.
          </div>

          {optimizeError && (
            <div style={{ padding: 6, borderRadius: 4, background: "rgba(239, 68, 68, 0.1)", border: `1px solid ${COLORS.error}`, color: COLORS.error, fontSize: 10 }}>
              ⚠️ {optimizeError}
            </div>
          )}

          {optimizeSuccess && (
            <div style={{ padding: 6, borderRadius: 4, background: "rgba(16, 185, 129, 0.1)", border: `1px solid ${COLORS.success}`, color: COLORS.success, fontSize: 10 }}>
              ✓ SVG path refined and optimized successfully!
            </div>
          )}

          <button
            onClick={handleOptimizeSvg}
            disabled={optimizing}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "none",
              background: optimizing ? "rgba(167, 139, 250, 0.3)" : `linear-gradient(135deg, #a78bfa, #8b5cf6)`,
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 11,
              cursor: optimizing ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(167, 139, 250, 0.2)",
              transition: "all 0.2s",
            }}
          >
            {optimizing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: "2px solid #ffffff",
                    borderTopColor: "transparent",
                    animation: "spin 0.8s linear infinite",
                    display: "inline-block",
                  }}
                />
                <span>Refining Vector...</span>
              </div>
            ) : (
              "✨ Optimize Stylus Vector with AI"
            )}
          </button>
        </div>
      )}

      {/* ── API KEY SETTINGS SECTION ── */}
      <div>
        <div
          onClick={() => setShowKeyInput(!showKeyInput)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            padding: "8px 10px",
            borderRadius: 6,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            fontSize: 11,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            🔑 API Key Settings
            {apiKey ? (
              <span style={{ color: COLORS.success, fontSize: 9 }}>● Active</span>
            ) : (
              <span style={{ color: COLORS.error, fontSize: 9 }}>● Missing</span>
            )}
          </span>
          <span style={{ fontSize: 9 }}>{showKeyInput ? "▲" : "▼"}</span>
        </div>

        {showKeyInput && (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 6,
              background: "rgba(20, 25, 32, 0.4)",
              border: `1px dashed ${COLORS.border}`,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <input
              type="password"
              placeholder="Paste Gemini API Key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 4,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.bg,
                color: COLORS.text,
                fontSize: 11,
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={handleSaveApiKey}
              style={{
                padding: "6px 10px",
                borderRadius: 4,
                border: "none",
                background: saveSuccess ? COLORS.success : COLORS.accent,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 600,
                alignSelf: "flex-end",
              }}
            >
              {saveSuccess ? "✓ Saved Local" : "Save Key"}
            </button>
            <div style={{ fontSize: 9, color: COLORS.muted }}>
              No credit card required. Get a free key at{" "}
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noreferrer"
                style={{ color: COLORS.accent, textDecoration: "underline" }}
              >
                aistudio.google.com
              </a>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: "100%", height: 1, background: COLORS.border }} />

      {/* ── MODEL SELECTOR ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Gemini Model
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.text,
            fontSize: 11,
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="gemini-flash-latest">Gemini Flash (Recommended: Fast & Stable)</option>
          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
        </select>
      </div>

      {/* ── DESIGN PRESETS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Tone / Vibe
          </label>
          <select
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              fontSize: 11,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="educational">Educational</option>
            <option value="playful">Playful / Story</option>
            <option value="professional">Professional</option>
            <option value="technical">Technical</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Palette
          </label>
          <select
            value={palette}
            onChange={(e) => setPalette(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              fontSize: 11,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="techIndigo">Tech Indigo</option>
            <option value="forestGreen">Forest Green</option>
            <option value="sunsetOrange">Sunset Orange</option>
            <option value="minimalCharcoal">Charcoal Slate</option>
          </select>
        </div>
      </div>

      <div style={{ width: "100%", height: 1, background: COLORS.border }} />

      {/* ── COMMAND PROMPT INPUT ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Describe Your Video Command
        </label>
        <textarea
          placeholder="e.g. Draw a flowchart showing the steps a startup goes through from idea to launch..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          style={{
            padding: 10,
            borderRadius: 8,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.text,
            fontSize: 11,
            lineHeight: "1.4",
            outline: "none",
            resize: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* SUGGESTION PILLS */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {SUGGESTIONS.map((s, idx) => (
          <button
            key={idx}
            onClick={() => setPrompt(s)}
            style={{
              padding: "4px 8px",
              borderRadius: 20,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(99,102,241,0.06)",
              color: COLORS.accent,
              fontSize: 9,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = COLORS.accentDim;
              e.currentTarget.style.borderColor = COLORS.accent;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(99,102,241,0.06)";
              e.currentTarget.style.borderColor = COLORS.border;
            }}
          >
            + {s.slice(0, 30)}...
          </button>
        ))}
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {errorMsg && (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            background: "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${COLORS.error}`,
            color: COLORS.error,
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* GENERATE BUTTON */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: "12px 16px",
          borderRadius: 8,
          border: "none",
          background: loading ? "rgba(99,102,241,0.3)" : `linear-gradient(135deg, ${COLORS.accent}, #4f46e5)`,
          color: "#ffffff",
          fontWeight: 600,
          fontSize: 12,
          cursor: loading ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: loading ? "none" : "0 4px 12px rgba(99, 102, 241, 0.25)",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: "2px solid #ffffff",
                borderTopColor: "transparent",
                animation: "spin 0.8s linear infinite",
                display: "inline-block",
              }}
            />
            <span>Generating...</span>
          </div>
        ) : (
          "✨ Generate Whiteboard Video"
        )}
      </button>

      {/* LOADING OVERLAY / STATE FOR SIDEBAR */}
      {loading && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "rgba(99,102,241,0.06)",
            border: `1px solid ${COLORS.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 500, color: COLORS.accent }}>
            {loadingMessages[loadingStep]}
          </span>
          <div style={{ width: "100%", height: 3, background: COLORS.accentDim, borderRadius: 1.5, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                background: COLORS.accent,
                width: `${((loadingStep + 1) / loadingMessages.length) * 100}%`,
                transition: "width 0.4s ease-out",
              }}
            />
          </div>
        </div>
      )}

      {/* CSS KEYFRAME STYLE INJECT */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
