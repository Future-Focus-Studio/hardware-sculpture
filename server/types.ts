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
  // dimensions in millimeters
  length?: number; // for rods, nipples
  height?: number; // for nuts, standoffs (along the spine axis)
  diameter: number; // outer diameter at widest point
  unitPrice: number; // USD
  mcmasterUrl: string;
}

export interface PlacedPart {
  part: Part;
  yOffset: number; // mm from base of sculpture
  // total height occupied along the spine
  occupies: number;
}

export interface Sculpture {
  id: string;
  createdAt: string;
  threadSystem: ThreadType;
  spine: PlacedPart[]; // the rod(s) themselves
  fittings: PlacedPart[]; // nuts/spacers stacked along the spine
  bom: BomLine[];
  totals: {
    partCount: number;
    totalCost: number;
    heightMm: number;
  };
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
