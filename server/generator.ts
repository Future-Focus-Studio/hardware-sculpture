import { CATALOG, partsByCategory, rodsFor } from "./catalog";
import type {
  BomLine,
  Part,
  PlacedPart,
  Sculpture,
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

function intBetween(min: number, max: number): number {
  return Math.floor(min + rand() * (max - min + 1));
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
    }))
    .sort((a, b) => b.subtotal - a.subtotal);
}

// ---------- M8 sculpture ----------
function generateM8(): Sculpture {
  const threadSystem: ThreadType = "M8";
  const allRods = rodsFor(threadSystem);
  const numRods = pickWeighted([
    { value: 1, weight: 4 },
    { value: 2, weight: 3 },
    { value: 3, weight: 1 },
  ]);

  // Pick rods — prefer mid-length for shorter sculptures so multi-rod stays
  // visually reasonable.
  const rodPool =
    numRods >= 2 ? allRods.filter((r) => (r.length ?? 0) <= 500) : allRods;
  const rods: Part[] = [];
  for (let i = 0; i < numRods; i++) rods.push(pick(rodPool));

  const couplingNuts = partsByCategory("M8", "coupling_nut");
  const hexNuts = partsByCategory("M8", "hex_nut");
  const acornNuts = partsByCategory("M8", "acorn_nut");
  const standoffs = partsByCategory("M8", "standoff");

  // ---- assemble spine ----
  const spine: PlacedPart[] = [];
  let spineCursor = 0;
  const jointCouplings: PlacedPart[] = [];
  for (let i = 0; i < rods.length; i++) {
    const rod = rods[i];
    spine.push({
      part: rod,
      yOffset: spineCursor,
      occupies: rod.length ?? 0,
    });
    spineCursor += rod.length ?? 0;
    if (i < rods.length - 1) {
      // Joint coupling — straddles the join. Visually we draw it centered on
      // the join point.
      const coupling = pick(couplingNuts);
      const couplingH = coupling.height ?? 24;
      jointCouplings.push({
        part: coupling,
        yOffset: spineCursor - couplingH / 2,
        occupies: couplingH,
      });
    }
  }
  const totalRodLength = spineCursor;

  // ---- assemble fittings ----
  const fittings: PlacedPart[] = [];

  // Base hex nut
  const baseNut = pick(hexNuts);
  const baseH = baseNut.height ?? 6.5;
  fittings.push({ part: baseNut, yOffset: 0, occupies: baseH });

  // Optional second base nut for a "double-nut lock"
  if (rand() < 0.5) {
    const secondBase = pick(hexNuts);
    const h = secondBase.height ?? 6.5;
    fittings.push({
      part: secondBase,
      yOffset: baseH,
      occupies: h,
    });
  }

  // Cap nut — acorn most of the time, hex sometimes
  const capNut =
    rand() < 0.7 && acornNuts.length > 0 ? pick(acornNuts) : pick(hexNuts);
  const capH = capNut.height ?? 6.5;
  const capY = totalRodLength - capH;

  // Optional jam nut just below cap
  let jamY: number | null = null;
  if (rand() < 0.5) {
    const jam = pick(hexNuts);
    const jamH = jam.height ?? 6.5;
    jamY = capY - jamH;
    fittings.push({ part: jam, yOffset: jamY, occupies: jamH });
  }

  // Middle stack — fill the available region with standoffs and the occasional
  // nut/coupling for visual rhythm.
  const stackStart = fittings.reduce(
    (m, f) => Math.max(m, f.yOffset + f.occupies),
    0,
  );
  const stackEnd = jamY ?? capY;

  let y = stackStart;
  // Insert any joint couplings whose center falls within our buildable range.
  const sortedJoints = [...jointCouplings].sort(
    (a, b) => a.yOffset - b.yOffset,
  );

  const middlePool: Part[] = [
    ...standoffs,
    ...standoffs, // weight standoffs heavier — they're the visual rhythm
    ...standoffs,
    ...hexNuts,
    ...couplingNuts,
  ];

  let safety = 50;
  while (y < stackEnd - 5 && safety-- > 0) {
    // If a joint coupling is "due", place it.
    if (sortedJoints.length > 0 && y >= sortedJoints[0].yOffset - 5) {
      const joint = sortedJoints.shift()!;
      const yo = Math.max(y, joint.yOffset);
      if (yo + joint.occupies > stackEnd) break;
      fittings.push({ part: joint.part, yOffset: yo, occupies: joint.occupies });
      y = yo + joint.occupies;
      continue;
    }

    const next = pick(middlePool);
    const h = next.height ?? 6.5;
    if (y + h > stackEnd) break;
    fittings.push({ part: next, yOffset: y, occupies: h });
    y += h;

    // small air gap on standoff transitions for visual breathing
    if (next.category === "standoff" && rand() < 0.25) y += 1;
  }

  // Any remaining joint couplings (their position was outside the iteration —
  // place them where they belong if there's room).
  for (const joint of sortedJoints) {
    if (joint.yOffset + joint.occupies <= stackEnd) {
      fittings.push(joint);
    }
  }

  // Place cap last so it renders on top.
  fittings.push({ part: capNut, yOffset: capY, occupies: capH });

  // Sort fittings by y position for clean output.
  fittings.sort((a, b) => a.yOffset - b.yOffset);

  const allParts: Part[] = [
    ...spine.map((p) => p.part),
    ...fittings.map((p) => p.part),
  ];
  const bom = buildBom(allParts);

  return {
    id: makeId(),
    createdAt: new Date().toISOString(),
    threadSystem,
    spine,
    fittings,
    bom,
    totals: {
      partCount: allParts.length,
      totalCost: Math.round(bom.reduce((s, l) => s + l.subtotal, 0) * 100) / 100,
      heightMm: totalRodLength,
    },
  };
}

// ---------- 1/4" NPT sculpture (occasional alternative) ----------
function generateNpt(): Sculpture {
  const threadSystem: ThreadType = "1/4-NPT";
  const nipples = rodsFor(threadSystem);
  const couplings = partsByCategory("1/4-NPT", "pipe_coupling");
  const caps = partsByCategory("1/4-NPT", "pipe_cap");

  const numNipples = pickWeighted([
    { value: 2, weight: 3 },
    { value: 3, weight: 2 },
  ]);

  const spine: PlacedPart[] = [];
  const fittings: PlacedPart[] = [];

  let cursor = 0;
  // Base cap (the sculpture stands on a pipe cap acting as a foot).
  const baseCap = pick(caps);
  const baseCapH = baseCap.height ?? 18;
  fittings.push({ part: baseCap, yOffset: 0, occupies: baseCapH });
  cursor += baseCapH;

  for (let i = 0; i < numNipples; i++) {
    const nip = pick(nipples);
    const nipL = nip.length ?? 51;
    spine.push({ part: nip, yOffset: cursor, occupies: nipL });
    cursor += nipL;
    // Coupling between segments
    if (i < numNipples - 1) {
      const c = pick(couplings);
      const cH = c.height ?? 26;
      fittings.push({ part: c, yOffset: cursor, occupies: cH });
      cursor += cH;
    }
  }

  // Top cap
  const topCap = pick(caps);
  const topCapH = topCap.height ?? 18;
  fittings.push({ part: topCap, yOffset: cursor, occupies: topCapH });
  cursor += topCapH;

  fittings.sort((a, b) => a.yOffset - b.yOffset);

  const allParts = [
    ...spine.map((p) => p.part),
    ...fittings.map((p) => p.part),
  ];
  const bom = buildBom(allParts);

  return {
    id: makeId(),
    createdAt: new Date().toISOString(),
    threadSystem,
    spine,
    fittings,
    bom,
    totals: {
      partCount: allParts.length,
      totalCost: Math.round(bom.reduce((s, l) => s + l.subtotal, 0) * 100) / 100,
      heightMm: cursor,
    },
  };
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function generateSculpture(): Sculpture {
  const system = pickWeighted<ThreadType>([
    { value: "M8", weight: 0.82 },
    { value: "1/4-NPT", weight: 0.18 },
  ]);
  return system === "M8" ? generateM8() : generateNpt();
}

export function catalogSize(): number {
  return CATALOG.length;
}
