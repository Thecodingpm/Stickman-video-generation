/**
 * Ready-made SVG path data for common whiteboard shapes.
 * Most paths are normalized to a 0..100 drawing area. Some are intentionally narrower/wider within that area.
 *
 * These are used in the demo scene. Replace / extend with real imported SVGs.
 */

export const SVG_SHAPES = {

    // Simple rectangle outline (normalized to 100x100)
    rectangle: "M 0 0 L 100 0 L 100 100 L 0 100 Z",

    // Circle approximated with cubic beziers (standard SVG circle trick)
    circle: [
        "M 50 0",
        "C 77.6 0 100 22.4 100 50",
        "C 100 77.6 77.6 100 50 100",
        "C 22.4 100 0 77.6 0 50",
        "C 0 22.4 22.4 0 50 0 Z",
    ].join(" "),

    // Arrow pointing right
    arrowRight: [
        "M 0 35 L 70 35",
        "M 45 10 L 95 35 L 45 60",
    ].join(" "),

    // Star (5-pointed)
    star: [
        "M 50 0",
        "L 61 35 L 98 35 L 68 57",
        "L 79 91 L 50 70",
        "L 21 91 L 32 57",
        "L 2 35 L 39 35 Z",
    ].join(" "),

    // Checkmark
    checkmark: "M 5 50 L 35 80 L 95 15",

    // Speech bubble
    speechBubble: [
        "M 10 0 L 90 0 Q 100 0 100 10",
        "L 100 60 Q 100 70 90 70",
        "L 35 70 L 15 90 L 20 70",
        "L 10 70 Q 0 70 0 60",
        "L 0 10 Q 0 0 10 0 Z",
    ].join(" "),

    // Light bulb
    lightBulb: [
        "M 50 5 C 28 5 10 23 10 45 C 10 60 20 72 34 78",
        "L 34 88 Q 34 95 41 95 L 59 95 Q 66 95 66 88 L 66 78",
        "C 80 72 90 60 90 45 C 90 23 72 5 50 5 Z",
        "M 40 95 L 60 95",
        "M 42 100 L 58 100",
    ].join(" "),

    // Triangle
    triangle: "M 50 5 L 95 90 L 5 90 Z",

    // Infinity symbol (normalized to 0..100)
    infinity: [
        "M 50 50",
        "C 42 30 18 28 12 45",
        "C 6 62 22 76 38 63",
        "C 45 57 50 50 50 50",
        "C 50 50 55 43 62 37",
        "C 78 24 94 38 88 55",
        "C 82 72 58 70 50 50 Z",
    ].join(" "),

    // Underline text decoration (normalized to 0..100)
    underline: "M 0 50 L 100 50",

    // Cloud
    cloud: "M 25 60 C 15 60 10 50 10 40 C 10 25 25 15 40 20 C 45 10 60 10 70 20 C 85 20 90 35 90 45 C 90 55 80 60 70 60 Z",

    // Character (stick figure person)
    character: "M 50 20 C 58 20 58 8 50 8 C 42 8 42 20 50 20 Z M 50 20 L 50 60 M 50 30 L 25 45 M 50 30 L 75 45 M 50 60 L 30 90 M 50 60 L 70 90",

    // Gear
    gear: "M 50 35 C 41.7 35 35 41.7 35 50 C 35 58.3 41.7 65 50 65 C 58.3 65 65 58.3 65 50 C 65 41.7 58.3 35 50 35 Z M 50 20 L 50 28 M 50 72 L 50 80 M 20 50 L 28 50 M 72 50 L 80 50 M 29 29 L 35 35 M 65 65 L 71 71 M 71 29 L 65 35 M 35 65 L 29 71",

    // Rocket
    rocket: "M 50 5 C 50 5 65 30 65 60 L 65 80 L 35 80 L 35 60 C 35 30 50 5 50 5 Z M 35 60 L 20 80 L 35 80 Z M 65 60 L 80 80 L 65 80 Z M 45 80 L 45 95 M 50 80 L 50 95 M 55 80 L 55 95",

    // Trophy
    trophy: "M 25 10 L 75 10 L 75 40 C 75 60 65 70 50 70 C 35 70 25 60 25 40 Z M 50 70 L 50 90 M 30 90 L 70 90 M 25 20 H 10 V 40 H 25 M 75 20 H 90 V 40 H 75",

    // Globe
    globe: "M 50 5 A 45 45 0 1 0 50 95 A 45 45 0 1 0 50 5 Z M 5 50 H 95 M 50 5 V 95 M 50 5 C 20 25 20 75 50 95 C 80 75 80 25 50 5 Z",

    // Laptop (fixed broken dot path)
    laptop: [
        "M 15 15 L 85 15 L 85 65 L 15 65 Z",
        "M 5 75 L 95 75 L 85 65",
        "M 15 65 L 5 75",
        "M 47 71 C 47 69 53 69 53 71 C 53 73 47 73 47 71 Z",
    ].join(" "),

    // Analytics
    analytics: "M 10 90 H 90 M 10 10 V 90 M 20 90 V 60 H 35 V 90 M 45 90 V 40 H 60 V 90 M 70 90 V 20 H 85 V 90 M 20 50 L 50 30 L 80 10",

    // Bracket (normalized to 100x100)
    bracket: "M 35 5 L 15 5 L 15 95 L 35 95",

    // Curated premium AI whiteboard explainer assets (normalized to 0..100)
    aiBrain: [
      "M 50 15 C 38 15 25 22 25 35 C 25 42 28 48 22 52 C 16 56 12 62 12 70 C 12 82 25 90 40 90 C 45 90 48 88 50 85",
      "M 50 15 C 62 15 75 22 75 35 C 75 42 72 48 78 52 C 84 56 88 62 88 70 C 88 82 75 90 60 90 C 55 90 52 88 50 85",
      "M 50 18 L 50 82",
      "M 35 30 C 30 35 30 45 40 45 C 45 45 45 55 35 60 C 25 65 30 75 40 75",
      "M 25 45 C 20 50 20 60 30 65",
      "M 65 30 C 70 35 70 45 60 45 C 55 45 55 55 65 60 C 75 65 70 75 60 75",
      "M 75 45 C 80 50 80 60 70 65",
      "M 15 25 L 5 15 M 85 25 L 95 15 M 10 50 L 2 50 M 90 50 L 98 50 M 20 80 L 10 90 M 80 80 L 90 90"
    ].join(" "),

    neuralNetwork: [
      "M 15 25 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0",
      "M 15 75 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0",
      "M 50 20 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0",
      "M 50 50 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0",
      "M 50 80 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0",
      "M 85 50 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0",
      "M 21 23 L 44 20 M 21 27 L 44 47",
      "M 21 73 L 44 53 M 21 77 L 44 80",
      "M 56 22 L 79 46",
      "M 56 50 L 79 50",
      "M 56 78 L 79 54",
      "M 30 22 H 32 M 35 60 H 37 M 68 35 H 70"
    ].join(" "),

    machineLearning: [
      "M 10 20 H 40 V 35 H 10 Z",
      "M 10 40 H 40 V 55 H 10 Z",
      "M 10 60 H 40 V 75 H 10 Z",
      "M 15 27 H 20 M 25 27 H 35 M 15 47 H 20 M 25 47 H 35 M 15 67 H 20 M 25 67 H 35",
      "M 45 47 H 60 M 55 42 L 60 47 L 55 52",
      "M 65 30 H 95 V 65 H 65 Z",
      "M 65 47 L 72 40 L 80 55 L 88 38 L 95 47",
      "M 80 15 L 80 22 M 77 18 H 83"
    ].join(" "),

    robot: [
      "M 25 35 H 75 V 75 H 25 Z",
      "M 20 48 H 25 M 75 48 H 80",
      "M 38 50 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0",
      "M 62 50 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0",
      "M 42 62 Q 50 68 58 62",
      "M 50 35 L 50 20 M 50 18 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0",
      "M 45 75 V 82 M 55 75 V 82 M 30 82 H 70"
    ].join(" "),
} as const;

export type ShapeName = keyof typeof SVG_SHAPES;