"""
Generate static JSON data files for the website from ESPN's fantasy API.

Run this manually:  py -3 scripts/build_data.py
Or via GitHub Actions on a cron (see .github/workflows/refresh.yml).

Outputs JSON files into ./public/data/ which the site reads at runtime.
Re-run any time you want fresh data — the site doesn't need a rebuild.
"""

from __future__ import annotations
import json
import os
import re
import sys
import time
from pathlib import Path
from datetime import datetime, timezone

from espn_api.football import League

# ---------- Config ----------
LEAGUE_ID = int(os.getenv("ESPN_LEAGUE_ID", "1917791320"))
ESPN_S2 = os.getenv(
    "ESPN_S2",
    "AEBgeEACkDsmYKvK9FhtZsXekjWtXeBhY2mhPLEgf%2FNkRVjeV6NuguCM4K5z9754kioaThp"
    "wUmVr%2Bc8QA5StYKkrs1sl2hLKfKDhJSaE2y8xRS%2BVogTDbbPj8H8OB4iMesG%2F5Z%2BMb"
    "HBeONDFgeapigyI3cFey37KVGpyEELYaPG%2BOulsS7vxfN6ItjSUW7680dPaNEh6J2QD7mWkd"
    "0lrCQZfH6DY119CO9ZpH36yltah3BYbcMhczURaVycYYngfnfa7C2PzNsFiUxC%2B6QSuP9gxv"
    "5e9Q2n1Qe6%2FhOFXmbAHIA%3D%3D",
)
ESPN_SWID = os.getenv("ESPN_SWID", "{9A38199A-B48F-429C-8231-3CF96680FD9E}")

# Hardcode current year so we don't try to fetch a season ESPN hasn't created yet.
CURRENT_YEAR = int(os.getenv("ESPN_CURRENT_YEAR", "2025"))

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    return s.strip("-") or "unknown"


def _owner_dict(team) -> dict:
    """Return the first owner record on a team, or an empty dict."""
    owners = getattr(team, "owners", None) or []
    if owners and isinstance(owners[0], dict):
        return owners[0]
    return {}


def _raw_owner_id(team) -> str:
    """ESPN's per-account UUID for an owner (or a fallback)."""
    o = _owner_dict(team)
    raw = (o.get("id") or "").strip()
    if raw:
        return raw
    first = (o.get("firstName") or "").strip()
    last = (o.get("lastName") or "").strip()
    return f"{first}|{last}".lower() or f"team-{getattr(team, 'team_id', '?')}"


def _owner_first_last(team) -> tuple[str, str]:
    o = _owner_dict(team)
    first = (o.get("firstName") or "").strip() or "?"
    last = (o.get("lastName") or "").strip()
    return first, last


def _short_name(first: str, last: str, last_letters: int = 1) -> str:
    if first and last:
        return f"{first} {last[:last_letters]}."
    return first or last or "?"


def build_owner_resolution(teams_by_year: dict[int, list]):
    """
    Returns (canonical_id_by_raw_id, display_by_canonical, slug_by_canonical).

    Strategy:
    1. Auto-merge ESPN owner accounts that share the same (first, last) — handles
       the case where a manager re-creates their ESPN account between seasons.
       Trade-off: two real humans with identical names would be falsely merged
       (acceptable risk in a 12-person league; can be overridden later).
    2. For each *canonical* owner, pick the shortest unique display label
       (e.g. "Chris P." stays short; "Kevin Liang" / "Kevin Llerena" expand
       only as far as needed to be unambiguous).
    """
    # raw_id -> (first, last)
    raw_info: dict[str, tuple[str, str]] = {}
    for teams in teams_by_year.values():
        for t in teams:
            raw_info[_raw_owner_id(t)] = _owner_first_last(t)

    # Group raw ids by normalized full name to collapse duplicate accounts
    fullname_to_canonical: dict[tuple[str, str], str] = {}
    canonical_by_raw: dict[str, str] = {}
    for raw_id, (first, last) in raw_info.items():
        key = (first.lower(), last.lower())
        if key in fullname_to_canonical:
            canonical_by_raw[raw_id] = fullname_to_canonical[key]
        else:
            fullname_to_canonical[key] = raw_id
            canonical_by_raw[raw_id] = raw_id

    # canonical_id -> (first, last)
    canonical_info: dict[str, tuple[str, str]] = {
        cid: raw_info[cid] for cid in set(canonical_by_raw.values())
    }

    # Per-owner shortest unique label.
    # Try labels with increasing last-name letters PER owner until unique.
    display_by_canonical: dict[str, str] = {}
    used_labels: set[str] = set()
    # Sort by full-name length so simpler names get first crack at short labels.
    for cid in sorted(canonical_info, key=lambda c: (len(canonical_info[c][1]), c)):
        first, last = canonical_info[cid]
        chosen = None
        for letters in range(1, max(1, len(last)) + 1):
            label = _short_name(first, last, letters)
            if label not in used_labels:
                chosen = label
                break
        if not chosen:
            chosen = f"{first} {last}".strip()
            n = 2
            base = chosen
            while chosen in used_labels:
                chosen = f"{base} #{n}"
                n += 1
        display_by_canonical[cid] = chosen
        used_labels.add(chosen)

    slug_by_canonical = {cid: slugify(label) for cid, label in display_by_canonical.items()}
    # Slug collision guard
    seen: dict[str, int] = {}
    for cid in list(slug_by_canonical):
        s = slug_by_canonical[cid]
        n = seen.get(s, 0)
        if n:
            slug_by_canonical[cid] = f"{s}-{n+1}"
        seen[s] = n + 1

    return canonical_by_raw, display_by_canonical, slug_by_canonical


def make_league(year: int) -> League:
    return League(league_id=LEAGUE_ID, year=year, espn_s2=ESPN_S2, swid=ESPN_SWID)


def write_json(rel: str, data) -> None:
    path = OUT_DIR / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    print(f"  wrote {path.relative_to(OUT_DIR.parent.parent)}  ({path.stat().st_size//1024} KB)")


def serialize_team(team, finish: int | None, owner_display: str, owner_slug: str) -> dict:
    return {
        "id": team.team_id,
        "team_name": team.team_name,
        "owner": owner_display,
        "owner_slug": owner_slug,
        "wins": team.wins,
        "losses": team.losses,
        "ties": getattr(team, "ties", 0),
        "points_for": round(getattr(team, "points_for", 0) or 0, 1),
        "points_against": round(getattr(team, "points_against", 0) or 0, 1),
        "logo_url": getattr(team, "logo_url", "") or "",
        "finish": finish,
    }


def main():
    print(f"Building site data for league {LEAGUE_ID}…")
    started = time.time()

    # Discover seasons by loading the current year first.
    current = make_league(CURRENT_YEAR)
    prior = sorted(set(getattr(current, "previousSeasons", []) or []))
    years = sorted(set(prior + [CURRENT_YEAR]))
    print(f"  seasons: {years}")

    # ---------- league.json (meta) ----------
    write_json("league.json", {
        "league_id": LEAGUE_ID,
        "league_name": current.settings.name,
        "current_year": CURRENT_YEAR,
        "current_week": current.current_week,
        "years": years,
        "team_count": len(current.teams),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })

    # ---------- per-year standings ----------
    careers: dict[str, dict] = {}
    history: list[dict] = []

    # Pre-load every season so we can build a globally-unique owner display map.
    leagues_by_year: dict[int, League] = {}
    for yr in years:
        try:
            leagues_by_year[yr] = current if yr == CURRENT_YEAR else make_league(yr)
        except Exception as e:
            print(f"  ! skip {yr}: {e}")

    teams_by_year = {yr: list(lg.teams) for yr, lg in leagues_by_year.items()}
    canonical_by_raw, display_by_canonical, slug_by_canonical = build_owner_resolution(teams_by_year)

    def disp(team) -> tuple[str, str]:
        cid = canonical_by_raw.get(_raw_owner_id(team), "")
        return display_by_canonical.get(cid, "?"), slug_by_canonical.get(cid, "unknown")

    for yr, lg in leagues_by_year.items():
        try:
            ranked = lg.standings()
        except Exception:
            ranked = sorted(lg.teams, key=lambda t: (-t.wins, -getattr(t, "points_for", 0)))
        finish_by_id = {id(t): i + 1 for i, t in enumerate(ranked)}

        teams_payload = []
        for t in lg.teams:
            finish = finish_by_id.get(id(t))
            ow, slug = disp(t)
            teams_payload.append(serialize_team(t, finish, ow, slug))

            d = careers.setdefault(slug, {
                "owner": ow,
                "slug": slug,
                "wins": 0, "losses": 0, "ties": 0,
                "points_for": 0.0, "points_against": 0.0,
                "titles": 0, "runners_up": 0, "thirds": 0, "lasts": 0,
                "seasons": [],
            })
            d["wins"] += t.wins
            d["losses"] += t.losses
            d["ties"] += getattr(t, "ties", 0)
            d["points_for"] += getattr(t, "points_for", 0) or 0
            d["points_against"] += getattr(t, "points_against", 0) or 0
            if finish == 1: d["titles"] += 1
            elif finish == 2: d["runners_up"] += 1
            elif finish == 3: d["thirds"] += 1
            if finish and finish == len(ranked): d["lasts"] += 1
            d["seasons"].append({
                "year": yr,
                "team_name": t.team_name,
                "wins": t.wins,
                "losses": t.losses,
                "ties": getattr(t, "ties", 0),
                "points_for": round(getattr(t, "points_for", 0) or 0, 1),
                "points_against": round(getattr(t, "points_against", 0) or 0, 1),
                "finish": finish,
                "league_size": len(ranked),
            })

        write_json(f"standings/{yr}.json", {
            "year": yr,
            "league_name": lg.settings.name,
            "current_week": lg.current_week,
            "teams": sorted(teams_payload, key=lambda x: x["finish"] or 999),
        })

        # History entry: top 3 + last
        champ = ranked[0] if ranked else None
        runner = ranked[1] if len(ranked) > 1 else None
        third = ranked[2] if len(ranked) > 2 else None
        last = ranked[-1] if ranked else None
        history.append({
            "year": yr,
            "league_name": lg.settings.name,
            "champion": serialize_team(champ, 1, *disp(champ)) if champ else None,
            "runner_up": serialize_team(runner, 2, *disp(runner)) if runner else None,
            "third": serialize_team(third, 3, *disp(third)) if third else None,
            "last": serialize_team(last, len(ranked), *disp(last)) if last else None,
        })

    # ---------- careers + history ----------
    # Round floats
    for d in careers.values():
        d["points_for"] = round(d["points_for"], 1)
        d["points_against"] = round(d["points_against"], 1)
        games = d["wins"] + d["losses"] + d["ties"]
        d["win_pct"] = round((d["wins"] + 0.5 * d["ties"]) / games * 100, 1) if games else 0
        d["games"] = games

    write_json("careers.json", {
        "owners": sorted(careers.values(), key=lambda x: -x["win_pct"]),
    })

    # Per-owner files
    for slug, d in careers.items():
        write_json(f"owners/{slug}.json", d)

    write_json("history.json", {
        "seasons": sorted(history, key=lambda x: -x["year"]),
    })

    print(f"\nDone in {time.time()-started:.1f}s. Files in {OUT_DIR}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        raise
