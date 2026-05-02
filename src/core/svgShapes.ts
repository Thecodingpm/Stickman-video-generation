/**
 * Ready-made SVG path data for common whiteboard shapes.
 * All paths are normalized to approx 100×100 units — scale via scaleX/scaleY.
 *
 * These are used in the demo scene. Replace / extend with real imported SVGs.
 */

export const SVG_SHAPES = {

    // Simple rectangle outline
    rectangle: "M 0 0 L 100 0 L 100 60 L 0 60 Z",

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

    // Infinity symbol
    infinity: [
        "M 50 50",
        "C 50 30 20 10 0 30",
        "C -20 50 0 70 20 70",
        "C 40 70 50 50 50 50",
        "C 50 30 60 10 80 10",
        "C 100 10 120 30 100 50",
        "C 80 70 50 50 50 50",
    ].join(" "),

    // Underline text decoration
    underline: "M 0 0 L 120 0",

    // Bracket
    bracket: "M 20 0 L 0 0 L 0 80 L 20 80",
} as const;

export type ShapeName = keyof typeof SVG_SHAPES;