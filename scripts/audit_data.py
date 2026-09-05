"""Data-integrity audit for theleague-web public/data.

Cross-checks every dataset the site renders against its own sources.
Prints PASS/FAIL per check with concrete failing rows.
"""
import json, os, glob, sys
from collections import defaultdict, Counter

D = "public/data"
FAILS = []
NOTES = []


def load(p):
    with open(os.path.join(D, p), encoding="utf-8") as f:
        return json.load(f)


def exists(p):
    return os.path.exists(os.path.join(D, p))


def check(name, ok, detail=""):
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  -> {detail}" if detail and not ok else ""))
    if not ok:
        FAILS.append((name, detail))


def near(a, b, tol=0.15):
    return abs(a - b) <= tol


meta = load("league.json")
YEARS = meta["years"]
careers = {o["slug"]: o for o in load("careers.json")["owners"]}
legacy = load("legacy_champions.json")
standings = {y: load(f"standings/{y}.json") for y in YEARS if exists(f"standings/{y}.json")}
history = {s["year"]: s for s in load("history.json")["seasons"]}

print("=" * 70)
print(f"league.json: current_year={meta['current_year']} years={YEARS} teams={meta['team_count']}")
print("=" * 70)

# ---------- 1. league.json years vs files on disk ----------
print("\n[1] league.json years vs files on disk")
on_disk = sorted(int(os.path.basename(p)[:-5]) for p in glob.glob(f"{D}/standings/*.json"))
check("years match standings files", sorted(YEARS) == on_disk, f"meta={sorted(YEARS)} disk={on_disk}")

# ---------- 2. Referential integrity: every slug resolves to a profile ----------
print("\n[2] Referential integrity (every referenced slug has owners/{slug}.json)")
referenced = defaultdict(set)
for y, st in standings.items():
    for t in st["teams"]:
        referenced[t["owner_slug"]].add(f"standings/{y}")
for y in YEARS:
    if exists(f"trades/{y}.json"):
        for tr in load(f"trades/{y}.json")["trades"]:
            for s in tr["sides"]:
                referenced[s["owner_slug"]].add(f"trades/{y}")
    if exists(f"faab/{y}.json"):
        for tx in load(f"faab/{y}.json")["transactions"]:
            referenced[tx["owner_slug"]].add(f"faab/{y}")
for p in glob.glob(f"{D}/h2h/*.json"):
    for r in json.load(open(p, encoding="utf-8"))["records"]:
        referenced[r["opponent_slug"]].add("h2h")
missing = {s: sorted(v) for s, v in referenced.items() if not exists(f"owners/{s}.json")}
check("all referenced slugs have a profile", not missing, str(missing))
orphan = [s for s in careers if s not in referenced]
check("no profile pages orphaned from all data", not orphan, str(orphan))

# ---------- 3. careers.json vs owners/{slug}.json ----------
print("\n[3] careers.json entries identical to owners/{slug}.json")
bad = []
for slug, c in careers.items():
    if not exists(f"owners/{slug}.json"):
        bad.append(f"{slug}: no file"); continue
    if load(f"owners/{slug}.json") != c:
        bad.append(slug)
check("careers.json == owners/*.json", not bad, str(bad))

# ---------- 4. standings rows == career season rows ----------
print("\n[4] standings/{year} rows match career season entries")
bad = []
for y, st in standings.items():
    for t in st["teams"]:
        c = careers.get(t["owner_slug"])
        se = next((s for s in c["seasons"] if s["year"] == y), None) if c else None
        if se is None:
            bad.append(f"{y}/{t['owner_slug']}: missing season"); continue
        for k in ("wins", "losses", "ties", "finish"):
            if se[k] != t[k]:
                bad.append(f"{y}/{t['owner_slug']}.{k}: standings={t[k]} career={se[k]}")
        for k in ("points_for", "points_against"):
            if not near(se[k], t[k]):
                bad.append(f"{y}/{t['owner_slug']}.{k}: standings={t[k]} career={se[k]}")
check("standings == careers per season", not bad, "; ".join(bad[:6]))

# ---------- 5. career aggregates == sum of their seasons ----------
print("\n[5] career totals == sum of season rows")
bad = []
for slug, c in careers.items():
    for k in ("wins", "losses", "ties"):
        tot = sum(s[k] for s in c["seasons"])
        if tot != c[k]:
            bad.append(f"{slug}.{k}: total={c[k]} sum={tot}")
    for k in ("points_for", "points_against"):
        tot = sum(s[k] for s in c["seasons"])
        if not near(tot, c[k], 0.5):
            bad.append(f"{slug}.{k}: total={c[k]} sum={round(tot,1)}")
    g = c["wins"] + c["losses"] + c["ties"]
    if g != c["games"]:
        bad.append(f"{slug}.games: {c['games']} != {g}")
    exp = round((c["wins"] + 0.5 * c["ties"]) / g * 100, 1) if g else 0
    if not near(exp, c["win_pct"], 0.11):
        bad.append(f"{slug}.win_pct: {c['win_pct']} != {exp}")
check("aggregates consistent", not bad, "; ".join(bad[:6]))

print("\n[5b] titles/runners_up/thirds/lasts == counted finishes (+legacy)")
bad = []
for slug, c in careers.items():
    fin = [s["finish"] for s in c["seasons"]]
    exp_t = sum(1 for f in fin if f == 1) + len(legacy.get(slug, []))
    if exp_t != c["titles"]:
        bad.append(f"{slug}.titles: {c['titles']} != {exp_t} (career={sum(1 for f in fin if f==1)} legacy={len(legacy.get(slug,[]))})")
    for k, n in (("runners_up", 2), ("thirds", 3)):
        e = sum(1 for f in fin if f == n)
        if e != c[k]:
            bad.append(f"{slug}.{k}: {c[k]} != {e}")
    e = sum(1 for s in c["seasons"] if s["finish"] and s["finish"] == s["league_size"])
    if e != c["lasts"]:
        bad.append(f"{slug}.lasts: {c['lasts']} != {e}")
check("trophy counts", not bad, "; ".join(bad[:8]))

# ---------- 6. history.json == standings podium ----------
print("\n[6] history.json podium matches standings order")
bad = []
for y, st in standings.items():
    h = history.get(y)
    if not h:
        bad.append(f"{y}: missing history entry"); continue
    rows = sorted([t for t in st["teams"] if t["finish"]], key=lambda x: x["finish"])
    exp = {
        "champion": rows[0] if rows else None,
        "runner_up": rows[1] if len(rows) > 1 else None,
        "third": rows[2] if len(rows) > 2 else None,
        "last": rows[-1] if rows else None,
    }
    for k, v in exp.items():
        got = h[k]
        if (v is None) != (got is None):
            bad.append(f"{y}.{k}: presence mismatch"); continue
        if v and got["owner_slug"] != v["owner_slug"]:
            bad.append(f"{y}.{k}: history={got['owner_slug']} standings={v['owner_slug']}")
check("history == standings", not bad, "; ".join(bad[:6]))

# ---------- 7. League-wide PF == PA per season ----------
print("\n[7] League-wide points_for == points_against per season (zero-sum)")
bad = []
for y, st in standings.items():
    pf = sum(t["points_for"] for t in st["teams"])
    pa = sum(t["points_against"] for t in st["teams"])
    if not near(pf, pa, 1.0):
        bad.append(f"{y}: PF={round(pf,1)} PA={round(pa,1)} delta={round(pf-pa,1)}")
check("PF/PA symmetry", not bad, "; ".join(bad))

# ---------- 8. scores/{year}/{slug}: regular season == career W-L ----------
print("\n[8] scores weekly results reconcile with season W-L")
bad = []
for y in YEARS:
    for slug, c in careers.items():
        p = f"scores/{y}/{slug}.json"
        se = next((s for s in c["seasons"] if s["year"] == y), None)
        if not exists(p):
            if se and (se["wins"] + se["losses"]) > 0:
                bad.append(f"{y}/{slug}: played {se['wins']}-{se['losses']} but NO scores file")
            continue
        wk = load(p)["weeks"]
        reg = [w for w in wk if not w["is_playoff"]]
        w_ = sum(1 for x in reg if x["result"] == "W")
        l_ = sum(1 for x in reg if x["result"] == "L")
        t_ = sum(1 for x in reg if x["result"] == "T")
        if se and (w_, l_, t_) != (se["wins"], se["losses"], se["ties"]):
            bad.append(f"{y}/{slug}: scores reg {w_}-{l_}-{t_} vs season {se['wins']}-{se['losses']}-{se['ties']}")
        if se:
            pf = sum(x["score"] for x in reg)
            if not near(pf, se["points_for"], 0.5):
                bad.append(f"{y}/{slug}: scores PF {round(pf,1)} vs season {se['points_for']}")
check("scores == season record (regular season)", not bad, "; ".join(bad[:8]))

# ---------- 9. h2h == aggregate of scores (incl playoffs) ----------
print("\n[9] h2h totals == aggregate of all scores files (playoffs included)")
agg = defaultdict(lambda: defaultdict(lambda: [0, 0, 0, 0.0, 0.0]))
for y in YEARS:
    for p in glob.glob(f"{D}/scores/{y}/*.json"):
        slug = os.path.basename(p)[:-5]
        for w in json.load(open(p, encoding="utf-8"))["weeks"]:
            a = agg[slug][w["opponent_slug"]]
            if w["result"] == "W": a[0] += 1
            elif w["result"] == "L": a[1] += 1
            else: a[2] += 1
            a[3] += w["score"]; a[4] += w["opponent_score"]
bad = []
for p in glob.glob(f"{D}/h2h/*.json"):
    slug = os.path.basename(p)[:-5]
    for r in json.load(open(p, encoding="utf-8"))["records"]:
        e = agg[slug].get(r["opponent_slug"])
        if not e:
            bad.append(f"{slug} vs {r['opponent_slug']}: in h2h, absent from scores"); continue
        if (r["wins"], r["losses"], r["ties"]) != (e[0], e[1], e[2]):
            bad.append(f"{slug} vs {r['opponent_slug']}: h2h {r['wins']}-{r['losses']} scores {e[0]}-{e[1]}")
        if not near(r["pf"], e[3], 0.5):
            bad.append(f"{slug} vs {r['opponent_slug']}: pf {r['pf']} vs {round(e[3],2)}")
    got = {r["opponent_slug"] for r in json.load(open(p, encoding="utf-8"))["records"]}
    for opp in agg[slug]:
        if opp not in got:
            bad.append(f"{slug} vs {opp}: in scores, missing from h2h")
check("h2h == scores", not bad, "; ".join(bad[:8]))

print("\n[9b] h2h symmetry (A vs B mirrors B vs A)")
h2h = {os.path.basename(p)[:-5]: {r["opponent_slug"]: r for r in json.load(open(p, encoding="utf-8"))["records"]}
       for p in glob.glob(f"{D}/h2h/*.json")}
bad = []
for a, opps in h2h.items():
    for b, r in opps.items():
        rev = h2h.get(b, {}).get(a)
        if not rev:
            bad.append(f"{a} vs {b}: no reverse record"); continue
        if (r["wins"], r["losses"]) != (rev["losses"], rev["wins"]):
            bad.append(f"{a}/{b}: {r['wins']}-{r['losses']} vs reverse {rev['wins']}-{rev['losses']}")
        if not near(r["pf"], rev["pa"], 0.5):
            bad.append(f"{a}/{b}: pf {r['pf']} != reverse pa {rev['pa']}")
check("h2h mirrors", not bad, "; ".join(bad[:8]))

# ---------- 10. drafts vs draft_board ----------
print("\n[10] drafts/{year}/{slug} == draft_board/{year}")
bad = []
for y in YEARS:
    if not exists(f"draft_board/{y}.json"):
        NOTES.append(f"no draft_board for {y}"); continue
    b = load(f"draft_board/{y}.json")
    for s in b["slots"]:
        slug = s["owner_slug"]
        if not exists(f"drafts/{y}/{slug}.json"):
            bad.append(f"{y}/{slug}: board slot but no drafts file"); continue
        picks = load(f"drafts/{y}/{slug}.json")
        bp = [(p["round"], p["player"]) for p in s["picks"]]
        dp = [(p["round"], p["player"]) for p in picks]
        if sorted(bp) != sorted(dp):
            bad.append(f"{y}/{slug}: board {len(bp)} picks vs drafts {len(dp)}")
check("draft board == per-owner drafts", not bad, "; ".join(bad[:6]))

print("\n[10b] draft completeness + duplicate players")
bad = []
for y in YEARS:
    files = glob.glob(f"{D}/drafts/{y}/*.json")
    if not files: continue
    allp = []
    for p in files:
        allp += [x["player"] for x in json.load(open(p, encoding="utf-8"))]
    dupes = {x for x in allp if allp.count(x) > 1}
    if dupes:
        bad.append(f"{y}: player drafted twice: {sorted(dupes)[:5]}")
    rounds = load(f"draft_board/{y}.json")["rounds"] if exists(f"draft_board/{y}.json") else None
    if rounds and len(allp) != rounds * len(files):
        bad.append(f"{y}: {len(allp)} picks != {rounds} rounds x {len(files)} teams")
check("no duplicate picks / full board", not bad, "; ".join(bad[:6]))

# ---------- 11. trades structure ----------
print("\n[11] trades structural validity + gave/got mirroring")
bad = []
for y in YEARS:
    if not exists(f"trades/{y}.json"): continue
    t = load(f"trades/{y}.json")
    if t["count"] != len(t["trades"]):
        bad.append(f"{y}: count={t['count']} but {len(t['trades'])} trades")
    for i, tr in enumerate(t["trades"]):
        sides = tr["sides"]
        if len(sides) < 2:
            bad.append(f"{y}#{i}: {len(sides)} side(s)"); continue
        if len(sides) == 2:
            a, b = sides
            if sorted(a["gave"]) != sorted(b["got"]) or sorted(b["gave"]) != sorted(a["got"]):
                bad.append(f"{y}#{i}: gave/got not mirrored ({a['owner_slug']}/{b['owner_slug']})")
        for s in sides:
            if not s["gave"] and not s["got"]:
                bad.append(f"{y}#{i}: side {s['owner_slug']} empty both ways")
        if len({s["owner_slug"] for s in sides}) != len(sides):
            bad.append(f"{y}#{i}: same owner on both sides")
check("trades well-formed", not bad, "; ".join(bad[:8]))

# ---------- 12. faab reconciliation ----------
# NOTE: faab/owners *_totals come from ESPN's own team counters
# (team.acquisitions / acquisition_budget_spent), NOT from summing the
# transaction list -- two independent sources. So compare each to itself:
# owners rollup == faab/{year} team_totals, and separately flag duplicate
# transaction rows (the 2026 scoring_period bug).
print("\n[12] faab/owners rollup == faab/{year} team_totals")
bad = []
per = defaultdict(dict)
for y in YEARS:
    if not exists(f"faab/{y}.json"): continue
    for tt in load(f"faab/{y}.json")["team_totals"]:
        per[tt["owner_slug"]][y] = [tt["acquisitions"], tt["spent"]]
for p in glob.glob(f"{D}/faab/owners/*.json"):
    slug = os.path.basename(p)[:-5]
    d = json.load(open(p, encoding="utf-8"))
    for row in d["by_year"]:
        y = row["year"]
        e = per[slug].get(y, [0, 0])
        if row["acquisitions"] != e[0]:
            bad.append(f"{slug}/{y}: acq {row['acquisitions']} != {e[0]}")
        if row["spent"] != e[1]:
            bad.append(f"{slug}/{y}: spent {row['spent']} != {e[1]}")
    ta = sum(r["acquisitions"] for r in d["by_year"])
    ts = sum(r["spent"] for r in d["by_year"])
    if d["totals"]["acquisitions"] != ta:
        bad.append(f"{slug}: totals.acq {d['totals']['acquisitions']} != {ta}")
    if d["totals"]["spent"] != ts:
        bad.append(f"{slug}: totals.spent {d['totals']['spent']} != {ts}")
check("faab reconciles", not bad, "; ".join(bad[:8]))

print("\n[12b] no duplicate transaction rows (ESPN scoring_period bug)")
bad = []
for y in YEARS:
    if not exists(f"faab/{y}.json"): continue
    tx = load(f"faab/{y}.json")["transactions"]
    seen = Counter((t["owner_slug"], t["date"], t["type"], t["bid"],
                    tuple(t["added"]), tuple(t["dropped"])) for t in tx)
    extra = sum(v - 1 for v in seen.values() if v > 1)
    if extra:
        worst = max(seen.items(), key=lambda x: x[1])
        bad.append(f"{y}: {len(tx)} rows but {len(seen)} unique ({extra} redundant, worst x{worst[1]})")
check("no duplicate faab rows", not bad, "; ".join(bad))

# ---------- 13. coverage gaps ----------
print("\n[13] Per-year dataset coverage")
for y in YEARS:
    row = []
    for kind, pat in (("standings", f"standings/{y}.json"), ("board", f"draft_board/{y}.json"),
                      ("trades", f"trades/{y}.json"), ("faab", f"faab/{y}.json")):
        row.append(f"{kind}={'Y' if exists(pat) else 'N'}")
    for kind, g in (("drafts", f"drafts/{y}/*.json"), ("scores", f"scores/{y}/*.json"),
                    ("grades", f"draft_grades/{y}/*.json")):
        row.append(f"{kind}={len(glob.glob(f'{D}/{g}'))}")
    print("   ", y, " ".join(row))

# ---------- 14. draft_grades sanity ----------
print("\n[14] draft_grades internal consistency")
bad = []
for y in YEARS:
    files = glob.glob(f"{D}/draft_grades/{y}/*.json")
    if not files: continue
    ranks = []
    for p in files:
        d = json.load(open(p, encoding="utf-8"))
        ranks.append(d["rank"])
        if d["of"] != len(files):
            bad.append(f"{y}/{d['slug']}: of={d['of']} but {len(files)} files")
        # steals/busts arrays are intentionally truncated to top 5 for display,
        # while *_count counts every qualifying pick. Assert that relationship.
        if len(d["steals"]) > 5 or len(d["busts"]) > 5:
            bad.append(f"{y}/{d['slug']}: steals/busts array longer than 5")
        if d["steals_count"] < len(d["steals"]) or d["busts_count"] < len(d["busts"]):
            bad.append(f"{y}/{d['slug']}: count < displayed array")
        if d["graded_pick_count"] > len(d["all_picks"]):
            bad.append(f"{y}/{d['slug']}: graded {d['graded_pick_count']} > all {len(d['all_picks'])}")
    if sorted(ranks) != list(range(1, len(files) + 1)):
        bad.append(f"{y}: ranks not 1..{len(files)} -> {sorted(ranks)}")
check("draft grades consistent", not bad, "; ".join(bad[:6]))

print("\n" + "=" * 70)
print(f"RESULT: {len(FAILS)} failing check(s)")
for n, d in FAILS:
    print(f"  FAIL {n}\n       {d}")
if NOTES:
    print("Notes:", NOTES)
