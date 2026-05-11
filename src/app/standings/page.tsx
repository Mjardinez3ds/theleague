import {
  getCareers,
  getLeagueMeta,
  getStandings,
  type Standings,
} from "@/lib/data";
import StandingsView from "@/components/StandingsView";

export const dynamic = "force-static";

export default async function StandingsPage() {
  const meta = await getLeagueMeta();
  const { owners } = await getCareers();

  // Preload every season's standings so the year-pill switcher is instant
  // (no client-side fetch, no flash). Cheap — these JSONs are ~4 KB each.
  const standingsByYear: Record<number, Standings> = {};
  for (const yr of meta.years) {
    try {
      standingsByYear[yr] = await getStandings(yr);
    } catch {
      // skip missing years gracefully
    }
  }

  return (
    <StandingsView
      careers={owners}
      standingsByYear={standingsByYear}
      years={meta.years}
      defaultYear={meta.current_year}
    />
  );
}
