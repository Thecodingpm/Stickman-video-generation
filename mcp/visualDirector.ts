import { SVG_SHAPES } from "../src/core/svgShapes";

export type DomainType = "science" | "business" | "technology" | "education" | "health" | "finance" | "story" | "general";

export interface TopicAnalysis {
  domain: DomainType;
  keyConcepts: string[];
  suggestedAssets: string[];
  visualMetaphors: string[];
}

export type TemplateType = "title_intro" | "explain_two_column" | "process_flow" | "compare" | "diagram_explain" | "summary_checklist";

export type AnimationType = "draw" | "fade" | "slideLeft" | "slideRight" | "scale" | "static";

export interface PlannedVisual {
  type: "title" | "text" | "shape" | "arrow" | "callout";
  text?: string;
  shapeName?: string;
  semanticRole: "title" | "main_subject" | "supporting_detail" | "connector" | "label" | "summary" | "decoration";
  animation: AnimationType;
  emphasis: "normal" | "important" | "subtle";
  startTimeOffset: number;
}

/**
 * Categorizes a prompt topic into domains and extracts core concepts and suggested assets.
 */
export function analyzeTopic(prompt: string): TopicAnalysis {
  const lower = prompt.toLowerCase();
  
  if (lower.includes("photosynthesis") || lower.includes("plant") || lower.includes("leaf") || lower.includes("sunlight") || lower.includes("water") || lower.includes("carbon dioxide") || lower.includes("oxygen") || lower.includes("glucose")) {
    return {
      domain: "science",
      keyConcepts: ["sunlight", "water", "carbon dioxide", "chloroplasts", "glucose", "oxygen"],
      suggestedAssets: ["sun", "leaf", "waterDrop", "arrowRight", "circle"],
      visualMetaphors: ["leaves as solar panels", "molecular conversion factory", "ecological oxygen balance"]
    };
  }

  if (lower.includes("software") || lower.includes("ai") || lower.includes("artificial intelligence") || lower.includes("developer") || lower.includes("coding") || lower.includes("tech") || lower.includes("computer") || lower.includes("laptop") || lower.includes("program")) {
    return {
      domain: "technology",
      keyConcepts: ["artificial intelligence", "software engineering", "neural networks", "algorithms", "automation"],
      suggestedAssets: ["brain", "gear", "laptop", "network"],
      visualMetaphors: ["AI as a brain copilot", "code as geometric architecture", "mesh of continuous pipeline gears"]
    };
  }

  if (lower.includes("marketing") || lower.includes("growth") || lower.includes("startup") || lower.includes("sales") || lower.includes("business") || lower.includes("product") || lower.includes("launch")) {
    return {
      domain: "business",
      keyConcepts: ["startup launch", "market demand", "customer acquisition", "funnel metrics", "scalable growth"],
      suggestedAssets: ["analytics", "arrowRight", "trophy", "rocket"],
      visualMetaphors: ["startups as launching rocket ships", "funnels as cascading streams", "success as gold trophies"]
    };
  }

  if (lower.includes("finance") || lower.includes("blockchain") || lower.includes("bitcoin") || lower.includes("crypto") || lower.includes("money") || lower.includes("investment")) {
    return {
      domain: "finance",
      keyConcepts: ["blockchain", "distributed ledgers", "cryptography", "financial returns", "risk investment"],
      suggestedAssets: ["rectangle", "bracket", "arrowRight", "link"],
      visualMetaphors: ["blockchain as a chain of secure boxes", "investing as planting growth seeds", "ledger verification"]
    };
  }

  if (lower.includes("health") || lower.includes("heart") || lower.includes("medical") || lower.includes("doctor") || lower.includes("body") || lower.includes("exercise") || lower.includes("lung")) {
    return {
      domain: "health",
      keyConcepts: ["cardiovascular health", "wellness lifestyle", "medical diagnosis", "preventative care"],
      suggestedAssets: ["heart", "checkmark"],
      visualMetaphors: ["heart as a metabolic biological pump", "wellness checkmark as goal progress"]
    };
  }

  if (lower.includes("story") || lower.includes("narrative") || lower.includes("history") || lower.includes("adventure") || lower.includes("creative")) {
    return {
      domain: "story",
      keyConcepts: ["character arc", "plot progression", "conflict resolution", "narrative setting"],
      suggestedAssets: ["character", "star"],
      visualMetaphors: ["narrative as a mountain climb path", "characters as stars in alignment"]
    };
  }

  if (lower.includes("learn") || lower.includes("school") || lower.includes("lesson") || lower.includes("teach") || lower.includes("class") || lower.includes("student")) {
    return {
      domain: "education",
      keyConcepts: ["interactive learning", "conceptual framework", "knowledge blocks", "academic progress"],
      suggestedAssets: ["lightBulb", "bracket", "checkmark"],
      visualMetaphors: ["education as unlocking doors", "learning as glowing ideas"]
    };
  }

  return {
    domain: "general",
    keyConcepts: ["core conceptual models", "sequential workflows", "balanced structural grids"],
    suggestedAssets: ["checkmark", "lightBulb"],
    visualMetaphors: ["concepts as glowing light bulbs", "validation as checkmarks"]
  };
}

/**
 * Resolves semantic concept names to high-fidelity SVG whiteboard shape names.
 */
export function chooseAssetsForConcept(concept: string): string {
  const lower = concept.toLowerCase();
  
  if (lower.includes("photosynthesis")) return resolveShape("sun");
  if (lower === "plant" || lower.includes("leaf") || lower.includes("leaves")) return resolveShape("leaf");
  if (lower.includes("sunlight") || lower === "light" || lower.includes("energy") || lower === "sun") return resolveShape("sun");
  if (lower.includes("carbon dioxide") || lower === "co2") return resolveShape("cloud");
  if (lower === "water" || lower.includes("hydration") || lower.includes("waterdrop")) return resolveShape("waterDrop");
  if (lower.includes("oxygen") || lower.includes("air")) return resolveShape("circle");
  if (lower.includes("glucose") || lower.includes("sugar")) return resolveShape("hexagon");
  
  if (lower.includes("ai") || lower.includes("artificial intelligence") || lower.includes("brain")) return resolveShape("brain");
  if (lower.includes("software") || lower.includes("technology") || lower.includes("coding") || lower.includes("developer")) return resolveShape("laptop");
  
  if (lower.includes("blockchain") || lower.includes("link")) return resolveShape("link");
  if (lower.includes("finance") || lower.includes("business") || lower.includes("growth") || lower.includes("marketing") || lower.includes("sales") || lower.includes("analytics")) return resolveShape("analytics");
  if (lower.includes("climate") || lower.includes("world") || lower.includes("global") || lower.includes("globe")) return resolveShape("globe");
  if (lower.includes("health") || lower.includes("medical") || lower.includes("heart")) return resolveShape("heart");
  if (lower.includes("startup") || lower.includes("launch") || lower.includes("rocket")) return resolveShape("rocket");

  // General fallbacks based on words
  if (lower.includes("step") || lower.includes("arrow") || lower.includes("flow") || lower.includes("next")) {
    return "arrowRight";
  }
  if (lower.includes("idea") || lower.includes("thought") || lower.includes("intellect") || lower.includes("learn")) {
    return "lightBulb";
  }
  if (lower.includes("person") || lower.includes("user") || lower.includes("character") || lower.includes("human")) {
    return "character";
  }
  if (lower.includes("gear") || lower.includes("process") || lower.includes("setting")) {
    return "gear";
  }
  if (lower.includes("success") || lower.includes("win") || lower.includes("trophy")) {
    return "trophy";
  }
  if (lower.includes("check") || lower.includes("valid") || lower.includes("done")) {
    return "checkmark";
  }
  
  return "checkmark";
}

function resolveShape(assetName: string): string {
  if (assetName in SVG_SHAPES) {
    return assetName;
  }
  
  // Fallbacks for missing shapes in SVG_SHAPES
  switch (assetName) {
    case "sun":
      return "lightBulb";
    case "leaf":
      return "triangle";
    case "waterDrop":
      return "circle";
    case "tree":
      return "triangle";
    case "hexagon":
      return "rectangle";
    case "brain":
      return "lightBulb";
    case "network":
      return "globe";
    case "link":
      return "infinity";
    case "heart":
      return "star";
    default:
      return "checkmark";
  }
}

/**
 * Directs template selection based on index, narration, and concept metadata.
 */
export function chooseSceneTemplate(
  sceneName: string,
  narration: string,
  sceneIndex: number,
  totalScenes: number,
  visualCount = 0
): TemplateType {
  if (sceneIndex === 0) return "title_intro";
  if (sceneIndex === totalScenes - 1) return "summary_checklist";

  const lowerName = sceneName.toLowerCase();
  const lowerNar = narration.toLowerCase();
  
  if (lowerName.includes("vs") || lowerName.includes("compare") || lowerName.includes("difference") || lowerName.includes("versus") ||
      lowerNar.includes("vs") || lowerNar.includes("compare") || lowerNar.includes("difference") || lowerNar.includes("versus")) {
    return "compare";
  }

  if (lowerName.includes("step") || lowerName.includes("process") || lowerName.includes("how") || lowerName.includes("flow") ||
      lowerNar.includes("step") || lowerNar.includes("process") || lowerNar.includes("how") || lowerNar.includes("flow")) {
    return "process_flow";
  }

  if (visualCount >= 3 || lowerName.includes("diagram") || lowerName.includes("interact") || lowerName.includes("model")) {
    return "diagram_explain";
  }

  return "explain_two_column";
}

/**
 * Chooses highly tailored animations based on visual role and scene context.
 */
export function chooseAnimationForVisual(visualRole: string, template: TemplateType): AnimationType {
  switch (visualRole) {
    case "title":
      return "draw";
    case "main_subject":
      return template === "title_intro" ? "scale" : "draw";
    case "connector":
    case "arrow":
      return "draw";
    case "supporting_detail":
      return "fade";
    case "label":
      return "draw";
    case "summary":
      return "draw";
    case "decoration":
      return "static";
    default:
      return "draw";
  }
}

/**
 * Determines camera plans and transition pans/zooms matching visual layout.
 */
export function chooseCameraPlan(template: TemplateType, sceneIndex: number, totalScenes: number): string {
  if (template === "title_intro") return "zoom_in";
  if (template === "summary_checklist") return "zoom_out";
  
  switch (template) {
    case "process_flow":
      return "pan_left_to_right";
    case "compare":
      return "slight_zoom_out";
    case "diagram_explain":
      return "focus_main_then_reveal";
    case "explain_two_column":
      return "pan_to_diagram";
    default:
      return "zoom_in";
  }
}

/**
 * Sequences visuals stagger timings, layout coordinate roles, and animations cleanly.
 */
export function planSceneVisuals(
  sceneName: string,
  narration: string,
  sceneIndex: number,
  totalScenes: number,
  rawVisuals: any[]
): {
  template: TemplateType;
  visuals: PlannedVisual[];
  cameraIntent: string;
} {
  const validVisuals = (rawVisuals || []).filter((v: any) => v && v.type).slice(0, 5);
  const template = chooseSceneTemplate(sceneName, narration, sceneIndex, totalScenes, validVisuals.length);
  const cameraIntent = chooseCameraPlan(template, sceneIndex, totalScenes);

  const plannedVisuals = validVisuals.map((v: any, idx: number) => {
    let semanticRole: PlannedVisual["semanticRole"] = "supporting_detail";
    if (v.type === "title") {
      semanticRole = "title";
    } else if (idx === 0 && v.type !== "arrow") {
      semanticRole = "main_subject";
    } else if (v.type === "arrow") {
      semanticRole = "connector";
    } else if (template === "summary_checklist") {
      semanticRole = "summary";
    }

    const animation = chooseAnimationForVisual(semanticRole, template);
    
    let shapeName = v.shapeName;
    if (v.type === "shape" && !shapeName) {
      shapeName = chooseAssetsForConcept(v.text || sceneName || "");
    }

    // Dynamic staggered offsets
    let startTimeOffset = 1.2 + idx * 0.7;
    if (semanticRole === "title") {
      startTimeOffset = 0.4;
    } else if (semanticRole === "main_subject") {
      startTimeOffset = 1.0;
    }

    return {
      type: v.type,
      text: v.text,
      shapeName,
      semanticRole,
      animation,
      emphasis: v.emphasis || "normal",
      startTimeOffset: Math.round(startTimeOffset * 10) / 10
    };
  });

  return {
    template,
    visuals: plannedVisuals,
    cameraIntent
  };
}
