import {
  getLeagueMeta,
  getManagerScores,
  getStandings,
} from "@/lib/data";
import StatsView, { type StatGame } from "@/components/StatsView";

export const dynamic = "force-static";

export default async function StatsPage() {
  const meta = await getLeagueMeta();

  // Flatten every manager's weekly results into one list so the client can
  // re-slice by year / season type instantly. ~650 rows, ~50 KB — cheap.
  const games: StatGame[] = [];
  const names: Record<string, string> = {};

  for (const yr of meta.years) {
    const standings = await getStandings(yr).catch(() => null);
    if (!standings) continue;
    for (const t of standings.teams) {
      names[t.owner_slug] = t.owner;
      // No scores file until a season's first game is played.
      const scores = await getManagerScores(yr, t.owner_slug).catch(() => null);
      if (!scores) continue;
      for (const w of scores.weeks) {
        games.push({
          year: yr,
          week: w.week,
          slug: t.owner_slug,
          score: w.score,
          opp: w.opponent_slug,
          oppScore: w.opponent_score,
          result: w.result,
          playoff: w.is_playoff,
        });
      }
    }
  }

  return <StatsView games={games} names={names} years={meta.years} />;
}
