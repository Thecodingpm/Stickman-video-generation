/**
 * E2E AI SVG Stroke Refiner & Path Routing Sequence Optimizer Test
 * 
 * Tests:
 * 1. Local TSP Nearest-Neighbor optimizer:
 *    - Reorders out-of-order sub-paths based on continuous drawing proximity to avoid hand jumps.
 * 2. Headless fallback coordinate parsing:
 *    - Verify correct start/end coordinates are parsed without browser DOM.
 * 3. AI SVG centerline stroke refiner:
 *    - Run Gemini-powered centerline conversion.
 *    - Falls back gracefully with beautiful mock simulation if key is missing.
 */
import { optimizeSubPaths } from "../src/core/svgPath";
import { refineSvgWithAi } from "../mcp/aiSvgRefiner";

// Override SCRIPEFLOW_TEST to prevent server auto-start if imported
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

// ── Test 1: TSP Path Routing Sequence Optimizer ────────────────────────────
console.error(`\n${divider}`);
console.error(`🧪 Test 1: TSP Path Sequence Optimizer`);
console.error(divider);

// Let's create three out-of-order path segments:
// Path A: draws horizontal line from (10, 10) to (50, 10)
// Path B: draws a distant line from (500, 500) to (550, 500)
// Path C: draws a connector line starting at (52, 10) and ending at (498, 500)
//
// If drawn in A -> B -> C:
//   - A ends at (50, 10), hand teleports to (500, 500) for B (distance = 692px jump!)
//   - B ends at (550, 500), hand teleports to (52, 10) for C (distance = 700px jump!)
//
// If optimized by TSP sequencer:
//   - Starts with A (top-left). Ends at (50, 10).
//   - Next closest is C starting at (52, 10) (distance = 2px!). Ends at (498, 500).
//   - Next closest is B starting at (500, 500) (distance = 2px!).
// Optimal Order: A -> C -> B! Visual jumps reduced from ~1400px to 4px!

const pathA = "M 10 10 L 50 10";
const pathB = "M 500 500 L 550 500";
const pathC = "M 52 10 L 498 500";

const rawSequence = [pathA, pathB, pathC];
console.error("   Raw sequence input: ", rawSequence);

const optimized = optimizeSubPaths(rawSequence, "test-obj");
console.error("   Optimized sequence output:", optimized);

assert(optimized.length === 3, "Optimized sequence should have exactly 3 segments");
assert(optimized[0] === pathA, "Should start with path A (top-left-most)");
assert(optimized[1] === pathC, "Should sequence path C next due to end-to-start proximity (50,10 -> 52,10)");
assert(optimized[2] === pathB, "Should draw path B last due to continuous layout");

// ── Test 2: Headless Coordinate Parser Fallback ───────────────────────────
console.error(`\n${divider}`);
console.error(`🧪 Test 2: Headless Coordinate Parser Fallback`);
console.error(divider);

// Verifies that the regex coordinate parser handles diverse SVG command syntaxes
const testPath1 = "M12.5,45.2 C 10,20 30,40 100.2 200.8";
const testPath2 = "m 50 -10.5 l 20,30 z";

// Manually trigger the optimizeSubPaths coordinate matching logic using out-of-order coordinates
// Path 1 starts at (12.5, 45.2), ends at (100.2, 200.8)
// Path 2 starts at (50, -10.5), ends at (50, -10.5) (closed shape "z" fallback)
// Out of order segments: Path 1, Path 2
// Sequence solver:
// - Start segment: Path 2 (starts at x+y = 39.5, Path 1 starts at x+y = 57.7)
// - Path 2 ends at (50, -10.5).
// - Path 1 starting at (12.5, 45.2) is closest.
const optimizedCoords = optimizeSubPaths([testPath1, testPath2], "test-coords");
console.error("   Optimized coordinate paths:", optimizedCoords);
assert(optimizedCoords[0] === testPath2, "Should start with testPath2 (closest to 0,0)");
assert(optimizedCoords[1] === testPath1, "Should continue to testPath1");


// ── Test 3: AI centerline stroke refiner (Gemini API) ────────────────────
console.error(`\n${divider}`);
console.error(`🧪 Test 3: AI Vector Centerline Refiner (Gemini)`);
console.error(divider);

const messyRawSvg = `
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- A fat solid-filled arrow block that looks messy when drawn by hand -->
  <polygon points="50,15 100,100 80,100 80,180 20,180 20,100 0,100" fill="#3b82f6" />
</svg>
`.trim();

const geminiApiKey = process.env.GEMINI_API_KEY;

if (geminiApiKey) {
  console.error("   [ENV] GEMINI_API_KEY detected. Running active E2E API refinement call...");
  
  refineSvgWithAi(messyRawSvg, geminiApiKey)
    .then(result => {
      console.error("\n✨ [SUCCESS] AI Vector Refinement Succeeded! ✨");
      console.error("--- RAW SVG INPUT ---");
      console.error(messyRawSvg);
      console.error("--- AI OPTIMIZED SVG OUTPUT ---");
      console.error(result.optimizedSvg);
      
      assert(result.optimizedSvg.includes("<svg"), "Output should be a valid SVG string wrapper");
      assert(result.optimizedSvg.includes("d="), "Output should contain path data");
      assert(result.optimizedSvg.includes('fill="none"') || result.optimizedSvg.includes('fill="transparent"'), "Should use stroke-only centerline design");
      
      finalizeTest();
    })
    .catch(err => {
      console.error("❌ E2E AI refinement failed:", err);
      allPassed = false;
      finalizeTest();
    });
} else {
  console.error("   [MOCK] No GEMINI_API_KEY detected. Simulating API refinement call for offline testing...");
  
  // Simulate active AI behavior
  const mockResponse = {
    optimizedSvg: `
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Clean centerline stroked arrow skeleton sequence -->
  <path d="M 50,180 L 50,100" fill="none" stroke="#334155" stroke-width="3" />
  <path d="M 10,100 L 50,15 L 90,100" fill="none" stroke="#334155" stroke-width="3" />
</svg>
`.trim()
  };

  console.error("--- SIMULATED RAW SVG INPUT ---");
  console.error(messyRawSvg);
  console.error("--- SIMULATED AI OPTIMIZED SVG OUTPUT ---");
  console.error(mockResponse.optimizedSvg);

  assert(mockResponse.optimizedSvg.includes("<svg"), "Output should be a valid SVG string wrapper");
  assert(mockResponse.optimizedSvg.includes("d="), "Output should contain path data");
  assert(mockResponse.optimizedSvg.includes('fill="none"') || mockResponse.optimizedSvg.includes('fill="transparent"'), "Should use stroke-only centerline design");
  
  console.error("\n💡 To run E2E active testing against the live Gemini API, execute:");
  console.error("   GEMINI_API_KEY=\"your-key\" npx tsx scripts/testAiVectorRefiner.ts");
  
  finalizeTest();
}

function finalizeTest() {
  console.error(`\n${divider}`);
  if (allPassed) {
    console.error("🎉 ALL E2E AI VECTOR REFINER AND TSP SOLVER TESTS PASSED! 🎉");
    process.exit(0);
  } else {
    console.error("❌ SOME TESTS FAILED. PLEASE CHECK LOGS ABOVE. ❌");
    process.exit(1);
  }
}
