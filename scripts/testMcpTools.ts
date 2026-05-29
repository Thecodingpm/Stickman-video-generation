import * as projectStore from "../mcp/projectStore";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

async function main() {
  console.log("=== STARTING MCP TOOL FLOW DEMO SYNCHRONIZER ===");

  // Step 1: create_whiteboard_project
  console.log("\n[Tool 1: create_whiteboard_project]");
  const projectInput = { title: "MCP Tool Flow Demo", width: 1920, height: 1080, fps: 30 };
  console.log("Input:", JSON.stringify(projectInput, null, 2));

  const { projectId, projectPath, project } = projectStore.createProject(projectInput);
  console.log("Output Summary:");
  console.log(`- Project ID: ${projectId}`);
  console.log(`- Project Path: ${projectPath}`);

  // Step 2: add_whiteboard_scene (Configure first scene to duration 8s)
  console.log("\n[Tool 2: add_whiteboard_scene / Configure Intro Scene]");
  const scene = project.scenes[0];
  scene.name = "Automation Intro";
  scene.duration = 8.0;
  projectStore.saveProject(projectId, project);
  const sceneId = scene.id;

  console.log("Output Summary:");
  console.log(`- Configured Scene ID: ${sceneId}`);
  console.log(`- Scene Name: "${scene.name}"`);
  console.log(`- Scene Duration: ${scene.duration}s`);

  // Step 3: add_canvas_element for text
  console.log("\n[Tool 3: add_canvas_element (text)]");
  const textInput = {
    projectId,
    sceneId,
    elementType: "text" as const,
    properties: {
      content: "MCP is controlling this editor",
      x: -180,
      y: -100,
      fontSize: 42,
      fillColor: "#1e293b",
      startTime: 1.0,
      duration: 3.0
    }
  };
  console.log("Input:", JSON.stringify(textInput, null, 2));

  const textResult = projectStore.addCanvasElement(projectId, sceneId, textInput.elementType, textInput.properties);
  console.log("Output Summary:");
  console.log(`- Created Text Object ID: ${textResult.objectId}`);

  // Step 4: add_canvas_element for svg shape
  console.log("\n[Tool 4: add_canvas_element (svg)]");
  const svgInput = {
    projectId,
    sceneId,
    elementType: "svg" as const,
    properties: {
      pathData: "M 5 50 L 35 80 L 95 15", // checkmark illustration
      x: 120,
      y: -40,
      scaleX: 1.6,
      scaleY: 1.6,
      strokeColor: "#10b981",
      strokeWidth: 4,
      startTime: 4.5,
      duration: 2.0
    }
  };
  console.log("Input:", JSON.stringify(svgInput, null, 2));

  const svgResult = projectStore.addCanvasElement(projectId, sceneId, svgInput.elementType, svgInput.properties);
  console.log("Output Summary:");
  console.log(`- Created SVG Object ID: ${svgResult.objectId}`);

  // Step 5: add_camera_movement
  console.log("\n[Tool 5: add_camera_movement]");
  const cam1Input = { projectId, sceneId, time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" };
  const cam2Input = { projectId, sceneId, time: 4.0, x: 40, y: 15, zoom: 1.25, easing: "easeInOut" };
  console.log("Inputs:", JSON.stringify([cam1Input, cam2Input], null, 2));

  projectStore.addCameraMovement(projectId, sceneId, cam1Input);
  projectStore.addCameraMovement(projectId, sceneId, cam2Input);
  console.log("Output Summary: Camera keyframes successfully configured.");

  // Step 6: get_whiteboard_project
  console.log("\n[Tool 6: get_whiteboard_project]");
  console.log("Input:", JSON.stringify({ projectId }, null, 2));

  const finalProject = projectStore.getProject(projectId);
  console.log("Output Summary: Loaded project successfully.");
  console.log(`- Final Duration: ${finalProject.scenes[0].duration}s`);
  console.log(`- Elements Inside Scene: ${finalProject.scenes[0].objects.length + finalProject.scenes[0].svgObjects.length}`);

  // Step 7: export_whiteboard_video
  console.log("\n[Tool 7: export_whiteboard_video]");
  const outPath = path.resolve(process.cwd(), "renders", projectId, "demo.mp4");
  const exportCmd = `PATH=/opt/homebrew/bin:$PATH node scripts/renderVideo.js --project ${projectPath} --out ${outPath} --fps 30`;
  console.log("Running Render Shell Command:", exportCmd);

  execSync(exportCmd, { stdio: "inherit" });

  console.log("\n=== TOOL FLOW VERIFICATION DONE ===");
  console.log(`- Project JSON Path: ${projectPath}`);
  console.log(`- Exported MP4 Path: ${outPath}`);
  const fileExists = fs.existsSync(outPath);
  console.log(`- MP4 File Exists: ${fileExists ? "✅ YES" : "❌ NO"}`);
}

main().catch((err) => {
  console.error("Tool Flow Demo failed:", err);
});
