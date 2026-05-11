import { notFound } from "next/navigation";
import {
  getOwner,
  getCareers,
} from "@/lib/data";
import { SeasonCard } from "@/components/SeasonCard";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const { owners } = await getCareers();
  return owners.map((o) => ({ slug: o.slug }));
}

function finishLabel(finish: number | null, league_size: number): {
  text: string;
  color: string;
} {
  if (finish === 1) return { text: "CHAMPION", color: "text-yellow-400" };
  if (finish === 2) return { text: "RUNNER-UP", color: "text-zinc-300" };
  if (finish === 3) return { text: "3RD PLACE", color: "text-amber-700" };
  if (finish && finish === league_size)
    return { text: "LAST", color: "text-red-400" };
  if (finish) return { text: `${finish}/${league_size}`, color: "text-muted" };
  return { text: "—", color: "text-muted" };
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function ManagerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let career;
  try {
    career = await getOwner(slug);
  } catch {
    notFound();
  }

  // ----- Derived per-season highlights -----
  const games = career.wins + career.losses + career.ties;
  const avgPFperGame = games ? career.points_for / games : 0;
  const avgPAperGame = games ? career.points_against / games : 0;
  const pointDiff = career.points_for - career.points_against;

  const finishes = career.seasons
    .map((s) => s.finish)
    .filter((f): f is number => f != null);
  const bestFinish = finishes.length ? Math.min(...finishes) : null;
  const worstFinish = finishes.length ? Math.max(...finishes) : null;
  const avgFinish =
    finishes.length ? finishes.reduce((a, b) => a + b, 0) / finishes.length : null;

  const sortedSeasons = [...career.seasons].sort((a, b) => b.year - a.year);
  const peakSeason = [...career.seasons].sort(
    (a, b) => b.points_for - a.points_for
  )[0];
  const worstSeason = [...career.seasons].sort(
    (a, b) => a.points_for - b.points_for
  )[0];

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-5">
        <p className="text-[11px] font-bold tracking-widest text-accent">
          MANAGER
        </p>
        <h1 className="text-3xl font-extrabold leading-tight">
          {career.owner}
        </h1>
        <p className="text-sm text-muted">
          {career.seasons.length} season
          {career.seasons.length === 1 ? "" : "s"} in The League
        </p>
      </header>

      {/* Career hero card */}
      <section className="rounded-2xl border border-app bg-elev p-4 mb-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-accent">
              CAREER RECORD
            </p>
            <div className="text-5xl font-extrabold tabular-nums leading-none mt-1">
              {career.wins}-{career.losses}
              {career.ties ? `-${career.ties}` : ""}
            </div>
            <p className="text-sm text-muted mt-1">
              {career.win_pct.toFixed(1)}% · {games} games
            </p>
          </div>
          <div className="text-right">
            <div className="flex justify-end gap-2 text-lg">
              {career.titles > 0 && <span>🥇{career.titles}</span>}
              {career.runners_up > 0 && <span>🥈{career.runners_up}</span>}
              {career.thirds > 0 && <span>🥉{career.thirds}</span>}
              {career.titles + career.runners_up + career.thirds === 0 && (
                <span className="text-sm text-muted">no hardware</span>
              )}
            </div>
            {career.lasts > 0 && (
              <p className="text-[11px] text-red-400 mt-1">
                🚽 {career.lasts} toilet bowl
                {career.lasts === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="rounded-2xl border border-app bg-elev p-4 mb-3">
        <p className="text-[11px] font-bold tracking-widest text-accent mb-3">
          AT A GLANCE
        </p>
        <div className="grid grid-cols-3 gap-y-4 gap-x-2">
          <Stat label="Avg PF/Game" value={avgPFperGame.toFixed(1)} />
          <Stat label="Avg PA/Game" value={avgPAperGame.toFixed(1)} />
          <Stat
            label="Point Diff"
            value={(pointDiff >= 0 ? "+" : "") + pointDiff.toFixed(0)}
            color={pointDiff >= 0 ? "text-green-400" : "text-red-400"}
          />
          <Stat
            label="Best Finish"
            value={bestFinish ? ordinal(bestFinish) : "—"}
          />
          <Stat
            label="Worst Finish"
            value={worstFinish ? ordinal(worstFinish) : "—"}
          />
          <Stat
            label="Avg Finish"
            value={avgFinish ? avgFinish.toFixed(1) : "—"}
          />
        </div>
      </section>

      {/* Highlights */}
      {(peakSeason || worstSeason) && (
        <section className="rounded-2xl border border-app bg-elev p-4 mb-3">
          <p className="text-[11px] font-bold tracking-widest text-accent mb-3">
            HIGHLIGHTS
          </p>
          <div className="space-y-2.5">
            {peakSeason && (
              <HighlightRow
                emoji="🔥"
                label="Best scoring season"
                value={`${peakSeason.points_for.toFixed(1)} pts`}
                detail={`${peakSeason.year} · ${peakSeason.team_name}`}
              />
            )}
            {worstSeason && worstSeason !== peakSeason && (
              <HighlightRow
                emoji="🥶"
                label="Lowest scoring season"
                value={`${worstSeason.points_for.toFixed(1)} pts`}
                detail={`${worstSeason.year} · ${worstSeason.team_name}`}
              />
            )}
          </div>
        </section>
      )}

      {/* Season-by-season */}
      <p className="text-[11px] font-bold tracking-widest text-accent mb-2 px-1 mt-6">
        SEASON BY SEASON
      </p>
      <ul className="space-y-2 mb-5">
        {sortedSeasons.map((s) => (
          <SeasonCard
            key={s.year}
            season={s}
            slug={slug}
            finLabel={finishLabel(s.finish, s.league_size)}
          />
        ))}
      </ul>

    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <p className="text-[10px] tracking-wider text-muted uppercase">{label}</p>
      <p className={`text-base font-bold tabular-nums ${color ?? ""}`}>
        {value}
      </p>
    </div>
  );
}

function HighlightRow({
  emoji,
  label,
  value,
  detail,
}: {
  emoji: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-elev-2 px-3 py-2">
      <span className="text-xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-bold tabular-nums">{value}</p>
      </div>
      <p className="text-[11px] text-muted text-right">{detail}</p>
    </div>
  );
}
