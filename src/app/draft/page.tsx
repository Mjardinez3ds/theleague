import { getLeagueMeta, getDraftBoard, type DraftBoardData } from "@/lib/data";
import DraftBoardView from "@/components/DraftBoardView";

export const dynamic = "force-static";

export default async function DraftPage() {
  const meta = await getLeagueMeta();

  const boardsByYear: Record<number, DraftBoardData> = {};
  for (const yr of meta.years) {
    try {
      boardsByYear[yr] = await getDraftBoard(yr);
    } catch {
      // skip if no draft data for a year
    }
  }

  const years = Object.keys(boardsByYear).map(Number).sort((a, b) => b - a);

  return (
    <DraftBoardView
      boardsByYear={boardsByYear}
      years={years}
      defaultYear={years[0] ?? meta.current_year}
    />
  );
}
