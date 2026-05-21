// Mirror of server/types.ts — kept in sync manually for V0.1.
export type Category =
  | "threaded_rod"
  | "hex_nut"
  | "coupling_nut"
  | "acorn_nut"
  | "standoff"
  | "pipe_nipple"
  | "pipe_coupling"
  | "pipe_cap";

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

export interface PlacedPart {
  part: Part;
  yOffset: number;
  occupies: number;
}

export interface BomLine {
  partNumber: string;
  name: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  material: Material;
  mcmasterUrl: string;
}

export interface Sculpture {
  id: string;
  createdAt: string;
  threadSystem: ThreadType;
  spine: PlacedPart[];
  fittings: PlacedPart[];
  bom: BomLine[];
  totals: {
    partCount: number;
    totalCost: number;
    heightMm: number;
  };
}
