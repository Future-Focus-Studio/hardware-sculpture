import { useMemo, useState } from "react";
import type {
  Part,
  SculptureChild,
  SculptureNode,
  Sculpture as SculptureT,
  Side,
} from "./types";
import { MATERIAL_STYLES } from "./materials";

interface Props {
  sculpture: SculptureT;
}

// All layout coordinates and stroke widths below are in MILLIMETERS — the SVG
// viewBox is set to the bounding box of the sculpture (with padding) so the
// browser does the mm→px conversion.

const SIDE_VECTOR: Record<Side, [number, number]> = {
  top: [0, -1],
  bottom: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const CANVAS_PAD = 22; // mm of padding around the bounding box
const STROKE_BODY = 0.55; // outer outline in mm
const STROKE_FINE = 0.2; // hatch / centerline strokes

function partDims(part: Part): { w: number; h: number } {
  switch (part.category) {
    case "threaded_rod":
    case "pipe_nipple":
    case "barrel_nipple":
      return { w: part.diameter, h: part.length ?? part.diameter };
    case "eye_bolt":
      return { w: part.diameter, h: part.length ?? part.diameter * 2 };
    case "pipe_tee":
    case "pipe_cross":
    case "pipe_elbow":
      return { w: part.diameter, h: part.diameter };
    default:
      return { w: part.diameter, h: part.height ?? part.diameter };
  }
}

interface FlatNode {
  node: SculptureNode;
  parent?: SculptureNode;
  parentSide?: Side;
}

function flatten(
  node: SculptureNode,
  out: FlatNode[],
  parent?: SculptureNode,
  parentSide?: Side,
): void {
  out.push({ node, parent, parentSide });
  for (const child of node.children) {
    flatten(child.node, out, node, child.parentSide);
  }
}

function rotateVec(v: [number, number], deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

function nodeBbox(node: SculptureNode): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const { w, h } = partDims(node.part);
  const sideways = node.rotation % 180 !== 0;
  const hw = (sideways ? h : w) / 2;
  const hh = (sideways ? w : h) / 2;
  return {
    minX: node.x - hw,
    maxX: node.x + hw,
    minY: node.y - hh,
    maxY: node.y + hh,
  };
}

function fullBbox(nodes: FlatNode[]) {
  let bb = nodeBbox(nodes[0].node);
  for (const f of nodes) {
    const b = nodeBbox(f.node);
    bb = {
      minX: Math.min(bb.minX, b.minX),
      maxX: Math.max(bb.maxX, b.maxX),
      minY: Math.min(bb.minY, b.minY),
      maxY: Math.max(bb.maxY, b.maxY),
    };
  }
  return bb;
}

interface HoverInfo {
  name: string;
  partNumber: string;
  detail: string;
}

export function Sculpture({ sculpture }: Props) {
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const flat = useMemo(() => {
    const out: FlatNode[] = [];
    flatten(sculpture.root, out);
    return out;
  }, [sculpture]);

  const bbox = useMemo(() => fullBbox(flat), [flat]);

  const vbX = bbox.minX - CANVAS_PAD;
  const vbY = bbox.minY - CANVAS_PAD;
  const vbW = bbox.maxX - bbox.minX + CANVAS_PAD * 2;
  const vbH = bbox.maxY - bbox.minY + CANVAS_PAD * 2;

  function handleEnter(part: Part) {
    setHover({
      name: part.name,
      partNumber: part.partNumber,
      detail: `${MATERIAL_STYLES[part.material].label} · ${part.finish}`,
    });
  }
  function handleLeave() {
    setHover(null);
  }

  return (
    <div className="relative w-full">
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        className="sculpture-svg w-full h-[640px] max-h-[80vh]"
        role="img"
        aria-label="Hardware sculpture branching diagram"
      >
        <defs>
          {Object.entries(MATERIAL_STYLES).map(([mat, s]) => (
            <linearGradient
              key={mat}
              id={`mat-${mat}`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor={s.dark} />
              <stop offset="40%" stopColor={s.base} />
              <stop offset="60%" stopColor={s.light} />
              <stop offset="100%" stopColor={s.dark} />
            </linearGradient>
          ))}
          <pattern
            id="hatch-dark"
            patternUnits="userSpaceOnUse"
            width="1.4"
            height="1.4"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="1.4"
              stroke="#1a1a1a"
              strokeOpacity="0.28"
              strokeWidth="0.18"
            />
          </pattern>
        </defs>

        {/* faint title-block frame, patent-drawing style */}
        <rect
          x={vbX + 2}
          y={vbY + 2}
          width={vbW - 4}
          height={vbH - 4}
          fill="none"
          stroke="#1a1a1a"
          strokeOpacity="0.10"
          strokeWidth="0.3"
        />

        {/* connection leads — render UNDER parts so part edges sit on top */}
        {flat.map((f, i) =>
          f.parent && f.parentSide ? (
            <ConnectionLead
              key={`lead-${i}`}
              parent={f.parent}
              child={f.node}
              parentSide={f.parentSide}
            />
          ) : null,
        )}

        {flat.map((f, i) => (
          <g
            key={`p-${i}`}
            transform={`translate(${f.node.x} ${f.node.y}) rotate(${f.node.rotation})`}
            onMouseEnter={() => handleEnter(f.node.part)}
            onMouseLeave={handleLeave}
            style={{ cursor: "help" }}
          >
            <PartShape part={f.node.part} />
          </g>
        ))}

        {/* connection beads on top */}
        {flat.map((f, i) =>
          f.parent && f.parentSide ? (
            <ConnectionBead
              key={`bead-${i}`}
              parent={f.parent}
              parentSide={f.parentSide}
            />
          ) : null,
        )}
      </svg>

      {/* hover info overlay */}
      <div className="pointer-events-none absolute left-3 top-3 max-w-[260px]">
        {hover ? (
          <div className="rounded-md border border-ink/15 bg-white/95 px-3 py-2 shadow-sm">
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink/55">
              {hover.partNumber}
            </div>
            <div className="text-sm font-medium leading-tight text-ink">
              {hover.name}
            </div>
            <div className="text-[11px] text-ink/60">{hover.detail}</div>
          </div>
        ) : (
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
            hover for part info
          </div>
        )}
      </div>

      {/* annotation in bottom right */}
      <div className="pointer-events-none absolute right-3 bottom-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
        Span {sculpture.totals.spanMm} mm · {sculpture.totals.partCount} parts
      </div>
    </div>
  );
}

function ConnectionLead({
  parent,
  child,
  parentSide,
}: {
  parent: SculptureNode;
  child: SculptureNode;
  parentSide: Side;
}) {
  // Parent exit point in world
  const pd = partDims(parent.part);
  const dirLocal = SIDE_VECTOR[parentSide];
  const offLocal: [number, number] = [
    dirLocal[0] * (pd.w / 2),
    dirLocal[1] * (pd.h / 2),
  ];
  const off = rotateVec(offLocal, parent.rotation);
  const px = parent.x + off[0];
  const py = parent.y + off[1];

  // Draw a short tick line from parent.center → child.center cropped to
  // parent-edge. Since parent and child edges touch, we just draw a small
  // accent line across the joint to emphasize the threaded connection.
  // Compute a tangent perpendicular to the connection axis.
  const len = Math.hypot(off[0], off[1]) || 1;
  const tx = -off[1] / len;
  const ty = off[0] / len;
  const tickLen = 1.1;
  return (
    <line
      x1={px + tx * tickLen}
      y1={py + ty * tickLen}
      x2={px - tx * tickLen}
      y2={py - ty * tickLen}
      stroke="#1a1a1a"
      strokeOpacity="0.55"
      strokeWidth={STROKE_FINE * 1.4}
    />
  );
}

function ConnectionBead({
  parent,
  parentSide,
}: {
  parent: SculptureNode;
  parentSide: Side;
}) {
  const pd = partDims(parent.part);
  const dirLocal = SIDE_VECTOR[parentSide];
  const offLocal: [number, number] = [
    dirLocal[0] * (pd.w / 2),
    dirLocal[1] * (pd.h / 2),
  ];
  const off = rotateVec(offLocal, parent.rotation);
  const cx = parent.x + off[0];
  const cy = parent.y + off[1];
  return (
    <circle
      cx={cx}
      cy={cy}
      r={0.55}
      fill="#1a1a1a"
      fillOpacity="0.7"
    />
  );
}

// ---- per-category part shapes (drawn in local frame, centered at 0,0) ----

function PartShape({ part }: { part: Part }) {
  const style = MATERIAL_STYLES[part.material];
  const fill = `url(#mat-${part.material})`;
  const { w, h } = partDims(part);

  switch (part.category) {
    case "threaded_rod":
      return <ThreadedRod w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "hex_nut":
      return <HexNut w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "coupling_nut":
      return <CouplingNut w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "acorn_nut":
      return <AcornNut w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "standoff":
      return <Standoff w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} light={style.light} />;
    case "thumb_screw":
      return <ThumbScrew w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "wing_nut":
      return <WingNut w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "flange_nut":
      return <FlangeNut w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "eye_bolt":
      return <EyeBolt w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "t_nut":
      return <TNut w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "jam_nut":
      return <JamNut w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "pipe_nipple":
      return <PipeNipple w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "barrel_nipple":
      return <BarrelNipple w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "pipe_coupling":
      return <PipeCoupling w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "pipe_cap":
      return <PipeCap w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "pipe_plug":
      return <PipePlug w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "pipe_tee":
      return <PipeTee w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "pipe_elbow":
      return <PipeElbow w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
    case "pipe_cross":
      return <PipeCross w={w} h={h} fill={fill} stroke={style.stroke} dark={style.dark} />;
  }
}

interface ShapeP {
  w: number;
  h: number;
  fill: string;
  stroke: string;
  dark: string;
  light?: string;
}

function ThreadedRod({ w, h, fill, stroke, dark }: ShapeP) {
  const ticks = Math.max(4, Math.floor(h / 2.2));
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={STROKE_BODY} />
      <g stroke={dark} strokeOpacity={0.45} strokeWidth={STROKE_FINE} pointerEvents="none">
        {Array.from({ length: ticks }).map((_, i) => {
          const y = -h / 2 + ((i + 0.5) * h) / ticks;
          return <line key={i} x1={-w / 2 + 0.2} y1={y} x2={w / 2 - 0.2} y2={y} />;
        })}
      </g>
    </g>
  );
}

function HexNut({ w, h, fill, stroke, dark }: ShapeP) {
  const inset = w * 0.14;
  const points = [
    [-w / 2 + inset, -h / 2],
    [w / 2 - inset, -h / 2],
    [w / 2, -h / 2 + h * 0.22],
    [w / 2, h / 2 - h * 0.22],
    [w / 2 - inset, h / 2],
    [-w / 2 + inset, h / 2],
    [-w / 2, h / 2 - h * 0.22],
    [-w / 2, -h / 2 + h * 0.22],
  ];
  return (
    <g>
      <polygon
        points={points.map((p) => p.join(",")).join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <line x1={0} y1={-h / 2} x2={0} y2={h / 2} stroke={dark} strokeOpacity={0.5} strokeWidth={STROKE_FINE} />
    </g>
  );
}

function JamNut(p: ShapeP) {
  // identical silhouette to a hex nut, just thinner — re-use
  return <HexNut {...p} />;
}

function CouplingNut({ w, h, fill, stroke, dark }: ShapeP) {
  const inset = w * 0.1;
  const points = [
    [-w / 2 + inset, -h / 2],
    [w / 2 - inset, -h / 2],
    [w / 2, -h / 2 + 1.2],
    [w / 2, h / 2 - 1.2],
    [w / 2 - inset, h / 2],
    [-w / 2 + inset, h / 2],
    [-w / 2, h / 2 - 1.2],
    [-w / 2, -h / 2 + 1.2],
  ];
  return (
    <g>
      <polygon
        points={points.map((pt) => pt.join(",")).join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <g stroke={dark} strokeOpacity={0.4} strokeWidth={STROKE_FINE} pointerEvents="none">
        <line x1={-w / 2 + 0.4} y1={-h / 4} x2={w / 2 - 0.4} y2={-h / 4} />
        <line x1={-w / 2 + 0.4} y1={0} x2={w / 2 - 0.4} y2={0} />
        <line x1={-w / 2 + 0.4} y1={h / 4} x2={w / 2 - 0.4} y2={h / 4} />
      </g>
      <line x1={0} y1={-h / 2} x2={0} y2={h / 2} stroke={dark} strokeOpacity={0.55} strokeWidth={STROKE_FINE} strokeDasharray="0.6 0.6" />
    </g>
  );
}

function AcornNut({ w, h, fill, stroke, dark }: ShapeP) {
  // dome on TOP (away from connection at bottom)
  const baseH = h * 0.5;
  const domeH = h - baseH;
  const topY = -h / 2;
  const inset = w * 0.12;
  return (
    <g>
      <path
        d={`M ${-w / 2} ${topY + domeH} Q 0 ${topY - domeH * 0.4} ${w / 2} ${topY + domeH} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <polygon
        points={[
          [-w / 2 + inset, topY + domeH],
          [w / 2 - inset, topY + domeH],
          [w / 2, topY + domeH + baseH * 0.22],
          [w / 2, topY + h],
          [-w / 2, topY + h],
          [-w / 2, topY + domeH + baseH * 0.22],
        ]
          .map((p) => p.join(","))
          .join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <line
        x1={0}
        y1={topY + domeH + baseH * 0.2}
        x2={0}
        y2={topY + h - 0.5}
        stroke={dark}
        strokeOpacity={0.45}
        strokeWidth={STROKE_FINE}
      />
    </g>
  );
}

function Standoff({ w, h, fill, stroke, dark, light }: ShapeP) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={STROKE_BODY} />
      <ellipse cx={0} cy={-h / 2} rx={w / 2} ry={0.6} fill={light ?? "#ddd"} stroke={stroke} strokeWidth={STROKE_FINE} />
      <ellipse cx={0} cy={h / 2} rx={w / 2} ry={0.6} fill={dark} stroke={stroke} strokeWidth={STROKE_FINE} />
    </g>
  );
}

function ThumbScrew({ w, h, fill, stroke, dark }: ShapeP) {
  // Big knurled disc head on top (-h/2 side), thin shank exiting bottom.
  const shankW = w * 0.45;
  const headH = h * 0.5;
  const shankH = h - headH;
  const headTop = -h / 2;
  return (
    <g>
      {/* shank (threaded) */}
      <rect
        x={-shankW / 2}
        y={headTop + headH}
        width={shankW}
        height={shankH}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <g stroke={dark} strokeOpacity={0.5} strokeWidth={STROKE_FINE} pointerEvents="none">
        {Array.from({ length: 5 }).map((_, i) => {
          const y = headTop + headH + ((i + 0.5) * shankH) / 5;
          return <line key={i} x1={-shankW / 2 + 0.1} y1={y} x2={shankW / 2 - 0.1} y2={y} />;
        })}
      </g>
      {/* head */}
      <rect
        x={-w / 2}
        y={headTop}
        width={w}
        height={headH}
        rx={0.6}
        ry={0.6}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      {/* knurl: diagonal hatch lines on head */}
      <g
        stroke={dark}
        strokeOpacity={0.55}
        strokeWidth={STROKE_FINE}
        pointerEvents="none"
      >
        {Array.from({ length: Math.max(6, Math.floor(w)) }).map((_, i) => {
          const x = -w / 2 + (i + 0.5) * (w / Math.max(6, Math.floor(w)));
          return (
            <line
              key={`k1-${i}`}
              x1={x}
              y1={headTop + 0.4}
              x2={x + headH * 0.55}
              y2={headTop + headH - 0.4}
            />
          );
        })}
        {Array.from({ length: Math.max(6, Math.floor(w)) }).map((_, i) => {
          const x = -w / 2 + (i + 0.5) * (w / Math.max(6, Math.floor(w)));
          return (
            <line
              key={`k2-${i}`}
              x1={x}
              y1={headTop + headH - 0.4}
              x2={x + headH * 0.55}
              y2={headTop + 0.4}
            />
          );
        })}
      </g>
    </g>
  );
}

function WingNut({ w, h, fill, stroke, dark }: ShapeP) {
  // Central hex body + two wings sweeping up-and-out
  const bodyW = w * 0.32;
  const wingW = w * 0.34;
  const wingH = h * 0.95;
  return (
    <g>
      {/* left wing */}
      <path
        d={`M ${-bodyW / 2} ${-h / 2 + h * 0.25}
            Q ${-w / 2} ${-h / 2 - h * 0.05} ${-w / 2 + 0.5} ${-h / 2 + h * 0.45}
            L ${-bodyW / 2} ${h / 2 - h * 0.05}
            Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
        strokeLinejoin="round"
      />
      {/* right wing */}
      <path
        d={`M ${bodyW / 2} ${-h / 2 + h * 0.25}
            Q ${w / 2} ${-h / 2 - h * 0.05} ${w / 2 - 0.5} ${-h / 2 + h * 0.45}
            L ${bodyW / 2} ${h / 2 - h * 0.05}
            Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
        strokeLinejoin="round"
      />
      {/* body */}
      <rect
        x={-bodyW / 2}
        y={-h / 2 + h * 0.18}
        width={bodyW}
        height={h * 0.72}
        rx={0.3}
        ry={0.3}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <line
        x1={0}
        y1={-h / 2 + h * 0.2}
        x2={0}
        y2={h / 2 - h * 0.05}
        stroke={dark}
        strokeOpacity={0.5}
        strokeWidth={STROKE_FINE}
      />
      {/* eliminate unused destructure warning */}
      {wingW && wingH ? null : null}
    </g>
  );
}

function FlangeNut({ w, h, fill, stroke, dark }: ShapeP) {
  // Wide flange at BOTTOM (connection side), hex above
  const flangeH = h * 0.32;
  const hexH = h - flangeH;
  const hexW = w * 0.7;
  const topY = -h / 2;
  const inset = hexW * 0.14;
  return (
    <g>
      {/* hex body */}
      <polygon
        points={[
          [-hexW / 2 + inset, topY],
          [hexW / 2 - inset, topY],
          [hexW / 2, topY + hexH * 0.25],
          [hexW / 2, topY + hexH],
          [-hexW / 2, topY + hexH],
          [-hexW / 2, topY + hexH * 0.25],
        ]
          .map((p) => p.join(","))
          .join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      {/* flange */}
      <polygon
        points={[
          [-hexW / 2, topY + hexH],
          [hexW / 2, topY + hexH],
          [w / 2, topY + hexH + flangeH * 0.5],
          [w / 2, topY + h],
          [-w / 2, topY + h],
          [-w / 2, topY + hexH + flangeH * 0.5],
        ]
          .map((p) => p.join(","))
          .join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      {/* serration ticks on flange bottom */}
      <g stroke={dark} strokeOpacity={0.55} strokeWidth={STROKE_FINE} pointerEvents="none">
        {Array.from({ length: 10 }).map((_, i) => {
          const x = -w / 2 + ((i + 0.5) * w) / 10;
          return <line key={i} x1={x} y1={topY + h - 0.8} x2={x} y2={topY + h - 0.1} />;
        })}
      </g>
      <line x1={0} y1={topY} x2={0} y2={topY + h} stroke={dark} strokeOpacity={0.4} strokeWidth={STROKE_FINE} />
    </g>
  );
}

function EyeBolt({ w, h, fill, stroke, dark }: ShapeP) {
  // Loop on TOP, threaded shank on bottom
  const loopOD = Math.min(w, h * 0.45);
  const loopID = loopOD * 0.5;
  const shankW = w * 0.45;
  const shankTop = -h / 2 + loopOD;
  const shankH = h - loopOD;
  return (
    <g>
      {/* loop (donut) */}
      <circle
        cx={0}
        cy={-h / 2 + loopOD / 2}
        r={loopOD / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <circle
        cx={0}
        cy={-h / 2 + loopOD / 2}
        r={loopID / 2}
        fill="#f7f5ef"
        stroke={stroke}
        strokeWidth={STROKE_FINE}
      />
      {/* shank */}
      <rect
        x={-shankW / 2}
        y={shankTop}
        width={shankW}
        height={shankH}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <g stroke={dark} strokeOpacity={0.5} strokeWidth={STROKE_FINE} pointerEvents="none">
        {Array.from({ length: Math.max(4, Math.floor(shankH / 2.2)) }).map((_, i, arr) => {
          const y = shankTop + ((i + 0.5) * shankH) / arr.length;
          return <line key={i} x1={-shankW / 2 + 0.1} y1={y} x2={shankW / 2 - 0.1} y2={y} />;
        })}
      </g>
    </g>
  );
}

function TNut({ w, h, fill, stroke, dark }: ShapeP) {
  // Body (cylindrical) with wide flange at BOTTOM and prongs
  const bodyW = w * 0.55;
  const flangeH = h * 0.28;
  const bodyH = h - flangeH;
  const topY = -h / 2;
  return (
    <g>
      {/* body */}
      <rect
        x={-bodyW / 2}
        y={topY}
        width={bodyW}
        height={bodyH}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      {/* flange */}
      <rect
        x={-w / 2}
        y={topY + bodyH}
        width={w}
        height={flangeH}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      {/* prongs (little triangles biting outward at flange ends) */}
      <polygon
        points={`${-w / 2},${topY + bodyH} ${-w / 2 - 1.4},${topY + bodyH + flangeH * 0.5} ${-w / 2},${topY + bodyH + flangeH * 0.5}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
        strokeLinejoin="round"
      />
      <polygon
        points={`${w / 2},${topY + bodyH} ${w / 2 + 1.4},${topY + bodyH + flangeH * 0.5} ${w / 2},${topY + bodyH + flangeH * 0.5}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
        strokeLinejoin="round"
      />
      <line x1={0} y1={topY} x2={0} y2={topY + h} stroke={dark} strokeOpacity={0.4} strokeWidth={STROKE_FINE} />
    </g>
  );
}

function PipeNipple({ w, h, fill, stroke, dark }: ShapeP) {
  const threadBand = Math.min(5, h * 0.13);
  const topY = -h / 2;
  return (
    <g>
      <rect x={-w / 2} y={topY} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={STROKE_BODY} />
      <g stroke={dark} strokeOpacity={0.5} strokeWidth={STROKE_FINE} pointerEvents="none">
        {Array.from({ length: 5 }).map((_, i) => {
          const y = topY + ((i + 0.5) * threadBand) / 5;
          return <line key={`t${i}`} x1={-w / 2 + 0.3} y1={y} x2={w / 2 - 0.3} y2={y} />;
        })}
        {Array.from({ length: 5 }).map((_, i) => {
          const y = topY + h - threadBand + ((i + 0.5) * threadBand) / 5;
          return <line key={`b${i}`} x1={-w / 2 + 0.3} y1={y} x2={w / 2 - 0.3} y2={y} />;
        })}
      </g>
    </g>
  );
}

function BarrelNipple({ w, h, fill, stroke, dark }: ShapeP) {
  // hex-bodied: wider center, thread bands at the ends
  const threadBand = Math.min(5, h * 0.15);
  const topY = -h / 2;
  const bodyTop = topY + threadBand;
  const bodyBot = topY + h - threadBand;
  const hexInset = w * 0.06;
  return (
    <g>
      {/* end thread sections */}
      <rect x={-w / 2 + 1} y={topY} width={w - 2} height={threadBand} fill={fill} stroke={stroke} strokeWidth={STROKE_BODY} />
      <rect x={-w / 2 + 1} y={bodyBot} width={w - 2} height={threadBand} fill={fill} stroke={stroke} strokeWidth={STROKE_BODY} />
      {/* hex body */}
      <polygon
        points={[
          [-w / 2 + hexInset, bodyTop],
          [w / 2 - hexInset, bodyTop],
          [w / 2, bodyTop + (bodyBot - bodyTop) * 0.18],
          [w / 2, bodyBot - (bodyBot - bodyTop) * 0.18],
          [w / 2 - hexInset, bodyBot],
          [-w / 2 + hexInset, bodyBot],
          [-w / 2, bodyBot - (bodyBot - bodyTop) * 0.18],
          [-w / 2, bodyTop + (bodyBot - bodyTop) * 0.18],
        ]
          .map((p) => p.join(","))
          .join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <g stroke={dark} strokeOpacity={0.5} strokeWidth={STROKE_FINE} pointerEvents="none">
        {Array.from({ length: 3 }).map((_, i) => {
          const y = topY + ((i + 0.5) * threadBand) / 3;
          return <line key={`t${i}`} x1={-w / 2 + 1.2} y1={y} x2={w / 2 - 1.2} y2={y} />;
        })}
        {Array.from({ length: 3 }).map((_, i) => {
          const y = bodyBot + ((i + 0.5) * threadBand) / 3;
          return <line key={`b${i}`} x1={-w / 2 + 1.2} y1={y} x2={w / 2 - 1.2} y2={y} />;
        })}
      </g>
    </g>
  );
}

function PipeCoupling({ w, h, fill, stroke, dark }: ShapeP) {
  const topY = -h / 2;
  return (
    <g>
      <rect
        x={-w / 2}
        y={topY + 0.4}
        width={w}
        height={h - 0.8}
        rx={0.8}
        ry={0.8}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <g stroke={dark} strokeOpacity={0.4} strokeWidth={STROKE_FINE} pointerEvents="none">
        {Array.from({ length: 5 }).map((_, i) => {
          const y = topY + ((i + 1) * h) / 6;
          return <line key={i} x1={-w / 2 + 0.6} y1={y} x2={w / 2 - 0.6} y2={y} />;
        })}
      </g>
    </g>
  );
}

function PipeCap({ w, h, fill, stroke, dark }: ShapeP) {
  // dome on TOP, flange on bottom (connection side)
  const flangeH = h * 0.42;
  const domeH = h - flangeH;
  const topY = -h / 2;
  return (
    <g>
      <path
        d={`M ${-w / 2} ${topY + domeH} Q 0 ${topY - domeH * 0.35} ${w / 2} ${topY + domeH} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <rect
        x={-w / 2}
        y={topY + domeH}
        width={w}
        height={flangeH}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <g stroke={dark} strokeOpacity={0.45} strokeWidth={STROKE_FINE} pointerEvents="none">
        {Array.from({ length: 3 }).map((_, i) => {
          const y = topY + domeH + ((i + 0.5) * flangeH) / 3;
          return <line key={i} x1={-w / 2 + 0.4} y1={y} x2={w / 2 - 0.4} y2={y} />;
        })}
      </g>
    </g>
  );
}

function PipePlug({ w, h, fill, stroke, dark }: ShapeP) {
  // Hex head on TOP, threaded shank pointing DOWN into the fitting
  // (since we're a terminal, anchor is bottom — visually the plug sits
  // "inserted" into the parent fitting from above)
  const headH = h * 0.55;
  const shankH = h - headH;
  const topY = -h / 2;
  const shankW = w * 0.7;
  const inset = w * 0.13;
  return (
    <g>
      {/* head (hex) */}
      <polygon
        points={[
          [-w / 2 + inset, topY],
          [w / 2 - inset, topY],
          [w / 2, topY + headH * 0.25],
          [w / 2, topY + headH],
          [-w / 2, topY + headH],
          [-w / 2, topY + headH * 0.25],
        ]
          .map((p) => p.join(","))
          .join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      {/* shank */}
      <rect
        x={-shankW / 2}
        y={topY + headH}
        width={shankW}
        height={shankH}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      <g stroke={dark} strokeOpacity={0.5} strokeWidth={STROKE_FINE} pointerEvents="none">
        {Array.from({ length: 4 }).map((_, i) => {
          const y = topY + headH + ((i + 0.5) * shankH) / 4;
          return <line key={i} x1={-shankW / 2 + 0.1} y1={y} x2={shankW / 2 - 0.1} y2={y} />;
        })}
      </g>
    </g>
  );
}

// Branching fittings — bbox is square (w = h = D)
function PipeTee({ w, h, fill, stroke, dark }: ShapeP) {
  // connections: top, left, right. Vertical stub goes UP from center.
  const armW = w * 0.42; // arm thickness
  const bodyR = w * 0.32;
  return (
    <g>
      {/* horizontal run (left-right) */}
      <rect
        x={-w / 2}
        y={-armW / 2}
        width={w}
        height={armW}
        rx={0.4}
        ry={0.4}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      {/* top stub */}
      <rect
        x={-armW / 2}
        y={-h / 2}
        width={armW}
        height={h / 2}
        rx={0.4}
        ry={0.4}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      {/* central knob — gives it that organic blob */}
      <circle cx={0} cy={0} r={bodyR} fill={fill} stroke={stroke} strokeWidth={STROKE_BODY} />
      {/* axis centerlines */}
      <g stroke={dark} strokeOpacity={0.45} strokeWidth={STROKE_FINE} strokeDasharray="0.8 0.6" pointerEvents="none">
        <line x1={-w / 2} y1={0} x2={w / 2} y2={0} />
        <line x1={0} y1={-h / 2} x2={0} y2={0} />
      </g>
      {/* thread bands at port ends */}
      <PortThreads side="left" w={w} h={h} arm={armW} dark={dark} />
      <PortThreads side="right" w={w} h={h} arm={armW} dark={dark} />
      <PortThreads side="top" w={w} h={h} arm={armW} dark={dark} />
    </g>
  );
}

function PipeCross({ w, h, fill, stroke, dark }: ShapeP) {
  const armW = w * 0.42;
  const bodyR = w * 0.32;
  return (
    <g>
      <rect x={-w / 2} y={-armW / 2} width={w} height={armW} rx={0.4} ry={0.4} fill={fill} stroke={stroke} strokeWidth={STROKE_BODY} />
      <rect x={-armW / 2} y={-h / 2} width={armW} height={h} rx={0.4} ry={0.4} fill={fill} stroke={stroke} strokeWidth={STROKE_BODY} />
      <circle cx={0} cy={0} r={bodyR} fill={fill} stroke={stroke} strokeWidth={STROKE_BODY} />
      <g stroke={dark} strokeOpacity={0.45} strokeWidth={STROKE_FINE} strokeDasharray="0.8 0.6" pointerEvents="none">
        <line x1={-w / 2} y1={0} x2={w / 2} y2={0} />
        <line x1={0} y1={-h / 2} x2={0} y2={h / 2} />
      </g>
      <PortThreads side="left" w={w} h={h} arm={armW} dark={dark} />
      <PortThreads side="right" w={w} h={h} arm={armW} dark={dark} />
      <PortThreads side="top" w={w} h={h} arm={armW} dark={dark} />
      <PortThreads side="bottom" w={w} h={h} arm={armW} dark={dark} />
    </g>
  );
}

function PipeElbow({ w, h, fill, stroke, dark }: ShapeP) {
  // connections: bottom, right. Bend curves through center.
  const armW = w * 0.42;
  const bodyR = w * 0.32;
  return (
    <g>
      {/* horizontal stub from center → right */}
      <rect
        x={0}
        y={-armW / 2}
        width={w / 2}
        height={armW}
        rx={0.4}
        ry={0.4}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      {/* vertical stub from center → bottom */}
      <rect
        x={-armW / 2}
        y={0}
        width={armW}
        height={h / 2}
        rx={0.4}
        ry={0.4}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_BODY}
      />
      {/* corner blob */}
      <circle cx={0} cy={0} r={bodyR} fill={fill} stroke={stroke} strokeWidth={STROKE_BODY} />
      {/* outer fillet — an arc hint */}
      <path
        d={`M ${armW / 2} ${armW / 2} A ${bodyR * 0.7} ${bodyR * 0.7} 0 0 1 ${armW / 2 + bodyR * 0.4} ${armW / 2 + bodyR * 0.4}`}
        fill="none"
        stroke={dark}
        strokeOpacity={0.4}
        strokeWidth={STROKE_FINE}
      />
      <g stroke={dark} strokeOpacity={0.45} strokeWidth={STROKE_FINE} strokeDasharray="0.8 0.6" pointerEvents="none">
        <line x1={0} y1={0} x2={w / 2} y2={0} />
        <line x1={0} y1={0} x2={0} y2={h / 2} />
      </g>
      <PortThreads side="right" w={w} h={h} arm={armW} dark={dark} />
      <PortThreads side="bottom" w={w} h={h} arm={armW} dark={dark} />
    </g>
  );
}

function PortThreads({
  side,
  w,
  h,
  arm,
  dark,
}: {
  side: Side;
  w: number;
  h: number;
  arm: number;
  dark: string;
}) {
  // Draw 3 short tick lines perpendicular to the port axis, just inside the
  // port opening. Reinforces the "threaded port" visual.
  const ticks = 3;
  const bandLen = Math.min(3, w * 0.18);
  if (side === "left" || side === "right") {
    const sx = side === "left" ? -w / 2 : w / 2 - bandLen;
    return (
      <g
        stroke={dark}
        strokeOpacity={0.55}
        strokeWidth={STROKE_FINE}
        pointerEvents="none"
      >
        {Array.from({ length: ticks }).map((_, i) => {
          const x = sx + ((i + 0.5) * bandLen) / ticks;
          return <line key={`${side}-${i}`} x1={x} y1={-arm / 2 + 0.2} x2={x} y2={arm / 2 - 0.2} />;
        })}
      </g>
    );
  }
  // top or bottom
  const sy = side === "top" ? -h / 2 : h / 2 - bandLen;
  return (
    <g
      stroke={dark}
      strokeOpacity={0.55}
      strokeWidth={STROKE_FINE}
      pointerEvents="none"
    >
      {Array.from({ length: ticks }).map((_, i) => {
        const y = sy + ((i + 0.5) * bandLen) / ticks;
        return <line key={`${side}-${i}`} x1={-arm / 2 + 0.2} y1={y} x2={arm / 2 - 0.2} y2={y} />;
      })}
    </g>
  );
}
