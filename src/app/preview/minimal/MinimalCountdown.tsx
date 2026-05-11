"use client";

import { useEffect, useState } from "react";

export default function MinimalCountdown({
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
    <div>
      <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#999] mb-3">
        Draft
      </p>
      <p
        className="text-[28px] leading-tight font-medium"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {label}
      </p>
      <p
        className="text-[14px] text-[#666] mt-2"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {days === null ? "—" : (
          <>
            <span className="text-[#c8102e] font-semibold tabular-nums">
              {days}
            </span>{" "}
            {days === 1 ? "day" : "days"} from today.
          </>
        )}
      </p>
    </div>
  );
}
