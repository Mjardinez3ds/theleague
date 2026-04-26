import Link from "next/link";
import { getLeagueMeta, getStandings } from "@/lib/data";

export const dynamic = "force-static";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function HomePage() {
  const meta = await getLeagueMeta();
  const standings = await getStandings(meta.current_year);

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-5">
        <p className="text-[11px] font-bold tracking-widest text-accent">
          THE LEAGUE
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">
          {meta.league_name}
        </h1>
        <p className="text-sm text-muted">
          Week {meta.current_week} · {meta.team_count} teams
        </p>
      </header>

      <section className="rounded-2xl border border-app bg-elev overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_56px_64px_64px] items-center px-3 py-2 text-[10px] font-semibold tracking-wider text-muted uppercase border-b border-app">
          <div>#</div>
          <div>Team</div>
          <div className="text-right">W-L</div>
          <div className="text-right">PF</div>
          <div className="text-right">PA</div>
        </div>
        <ul>
          {standings.teams.map((t, i) => {
            const finish = t.finish ?? i + 1;
            const trophyColor =
              finish === 1
                ? "text-yellow-400"
                : finish === 2
                ? "text-zinc-300"
                : finish === 3
                ? "text-amber-700"
                : "text-muted";
            return (
              <li
                key={t.id}
                className="grid grid-cols-[28px_1fr_56px_64px_64px] items-center px-3 py-3 border-b border-app last:border-0 active:bg-elev-2"
              >
                <span className={`text-sm font-bold ${trophyColor}`}>
                  {finish}
                </span>
                <Link
                  href={`/managers/${t.owner_slug}`}
                  className="min-w-0 pr-2"
                >
                  <div className="truncate text-[15px] font-semibold leading-tight">
                    {t.team_name}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {t.owner}
                  </div>
                </Link>
                <span className="text-right text-sm font-semibold tabular-nums">
                  {t.wins}-{t.losses}
                  {t.ties ? `-${t.ties}` : ""}
                </span>
                <span className="text-right text-sm tabular-nums">
                  {t.points_for.toFixed(0)}
                </span>
                <span className="text-right text-sm text-muted tabular-nums">
                  {t.points_against.toFixed(0)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-4 text-center text-[11px] text-muted">
        Updated {new Date(meta.updated_at).toLocaleString()}
      </p>
    </div>
  );
}
