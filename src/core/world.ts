export type WorldObjectType = "rect" | "circle";

export interface BaseWorldObject {
  id: string;
  x: number;
  y: number;
  type: WorldObjectType;
  fillColor?: string;
  strokeColor?: string;
  lineWidth?: number;
}

export interface RectObject extends BaseWorldObject {
  type: "rect";
  width: number;
  height: number;
}

export interface CircleObject extends BaseWorldObject {
  type: "circle";
  radius: number;
}

export type WorldObject = RectObject | CircleObject;

export interface World {
  objects: WorldObject[];
}

export function createWorld(): World {
  return {
    objects: [
      {
        id: "rect-origin",
        type: "rect",
        x: -50,
        y: -50,
        width: 100,
        height: 100,
        fillColor: "#3b82f6",
      },
      {
        id: "circle-right",
        type: "circle",
        x: 300,
        y: 0,
        radius: 60,
        fillColor: "#10b981",
      },
      {
        id: "rect-far",
        type: "rect",
        x: 500,
        y: 300,
        width: 150,
        height: 80,
        fillColor: "#f59e0b",
      },
    ],
  };
}
