"use client";

import Link from "next/link";
import { useState } from "react";
import type { DraftBoardData } from "@/lib/data";

const CELL_W = 88;   // px per manager column
const RD_W   = 28;   // px for round label column

// Sleeper-style saturated cell colors. Dark navy text reads well on all of them.
function posBgColor(pos: string): string {
  switch ((pos || "").toUpperCase()) {
    case "QB":  return "#f4a4c4";  // pink
    case "RB":  return "#7ad6a3";  // green
    case "WR":  return "#5fb5d9";  // cyan
    case "TE":  return "#f7a76b";  // orange
    case "K":   return "#c8a0e8";  // purple
    case "D/ST":
    case "DST": return "#f5d76e";  // yellow
    default:    return "#dcdcdc";  // light gray
  }
}

// Legend pill colors (kept distinct so they still read on dark bg)
function posPillColor(pos: string): string {
  switch ((pos || "").toUpperCase()) {
    case "QB":          return "bg-pink-500/80 text-pink-50";
    case "RB":          return "bg-green-500/80 text-green-50";
    case "WR":          return "bg-sky-500/80 text-sky-50";
    case "TE":          return "bg-orange-500/80 text-orange-50";
    case "K":           return "bg-purple-500/80 text-purple-50";
    case "D/ST":
    case "DST":         return "bg-yellow-500/80 text-yellow-50";
    default:            return "bg-zinc-700 text-zinc-200";
  }
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first: "", last: full };
  return { first: parts[0], last: parts.slice(1).join(" ") };
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

export default function DraftBoardView({
  boardsByYear,
  years,
  defaultYear,
}: {
  boardsByYear: Record<number, DraftBoardData>;
  years: number[];
  defaultYear: number;
}) {
  const [year, setYear] = useState(defaultYear);
  const board = boardsByYear[year];

  const totalW = RD_W + CELL_W * (board?.slots.length ?? 0);

  return (
    <div className="pt-6 pb-4">
      {/* Header */}
      <div className="px-4 mb-4">
        <p className="text-[11px] font-bold tracking-widest text-accent">
          DRAFT BOARD
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">
          {year} Draft Results
        </h1>
        {board && (
          <p className="text-sm text-muted mt-0.5">
            {board.slots.length} managers · {board.rounds} rounds ·{" "}
            {board.slots.reduce((s, slot) => s + slot.picks.length, 0)} picks
          </p>
        )}
      </div>

      {/* Year pills */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 px-4">
        {years.map((yr) => (
          <Pill
            key={yr}
            active={yr === year}
            onClick={() => setYear(yr)}
            label={String(yr)}
          />
        ))}
      </div>

      {/* Position legend */}
      <div className="flex gap-2 flex-wrap px-4 mb-4">
        {["QB","RB","WR","TE","K","D/ST"].map((pos) => (
          <span
            key={pos}
            className="text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: posBgColor(pos), color: "#0f1729" }}
          >
            {pos}
          </span>
        ))}
      </div>

      {/* Grid — full-width horizontal scroll */}
      {board ? (
        <div className="overflow-x-auto">
          <div style={{ width: totalW, minWidth: totalW }}>

            {/* Column headers */}
            <div
              className="flex border-b-2 border-app sticky top-0 z-10 bg-bg"
              style={{ paddingLeft: RD_W }}
            >
              {board.slots.map((slot) => (
                <Link
                  key={slot.slot}
                  href={`/managers/${slot.owner_slug}`}
                  style={{ width: CELL_W, minWidth: CELL_W }}
                  className="border-l border-app px-1.5 py-2 active:opacity-70"
                >
                  <div className="text-[11px] font-bold leading-tight truncate">
                    {slot.owner.split(" ")[0]}
                  </div>
                  <div className="text-[10px] text-muted leading-tight truncate">
                    {slot.team_name}
                  </div>
                  <div className="text-[9px] text-accent font-bold mt-0.5">
                    #{slot.slot}
                  </div>
                </Link>
              ))}
            </div>

            {/* Rows — one per round */}
            {Array.from({ length: board.rounds }, (_, i) => i + 1).map((round) => {
              // Snake draft: even rounds are reversed
              const isEven = round % 2 === 0;
              return (
                <div
                  key={round}
                  className={`flex border-b border-app ${round % 2 === 0 ? "bg-elev" : ""}`}
                >
                  {/* Round label */}
                  <div
                    style={{ width: RD_W, minWidth: RD_W }}
                    className="flex items-center justify-center text-[10px] font-bold text-muted shrink-0 border-r border-app"
                  >
                    {round}
                  </div>

                  {/* Pick cells — Sleeper-style: saturated bg, first/last name split */}
                  {board.slots.map((slot) => {
                    const pick = slot.picks.find((p) => p.round === round);
                    const name = pick ? splitName(pick.player) : null;
                    // Snake draft: odd round = forward, even = reversed
                    const pickInRound = isEven
                      ? board.slots.length - slot.slot + 1
                      : slot.slot;
                    return (
                      <div
                        key={slot.slot}
                        style={{
                          width: CELL_W,
                          minWidth: CELL_W,
                          backgroundColor: pick ? posBgColor(pick.position) : "",
                          color: pick ? "#0f1729" : undefined,
                        }}
                        className="border-l border-app px-1.5 py-1 flex flex-col justify-between"
                      >
                        {pick && name ? (
                          <>
                            <div className="flex items-start justify-between leading-tight">
                              <span className="text-[9px] font-bold opacity-70">
                                {pick.position}
                              </span>
                              <span className="text-[10px] font-bold tabular-nums opacity-80">
                                {round}.{pickInRound}
                              </span>
                            </div>
                            <div className="leading-[1.05]">
                              {name.first && (
                                <div className="text-[10px] font-medium truncate">
                                  {name.first}
                                </div>
                              )}
                              <div className="text-[12px] font-extrabold truncate">
                                {name.last}
                              </div>
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mx-4 rounded-2xl border border-app bg-elev p-6 text-center text-sm text-muted">
          No draft data for {year}.
        </div>
      )}
    </div>
  );
}
