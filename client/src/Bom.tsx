import type { Sculpture } from "./types";
import { MATERIAL_STYLES } from "./materials";

interface Props {
  sculpture: Sculpture;
}

const CATEGORY_LABELS: Record<string, string> = {
  threaded_rod: "Threaded Rod",
  hex_nut: "Hex Nut",
  coupling_nut: "Coupling Nut",
  acorn_nut: "Acorn Nut",
  standoff: "Standoff",
  thumb_screw: "Thumb Screw",
  wing_nut: "Wing Nut",
  flange_nut: "Flange Nut",
  eye_bolt: "Eye Bolt",
  t_nut: "T-Nut",
  jam_nut: "Jam Nut",
  pipe_nipple: "Pipe Nipple",
  barrel_nipple: "Barrel Nipple",
  pipe_coupling: "Pipe Coupling",
  pipe_cap: "Pipe Cap",
  pipe_plug: "Pipe Plug",
  pipe_tee: "Pipe Tee",
  pipe_elbow: "Pipe Elbow",
  pipe_cross: "Pipe Cross",
};

export function Bom({ sculpture }: Props) {
  const { bom, totals, threadSystem } = sculpture;

  return (
    <div className="rounded-lg border border-ink/10 bg-white/70 backdrop-blur-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink/10 px-5 py-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/50">
            Bill of Materials
          </div>
          <div className="text-sm text-ink/70">
            Thread system:{" "}
            <span className="font-mono font-medium text-ink">
              {threadSystem}
            </span>
          </div>
        </div>
        <div className="flex gap-6 text-right">
          <Stat label="Parts" value={String(totals.partCount)} />
          <Stat label="Unique" value={String(bom.length)} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              <th className="px-5 py-2 font-medium">Part #</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Material</th>
              <th className="px-3 py-2 font-medium text-right">Qty</th>
              <th className="px-5 py-2 font-medium text-right">Link</th>
            </tr>
          </thead>
          <tbody>
            {bom.map((line) => (
              <tr
                key={line.partNumber}
                className="border-b border-ink/5 last:border-b-0 hover:bg-ink/[0.03]"
              >
                <td className="px-5 py-2 align-top">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm border border-black/10"
                      style={{
                        background: MATERIAL_STYLES[line.material].base,
                      }}
                      title={MATERIAL_STYLES[line.material].label}
                    />
                    <span className="font-mono text-xs">{line.partNumber}</span>
                  </div>
                </td>
                <td className="px-3 py-2 align-top">{line.name}</td>
                <td className="px-3 py-2 align-top text-ink/70">
                  {CATEGORY_LABELS[line.category] ?? line.category}
                </td>
                <td className="px-3 py-2 align-top text-ink/70">
                  {MATERIAL_STYLES[line.material].label}
                </td>
                <td className="px-3 py-2 align-top text-right font-mono">
                  {line.qty}
                </td>
                <td className="px-5 py-2 align-top text-right">
                  <a
                    className="font-mono text-xs uppercase tracking-wider text-ink/60 underline-offset-2 hover:text-ink hover:underline"
                    href={line.mcmasterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on McMaster →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink/50">
        {label}
      </div>
      <div className="text-sm font-medium text-ink/80">{value}</div>
    </div>
  );
}
