export type Category =
  // M8 family
  | "threaded_rod"
  | "hex_nut"
  | "coupling_nut"
  | "acorn_nut"
  | "standoff"
  | "thumb_screw"
  | "wing_nut"
  | "flange_nut"
  | "eye_bolt"
  | "t_nut"
  | "jam_nut"
  // 1/4" NPT family
  | "pipe_nipple"
  | "barrel_nipple"
  | "pipe_coupling"
  | "pipe_cap"
  | "pipe_plug"
  | "pipe_tee"
  | "pipe_elbow"
  | "pipe_cross";

export type ThreadType = "M8" | "1/4-NPT";

export type Material =
  | "steel"
  | "stainless"
  | "zinc"
  | "black_oxide"
  | "brass"
  | "aluminum";

export interface Part {
  partNumber: string;
  name: string;
  category: Category;
  threadType: ThreadType;
  threadSize: string;
  material: Material;
  finish: string;
  // dimensions in millimeters
  length?: number; // for rods, nipples, eye bolts (along long axis)
  height?: number; // for nuts, fittings (along axis)
  diameter: number; // outer diameter / shortest body dimension
  mcmasterUrl: string;
}

export type Side = "top" | "bottom" | "left" | "right";

export interface SculptureNode {
  part: Part;
  // pixel position of the part's bounding box center in the layout canvas
  x: number;
  y: number;
  // clockwise rotation in degrees (0, 90, 180, 270)
  rotation: number;
  // which side of THIS node connects to its parent (in the node's local frame)
  // root uses "bottom" as a conventional anchor but has no parent
  connectionSide: Side;
  children: SculptureChild[];
}

export interface SculptureChild {
  // which side of the PARENT this child branches off of (parent's local frame)
  parentSide: Side;
  node: SculptureNode;
}

export interface Sculpture {
  id: string;
  createdAt: string;
  threadSystem: ThreadType;
  root: SculptureNode;
  bom: BomLine[];
  totals: {
    partCount: number;
    spanMm: number; // bounding box max dimension
  };
}

export interface BomLine {
  partNumber: string;
  name: string;
  category: Category;
  qty: number;
  material: Material;
  mcmasterUrl: string;
}
