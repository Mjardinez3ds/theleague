// Rebuilds archive/2021/season.json from archive/2021/raw.json.gz.
//
// Captured 2026-11-16 by reading Yahoo league 1272267 (2021) in a logged-in
// Chrome tab: standings, teams, draft, every matchup box score
// (`m{week}_{teamId}`), and the full transaction log (`tx{offset}`).
// Yahoo's own API needs an approved developer app (see AGENTS.md), so the
// web pages are the source.
//
// Usage (any browser console, since it relies on DOMParser):
//   const raw = <contents of raw.json, gunzipped>;
//   const season = buildSeason(raw);   // then save as season.json
//
// Yahoo rate-limits hard (HTTP 999 "Request denied") after ~30 fast page
// loads; the capture used one page per 6 s with a 2-minute back-off.

// Yahoo team id -> site manager. "Ryder" and "Ruggs in Cuffs" hide their
// Yahoo profile; the owner identified them (Chris Peralta, Denniell
// Grijalva). "Rj" never played on ESPN, so RJ gets a new slug.
const OWN = {
  10: ["george-duran", "George Duran"], 3: ["junior-peralta", "Junior Peralta"],
  8: ["anthony-richardson", "Anthony Richardson"], 11: ["devon-malki", "Devon Malki"],
  7: ["marcus-jardinez", "Marcus Jardinez"], 1: ["chris-peralta", "Chris Peralta"],
  5: ["kevin-llerena", "Kevin Llerena"], 12: ["rj", "RJ"],
  6: ["jordan-van-leesten", "Jordan van Leesten"], 4: ["ricky-cano", "Ricky Cano"],
  2: ["denniell-grijalva", "Denniell Grijalva"], 9: ["kevin-liang", "Kevin Liang"],
};
// Never started in a fixed slot and never in a transaction, so no position on any page.
const POSITION_FIXUPS = { "Marquez Callaway": "WR", "J.D. McKissic": "RB" };

function buildSeason(raw) {
  const P = (h) => new DOMParser().parseFromString(h, "text/html");
  const num = (s) => { const x = parseFloat(String(s).replace(/,/g, "")); return isNaN(x) ? null : x; };
  const tidOf = (a) => { const m = (a?.getAttribute("href") || "").match(/^\/2021\/f1\/1272267\/(\d+)$/); return m ? +m[1] : null; };
  const NORM = (p) => (p === "DEF" ? "D/ST" : p);

  // Teams page: name, Yahoo nickname, moves (= acquisitions), trades.
  const teams = {};
  for (const tr of P(raw.teams).querySelectorAll("table tbody tr")) {
    const id = tidOf(tr.querySelector('a[href^="/2021/f1/1272267/"]'));
    if (!id) continue;
    const c = [...tr.children].map((td) => td.textContent.trim().replace(/\s+/g, " "));
    teams[id] = { id, team_name: c[0], yahoo_nickname: c[1], acquisitions: +c[4], trades: +c[5] };
  }
  // Standings: Yahoo's rank column is the FINAL finish (playoffs applied).
  for (const tr of P(raw.standings).querySelectorAll("#standingstable tbody tr")) {
    const c = [...tr.children].map((td) => td.textContent.trim());
    const id = tidOf(tr.querySelector('a[href^="/2021/f1/1272267/"]'));
    const [w, l, t] = c[2].split("-").map(Number);
    Object.assign(teams[id], { finish: parseInt(c[0].replace("*", "")), wins: w, losses: l, ties: t,
      points_for: num(c[3]), points_against: num(c[4]) });
  }
  for (const id in teams) Object.assign(teams[id], { owner_slug: OWN[id][0], owner: OWN[id][1], faab_spent: 0 });
  const nameToId = Object.fromEntries(Object.values(teams).map((t) => [t.team_name, t.id]));

  // Box scores. Left column = mid1's team. Starters' points sum to the score.
  const pos = {}, posByName = {}, games = [];
  for (const k of Object.keys(raw).filter((k) => /^m\d+_\d+$/.test(k))) {
    const week = +k.slice(1).split("_")[0];
    const d = P(raw[k]);
    const hdr = d.querySelector("#matchup-header");
    if (!hdr) continue;
    const ids = [...new Set([...hdr.querySelectorAll("a")].map(tidOf).filter(Boolean))];
    // Weeks 15-17: teams out of the playoffs get a one-sided page with no opponent. Not a game.
    if (ids.length < 2) continue;
    const sc = [...hdr.querySelectorAll("table.M-a td")].map((x) => x.textContent.trim());
    const L = [], R = [];
    const nm = (x) => x.querySelector("a.name")?.textContent.trim() || "";
    const pid = (x) => ((x.querySelector("a.name")?.getAttribute("href") || "").match(/players\/(\d+)/) || [])[1] || null;
    for (const t of d.querySelectorAll("table[id^=statTable]"))
      for (const r of t.querySelectorAll("tbody tr")) {
        const c = [...r.children];
        if (c.length < 10) continue;
        const slot = c[5].textContent.trim();
        for (const [arr, ci, pi, ji] of [[L, 1, 3, 2], [R, 9, 7, 8]]) {
          const n = nm(c[ci]);
          if (!n) continue;
          const id = pid(c[ci]);
          arr.push({ slot, player: n, player_id: id, pts: num(c[pi].textContent), proj: num(c[ji].textContent) });
          if (["QB", "RB", "WR", "TE", "K", "DEF"].includes(slot) && id) pos[id] = NORM(slot);
        }
      }
    games.push({ week, is_playoff: week > 14,
      home: { team_id: ids[0], score: num(sc[0]), projected: num(sc[2]), lineup: L },
      away: { team_id: ids[1], score: num(sc[1]), projected: num(sc[3]), lineup: R } });
  }
  games.sort((a, b) => a.week - b.week || a.home.team_id - b.home.team_id);

  // Transactions. Dates have no year: Aug-Dec = 2021, Jan-Mar = 2022.
  // Week = NFL week by Tuesday boundary (Week 1 = Tue Sep 7 2021 .. Mon Sep 13).
  const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const toDate = (s) => { const m = s.match(/([A-Z][a-z]{2}) (\d+)/); const mo = MON[m[1]];
    return `${mo <= 3 ? 2022 : 2021}-${String(mo).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`; };
  const toWeek = (iso) => { const d = (new Date(iso + "T12:00:00Z") - new Date("2021-09-07T00:00:00Z")) / 86400000;
    return Math.min(17, Math.max(1, Math.floor(d / 7) + 1)); };
  const rows = [];
  for (const k of Object.keys(raw).filter((k) => /^tx\d+$/.test(k)).sort((a, b) => +a.slice(2) - +b.slice(2)))
    rows.push(...P(raw[k]).querySelectorAll("#yspmaincontent table tbody tr"));
  const namePos = (el) => [el.querySelector("a")?.textContent.trim(), el.querySelector(".F-position")?.textContent.split("-").pop().trim()];
  const transactions = [], trades = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const ts = r.querySelector(".F-timestamp")?.textContent.trim();
    // A trade is two consecutive rows: "<players> Traded to <team A>", then "<players> Traded to <team B>".
    if (/F-trade/.test(r.children[0]?.innerHTML || "")) {
      const side = (row) => ({ team: row.querySelector("td.Ta-end a")?.textContent.trim(),
        players: [...row.querySelectorAll("td.No-pstart p")].map((p) => { const [n, ps] = namePos(p); if (ps) posByName[n] = NORM(ps); return n; }) });
      const a = side(r), b = side(rows[i + 1]);
      const date = toDate(ts);
      trades.push({ date, week: toWeek(date), timestamp: ts, sides: [
        { team_id: nameToId[a.team], gave: b.players, got: a.players },
        { team_id: nameToId[b.team], gave: a.players, got: b.players }] });
      i++;
      continue;
    }
    const team = r.querySelector("td.Ta-end a")?.textContent.trim();
    if (!team) continue;
    const added = [], dropped = [];
    let type = null, bid = 0;
    for (const dv of r.querySelectorAll("td.Fill-x > div")) {
      const [n, ps] = namePos(dv);
      if (ps) posByName[n] = NORM(ps);
      const lab = dv.querySelector("h6")?.textContent.trim() || "";
      if (/^To /.test(lab)) dropped.push(n);
      else { added.push(n); type = /Waiver/i.test(lab) ? "WAIVER" : "FREEAGENT"; const m = lab.match(/\$(\d+)/); if (m) bid = +m[1]; }
    }
    const date = toDate(ts);
    transactions.push({ date, week: toWeek(date), timestamp: ts, team_id: nameToId[team], type: type || "DROP", bid, added, dropped });
  }

  // Draft: one table per round. Team defenses have no player link/id.
  const draft = [];
  let overall = 0;
  P(raw.draft).querySelectorAll("#yspmaincontent table").forEach((t, ri) => {
    t.querySelectorAll("tbody tr").forEach((tr) => {
      const c = tr.children, a = c[1].querySelector("a");
      const id = ((a?.getAttribute("href") || "").match(/players\/(\d+)/) || [])[1] || null;
      const n = a?.textContent.trim();
      overall++;
      draft.push({ round: ri + 1, pick: parseInt(c[0].textContent), overall,
        team_id: nameToId[c[2].getAttribute("title") || c[2].textContent.trim()],
        player: n, player_id: id,
        position: (id && pos[id]) || posByName[n] || POSITION_FIXUPS[n] || (id ? "" : "D/ST") });
    });
  });
  const dst = new Set(draft.filter((p) => p.position === "D/ST").map((p) => p.player));
  for (const g of games) for (const s of [g.home, g.away]) for (const p of s.lineup)
    p.position = (p.player_id && pos[p.player_id]) || posByName[p.player] || POSITION_FIXUPS[p.player] ||
      (dst.has(p.player) || !p.player_id ? "D/ST" : "");

  return { year: 2021, source: "yahoo", source_league_id: 1272267, league_name: "The NFTFF League",
    reg_season_weeks: 14, final_week: 17, captured: "2026-11-16",
    teams: Object.values(teams).sort((a, b) => a.finish - b.finish), games, draft,
    transactions: transactions.sort((a, b) => a.date.localeCompare(b.date)),
    trades: trades.sort((a, b) => a.date.localeCompare(b.date)) };
}
