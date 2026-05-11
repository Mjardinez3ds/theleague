"use client";

import Link from "next/link";
import { useState } from "react";
import type { Career, Standings } from "@/lib/data";

type SelectedView = "all-time" | number;

export default function StandingsView({
  careers,
  standingsByYear,
  years,
  defaultYear,
}: {
  careers: Career[];
  standingsByYear: Record<number, Standings>;
  years: number[];
  defaultYear: number;
}) {
  const [view, setView] = useState<SelectedView>("all-time");

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-4">
        <p className="text-[11px] font-bold tracking-widest text-accent">
          STANDINGS
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">
          {view === "all-time" ? "All-Time Records" : `${view} Season`}
        </h1>
        <p className="text-sm text-muted">
          {view === "all-time"
            ? "Combined wins, losses, and points across every season."
            : standingsByYear[view]?.league_name ?? ""}
        </p>
      </header>

      {/* Year selector pills */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        <Pill
          active={view === "all-time"}
          onClick={() => setView("all-time")}
          label="All-Time"
        />
        {[...years].sort((a, b) => b - a).map((yr) => (
          <Pill
            key={yr}
            active={view === yr}
            onClick={() => setView(yr)}
            label={String(yr)}
          />
        ))}
      </div>

      {view === "all-time" ? (
        <AllTimeTable careers={careers} />
      ) : (
        <YearTable standings={standingsByYear[view]} />
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
        active
          ? "bg-accent text-[#0a0e1a] border-accent"
          : "border-app text-muted active:bg-elev-2"
      }`}
    >
      {label}
    </button>
  );
}

/* ---------- All-Time ---------- */

function AllTimeTable({ careers }: { careers: Career[] }) {
  // careers is already sorted by win_pct desc in build_data.py
  return (
    <section className="rounded-2xl border border-app bg-elev overflow-hidden">
      <div className="grid grid-cols-[28px_1fr_56px_46px_56px_56px] items-center px-3 py-2 text-[10px] font-semibold tracking-wider text-muted uppercase border-b border-app">
        <div>#</div>
        <div>Owner</div>
        <div className="text-right">W-L</div>
        <div className="text-right">Win%</div>
        <div className="text-right">PF</div>
        <div className="text-right">PA</div>
      </div>
      <ul>
        {careers.map((o, i) => {
          const rank = i + 1;
          const trophyColor =
            rank === 1
              ? "text-yellow-400"
              : rank === 2
              ? "text-zinc-300"
              : rank === 3
              ? "text-amber-700"
              : "text-muted";
          return (
            <li
              key={o.slug}
              className="grid grid-cols-[28px_1fr_56px_46px_56px_56px] items-center px-3 py-3 border-b border-app last:border-0 active:bg-elev-2"
            >
              <span className={`text-sm font-bold ${trophyColor}`}>
                {rank}
              </span>
              <Link href={`/managers/${o.slug}`} className="min-w-0 pr-2">
                <div className="truncate text-[15px] font-semibold leading-tight">
                  {o.owner}
                </div>
                <div className="truncate text-xs text-muted">
                  {o.titles > 0 && (
                    <>
                      <span className="text-yellow-400">★</span>
                      {o.titles}{o.titles > 1 ? " titles" : " title"} ·{" "}
                    </>
                  )}
                  {o.games} games
                </div>
              </Link>
              <span className="text-right text-sm font-semibold tabular-nums">
                {o.wins}-{o.losses}
                {o.ties ? `-${o.ties}` : ""}
              </span>
              <span className="text-right text-sm font-semibold tabular-nums text-accent">
                {o.win_pct.toFixed(1)}
              </span>
              <span className="text-right text-sm tabular-nums">
                {o.points_for.toFixed(0)}
              </span>
              <span className="text-right text-sm text-muted tabular-nums">
                {o.points_against.toFixed(0)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- Single-Year ---------- */

function YearTable({ standings }: { standings: Standings | undefined }) {
  if (!standings) {
    return (
      <div className="rounded-2xl border border-app bg-elev p-6 text-center text-muted text-sm">
        No data for this season.
      </div>
    );
  }

  return (
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
                <div className="truncate text-xs text-muted">{t.owner}</div>
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
  );
}
