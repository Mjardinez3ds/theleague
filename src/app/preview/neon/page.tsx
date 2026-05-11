import Link from "next/link";
import { getUpcomingSeason } from "@/lib/data";
import NeonCountdown from "./NeonCountdown";

export const dynamic = "force-static";

/**
 * NEON / SPORTSBOOK PREVIEW
 * Pure black, electric green primary, cyan secondary. All caps, monospaced
 * numbers, sharp boxy elements. Vibe: DraftKings / ESPN BET.
 */
export default async function NeonPreviewPage() {
  const season = await getUpcomingSeason();

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header bar */}
      <div className="border-b-2 border-emerald-400 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-[10px] font-bold tracking-[0.3em] text-emerald-400">
            THE LEAGUE · {season.year}
          </p>
        </div>
        <span className="text-[9px] font-bold tracking-widest text-cyan-400 border border-cyan-400/40 px-2 py-0.5">
          PREVIEW
        </span>
      </div>

      <div className="px-4 pt-6 pb-4 space-y-6">
        {/* Hero */}
        <div>
          <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-500 mb-2">
            ▼ STATUS
          </p>
          <h1 className="text-4xl font-black tracking-tight uppercase">
            Roster Locked
          </h1>
          <p className="text-4xl font-black tracking-tight uppercase text-emerald-400">
            Draft Inbound
          </p>
        </div>

        {/* Countdown */}
        <NeonCountdown isoDate={season.draft_date} label={season.draft_date_label} />

        {/* Managers grid */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-500">
              ▼ ROSTER · {season.managers.length}/12
            </p>
            <p className="text-[10px] font-bold tracking-widest text-emerald-400">
              ALL SET
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {season.managers.map((name, i) => (
              <li
                key={i}
                className="border border-zinc-800 bg-zinc-950 px-3 py-2.5 active:bg-zinc-900"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-emerald-400 tabular-nums">
                    #{String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[14px] font-bold uppercase tracking-tight truncate">
                    {name}
                  </span>
                </div>
                <div className="text-[9px] tracking-widest text-zinc-600 mt-0.5">
                  ━━━━━━━━━━ SET
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Quick links */}
        <section>
          <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-500 mb-2">
            ▼ NAVIGATE
          </p>
          <div className="grid grid-cols-2 gap-2">
            <NeonLink href="/standings" label="STANDINGS" />
            <NeonLink href="/history" label="HISTORY" />
            <NeonLink href="/managers" label="MANAGERS" />
            <NeonLink href="/trades" label="TRADES" />
          </div>
        </section>

        <Link
          href="/preview"
          className="block border border-zinc-800 px-4 py-3 text-center text-[11px] font-bold tracking-widest text-zinc-400 active:bg-zinc-900"
        >
          ← BACK TO PREVIEWS
        </Link>
      </div>
    </div>
  );
}

function NeonLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="border border-emerald-400/30 bg-emerald-400/5 px-3 py-3 text-center text-[11px] font-bold tracking-widest text-emerald-400 active:bg-emerald-400/10"
    >
      {label} →
    </Link>
  );
}
