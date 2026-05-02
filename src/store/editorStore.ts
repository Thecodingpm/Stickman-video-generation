/**
 * Editor UI state — completely separate from engine state.
 * Tracks: selected object, active panel, drag state, cursor mode.
 * Never touches sceneStore directly — App.tsx bridges the two.
 */

export type SelectedObjectType = "animated" | "svg";

export interface SelectedObject {
  id:   string;
  type: SelectedObjectType;
}

export type CursorMode = "select" | "pan" | "addText" | "addRect" | "addCircle" | "addSvg";

export type ActivePanel = "properties" | "assets" | null;

interface EditorState {
  selected:    SelectedObject | null;
  cursorMode:  CursorMode;
  activePanel: ActivePanel;
  isDragging:  boolean;
  dragStartWorld: { x: number; y: number } | null;
  dragStartObj:   { x: number; y: number } | null;
}

type Listener = () => void;

function buildEditorStore() {
  let state: EditorState = {
    selected:       null,
    cursorMode:     "select",
    activePanel:    "properties",
    isDragging:     false,
    dragStartWorld: null,
    dragStartObj:   null,
  };

  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach(fn => fn());

  return {
    // ── Read ──────────────────────────────────────────────────────────────────
    getState:    ()  => ({ ...state }),
    getSelected: ()  => state.selected,
    getMode:     ()  => state.cursorMode,
    getPanel:    ()  => state.activePanel,
    isDragging:  ()  => state.isDragging,

    // ── Selection ─────────────────────────────────────────────────────────────
    select: (id: string, type: SelectedObjectType) => {
      state = { ...state, selected: { id, type }, activePanel: "properties" };
      notify();
    },
    deselect: () => {
      state = { ...state, selected: null };
      notify();
    },

    // ── Cursor mode ───────────────────────────────────────────────────────────
    setMode: (mode: CursorMode) => {
      state = { ...state, cursorMode: mode };
      notify();
    },

    // ── Panel ─────────────────────────────────────────────────────────────────
    setPanel: (panel: ActivePanel) => {
      state = { ...state, activePanel: panel };
      notify();
    },

    // ── Drag state ────────────────────────────────────────────────────────────
    beginDrag: (worldX: number, worldY: number, objX: number, objY: number) => {
      state = {
        ...state,
        isDragging:     true,
        dragStartWorld: { x: worldX, y: worldY },
        dragStartObj:   { x: objX,   y: objY   },
      };
    },
    getDragStart: () => ({ world: state.dragStartWorld, obj: state.dragStartObj }),
    endDrag: () => {
      state = { ...state, isDragging: false, dragStartWorld: null, dragStartObj: null };
      notify();
    },

    // ── Subscribe ─────────────────────────────────────────────────────────────
    subscribe: (fn: Listener) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const editorStore = buildEditorStore();
