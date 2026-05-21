// Mirror of server/types.ts — kept in sync manually.
export type Category =
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
  length?: number;
  height?: number;
  diameter: number;
  unitPrice: number;
  mcmasterUrl: string;
}

export type Side = "top" | "bottom" | "left" | "right";

export interface SculptureNode {
  part: Part;
  x: number;
  y: number;
  rotation: number;
  connectionSide: Side;
  children: SculptureChild[];
}

export interface SculptureChild {
  parentSide: Side;
  node: SculptureNode;
}

export interface BomLine {
  partNumber: string;
  name: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  material: Material;
  mcmasterUrl: string;
  priceUrl: string;
}

export interface Sculpture {
  id: string;
  createdAt: string;
  threadSystem: ThreadType;
  root: SculptureNode;
  bom: BomLine[];
  totals: {
    partCount: number;
    totalCost: number;
    spanMm: number;
  };
}
