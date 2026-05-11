import Link from "next/link";

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

export function SeasonCard({ season: s, slug, finLabel: fin }: Props) {
  return (
    <li className="rounded-xl border border-app bg-elev overflow-hidden">
      <Link
        href={`/managers/${slug}/${s.year}`}
        className="block p-3 active:bg-elev-2 transition-opacity active:opacity-70"
      >
        <div className="flex items-baseline justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold leading-none">{s.year}</span>
              <span className="text-[10px] text-muted">→</span>
            </div>
            <div className="text-xs text-muted mt-1 truncate max-w-[180px]">
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
      </Link>
    </li>
  );
}
