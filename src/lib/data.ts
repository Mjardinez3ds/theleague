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

export const getLeagueMeta = () => readJson<LeagueMeta>("league.json");
export const getStandings = (year: number) =>
  readJson<Standings>(`standings/${year}.json`);
export const getHistory = () =>
  readJson<{ seasons: SeasonHistory[] }>("history.json");
export const getCareers = () =>
  readJson<{ owners: Career[] }>("careers.json");
export const getOwner = (slug: string) =>
  readJson<Career>(`owners/${slug}.json`);
