"""
Archived seasons: league years that are NOT on ESPN (e.g. 2021, played on
Yahoo) but should appear on the site exactly like an ESPN season.

Each archived season lives in `archive/{year}/season.json` at the repo root,
in a source-neutral shape (see `archive/README.md`). `build_data.py` folds
these in at every step — standings, careers, history, weekly scores, H2H,
drafts, draft board, trades, and waiver/FAAB — so the daily ESPN refresh
never drops them.

The archive files are hand-captured once and never re-fetched: the source
league (Yahoo) can't be reached by the pipeline, and its API now requires
an approved developer app. Treat `archive/` as the source of truth for
those years.
"""

from __future__ import annotations

import json
from pathlib import Path

ARCHIVE_DIR = Path(__file__).resolve().parent.parent / "archive"


def load_archives() -> dict[int, dict]:
    """{year: season} for every archive/{year}/season.json present."""
    out: dict[int, dict] = {}
    if not ARCHIVE_DIR.exists():
        return out
    for p in sorted(ARCHIVE_DIR.glob("*/season.json")):
        season = json.loads(p.read_text(encoding="utf-8"))
        out[int(season["year"])] = season
    return out


def team_index(season: dict) -> dict[int, dict]:
    return {t["id"]: t for t in season["teams"]}


def standings_rows(season: dict, display_by_slug: dict[str, str]) -> list[dict]:
    """TeamRow dicts (same shape as serialize_team) in finish order."""
    rows = []
    for t in sorted(season["teams"], key=lambda t: t["finish"] or 999):
        rows.append({
            "id": t["id"],
            "team_name": t["team_name"],
            "owner": display_by_slug.get(t["owner_slug"], t["owner"]),
            "owner_slug": t["owner_slug"],
            "wins": t["wins"],
            "losses": t["losses"],
            "ties": t["ties"],
            "points_for": round(t["points_for"], 1),
            "points_against": round(t["points_against"], 1),
            "logo_url": "",
            "finish": t["finish"],
        })
    return rows


def weekly_results(season: dict, display_by_slug: dict[str, str]) -> dict[str, list[dict]]:
    """{slug: [WeekResult]} — same shape build_scores writes for ESPN years."""
    teams = team_index(season)
    out: dict[str, list[dict]] = {t["owner_slug"]: [] for t in season["teams"]}

    def res(a: float, b: float) -> str:
        return "W" if a > b else ("T" if a == b else "L")

    for g in season["games"]:
        h, a = g["home"], g["away"]
        if not h["score"] and not a["score"]:
            continue  # unplayed (e.g. locked-out consolation teams)
        for me, opp in ((h, a), (a, h)):
            mt, ot = teams[me["team_id"]], teams[opp["team_id"]]
            out[mt["owner_slug"]].append({
                "week": g["week"],
                "score": round(me["score"], 2),
                "team_name": mt["team_name"],
                "opponent": display_by_slug.get(ot["owner_slug"], ot["owner"]),
                "opponent_slug": ot["owner_slug"],
                "opponent_team": ot["team_name"],
                "opponent_score": round(opp["score"], 2),
                "result": res(me["score"], opp["score"]),
                "is_playoff": g["is_playoff"],
            })
    for weeks in out.values():
        weeks.sort(key=lambda w: w["week"])
    return out


def draft_by_slug(season: dict) -> dict[str, list[dict]]:
    teams = team_index(season)
    out: dict[str, list[dict]] = {}
    for p in season["draft"]:
        slug = teams[p["team_id"]]["owner_slug"]
        out.setdefault(slug, []).append({
            "round": p["round"], "pick": p["pick"],
            "player": p["player"], "position": p.get("position") or "",
        })
    for picks in out.values():
        picks.sort(key=lambda p: (p["round"], p["pick"]))
    return out


def trades_payload(season: dict, display_by_slug: dict[str, str]) -> dict:
    teams = team_index(season)
    trades = []
    for tr in season["trades"]:
        sides = []
        for s in tr["sides"]:
            t = teams[s["team_id"]]
            sides.append({
                "team_name": t["team_name"],
                "owner": display_by_slug.get(t["owner_slug"], t["owner"]),
                "owner_slug": t["owner_slug"],
                "gave": s["gave"], "got": s["got"],
            })
        trades.append({"date": tr["date"], "sides": sides})
    trades.sort(key=lambda t: t["date"])
    return {"year": season["year"], "count": len(trades), "trades": trades}


def faab_payload(season: dict, display_by_slug: dict[str, str]) -> dict:
    teams = team_index(season)
    txns = []
    for tx in season["transactions"]:
        t = teams[tx["team_id"]]
        txns.append({
            "week": tx["week"], "date": tx["date"],
            "owner": display_by_slug.get(t["owner_slug"], t["owner"]),
            "owner_slug": t["owner_slug"], "team_name": t["team_name"],
            "type": tx["type"], "bid": tx.get("bid", 0) or 0,
            "added": tx["added"], "dropped": tx["dropped"],
        })
    txns.sort(key=lambda t: (t["week"], t["date"]))
    totals = []
    for t in season["teams"]:
        totals.append({
            "owner": display_by_slug.get(t["owner_slug"], t["owner"]),
            "owner_slug": t["owner_slug"], "team_name": t["team_name"],
            "acquisitions": t.get("acquisitions", 0) or 0,
            "spent": t.get("faab_spent", 0) or 0,
        })
    totals.sort(key=lambda t: -t["spent"])
    return {"year": season["year"], "transactions": txns, "team_totals": totals}
