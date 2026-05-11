import Link from "next/link";
import { getUpcomingSeason } from "@/lib/data";
import RetroCountdown from "./RetroCountdown";

export const dynamic = "force-static";

/**
 * RETRO / TRADING CARD PREVIEW
 * Cream paper background, navy primary, burnt-orange accent. Serif
 * headlines, double-line borders, vintage Topps / yearbook feel.
 */
export default async function RetroPreviewPage() {
  const season = await getUpcomingSeason();

  return (
    <div className="min-h-screen bg-[#f3e9d2] text-[#1a2b4a]">
      <div className="px-4 pt-6 pb-6 max-w-md mx-auto space-y-5">
        {/* Stamp header */}
        <div className="border-4 border-double border-[#1a2b4a] p-3 text-center bg-[#f3e9d2]">
          <p
            className="text-[10px] font-bold tracking-[0.4em] text-[#c2410c]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            ★ THE LEAGUE ★
          </p>
          <p
            className="text-[10px] tracking-[0.2em] mt-1 text-[#1a2b4a]/60"
            style={{ fontFamily: "Georgia, serif" }}
          >
            EST. 2023 · VOL. IV
          </p>
        </div>

        {/* Hero */}
        <div className="text-center py-2">
          <p
            className="text-[12px] tracking-[0.2em] uppercase text-[#1a2b4a]/60 mb-1"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Welcome to the
          </p>
          <h1
            className="text-[40px] leading-tight font-bold tracking-tight"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {season.year} Season
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2 text-[#c2410c]">
            <span className="h-px w-12 bg-[#c2410c]" />
            <span className="text-[10px] tracking-widest">★</span>
            <span className="h-px w-12 bg-[#c2410c]" />
          </div>
        </div>

        {/* Draft card */}
        <RetroCountdown isoDate={season.draft_date} label={season.draft_date_label} />

        {/* Managers ledger */}
        <section>
          <p
            className="text-center text-[12px] tracking-[0.3em] uppercase text-[#1a2b4a]/70 mb-2"
            style={{ fontFamily: "Georgia, serif" }}
          >
            — Confirmed Managers —
          </p>
          <ul className="border-2 border-[#1a2b4a]/30 bg-white/30">
            {season.managers.map((name, i) => (
              <li
                key={i}
                className="flex items-baseline gap-3 px-4 py-2.5 border-b border-dashed border-[#1a2b4a]/20 last:border-0"
                style={{ fontFamily: "Georgia, serif" }}
              >
                <span className="text-[12px] font-bold text-[#c2410c] tabular-nums w-6">
                  {String(i + 1).padStart(2, "0")}.
                </span>
                <span className="text-[15px] font-semibold flex-1">
                  {name}
                </span>
                <span className="text-[10px] tracking-widest text-[#1a2b4a]/50">
                  ✓ IN
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Quick links */}
        <section className="grid grid-cols-2 gap-2">
          <RetroLink href="/standings" label="Standings" />
          <RetroLink href="/history" label="Annals" />
          <RetroLink href="/managers" label="Managers" />
          <RetroLink href="/trades" label="Trades" />
        </section>

        <Link
          href="/preview"
          className="block text-center text-[11px] tracking-widest text-[#1a2b4a]/60 underline underline-offset-4 mt-4"
          style={{ fontFamily: "Georgia, serif" }}
        >
          ← BACK TO PREVIEWS
        </Link>
      </div>
    </div>
  );
}

function RetroLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="border-2 border-[#1a2b4a] bg-white/40 px-3 py-3 text-center active:bg-white/60"
      style={{ fontFamily: "Georgia, serif" }}
    >
      <div className="text-[14px] font-bold text-[#1a2b4a]">{label}</div>
      <div className="text-[10px] tracking-widest text-[#c2410c] mt-0.5">→</div>
    </Link>
  );
}
