"use client";

import { useEffect, useState } from "react";

export default function NeonCountdown({
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

  // Format as "SUN 09.06.26"
  const d = new Date(`${isoDate}T00:00:00`);
  const dow = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()];
  const dateMono = `${dow} ${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;

  return (
    <div className="border-2 border-emerald-400 bg-emerald-400/5 px-4 py-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
      <p className="text-[10px] font-bold tracking-[0.3em] text-emerald-400 mb-3">
        ▼ DRAFT DAY
      </p>
      <div className="flex items-end gap-3 mb-3">
        <span
          className="text-[80px] font-black leading-none tabular-nums text-emerald-400"
          style={{ textShadow: "0 0 20px rgba(0, 255, 136, 0.5)" }}
        >
          {days ?? "—"}
        </span>
        <span className="text-[10px] font-bold tracking-widest text-zinc-400 mb-3">
          DAYS
          <br />
          OUT
        </span>
      </div>
      <div className="border-t border-emerald-400/30 pt-3 flex items-baseline justify-between">
        <span className="text-sm font-bold tracking-widest text-cyan-400">
          {dateMono}
        </span>
        <span className="text-[10px] tracking-widest text-zinc-500">{label}</span>
      </div>
    </div>
  );
}
