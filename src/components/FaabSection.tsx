"use client";

import { useState } from "react";
import type { FaabOwner } from "@/lib/data";

export default function FaabSection({ data }: { data: FaabOwner }) {
  const [open, setOpen] = useState(false);
  const t = data.totals;

  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-1 mt-6 mb-2 active:opacity-70"
      >
        <p className="text-[11px] font-bold tracking-widest text-accent">
          FAAB / WAIVERS
        </p>
        <span className="text-muted text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          {/* Career totals card */}
          <div className="rounded-2xl border border-app bg-elev p-4 mb-3">
            <div className="grid grid-cols-3 gap-y-3 gap-x-2">
              <Stat
                label="Acquisitions"
                value={t.acquisitions.toLocaleString()}
              />
              <Stat
                label="$ Spent"
                value={`$${t.spent.toLocaleString()}`}
              />
              <Stat
                label="Seasons"
                value={String(data.by_year.length)}
              />
            </div>

            {t.biggest_bid && (
              <div className="mt-4 pt-3 border-t border-app">
                <p className="text-[10px] tracking-wider text-muted uppercase mb-1">
                  Biggest Bid
                </p>
                <p className="text-base font-bold leading-tight">
                  ${t.biggest_bid.bid}{" "}
                  <span className="text-accent">{t.biggest_bid.player}</span>
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {t.biggest_bid.year} · Week {t.biggest_bid.week}
                  {t.biggest_bid.dropped && (
                    <> · dropped {t.biggest_bid.dropped}</>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* By-year breakdown */}
          <div className="rounded-2xl border border-app bg-elev overflow-hidden">
            <div className="grid grid-cols-[44px_1fr_56px_56px] items-center gap-2 px-3 py-2 text-[10px] font-semibold tracking-wider text-muted uppercase border-b border-app">
              <div>Year</div>
              <div>Team</div>
              <div className="text-right">Acq</div>
              <div className="text-right">Spent</div>
            </div>
            <ul>
              {data.by_year.map((y) => (
                <li
                  key={y.year}
                  className="grid grid-cols-[44px_1fr_56px_56px] items-center gap-2 px-3 py-2.5 border-b border-app last:border-0"
                >
                  <span className="text-sm font-bold tabular-nums">{y.year}</span>
                  <span className="text-xs truncate text-muted">{y.team_name}</span>
                  <span className="text-right text-sm tabular-nums">
                    {y.acquisitions}
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums">
                    ${y.spent}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
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
