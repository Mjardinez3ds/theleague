"""
Capture one COMPLETED season from a different (old) ESPN league into
archive/{year}/season.json, so build_data.py merges it like any other year.

    py -3 scripts/capture_espn_season.py <league_id> <year>
    py -3 scripts/capture_espn_season.py 16607371 2019

Run once. The archive is the source of truth afterwards. Old leagues get
deleted (the 2022 league did), and then nothing can be re-fetched.

Reuses build_data.py's ESPN logic for owner identity, trades (roster-diff
reconstruction) and waiver moves by temporarily pointing it at the other
league and capturing what it would have written.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import build_data as b
from espn_api.football import League

ROOT = Path(__file__).resolve().parent.parent


def main(league_id: int, year: int) -> None:
    lg = League(league_id=league_id, year=year, espn_s2=b.ESPN_S2, swid=b.ESPN_SWID)
    if any((getattr(t, "final_standing", 0) or 0) == 0 for t in lg.teams):
        sys.exit(f"{year} in league {league_id} isn't finished (final_standing 0). Only completed seasons.")

    canon, disp, slugs = b.build_owner_resolution({year: list(lg.teams)})

    def owner(t):
        cid = canon.get(b._raw_owner_id(t), "")
        return disp.get(cid, "?"), slugs.get(cid, "unknown")

    reg_weeks = getattr(lg.settings, "reg_season_count", 13)
    teams = []
    for t in lg.teams:
        name, slug = owner(t)
        teams.append({
            "id": t.team_id, "team_name": t.team_name, "owner": name, "owner_slug": slug,
            "wins": t.wins, "losses": t.losses, "ties": getattr(t, "ties", 0),
            "points_for": round(t.points_for, 2), "points_against": round(t.points_against, 2),
            "finish": t.final_standing,
            "acquisitions": getattr(t, "acquisitions", 0) or 0,
            "faab_spent": getattr(t, "acquisition_budget_spent", 0) or 0,
            "trades": getattr(t, "trades", 0) or 0,
        })
    teams.sort(key=lambda t: t["finish"])
    slug_to_id = {t["owner_slug"]: t["id"] for t in teams}

    # Games with full lineups. ESPN repeats a 2-week playoff matchup's
    # cumulative score in both weeks. Keep the first, like build_scores.
    games, seen = [], set()
    positions: dict[int, str] = {}
    final_week = reg_weeks
    for week in range(1, 19):
        try:
            box = lg.box_scores(week)
        except Exception:
            break
        if not box:
            break
        for m in box:
            if m.home_team is None or m.away_team is None or (not m.home_score and not m.away_score):
                continue
            is_po = bool(getattr(m, "is_playoff", week > reg_weeks))
            key = (m.home_team.team_id, m.away_team.team_id, round(m.home_score, 2), round(m.away_score, 2))
            if is_po and key in seen:
                continue
            seen.add(key)
            final_week = max(final_week, week)

            def side(team, score, proj, lineup):
                rows = []
                for p in lineup or []:
                    if p.playerId and p.position:
                        positions.setdefault(p.playerId, p.position)
                    rows.append({"slot": p.slot_position, "player": p.name, "player_id": p.playerId,
                                 "position": p.position, "pts": p.points, "proj": p.projected_points})
                return {"team_id": team.team_id, "score": round(score, 2),
                        "projected": round(proj or 0, 2), "lineup": rows}

            games.append({"week": week, "is_playoff": is_po,
                          "home": side(m.home_team, m.home_score, m.home_projected, m.home_lineup),
                          "away": side(m.away_team, m.away_score, m.away_projected, m.away_lineup)})

    draft = []
    for i, p in enumerate(lg.draft, 1):
        pos = positions.get(p.playerId, "")
        if not pos and p.playerId:
            try:
                pos = getattr(lg.player_info(playerId=p.playerId), "position", "") or ""
            except Exception:
                pass
        draft.append({"round": p.round_num, "pick": p.round_pick, "overall": i, "team_id": p.team.team_id,
                      "player": p.playerName, "player_id": p.playerId, "position": pos})

    # Trades + waiver moves: run build_data's own builders against this
    # league and capture their output instead of writing files.
    captured: dict[str, dict] = {}
    real_write, real_id = b.write_json, b.LEAGUE_ID
    b.write_json = lambda rel, data: captured.__setitem__(rel, data)
    b.LEAGUE_ID = league_id
    try:
        b.build_trades({year: lg}, canon, disp, slugs)
        b.build_faab({year: lg}, canon, disp, slugs)
    finally:
        b.write_json, b.LEAGUE_ID = real_write, real_id

    trades = [{"date": tr["date"], "sides": [{"team_id": slug_to_id[s["owner_slug"]], "gave": s["gave"], "got": s["got"]}
                                             for s in tr["sides"]]}
              for tr in captured.get(f"trades/{year}.json", {}).get("trades", [])]
    transactions = [{"date": tx["date"], "week": tx["week"], "team_id": slug_to_id[tx["owner_slug"]],
                     "type": tx["type"], "bid": tx["bid"], "added": tx["added"], "dropped": tx["dropped"]}
                    for tx in captured.get(f"faab/{year}.json", {}).get("transactions", [])]

    season = {
        "year": year, "source": "espn", "source_league_id": league_id,
        "league_name": lg.settings.name, "reg_season_weeks": reg_weeks, "final_week": final_week,
        "teams": teams, "games": games, "draft": draft,
        "transactions": transactions, "trades": trades,
    }
    out = ROOT / "archive" / str(year) / "season.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(season, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)}: {len(teams)} teams, {len(games)} games, "
          f"{len(draft)} picks, {len(transactions)} transactions, {len(trades)} trades")


if __name__ == "__main__":
    main(int(sys.argv[1]), int(sys.argv[2]))
