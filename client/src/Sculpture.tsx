import { useMemo, useState } from "react";
import type { PlacedPart, Sculpture as SculptureT } from "./types";
import { MATERIAL_STYLES } from "./materials";

interface Props {
  sculpture: SculptureT;
}

// Visual size amplification so an 8mm rod is still readable next to a 13mm
// nut in screen space. We're not trying to be CAD-accurate — we want a
// readable, schematic side view.
const VIS_MIN_DIAMETER = 6; // mm-equivalent; never narrower than this in viewBox
const PAD_TOP = 14;
const PAD_BOTTOM = 14;
const VIEWBOX_WIDTH = 80;
const X_CENTER = VIEWBOX_WIDTH / 2;

function widthForPart(p: PlacedPart): number {
  return Math.max(VIS_MIN_DIAMETER, p.part.diameter);
}

interface HoverInfo {
  name: string;
  partNumber: string;
  detail: string;
}

export function Sculpture({ sculpture }: Props) {
  const heightMm = Math.max(sculpture.totals.heightMm, 80);
  const viewHeight = heightMm + PAD_TOP + PAD_BOTTOM;
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // Order parts back-to-front for drawing: rods first (back), then fittings
  // (front, on top of rods).
  const allDrawn = useMemo(
    () => [
      ...sculpture.spine.map((p) => ({ p, isRod: true })),
      ...sculpture.fittings.map((p) => ({ p, isRod: false })),
    ],
    [sculpture],
  );

  function topY(p: PlacedPart): number {
    return PAD_TOP + (heightMm - p.yOffset - p.occupies);
  }

  function handleEnter(p: PlacedPart) {
    setHover({
      name: p.part.name,
      partNumber: p.part.partNumber,
      detail: `${MATERIAL_STYLES[p.part.material].label} · ${p.part.finish}`,
    });
  }
  function handleLeave() {
    setHover(null);
  }

  // Baseline (the "ground" the sculpture sits on)
  const baselineY = PAD_TOP + heightMm;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${viewHeight}`}
        preserveAspectRatio="xMidYMax meet"
        className="sculpture-svg w-full h-[640px] max-h-[80vh]"
        role="img"
        aria-label="Hardware sculpture side view"
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
              <stop offset="35%" stopColor={s.base} />
              <stop offset="55%" stopColor={s.light} />
              <stop offset="80%" stopColor={s.base} />
              <stop offset="100%" stopColor={s.dark} />
            </linearGradient>
          ))}
          <linearGradient id="shadow-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.16)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>

        {/* ground / baseline */}
        <ellipse
          cx={X_CENTER}
          cy={baselineY + 2}
          rx={26}
          ry={2.2}
          fill="rgba(0,0,0,0.10)"
        />
        <line
          x1={X_CENTER - 30}
          y1={baselineY}
          x2={X_CENTER + 30}
          y2={baselineY}
          stroke="#1a1a1a"
          strokeWidth={0.35}
          strokeOpacity={0.55}
        />

        {allDrawn.map(({ p, isRod }, idx) => (
          <PartShape
            key={`${idx}-${p.part.partNumber}`}
            placed={p}
            isRod={isRod}
            topY={topY(p)}
            onEnter={() => handleEnter(p)}
            onLeave={handleLeave}
          />
        ))}
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

      {/* dimension annotation in bottom right */}
      <div className="pointer-events-none absolute right-3 bottom-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
        H {Math.round(sculpture.totals.heightMm)} mm
      </div>
    </div>
  );
}

interface PartShapeProps {
  placed: PlacedPart;
  isRod: boolean;
  topY: number;
  onEnter: () => void;
  onLeave: () => void;
}

function PartShape({ placed, topY, onEnter, onLeave }: PartShapeProps) {
  const { part, occupies } = placed;
  const w = Math.max(VIS_MIN_DIAMETER, part.diameter);
  const x = X_CENTER - w / 2;
  const h = occupies;
  const fill = `url(#mat-${part.material})`;
  const style = MATERIAL_STYLES[part.material];

  // Make hex/coupling/acorn slightly wider visually than threaded rods so
  // their silhouette reads.
  switch (part.category) {
    case "threaded_rod": {
      // narrow rod with subtle thread hatching
      return (
        <g onMouseEnter={onEnter} onMouseLeave={onLeave}>
          <rect
            x={x}
            y={topY}
            width={w}
            height={h}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={0.18}
          />
          {/* faint thread ticks every ~1.5mm */}
          <g
            stroke={style.dark}
            strokeOpacity={0.45}
            strokeWidth={0.12}
            pointerEvents="none"
          >
            {Array.from({ length: Math.max(2, Math.floor(h / 1.6)) }).map(
              (_, i) => {
                const y = topY + (i + 0.5) * (h / Math.floor(h / 1.6));
                return (
                  <line key={i} x1={x + 0.2} y1={y} x2={x + w - 0.2} y2={y} />
                );
              },
            )}
          </g>
        </g>
      );
    }
    case "hex_nut": {
      // hex nut viewed from the side — rectangle with chamfered top/bottom
      // edges suggested by short angled lines
      const inset = w * 0.12;
      return (
        <g onMouseEnter={onEnter} onMouseLeave={onLeave}>
          <polygon
            points={[
              `${x + inset},${topY}`,
              `${x + w - inset},${topY}`,
              `${x + w},${topY + h * 0.18}`,
              `${x + w},${topY + h * 0.82}`,
              `${x + w - inset},${topY + h}`,
              `${x + inset},${topY + h}`,
              `${x},${topY + h * 0.82}`,
              `${x},${topY + h * 0.18}`,
            ].join(" ")}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={0.22}
          />
          {/* center line suggesting the threaded bore */}
          <line
            x1={X_CENTER}
            y1={topY}
            x2={X_CENTER}
            y2={topY + h}
            stroke={style.dark}
            strokeWidth={0.15}
            strokeOpacity={0.4}
          />
        </g>
      );
    }
    case "coupling_nut": {
      const inset = w * 0.08;
      return (
        <g onMouseEnter={onEnter} onMouseLeave={onLeave}>
          <polygon
            points={[
              `${x + inset},${topY}`,
              `${x + w - inset},${topY}`,
              `${x + w},${topY + 1.2}`,
              `${x + w},${topY + h - 1.2}`,
              `${x + w - inset},${topY + h}`,
              `${x + inset},${topY + h}`,
              `${x},${topY + h - 1.2}`,
              `${x},${topY + 1.2}`,
            ].join(" ")}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={0.22}
          />
          {/* horizontal scribe lines */}
          <line
            x1={x + 0.2}
            y1={topY + h * 0.33}
            x2={x + w - 0.2}
            y2={topY + h * 0.33}
            stroke={style.dark}
            strokeOpacity={0.35}
            strokeWidth={0.12}
          />
          <line
            x1={x + 0.2}
            y1={topY + h * 0.67}
            x2={x + w - 0.2}
            y2={topY + h * 0.67}
            stroke={style.dark}
            strokeOpacity={0.35}
            strokeWidth={0.12}
          />
        </g>
      );
    }
    case "acorn_nut": {
      // hex base with dome on top
      const baseH = h * 0.45;
      const domeH = h - baseH;
      const inset = w * 0.1;
      return (
        <g onMouseEnter={onEnter} onMouseLeave={onLeave}>
          {/* dome */}
          <path
            d={`M ${x} ${topY + domeH} Q ${X_CENTER} ${topY - domeH * 0.4} ${x + w} ${topY + domeH} Z`}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={0.22}
          />
          {/* base */}
          <polygon
            points={[
              `${x + inset},${topY + domeH}`,
              `${x + w - inset},${topY + domeH}`,
              `${x + w},${topY + domeH + baseH * 0.2}`,
              `${x + w},${topY + h}`,
              `${x},${topY + h}`,
              `${x},${topY + domeH + baseH * 0.2}`,
            ].join(" ")}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={0.22}
          />
        </g>
      );
    }
    case "standoff": {
      // cylinder — slim rectangle with shaded ends
      return (
        <g onMouseEnter={onEnter} onMouseLeave={onLeave}>
          <rect
            x={x}
            y={topY}
            width={w}
            height={h}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={0.2}
          />
          {/* end caps (ellipse hints) */}
          <ellipse
            cx={X_CENTER}
            cy={topY}
            rx={w / 2}
            ry={0.55}
            fill={style.light}
            stroke={style.stroke}
            strokeWidth={0.18}
          />
          <ellipse
            cx={X_CENTER}
            cy={topY + h}
            rx={w / 2}
            ry={0.55}
            fill={style.dark}
            stroke={style.stroke}
            strokeWidth={0.18}
          />
        </g>
      );
    }
    case "pipe_nipple": {
      // thicker pipe with end threads suggested by hatch bands at top + bottom
      const threadBand = Math.min(4, h * 0.12);
      return (
        <g onMouseEnter={onEnter} onMouseLeave={onLeave}>
          <rect
            x={x}
            y={topY}
            width={w}
            height={h}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={0.25}
          />
          <g
            stroke={style.dark}
            strokeOpacity={0.5}
            strokeWidth={0.18}
            pointerEvents="none"
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const y = topY + (i + 0.5) * (threadBand / 6);
              return (
                <line key={`t${i}`} x1={x + 0.3} y1={y} x2={x + w - 0.3} y2={y} />
              );
            })}
            {Array.from({ length: 6 }).map((_, i) => {
              const y = topY + h - threadBand + (i + 0.5) * (threadBand / 6);
              return (
                <line key={`b${i}`} x1={x + 0.3} y1={y} x2={x + w - 0.3} y2={y} />
              );
            })}
          </g>
        </g>
      );
    }
    case "pipe_coupling": {
      return (
        <g onMouseEnter={onEnter} onMouseLeave={onLeave}>
          <rect
            x={x}
            y={topY + 0.4}
            width={w}
            height={h - 0.8}
            rx={0.6}
            ry={0.6}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={0.25}
          />
          {/* hex-grip ribs on the outer surface */}
          <g
            stroke={style.dark}
            strokeOpacity={0.45}
            strokeWidth={0.15}
            pointerEvents="none"
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const yy = topY + ((i + 1) * h) / 7;
              return (
                <line
                  key={i}
                  x1={x + 0.5}
                  y1={yy}
                  x2={x + w - 0.5}
                  y2={yy}
                />
              );
            })}
          </g>
        </g>
      );
    }
    case "pipe_cap": {
      // dome cap with flange
      const flangeH = h * 0.35;
      const domeH = h - flangeH;
      return (
        <g onMouseEnter={onEnter} onMouseLeave={onLeave}>
          <path
            d={`M ${x} ${topY + domeH} Q ${X_CENTER} ${topY - domeH * 0.3} ${x + w} ${topY + domeH} Z`}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={0.25}
          />
          <rect
            x={x}
            y={topY + domeH}
            width={w}
            height={flangeH}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={0.25}
          />
        </g>
      );
    }
    default:
      return (
        <g onMouseEnter={onEnter} onMouseLeave={onLeave}>
          <rect
            x={x}
            y={topY}
            width={w}
            height={h}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={0.2}
          />
        </g>
      );
  }
}
