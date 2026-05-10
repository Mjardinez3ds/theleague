import Link from "next/link";
import { getUpcomingSeason } from "@/lib/data";
import DraftCountdown from "@/components/DraftCountdown";

export const dynamic = "force-static";

export default async function HomePage() {
  const season = await getUpcomingSeason();

  return (
    <div className="px-4 pt-6 pb-4 space-y-6">
      <header>
        <p className="text-[11px] font-bold tracking-widest text-accent">
          THE LEAGUE
        </p>
        <h1 className="text-3xl font-extrabold leading-tight">
          Welcome to The League {season.year}
        </h1>
        <p className="text-sm text-muted mt-2">
          A new season is on the horizon.
        </p>
      </header>

      <DraftCountdown isoDate={season.draft_date} label={season.draft_date_label} />

      <section>
        <p className="text-[11px] font-bold tracking-widest text-accent mb-3">
          🏈 CONFIRMED MANAGERS · {season.managers.length}
        </p>
        <ul className="rounded-2xl border border-app bg-elev overflow-hidden">
          {season.managers.map((name, i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-b border-app last:border-0"
            >
              <span className="w-7 text-right text-xs font-bold text-muted tabular-nums">
                {i + 1}
              </span>
              <span className="text-[15px] font-semibold">{name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <Link
          href="/standings"
          className="block rounded-xl border border-app bg-elev px-4 py-3 text-sm font-semibold active:bg-elev-2"
        >
          View 2025 Standings <span className="text-accent">→</span>
        </Link>
        <Link
          href="/history"
          className="block rounded-xl border border-app bg-elev px-4 py-3 text-sm font-semibold active:bg-elev-2"
        >
          League History <span className="text-accent">→</span>
        </Link>
      </section>
    </div>
  );
}
