# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

---

# 🤖 ScribeFlow Whiteboard Automation (MCP Server)

ScribeFlow is equipped with a local **Model Context Protocol (MCP)** server, enabling agentic AI systems (like Claude Desktop) to programmatically edit, build, and export complete whiteboard presentation videos using a suite of 9 powerful design tools.

## How to Run the MCP Server

Ensure that your node dependencies are fully installed, then start the server on standard input/output (stdio):

```bash
npm run mcp:whiteboard
```

## How to Connect to Claude Desktop

Add ScribeFlow's whiteboard server to your Claude Desktop configuration file (typically located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "scribeflow-whiteboard": {
      "command": "npm",
      "args": ["run", "mcp:whiteboard"],
      "cwd": "/Users/ahmadmuaaz/whiteboard-editor"
    }
  }
}
```

Make sure the `cwd` points to your absolute project workspace directory.

---

## Whiteboard Automation Tool Suite

The server registers 9 declarative design tools:

1. **`create_whiteboard_project`**: Initiates a storyboard with canvas constraints (`width`, `height`, `fps`, `background`).
2. **`add_whiteboard_scene`**: Sequentially appends a scene segment with timing duration envelopes.
3. **`add_canvas_element`**: Places a visual drawing (`text`, `rect`, `circle`, `image`, or premium sequential `svg` paths) with styling details.
4. **`add_camera_movement`**: Injects localized keyframe focal transitions (`x`, `y`, `zoom`, `easing`).
5. **`add_audio_track`**: Layers voiceover speech files or background soundtracks.
6. **`add_subtitles`**: Hydrates subtitles with frame-exact time overlays.
7. **`get_whiteboard_project`**: Fetches the structured project JSON.
8. **`list_whiteboard_projects`**: Lists metadata for all locally saved scribes.
9. **`export_whiteboard_video`**: Headlessly triggers Puppeteer to seek, capture base64 frame buffers, and encode to broadcast-ready `.mp4` files via FFmpeg.

---

## Example Agent Tool Flow (30-second Explainer Video)

Here is a typical tool call sequence executed by an AI agent to build a beautiful animated explainer:

### Step 1: Create the Project
**Tool Call:** `create_whiteboard_project`
```json
{
  "title": "Photosynthesis Explainer",
  "width": 1920,
  "height": 1080,
  "background": "#ffffff"
}
```
*Creates project JSON in `./projects/proj-abc.json` with standard starting scene `scene-1`.*

### Step 2: Set up the First Scene
**Tool Call:** `add_whiteboard_scene`
```json
{
  "projectId": "proj-abc",
  "sceneName": "The Solar Power",
  "duration": 5.0
}
```
*Adds `scene-2` representing the solar energy intake.*

### Step 3: Draw an Illustrative Vector and Text
**Tool Call:** `add_canvas_element` (Adding sunlight vector)
```json
{
  "projectId": "proj-abc",
  "sceneId": "scene-2",
  "elementType": "svg",
  "properties": {
    "pathData": "M 50 0 C 77.6 0 100 22.4 100 50 C 100 77.6 77.6 100 50 100 Z",
    "x": 80,
    "y": -50,
    "scaleX": 1.5,
    "scaleY": 1.5,
    "strokeColor": "#f59e0b",
    "strokeWidth": 3.5,
    "startTime": 0.5,
    "duration": 2.0
  }
}
```

**Tool Call:** `add_canvas_element` (Adding label)
```json
{
  "projectId": "proj-abc",
  "sceneId": "scene-2",
  "elementType": "text",
  "properties": {
    "content": "Solar Energy",
    "x": -120,
    "y": 140,
    "fontSize": 42,
    "fillColor": "#1e293b",
    "startTime": 1.5,
    "duration": 1.5
  }
}
```

### Step 4: Add Dynamic Camera movement
**Tool Call:** `add_camera_movement`
```json
{
  "projectId": "proj-abc",
  "sceneId": "scene-2",
  "time": 2.5,
  "x": 40,
  "y": -20,
  "zoom": 1.25,
  "easing": "easeInOut"
}
```
*Injects smooth camera panning focusing on the sunlight vector.*

### Step 5: Export to Broadcast MP4
**Tool Call:** `export_whiteboard_video`
```json
{
  "projectId": "proj-abc",
  "fps": 30,
  "outputName": "photosynthesis_final"
}
```
*Spawns headless renderer rendering and saving the finalized file to `./renders/proj-abc/photosynthesis_final.mp4`.*

