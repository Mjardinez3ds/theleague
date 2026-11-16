# Archived seasons (not on ESPN)

League years played somewhere other than the current ESPN league. They're
captured once by hand, and `scripts/build_data.py` merges them into every
site dataset on each run (see `scripts/archive_seasons.py`).

| Year | Source | League | How it was captured |
|---|---|---|---|
| 2021 | Yahoo | "The NFTFF League", Yahoo league id `1272267` | Read from the logged-in Yahoo web pages through Claude in Chrome on 2026-11-16 (Yahoo's API now requires an approved developer app, so it was unusable). |

## Layout

```
archive/{year}/season.json      normalized season, the file build_data.py reads
archive/{year}/raw.json.gz      the source pages (main content HTML), for re-parsing
archive/{year}/parse_yahoo.js   raw -> season.json (re-runnable, browser console)
```

## `season.json` shape

```jsonc
{
  "year": 2021, "source": "yahoo", "source_league_id": 1272267,
  "league_name": "The NFTFF League",
  "reg_season_weeks": 14, "final_week": 17,
  "teams": [{ "id", "team_name", "owner", "owner_slug", "wins", "losses", "ties",
              "points_for", "points_against", "finish", "acquisitions", "faab_spent", "trades" }],
  "games": [{ "week", "is_playoff",
              "home": { "team_id", "score", "projected", "lineup": [{ "slot", "player", "player_id", "position", "pts", "proj" }] },
              "away": { ... } }],
  "draft": [{ "round", "pick", "overall", "team_id", "player", "player_id", "position" }],
  "transactions": [{ "date", "week", "team_id", "type", "bid", "added", "dropped" }],
  "trades": [{ "date", "sides": [{ "team_id", "gave", "got" }] }]
}
```

`owner_slug` must match the ESPN slug when the manager also played on ESPN,
so careers, H2H and profiles join up. Managers who never played on ESPN get
a new slug and their own profile page.
