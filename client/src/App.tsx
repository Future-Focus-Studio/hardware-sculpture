import { useCallback, useEffect, useState } from "react";
import { Sculpture } from "./Sculpture";
import { Bom } from "./Bom";
import type { Sculpture as SculptureT } from "./types";

async function fetchSculpture(): Promise<SculptureT> {
  const res = await fetch("/api/generate");
  if (!res.ok) throw new Error(`generate failed: ${res.status}`);
  return res.json();
}

export function App() {
  const [sculpture, setSculpture] = useState<SculptureT | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchSculpture();
      setSculpture(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void regenerate();
  }, [regenerate]);

  return (
    <div className="min-h-screen">
      <Header
        onRegenerate={regenerate}
        loading={loading}
        sculptureId={sculpture?.id}
      />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            Error: {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px,1fr]">
          <section className="rounded-lg border border-ink/10 bg-white/60 p-3 backdrop-blur-sm">
            {sculpture ? (
              <Sculpture sculpture={sculpture} />
            ) : (
              <div className="flex h-[640px] items-center justify-center font-mono text-xs uppercase tracking-[0.2em] text-ink/40">
                Assembling…
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4">
            {sculpture && <Bom sculpture={sculpture} />}
            <Footnote />
          </section>
        </div>
      </main>
    </div>
  );
}

function Header({
  onRegenerate,
  loading,
  sculptureId,
}: {
  onRegenerate: () => void;
  loading: boolean;
  sculptureId?: string;
}) {
  return (
    <header className="border-b border-ink/10 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Hardware Sculpture Generator
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Generative art using real McMaster-Carr parts
          </p>
          {sculptureId && (
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/40">
              specimen · {sculptureId}
            </div>
          )}
        </div>
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="group inline-flex items-center gap-2 rounded-md border border-ink bg-ink px-4 py-2 text-sm font-medium uppercase tracking-[0.14em] text-paper transition hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              loading
                ? "animate-pulse bg-amber-400"
                : "bg-emerald-400 group-hover:bg-ink"
            }`}
          />
          {loading ? "Assembling…" : "Generate New Sculpture"}
        </button>
      </div>
    </header>
  );
}

function Footnote() {
  return (
    <p className="px-1 font-mono text-[10px] leading-relaxed text-ink/45">
      Parts shown are real McMaster-Carr-style numbers selected for thread
      compatibility. Always verify part numbers and dimensions on
      mcmaster.com before ordering.
    </p>
  );
}
