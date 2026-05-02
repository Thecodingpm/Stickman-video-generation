export type SelectedObjectType = "animated" | "svg";

export interface SelectedObject {
  id:   string;
  type: SelectedObjectType;
}

export type CursorMode = "select" | "pan" | "addText" | "addRect" | "addCircle" | "addSvg";
export type ActivePanel = "properties" | "assets" | null;

interface EditorState {
  selected:       SelectedObject | null;
  multiSelected:  SelectedObject[];          // NEW — all selected objects
  cursorMode:     CursorMode;
  activePanel:    ActivePanel;
  isDragging:     boolean;
  dragStartWorld: { x: number; y: number } | null;
  dragStartObj:   { x: number; y: number } | null;
  snapToGrid:     boolean;                   // NEW
  gridSize:       number;                    // NEW
  clipboard:      SelectedObject[];          // NEW — copy/paste
}

type Listener = () => void;

function buildEditorStore() {
  let state: EditorState = {
    selected:       null,
    multiSelected:  [],
    cursorMode:     "select",
    activePanel:    "properties",
    isDragging:     false,
    dragStartWorld: null,
    dragStartObj:   null,
    snapToGrid:     true,
    gridSize:       10,
    clipboard:      [],
  };

  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach(fn => fn());

  return {
    getState:    () => ({ ...state }),
    getSelected: () => state.selected,
    getMultiSelected: () => state.multiSelected,
    getMode:     () => state.cursorMode,
    getPanel:    () => state.activePanel,
    isDragging:  () => state.isDragging,
    getSnapToGrid: () => state.snapToGrid,
    getGridSize:   () => state.gridSize,
    getClipboard:  () => state.clipboard,

    select: (id: string, type: SelectedObjectType) => {
      state = { ...state, selected: { id, type }, multiSelected: [{ id, type }], activePanel: "properties" };
      notify();
    },

    // Shift+click — add to or remove from multi-selection
    toggleSelect: (id: string, type: SelectedObjectType) => {
      const existing = state.multiSelected.findIndex(s => s.id === id);
      let next: SelectedObject[];
      if (existing >= 0) {
        next = state.multiSelected.filter(s => s.id !== id);
      } else {
        next = [...state.multiSelected, { id, type }];
      }
      state = {
        ...state,
        multiSelected: next,
        selected: next.length > 0 ? next[next.length - 1] : null,
        activePanel: "properties",
      };
      notify();
    },

    selectAll: (objects: SelectedObject[]) => {
      state = { ...state, multiSelected: objects, selected: objects[objects.length - 1] ?? null };
      notify();
    },

    deselect: () => {
      state = { ...state, selected: null, multiSelected: [] };
      notify();
    },

    setMode: (mode: CursorMode) => {
      state = { ...state, cursorMode: mode };
      notify();
    },

    setPanel: (panel: ActivePanel) => {
      state = { ...state, activePanel: panel };
      notify();
    },

    setSnapToGrid: (snap: boolean) => {
      state = { ...state, snapToGrid: snap };
      notify();
    },

    setGridSize: (size: number) => {
      state = { ...state, gridSize: size };
      notify();
    },

    setClipboard: (items: SelectedObject[]) => {
      state = { ...state, clipboard: items };
    },

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

    subscribe: (fn: Listener) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const editorStore = buildEditorStore();
