"use client";

import Link from "next/link";
import { useState } from "react";
import type { DraftBoardData } from "@/lib/data";

const CELL_W = 88;   // px per manager column
const RD_W   = 28;   // px for round label column

function posColor(pos: string): string {
  switch ((pos || "").toUpperCase()) {
    case "QB":          return "bg-red-900/60 text-red-300";
    case "RB":          return "bg-green-900/60 text-green-300";
    case "WR":          return "bg-blue-900/60 text-blue-300";
    case "TE":          return "bg-orange-900/60 text-orange-300";
    case "K":           return "bg-purple-900/60 text-purple-300";
    case "D/ST":
    case "DST":         return "bg-yellow-900/60 text-yellow-300";
    default:            return "bg-zinc-800 text-muted";
  }
}

function posBgColor(pos: string): string {
  switch ((pos || "").toUpperCase()) {
    case "QB":  return "rgba(239,68,68,0.15)";
    case "RB":  return "rgba(34,197,94,0.15)";
    case "WR":  return "rgba(59,130,246,0.15)";
    case "TE":  return "rgba(249,115,22,0.15)";
    case "K":   return "rgba(168,85,247,0.15)";
    case "D/ST":
    case "DST": return "rgba(234,179,8,0.15)";
    default:    return "";
  }
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
        {[["QB","red"],["RB","green"],["WR","blue"],["TE","orange"],["K","purple"],["D/ST","yellow"]].map(([pos, _]) => (
          <span
            key={pos}
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${posColor(pos)}`}
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

                  {/* Pick cells — in slot order; visual arrow on even rounds */}
                  {board.slots.map((slot) => {
                    const pick = slot.picks.find((p) => p.round === round);
                    return (
                      <div
                        key={slot.slot}
                        style={{
                          width: CELL_W,
                          minWidth: CELL_W,
                          backgroundColor: pick ? posBgColor(pick.position) : "",
                        }}
                        className="border-l border-app px-1.5 py-1.5"
                      >
                        {pick ? (
                          <>
                            <div className="text-[11px] font-semibold leading-snug line-clamp-2">
                              {pick.player}
                            </div>
                            {pick.position && (
                              <span
                                className={`inline-block text-[9px] font-bold px-1 py-0.5 rounded mt-0.5 ${posColor(pick.position)}`}
                              >
                                {pick.position}
                              </span>
                            )}
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
