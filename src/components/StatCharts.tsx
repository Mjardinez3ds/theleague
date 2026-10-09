"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { StatGame } from "./StatsView";

/*
 * Charts tab for /stats. Pure SVG, no chart library. Every chart is drawn in
 * a 400-unit-wide viewBox so text stays ~1:1 on a phone. Tapping (or hovering)
 * a mark fills the readout line under the chart instead of a floating
 * tooltip, which is easier to hit and read on a touch screen.
 */

const W = 400;
const LAB_W = 76; // left column for manager names

type Team = {
  slug: string;
  games: number;
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
  xw: number;
  apw: number;
  apl: number;
  hi: number;
  lo: number;
};

const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);
const signed = (n: number, d = 2) => `${n > 0.005 ? "+" : ""}${n.toFixed(d)}`;
const rec = (t: Team) => `${t.w}-${t.l}${t.t ? `-${t.t}` : ""}`;

function computeTeams(games: StatGame[]): Team[] {
  const byWeek = new Map<string, number[]>();
  for (const g of games) {
    const k = `${g.year}-${g.week}`;
    byWeek.set(k, [...(byWeek.get(k) ?? []), g.score]);
  }
  const acc = new Map<string, Team>();
  for (const g of games) {
    const a =
      acc.get(g.slug) ??
      { slug: g.slug, games: 0, w: 0, l: 0, t: 0, pf: 0, pa: 0, xw: 0, apw: 0, apl: 0, hi: -Infinity, lo: Infinity };
    a.games++;
    a.pf += g.score;
    a.pa += g.oppScore;
    a.hi = Math.max(a.hi, g.score);
    a.lo = Math.min(a.lo, g.score);
    if (g.result === "W") a.w++;
    else if (g.result === "L") a.l++;
    else a.t++;
    const field = byWeek.get(`${g.year}-${g.week}`) ?? [];
    const beat = field.filter((p) => p < g.score).length;
    a.apw += beat;
    a.apl += field.filter((p) => p > g.score).length;
    if (field.length > 1) a.xw += beat / (field.length - 1);
    acc.set(g.slug, a);
  }
  return [...acc.values()];
}

/** First names, extended with just enough of the last name to stay unique. */
function shortNames(slugs: string[], names: Record<string, string>): Record<string, string> {
  const parts = Object.fromEntries(slugs.map((s) => [s, (names[s] ?? s).trim().split(/\s+/)]));
  const out: Record<string, string> = {};
  for (const s of slugs) {
    const [first, ...rest] = parts[s];
    const last = rest.join(" ");
    const clash = slugs.filter((o) => o !== s && parts[o][0].toLowerCase() === first.toLowerCase());
    if (!clash.length || !last) {
      out[s] = first;
      continue;
    }
    let n = 1;
    while (
      n < last.length &&
      clash.some((o) => parts[o].slice(1).join(" ").toLowerCase().startsWith(last.slice(0, n).toLowerCase()))
    )
      n++;
    out[s] = `${first} ${last.slice(0, n)}`;
  }
  return out;
}

export default function StatCharts({
  games,
  names,
  singleSeason,
}: {
  games: StatGame[];
  names: Record<string, string>;
  singleSeason: boolean;
}) {
  const teams = useMemo(() => computeTeams(games), [games]);
  // Same sample rule as Leaders: at least half the max games in the filter.
  const maxGames = Math.max(...teams.map((t) => t.games));
  const qualified = teams.filter((t) => t.games >= Math.max(1, Math.ceil(maxGames / 2)));
  const short = useMemo(
    () => shortNames(teams.map((t) => t.slug), names),
    [teams, names]
  );
  const nm = (s: string) => short[s] ?? s;
  const perGame = !singleSeason;

  return (
    <div className="space-y-4">
      <ChartCard
        title="SCHEDULE LUCK"
        blurb="Actual wins minus expected wins. Expected wins come from the all-play record: how many teams you'd have beaten each week if you played everyone."
      >
        <LuckChart teams={qualified} nm={nm} />
      </ChartCard>

      <ChartCard
        title={perGame ? "POINTS FOR VS AGAINST (PER GAME)" : "POINTS FOR VS AGAINST"}
        blurb="Points scored against points allowed. The dashed lines are the league average."
      >
        <QuadrantChart teams={qualified} nm={nm} perGame={perGame} />
      </ChartCard>

      <ChartCard title="WEEKLY HEATMAP" blurb="Every score, each week. Brighter means a bigger week. Sorted by points per game.">
        {singleSeason ? (
          <Heatmap games={games} nm={nm} />
        ) : (
          <p className="text-sm text-muted">Pick a single season above to see its weekly heatmap.</p>
        )}
      </ChartCard>

      <ChartCard title="NAIL-BITERS & BLOWOUTS" blurb="The closest and most lopsided games in this view. Bar length is the margin of victory.">
        <MarginChart games={games} nm={nm} />
      </ChartCard>

      <ChartCard
        title="BOOM OR BUST"
        blurb="Each line runs from a manager's worst week to their best. The dot is their average. Shorter lines mean steadier teams."
      >
        <RangeChart teams={qualified} nm={nm} />
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, blurb, children }: { title: string; blurb: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-app bg-elev p-4 min-w-0">
      <p className="text-[11px] font-bold tracking-widest text-accent">{title}</p>
      <p className="text-xs text-muted mt-1 mb-3 leading-snug">{blurb}</p>
      {children}
    </section>
  );
}

/** Tap/hover target wrapper: a full-size invisible hit area plus the readout hook. */
function useReadout() {
  const [sel, setSel] = useState<string | null>(null);
  const bind = (key: string) => ({
    onPointerEnter: () => setSel(key),
    onPointerDown: () => setSel(key),
    onFocus: () => setSel(key),
    tabIndex: 0,
    style: { cursor: "pointer", outline: "none" },
  });
  return { sel, bind };
}

function Readout({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 min-h-[2.5rem] rounded-xl bg-elev-2 px-3 py-2 text-xs leading-snug tabular-nums">
      {children ?? <span className="text-muted">Tap a bar or dot for details.</span>}
    </p>
  );
}

/* ---------- Schedule luck: diverging bars ---------- */

function LuckChart({ teams, nm }: { teams: Team[]; nm: (s: string) => string }) {
  const { sel, bind } = useReadout();
  const rows = [...teams].map((t) => ({ ...t, luck: t.w - t.xw })).sort((a, b) => b.luck - a.luck);
  const rowH = 26;
  const valW = 46;
  const mid = (LAB_W + W - valW) / 2;
  const half = (W - valW - LAB_W) / 2 - 2;
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.luck)));
  const H = rows.length * rowH;
  const cur = rows.find((r) => r.slug === sel);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="Schedule luck by manager">
        <line x1={mid} x2={mid} y1={0} y2={H} stroke="var(--border)" />
        {rows.map((r, i) => {
          const cy = i * rowH + rowH / 2;
          const w = Math.max(2, (Math.abs(r.luck) / maxAbs) * half);
          const flat = Math.abs(r.luck) < 0.005;
          const fill = flat ? "var(--text-muted)" : r.luck > 0 ? "var(--green)" : "var(--red)";
          return (
            <g key={r.slug} {...bind(r.slug)}>
              <rect x={0} y={cy - rowH / 2} width={W} height={rowH} fill={sel === r.slug ? "var(--bg-elev-2)" : "transparent"} rx={6} />
              <text x={4} y={cy + 4} fontSize={12.5} fill="var(--text)">{nm(r.slug)}</text>
              <rect x={r.luck >= 0 ? mid : mid - w} y={cy - 7} width={w} height={14} rx={4} fill={fill} />
              <text x={W - 4} y={cy + 4} fontSize={12} textAnchor="end" fill="var(--text-muted)">{signed(r.luck)}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--green)" }} />Lucky</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--red)" }} />Unlucky</span>
      </div>
      <Readout>
        {cur && (
          <>
            <b className="text-accent">{nm(cur.slug)}</b> · {rec(cur)} record · {cur.apw}-{cur.apl} all-play ·{" "}
            {f2(cur.xw)} expected wins · luck {signed(cur.luck)}
          </>
        )}
      </Readout>
    </>
  );
}

/* ---------- PF vs PA quadrant scatter ---------- */

function QuadrantChart({ teams, nm, perGame }: { teams: Team[]; nm: (s: string) => string; perGame: boolean }) {
  const { sel, bind } = useReadout();
  const pts = teams.map((t) => ({
    ...t,
    x: perGame ? t.pf / t.games : t.pf,
    y: perGame ? t.pa / t.games : t.pa,
  }));
  const H = 340;
  const L = 40, R = 12, T = 12, B = 34;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
  const step = niceStep(span / 4);
  const pad = span * 0.08;
  const x0 = Math.floor((Math.min(...xs) - pad) / step) * step, x1 = Math.ceil((Math.max(...xs) + pad) / step) * step;
  const y0 = Math.floor((Math.min(...ys) - pad) / step) * step, y1 = Math.ceil((Math.max(...ys) + pad) / step) * step;
  const sx = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
  const sy = (v: number) => H - B - ((v - y0) / (y1 - y0)) * (H - B - T);
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
  const ticksX = range(x0, x1, step), ticksY = range(y0, y1, step);
  const labels = placeLabels(pts.map((p) => ({ key: p.slug, cx: sx(p.x), cy: sy(p.y), text: nm(p.slug) })), {
    x0: L, x1: W - R, y0: T, y1: H - B,
  });
  const cur = pts.find((p) => p.slug === sel);
  const q = (x: number, y: number, t: string, a: "start" | "end") => (
    <text x={x} y={y} fontSize={10} fontWeight={700} letterSpacing={1} textAnchor={a} fill="var(--accent)" opacity={0.7}>{t}</text>
  );

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="Points for versus points against">
        {ticksX.map((v) => (
          <g key={`x${v}`}>
            <line x1={sx(v)} x2={sx(v)} y1={T} y2={H - B} stroke="var(--border)" strokeWidth={0.6} />
            <text x={sx(v)} y={H - B + 15} fontSize={10.5} textAnchor="middle" fill="var(--text-muted)">{v}</text>
          </g>
        ))}
        {ticksY.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeWidth={0.6} />
            <text x={L - 6} y={sy(v) + 3.5} fontSize={10.5} textAnchor="end" fill="var(--text-muted)">{v}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--text-muted)">Points scored →</text>
        <text transform={`translate(10 ${(T + H - B) / 2}) rotate(-90)`} fontSize={11} textAnchor="middle" fill="var(--text-muted)">Points allowed →</text>
        <line x1={sx(avg)} x2={sx(avg)} y1={T} y2={H - B} stroke="var(--text-muted)" strokeDasharray="3 4" />
        <line x1={L} x2={W - R} y1={sy(avg)} y2={sy(avg)} stroke="var(--text-muted)" strokeDasharray="3 4" />
        {q(W - R - 4, H - B - 6, "DOMINANT", "end")}
        {q(W - R - 4, T + 12, "SNAKEBIT", "end")}
        {q(L + 4, H - B - 6, "GETTING AWAY WITH IT", "start")}
        {q(L + 4, T + 12, "ROUGH START", "start")}
        {pts.map((p) => {
          const lb = labels[p.slug];
          const on = sel === p.slug;
          return (
            <g key={p.slug} {...bind(p.slug)}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={14} fill="transparent" />
              <circle cx={sx(p.x)} cy={sy(p.y)} r={on ? 7 : 5} fill="var(--accent)" stroke={on ? "var(--text)" : "var(--bg-elev)"} strokeWidth={2} />
              <text x={lb.x} y={lb.y} fontSize={11.5} textAnchor={lb.anchor} fill="var(--text)">{nm(p.slug)}</text>
            </g>
          );
        })}
      </svg>
      <Readout>
        {cur && (
          <>
            <b className="text-accent">{nm(cur.slug)}</b> · {rec(cur)} · scored {f1(cur.x)} · allowed {f1(cur.y)}
            {perGame ? " per game" : ""} · diff {signed(cur.x - cur.y, 1)}
          </>
        )}
      </Readout>
    </>
  );
}

/* ---------- Weekly heatmap (single season only) ---------- */

function Heatmap({ games, nm }: { games: StatGame[]; nm: (s: string) => string }) {
  const { sel, bind } = useReadout();
  const weeks = [...new Set(games.map((g) => g.week))].sort((a, b) => a - b);
  const bySlug = new Map<string, Map<number, StatGame>>();
  for (const g of games) {
    if (!bySlug.has(g.slug)) bySlug.set(g.slug, new Map());
    bySlug.get(g.slug)!.set(g.week, g);
  }
  const rows = [...bySlug.entries()]
    .map(([slug, m]) => {
      const sc = [...m.values()].map((g) => g.score);
      return { slug, m, ppg: sc.reduce((a, b) => a + b, 0) / sc.length };
    })
    .sort((a, b) => b.ppg - a.ppg);
  const all = games.map((g) => g.score);
  const mn = Math.min(...all), mx = Math.max(...all);
  const c0 = [0x1d, 0x23, 0x33], c1 = [0xff, 0xc4, 0x00];
  const color = (v: number) => {
    const t = mx === mn ? 1 : (v - mn) / (mx - mn);
    return { fill: `rgb(${c0.map((c, i) => Math.round(c + (c1[i] - c) * t)).join(",")})`, t };
  };
  const ppgW = 44, gap = 2, rowH = 28, headH = 20;
  const cellW = (W - LAB_W - ppgW - gap * weeks.length) / weeks.length;
  const showNums = cellW >= 34;
  const H = headH + rows.length * rowH;
  const [cs, cw] = sel ? sel.split("|") : [];
  const cur = cs ? bySlug.get(cs)?.get(Number(cw)) : undefined;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="Weekly score heatmap">
        {weeks.map((w, j) => (
          <text key={w} x={LAB_W + j * (cellW + gap) + cellW / 2} y={13} fontSize={showNums ? 11 : 9} fontWeight={700} textAnchor="middle" fill="var(--text-muted)">
            {showNums ? `WK ${w}` : w}
          </text>
        ))}
        <text x={W} y={13} fontSize={11} fontWeight={700} textAnchor="end" fill="var(--text-muted)">PPG</text>
        {rows.map((r, i) => {
          const y = headH + i * rowH;
          return (
            <g key={r.slug}>
              <text x={0} y={y + rowH / 2 + 4} fontSize={12.5} fill="var(--text)">{nm(r.slug)}</text>
              {weeks.map((w, j) => {
                const g = r.m.get(w);
                if (!g) return null;
                const { fill, t } = color(g.score);
                const x = LAB_W + j * (cellW + gap);
                const key = `${r.slug}|${w}`;
                return (
                  <g key={w} {...bind(key)}>
                    <rect x={x} y={y + 1} width={cellW} height={rowH - 2} rx={4} fill={fill} stroke={sel === key ? "var(--text)" : "none"} strokeWidth={1.5} />
                    {showNums && (
                      <text x={x + cellW / 2} y={y + rowH / 2 + 4} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={t > 0.55 ? "#0a0e1a" : "var(--text)"}>
                        {f1(g.score)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={W} y={y + rowH / 2 + 4} fontSize={12.5} fontWeight={700} textAnchor="end" fill="var(--text)">{f1(r.ppg)}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
        <span>{f1(mn)}</span>
        <i className="inline-block h-2.5 w-16 rounded-sm" style={{ background: "linear-gradient(90deg, #1d2333, #ffc400)" }} />
        <span>{f1(mx)}</span>
      </div>
      <Readout>
        {cur && (
          <>
            <b className="text-accent">{nm(cur.slug)}</b> · Week {cur.week}
            {cur.playoff ? " (playoffs)" : ""} · {f2(cur.score)} vs {nm(cur.opp)} {f2(cur.oppScore)} ·{" "}
            {cur.result === "W" ? "Win" : cur.result === "L" ? "Loss" : "Tie"}
          </>
        )}
      </Readout>
    </>
  );
}

/* ---------- Margins: closest + biggest ---------- */

function MarginChart({ games, nm }: { games: StatGame[]; nm: (s: string) => string }) {
  const { sel, bind } = useReadout();
  const multiYear = new Set(games.map((g) => g.year)).size > 1;
  // One row per game, from the winner's side. Ties are skipped.
  const wins = games
    .filter((g) => g.result === "W")
    .map((g) => ({ ...g, m: g.score - g.oppScore, key: `${g.year}-${g.week}-${g.slug}` }))
    .sort((a, b) => a.m - b.m);
  const N = 6;
  const rows =
    wins.length <= N * 2
      ? wins.map((g) => ({ g, gapBefore: false }))
      : [
          ...wins.slice(0, N).map((g) => ({ g, gapBefore: false })),
          ...wins.slice(-N).map((g, i) => ({ g, gapBefore: i === 0 })),
        ];
  const mx = Math.max(1, ...rows.map((r) => r.g.m));
  const rowH = 38, gapH = 22, valW = 50;
  let y = 0;
  const laid = rows.map((r) => {
    if (r.gapBefore) y += gapH;
    const out = { ...r, y };
    y += rowH;
    return out;
  });
  const H = y;
  const cur = wins.find((g) => g.key === sel);
  const when = (g: StatGame) => `${multiYear ? `${g.year} ` : ""}Wk ${g.week}`;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="Closest and most lopsided games">
        {laid.map(({ g, y, gapBefore }, i) => {
          const hl = i === 0 || i === laid.length - 1;
          const w = Math.max(3, (g.m / mx) * (W - valW - 8));
          return (
            <g key={g.key}>
              {gapBefore && (
                <text x={W / 2} y={y - 8} fontSize={10} fontWeight={700} letterSpacing={1.5} textAnchor="middle" fill="var(--text-muted)">
                  · · ·  BIGGEST BLOWOUTS  · · ·
                </text>
              )}
              <g {...bind(g.key)}>
                <rect x={0} y={y} width={W} height={rowH} fill={sel === g.key ? "var(--bg-elev-2)" : "transparent"} rx={6} />
                <text x={4} y={y + 14} fontSize={12} fill="var(--text)">
                  <tspan fontWeight={700}>{nm(g.slug)}</tspan>
                  <tspan fill="var(--text-muted)"> def. </tspan>
                  {nm(g.opp)}
                  <tspan fill="var(--text-muted)"> · {when(g)}{g.playoff ? " · PO" : ""}</tspan>
                </text>
                <rect x={4} y={y + 21} width={w} height={10} rx={4} fill={hl ? "var(--accent)" : "var(--text-muted)"} opacity={hl ? 1 : 0.55} />
                <text x={W - 4} y={y + 30} fontSize={12} fontWeight={600} textAnchor="end" fill={hl ? "var(--accent)" : "var(--text-muted)"}>
                  +{f1(g.m)}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      <Readout>
        {cur && (
          <>
            <b className="text-accent">{when(cur)}</b> · {nm(cur.slug)} {f2(cur.score)} – {nm(cur.opp)} {f2(cur.oppScore)} · margin{" "}
            {f2(cur.m)}
          </>
        )}
      </Readout>
    </>
  );
}

/* ---------- Boom or bust: range strips ---------- */

function RangeChart({ teams, nm }: { teams: Team[]; nm: (s: string) => string }) {
  const { sel, bind } = useReadout();
  const rows = [...teams].sort((a, b) => a.hi - a.lo - (b.hi - b.lo));
  const rowH = 26, axisH = 22, R = 10;
  const x0 = Math.floor((Math.min(...rows.map((r) => r.lo)) - 5) / 25) * 25;
  const x1 = Math.ceil((Math.max(...rows.map((r) => r.hi)) + 5) / 25) * 25;
  const sx = (v: number) => LAB_W + ((v - x0) / (x1 - x0)) * (W - LAB_W - R);
  const H = rows.length * rowH + axisH;
  const ticks = range(x0, x1, 25);
  const labelEvery = ticks.length > 9 ? 100 : 50;
  const cur = rows.find((r) => r.slug === sel);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="Scoring range by manager">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={sx(v)} x2={sx(v)} y1={0} y2={H - axisH} stroke="var(--border)" strokeWidth={0.6} />
            {v % labelEvery === 0 && (
              <text x={sx(v)} y={H - 6} fontSize={10.5} textAnchor="middle" fill="var(--text-muted)">{v}</text>
            )}
          </g>
        ))}
        {rows.map((r, i) => {
          const cy = i * rowH + rowH / 2;
          const on = sel === r.slug;
          return (
            <g key={r.slug} {...bind(r.slug)}>
              <rect x={0} y={cy - rowH / 2} width={W} height={rowH} fill={on ? "var(--bg-elev-2)" : "transparent"} rx={6} />
              <text x={4} y={cy + 4} fontSize={12.5} fill="var(--text)">{nm(r.slug)}</text>
              <line x1={sx(r.lo)} x2={sx(r.hi)} y1={cy} y2={cy} stroke="var(--text-muted)" strokeOpacity={0.6} strokeWidth={4} strokeLinecap="round" />
              <circle cx={sx(r.pf / r.games)} cy={cy} r={5} fill="var(--accent)" stroke="var(--bg-elev)" strokeWidth={2} />
            </g>
          );
        })}
      </svg>
      <Readout>
        {cur && (
          <>
            <b className="text-accent">{nm(cur.slug)}</b> · best {f2(cur.hi)} · worst {f2(cur.lo)} · avg {f2(cur.pf / cur.games)} · swing{" "}
            {f1(cur.hi - cur.lo)}
          </>
        )}
      </Readout>
    </>
  );
}

/* ---------- helpers ---------- */

function range(a: number, b: number, step: number) {
  const out: number[] = [];
  for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3.5 ? 2.5 : n < 7.5 ? 5 : 10) * pow;
}

type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * Greedy label placement for the scatter: try right, left, above, below for
 * each dot and keep the first spot that doesn't hit another dot or label.
 */
function placeLabels(
  pts: { key: string; cx: number; cy: number; text: string }[],
  bounds: Box
): Record<string, { x: number; y: number; anchor: "start" | "end" | "middle" }> {
  const charW = 6.4, h = 12, r = 6;
  const taken: Box[] = pts.map((p) => ({ x0: p.cx - r, y0: p.cy - r, x1: p.cx + r, y1: p.cy + r }));
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const out: Record<string, { x: number; y: number; anchor: "start" | "end" | "middle" }> = {};
  // Place the most crowded points first so they get the best spots.
  const order = [...pts].sort(
    (a, b) =>
      pts.filter((o) => Math.hypot(o.cx - b.cx, o.cy - b.cy) < 40).length -
      pts.filter((o) => Math.hypot(o.cx - a.cx, o.cy - a.cy) < 40).length
  );
  for (const p of order) {
    const w = p.text.length * charW;
    const cands: { x: number; y: number; anchor: "start" | "end" | "middle"; box: Box }[] = [
      { x: p.cx + 9, y: p.cy + 4, anchor: "start", box: { x0: p.cx + 8, y0: p.cy - h / 2, x1: p.cx + 9 + w, y1: p.cy + h / 2 } },
      { x: p.cx - 9, y: p.cy + 4, anchor: "end", box: { x0: p.cx - 9 - w, y0: p.cy - h / 2, x1: p.cx - 8, y1: p.cy + h / 2 } },
      { x: p.cx, y: p.cy - 10, anchor: "middle", box: { x0: p.cx - w / 2, y0: p.cy - 10 - h + 2, x1: p.cx + w / 2, y1: p.cy - 8 } },
      { x: p.cx, y: p.cy + 19, anchor: "middle", box: { x0: p.cx - w / 2, y0: p.cy + 8, x1: p.cx + w / 2, y1: p.cy + 21 } },
    ];
    const inBounds = (b: Box) => b.x0 >= bounds.x0 && b.x1 <= bounds.x1 + 8 && b.y0 >= bounds.y0 - 8 && b.y1 <= bounds.y1 + 8;
    const pick =
      cands.find((c) => inBounds(c.box) && !taken.some((t) => hit(t, c.box))) ??
      cands.find((c) => inBounds(c.box)) ??
      cands[0];
    taken.push(pick.box);
    out[p.key] = { x: pick.x, y: pick.y, anchor: pick.anchor };
  }
  return out;
}
