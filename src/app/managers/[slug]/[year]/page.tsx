import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCareers,
  getOwner,
  getManagerScores,
  getDraftPicks,
  getDraftGrades,
  type WeekResult,
  type DraftPick,
  type DraftGrades,
  type GradedPick,
} from "@/lib/data";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const { owners } = await getCareers();
  return owners.flatMap((o) =>
    o.seasons.map((s) => ({ slug: o.slug, year: String(s.year) }))
  );
}

function finishLabel(finish: number | null, league_size: number) {
  if (finish === 1) return { text: "Champion 🥇", color: "text-yellow-400" };
  if (finish === 2) return { text: "Runner-Up 🥈", color: "text-zinc-300" };
  if (finish === 3) return { text: "3rd Place 🥉", color: "text-amber-700" };
  if (finish && finish === league_size)
    return { text: "Last Place 🚽", color: "text-red-400" };
  if (finish) return { text: `${finish} of ${league_size}`, color: "text-muted" };
  return { text: "—", color: "text-muted" };
}

function posColor(pos: string): string {
  switch ((pos || "").toUpperCase()) {
    case "QB":   return "text-red-400";
    case "RB":   return "text-green-400";
    case "WR":   return "text-blue-400";
    case "TE":   return "text-orange-400";
    case "K":    return "text-purple-400";
    case "D/ST":
    case "DST":  return "text-yellow-400";
    default:     return "text-muted";
  }
}

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ slug: string; year: string }>;
}) {
  const { slug, year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (isNaN(year)) notFound();

  let career;
  try {
    career = await getOwner(slug);
  } catch {
    notFound();
  }

  const season = career.seasons.find((s) => s.year === year);
  if (!season) notFound();

  // All optional — older seasons may lack any of these
  let picks: DraftPick[] = [];
  let scores: WeekResult[] = [];
  let grades: DraftGrades | null = null;

  try { picks = await getDraftPicks(year, slug); } catch { /* no data */ }
  try { scores = (await getManagerScores(year, slug)).weeks; } catch { /* no data */ }
  try { grades = await getDraftGrades(year, slug); } catch { /* no grades for this year */ }

  const fin = finishLabel(season.finish, season.league_size);
  const regularWeeks = scores.filter((w) => !w.is_playoff);
  const playoffWeeks  = scores.filter((w) => w.is_playoff);

  const highScore = scores.length ? Math.max(...scores.map((w) => w.score)) : null;
  const lowScore  = scores.length ? Math.min(...scores.map((w) => w.score)) : null;
  const avgScore  = scores.length
    ? scores.reduce((sum, w) => sum + w.score, 0) / scores.length
    : null;

  return (
    <div className="px-4 pt-6 pb-8">
      {/* Back link */}
      <Link
        href={`/managers/${slug}`}
        className="inline-flex items-center gap-1 text-xs text-muted mb-5 active:opacity-70"
      >
        ← {career.owner}
      </Link>

      {/* Header */}
      <header className="mb-5">
        <p className="text-[11px] font-bold tracking-widest text-accent">
          {year} SEASON
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">
          {season.team_name}
        </h1>
        <p className={`text-sm font-semibold mt-0.5 ${fin.color}`}>
          {fin.text}
        </p>
      </header>

      {/* Season summary */}
      <section className="rounded-2xl border border-app bg-elev p-4 mb-4">
        <p className="text-[11px] font-bold tracking-widest text-accent mb-3">
          SUMMARY
        </p>
        <div className="grid grid-cols-3 gap-y-4 gap-x-2">
          <StatBox
            label="Record"
            value={`${season.wins}-${season.losses}${season.ties ? `-${season.ties}` : ""}`}
          />
          <StatBox label="Points For"     value={season.points_for.toFixed(1)} />
          <StatBox label="Points Against" value={season.points_against.toFixed(1)} />
          {highScore !== null && <StatBox label="High Score" value={highScore.toFixed(2)} />}
          {lowScore  !== null && <StatBox label="Low Score"  value={lowScore.toFixed(2)} />}
          {avgScore  !== null && <StatBox label="Avg/Week"   value={avgScore.toFixed(1)} />}
        </div>
      </section>

      {/* Regular season results */}
      {regularWeeks.length > 0 && (
        <section className="mb-4">
          <p className="text-[11px] font-bold tracking-widest text-accent mb-2 px-1">
            REGULAR SEASON
          </p>
          <WeekTable weeks={regularWeeks} />
        </section>
      )}

      {/* Playoff results */}
      {playoffWeeks.length > 0 && (
        <section className="mb-4">
          <p className="text-[11px] font-bold tracking-widest text-accent mb-2 px-1">
            PLAYOFFS
          </p>
          <WeekTable weeks={playoffWeeks} />
        </section>
      )}

      {/* Draft picks */}
      {grades && grades.graded_pick_count > 0 && (
        <section className="mb-4">
          <p className="text-[11px] font-bold tracking-widest text-accent mb-2 px-1">
            DRAFT GRADE
          </p>
          <div className="rounded-2xl border border-app bg-elev p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className={`text-4xl font-extrabold leading-none ${gradeColor(grades.grade)}`}>
                  {grades.grade}
                </p>
                <p className="text-xs text-muted mt-1">
                  Ranked #{grades.rank} of {grades.of} this year
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted uppercase tracking-wider">Steals · Busts</p>
                <p className="text-base font-bold tabular-nums">
                  <span className="text-green-400">{grades.steals_count}</span>
                  <span className="text-muted"> · </span>
                  <span className="text-red-400">{grades.busts_count}</span>
                </p>
                <p className="text-[10px] text-muted mt-0.5">
                  Median value {grades.median_value > 0 ? "+" : ""}{grades.median_value}
                </p>
              </div>
            </div>
          </div>

          {grades.steals.length > 0 && (
            <>
              <p className="text-[11px] font-bold tracking-widest text-green-400 mb-2 px-1">
                💎 STEALS
              </p>
              <div className="rounded-2xl border border-app bg-elev overflow-hidden mb-3">
                <ul>
                  {grades.steals.map((p) => (
                    <GradedPickRow key={`s-${p.round}-${p.pick}`} p={p} kind="steal" />
                  ))}
                </ul>
              </div>
            </>
          )}

          {grades.busts.length > 0 && (
            <>
              <p className="text-[11px] font-bold tracking-widest text-red-400 mb-2 px-1">
                💀 BUSTS
              </p>
              <div className="rounded-2xl border border-app bg-elev overflow-hidden mb-3">
                <ul>
                  {grades.busts.map((p) => (
                    <GradedPickRow key={`b-${p.round}-${p.pick}`} p={p} kind="bust" />
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      )}

      {picks.length > 0 && (
        <section className="mb-4">
          <p className="text-[11px] font-bold tracking-widest text-accent mb-2 px-1">
            DRAFT PICKS
          </p>
          <div className="rounded-2xl border border-app bg-elev overflow-hidden">
            <ul>
              {picks.map((p) => (
                <li
                  key={`${p.round}-${p.pick}`}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-app last:border-0"
                >
                  <span className="text-[10px] font-bold tabular-nums text-muted min-w-[2.8rem] text-center shrink-0">
                    {p.round}.{String(p.pick).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">
                    {p.player}
                  </span>
                  {p.position && (
                    <span className={`text-[10px] font-bold shrink-0 ${posColor(p.position)}`}>
                      {p.position}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function WeekTable({ weeks }: { weeks: WeekResult[] }) {
  return (
    <div className="rounded-2xl border border-app bg-elev overflow-hidden">
      <div className="grid grid-cols-[32px_1fr_56px_56px] items-center px-3 py-2 text-[10px] font-semibold tracking-wider text-muted uppercase border-b border-app">
        <div>Wk</div>
        <div>Opponent</div>
        <div className="text-right">Score</div>
        <div className="text-right">Opp</div>
      </div>
      <ul>
        {weeks.map((w) => {
          const resultColor =
            w.result === "W"
              ? "text-green-400"
              : w.result === "T"
              ? "text-muted"
              : "text-red-400";
          return (
            <li
              key={w.week}
              className="grid grid-cols-[32px_1fr_56px_56px] items-center px-3 py-2.5 border-b border-app last:border-0"
            >
              <span className="text-xs font-bold text-muted tabular-nums">
                {w.week}
              </span>
              <Link
                href={`/managers/${w.opponent_slug}`}
                className="min-w-0 pr-1 active:opacity-70"
              >
                <div className="text-sm font-semibold truncate">
                  {w.opponent_team}
                </div>
                <div className="text-[11px] text-muted truncate">
                  {w.opponent}
                </div>
              </Link>
              <span
                className={`text-right text-sm font-bold tabular-nums ${resultColor}`}
              >
                {w.score.toFixed(2)}
              </span>
              <span className="text-right text-sm text-muted tabular-nums">
                {w.opponent_score.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-wider text-muted uppercase">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-green-400";
  if (grade.startsWith("B")) return "text-emerald-300";
  if (grade.startsWith("C")) return "text-yellow-400";
  if (grade.startsWith("D")) return "text-orange-400";
  if (grade.startsWith("F")) return "text-red-400";
  return "text-muted";
}

function GradedPickRow({ p, kind }: { p: GradedPick; kind: "steal" | "bust" }) {
  const valueColor = kind === "steal" ? "text-green-400" : "text-red-400";
  const sign = (p.value ?? 0) > 0 ? "+" : "";
  return (
    <li className="grid grid-cols-[44px_1fr_auto] items-center gap-2 px-3 py-2.5 border-b border-app last:border-0">
      <span className="text-[10px] font-bold tabular-nums text-muted text-center">
        {p.round}.{String(p.pick).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{p.player}</div>
        <div className="text-[11px] text-muted truncate">
          {p.position} · ADP {p.position}{p.adp_pos_rank} · finished {p.position}{p.actual_pos_rank} · {p.actual_pts} pts
        </div>
      </div>
      <span className={`text-sm font-bold tabular-nums shrink-0 ${valueColor}`}>
        {sign}{p.value}
      </span>
    </li>
  );
}
