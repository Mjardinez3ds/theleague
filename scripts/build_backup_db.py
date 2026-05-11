"""
Build a comprehensive SQLite backup of all ESPN fantasy league data.

Run manually whenever you want a fresh archive:
    py -3 scripts/build_backup_db.py

Output: backup/league.db  (single portable SQLite file)

This is SEPARATE from build_data.py — it captures much more detail
(player-level weekly scores, bench points, full lineup decisions, waiver
transactions) that the site doesn't currently surface but you may want later.

Tables
------
  owners        — canonical manager identities across all seasons
  teams         — one row per manager per season (record, PF/PA, finish)
  matchups      — one row per game per week (home/away, scores, playoff flag)
  roster_slots  — one row per player per team per week (starter/bench, pts)
  draft_picks   — every pick from every draft
  trades        — accepted trades (detected via roster-diff, same as site)
  trade_players — players in each trade side

Why SQLite?
  - Single file, zero server required, copy it anywhere
  - Queryable immediately: `sqlite3 backup/league.db "SELECT ..."`
  - Unlocks future features: bench points, optimal lineup diff, H2H matrix,
    per-player career stats across managers, etc.
  - Survives ESPN API going down — historical data is locked in permanently

NOTE: player-level data (roster_slots) is the slowest part — it fetches
box_scores for every week of every season, ~54 API calls total. Expect
~5-10 minutes with rate limiting.
"""

from __future__ import annotations
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from espn_api.football import League

# ── Config (mirrors build_data.py) ──────────────────────────────────────────
LEAGUE_ID = int(os.getenv("ESPN_LEAGUE_ID", "1917791320"))
ESPN_S2 = os.getenv(
    "ESPN_S2",
    "AEBMwbLFpn%2BnPQ%2BhMkaekhc1jIAEeFYzrmWDgFBei3LC3GRVLGTlworTzLRoPQLTpW%2Ff"
    "BTXRdzuU7J9qSzsRjP%2BOTj6KT3bt03S1C0%2FtDD6Os57aC99lI%2B0bhmr%2BHhUIRxmzPX"
    "5M3%2Brs9Mq5mw4UBG%2FSUy7fJv9J9AzZorNU47ZZ4rbwJDO3jkR%2BLRhcQLmX0td%2FdgMN"
    "rOD56TPmXPePbDw8xzLzYSI344LUYpSjEevln4w2ZqnMagMB5IdI18L9idqvAh9mPXBR7GlNwj"
    "9UYp2bf0CRnGZHVz07c0GNPDBmkg%3D%3D",
)
ESPN_SWID = os.getenv("ESPN_SWID", "{9A38199A-B48F-429C-8231-3CF96680FD9E}")
CURRENT_YEAR = int(os.getenv("ESPN_CURRENT_YEAR", "2025"))

OUT_DIR = Path(__file__).resolve().parent.parent / "backup"
OUT_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = OUT_DIR / "league.db"

RATE_LIMIT_SECS = 1.5   # pause between API calls to avoid 429s


# ── Helpers (same as build_data.py) ─────────────────────────────────────────

def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    return s.strip("-") or "unknown"


def _owner_dict(team) -> dict:
    owners = getattr(team, "owners", None) or []
    if owners and isinstance(owners[0], dict):
        return owners[0]
    return {}


def _raw_owner_id(team) -> str:
    o = _owner_dict(team)
    raw = (o.get("id") or "").strip()
    if raw:
        return raw
    first = (o.get("firstName") or "").strip()
    last  = (o.get("lastName") or "").strip()
    return f"{first}|{last}".lower() or f"team-{getattr(team, 'team_id', '?')}"


def _owner_first_last(team) -> tuple[str, str]:
    o = _owner_dict(team)
    return (
        (o.get("firstName") or "").strip() or "?",
        (o.get("lastName")  or "").strip(),
    )


def make_league(year: int) -> League:
    return League(league_id=LEAGUE_ID, year=year, espn_s2=ESPN_S2, swid=ESPN_SWID)


def resolve_owners(teams_by_year: dict) -> tuple[dict, dict, dict]:
    """Mirrors build_data.py::build_owner_resolution() exactly."""
    raw_info: dict[str, tuple[str, str]] = {}
    for teams in teams_by_year.values():
        for t in teams:
            raw_info[_raw_owner_id(t)] = _owner_first_last(t)

    fullname_to_canonical: dict[tuple, str] = {}
    canonical_by_raw: dict[str, str] = {}
    for raw_id, (first, last) in raw_info.items():
        key = (first.lower(), last.lower())
        if key in fullname_to_canonical:
            canonical_by_raw[raw_id] = fullname_to_canonical[key]
        else:
            fullname_to_canonical[key] = raw_id
            canonical_by_raw[raw_id] = raw_id

    canonical_info = {cid: raw_info[cid] for cid in set(canonical_by_raw.values())}

    display_by_canonical: dict[str, str] = {}
    used: set[str] = set()
    for cid in sorted(canonical_info, key=lambda c: (canonical_info[c][1].lower(), c)):
        first, last = canonical_info[cid]
        label = f"{first} {last}".strip() if last else first or "?"
        if label in used:
            n, base = 2, label
            while label in used:
                label = f"{base} #{n}"; n += 1
        display_by_canonical[cid] = label
        used.add(label)

    slug_by_canonical = {cid: slugify(lbl) for cid, lbl in display_by_canonical.items()}
    seen: dict[str, int] = {}
    for cid in list(slug_by_canonical):
        s = slug_by_canonical[cid]
        n = seen.get(s, 0)
        if n:
            slug_by_canonical[cid] = f"{s}-{n+1}"
        seen[s] = n + 1

    return canonical_by_raw, display_by_canonical, slug_by_canonical


# ── Schema ───────────────────────────────────────────────────────────────────

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- Canonical manager identity (survives ESPN account re-creations)
CREATE TABLE IF NOT EXISTS owners (
    slug         TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    first_name   TEXT,
    last_name    TEXT
);

-- One row per manager per season
CREATE TABLE IF NOT EXISTS teams (
    year         INTEGER NOT NULL,
    owner_slug   TEXT    NOT NULL REFERENCES owners(slug),
    team_id      INTEGER NOT NULL,
    team_name    TEXT,
    wins         INTEGER DEFAULT 0,
    losses       INTEGER DEFAULT 0,
    ties         INTEGER DEFAULT 0,
    points_for   REAL    DEFAULT 0,
    points_against REAL  DEFAULT 0,
    finish       INTEGER,
    league_size  INTEGER,
    PRIMARY KEY (year, owner_slug)
);

-- One row per matchup per week
CREATE TABLE IF NOT EXISTS matchups (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    year             INTEGER NOT NULL,
    week             INTEGER NOT NULL,
    home_owner_slug  TEXT REFERENCES owners(slug),
    away_owner_slug  TEXT REFERENCES owners(slug),
    home_team_name   TEXT,
    away_team_name   TEXT,
    home_score       REAL,
    away_score       REAL,
    winner_slug      TEXT,   -- NULL for ties
    is_playoff       INTEGER DEFAULT 0,
    UNIQUE(year, week, home_owner_slug, away_owner_slug)
);

-- One row per player slot per team per week (the gold mine)
CREATE TABLE IF NOT EXISTS roster_slots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    year         INTEGER NOT NULL,
    week         INTEGER NOT NULL,
    owner_slug   TEXT    NOT NULL REFERENCES owners(slug),
    player_id    INTEGER,
    player_name  TEXT,
    position     TEXT,      -- actual position (QB, RB, ...)
    slot         TEXT,      -- lineup slot (QB, FLEX, BE, IR, ...)
    points       REAL DEFAULT 0,
    projected    REAL DEFAULT 0,
    is_starter   INTEGER DEFAULT 0,   -- 1 if in active lineup, 0 if bench/IR
    UNIQUE(year, week, owner_slug, player_id, slot)
);

-- Draft picks
CREATE TABLE IF NOT EXISTS draft_picks (
    year        INTEGER NOT NULL,
    round       INTEGER NOT NULL,
    pick        INTEGER NOT NULL,   -- pick within round
    overall     INTEGER,            -- overall pick number
    owner_slug  TEXT REFERENCES owners(slug),
    player_id   INTEGER,
    player_name TEXT,
    position    TEXT,
    PRIMARY KEY (year, round, pick)
);

-- Accepted trades (team-level, roster-diff detected)
CREATE TABLE IF NOT EXISTS trades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    year        INTEGER NOT NULL,
    week        INTEGER,            -- week the trade took effect
    trade_date  TEXT,               -- ISO date from TRADE_ACCEPT record
    side_a_slug TEXT REFERENCES owners(slug),
    side_b_slug TEXT REFERENCES owners(slug)
);

-- Players in each trade
CREATE TABLE IF NOT EXISTS trade_players (
    trade_id    INTEGER NOT NULL REFERENCES trades(id),
    from_slug   TEXT    NOT NULL REFERENCES owners(slug),
    to_slug     TEXT    NOT NULL REFERENCES owners(slug),
    player_name TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roster_year_week  ON roster_slots(year, week);
CREATE INDEX IF NOT EXISTS idx_roster_owner      ON roster_slots(owner_slug);
CREATE INDEX IF NOT EXISTS idx_matchups_year     ON matchups(year);
CREATE INDEX IF NOT EXISTS idx_trades_year       ON trades(year);
"""


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    started = time.time()
    print(f"Building backup database -> {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)

    # ── Load leagues ──────────────────────────────────────────────────────
    print("\nLoading leagues from ESPN…")
    current = make_league(CURRENT_YEAR)
    prior   = sorted(set(getattr(current, "previousSeasons", []) or []))
    years   = sorted(set(prior + [CURRENT_YEAR]))
    print(f"  seasons: {years}")

    leagues_by_year: dict[int, League] = {}
    for yr in years:
        try:
            leagues_by_year[yr] = current if yr == CURRENT_YEAR else make_league(yr)
            print(f"  loaded {yr}")
        except Exception as e:
            print(f"  ! skip {yr}: {e}")

    teams_by_year = {yr: list(lg.teams) for yr, lg in leagues_by_year.items()}
    canonical_by_raw, display_by_canonical, slug_by_canonical = resolve_owners(teams_by_year)

    def owner_slug(team) -> str:
        cid = canonical_by_raw.get(_raw_owner_id(team), "")
        return slug_by_canonical.get(cid, "unknown")

    def owner_display(team) -> str:
        cid = canonical_by_raw.get(_raw_owner_id(team), "")
        return display_by_canonical.get(cid, "?")

    # ── Owners table ──────────────────────────────────────────────────────
    print("\nWriting owners…")
    for cid, (first, last) in {
        cid: _owner_first_last(next(
            t for teams in teams_by_year.values() for t in teams
            if canonical_by_raw.get(_raw_owner_id(t)) == cid
        ))
        for cid in set(canonical_by_raw.values())
    }.items():
        slug = slug_by_canonical[cid]
        display = display_by_canonical[cid]
        conn.execute(
            "INSERT OR REPLACE INTO owners(slug, display_name, first_name, last_name) VALUES(?,?,?,?)",
            (slug, display, first, last),
        )
    conn.commit()
    print(f"  {conn.execute('SELECT COUNT(*) FROM owners').fetchone()[0]} owners")

    # ── Teams + standings ─────────────────────────────────────────────────
    print("\nWriting teams / standings…")
    for yr, lg in leagues_by_year.items():
        try:
            ranked = lg.standings()
        except Exception:
            ranked = sorted(lg.teams, key=lambda t: (-t.wins, -getattr(t, "points_for", 0)))
        finish_by_id = {id(t): i + 1 for i, t in enumerate(ranked)}

        for t in lg.teams:
            slug    = owner_slug(t)
            finish  = finish_by_id.get(id(t))
            conn.execute("""
                INSERT OR REPLACE INTO teams
                  (year, owner_slug, team_id, team_name,
                   wins, losses, ties, points_for, points_against,
                   finish, league_size)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """, (
                yr, slug, t.team_id, t.team_name,
                t.wins, t.losses, getattr(t, "ties", 0),
                round(getattr(t, "points_for", 0) or 0, 2),
                round(getattr(t, "points_against", 0) or 0, 2),
                finish, len(ranked),
            ))
    conn.commit()
    print(f"  {conn.execute('SELECT COUNT(*) FROM teams').fetchone()[0]} team-seasons")

    # ── Draft picks ───────────────────────────────────────────────────────
    print("\nWriting draft picks…")
    overall = 0
    for yr, lg in sorted(leagues_by_year.items()):
        overall = 0
        try:
            picks = lg.draft
        except Exception as e:
            print(f"  ! no draft {yr}: {e}"); continue
        for p in sorted(picks, key=lambda x: (getattr(x, "round_num", 0), getattr(x, "round_pick", 0))):
            overall += 1
            team = getattr(p, "team", None)
            slug = owner_slug(team) if team else "unknown"
            position = ""
            try: position = p.player.position or ""
            except Exception: pass
            pid = getattr(p, "playerId", None) or getattr(p, "player_id", None)
            conn.execute("""
                INSERT OR REPLACE INTO draft_picks
                  (year, round, pick, overall, owner_slug, player_id, player_name, position)
                VALUES (?,?,?,?,?,?,?,?)
            """, (
                yr,
                getattr(p, "round_num", 0),
                getattr(p, "round_pick", 0),
                overall,
                slug,
                pid,
                getattr(p, "playerName", "") or "",
                position,
            ))
        print(f"  draft {yr}: {overall} picks")
    conn.commit()

    # ── Weekly matchups + roster slots (the big fetch) ────────────────────
    print("\nFetching weekly box scores (this takes a few minutes)…")
    for yr, lg in sorted(leagues_by_year.items()):
        print(f"  year {yr}:")

        # Build team_id -> slug map for this year
        tid_to_slug: dict[int, str] = {
            t.team_id: owner_slug(t) for t in lg.teams
        }
        tid_to_name: dict[int, str] = {
            t.team_id: t.team_name for t in lg.teams
        }

        for week in range(1, 19):
            try:
                boxes = lg.box_scores(week)
            except Exception as e:
                print(f"    week {week}: error {e}"); break
            if not boxes:
                break

            all_zero = all(
                (getattr(b, "home_score", 0) or 0) == 0 and
                (getattr(b, "away_score", 0) or 0) == 0
                for b in boxes
            )
            if all_zero:
                break

            is_playoff = int(bool(getattr(boxes[0], "is_playoff", False)))
            matchup_count = 0
            slot_count = 0

            for b in boxes:
                h_team = getattr(b, "home_team", None)
                a_team = getattr(b, "away_team", None)
                if not h_team or not a_team:
                    continue

                h_score = round(float(getattr(b, "home_score", 0) or 0), 2)
                a_score = round(float(getattr(b, "away_score", 0) or 0), 2)
                h_slug  = tid_to_slug.get(h_team.team_id, "unknown")
                a_slug  = tid_to_slug.get(a_team.team_id, "unknown")
                winner  = h_slug if h_score > a_score else (a_slug if a_score > h_score else None)

                conn.execute("""
                    INSERT OR REPLACE INTO matchups
                      (year, week, home_owner_slug, away_owner_slug,
                       home_team_name, away_team_name,
                       home_score, away_score, winner_slug, is_playoff)
                    VALUES (?,?,?,?,?,?,?,?,?,?)
                """, (
                    yr, week, h_slug, a_slug,
                    tid_to_name.get(h_team.team_id, ""),
                    tid_to_name.get(a_team.team_id, ""),
                    h_score, a_score, winner, is_playoff,
                ))
                matchup_count += 1

                # Roster slots — home and away lineups
                for team_slug, lineup in ((h_slug, getattr(b, "home_lineup", [])),
                                          (a_slug, getattr(b, "away_lineup", []))):
                    for player in (lineup or []):
                        name     = getattr(player, "name", None) or str(player)
                        pid      = getattr(player, "playerId", None)
                        pos      = getattr(player, "position", "") or ""
                        slot_pos = getattr(player, "slot_position", "") or ""
                        pts      = round(float(getattr(player, "points", 0) or 0), 2)
                        proj     = round(float(getattr(player, "projected_points", 0) or 0), 2)
                        # ESPN marks bench slots as "BE" or "IR"
                        is_starter = int(slot_pos not in ("BE", "IR", ""))

                        conn.execute("""
                            INSERT OR REPLACE INTO roster_slots
                              (year, week, owner_slug, player_id, player_name,
                               position, slot, points, projected, is_starter)
                            VALUES (?,?,?,?,?,?,?,?,?,?)
                        """, (yr, week, team_slug, pid, name, pos, slot_pos,
                              pts, proj, is_starter))
                        slot_count += 1

            print(f"    week {week}: {matchup_count} matchups, {slot_count} player slots")
            time.sleep(RATE_LIMIT_SECS)

    conn.commit()

    # ── Trades (re-use build_data.py roster-diff logic via JSON files) ────
    print("\nImporting trades from existing JSON files…")
    import json as _json
    data_dir = Path(__file__).resolve().parent.parent / "public" / "data" / "trades"
    trade_count = 0
    for trade_file in sorted(data_dir.glob("*.json")):
        yr = int(trade_file.stem)
        data = _json.loads(trade_file.read_text(encoding="utf-8"))
        for t in data.get("trades", []):
            sides = t.get("sides", [])
            if len(sides) < 2:
                continue
            a, b = sides[0], sides[1]
            cur = conn.execute("""
                INSERT INTO trades (year, trade_date, side_a_slug, side_b_slug)
                VALUES (?,?,?,?)
            """, (yr, t.get("date", ""), a.get("owner_slug", ""), b.get("owner_slug", "")))
            tid = cur.lastrowid
            # Players A gave (went to B) and B gave (went to A)
            for p in a.get("gave", []):
                conn.execute(
                    "INSERT INTO trade_players(trade_id,from_slug,to_slug,player_name) VALUES(?,?,?,?)",
                    (tid, a["owner_slug"], b["owner_slug"], p),
                )
            for p in b.get("gave", []):
                conn.execute(
                    "INSERT INTO trade_players(trade_id,from_slug,to_slug,player_name) VALUES(?,?,?,?)",
                    (tid, b["owner_slug"], a["owner_slug"], p),
                )
            trade_count += 1
    conn.commit()
    print(f"  {trade_count} trades imported")

    # ── Meta ──────────────────────────────────────────────────────────────
    conn.execute("INSERT OR REPLACE INTO meta VALUES ('league_id', ?)", (str(LEAGUE_ID),))
    conn.execute("INSERT OR REPLACE INTO meta VALUES ('years', ?)",     (str(years),))
    conn.execute("INSERT OR REPLACE INTO meta VALUES ('built_at', ?)",
                 (datetime.now(timezone.utc).isoformat(),))
    conn.commit()

    # ── Summary ───────────────────────────────────────────────────────────
    print("\n-- Database summary ------------------------------------------")
    for table in ("owners", "teams", "matchups", "roster_slots", "draft_picks", "trades", "trade_players"):
        n = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  {table:<16} {n:>6} rows")
    conn.close()

    size_kb = DB_PATH.stat().st_size // 1024
    elapsed = time.time() - started
    print(f"\nDone in {elapsed:.1f}s -> {DB_PATH} ({size_kb} KB)")
    print("\nQuick query examples:")
    print(f'  sqlite3 backup/league.db "SELECT display_name, wins, losses FROM owners JOIN teams USING(slug) WHERE year=2025 ORDER BY wins DESC"')
    print(f'  sqlite3 backup/league.db "SELECT player_name, SUM(points) pts FROM roster_slots WHERE is_starter=1 GROUP BY player_name ORDER BY pts DESC LIMIT 20"')


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        raise
