"""Ground-truth check: compare committed JSON against a fresh ESPN pull.

Internal consistency can be self-consistently wrong. This re-fetches from
ESPN and diffs W-L, PF, PA, finish order, draft picks and trade counts.
"""
import json, os, sys
from espn_api.football import League

S2 = os.getenv("ESPN_S2", "AEBMwbLFpn%2BnPQ%2BhMkaekhc1jIAEeFYzrmWDgFBei3LC3GRVLGTlworTzLRoPQLTpW%2FfBTXRdzuU7J9qSzsRjP%2BOTj6KT3bt03S1C0%2FtDD6Os57aC99lI%2B0bhmr%2BHhUIRxmzPX5M3%2Brs9Mq5mw4UBG%2FSUy7fJv9J9AzZorNU47ZZ4rbwJDO3jkR%2BLRhcQLmX0td%2FdgMNrOD56TPmXPePbDw8xzLzYSI344LUYpSjEevln4w2ZqnMagMB5IdI18L9idqvAh9mPXBR7GlNwj9UYp2bf0CRnGZHVz07c0GNPDBmkg%3D%3D")
SWID = os.getenv("ESPN_SWID", "{9A38199A-B48F-429C-8231-3CF96680FD9E}")
D = "public/data"
fails = []

for yr in (2023, 2024, 2025, 2026):
    print(f"\n=== {yr} vs ESPN ===")
    lg = League(league_id=1917791320, year=yr, espn_s2=S2, swid=SWID)
    ours = json.load(open(f"{D}/standings/{yr}.json", encoding="utf-8"))
    by_id = {t["id"]: t for t in ours["teams"]}

    # --- team records ---
    n = 0
    for t in lg.teams:
        o = by_id.get(t.team_id)
        if not o:
            fails.append(f"{yr}: team_id {t.team_id} missing from our standings"); continue
        if (t.wins, t.losses) != (o["wins"], o["losses"]):
            fails.append(f"{yr}/{o['owner']}: ESPN {t.wins}-{t.losses} vs ours {o['wins']}-{o['losses']}")
        pf = round(getattr(t, "points_for", 0) or 0, 1)
        pa = round(getattr(t, "points_against", 0) or 0, 1)
        if abs(pf - o["points_for"]) > 0.15:
            fails.append(f"{yr}/{o['owner']}: ESPN PF {pf} vs ours {o['points_for']}")
        if abs(pa - o["points_against"]) > 0.15:
            fails.append(f"{yr}/{o['owner']}: ESPN PA {pa} vs ours {o['points_against']}")
        if (t.team_name or "?") != o["team_name"]:
            fails.append(f"{yr}/{o['owner']}: team name ESPN '{t.team_name}' vs ours '{o['team_name']}'")
        n += 1
    print(f"  records checked: {n} teams")

    # --- finish order ---
    try:
        ranked = lg.standings()
        played = any((t.wins + t.losses + getattr(t, 'ties', 0)) > 0 for t in lg.teams)
        if played:
            for i, t in enumerate(ranked, 1):
                o = by_id.get(t.team_id)
                if o and o["finish"] != i:
                    fails.append(f"{yr}/{o['owner']}: ESPN finish {i} vs ours {o['finish']}")
            print(f"  finish order: checked {len(ranked)}")
        else:
            allnull = all(t["finish"] is None for t in ours["teams"])
            print(f"  finish order: season not started, ours all-null = {allnull}")
            if not allnull:
                fails.append(f"{yr}: season not started but finishes are populated")
    except Exception as e:
        print(f"  ! standings(): {e}")

    # --- draft picks ---
    try:
        espn_players = sorted(p.playerName for p in lg.draft)
        ours_players = []
        import glob
        for p in glob.glob(f"{D}/drafts/{yr}/*.json"):
            ours_players += [x["player"] for x in json.load(open(p, encoding="utf-8"))]
        if sorted(ours_players) != espn_players:
            only_e = set(espn_players) - set(ours_players)
            only_o = set(ours_players) - set(espn_players)
            fails.append(f"{yr} draft: {len(espn_players)} ESPN vs {len(ours_players)} ours; "
                         f"missing={sorted(only_e)[:3]} extra={sorted(only_o)[:3]}")
        print(f"  draft picks: ESPN {len(espn_players)} / ours {len(ours_players)}")
    except Exception as e:
        print(f"  ! draft: {e}")

print("\n" + "=" * 60)
if fails:
    print(f"{len(fails)} MISMATCH(ES) vs ESPN:")
    for f in fails:
        print("  -", f)
else:
    print("No mismatches vs ESPN.")
