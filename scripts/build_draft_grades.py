"""
Build draft grades by comparing each pick's ADP (Average Draft Position) to
the player's actual end-of-season production.

Data sources:
  - ADP: Fantasy Football Calculator free JSON API (12-team PPR)
  - Actual season points: ESPN API (rostered players + free agents)
  - League draft picks: public/data/drafts/{year}/{slug}.json (already built)

Output: public/data/draft_grades/{year}/{slug}.json — one file per manager
per season, with each pick scored vs. ADP-based expectations.

A pick's "value" = (expected position finish based on ADP) - (actual finish).
Positive = steal, negative = bust. We only grade offensive skill positions
(QB/RB/WR/TE) since K and D/ST are basically dart throws.

Currently runs for 2023 and 2024 only — Fantasy Football Calculator doesn't
have 2025 ADP archived.
"""

import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# Reuse the ESPN League factory + paths from build_data
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_data as bd

OUT_DIR = bd.OUT_DIR
DRAFTS_DIR = OUT_DIR / "drafts"
GRADES_DIR = OUT_DIR / "draft_grades"

# All seasons we want to grade. FFC has 2023+2024, FantasyPros covers 2025.
ADP_YEARS = [2023, 2024, 2025]

GRADED_POSITIONS = {"QB", "RB", "WR", "TE"}

UA = {"User-Agent": "Mozilla/5.0 (compatible; theleague-web/1.0)"}


def fetch_adp_ffc(year: int) -> list[dict]:
    """Fantasy Football Calculator's free API. Returns [] if unavailable."""
    url = f"https://fantasyfootballcalculator.com/api/v1/adp/ppr?teams=12&year={year}"
    print(f"  fetching ADP from FFC for {year}…")
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    data = r.json()
    if data.get("status") != "Success":
        return []
    return data.get("players", [])


_ADP_TEAM_RE = re.compile(r"^(.*?)([A-Z]{2,3})(?:\([^)]+\))?$")
_ADP_POS_RE = re.compile(r"^([A-Z]+)(\d+)?$")

def fetch_adp_fantasypros(year: int) -> list[dict]:
    """
    Scrape FantasyPros' PPR overall ADP archive page. Used for years that FFC
    doesn't have (currently 2025).
    Table cell format:
      [rank, "Player NameTEAM(bye)", "WR1", ..., "1.0", "1"]
    """
    url = f"https://www.fantasypros.com/nfl/adp/ppr-overall.php?year={year}"
    print(f"  fetching ADP from FantasyPros for {year}…")
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    table = soup.find("table", id="data")
    if not table:
        return []

    out: list[dict] = []
    for tr in table.find("tbody").find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all("td")]
        if len(cells) < 4:
            continue
        # Column 1: "Ja'Marr ChaseCIN(10)" -> name=Ja'Marr Chase, team=CIN
        raw = cells[1]
        # Strip the (bye) suffix
        raw = re.sub(r"\([^)]*\)$", "", raw).strip()
        m = _ADP_TEAM_RE.match(raw)
        if m:
            name = m.group(1).strip()
            team = m.group(2)
        else:
            name, team = raw, ""

        # Column 2: position rank like "WR1", "RB12"
        pos_m = _ADP_POS_RE.match(cells[2] or "")
        position = pos_m.group(1) if pos_m else ""

        # ADP is the second-to-last column (last is std dev / vs ECR)
        try:
            adp = float(cells[-2])
        except (ValueError, IndexError):
            continue

        # Translate FantasyPros' "DST" to our "D/ST" convention
        if position == "DST":
            position = "D/ST"

        # FantasyPros ADP is already in "round.pick" format (e.g. 18.05 = R18 P5)
        out.append({
            "name": name,
            "position": position,
            "team": team,
            "adp": adp,
            "adp_formatted": f"{int(adp)}.{int(round((adp - int(adp)) * 100)):02d}",
        })
    return out


def fetch_adp(year: int) -> list[dict]:
    """Try FFC first (cleaner data), fall back to FantasyPros."""
    try:
        ffc = fetch_adp_ffc(year)
        if ffc:
            return ffc
    except Exception as e:
        print(f"  ! FFC fetch failed for {year}: {e}")
    return fetch_adp_fantasypros(year)


def normalize_name(name: str) -> str:
    """
    Lowercase, strip suffixes/punctuation so we can match across data sources.
    'Marvin Harrison Jr.' -> 'marvin harrison'
    'D.J. Moore'          -> 'dj moore'
    "Ja'Marr Chase"       -> 'jamarr chase'
    """
    n = name.lower().strip()
    # Strip common suffixes
    n = re.sub(r"\s+(jr\.?|sr\.?|i{2,3}|iv|v)$", "", n)
    # Remove punctuation
    n = re.sub(r"[.\'`]", "", n)
    # Collapse whitespace
    n = re.sub(r"\s+", " ", n).strip()
    return n


def fetch_player_points(year: int) -> dict[str, dict]:
    """
    Return {normalized_name: {name, position, total_points, player_id}} for
    every player ESPN knows about (rostered + ~400 top free agents).
    """
    print(f"  fetching ESPN player totals for {year}…")
    lg = bd.make_league(year)
    out: dict[str, dict] = {}

    def add(p):
        nm = normalize_name(p.name)
        pts = float(getattr(p, "total_points", 0) or 0)
        pos = getattr(p, "position", "") or ""
        # If we already have this name, keep the higher-scoring one
        # (handles edge cases like duplicate names)
        if nm in out and out[nm]["total_points"] >= pts:
            return
        out[nm] = {
            "name": p.name,
            "position": pos,
            "total_points": pts,
            "player_id": getattr(p, "playerId", None),
        }

    # Rostered players first
    for t in lg.teams:
        for p in t.roster:
            add(p)

    # Then top 400 free agents
    try:
        for p in lg.free_agents(size=400):
            add(p)
    except Exception as e:
        print(f"  ! free_agents failed: {e}")

    print(f"    {len(out)} unique players collected")
    return out


def position_rankings(players_by_name: dict[str, dict]) -> dict[str, dict[str, int]]:
    """
    Rank every player at their position by total_points descending.
    Returns {position: {normalized_name: rank}}.
    """
    by_pos: dict[str, list[tuple[str, float]]] = {}
    for nm, p in players_by_name.items():
        pos = p["position"]
        if pos not in GRADED_POSITIONS:
            continue
        by_pos.setdefault(pos, []).append((nm, p["total_points"]))

    rank_maps: dict[str, dict[str, int]] = {}
    for pos, lst in by_pos.items():
        lst.sort(key=lambda x: -x[1])
        rank_maps[pos] = {nm: i + 1 for i, (nm, _) in enumerate(lst)}
    return rank_maps


def adp_position_rankings(adp_list: list[dict]) -> dict[str, dict[str, int]]:
    """
    Rank players at each position by ADP (lower ADP = earlier rank).
    Returns {position: {normalized_name: adp_position_rank}}.
    """
    by_pos: dict[str, list[tuple[str, float]]] = {}
    for p in adp_list:
        pos = (p.get("position") or "").upper()
        if pos == "DEF":
            pos = "D/ST"
        if pos not in GRADED_POSITIONS:
            continue
        nm = normalize_name(p["name"])
        adp = float(p.get("adp", 999))
        by_pos.setdefault(pos, []).append((nm, adp))

    out: dict[str, dict[str, int]] = {}
    for pos, lst in by_pos.items():
        lst.sort(key=lambda x: x[1])
        out[pos] = {nm: i + 1 for i, (nm, _) in enumerate(lst)}
    return out


def grade_by_rank(rank: int, total: int) -> str:
    """
    Curve-based grade: where you finished among managers in your league
    for that year. For a 12-team league:
      rank 1     -> A+
      rank 2     -> A
      rank 3-4   -> B+
      rank 5-6   -> B
      rank 7-8   -> C
      rank 9-10  -> D
      rank 11-12 -> F
    """
    pct = rank / total  # 1/12 = top, 12/12 = bottom
    if pct <= 1/12:  return "A+"
    if pct <= 2/12:  return "A"
    if pct <= 4/12:  return "B+"
    if pct <= 6/12:  return "B"
    if pct <= 8/12:  return "C"
    if pct <= 10/12: return "D"
    return "F"


def median(xs: list[float]) -> float:
    if not xs: return 0.0
    s = sorted(xs)
    n = len(s)
    return s[n//2] if n % 2 else (s[n//2 - 1] + s[n//2]) / 2


def write_raw_adp(year: int, adp_list: list[dict]) -> None:
    """
    Persist the raw ADP fetch to disk so we never lose this data even if
    Fantasy Football Calculator and FantasyPros both go away.
    Output: public/data/adp/{year}.json
    """
    if not adp_list:
        return
    out_dir = OUT_DIR / "adp"
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "year": year,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(adp_list),
        "players": adp_list,
    }
    (out_dir / f"{year}.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )
    print(f"  wrote raw ADP archive: adp/{year}.json ({len(adp_list)} players)")


def build_year(year: int) -> int:
    """Build draft grades for one year. Returns count of files written."""
    adp_list = fetch_adp(year)
    write_raw_adp(year, adp_list)  # Archive raw ADP for resilience
    players = fetch_player_points(year)
    actual_ranks = position_rankings(players)
    adp_ranks = adp_position_rankings(adp_list)

    # Index ADP players by normalized name for raw-pick lookup
    adp_by_name: dict[str, dict] = {}
    for p in adp_list:
        adp_by_name[normalize_name(p["name"])] = p

    # Iterate every manager's draft for this year
    drafts_year_dir = DRAFTS_DIR / str(year)
    if not drafts_year_dir.exists():
        print(f"  no drafts dir for {year}, skipping")
        return 0

    # First pass: grade every manager's picks (no letter grade yet — needs curve)
    drafts: list[dict] = []
    for draft_file in drafts_year_dir.glob("*.json"):
        slug = draft_file.stem
        picks = json.loads(draft_file.read_text(encoding="utf-8"))

        graded_picks = []
        for pick in picks:
            pos = (pick.get("position") or "").upper()
            if pos not in GRADED_POSITIONS:
                continue  # Skip K/DST
            nm = normalize_name(pick["player"])

            actual_rank = actual_ranks.get(pos, {}).get(nm)
            adp_rank   = adp_ranks.get(pos, {}).get(nm)
            adp_entry  = adp_by_name.get(nm)
            actual_pts = players.get(nm, {}).get("total_points", 0)

            value = (adp_rank - actual_rank) if (actual_rank and adp_rank) else None

            graded_picks.append({
                "round": pick["round"],
                "pick":  pick["pick"],
                "player": pick["player"],
                "position": pos,
                "actual_pts":      round(actual_pts, 1),
                "actual_pos_rank": actual_rank,
                "adp_pos_rank":    adp_rank,
                "adp_pick":        (adp_entry or {}).get("adp_formatted"),
                "value":           value,
            })

        scored = [p for p in graded_picks if p["value"] is not None]
        # Median is robust to single-pick disasters (Aiyuk ACL etc.)
        med = median([p["value"] for p in scored])
        avg = (sum(p["value"] for p in scored) / len(scored)) if scored else 0.0

        drafts.append({
            "slug": slug,
            "all_picks": graded_picks,
            "scored": scored,
            "median_value": med,
            "avg_value": avg,
        })

    # Sort by median (primary) then avg (tiebreaker), best to worst
    drafts.sort(key=lambda d: (-d["median_value"], -d["avg_value"]))
    total_managers = len(drafts)

    written = 0
    for rank, d in enumerate(drafts, start=1):
        steals = sorted(
            [p for p in d["scored"] if p["value"] >= 3],
            key=lambda p: -p["value"],
        )[:5]
        busts = sorted(
            [p for p in d["scored"] if p["value"] <= -5],
            key=lambda p: p["value"],
        )[:5]

        out = {
            "year": year,
            "slug": d["slug"],
            "grade": grade_by_rank(rank, total_managers),
            "rank": rank,
            "of": total_managers,
            "median_value": round(d["median_value"], 2),
            "avg_value":    round(d["avg_value"], 2),
            "graded_pick_count": len(d["scored"]),
            "steals_count": sum(1 for p in d["scored"] if p["value"] >= 3),
            "busts_count":  sum(1 for p in d["scored"] if p["value"] <= -5),
            "steals": steals,
            "busts": busts,
            "all_picks": d["all_picks"],
        }

        out_dir = GRADES_DIR / str(year)
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{d['slug']}.json").write_text(
            json.dumps(out, indent=2), encoding="utf-8"
        )
        written += 1

    print(f"  wrote {written} grade files for {year}")
    return written


def main():
    print("Building draft grades…")
    started = time.time()
    GRADES_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for yr in ADP_YEARS:
        try:
            total += build_year(yr)
        except Exception as e:
            print(f"  ! {yr} failed: {e}")
    print(f"\nDone in {time.time()-started:.1f}s. Wrote {total} files in {GRADES_DIR}")


if __name__ == "__main__":
    main()
