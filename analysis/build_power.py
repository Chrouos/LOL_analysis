"""Build 2026 roster and player profiles from the linked Oracle's Elixir snapshot."""
import csv
import json
import math
import sys
from collections import defaultdict
from itertools import groupby
from pathlib import Path

ROLES = ("top", "jng", "mid", "bot", "sup")
FIELDS = ("gamelength", "total cs", "damagetochampions", "earnedgold",
          "kills", "assists", "teamkills", "visionscore")


def number(value):
    try:
        value = float(value)
        return value if math.isfinite(value) and value >= 0 else None
    except (TypeError, ValueError):
        return None


def build(source):
    games = defaultdict(list)
    with open(source, encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["league"] in ("LCK", "LPL") and row["date"].startswith("2026-"):
                games[row["gameid"]].append(row)
    datasets = {}
    for venue in ("LCK", "LPL"):
        matches = sorted(
            (rows for rows in games.values() if rows[0]["league"] == venue),
            key=lambda rows: rows[0]["date"],
        )
        ratings = defaultdict(float)
        sums = defaultdict(lambda: [[0, 0, 0] for _ in range(6)])
        played = defaultdict(int)
        rosters = {}
        for _, day_games in groupby(matches, key=lambda rows: rows[0]["date"][:10]):
            updates = defaultdict(float)
            for rows in day_games:
                team_rows = {r["side"]: r for r in rows if r["position"] == "team"}
                if set(team_rows) != {"Blue", "Red"}:
                    continue
                blue, red = (team_rows[side] for side in ("Blue", "Red"))
                if {blue["result"], red["result"]} != {"0", "1"}:
                    continue
                b, r = blue["teamname"], red["teamname"]
                p = 1 / (1 + 10 ** (-(ratings[b] - ratings[r]) / 400))
                updates[b] += 24 * (int(blue["result"]) - p)
                updates[r] -= 24 * (int(blue["result"]) - p)
                members = defaultdict(dict)
                for row in rows:
                    player, role, side = row["playername"], row["position"], row["side"]
                    if not player or role not in ROLES or side not in team_rows:
                        continue
                    team = team_rows[side]["teamname"]
                    key = (team, role, player)
                    members[team][role] = key
                    played[key] += 1
                    seconds, cs, damage, gold, kills, assists, team_kills, vision = (
                        number(row.get(f)) for f in FIELDS
                    )
                    for i, (num, den) in enumerate(((cs, seconds), (damage, seconds),
                        (gold, seconds), (damage, gold),
                        (None if kills is None or assists is None else kills + assists, team_kills),
                        (vision, seconds))):
                        if num is not None and den and (i != 4 or num <= den):
                            sums[key][i][0] += num
                            sums[key][i][1] += den
                            sums[key][i][2] += 1
                for team, lineup in members.items():
                    if all(role in lineup for role in ROLES):
                        rosters[team] = [rows[0]["date"][:10], [lineup[role] for role in ROLES]]
            for team, delta in updates.items():
                ratings[team] += delta
        raw = {key: [num / den * scale if den else None
                     for (num, den, _), scale in zip(sums[key], (60, 60, 60, 1, 100, 60))]
               for key in played}
        peers = {(role, i): [values[i] for key, values in raw.items()
                              if key[1] == role and sums[key][i][2] >= 10 and values[i] is not None]
                 for role in ROLES for i in range(6)}
        profiles = []
        ids = {}
        for key in sorted(played):
            percentile = []
            for i, value in enumerate(raw[key]):
                group = peers[key[1], i]
                percentile.append(round(100 * sum((v < value) + .5 * (v == value) for v in group) / len(group), 1)
                                  if value is not None and len(group) >= 2 and sums[key][i][2] >= 10 else None)
            ids[key] = len(profiles)
            profiles.append([*key, played[key], raw[key], percentile, [metric[2] for metric in sums[key]]])
        teams = []
        for team, rating in sorted(ratings.items(), key=lambda pair: -pair[1]):
            if team not in rosters:
                continue
            day, lineup = rosters[team]
            teams.append([team, round(1500 + rating, 1), day, [ids[key] for key in lineup]])
        datasets[venue] = {"games": len(matches), "profiles": profiles, "teams": teams}
    return datasets


if __name__ == "__main__":
    output = Path(__file__).resolve().parents[1] / "dist" / "power.json"
    output.write_text(json.dumps(build(sys.argv[1]), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
