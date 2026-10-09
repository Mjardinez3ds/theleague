"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import StatCharts from "./StatCharts";

export type StatGame = {
  year: number;
  week: number;
  slug: string;
  score: number;
  opp: string;
  oppScore: number;
  result: "W" | "L" | "T";
  playoff: boolean;
};

type YearView = "all-time" | number;
type SeasonType = "reg" | "post" | "all";
type Tab = "leaders" | "records" | "charts";

type ManagerStat = {
  slug: string;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pfg: number;
  pag: number;
  margin: number;
  high: number;
  low: number;
  sd: number;
  allPlayW: number;
  allPlayL: number;
  allPlayPct: number;
  xw: number;
  luck: number;
};

type Metric = {
  key: keyof ManagerStat;
  label: string;
  blurb: string;
  asc?: boolean; // lower is better
  format: (s: ManagerStat) => string;
  sub: (s: ManagerStat) => string;
};

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

const METRICS: Metric[] = [
  {
    key: "pfg",
    label: "PF/Game",
    blurb: "Points scored per game.",
    format: (s) => s.pfg.toFixed(1),
    sub: (s) => `${s.games} games · ${s.pag.toFixed(1)} allowed`,
  },
  {
    key: "allPlayPct",
    label: "All-Play",
    blurb: "Record if you played every team every week. Strips out schedule luck.",
    format: (s) => `${(s.allPlayPct * 100).toFixed(1)}%`,
    sub: (s) => `${s.allPlayW}-${s.allPlayL} vs the field`,
  },
  {
    key: "luck",
    label: "Luck",
    blurb: "Actual wins minus expected wins (xW). Positive means the schedule helped.",
    format: (s) => signed(s.luck),
    sub: (s) => `${s.wins} wins · ${s.xw.toFixed(1)} expected`,
  },
  {
    key: "margin",
    label: "Margin",
    blurb: "Average points of victory or defeat per game.",
    format: (s) => signed(s.margin),
    sub: (s) => `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}`,
  },
  {
    key: "sd",
    label: "Consistency",
    blurb: "Spread of weekly scores (standard deviation). Lower is steadier.",
    asc: true,
    format: (s) => `±${s.sd.toFixed(1)}`,
    sub: (s) => `range ${s.low.toFixed(1)} – ${s.high.toFixed(1)}`,
  },
  {
    key: "high",
    label: "Best Week",
    blurb: "Highest single-week score.",
    format: (s) => s.high.toFixed(2),
    sub: (s) => `low ${s.low.toFixed(2)}`,
  },
];

function computeStats(games: StatGame[]): ManagerStat[] {
  // Scores grouped by year+week for all-play comparisons.
  const byWeek = new Map<string, number[]>();
  for (const g of games) {
    const k = `${g.year}-${g.week}`;
    const arr = byWeek.get(k) ?? [];
    arr.push(g.score);
    byWeek.set(k, arr);
  }

  const acc = new Map<
    string,
    { slug: string; scores: number[]; pa: number; w: number; l: number; t: number; apw: number; apl: number; xw: number }
  >();
  for (const g of games) {
    const a = acc.get(g.slug) ?? { slug: g.slug, scores: [], pa: 0, w: 0, l: 0, t: 0, apw: 0, apl: 0, xw: 0 };
    a.scores.push(g.score);
    a.pa += g.oppScore;
    if (g.result === "W") a.w++;
    else if (g.result === "L") a.l++;
    else a.t++;
    const field = byWeek.get(`${g.year}-${g.week}`) ?? [];
    let beat = 0;
    let lost = 0;
    for (const p of field) {
      if (p < g.score) beat++;
      else if (p > g.score) lost++;
    }
    a.apw += beat;
    a.apl += lost;
    if (field.length > 1) a.xw += beat / (field.length - 1);
    acc.set(g.slug, a);
  }

  return [...acc.values()].map((a) => {
    const n = a.scores.length;
    const pf = a.scores.reduce((x, y) => x + y, 0);
    const avg = pf / n;
    const sd = Math.sqrt(a.scores.reduce((x, v) => x + (v - avg) ** 2, 0) / n);
    return {
      slug: a.slug,
      games: n,
      wins: a.w,
      losses: a.l,
      ties: a.t,
      pfg: avg,
      pag: a.pa / n,
      margin: (pf - a.pa) / n,
      high: Math.max(...a.scores),
      low: Math.min(...a.scores),
      sd,
      allPlayW: a.apw,
      allPlayL: a.apl,
      allPlayPct: a.apw / Math.max(1, a.apw + a.apl),
      xw: a.xw,
      luck: a.w - a.xw,
    };
  });
}

export default function StatsView({
  games,
  names,
  years,
}: {
  games: StatGame[];
  names: Record<string, string>;
  years: number[];
}) {
  const [view, setView] = useState<YearView>("all-time");
  const [type, setType] = useState<SeasonType>("reg");
  const [tab, setTab] = useState<Tab>("leaders");
  const [metricKey, setMetricKey] = useState<Metric["key"]>("pfg");

  const filtered = useMemo(
    () =>
      games.filter(
        (g) =>
          (view === "all-time" || g.year === view) &&
          (type === "all" || (type === "post" ? g.playoff : !g.playoff))
      ),
    [games, view, type]
  );
  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const name = (slug: string) => names[slug] ?? slug;

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-4">
        <p className="text-[11px] font-bold tracking-widest text-accent">STATS</p>
        <h1 className="text-2xl font-extrabold leading-tight">
          {view === "all-time" ? "All-Time Stats" : `${view} Stats`}
        </h1>
        <p className="text-sm text-muted">
          {type === "reg" ? "Regular season" : type === "post" ? "Playoffs" : "All games, playoffs included"}
        </p>
      </header>

      {/* Year selector pills */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
        <Pill active={view === "all-time"} onClick={() => setView("all-time")} label="All-Time" />
        {[...years].sort((a, b) => b - a).map((yr) => (
          <Pill key={yr} active={view === yr} onClick={() => setView(yr)} label={String(yr)} />
        ))}
      </div>

      {/* Season type + tab switch */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <Segmented
          value={type}
          onChange={(v) => setType(v as SeasonType)}
          options={[
            ["reg", "Regular"],
            ["post", "Playoffs"],
            ["all", "All"],
          ]}
        />
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            ["leaders", "Leaders"],
            ["records", "Records"],
            ["charts", "Charts"],
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-app bg-elev p-6 text-center text-muted text-sm">
          No games match these filters yet.
        </div>
      ) : tab === "leaders" ? (
        <Leaders stats={stats} games={filtered} name={name} metricKey={metricKey} setMetricKey={setMetricKey} />
      ) : tab === "records" ? (
        <Records games={filtered} name={name} />
      ) : (
        <StatCharts games={filtered} names={names} singleSeason={view !== "all-time"} />
      )}

      {type !== "reg" && (
        <p className="mt-4 text-xs text-muted">
          Playoff games are included here, so records won&apos;t match the regular-season standings.
        </p>
      )}
    </div>
  );
}

/* ---------- Leaders ---------- */

function Leaders({
  stats,
  games,
  name,
  metricKey,
  setMetricKey,
}: {
  stats: ManagerStat[];
  games: StatGame[];
  name: (slug: string) => string;
  metricKey: Metric["key"];
  setMetricKey: (k: Metric["key"]) => void;
}) {
  // Only rank managers with a meaningful sample (half the max games played).
  const maxGames = Math.max(...stats.map((s) => s.games));
  const qualified = stats.filter((s) => s.games >= Math.max(1, Math.ceil(maxGames / 2)));
  const best = (key: keyof ManagerStat, asc = false) =>
    [...qualified].sort((a, b) => (asc ? (a[key] as number) - (b[key] as number) : (b[key] as number) - (a[key] as number)))[0];

  const topWeek = games.reduce((a, b) => (b.score > a.score ? b : a));
  const pfg = best("pfg");
  const ap = best("allPlayPct");
  const lucky = best("luck");
  const unlucky = best("luck", true);

  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];
  const ranked = [...qualified].sort((a, b) => {
    const d = (a[metric.key] as number) - (b[metric.key] as number);
    return metric.asc ? d : -d;
  });

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-2">
        <LeaderCard label="PF / Game" value={pfg.pfg.toFixed(1)} slug={pfg.slug} name={name} sub={`${pfg.games} games`} />
        <LeaderCard
          label="Best Week"
          value={topWeek.score.toFixed(1)}
          slug={topWeek.slug}
          name={name}
          sub={`${topWeek.year} · Wk ${topWeek.week}`}
        />
        <LeaderCard
          label="All-Play"
          value={`${(ap.allPlayPct * 100).toFixed(0)}%`}
          slug={ap.slug}
          name={name}
          sub={`${ap.allPlayW}-${ap.allPlayL} vs field`}
        />
        <LeaderCard
          label="Luckiest"
          value={signed(lucky.luck)}
          slug={lucky.slug}
          name={name}
          sub={`${signed(unlucky.luck)} ${name(unlucky.slug)}`}
          subLabel="Unluckiest"
        />
      </section>

      <section>
        <p className="text-[11px] font-bold tracking-widest text-accent mb-2">RANKINGS</p>
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1 -mx-1 px-1">
          {METRICS.map((m) => (
            <Pill key={m.key} active={m.key === metric.key} onClick={() => setMetricKey(m.key)} label={m.label} />
          ))}
        </div>
        <p className="text-xs text-muted mb-3">{metric.blurb}</p>
        <ul className="rounded-2xl border border-app bg-elev overflow-hidden">
          {ranked.map((s, i) => (
            <li key={s.slug} className="border-b border-app last:border-0">
              <Link
                href={`/managers/${s.slug}`}
                className="grid grid-cols-[28px_1fr_auto] items-center gap-2 px-3 py-3 active:bg-elev-2"
              >
                <span className={`text-sm font-bold ${i === 0 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold leading-tight">{name(s.slug)}</span>
                  <span className="block truncate text-xs text-muted">{metric.sub(s)}</span>
                </span>
                <span
                  className={`text-right text-sm font-semibold tabular-nums ${
                    i === 0 ? "text-accent" : ""
                  }`}
                >
                  {metric.format(s)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function LeaderCard({
  label,
  value,
  slug,
  name,
  sub,
  subLabel,
}: {
  label: string;
  value: string;
  slug: string;
  name: (slug: string) => string;
  sub: string;
  subLabel?: string;
}) {
  return (
    <Link href={`/managers/${slug}`} className="block rounded-2xl border border-app bg-elev p-3 active:bg-elev-2 min-w-0">
      <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums text-accent leading-tight">{value}</p>
      <p className="truncate text-sm font-semibold">{name(slug)}</p>
      <p className="truncate text-xs text-muted">
        {subLabel && <span className="uppercase tracking-wider text-[10px] mr-1">{subLabel}</span>}
        {sub}
      </p>
    </Link>
  );
}

/* ---------- Records ---------- */

function Records({ games, name }: { games: StatGame[]; name: (slug: string) => string }) {
  const wins = games.filter((g) => g.result === "W");
  const losses = games.filter((g) => g.result === "L");
  const when = (g: StatGame) => `${g.year} · Wk ${g.week}${g.playoff ? " · Playoffs" : ""}`;
  const diff = (g: StatGame) => g.score - g.oppScore;

  const lists: { title: string; rows: StatGame[]; value: (g: StatGame) => string; sub: (g: StatGame) => string }[] = [
    {
      title: "HIGHEST SCORES",
      rows: [...games].sort((a, b) => b.score - a.score),
      value: (g) => g.score.toFixed(2),
      sub: (g) => `${when(g)} vs ${name(g.opp)}`,
    },
    {
      title: "BIGGEST BLOWOUTS",
      rows: [...wins].sort((a, b) => diff(b) - diff(a)),
      value: (g) => `+${diff(g).toFixed(1)}`,
      sub: (g) => `${g.score.toFixed(1)}–${g.oppScore.toFixed(1)} over ${name(g.opp)} · ${when(g)}`,
    },
    {
      title: "CLOSEST GAMES",
      rows: [...wins].sort((a, b) => diff(a) - diff(b)),
      value: (g) => `+${diff(g).toFixed(2)}`,
      sub: (g) => `${g.score.toFixed(1)}–${g.oppScore.toFixed(1)} over ${name(g.opp)} · ${when(g)}`,
    },
    {
      title: "MOST POINTS IN A LOSS",
      rows: [...losses].sort((a, b) => b.score - a.score),
      value: (g) => g.score.toFixed(2),
      sub: (g) => `lost to ${name(g.opp)} (${g.oppScore.toFixed(1)}) · ${when(g)}`,
    },
    {
      title: "FEWEST POINTS IN A WIN",
      rows: [...wins].sort((a, b) => a.score - b.score),
      value: (g) => g.score.toFixed(2),
      sub: (g) => `beat ${name(g.opp)} (${g.oppScore.toFixed(1)}) · ${when(g)}`,
    },
    {
      title: "LOWEST SCORES",
      rows: [...games].sort((a, b) => a.score - b.score),
      value: (g) => g.score.toFixed(2),
      sub: (g) => `${when(g)} vs ${name(g.opp)}`,
    },
  ];

  return (
    <div className="space-y-6">
      {lists.map((l) => (
        <section key={l.title}>
          <p className="text-[11px] font-bold tracking-widest text-accent mb-2">{l.title}</p>
          {l.rows.length === 0 ? (
            <div className="rounded-2xl border border-app bg-elev p-4 text-center text-muted text-sm">None yet.</div>
          ) : (
            <ul className="rounded-2xl border border-app bg-elev overflow-hidden">
              {l.rows.slice(0, 5).map((g, i) => (
                <li key={`${g.year}-${g.week}-${g.slug}`} className="border-b border-app last:border-0">
                  <Link
                    href={`/managers/${g.slug}`}
                    className="grid grid-cols-[28px_1fr_auto] items-center gap-2 px-3 py-3 active:bg-elev-2"
                  >
                    <span className={`text-sm font-bold ${i === 0 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold leading-tight">{name(g.slug)}</span>
                      <span className="block truncate text-xs text-muted">{l.sub(g)}</span>
                    </span>
                    <span className={`text-right text-sm font-semibold tabular-nums ${i === 0 ? "text-accent" : ""}`}>
                      {l.value(g)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/* ---------- Controls ---------- */

function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
        active ? "bg-accent text-[#0a0e1a] border-accent" : "border-app text-muted active:bg-elev-2"
      }`}
    >
      {label}
    </button>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex rounded-xl border border-app bg-elev p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 rounded-[10px] py-1.5 text-xs font-semibold transition-colors ${
            value === v ? "bg-elev-2 text-text" : "text-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
