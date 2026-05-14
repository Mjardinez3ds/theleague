// Server-side data loaders.
// During the build (and on every request in dev), we read the JSON files that
// `scripts/build_data.py` writes into /public/data.

import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "public", "data");

async function readJson<T>(rel: string): Promise<T> {
  const full = path.join(DATA_DIR, rel);
  const raw = await fs.readFile(full, "utf-8");
  return JSON.parse(raw) as T;
}

export type LeagueMeta = {
  league_id: number;
  league_name: string;
  current_year: number;
  current_week: number;
  years: number[];
  team_count: number;
  updated_at: string;
};

export type TeamRow = {
  id: number;
  team_name: string;
  owner: string;
  owner_slug: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  logo_url: string;
  finish: number | null;
};

export type Standings = {
  year: number;
  league_name: string;
  current_week: number;
  teams: TeamRow[];
};

export type SeasonHistory = {
  year: number;
  league_name: string;
  champion: TeamRow | null;
  runner_up: TeamRow | null;
  third: TeamRow | null;
  last: TeamRow | null;
};

export type CareerSeason = {
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

export type Career = {
  owner: string;
  slug: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  titles: number;
  runners_up: number;
  thirds: number;
  lasts: number;
  win_pct: number;
  games: number;
  seasons: CareerSeason[];
};

export type TradeSide = {
  team_name: string;
  owner: string;
  owner_slug: string;
  gave: string[];
  got: string[];
};

export type Trade = {
  date: string;
  sides: TradeSide[];
};

export type TradesData = {
  year: number;
  count: number;
  trades: Trade[];
};

export const getLeagueMeta = () => readJson<LeagueMeta>("league.json");
export const getStandings = (year: number) =>
  readJson<Standings>(`standings/${year}.json`);
export const getHistory = () =>
  readJson<{ seasons: SeasonHistory[] }>("history.json");
export const getCareers = () =>
  readJson<{ owners: Career[] }>("careers.json");
export const getOwner = (slug: string) =>
  readJson<Career>(`owners/${slug}.json`);
export const getTrades = (year: number) =>
  readJson<TradesData>(`trades/${year}.json`);

export type UpcomingManager = {
  name: string;
  slug: string | null; // null = manager has no profile page (e.g. only in a pre-dataset year)
};

export type UpcomingSeason = {
  year: number;
  draft_date: string;        // ISO YYYY-MM-DD, used by the live countdown
  draft_date_label: string;  // Pretty label shown in UI
  managers: UpcomingManager[];
};

export const getUpcomingSeason = () =>
  readJson<UpcomingSeason>("upcoming_season.json");

// Manually maintained — championships from seasons before ESPN data exists (2021, 2022).
// slug -> array of championship years
export const getLegacyChampions = () =>
  readJson<Record<string, number[]>>("legacy_champions.json");

export type WeekResult = {
  week: number;
  score: number;
  team_name: string;
  opponent: string;
  opponent_slug: string;
  opponent_team: string;
  opponent_score: number;
  result: "W" | "L" | "T";
  is_playoff: boolean;
};

export type ManagerScores = {
  year: number;
  weeks: WeekResult[];
};

export const getManagerScores = (year: number, slug: string) =>
  readJson<ManagerScores>(`scores/${year}/${slug}.json`);

export type DraftPick = {
  round: number;
  pick: number;
  player: string;
  position: string;
};

export const getDraftPicks = (year: number, slug: string) =>
  readJson<DraftPick[]>(`drafts/${year}/${slug}.json`);

export type DraftSlot = {
  slot: number;
  owner: string;
  owner_slug: string;
  team_name: string;
  picks: { round: number; player: string; position: string }[];
};

export type DraftBoardData = {
  year: number;
  rounds: number;
  slots: DraftSlot[];
};

export const getDraftBoard = (year: number) =>
  readJson<DraftBoardData>(`draft_board/${year}.json`);

export type H2HRecord = {
  opponent: string;
  opponent_slug: string;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
};

export type H2HData = {
  slug: string;
  records: H2HRecord[];
};

export const getH2H = (slug: string) =>
  readJson<H2HData>(`h2h/${slug}.json`);

export type GradedPick = {
  round: number;
  pick: number;
  player: string;
  position: string;
  actual_pts: number;
  actual_pos_rank: number | null;
  adp_pos_rank: number | null;
  adp_pick: string | null;
  value: number | null;  // ADP rank - actual rank. +ve = steal
};

export type DraftGrades = {
  year: number;
  slug: string;
  grade: string;          // "A+" .. "F"
  rank: number;           // place among managers this year
  of: number;             // total managers graded
  median_value: number;
  avg_value: number;
  graded_pick_count: number;
  steals_count: number;
  busts_count: number;
  steals: GradedPick[];
  busts: GradedPick[];
  all_picks: GradedPick[];
};

export const getDraftGrades = (year: number, slug: string) =>
  readJson<DraftGrades>(`draft_grades/${year}/${slug}.json`);

export type FaabBiggestBid = {
  year: number;
  week: number;
  bid: number;
  player: string;
  dropped: string | null;
};

export type FaabYearTotal = {
  year: number;
  team_name: string;
  acquisitions: number;
  spent: number;
};

export type FaabOwner = {
  slug: string;
  owner: string;
  totals: {
    acquisitions: number;
    spent: number;
    biggest_bid: FaabBiggestBid | null;
  };
  by_year: FaabYearTotal[];
};

export type FaabTransaction = {
  week: number;
  date: string;
  owner: string;
  owner_slug: string;
  team_name: string;
  type: "FREEAGENT" | "WAIVER" | string;
  bid: number;
  added: string[];
  dropped: string[];
};

export type FaabTeamTotal = {
  owner: string;
  owner_slug: string;
  team_name: string;
  acquisitions: number;
  spent: number;
};

export type FaabSeason = {
  year: number;
  transactions: FaabTransaction[];
  team_totals: FaabTeamTotal[];
};

export const getFaabOwner = (slug: string) =>
  readJson<FaabOwner>(`faab/owners/${slug}.json`);

export const getFaabSeason = (year: number) =>
  readJson<FaabSeason>(`faab/${year}.json`);
