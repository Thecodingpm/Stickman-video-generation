import * as projectStore from "../mcp/projectStore";
import { validateProject } from "../mcp/qualityValidator";

async function main() {
  console.log("🚀 Spawning E2E VideoScribe Hand Drawer Engine Test...");

  // 1. Create project
  const { projectId, project } = projectStore.createProject({
    title: "VideoScribe Hand Drawer Test",
    width: 1920,
    height: 1080,
    fps: 30,
    background: "#f8fafc"
  });

  console.log(`Created project with ID: ${projectId}`);

  // Modify Scene 1 (normal zoom)
  const scene1 = project.scenes[0];
  scene1.name = "Scene 1: Normal Zoom 1.0";
  scene1.duration = 6.0;

  // Add SVG arrow in Scene 1
  projectStore.addCanvasElement(projectId, scene1.id, "svg", {
    id: "svg-arrow",
    pathData: "M 10 50 L 90 50 L 70 30 M 90 50 L 70 70",
    x: -200,
    y: 0,
    scaleX: 2.0,
    scaleY: 2.0,
    strokeColor: "#3b82f6",
    strokeWidth: 4,
    startTime: 0.5,
    duration: 2.0
  });

  // Add circle in Scene 1
  projectStore.addCanvasElement(projectId, scene1.id, "circle", {
    id: "circle-shape",
    x: 100,
    y: 100,
    radius: 50,
    strokeColor: "#e0f2fe",
    fillColor: "#0284c7",
    startTime: 2.8,
    duration: 1.5,
    easing: "easeInOut",
    animationType: "draw"
  });

  // Add text in Scene 1
  projectStore.addCanvasElement(projectId, scene1.id, "text", {
    id: "text-title",
    content: "VideoScribe Motion!",
    x: -150,
    y: -200,
    fontSize: 48,
    fillColor: "#1e293b",
    startTime: 4.5,
    duration: 1.2,
    easing: "linear",
    animationType: "draw"
  });

  // Create Scene 2 (zoomed in)
  const { sceneId: scene2Id } = projectStore.addScene(projectId, {
    name: "Scene 2: Zoomed In 1.8",
    duration: 6.0,
    background: "#f8fafc"
  });

  // Add same elements to Scene 2
  projectStore.addCanvasElement(projectId, scene2Id, "svg", {
    id: "svg-arrow-s2",
    pathData: "M 10 50 L 90 50 L 70 30 M 90 50 L 70 70",
    x: -200,
    y: 0,
    scaleX: 2.0,
    scaleY: 2.0,
    strokeColor: "#ef4444",
    strokeWidth: 4,
    startTime: 0.5,
    duration: 2.0
  });

  projectStore.addCanvasElement(projectId, scene2Id, "circle", {
    id: "circle-shape-s2",
    x: 100,
    y: 100,
    radius: 50,
    strokeColor: "#fee2e2",
    fillColor: "#dc2626",
    startTime: 2.8,
    duration: 1.5,
    easing: "easeInOut",
    animationType: "draw"
  });

  projectStore.addCanvasElement(projectId, scene2Id, "text", {
    id: "text-title-s2",
    content: "Zoomed In Detail",
    x: -150,
    y: -200,
    fontSize: 48,
    fillColor: "#1e293b",
    startTime: 4.5,
    duration: 1.2,
    easing: "linear",
    animationType: "draw"
  });

  // Overwrite Camera Zoom in Scene 2 to 1.8
  projectStore.addCameraMovement(projectId, scene2Id, {
    time: 0,
    x: 0,
    y: 0,
    zoom: 1.8,
    easing: "linear"
  });

  // Create Scene 3 (zoomed out)
  const { sceneId: scene3Id } = projectStore.addScene(projectId, {
    name: "Scene 3: Zoomed Out 0.6",
    duration: 6.0,
    background: "#f8fafc"
  });

  // Add same elements to Scene 3
  projectStore.addCanvasElement(projectId, scene3Id, "svg", {
    id: "svg-arrow-s3",
    pathData: "M 10 50 L 90 50 L 70 30 M 90 50 L 70 70",
    x: -200,
    y: 0,
    scaleX: 2.0,
    scaleY: 2.0,
    strokeColor: "#10b981",
    strokeWidth: 4,
    startTime: 0.5,
    duration: 2.0
  });

  projectStore.addCanvasElement(projectId, scene3Id, "circle", {
    id: "circle-shape-s3",
    x: 100,
    y: 100,
    radius: 50,
    strokeColor: "#d1fae5",
    fillColor: "#059669",
    startTime: 2.8,
    duration: 1.5,
    easing: "easeInOut",
    animationType: "draw"
  });

  projectStore.addCanvasElement(projectId, scene3Id, "text", {
    id: "text-title-s3",
    content: "Zoomed Out Overview",
    x: -150,
    y: -200,
    fontSize: 48,
    fillColor: "#1e293b",
    startTime: 4.5,
    duration: 1.2,
    easing: "linear",
    animationType: "draw"
  });

  // Overwrite Camera Zoom in Scene 3 to 0.6
  projectStore.addCameraMovement(projectId, scene3Id, {
    time: 0,
    x: 0,
    y: 0,
    zoom: 0.6,
    easing: "linear"
  });

  // 3. Reload project, validate, and print summary
  const finalProject = projectStore.getProject(projectId);
  console.log(`\nGenerating project ${projectId} to project store JSON...`);
  
  const validation = validateProject(finalProject);
  console.log(`Validation Results:`);
  console.log(`- Healthy: ${validation.valid}`);
  console.log(`- Warnings count: ${validation.warnings.length}`);
  
  if (!validation.valid) {
    console.error("❌ E2E Hand Drawer project validation failed!");
    validation.warnings.forEach(w => console.error(`  [${w.severity.toUpperCase()}] ${w.message}`));
    process.exit(1);
  }

  console.log("✅ E2E Hand Drawer Project compilation successful and valid!");
  console.log("PROJECT_ID:" + projectId);
}

main().catch((err) => {
  console.error("❌ E2E script failed:", err);
  process.exit(1);
});
