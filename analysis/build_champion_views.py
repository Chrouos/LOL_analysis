"""Build champion UI data: python analysis/build_champion_views.py YEAR oracles.csv."""
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROLES = ("top", "jng", "mid", "bot", "sup")
VENUES = ("LCK", "LPL", "WLDs")


def build(year, path):
    games = defaultdict(list)
    with open(path, encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            if row["date"].startswith(year + "-") and row["league"] in VENUES:
                games[row["gameid"]].append(row)
    heroes, players = {}, {}
    output = []
    for rows in games.values():
        teams = {r["side"]: r for r in rows if r["position"] == "team"}
        if set(teams) != {"Blue", "Red"}:
            continue
        blue, red = teams["Blue"], teams["Red"]
        if {blue["result"], red["result"]} != {"0", "1"}:
            continue
        venue = blue["league"]
        day = blue["date"][:10]
        stage = blue["split"] or "正賽"
        if venue == "WLDs" and day < "2025-10-14":
            if "lpl.qq.com/" not in blue["url"]:
                continue
            venue, stage = "LPL", "世界賽資格賽"
        elif blue["playoffs"] == "1":
            stage += " · 季後賽"
        bans = [r[f"ban{i}"] for r in (blue, red) for i in range(1, 6)]
        ban_ids = [heroes.setdefault(hero, len(heroes)) for hero in sorted(set(bans))] if all(bans) else None
        picks = [None] * 10
        for r in rows:
            role, side, champion, player = (r[key] for key in ("position", "side", "champion", "playername"))
            if role not in ROLES or side not in teams or not champion or not player:
                continue
            position = ROLES.index(role) + 5 * int(side == "Red")
            picks[position] = [players.setdefault(player, len(players)), heroes.setdefault(champion, len(heroes))]
        output.append([venue, stage, day, blue["patch"], int(blue["result"]), picks, ban_ids])
    return {"heroes": list(heroes), "players": list(players), "games": sorted(output, key=lambda g: (g[0], g[2]))}


if __name__ == "__main__":
    year, source = sys.argv[1:]
    destination = Path(__file__).resolve().parents[1] / "dist" / f"champions-{year}.json"
    destination.write_text(json.dumps(build(year, source), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
