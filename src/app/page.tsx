import Link from "next/link";
import {
  getUpcomingSeason,
  getLeagueMeta,
  getStandings,
  getHistory,
  getLegacyChampions,
  getManagerScores,
  type WeekResult,
} from "@/lib/data";
import SeasonCountdown from "@/components/SeasonCountdown";

export const dynamic = "force-static";

type Game = WeekResult & { slug: string; owner: string };

export default async function HomePage() {
  const [season, meta, { seasons: history }, legacy] = await Promise.all([
    getUpcomingSeason(),
    getLeagueMeta(),
    getHistory(),
    getLegacyChampions(),
  ]);
  const year = meta.current_year;
  const standings = await getStandings(year);
  const ownerBySlug = new Map(standings.teams.map((t) => [t.owner_slug, t.owner]));

  // Every completed game this season, one row per team. Scores files only
  // contain finished weeks (see the box_scores gotcha in AGENTS.md), and
  // don't exist at all before Week 1.
  const games: Game[] = (
    await Promise.all(
      standings.teams.map(async (t) => {
        const s = await getManagerScores(year, t.owner_slug).catch(() => null);
        return (s?.weeks ?? []).map((w) => ({ ...w, slug: t.owner_slug, owner: t.owner }));
      })
    )
  ).flat();

  const lastWeek = games.length ? Math.max(...games.map((g) => g.week)) : 0;
  const seasonOver = history.find((h) => h.year === year)?.champion ?? null;

  // Latest week's matchups, one card per game (taken from the winner's side).
  const weekGames = games.filter((g) => g.week === lastWeek);
  const matchups = weekGames
    .filter((g) => g.result === "W" || (g.result === "T" && g.slug < g.opponent_slug))
    .sort((a, b) => b.score + b.opponent_score - (a.score + a.opponent_score));
  const weekHigh = weekGames.reduce<Game | null>((m, g) => (!m || g.score > m.score ? g : m), null);
  const closest = matchups.reduce<Game | null>(
    (m, g) => (!m || g.score - g.opponent_score < m.score - m.opponent_score ? g : m),
    null
  );

  // Form guide: last 5 results per manager, oldest → newest.
  const formBySlug = new Map<string, WeekResult["result"][]>();
  for (const t of standings.teams) {
    formBySlug.set(
      t.owner_slug,
      games
        .filter((g) => g.slug === t.owner_slug)
        .sort((a, b) => a.week - b.week)
        .slice(-5)
        .map((g) => g.result)
    );
  }

  // Season leaders for the hero strip.
  const leader = standings.teams[0];
  const ppg = standings.teams
    .map((t) => {
      const mine = games.filter((g) => g.slug === t.owner_slug);
      return { t, v: mine.length ? mine.reduce((a, g) => a + g.score, 0) / mine.length : 0 };
    })
    .sort((a, b) => b.v - a.v)[0];
  const seasonHigh = games.reduce<Game | null>((m, g) => (!m || g.score > m.score ? g : m), null);

  // Every champion we know of: legacy (pre-ESPN) years + ESPN history.
  const champs = [
    ...Object.entries(legacy).flatMap(([slug, years]) =>
      years.map((y) => ({ year: y, slug, owner: ownerBySlug.get(slug) ?? nameFromSlug(slug) }))
    ),
    ...history
      .filter((h) => h.champion)
      .map((h) => ({ year: h.year, slug: h.champion!.owner_slug, owner: h.champion!.owner })),
  ].sort((a, b) => b.year - a.year);
  const titlesBySlug = new Map<string, number[]>();
  for (const c of champs) titlesBySlug.set(c.slug, [...(titlesBySlug.get(c.slug) ?? []), c.year].sort());

  return (
    <div className="px-4 pt-6 pb-4 space-y-7">
      {/* ---------- Hero ---------- */}
      <section
        className="relative overflow-hidden rounded-3xl border border-app p-5"
        style={{
          background:
            "radial-gradient(120% 90% at 100% 0%, rgba(255,196,0,0.18) 0%, rgba(255,196,0,0.04) 45%, transparent 70%), var(--bg-elev)",
        }}
      >
        <p className="text-[11px] font-bold tracking-[0.2em] text-accent">THE LEAGUE · {year}</p>

        {seasonOver ? (
          <>
            <h1 className="mt-2 text-4xl font-black leading-none tracking-tight">Season over</h1>
            <p className="mt-2 text-sm text-muted">
              🏆 <span className="font-semibold text-text">{seasonOver.owner}</span> won it all with{" "}
              {seasonOver.team_name}.
            </p>
          </>
        ) : lastWeek === 0 ? (
          <>
            <h1 className="mt-2 text-4xl font-black leading-none tracking-tight">Kickoff is coming</h1>
            <p className="mt-2 text-sm text-muted">The draft is in the books.</p>
          </>
        ) : (
          <>
            <h1 className="mt-2 flex items-baseline gap-3">
              <span className="text-[56px] font-black leading-none tracking-tight tabular-nums">
                Week {meta.current_week}
              </span>
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--green)" }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--green)" }} />
              </span>
              Underway · Week {lastWeek} is final
            </p>
          </>
        )}

        {lastWeek > 0 && (
          <dl className="mt-5 grid grid-cols-3 gap-2">
            <HeroStat label="1st place" value={`${leader.wins}-${leader.losses}`} who={leader.owner} slug={leader.owner_slug} />
            <HeroStat label="Top PPG" value={ppg.v.toFixed(1)} who={ppg.t.owner} slug={ppg.t.owner_slug} />
            {seasonHigh && (
              <HeroStat label="High score" value={seasonHigh.score.toFixed(1)} who={seasonHigh.owner} slug={seasonHigh.slug} />
            )}
          </dl>
        )}
      </section>

      {lastWeek === 0 && !seasonOver && (
        <SeasonCountdown isoDate={season.kickoff_date} label={season.kickoff_date_label} />
      )}

      {/* ---------- Latest week's scoreboard ---------- */}
      {matchups.length > 0 && (
        <section>
          <SectionHead title={`WEEK ${lastWeek} SCOREBOARD`} href="/stats" link="All stats" />
          <ul className="space-y-2">
            {matchups.map((g) => (
              <li key={`${g.slug}-${g.opponent_slug}`} className="rounded-2xl border border-app bg-elev">
                <ScoreRow slug={g.slug} owner={g.owner} team={g.team_name} score={g.score} won titles={titlesBySlug.get(g.slug)} tag={weekHigh?.slug === g.slug ? "TOP SCORE" : undefined} />
                <div className="mx-4 border-t border-app" />
                <ScoreRow
                  slug={g.opponent_slug}
                  owner={g.opponent}
                  team={g.opponent_team}
                  score={g.opponent_score}
                  won={false}
                  titles={titlesBySlug.get(g.opponent_slug)}
                  tag={weekHigh?.slug === g.opponent_slug ? "TOP SCORE" : undefined}
                />
                {closest === g && matchups.length > 1 && (
                  <p className="px-4 pb-2.5 -mt-0.5 text-[10px] font-bold tracking-widest text-muted">
                    CLOSEST GAME · {(g.score - g.opponent_score).toFixed(2)} PTS
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Standings snapshot with form guide ---------- */}
      <section>
        <SectionHead title="STANDINGS" href="/standings" link="Full table" />
        <ul className="rounded-2xl border border-app bg-elev overflow-hidden">
          {standings.teams.map((t, i) => {
            const form = formBySlug.get(t.owner_slug) ?? [];
            return (
              <li key={t.owner_slug} className="border-b border-app last:border-0">
                <Link href={`/managers/${t.owner_slug}`} className="flex items-center gap-3 px-3 py-2.5 active:bg-elev-2">
                  <span className={`w-6 text-center text-sm font-black tabular-nums ${i < 3 ? "text-accent" : "text-muted"}`}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold leading-tight">{t.owner}</span>
                      <ChampTag years={titlesBySlug.get(t.owner_slug)} />
                    </span>
                    <span className="block truncate text-xs text-muted">{t.team_name}</span>
                  </span>
                  <span className="hidden min-[360px]:flex gap-[3px]" aria-label={`Last ${form.length}: ${form.join(" ")}`}>
                    {form.map((r, k) => (
                      <span
                        key={k}
                        className="h-3.5 w-1.5 rounded-full"
                        style={{
                          background: r === "W" ? "var(--green)" : r === "L" ? "var(--red)" : "var(--text-muted)",
                          opacity: 0.45 + (0.55 * (k + 1)) / form.length,
                        }}
                      />
                    ))}
                  </span>
                  <span className="w-[68px] text-right">
                    <span className="block text-sm font-bold tabular-nums">
                      {t.wins}-{t.losses}
                      {t.ties ? `-${t.ties}` : ""}
                    </span>
                    <span className="block text-[11px] text-muted tabular-nums">{t.points_for.toFixed(1)} PF</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {lastWeek > 0 && (
          <p className="mt-2 flex items-center gap-3 text-[11px] text-muted">
            <span>Last {Math.min(5, lastWeek)} games:</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-1.5 rounded-full" style={{ background: "var(--green)" }} />Win</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-1.5 rounded-full" style={{ background: "var(--red)" }} />Loss</span>
          </p>
        )}
      </section>

      {/* ---------- Champions ---------- */}
      {champs.length > 0 && (
        <section>
          <SectionHead title="CHAMPIONS" href="/history" link="History" />
          <ul className="grid grid-cols-2 gap-2">
            {champs.map((c, i) => (
              <li key={c.year}>
                <Link
                  href={`/managers/${c.slug}`}
                  className={`flex items-center gap-3 rounded-2xl border p-3 active:bg-elev-2 ${
                    i === 0 ? "border-accent/50" : "border-app"
                  } bg-elev`}
                  style={i === 0 ? { background: "linear-gradient(135deg, rgba(255,196,0,0.14), var(--bg-elev) 70%)" } : undefined}
                >
                  <span className="text-xl leading-none" aria-hidden>🏆</span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold tracking-widest text-accent tabular-nums">{c.year}</span>
                    <span className="block truncate text-sm font-semibold">{c.owner}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function nameFromSlug(slug: string) {
  return slug.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

/** Gold "🏆 2025" tag shown after a manager's name. Names truncate first. */
function ChampTag({ years }: { years?: number[] }) {
  if (!years?.length) return null;
  return (
    <span className="shrink-0 text-[11px] font-semibold text-accent tabular-nums" title={`${years.join(", ")} Champion`}>
      🏆 {years.join(", ")}
    </span>
  );
}

function SectionHead({ title, href, link }: { title: string; href: string; link: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <p className="text-[11px] font-bold tracking-widest text-accent">{title}</p>
      <Link href={href} className="text-xs font-semibold text-muted active:text-text">
        {link} →
      </Link>
    </div>
  );
}

function HeroStat({ label, value, who, slug }: { label: string; value: string; who: string; slug: string }) {
  return (
    <Link href={`/managers/${slug}`} className="min-w-0 rounded-2xl px-3 py-2.5 active:bg-elev-2" style={{ background: "rgba(10,14,26,0.55)" }}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-xl font-extrabold tabular-nums text-accent leading-tight">{value}</dd>
      <dd className="truncate text-xs font-medium">{who.split(" ")[0]}</dd>
    </Link>
  );
}

function ScoreRow({
  slug,
  owner,
  team,
  score,
  won,
  titles,
  tag,
}: {
  slug: string;
  owner: string;
  team: string;
  score: number;
  won: boolean;
  titles?: number[];
  tag?: string;
}) {
  return (
    <Link href={`/managers/${slug}`} className="flex items-center gap-3 px-4 py-2.5 active:bg-elev-2">
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate text-[15px] leading-tight ${won ? "font-bold" : "font-medium text-muted"}`}>{owner}</span>
          <ChampTag years={titles} />
          {tag && <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[9px] font-black tracking-wider text-[#0a0e1a]">{tag}</span>}
        </span>
        <span className="block truncate text-xs text-muted">{team}</span>
      </span>
      <span className={`text-lg tabular-nums ${won ? "font-black text-accent" : "font-semibold text-muted"}`}>{score.toFixed(2)}</span>
    </Link>
  );
}
