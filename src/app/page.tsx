import Link from "next/link";
import {
  getUpcomingSeason,
  getLeagueMeta,
  getStandings,
  getCareers,
  getLegacyChampions,
  type Career,
} from "@/lib/data";
import SeasonCountdown from "@/components/SeasonCountdown";

export const dynamic = "force-static";

export default async function HomePage() {
  const [season, meta, { owners }, legacy] = await Promise.all([
    getUpcomingSeason(),
    getLeagueMeta(),
    getCareers(),
    getLegacyChampions(),
  ]);

  // The league roster is derived from ESPN's own data for the current season
  // rather than a hand-maintained list — managers join/leave right up to
  // kickoff and the manual list drifted out of sync. See AGENTS.md.
  const standings = await getStandings(meta.current_year);
  const careerBySlug = new Map<string, Career>(owners.map((o) => [o.slug, o]));

  const managers = [...standings.teams].sort((a, b) =>
    a.owner.localeCompare(b.owner, undefined, { sensitivity: "base" })
  );

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
          The draft is in the books — kickoff is almost here.
        </p>
      </header>

      <SeasonCountdown isoDate={season.kickoff_date} label={season.kickoff_date_label} />

      <section>
        <p className="text-[11px] font-bold tracking-widest text-accent mb-3">
          🏈 MANAGERS · {managers.length}
        </p>
        <ul className="rounded-2xl border border-app bg-elev overflow-hidden">
          {managers.map((t, i) => {
            const career = careerBySlug.get(t.owner_slug);
            const careerTitleYears =
              career?.seasons.filter((s) => s.finish === 1).map((s) => s.year) ?? [];
            const legacyTitleYears = legacy[t.owner_slug] ?? [];
            const titleYears = [...legacyTitleYears, ...careerTitleYears].sort();

            return (
              <li key={t.owner_slug} className="border-b border-app last:border-0">
                <Link
                  href={`/managers/${t.owner_slug}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-elev-2"
                >
                  <span className="w-7 text-right text-xs font-bold text-muted tabular-nums shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">
                      <span className="text-[15px] font-semibold">{t.owner}</span>
                      {titleYears.length > 0 && (
                        <span className="text-accent text-xs font-semibold ml-2">
                          · {titleYears.join(", ")} Champion
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {t.team_name}
                    </span>
                  </span>
                </Link>
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
