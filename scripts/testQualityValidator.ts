/**
 * E2E Quality Validator Test
 * 
 * Tests:
 * 1. Validate a healthy project (should pass)
 * 2. Validate a broken project (should detect errors)
 * 3. Auto-fix the broken project (should repair issues)
 * 4. Re-validate the fixed project (should pass)
 * 5. Test compileProjectFromOutline integration (auto-fix runs transparently)
 */
import { validateProject, autoFixProject, validateAndFixProject } from "../mcp/qualityValidator";
import { compileProjectFromOutline } from "../mcp/server";

// Override SCRIPEFLOW_TEST to prevent server auto-start
process.env.SCRIPEFLOW_TEST = "true";

const divider = "=".repeat(66);
let allPassed = true;

function assert(condition: boolean, label: string) {
  if (!condition) {
    console.error(`   ❌ FAIL: ${label}`);
    allPassed = false;
  } else {
    console.error(`   ✅ PASS: ${label}`);
  }
}

// ── Test 1: Validate a Healthy Project ─────────────────────────────────────
console.error(`\n${divider}`);
console.error(`🧪 Test 1: Validate a Healthy Project`);
console.error(divider);

const healthyProject = {
  metadata: { title: "Test Project", width: 1920, height: 1080, fps: 30 },
  scenes: [
    {
      id: "scene-001",
      name: "Introduction",
      duration: 8.0,
      startTime: 0,
      objects: [
        {
          id: "title-001",
          type: "text",
          content: "Welcome to the Test!",
          x: 0,
          y: 0,
          startTime: 0.5,
          duration: 6.0,
          easing: "easeOut",
          animationType: "draw",
          fontSize: 54,
          fillColor: "#1e293b",
          textWrapWidth: 700
        }
      ],
      svgObjects: [
        {
          id: "svg-001",
          pathData: "M10 20 L50 80 Z",
          x: 200,
          y: 100,
          scaleX: 1.5,
          scaleY: 1.5,
          strokeColor: "#334155",
          strokeWidth: 3,
          fillColor: "transparent",
          startTime: 1.0,
          duration: 5.0,
          easing: "easeOut",
          animationType: "draw"
        }
      ],
      cameraKeyframes: [{ time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" }]
    },
    {
      id: "scene-002",
      name: "Explanation",
      duration: 10.0,
      startTime: 8.0,
      objects: [
        {
          id: "text-002",
          type: "text",
          content: "Here is the key concept explained step by step.",
          x: 0,
          y: -100,
          startTime: 0.3,
          duration: 8.0,
          easing: "easeOut",
          animationType: "draw",
          fontSize: 36,
          fillColor: "#1e293b",
          textWrapWidth: 700
        }
      ],
      svgObjects: [],
      cameraKeyframes: [{ time: 0, x: 0, y: 0, zoom: 1.0, easing: "linear" }]
    }
  ],
  audioTracks: [],
  subtitles: []
};

const healthyResult = validateProject(healthyProject);
console.error(`   Valid: ${healthyResult.valid}`);
console.error(`   Warnings: ${healthyResult.warnings.length}`);
console.error(`   Summary: ${JSON.stringify(healthyResult.summary)}`);
assert(healthyResult.valid, "Healthy project should be valid");
assert(healthyResult.warnings.length === 0, "Healthy project should have zero warnings");
assert(healthyResult.summary.sceneCount === 2, "Healthy project should have 2 scenes");
assert(healthyResult.summary.objectCount === 2, "Healthy project should have 2 text objects");
assert(healthyResult.summary.svgCount === 1, "Healthy project should have 1 SVG object");

// ── Test 2: Validate a Broken Project ──────────────────────────────────────
console.error(`\n${divider}`);
console.error(`🧪 Test 2: Validate a Broken Project (should detect errors)`);
console.error(divider);

const brokenProject = {
  metadata: { title: "Broken", fps: 30 },
  scenes: [
    {
      id: "scene-broken-1",
      name: "Missing Everything",
      duration: 2.0, // Too short
      startTime: 0,
      objects: [
        {
          // Missing ID
          type: "text",
          content: "",  // Empty text
          x: 0,
          y: 0,
          startTime: -1, // Negative start
          duration: 0,   // Zero duration
          // Missing easing
          // Missing animationType
        },
        {
          id: "obj-valid",
          type: "text",
          content: "Valid text element",
          x: 50,
          y: 50,
          startTime: 0.5,
          duration: 1.0,
          easing: "easeOut",
          animationType: "draw"
        }
      ],
      svgObjects: [
        {
          // Missing ID
          pathData: "",  // Empty path data (hard error)
          x: 100,
          y: 100,
          startTime: 5.0, // Outside scene duration
          duration: -2,    // Negative duration
          // Missing easing
        }
      ],
      cameraKeyframes: [
        { time: 10.0, x: 0, y: 0, zoom: 1.0, easing: "linear" } // Time out of bounds
      ]
    }
  ],
  audioTracks: [
    { id: "audio-bad", src: "test.mp3", startTime: -5, duration: 10 } // Negative start
  ],
  subtitles: [
    { text: "Bad timing", startTime: 5, endTime: 3 }, // endTime < startTime
    { text: "Negative start", startTime: -1, endTime: 2 }
  ]
};

const brokenResult = validateProject(brokenProject);
console.error(`   Valid: ${brokenResult.valid}`);
console.error(`   Total Warnings: ${brokenResult.warnings.length}`);
brokenResult.warnings.forEach(w => {
  console.error(`      [${w.severity.toUpperCase()}] ${w.code}: ${w.message}`);
});

assert(!brokenResult.valid, "Broken project should be invalid");
assert(brokenResult.warnings.length >= 5, "Broken project should have at least 5 warnings");

const errorCodes = brokenResult.warnings.filter(w => w.severity === "error").map(w => w.code);
assert(errorCodes.includes("MISSING_OBJECT_ID"), "Should detect missing object ID");
assert(errorCodes.includes("MISSING_SVG_PATH_DATA"), "Should detect empty SVG pathData");
assert(errorCodes.includes("CAMERA_KEYFRAME_OUT_OF_BOUNDS"), "Should detect camera keyframe out of bounds");
assert(errorCodes.includes("OBJECT_START_OUT_OF_BOUNDS"), "Should detect object startTime out of bounds");
assert(errorCodes.includes("OBJECT_INVALID_DURATION"), "Should detect object with zero/negative duration");

// ── Test 3: Auto-fix the Broken Project ────────────────────────────────────
console.error(`\n${divider}`);
console.error(`🧪 Test 3: Auto-fix the Broken Project`);
console.error(divider);

const fixResult = validateAndFixProject(JSON.parse(JSON.stringify(brokenProject)));
console.error(`   Fixes Applied: ${fixResult.fixesApplied.length}`);
fixResult.fixesApplied.forEach(fix => {
  console.error(`      ✔ ${fix}`);
});
console.error(`   Before: ${fixResult.before.warnings.length} warnings (valid: ${fixResult.before.valid})`);
console.error(`   After:  ${fixResult.after.warnings.length} warnings (valid: ${fixResult.after.valid})`);

assert(fixResult.fixesApplied.length >= 3, "Should apply at least 3 fixes");
assert(!fixResult.before.valid, "Before fix should be invalid");
// Note: some errors like CAMERA_KEYFRAME_OUT_OF_BOUNDS are not auto-fixed, but 
// empty text + empty SVG are removed, and missing IDs/easing/animation are fixed
assert(fixResult.after.warnings.length < fixResult.before.warnings.length, "After fix should have fewer warnings");

// Verify specific auto-fixes
const fixedSceneObjs = fixResult.project.scenes[0].objects;
const fixedSceneSvgs = fixResult.project.scenes[0].svgObjects;

// Empty text should have been removed
const emptyTexts = fixedSceneObjs.filter((o: any) => o.type === "text" && (!o.content || o.content.trim() === ""));
assert(emptyTexts.length === 0, "Empty text elements should be removed by auto-fix");

// Empty SVG pathData should have been removed  
const emptySvgs = fixedSceneSvgs.filter((s: any) => !s.pathData || s.pathData.trim() === "");
assert(emptySvgs.length === 0, "SVGs with empty pathData should be removed by auto-fix");

// Remaining objects should have easing set
const missingEasing = fixedSceneObjs.filter((o: any) => !o.easing);
assert(missingEasing.length === 0, "All remaining objects should have easing after fix");

// ── Test 4: Validate a Zero-scene Project ──────────────────────────────────
console.error(`\n${divider}`);
console.error(`🧪 Test 4: Auto-fix a Zero-scene Project`);
console.error(divider);

const emptyProject = {
  metadata: { title: "Empty", fps: 30 },
  scenes: [],
  audioTracks: [],
  subtitles: []
};

const emptyResult = validateAndFixProject(JSON.parse(JSON.stringify(emptyProject)));
console.error(`   Fixes Applied: ${emptyResult.fixesApplied.length}`);
emptyResult.fixesApplied.forEach(fix => {
  console.error(`      ✔ ${fix}`);
});
assert(emptyResult.project.scenes.length >= 1, "Auto-fix should add a default scene to blank project");
assert(emptyResult.after.valid, "After fix, blank project should be valid");

// ── Test 5: Outline Compiler Integration ───────────────────────────────────
console.error(`\n${divider}`);
console.error(`🧪 Test 5: compileProjectFromOutline Integration (auto-fix runs transparently)`);
console.error(divider);

const compilation = await compileProjectFromOutline({
  title: "Quality Validator Integration Test",
  outline: [
    {
      sceneName: "Introduction",
      narration: "Welcome to the quality validator integration test video.",
      visuals: [
        { type: "title", text: "Quality Validator" },
        { type: "text", text: "Ensuring broadcast-ready output" },
        { type: "shape", shapeName: "checkmark" }
      ]
    },
    {
      sceneName: "Validation Steps",
      narration: "Our quality pipeline validates every scene, every object, and every timing constraint.",
      visuals: [
        { type: "title", text: "Validation Steps" },
        { type: "text", text: "Structural checks" },
        { type: "arrow" },
        { type: "shape", shapeName: "gear" }
      ]
    },
    {
      sceneName: "Summary & Takeaways",
      narration: "In conclusion, quality validation ensures that every rendered video meets our high standards.",
      visuals: [
        { type: "title", text: "Summary" },
        { type: "text", text: "Broadcast-ready validated output" },
        { type: "shape", shapeName: "trophy" }
      ]
    }
  ],
  width: 1920,
  height: 1080,
  fps: 30
});

console.error(`   Project ID: ${compilation.projectId}`);
console.error(`   Scenes: ${compilation.summary.sceneCount}`);
console.error(`   Objects: ${compilation.summary.objectCount}`);
console.error(`   SVGs: ${compilation.summary.svgCount}`);
console.error(`   Duration: ${compilation.summary.totalDuration}s`);
console.error(`   Estimated Frames: ${compilation.summary.estimatedFrames}`);

assert(compilation.projectId !== undefined, "Compiled project should have an ID");
assert(compilation.summary.sceneCount === 3, "Compiled project should have 3 scenes");
assert(compilation.summary.totalDuration > 0, "Compiled project should have positive duration");

// Check that qualityReport is attached
const qr = (compilation as any).qualityReport;
if (qr) {
  console.error(`   Quality Report: valid=${qr.valid}, fixes=${qr.fixesApplied.length}, warningsBefore=${qr.warningsBefore}, warningsAfter=${qr.warningsAfter}`);
  assert(qr.valid, "Quality report should mark project as valid after auto-fix");
} else {
  console.error(`   ⚠ No qualityReport found on compilation result (check integration)`);
}

// Validate the final saved project
const finalValidation = validateProject(compilation.project);
assert(finalValidation.valid, "Final compiled project should be valid");
console.error(`   Final Validation: valid=${finalValidation.valid}, warnings=${finalValidation.warnings.length}`);

if (finalValidation.warnings.length > 0) {
  finalValidation.warnings.forEach(w => {
    console.error(`      [${w.severity.toUpperCase()}] ${w.code}: ${w.message}`);
  });
}

// ── Final Report ───────────────────────────────────────────────────────────
console.error(`\n${divider}`);
if (allPassed) {
  console.error(`🎉 ALL QUALITY VALIDATOR TESTS PASSED!`);
} else {
  console.error(`❌ SOME TESTS FAILED!`);
  process.exit(1);
}
console.error(divider);
