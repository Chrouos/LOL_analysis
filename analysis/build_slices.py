"""Build the dated match snapshot used by the analysis filters."""
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

from backtest import TARGETS, load

ROLES = ("top", "jng", "mid", "bot", "sup")


def build(path):
    _, regions = load(path)
    matches = defaultdict(list)
    with open(path, encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            if row["league"] in ("LCK", "LPL", "WLDs"):
                matches[row["gameid"]].append(row)
    names = {key: {} for key in ("teams", "players", "heroes")}

    def index(group, name):
        return names[group].setdefault(name, len(names[group]))

    games = []
    for rows in matches.values():
        teams = {row["side"]: row for row in rows if row["position"] == "team"}
        blue, red = teams["Blue"], teams["Red"]
        if len(blue["patch"].split(".")) != 2:
            continue
        venue = blue["league"]
        if venue == "WLDs" and blue["date"] < "2025-10-14":
            assert "lpl.qq.com/" in blue["url"]
            venue = "LPL"
        day = blue["date"][:10]
        outcomes = []
        for target in TARGETS:
            pair = blue[target], red[target]
            if target == "firstherald" and "" in pair:
                pair = blue["heralds"], red["heralds"]
            outcomes.append({("1", "0"): 0, ("0", "1"): 1, ("0", "0"): 2}.get(pair, -1))
        sides = [index("teams", row["teamname"]) for row in (blue, red)]
        players = []
        gold = {}
        for row in rows:
            role, player, hero = row["position"], row["playername"], row["champion"]
            if role in ROLES and player and hero:
                position = int(row["side"] == "Red") * 5 + ROLES.index(role)
                players.extend((position, index("players", player), index("heroes", hero)))
                if row.get("golddiffat15"):
                    gold[position] = int(float(row["golddiffat15"]))
        games.append([day, blue["patch"], venue, *sides, *outcomes, players, gold])
    return {"games": sorted(games), "regions": regions,
            **{group: list(values) for group, values in names.items()}}


if __name__ == "__main__":
    destination = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[1] / "dist" / "slices.json"
    destination.write_text(json.dumps(build(sys.argv[1]), separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
