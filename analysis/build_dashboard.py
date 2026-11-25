"""Generate the dashboard from the 2025 Oracle's Elixir CSV."""
import csv
import json
import sys
from datetime import date
from collections import Counter, defaultdict
from pathlib import Path

from backtest import TARGETS, evaluate, load, metrics


def build(path, start_date=date(2025, 4, 1)):
    games, regions = load(path)
    scores, observed, cross = evaluate(games, regions, start_date)
    teams = defaultdict(Counter)
    players = defaultdict(Counter)
    for _, _, venue, sides, outcomes in games:
        for side, team in enumerate(sides):
            counts = teams[venue, team]
            counts["games"] += 1
            counts["blue" if side == 0 else "red"] += 1
            for target, value in outcomes.items():
                if value is not None:
                    counts[target + "_n"] += 1
                    counts[target] += int(value == side)
                    if target == "result":
                        counts["blue_wins" if side == 0 else "red_wins"] += int(value == side)
    with open(path, encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            venue = row["league"]
            if venue == "WLDs" and row["date"] < "2025-10-14" and "lpl.qq.com/" in row["url"]:
                venue = "LPL"
            team = row["teamname"]
            if (venue, team) in teams and row["position"] in ("top", "jng", "mid", "bot", "sup") and row["champion"] and row["playername"]:
                players[venue, team, row["playername"], row["position"]][row["champion"]] += 1
    return {
        "backtest": [[venue, target, len(scores[venue, target]),
                      *[metrics(scores[venue, target], i) if scores[venue, target] else None for i in (1, 2)]]
                     for venue in ("LCK", "LPL", "WLDs") for target in TARGETS],
        "observed": [[venue, target, [counts[i] for i in (0, 1, 2, None)]]
                     for (venue, target), counts in sorted(observed.items())],
        "teams": [[venue, regions[team], team, counts] for (venue, team), counts in sorted(teams.items())],
        "players": [[venue, regions[team], team, player, role, sum(counts.values()), counts.most_common()]
                    for (venue, team, player, role), counts in sorted(players.items())],
        "cross": [[*matchup, target, [counts[region] for region in dict.fromkeys(matchup)], counts[2], counts[None]]
                  for (matchup, target), counts in sorted(cross.items())],
    }


if __name__ == "__main__":
    result = build(sys.argv[1], date.fromisoformat(sys.argv[3])) if len(sys.argv) > 3 else build(sys.argv[1])
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[1] / "dist" / "dashboard.json"
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
