/**
 * ScribeFlow Whiteboard Project Schema definitions.
 * Kept fully compatible with the frontend sceneStore project JSON schema.
 */

export interface SvgPathObject {
  id:          string;
  groupId?:    string;       // groups paths imported together
  pathData:    string;       // raw SVG d="..." string
  x:           number;       // world-space offset
  y:           number;
  scaleX?:     number;       // default 1
  scaleY?:     number;
  strokeColor: string;
  strokeWidth: number;
  fillColor?:  string;       // fill shown after draw completes (optional)
  startTime:   number;
  duration:    number;
  easing?:     string;

  // VideoScribe-quality draw controls
  drawOrder?:    number;
  handVisible?:  boolean;
  handOffsetX?:  number;
  handOffsetY?:  number;
  startDelay?:   number;
  subPaths?:     string[];
  opacity?:      number;     // 0-1
  rotation?:     number;     // radians
}

export interface AnimatedObject {
  id:            string;
  type:          "rect" | "circle" | "text" | "image";
  x:             number;
  y:             number;
  width?:        number;  // rect
  height?:       number;  // rect
  radius?:       number;  // circle
  content?:      string;  // text
  src?:          string;  // image source url
  fontSize?:     number;
  fontFamily?:   string;
  fontWeight?:   "normal" | "bold";
  fontStyle?:    "normal" | "italic";
  textAlign?:    "left" | "center" | "right";
  textWrapWidth?: number;
  strokeText?:   boolean;
  strokeColor?:  string;
  fillColor?:    string;
  lineWidth?:    number;

  // Timeline
  startTime:     number;  // seconds
  duration:      number;  // seconds
  easing?:       string;

  // Animation
  animationType: "draw" | "move" | "scale" | "fade";
  move?:         { fromX: number; fromY: number; toX: number; toY: number };
  scale?:        { from: number; to: number };
  exit?:         any;
}

export interface CameraKeyframe {
  time:   number;
  x:      number;
  y:      number;
  zoom:   number;
  easing: string;
}

export interface WhiteboardScene {
  id:              string;
  name:            string;
  duration:        number;          // seconds
  startTime:       number;          // global time
  objects:         AnimatedObject[];
  svgObjects:      SvgPathObject[];
  cameraKeyframes: CameraKeyframe[];
  background?:     string;
}

export interface AudioTrack {
  id:          string;
  name:        string;
  src:         string;
  startTime:   number;          // global time in seconds
  duration:    number;          // length in seconds
  volume:      number;          // 0 to 1
  isMuted?:    boolean;
}

export interface SubtitleCue {
  startTime: number;
  endTime:   number;
  text:      string;
}

export interface WhiteboardProject {
  id?:         string;
  name:        string; // Title
  metadata?: {
    width?:    number;
    height?:   number;
    fps?:      number;
  };
  scenes:      WhiteboardScene[];
  audioTracks: AudioTrack[];
  subtitles?:  SubtitleCue[];
  lastUpdated?: string;
  version?:    number;
  savedAt?:    string;
}
