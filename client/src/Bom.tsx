import { useEffect, useState } from "react";
import type { Sculpture } from "./types";
import { MATERIAL_STYLES } from "./materials";

interface Props {
  sculpture: Sculpture;
}

type PriceState = { status: "loading" } | { status: "ok"; price: number | null };

export function Bom({ sculpture }: Props) {
  const { bom, totals, threadSystem } = sculpture;
  const [prices, setPrices] = useState<Record<string, PriceState>>({});

  useEffect(() => {
    let cancelled = false;
    const partNumbers = Array.from(new Set(bom.map((l) => l.partNumber)));
    setPrices(
      Object.fromEntries(partNumbers.map((p) => [p, { status: "loading" }])),
    );

    for (const pn of partNumbers) {
      fetch(`/api/price/${encodeURIComponent(pn)}`)
        .then((r) => r.json())
        .then((data: { partNumber: string; price: number | null }) => {
          if (cancelled) return;
          setPrices((prev) => ({
            ...prev,
            [pn]: { status: "ok", price: data.price },
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setPrices((prev) => ({
            ...prev,
            [pn]: { status: "ok", price: null },
          }));
        });
    }

    return () => {
      cancelled = true;
    };
  }, [sculpture.id]);

  const realTotal = bom.reduce((sum, line) => {
    const state = prices[line.partNumber];
    if (state?.status === "ok" && state.price != null) {
      return sum + state.price * line.qty;
    }
    return sum;
  }, 0);
  const allLoaded =
    bom.length > 0 &&
    bom.every((l) => prices[l.partNumber]?.status === "ok");

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
          <Stat
            label={allLoaded ? "Total" : "Total (partial)"}
            value={`$${realTotal.toFixed(2)}`}
            emphasis
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              <th className="px-5 py-2 font-medium">Part #</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium text-right">Qty</th>
              <th className="px-3 py-2 font-medium text-right">Unit</th>
              <th className="px-3 py-2 font-medium text-right">Subtotal</th>
              <th className="px-5 py-2 font-medium text-right">Link</th>
            </tr>
          </thead>
          <tbody>
            {bom.map((line) => {
              const state = prices[line.partNumber];
              const price =
                state?.status === "ok" ? state.price : undefined;
              const loading = !state || state.status === "loading";
              const subtotal =
                price != null ? price * line.qty : null;
              return (
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
                  <td className="px-3 py-2 align-top text-right font-mono">
                    {line.qty}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono text-ink/70">
                    {loading ? (
                      <Spinner />
                    ) : price != null ? (
                      `$${price.toFixed(2)}`
                    ) : (
                      <span className="text-ink/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono">
                    {loading ? (
                      <Spinner />
                    ) : subtotal != null ? (
                      `$${subtotal.toFixed(2)}`
                    ) : (
                      <span className="text-ink/40">—</span>
                    )}
                  </td>
                  <td className="px-5 py-2 align-top text-right">
                    <a
                      className="font-mono text-xs uppercase tracking-wider text-ink/60 underline-offset-2 hover:text-ink hover:underline"
                      href={line.priceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {price == null && !loading
                        ? "View on McMaster →"
                        : "View ↗"}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border border-ink/30 border-t-transparent align-middle"
      aria-label="loading"
    />
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink/50">
        {label}
      </div>
      <div
        className={
          emphasis
            ? "text-lg font-semibold text-ink"
            : "text-sm font-medium text-ink/80"
        }
      >
        {value}
      </div>
    </div>
  );
}
