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

import requests as _requests
from espn_api.football import League

# ---------- Config ----------
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

    # Per-owner full-name label. Use "First Last" by default; only append a
    # disambiguator (#2, #3…) if two owners share the exact same full name
    # (extremely unlikely in a 12-person league).
    display_by_canonical: dict[str, str] = {}
    used_labels: set[str] = set()
    for cid in sorted(canonical_info, key=lambda c: (canonical_info[c][1].lower(), c)):
        first, last = canonical_info[cid]
        chosen = f"{first} {last}".strip() if last else first or "?"
        if chosen in used_labels:
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


def build_trades(
    leagues_by_year: dict[int, League],
    canonical_by_raw: dict,
    display_by_canonical: dict,
    slug_by_canonical: dict,
) -> None:
    """
    Reconstruct each season's accepted trades by diffing weekly roster snapshots.

    Why not use the proposal/accept tables? See "ESPN API gotchas" in AGENTS.md.
    Short version: ESPN's mTransactions2 view returns EXECUTED TRADE_ACCEPT
    records (which tell us a trade *happened* and *when*), but it does NOT
    return the corresponding accepted proposal — the player-movement data is
    only in /communication/ which we can't reach from Python. The CANCELED
    TRADE_PROPOSALs we *can* see are all genuine rejections, not the accepted
    ones, so any heuristic that matches accepts to those proposals is just
    guessing and will surface rejected trades to the user.

    Strategy per season year
    ────────────────────────
    1. Fetch mRoster for every scoringPeriodId (week) — gives us the per-week
       snapshot {playerId: teamId}.
    2. For each consecutive week pair (N, N+1), find players whose teamId
       changed.  Group those movements by team-pair.
    3. Any team-pair (A, B) with at least one movement A→B AND one B→A in the
       same week-transition is an executed trade.  This is robust: rejected
       proposals don't move any players, so they don't appear here.
    4. Cross-reference the resulting trades with EXECUTED TRADE_ACCEPT records
       from mTransactions2 to attach a real date (rosters don't carry one).
    5. Resolve team-ids → owner display names; player-ids → player names.
    """
    _lm = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl"
    cookies = {"espn_s2": ESPN_S2, "SWID": ESPN_SWID}
    # Fetch rosters through week 18 (covers trades up to and including week 17).
    WEEK_RANGE = range(1, 19)

    for yr, lg in sorted(leagues_by_year.items()):
        ep = f"{_lm}/seasons/{yr}/segments/0/leagues/{LEAGUE_ID}"

        # team_id → (owner_display, owner_slug, team_name)
        team_disp: dict[int, tuple[str, str, str]] = {}
        for team in lg.teams:
            raw_id = _raw_owner_id(team)
            cid = canonical_by_raw.get(raw_id, "")
            ow = display_by_canonical.get(cid, "?")
            slug = slug_by_canonical.get(cid, "unknown")
            team_disp[team.team_id] = (ow, slug, team.team_name)

        # player_id → name string (espn-api stores them as plain strings)
        player_map: dict[int, str] = getattr(lg, "player_map", {})

        def _pname(pid: int) -> str:
            name = player_map.get(pid)
            return str(name) if name else f"#{pid}"

        def _team_side(tid: int) -> dict:
            ow, slug, tname = team_disp.get(tid, ("?", "unknown", "?"))
            return {"team_name": tname, "owner": ow, "owner_slug": slug, "gave": [], "got": []}

        # ---- Step 1: weekly roster snapshots ----
        weekly_rosters: dict[int, dict[int, int]] = {}
        for week in WEEK_RANGE:
            try:
                r = _requests.get(
                    ep,
                    params={"view": "mRoster", "scoringPeriodId": week},
                    cookies=cookies,
                    timeout=20,
                )
                if r.ok:
                    snap: dict[int, int] = {}
                    for t in r.json().get("teams", []):
                        tid = t.get("id")
                        for entry in t.get("roster", {}).get("entries", []):
                            pid = entry.get("playerId")
                            if pid is not None and tid is not None:
                                snap[pid] = tid
                    weekly_rosters[week] = snap
            except Exception as exc:
                print(f"  ! roster fetch week {week} yr {yr}: {exc}")
            time.sleep(0.4)

        # ---- Step 2: detect player movements between consecutive weeks ----
        # detected_trades[week_after] = list of trades found at that week boundary
        detected_trades: list[dict] = []
        weeks_sorted = sorted(weekly_rosters.keys())
        for i in range(len(weeks_sorted) - 1):
            wa, wb = weeks_sorted[i], weeks_sorted[i + 1]
            ra, rb = weekly_rosters[wa], weekly_rosters[wb]
            # players that switched teams between wa and wb
            from collections import defaultdict
            pair_moves: dict[tuple[int, int], list[tuple[int, int, int]]] = defaultdict(list)
            for pid, ta in ra.items():
                tb = rb.get(pid)
                if tb is None or tb == ta:
                    continue
                pair = tuple(sorted([ta, tb]))
                pair_moves[pair].append((pid, ta, tb))
            # a real trade between A and B has at least one player A→B AND one B→A
            for (a, b), moves in pair_moves.items():
                a_to_b = [m for m in moves if m[1] == a and m[2] == b]
                b_to_a = [m for m in moves if m[1] == b and m[2] == a]
                if not (a_to_b and b_to_a):
                    continue  # one-directional: probably waiver/drop, not a trade
                sides = {a: _team_side(a), b: _team_side(b)}
                for pid, frm, to in a_to_b + b_to_a:
                    sides[frm]["gave"].append(_pname(pid))
                    sides[to]["got"].append(_pname(pid))
                detected_trades.append({
                    "week_after": wb,
                    "team_pair": (a, b),
                    "sides": list(sides.values()),
                })

        # ---- Step 3: get TRADE_ACCEPT timestamps to attach dates ----
        all_txns: dict[str, dict] = {}
        for week in WEEK_RANGE:
            try:
                r = _requests.get(
                    ep,
                    params={"view": "mTransactions2", "scoringPeriodId": week},
                    cookies=cookies,
                    timeout=15,
                )
                if r.ok:
                    for t in r.json().get("transactions", []):
                        all_txns[t["id"]] = t
            except Exception as exc:
                print(f"  ! txn fetch week {week} yr {yr}: {exc}")
            time.sleep(0.3)

        accepts = sorted(
            [t for t in all_txns.values()
             if t.get("type") == "TRADE_ACCEPT" and t.get("status") == "EXECUTED"],
            key=lambda t: t["proposedDate"],
        )

        # ---- Step 4: pair each detected trade with the matching TRADE_ACCEPT ----
        # For each detected trade, find an unused accept whose teamId is one of
        # the two teams and whose scoringPeriodId equals (or is closest to) the
        # week boundary where the trade was detected.
        used_accepts: set[str] = set()
        trades_out: list[dict] = []
        for det in detected_trades:
            a, b = det["team_pair"]
            wb = det["week_after"]
            cands = [
                ac for ac in accepts
                if ac["id"] not in used_accepts
                and ac["teamId"] in (a, b)
                and ac["scoringPeriodId"] in (wb - 1, wb)
            ]
            if not cands:
                cands = [
                    ac for ac in accepts
                    if ac["id"] not in used_accepts
                    and ac["teamId"] in (a, b)
                ]
                cands.sort(key=lambda ac: abs(ac["scoringPeriodId"] - wb))
            if cands:
                best = cands[0]
                used_accepts.add(best["id"])
                date_str = datetime.fromtimestamp(
                    best["proposedDate"] / 1000, tz=timezone.utc
                ).strftime("%Y-%m-%d")
            else:
                # fallback: no matching accept; use the week boundary
                date_str = f"{yr}-W{wb:02d}"
            trades_out.append({"date": date_str, "sides": det["sides"]})

        trades_out.sort(key=lambda t: t["date"], reverse=True)
        write_json(f"trades/{yr}.json", {
            "year": yr,
            "count": len(trades_out),
            "trades": trades_out,
        })
        print(f"  trades {yr}: {len(trades_out)} trades "
              f"({len(accepts)} accepts in API, {len(used_accepts)} matched)")


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


def build_scores(
    leagues_by_year: dict,
    canonical_by_raw: dict,
    display_by_canonical: dict,
    slug_by_canonical: dict,
) -> dict:
    """
    Fetch weekly matchup scores for every manager in every season.

    Calls lg.scoreboard(scoring_period=N) for weeks 1-18, collecting the
    team score and opponent for each matchup. Skips weeks where both sides
    scored 0 (unplayed / bye). Saves one file per manager per year:
        public/data/scores/{year}/{slug}.json
    Schema: { year, weeks: [{week, score, opponent, opponent_slug,
                              opponent_score, result, is_playoff}] }

    Returns: {year: {playerId: position}} — player positions gleaned from
    box score lineup slots, used by the draft-pick builder below.
    """
    positions_by_year: dict[int, dict[int, str]] = {}
    # h2h[my_slug][opp_slug] = {wins, losses, ties, pf, pa}
    h2h: dict[str, dict[str, dict]] = {}
    for yr, lg in sorted(leagues_by_year.items()):
        # Regular-season week count from league settings (default 14)
        reg_weeks = getattr(lg.settings, "reg_season_count", 14)

        # team_id -> (display, slug, team_name)
        team_disp: dict[int, tuple[str, str, str]] = {}
        for team in lg.teams:
            raw_id = _raw_owner_id(team)
            cid = canonical_by_raw.get(raw_id, "")
            team_disp[team.team_id] = (
                display_by_canonical.get(cid, "?"),
                slug_by_canonical.get(cid, "unknown"),
                team.team_name or "?",
            )

        scores_by_slug: dict[str, list] = {
            slug_by_canonical.get(canonical_by_raw.get(_raw_owner_id(t), ""), "unknown"): []
            for t in lg.teams
        }

        def _result(my: float, opp: float) -> str:
            return "W" if my > opp else ("T" if my == opp else "L")

        yr_positions: dict[int, str] = {}
        positions_by_year[yr] = yr_positions

        for week in range(1, 19):
            try:
                matchups = lg.box_scores(week)
            except Exception:
                break
            if not matchups:
                break

            # Collect playerId -> position from lineup slots
            for m in matchups:
                for lineup in (getattr(m, "home_lineup", []), getattr(m, "away_lineup", [])):
                    for pl in (lineup or []):
                        pid = getattr(pl, "playerId", None)
                        pos = getattr(pl, "position", "") or ""
                        if pid and pos and pid not in yr_positions:
                            yr_positions[pid] = pos

            for m in matchups:
                h_team = getattr(m, "home_team", None)
                a_team = getattr(m, "away_team", None)
                if h_team is None or a_team is None:
                    continue

                h_score = round(float(getattr(m, "home_score", 0) or 0), 2)
                a_score = round(float(getattr(m, "away_score", 0) or 0), 2)

                # Skip unplayed matchups
                if h_score == 0 and a_score == 0:
                    continue

                h_disp, h_slug, h_tname = team_disp.get(h_team.team_id, ("?", "unknown", "?"))
                a_disp, a_slug, a_tname = team_disp.get(a_team.team_id, ("?", "unknown", "?"))
                is_playoff = bool(getattr(m, "is_playoff", week > reg_weeks))

                if h_slug in scores_by_slug:
                    scores_by_slug[h_slug].append({
                        "week": week,
                        "score": h_score,
                        "team_name": h_tname,
                        "opponent": a_disp,
                        "opponent_slug": a_slug,
                        "opponent_team": a_tname,
                        "opponent_score": a_score,
                        "result": _result(h_score, a_score),
                        "is_playoff": is_playoff,
                    })
                if a_slug in scores_by_slug:
                    scores_by_slug[a_slug].append({
                        "week": week,
                        "score": a_score,
                        "team_name": a_tname,
                        "opponent": h_disp,
                        "opponent_slug": h_slug,
                        "opponent_team": h_tname,
                        "opponent_score": h_score,
                        "result": _result(a_score, h_score),
                        "is_playoff": is_playoff,
                    })

        total = 0
        for slug, weeks in scores_by_slug.items():
            if weeks:
                weeks.sort(key=lambda w: w["week"])

                # ESPN 2-week playoff matchups: box_scores() returns the same
                # cumulative score for BOTH weeks of the combined period
                # (e.g. wk 17 and wk 18 show identical scores). Deduplicate
                # by dropping any playoff week whose (opponent, score, opp_score)
                # triple was already seen in a previous week.
                deduped = []
                seen_playoff: set = set()
                for w in weeks:
                    if w["is_playoff"]:
                        key = (w["opponent_slug"], w["score"], w["opponent_score"])
                        if key in seen_playoff:
                            continue
                        seen_playoff.add(key)
                    deduped.append(w)

                write_json(f"scores/{yr}/{slug}.json", {"year": yr, "weeks": deduped})
                total += len(deduped)

                # Accumulate H2H — keyed by (my_slug, opp_slug)
                for w in deduped:
                    opp = w["opponent_slug"]
                    rec = h2h.setdefault(slug, {}).setdefault(opp, {
                        "opponent": w["opponent"],
                        "opponent_slug": opp,
                        "wins": 0, "losses": 0, "ties": 0,
                        "pf": 0.0, "pa": 0.0,
                    })
                    if w["result"] == "W":   rec["wins"]   += 1
                    elif w["result"] == "L": rec["losses"] += 1
                    else:                    rec["ties"]   += 1
                    rec["pf"] += w["score"]
                    rec["pa"] += w["opponent_score"]

        print(f"  scores {yr}: {total} matchup records across {len(scores_by_slug)} teams")

    # Write H2H files — one per manager, sorted by games played desc
    for slug, opponents in h2h.items():
        records = sorted(
            opponents.values(),
            key=lambda r: -(r["wins"] + r["losses"] + r["ties"]),
        )
        for r in records:
            r["pf"] = round(r["pf"], 2)
            r["pa"] = round(r["pa"], 2)
        write_json(f"h2h/{slug}.json", {"slug": slug, "records": records})
    print(f"  h2h: wrote {len(h2h)} files")

    return positions_by_year


def build_faab(
    leagues_by_year: dict,
    canonical_by_raw: dict,
    display_by_canonical: dict,
    slug_by_canonical: dict,
) -> None:
    """
    Pull free-agent + waiver transactions for every week of every season.

    Writes:
      public/data/faab/{year}.json — all transactions in chronological order
      public/data/faab/owners/{slug}.json — career FAAB profile per manager
    """
    from datetime import datetime, timezone

    # Aggregate per-owner across all seasons
    owners_data: dict[str, dict] = {}

    for yr, lg in sorted(leagues_by_year.items()):
        # team_id -> (display, slug, team_name)
        team_meta: dict[int, tuple[str, str, str]] = {}
        for t in lg.teams:
            raw_id = _raw_owner_id(t)
            cid = canonical_by_raw.get(raw_id, "")
            team_meta[t.team_id] = (
                display_by_canonical.get(cid, "?"),
                slug_by_canonical.get(cid, "unknown"),
                t.team_name or "?",
            )

        all_txns: list[dict] = []
        # Fetch transactions per week (ESPN's API is keyed by scoring_period)
        for week in range(1, 19):
            try:
                txns = lg.transactions(scoring_period=week)
            except Exception:
                continue
            if not txns:
                continue

            for tx in txns:
                if tx.status != "EXECUTED":
                    continue  # Skip failed/cancelled
                team = tx.team
                if team is None:
                    continue
                disp, slug, tname = team_meta.get(team.team_id, ("?", "unknown", "?"))

                added = [it.player for it in tx.items if it.type == "ADD"]
                dropped = [it.player for it in tx.items if it.type == "DROP"]

                # Skip "ROSTER" moves with no add (e.g. just dropping a player)
                if not added and not dropped:
                    continue

                # Convert ms timestamp to ISO date
                date_iso = datetime.fromtimestamp(
                    tx.date / 1000, tz=timezone.utc
                ).strftime("%Y-%m-%d")

                all_txns.append({
                    "week": week,
                    "date": date_iso,
                    "owner": disp,
                    "owner_slug": slug,
                    "team_name": tname,
                    "type": tx.type,           # "FREEAGENT" or "WAIVER"
                    "bid": int(tx.bid_amount or 0),
                    "added": added,
                    "dropped": dropped,
                })

        all_txns.sort(key=lambda t: (t["week"], t["date"]))

        # Per-team season totals from team object (sanity-check + cheap)
        team_totals = []
        for t in lg.teams:
            disp, slug, tname = team_meta[t.team_id]
            team_totals.append({
                "owner": disp,
                "owner_slug": slug,
                "team_name": tname,
                "acquisitions": getattr(t, "acquisitions", 0) or 0,
                "spent": getattr(t, "acquisition_budget_spent", 0) or 0,
            })
        team_totals.sort(key=lambda t: -t["spent"])

        write_json(f"faab/{yr}.json", {
            "year": yr,
            "transactions": all_txns,
            "team_totals": team_totals,
        })
        print(f"  faab {yr}: {len(all_txns)} transactions, {len(team_totals)} teams")

        # Roll up into per-owner career profile
        for tt in team_totals:
            slug = tt["owner_slug"]
            d = owners_data.setdefault(slug, {
                "slug": slug,
                "owner": tt["owner"],
                "totals": {
                    "acquisitions": 0, "spent": 0,
                    "biggest_bid": None,
                },
                "by_year": [],
            })
            d["totals"]["acquisitions"] += tt["acquisitions"]
            d["totals"]["spent"] += tt["spent"]
            d["by_year"].append({
                "year": yr,
                "team_name": tt["team_name"],
                "acquisitions": tt["acquisitions"],
                "spent": tt["spent"],
            })

        # Find biggest bid per manager from this year's transactions
        for tx in all_txns:
            if tx["bid"] <= 0:
                continue
            slug = tx["owner_slug"]
            d = owners_data.get(slug)
            if not d:
                continue
            cur = d["totals"]["biggest_bid"]
            if cur is None or tx["bid"] > cur["bid"]:
                d["totals"]["biggest_bid"] = {
                    "year": yr,
                    "week": tx["week"],
                    "bid": tx["bid"],
                    "player": tx["added"][0] if tx["added"] else "?",
                    "dropped": tx["dropped"][0] if tx["dropped"] else None,
                }

    # Write per-owner career FAAB files
    for slug, d in owners_data.items():
        d["by_year"].sort(key=lambda y: -y["year"])
        write_json(f"faab/owners/{slug}.json", d)
    print(f"  faab: wrote {len(owners_data)} per-owner files")


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

    # Merge legacy championships (pre-ESPN-data seasons, manually maintained)
    # Only bumps the title count — no placeholder seasons injected, since those
    # leagues are deleted and we have no real data for them.
    legacy_path = OUT_DIR / "legacy_champions.json"
    if legacy_path.exists():
        legacy: dict[str, list[int]] = json.loads(legacy_path.read_text(encoding="utf-8"))
        for slug, yrs in legacy.items():
            if slug in careers:
                careers[slug]["titles"] += len(yrs)
        print(f"  legacy champions merged: {legacy}")

    write_json("careers.json", {
        "owners": sorted(careers.values(), key=lambda x: -x["win_pct"]),
    })

    # Per-owner files
    for slug, d in careers.items():
        write_json(f"owners/{slug}.json", d)

    write_json("history.json", {
        "seasons": sorted(history, key=lambda x: -x["year"]),
    })

    # ---------- weekly scores (runs first so we get playerId->position map) ----------
    player_positions: dict[int, dict[int, str]] = {}
    try:
        player_positions = build_scores(leagues_by_year, canonical_by_raw, display_by_canonical, slug_by_canonical)
    except Exception as e:
        print(f"  ! scores error: {e}")

    # ---------- draft picks (one file per owner per year) ----------
    for yr, lg in leagues_by_year.items():
        try:
            draft_picks = lg.draft  # list of Pick objects
        except Exception as e:
            print(f"  ! no draft data for {yr}: {e}")
            continue
        if not draft_picks:
            print(f"  ! empty draft for {yr}")
            continue

        yr_pos_map = player_positions.get(yr, {})

        picks_by_slug: dict[str, list] = {}
        for pick in draft_picks:
            team = getattr(pick, "team", None)
            if team is None:
                continue
            raw_id = _raw_owner_id(team)
            cid = canonical_by_raw.get(raw_id, "")
            slug = slug_by_canonical.get(cid, "unknown")

            player_name = getattr(pick, "playerName", "") or ""
            round_num   = getattr(pick, "round_num", 0) or 0
            round_pick  = getattr(pick, "round_pick", 0) or 0
            player_id   = getattr(pick, "playerId", None)

            # Look up position from box-score lineup data (pick.player doesn't exist)
            position = yr_pos_map.get(player_id, "") if player_id else ""

            picks_by_slug.setdefault(slug, []).append({
                "round":  round_num,
                "pick":   round_pick,
                "player": player_name,
                "position": position,
            })

        total = sum(len(v) for v in picks_by_slug.values())

        # Slug -> display name reverse lookup
        slug_to_display = {v: display_by_canonical[k]
                           for k, v in slug_by_canonical.items()
                           if k in display_by_canonical}
        # Slug -> team name for this year
        slug_to_team: dict[str, str] = {}
        for t in lg.teams:
            raw_id = _raw_owner_id(t)
            cid = canonical_by_raw.get(raw_id, "")
            s = slug_by_canonical.get(cid, "unknown")
            slug_to_team[s] = t.team_name or "?"

        for slug, picks in picks_by_slug.items():
            picks.sort(key=lambda p: (p["round"], p["pick"]))
            write_json(f"drafts/{yr}/{slug}.json", picks)

        # Draft board: one file per year with all picks in slot order
        # Draft slot = pick number in round 1 (snake draft)
        slot_by_slug: dict[str, int] = {}
        for s, picks in picks_by_slug.items():
            r1 = next((p for p in picks if p["round"] == 1), None)
            if r1:
                slot_by_slug[s] = r1["pick"]

        max_round = max(
            (p["round"] for picks in picks_by_slug.values() for p in picks),
            default=0
        )

        board_slots = []
        for s in sorted(slot_by_slug, key=lambda x: slot_by_slug[x]):
            round_picks = sorted(picks_by_slug[s], key=lambda p: p["round"])
            board_slots.append({
                "slot":       slot_by_slug[s],
                "owner":      slug_to_display.get(s, "?"),
                "owner_slug": s,
                "team_name":  slug_to_team.get(s, "?"),
                "picks": [
                    {"round": p["round"], "player": p["player"], "position": p["position"]}
                    for p in round_picks
                ],
            })

        write_json(f"draft_board/{yr}.json", {
            "year": yr, "rounds": max_round, "slots": board_slots,
        })
        print(f"  draft {yr}: {total} picks across {len(picks_by_slug)} teams")

    # ---------- trades ----------
    try:
        build_trades(leagues_by_year, canonical_by_raw, display_by_canonical, slug_by_canonical)
    except Exception as e:
        print(f"  ! trades error: {e}")

    # ---------- FAAB / waivers ----------
    try:
        build_faab(leagues_by_year, canonical_by_raw, display_by_canonical, slug_by_canonical)
    except Exception as e:
        print(f"  ! faab error: {e}")

    print(f"\nDone in {time.time()-started:.1f}s. Files in {OUT_DIR}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        raise
