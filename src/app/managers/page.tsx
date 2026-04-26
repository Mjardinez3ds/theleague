import Link from "next/link";
import { getCareers } from "@/lib/data";

export const dynamic = "force-static";

export default async function ManagersPage() {
  const { owners } = await getCareers();

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-5">
        <p className="text-[11px] font-bold tracking-widest text-accent">
          ALL-TIME
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">Managers</h1>
        <p className="text-sm text-muted">
          {owners.length} managers · ranked by career win %
        </p>
      </header>

      <ul className="space-y-2">
        {owners.map((o, i) => {
          const games = o.wins + o.losses + o.ties;
          return (
            <li key={o.slug}>
              <Link
                href={`/managers/${o.slug}`}
                className="flex items-center gap-3 rounded-xl border border-app bg-elev px-3 py-3 active:bg-elev-2"
              >
                <span className="w-7 text-center text-sm font-bold text-accent tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[15px] font-semibold">
                    {o.owner}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {o.wins}-{o.losses}
                    {o.ties ? `-${o.ties}` : ""} · {games} games ·{" "}
                    {o.seasons.length} seasons
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums">
                    {o.win_pct.toFixed(1)}%
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[11px] text-muted">
                    {o.titles > 0 && <span>🥇{o.titles}</span>}
                    {o.runners_up > 0 && <span>🥈{o.runners_up}</span>}
                    {o.thirds > 0 && <span>🥉{o.thirds}</span>}
                    {o.titles + o.runners_up + o.thirds === 0 && (
                      <span>—</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
