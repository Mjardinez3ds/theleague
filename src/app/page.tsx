import Link from "next/link";
import { getUpcomingSeason, getCareers, getLegacyChampions, type Career } from "@/lib/data";
import DraftCountdown from "@/components/DraftCountdown";
import Avatar from "@/components/Avatar";

export const dynamic = "force-static";

export default async function HomePage() {
  const [season, { owners }, legacy] = await Promise.all([
    getUpcomingSeason(),
    getCareers(),
    getLegacyChampions(),
  ]);

  const careerBySlug = new Map<string, Career>(owners.map((o) => [o.slug, o]));

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
          {season.managers.map((m, i) => {
            const career = m.slug ? careerBySlug.get(m.slug) : null;
            const fullName = career?.owner ?? m.name;
            const careerTitleYears = career?.seasons
              .filter((s) => s.finish === 1)
              .map((s) => s.year) ?? [];
            const legacyTitleYears = m.slug ? (legacy[m.slug] ?? []) : [];
            const titleYears = [...legacyTitleYears, ...careerTitleYears].sort();

            const inner = (
              <>
                <span className="w-6 text-right text-xs font-bold text-muted tabular-nums shrink-0">
                  {i + 1}
                </span>
                <Avatar name={fullName} slug={m.slug ?? fullName} size="md" />
                <span className="flex-1 min-w-0">
                  <span className="text-[15px] font-semibold">{fullName}</span>
                  {titleYears.length > 0 && (
                    <span className="text-accent text-xs font-semibold ml-2">
                      · {titleYears.join(", ")} Champion
                    </span>
                  )}
                </span>
              </>
            );

            return (
              <li key={i} className="border-b border-app last:border-0">
                {m.slug ? (
                  <Link
                    href={`/managers/${m.slug}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-elev-2"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
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
