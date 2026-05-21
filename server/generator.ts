import { CATALOG, partsByCategory, partsForThread } from "./catalog";
import type {
  BomLine,
  Category,
  Part,
  Sculpture,
  SculptureChild,
  SculptureNode,
  Side,
  ThreadType,
} from "./types";

const rand = Math.random;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickWeighted<T>(options: { value: T; weight: number }[]): T {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = rand() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.value;
  }
  return options[options.length - 1].value;
}

// ---- connection model ----------------------------------------------------

// Which sides of each category are connection points. The remaining edges
// of the bounding box are "closed" (e.g. a pipe tee has no port out its
// bottom — only top/left/right).
const SIDES_BY_CATEGORY: Record<Category, Side[]> = {
  // M8 in-line stock — both ends thread
  threaded_rod: ["top", "bottom"],
  hex_nut: ["top", "bottom"],
  coupling_nut: ["top", "bottom"],
  standoff: ["top", "bottom"],
  flange_nut: ["top", "bottom"],
  t_nut: ["top", "bottom"],
  jam_nut: ["top", "bottom"],

  // M8 terminals — one connection only (where the thread enters)
  acorn_nut: ["bottom"],
  thumb_screw: ["bottom"],
  wing_nut: ["bottom"],
  eye_bolt: ["bottom"],

  // NPT in-line
  pipe_nipple: ["top", "bottom"],
  barrel_nipple: ["top", "bottom"],
  pipe_coupling: ["top", "bottom"],

  // NPT terminals
  pipe_cap: ["bottom"],
  pipe_plug: ["bottom"],

  // NPT branching
  pipe_tee: ["top", "left", "right"],
  pipe_cross: ["top", "bottom", "left", "right"],
  pipe_elbow: ["bottom", "right"],
};

const TERMINAL_CATEGORIES: Set<Category> = new Set([
  "acorn_nut",
  "thumb_screw",
  "wing_nut",
  "eye_bolt",
  "pipe_cap",
  "pipe_plug",
]);

const BRANCHING_CATEGORIES: Set<Category> = new Set([
  "pipe_tee",
  "pipe_cross",
  "pipe_elbow",
]);

function sidesFor(cat: Category): Side[] {
  return SIDES_BY_CATEGORY[cat];
}

function isTerminal(cat: Category): boolean {
  return TERMINAL_CATEGORIES.has(cat);
}

// ---- part picking --------------------------------------------------------

interface PickContext {
  threadSystem: ThreadType;
  depth: number;
  needsTerminal: boolean; // when at max depth, prefer terminals
  preferBranching: boolean; // near root we lean into tees/crosses
}

function pickChildPart(ctx: PickContext): Part | null {
  const pool = partsForThread(ctx.threadSystem);

  // Build weighted candidates by category.
  const buckets: { part: Part; weight: number }[] = [];
  for (const p of pool) {
    const w = weightFor(p, ctx);
    if (w > 0) buckets.push({ part: p, weight: w });
  }
  if (buckets.length === 0) return null;
  return pickWeighted(buckets.map((b) => ({ value: b.part, weight: b.weight })));
}

function weightFor(p: Part, ctx: PickContext): number {
  const cat = p.category;
  const terminal = isTerminal(cat);
  const branching = BRANCHING_CATEGORIES.has(cat);

  if (ctx.needsTerminal) {
    // Strongly prefer terminals when forcing leaves.
    if (terminal) return 6;
    // Allow non-terminals at low weight so we don't fail outright.
    if (branching) return 0;
    return 0.6;
  }

  if (ctx.preferBranching) {
    if (branching) return 4;
    if (terminal) return 0.3;
    return 1.2;
  }

  // General case — favor variety, modest terminal probability.
  if (branching) return ctx.depth < 3 ? 1.6 : 0.4;
  if (terminal) return 0.9 + ctx.depth * 0.4;
  // In-line stock
  switch (cat) {
    case "threaded_rod":
      return 1.4;
    case "pipe_nipple":
    case "barrel_nipple":
      return 1.6;
    case "pipe_coupling":
      return 1.2;
    case "coupling_nut":
      return 1.0;
    case "standoff":
      return 1.2;
    case "hex_nut":
    case "jam_nut":
      return 0.9;
    case "flange_nut":
    case "t_nut":
      return 0.8;
    default:
      return 0.6;
  }
}

// Choose which side of the child meets the parent. Default to "bottom"
// (or whichever single side is the only option for that category). For
// branching parts we sometimes prefer "left" or "right" to vary the
// silhouette.
function pickChildAnchor(part: Part): Side {
  const sides = sidesFor(part.category);
  if (sides.length === 1) return sides[0];

  if (BRANCHING_CATEGORIES.has(part.category)) {
    // For tees: prefer "left" or "right" as anchor so the open ports
    // diverge from the parent direction.
    if (part.category === "pipe_tee") {
      return pick(["left", "right", "top"] as Side[]);
    }
    if (part.category === "pipe_cross") return pick(sides);
    if (part.category === "pipe_elbow") {
      // anchor on whichever, the other will branch
      return pick(sides);
    }
  }

  // In-line parts: anchor "bottom", extend "top".
  return "bottom";
}

// ---- tree growth ---------------------------------------------------------

const MAX_DEPTH = 4;
const ROOT_CHILD_STOP_PROB = 0; // root never randomly bails
const STOP_PROB_AT_DEPTH = (d: number): number => {
  if (d <= 1) return 0;
  if (d === 2) return 0.32;
  if (d === 3) return 0.55;
  return 1; // terminate
};

function grow(node: SculptureNode, depth: number, threadSystem: ThreadType): void {
  const sides = sidesFor(node.part.category);
  const openSides = sides.filter((s) => s !== node.connectionSide);

  for (const side of openSides) {
    if (depth >= MAX_DEPTH) continue;
    const stopProb = depth === 0 ? ROOT_CHILD_STOP_PROB : STOP_PROB_AT_DEPTH(depth);
    if (rand() < stopProb) continue;

    const ctx: PickContext = {
      threadSystem,
      depth,
      needsTerminal: depth >= MAX_DEPTH - 1,
      preferBranching: depth < 2 && rand() < 0.55,
    };

    const childPart = pickChildPart(ctx);
    if (!childPart) continue;

    const childAnchor = pickChildAnchor(childPart);
    const childNode: SculptureNode = {
      part: childPart,
      x: 0,
      y: 0,
      rotation: 0,
      connectionSide: childAnchor,
      children: [],
    };

    const link: SculptureChild = { parentSide: side, node: childNode };
    node.children.push(link);

    grow(childNode, depth + 1, threadSystem);
  }
}

// ---- layout (compute (x,y) positions in mm, world coords) ----------------

const SIDE_VECTOR: Record<Side, [number, number]> = {
  top: [0, -1],
  bottom: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

interface Dims {
  width: number; // local x extent (short axis when applicable)
  height: number; // local y extent (long axis)
}

function dims(part: Part): Dims {
  switch (part.category) {
    case "threaded_rod":
    case "pipe_nipple":
    case "barrel_nipple":
      return { width: part.diameter, height: part.length ?? part.diameter };
    case "eye_bolt": {
      const len = part.length ?? part.diameter * 2;
      return { width: part.diameter, height: len };
    }
    case "pipe_tee":
    case "pipe_cross":
    case "pipe_elbow":
      // square-ish bounding box (body of fitting)
      return { width: part.diameter, height: part.diameter };
    default:
      return { width: part.diameter, height: part.height ?? part.diameter };
  }
}

function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

function angleOfDeg(v: [number, number]): number {
  // Returns the rotation θ (degrees, SVG clockwise) such that the +x axis
  // rotated by θ aligns with v. We normalize to [0, 360).
  const a = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  return ((a % 360) + 360) % 360;
}

function rotateVec(v: [number, number], deg: number): [number, number] {
  const r = degToRad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

function snap90(deg: number): number {
  const v = ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
  return v;
}

function layout(node: SculptureNode): void {
  // root: already at (x=0, y=0, rotation=0); the children get oriented relative to it
  const parentDims = dims(node.part);
  for (const child of node.children) {
    const { parentSide, node: cn } = child;

    // World direction of parent's exit, given parent's rotation
    const parentExitDirLocal = SIDE_VECTOR[parentSide];
    const parentExitDirWorld = rotateVec(parentExitDirLocal, node.rotation);

    // Parent's exit point in world
    const parentExitLocal: [number, number] = [
      parentExitDirLocal[0] * (parentDims.width / 2),
      parentExitDirLocal[1] * (parentDims.height / 2),
    ];
    const parentExitOffsetWorld = rotateVec(parentExitLocal, node.rotation);
    const exitWorldX = node.x + parentExitOffsetWorld[0];
    const exitWorldY = node.y + parentExitOffsetWorld[1];

    // Desired world direction for child's connectionSide: opposite of parent exit
    const desiredChildDir: [number, number] = [
      -parentExitDirWorld[0],
      -parentExitDirWorld[1],
    ];
    const childAnchorLocal = SIDE_VECTOR[cn.connectionSide];

    // Solve rotation
    const rot = snap90(angleOfDeg(desiredChildDir) - angleOfDeg(childAnchorLocal));
    cn.rotation = rot;

    // Child's anchor point in world relative to child center
    const childDims = dims(cn.part);
    const anchorLocalScaled: [number, number] = [
      childAnchorLocal[0] * (childDims.width / 2),
      childAnchorLocal[1] * (childDims.height / 2),
    ];
    const anchorWorldOffset = rotateVec(anchorLocalScaled, cn.rotation);

    cn.x = exitWorldX - anchorWorldOffset[0];
    cn.y = exitWorldY - anchorWorldOffset[1];

    layout(cn);
  }
}

// ---- collection & BOM ----------------------------------------------------

function collectParts(node: SculptureNode, out: Part[]): void {
  out.push(node.part);
  for (const c of node.children) collectParts(c.node, out);
}

function boundingBox(node: SculptureNode): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const d = dims(node.part);
  // Conservatively use the half-extent magnitudes — since dims are
  // axis-aligned at rotation 0 and we only ever snap to 90° increments,
  // the rotated box still has the same set of dimensions just swapped.
  const isSideways = node.rotation % 180 !== 0;
  const halfW = (isSideways ? d.height : d.width) / 2;
  const halfH = (isSideways ? d.width : d.height) / 2;
  let bb = {
    minX: node.x - halfW,
    maxX: node.x + halfW,
    minY: node.y - halfH,
    maxY: node.y + halfH,
  };
  for (const c of node.children) {
    const cb = boundingBox(c.node);
    bb = {
      minX: Math.min(bb.minX, cb.minX),
      maxX: Math.max(bb.maxX, cb.maxX),
      minY: Math.min(bb.minY, cb.minY),
      maxY: Math.max(bb.maxY, cb.maxY),
    };
  }
  return bb;
}

function buildBom(allParts: Part[]): BomLine[] {
  const counts = new Map<string, { part: Part; qty: number }>();
  for (const part of allParts) {
    const existing = counts.get(part.partNumber);
    if (existing) existing.qty += 1;
    else counts.set(part.partNumber, { part, qty: 1 });
  }
  return Array.from(counts.values())
    .map(({ part, qty }) => ({
      partNumber: part.partNumber,
      name: part.name,
      qty,
      unitPrice: part.unitPrice,
      subtotal: Math.round(part.unitPrice * qty * 100) / 100,
      material: part.material,
      mcmasterUrl: part.mcmasterUrl,
      priceUrl: `https://www.mcmaster.com/${part.partNumber}`,
    }))
    .sort((a, b) => b.subtotal - a.subtotal);
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---- root choice ---------------------------------------------------------

function pickRoot(threadSystem: ThreadType): SculptureNode {
  let candidates: Part[];
  if (threadSystem === "1/4-NPT") {
    // Branching pipe fittings preferred; otherwise a heavy coupling.
    const tees = partsByCategory("1/4-NPT", "pipe_tee");
    const crosses = partsByCategory("1/4-NPT", "pipe_cross");
    const couplings = partsByCategory("1/4-NPT", "pipe_coupling");
    const choice = pickWeighted([
      { value: "tee" as const, weight: 5 },
      { value: "cross" as const, weight: 3 },
      { value: "coupling" as const, weight: 1 },
    ]);
    candidates =
      choice === "tee" ? tees : choice === "cross" ? crosses : couplings;
    if (candidates.length === 0) candidates = tees.concat(crosses, couplings);
  } else {
    // M8 system: prefer a heavy/wide base — flange nut, t-nut, or coupling.
    const flanges = partsByCategory("M8", "flange_nut");
    const tnuts = partsByCategory("M8", "t_nut");
    const couplings = partsByCategory("M8", "coupling_nut");
    const choice = pickWeighted([
      { value: "flange" as const, weight: 4 },
      { value: "tnut" as const, weight: 2 },
      { value: "coupling" as const, weight: 3 },
    ]);
    candidates =
      choice === "flange" ? flanges : choice === "tnut" ? tnuts : couplings;
  }

  const part = pick(candidates);
  return {
    part,
    x: 0,
    y: 0,
    rotation: 0,
    // A conventional "anchor" — root has no parent so this side is just
    // unavailable for child growth. Use bottom for in-line parts so the
    // sculpture grows upward; use bottom for tees to let top/left/right
    // branch out.
    connectionSide: "bottom",
    children: [],
  };
}

export function generateSculpture(): Sculpture {
  const threadSystem = pickWeighted<ThreadType>([
    { value: "1/4-NPT", weight: 0.7 },
    { value: "M8", weight: 0.3 },
  ]);

  const root = pickRoot(threadSystem);
  grow(root, 0, threadSystem);
  layout(root);

  const allParts: Part[] = [];
  collectParts(root, allParts);
  const bom = buildBom(allParts);
  const bbox = boundingBox(root);
  const spanMm = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);

  return {
    id: makeId(),
    createdAt: new Date().toISOString(),
    threadSystem,
    root,
    bom,
    totals: {
      partCount: allParts.length,
      totalCost: Math.round(bom.reduce((s, l) => s + l.subtotal, 0) * 100) / 100,
      spanMm: Math.round(spanMm),
    },
  };
}

export function catalogSize(): number {
  return CATALOG.length;
}
