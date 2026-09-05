"use client";

import { useEffect, useState } from "react";

/**
 * Client-only countdown to Week 1 kickoff. Renders a placeholder server-side
 * (so the static page hydrates without a flash) and then computes the live
 * day count once mounted.
 */
export default function SeasonCountdown({
  isoDate,
  label,
}: {
  isoDate: string;       // "YYYY-MM-DD"
  label: string;         // "Wednesday, September 9, 2026"
}) {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(`${isoDate}T00:00:00`).getTime();
    const tick = () => {
      const diffMs = target - Date.now();
      setDays(Math.max(0, Math.ceil(diffMs / 86_400_000)));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isoDate]);

  return (
    <div className="rounded-2xl border border-app bg-elev p-5 text-center">
      <p className="text-[11px] font-bold tracking-widest text-accent mb-2">
        🏈 WEEK 1 KICKOFF
      </p>
      <p className="text-lg font-extrabold mb-3 leading-tight">{label}</p>
      <div className="flex items-baseline justify-center gap-2">
        <span className="text-5xl font-extrabold text-accent tabular-nums">
          {days ?? "—"}
        </span>
        <span className="text-sm text-muted">
          {days === 1 ? "day to go" : "days to go"}
        </span>
      </div>
    </div>
  );
}
