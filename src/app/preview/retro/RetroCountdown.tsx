"use client";

import { useEffect, useState } from "react";

export default function RetroCountdown({
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
    <div className="border-4 border-double border-[#1a2b4a] bg-white/40 p-4 text-center">
      <p
        className="text-[10px] font-bold tracking-[0.3em] text-[#c2410c] mb-2"
        style={{ fontFamily: "Georgia, serif" }}
      >
        ★ DRAFT DAY ★
      </p>
      <p
        className="text-[20px] font-bold leading-tight"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {label}
      </p>
      <div className="border-t-2 border-dashed border-[#1a2b4a]/30 mt-3 pt-3">
        <span
          className="text-[44px] font-black leading-none tabular-nums text-[#c2410c]"
          style={{ fontFamily: "Georgia, serif" }}
        >
          {days ?? "—"}
        </span>
        <span
          className="text-[12px] tracking-widest text-[#1a2b4a]/70 ml-2"
          style={{ fontFamily: "Georgia, serif" }}
        >
          {days === 1 ? "DAY" : "DAYS"} REMAINING
        </span>
      </div>
    </div>
  );
}
