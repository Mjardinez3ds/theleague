"use client";

import Link from "next/link";
import { useState } from "react";
import type { H2HRecord } from "@/lib/data";

export default function H2HTable({ records }: { records: H2HRecord[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-1 mt-6 mb-2 active:opacity-70"
      >
        <p className="text-[11px] font-bold tracking-widest text-accent">
          HEAD-TO-HEAD
        </p>
        <span className="text-muted text-sm">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="rounded-2xl border border-app bg-elev overflow-hidden">
          <div className="grid grid-cols-[1fr_72px_44px] items-center px-3 py-2 text-[10px] font-semibold tracking-wider text-muted uppercase border-b border-app">
            <div>Opponent</div>
            <div className="text-center">Record</div>
            <div className="text-right">Win%</div>
          </div>
          <ul>
            {records.map((r) => {
              const games = r.wins + r.losses + r.ties;
              const winPct = games
                ? ((r.wins + r.ties * 0.5) / games) * 100
                : 0;
              const isWinning = r.wins > r.losses;
              const isLosing = r.losses > r.wins;
              return (
                <li
                  key={r.opponent_slug}
                  className="grid grid-cols-[1fr_72px_44px] items-center px-3 py-3 border-b border-app last:border-0"
                >
                  <Link
                    href={`/managers/${r.opponent_slug}`}
                    className="min-w-0 pr-2 active:opacity-70"
                  >
                    <div className="text-sm font-semibold truncate">
                      {r.opponent.split(" ")[0]}
                    </div>
                    <div className="text-xs text-muted truncate">{r.opponent}</div>
                  </Link>
                  <div className="text-center">
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        isWinning
                          ? "text-green-400"
                          : isLosing
                          ? "text-red-400"
                          : "text-muted"
                      }`}
                    >
                      {r.wins}-{r.losses}
                      {r.ties ? `-${r.ties}` : ""}
                    </span>
                  </div>
                  <div className="text-right text-sm tabular-nums text-muted">
                    {winPct.toFixed(0)}%
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
