import Link from "next/link";
import Image from "next/image";
import { getHistory } from "@/lib/data";
import Avatar from "@/components/Avatar";

export const dynamic = "force-static";

export default async function HistoryPage() {
  const { seasons } = await getHistory();

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-5">
        <p className="text-[11px] font-bold tracking-widest text-accent">
          HALL OF FAME
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">League History</h1>
        <p className="text-sm text-muted">
          Champions and toilet bowls, every season.
        </p>
      </header>

      <ul className="space-y-3">
        {seasons.map((s) => (
          <li
            key={s.year}
            className="rounded-2xl border border-app bg-elev p-4"
          >
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-2xl font-extrabold">{s.year}</div>
              <div className="text-xs text-muted">{s.league_name}</div>
            </div>

            <div className="space-y-2">
              {s.champion && (
                <PodiumRow
                  rank="🥇"
                  label="Champion"
                  team={s.champion.team_name}
                  owner={s.champion.owner}
                  slug={s.champion.owner_slug}
                  logo={s.champion.logo_url}
                  color="text-yellow-400"
                />
              )}
              {s.runner_up && (
                <PodiumRow
                  rank="🥈"
                  label="Runner-up"
                  team={s.runner_up.team_name}
                  owner={s.runner_up.owner}
                  slug={s.runner_up.owner_slug}
                  logo={s.runner_up.logo_url}
                  color="text-zinc-300"
                />
              )}
              {s.third && (
                <PodiumRow
                  rank="🥉"
                  label="3rd"
                  team={s.third.team_name}
                  owner={s.third.owner}
                  slug={s.third.owner_slug}
                  logo={s.third.logo_url}
                  color="text-amber-700"
                />
              )}
              {s.last && (
                <PodiumRow
                  rank="🚽"
                  label="Toilet Bowl"
                  team={s.last.team_name}
                  owner={s.last.owner}
                  slug={s.last.owner_slug}
                  logo={s.last.logo_url}
                  color="text-red-400"
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PodiumRow({
  rank,
  label,
  team,
  owner,
  slug,
  logo,
  color,
}: {
  rank: string;
  label: string;
  team: string;
  owner: string;
  slug: string;
  logo?: string;
  color: string;
}) {
  return (
    <Link
      href={`/managers/${slug}`}
      className="flex items-center gap-3 rounded-lg bg-elev-2 px-3 py-2 active:opacity-70"
    >
      <span className="text-xl shrink-0">{rank}</span>
      {logo ? (
        <Image
          src={logo}
          alt=""
          width={36}
          height={36}
          unoptimized
          className="rounded-full bg-elev object-cover w-9 h-9 shrink-0"
        />
      ) : (
        <Avatar name={owner} slug={slug} size="md" />
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-semibold">{team}</div>
        <div className="truncate text-xs text-muted">{owner}</div>
      </div>
      <span className={`text-[10px] font-bold tracking-wider uppercase ${color}`}>
        {label}
      </span>
    </Link>
  );
}
