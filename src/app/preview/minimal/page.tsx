import Link from "next/link";
import { getUpcomingSeason } from "@/lib/data";
import MinimalCountdown from "./MinimalCountdown";

export const dynamic = "force-static";

/**
 * MINIMAL / EDITORIAL PREVIEW
 * White background, charcoal text, single deep-red accent. Generous
 * whitespace, magazine-style headlines, almost no chrome.
 * Vibe: Apple Sports / NYT / fine print.
 */
export default async function MinimalPreviewPage() {
  const season = await getUpcomingSeason();

  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#1a1a1a]">
      <div className="px-5 pt-10 pb-8 max-w-md mx-auto">
        {/* Eyebrow */}
        <p
          className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#c8102e] mb-4"
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          The League · Volume IV
        </p>

        {/* Hero */}
        <h1
          className="text-[44px] leading-[1.05] font-medium tracking-tight mb-2"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          A new season
          <br />
          <span className="italic font-normal text-[#666]">begins.</span>
        </h1>
        <p
          className="text-[14px] text-[#666] mt-3 leading-relaxed"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Twelve managers. One trophy. Draft day approaches.
        </p>

        <hr className="border-t border-[#1a1a1a]/15 my-8" />

        {/* Countdown */}
        <MinimalCountdown isoDate={season.draft_date} label={season.draft_date_label} />

        <hr className="border-t border-[#1a1a1a]/15 my-8" />

        {/* Managers */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <p
              className="text-[18px] font-medium"
              style={{ fontFamily: "Georgia, serif" }}
            >
              The Field
            </p>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999]">
              {season.managers.length} confirmed
            </p>
          </div>
          <ul className="divide-y divide-[#1a1a1a]/10">
            {season.managers.map((name, i) => (
              <li
                key={i}
                className="flex items-baseline gap-4 py-3"
              >
                <span
                  className="text-[12px] text-[#999] tabular-nums w-6"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="text-[16px] font-normal flex-1"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {name}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <hr className="border-t border-[#1a1a1a]/15 my-8" />

        {/* Quick links */}
        <section className="space-y-1">
          <MinimalLink href="/standings" label="Last season's standings" />
          <MinimalLink href="/history" label="The history book" />
          <MinimalLink href="/managers" label="Manager profiles" />
          <MinimalLink href="/trades" label="Trade ledger" />
        </section>

        <Link
          href="/preview"
          className="block mt-10 text-center text-[12px] text-[#999] underline underline-offset-4"
          style={{ fontFamily: "Georgia, serif" }}
        >
          ← back to previews
        </Link>
      </div>
    </div>
  );
}

function MinimalLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-baseline justify-between py-3 border-b border-[#1a1a1a]/10 active:bg-black/5"
    >
      <span
        className="text-[15px]"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {label}
      </span>
      <span className="text-[#c8102e] text-sm">→</span>
    </Link>
  );
}
