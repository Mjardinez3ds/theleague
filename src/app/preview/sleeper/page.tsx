import Link from "next/link";
import { getUpcomingSeason } from "@/lib/data";
import SleeperCountdown from "./SleeperCountdown";

export const dynamic = "force-static";

/**
 * SLEEPER-STYLE PREVIEW
 *
 * Self-contained preview of what the Home page would look like in a
 * Sleeper-inspired aesthetic:
 *  - near-black background, deep-purple primary instead of gold
 *  - colorful gradient avatars per manager
 *  - dense bold typography, tight tracking on headlines
 *  - status pills ("LOCKED IN") instead of plain text
 *  - bigger numbers, smaller labels
 *
 * All styles are inline / Tailwind so the global theme is untouched.
 * Live site is unaffected — this is just a swipe-to-compare preview.
 */
export default async function SleeperPreviewPage() {
  const season = await getUpcomingSeason();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      {/* Banner */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-fuchsia-700 px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold tracking-[0.25em] text-white/70">
            THE LEAGUE · {season.year}
          </p>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white/90">
            PREVIEW
          </span>
        </div>
        <h1 className="text-[34px] font-black leading-[1.05] tracking-tight">
          Welcome back.
        </h1>
        <p className="text-[34px] font-black leading-[1.05] tracking-tight text-white/55">
          Draft is locked.
        </p>
      </div>

      {/* Countdown */}
      <div className="px-4 -mt-6">
        <SleeperCountdown
          isoDate={season.draft_date}
          label={season.draft_date_label}
        />
      </div>

      {/* Managers */}
      <section className="px-4 mt-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold tracking-[0.2em] text-zinc-400">
            MANAGERS
          </p>
          <span className="text-[11px] font-bold text-violet-400">
            {season.managers.length} LOCKED IN
          </span>
        </div>
        <ul className="rounded-2xl bg-zinc-900/80 ring-1 ring-zinc-800 overflow-hidden">
          {season.managers.map((name, i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-3 py-3 border-b border-zinc-800 last:border-0 active:bg-zinc-800/60"
            >
              <Avatar name={name} index={i} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold leading-tight truncate">
                  {name}
                </div>
                <div className="text-[11px] text-zinc-500 tracking-wide">
                  @{slug(name)}
                </div>
              </div>
              <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-emerald-400 ring-1 ring-emerald-500/20">
                LIVE
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Quick links */}
      <section className="px-4 mt-6 grid grid-cols-2 gap-3">
        <QuickLink href="/standings" label="Standings" sub="2025 final" />
        <QuickLink href="/history" label="History" sub="3 seasons" />
        <QuickLink href="/managers" label="Managers" sub="Hall of fame" />
        <QuickLink href="/trades" label="Trades" sub="74 deals" />
      </section>

      {/* Back to live */}
      <div className="px-4 mt-8 mb-6">
        <Link
          href="/"
          className="block rounded-xl bg-zinc-900 ring-1 ring-zinc-800 px-4 py-3 text-center text-sm font-semibold text-zinc-400 active:bg-zinc-800"
        >
          ← Back to live site
        </Link>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function slug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "");
}

const GRADIENTS = [
  "from-rose-500 to-orange-500",
  "from-amber-500 to-yellow-500",
  "from-lime-500 to-emerald-500",
  "from-emerald-500 to-cyan-500",
  "from-cyan-500 to-blue-500",
  "from-blue-500 to-violet-500",
  "from-violet-500 to-fuchsia-500",
  "from-fuchsia-500 to-pink-500",
  "from-pink-500 to-rose-500",
  "from-teal-500 to-emerald-500",
  "from-indigo-500 to-purple-500",
  "from-orange-500 to-red-500",
];

function Avatar({ name, index }: { name: string; index: number }) {
  const initial = name.trim().charAt(0).toUpperCase();
  const grad = GRADIENTS[index % GRADIENTS.length];
  return (
    <div
      className={`shrink-0 size-10 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-[15px] font-black text-white shadow-lg`}
    >
      {initial}
    </div>
  );
}

function QuickLink({
  href,
  label,
  sub,
}: {
  href: string;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-zinc-900 ring-1 ring-zinc-800 p-3 active:bg-zinc-800"
    >
      <div className="text-[15px] font-bold">{label}</div>
      <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>
    </Link>
  );
}
