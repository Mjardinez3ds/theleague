import { notFound } from "next/navigation";
import { getOwner, getCareers } from "@/lib/data";
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

  const games = career.wins + career.losses + career.ties;
  const seasonsCount = career.seasons.length;
  const avgPF = career.points_for / Math.max(1, seasonsCount);
  const avgPA = career.points_against / Math.max(1, seasonsCount);
  const sortedSeasons = [...career.seasons].sort((a, b) => b.year - a.year);

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
          {seasonsCount} season{seasonsCount === 1 ? "" : "s"} in The League
        </p>
      </header>

      {/* Career hero card */}
      <section className="rounded-2xl border border-app bg-elev p-4 mb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-accent-dim">
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
                {career.lasts} last-place finish
                {career.lasts === 1 ? "" : "es"}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-app">
          <Stat label="Total PF" value={career.points_for.toFixed(1)} />
          <Stat label="Total PA" value={career.points_against.toFixed(1)} />
          <Stat label="Avg PF / Season" value={avgPF.toFixed(1)} />
          <Stat label="Avg PA / Season" value={avgPA.toFixed(1)} />
        </div>
      </section>

      {/* Season-by-season */}
      <p className="text-[11px] font-bold tracking-widest text-accent mb-2 px-1">
        SEASON BY SEASON
      </p>
      <ul className="space-y-2">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-wider text-muted uppercase">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}
