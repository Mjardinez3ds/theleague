import { getLeagueMeta, getTrades, TradesData } from "@/lib/data";
import TradesView from "@/components/TradesView";

export const dynamic = "force-static";

export default async function TradesPage() {
  const meta = await getLeagueMeta();
  const tradesMap: Record<number, TradesData> = {};

  for (const year of meta.years) {
    try {
      tradesMap[year] = await getTrades(year);
    } catch {
      tradesMap[year] = { year, count: 0, trades: [] };
    }
  }

  return (
    <TradesView
      tradesMap={tradesMap}
      years={meta.years}
      currentYear={meta.current_year}
    />
  );
}
