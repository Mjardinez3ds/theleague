"use client";

import Link from "next/link";
import { useState } from "react";
import { TradesData } from "@/lib/data";

export default function TradesView({
  tradesMap,
  years,
  currentYear,
}: {
  tradesMap: Record<number, TradesData>;
  years: number[];
  currentYear: number;
}) {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const data = tradesMap[selectedYear];

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-5">
        <p className="text-[11px] font-bold tracking-widest text-accent">
          TRADE HISTORY
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">Trades</h1>
        <p className="text-sm text-muted">Every deal, every season.</p>
      </header>

      {/* Year selector */}
      <div className="flex gap-2 mb-5">
        {[...years].reverse().map((yr) => (
          <button
            key={yr}
            onClick={() => setSelectedYear(yr)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
              yr === selectedYear
                ? "bg-accent text-[#0a0e1a] border-accent"
                : "border-app text-muted active:bg-elev-2"
            }`}
          >
            {yr}
          </button>
        ))}
      </div>

      {/* Trade count */}
      {data && data.count > 0 && (
        <p className="text-xs text-muted mb-3">
          {data.count} trade{data.count !== 1 ? "s" : ""} this season
        </p>
      )}

      {/* Trade list */}
      {!data || data.trades.length === 0 ? (
        <div className="rounded-2xl border border-app bg-elev p-6 text-center text-muted text-sm">
          No trades recorded for {selectedYear}.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.trades.map((trade, i) => (
            <li key={i} className="rounded-2xl border border-app bg-elev p-4">
              <div className="text-xs text-muted mb-3 tabular-nums">{trade.date}</div>
              <div className="grid grid-cols-2 gap-2">
                {trade.sides.map((side, j) => (
                  <div key={j} className="rounded-xl bg-elev-2 p-3 min-w-0">
                    <Link
                      href={`/managers/${side.owner_slug}`}
                      className="text-sm font-bold text-accent block mb-2 truncate active:opacity-70"
                    >
                      {side.owner}
                    </Link>
                    <p className="text-[10px] font-bold tracking-widest text-muted mb-1">GAVE</p>
                    <ul className="mb-2 space-y-0.5">
                      {side.gave.map((p, k) => (
                        <li key={k} className="text-xs truncate">{p}</li>
                      ))}
                    </ul>
                    <p className="text-[10px] font-bold tracking-widest text-muted mb-1">GOT</p>
                    <ul className="space-y-0.5">
                      {side.got.map((p, k) => (
                        <li key={k} className="text-xs truncate">{p}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
