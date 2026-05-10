"use client";

import { useEffect, useState } from "react";

/**
 * Sleeper-styled countdown card. Same logic as DraftCountdown but with
 * different visual treatment: dark elevated card, big neon-purple number,
 * subtle ring, lots of contrast.
 */
export default function SleeperCountdown({
  isoDate,
  label,
}: {
  isoDate: string;
  label: string;
}) {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(`${isoDate}T00:00:00`).getTime();
    const tick = () =>
      setDays(Math.max(0, Math.ceil((target - Date.now()) / 86_400_000)));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isoDate]);

  return (
    <div className="rounded-2xl bg-zinc-900 ring-1 ring-zinc-800 p-5 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold tracking-[0.25em] text-violet-400">
          DRAFT DAY
        </p>
        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-black tracking-wider text-violet-300 ring-1 ring-violet-500/20">
          UPCOMING
        </span>
      </div>
      <div className="flex items-baseline gap-3 mb-2">
        <span
          className="text-[64px] font-black leading-none tabular-nums bg-gradient-to-br from-violet-400 to-fuchsia-400 bg-clip-text text-transparent"
        >
          {days ?? "—"}
        </span>
        <span className="text-sm font-semibold text-zinc-400">
          {days === 1 ? "day to go" : "days to go"}
        </span>
      </div>
      <p className="text-[13px] font-semibold text-zinc-300">{label}</p>
    </div>
  );
}
