"use client";

import { useState } from "react";

export type PickData = {
  round: number;
  pick: number;
  player: string;
  position: string;
};

export type SeasonData = {
  year: number;
  team_name: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  finish: number | null;
  league_size: number;
};

type Props = {
  season: SeasonData;
  slug: string;
  finLabel: { text: string; color: string };
};

// Position badge colour
function posColor(pos: string): string {
  switch ((pos || "").toUpperCase()) {
    case "QB": return "text-red-400";
    case "RB": return "text-green-400";
    case "WR": return "text-blue-400";
    case "TE": return "text-orange-400";
    case "K":  return "text-purple-400";
    case "D/ST":
    case "DST": return "text-yellow-400";
    default:    return "text-muted";
  }
}

export function SeasonCard({ season: s, slug, finLabel: fin }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [picks, setPicks] = useState<PickData[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    // Lazy-load draft JSON only on first open
    if (!expanded && picks === null) {
      setLoading(true);
      try {
        const res = await fetch(`/data/drafts/${s.year}/${slug}.json`);
        if (res.ok) {
          setPicks(await res.json());
        } else {
          setPicks([]);
        }
      } catch {
        setPicks([]);
      }
      setLoading(false);
    }
    setExpanded((v) => !v);
  }

  return (
    <li className="rounded-xl border border-app bg-elev overflow-hidden">
      {/* Season header row — tappable */}
      <button
        onClick={toggle}
        className="w-full p-3 text-left active:opacity-70 transition-opacity"
        aria-expanded={expanded}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold leading-none">
                {s.year}
              </span>
              <span className="text-[10px] text-muted">
                {expanded ? "▲" : "▼"}
              </span>
            </div>
            <div className="text-xs text-muted mt-1 truncate max-w-[160px]">
              {s.team_name}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold tabular-nums">
              {s.wins}-{s.losses}
              {s.ties ? `-${s.ties}` : ""}
            </div>
            <div className={`text-[11px] font-bold ${fin.color}`}>
              {fin.text}
            </div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 text-xs text-muted">
          <span>PF {s.points_for.toFixed(1)}</span>
          <span className="text-right">PA {s.points_against.toFixed(1)}</span>
        </div>
      </button>

      {/* Draft picks panel */}
      {expanded && (
        <div className="border-t border-app px-3 pb-3 pt-2">
          <p className="text-[10px] font-bold tracking-widest text-accent mb-2">
            DRAFT PICKS
          </p>

          {loading ? (
            <p className="text-xs text-muted py-1">Loading…</p>
          ) : !picks || picks.length === 0 ? (
            <p className="text-xs text-muted py-1">No draft data available.</p>
          ) : (
            <div className="space-y-1.5">
              {picks.map((p) => (
                <div
                  key={`${p.round}-${p.pick}`}
                  className="flex items-center gap-2 text-sm"
                >
                  {/* Round.Pick badge */}
                  <span className="text-[10px] font-bold tabular-nums text-accent-dim bg-app rounded px-1.5 py-0.5 min-w-[2.8rem] text-center shrink-0">
                    {p.round}.{p.pick}
                  </span>

                  {/* Player name */}
                  <span className="font-medium flex-1 truncate">{p.player}</span>

                  {/* Position */}
                  {p.position && (
                    <span className={`text-[10px] font-bold shrink-0 ${posColor(p.position)}`}>
                      {p.position}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
