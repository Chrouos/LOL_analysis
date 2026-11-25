"""Run with python analysis/backtest.py path/to/oracles-elixir-2025.csv."""
import csv
import sys
from collections import Counter, defaultdict
from datetime import date
from itertools import groupby
from math import log
from statistics import mean

WORLDS_REGIONS = {
    "100 Thieves": "LTA North", "FlyQuest": "LTA North", "Vivo Keyd Stars": "LTA South",
    "Fnatic": "LEC", "G2 Esports": "LEC", "Movistar KOI": "LEC",
    "CTBC Flying Oyster": "LCP", "PSG Talon": "LCP", "Team Secret Whales": "LCP",
}

TARGETS = ("firstdragon", "firstherald", "firstbaron", "result")


def load(path):
    matches = defaultdict(dict)
    regions = WORLDS_REGIONS.copy()
    with open(path, encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            league = row["league"]
            if row["position"] != "team" or league not in ("LCK", "LPL", "WLDs"):
                continue
            if league == "WLDs" and row["date"] < "2025-10-14":
                if "lpl.qq.com/" not in row["url"]:
                    raise ValueError(f"Unexpected pre-Worlds game: {row['gameid']}")
                league = row["league"] = "LPL"
            match = matches[row["gameid"]]
            assert row["side"] not in match, row["gameid"]
            match[row["side"]] = row
            if league != "WLDs":
                regions[row["teamname"]] = league
    games = []
    for match in matches.values():
        blue, red = match["Blue"], match["Red"]
        patch = blue["patch"].split(".")
        if len(patch) != 2:
            continue
        targets = {}
        for target in TARGETS:
            values = blue[target], red[target]
            if target == "firstherald" and "" in values:
                # A unique Herald owner identifies first Herald when only one was taken.
                values = blue["heralds"], red["heralds"]
            targets[target] = {("1", "0"): 0, ("0", "1"): 1, ("0", "0"): 2}.get(values)
        games.append((date.fromisoformat(blue["date"][:10]), tuple(map(int, patch)), blue["league"],
                      (blue["teamname"], red["teamname"]), targets))
    return sorted(games, key=lambda game: game[0]), regions


def evaluate(games, regions, start_date=date(2025, 4, 1)):
    history = []
    scores = defaultdict(list)
    observed = defaultdict(Counter)
    cross = defaultdict(Counter)
    for day, batch in groupby(games, key=lambda game: game[0]):
        batch = list(batch)
        for _, patch, venue, teams, targets in batch:
            for target, actual in targets.items():
                observed[venue, target][actual] += 1
                if venue == "WLDs":
                    matchup = tuple(sorted(regions[team] for team in teams))
                    winner = regions[teams[actual]] if actual in (0, 1) else actual
                    cross[matchup, target][winner] += 1
                if actual is None or day < start_date:
                    continue
                # Predict default side/none from the same venue as a baseline.
                same_venue = [g for g in history if g[2] == venue and g[4][target] is not None]
                baseline = [1.0, 1.0, 0.01 if target in ("firstdragon", "result") else 1.0]
                for game in same_venue:
                    baseline[game[4][target]] += 1
                p_base = [n / sum(baseline) for n in baseline]
                # Pool domestic and international history, then favor matching venue and teams.
                counts = [n * 8 for n in p_base]
                for old_day, old_patch, old_venue, old_teams, old_targets in history:
                    outcome = old_targets[target]
                    if outcome is None or old_patch > patch:
                        continue
                    if not set(teams).intersection(old_teams):
                        continue
                    weight = 2 ** (-(day - old_day).days / 60 - max(0, patch[1] - old_patch[1]) / 2)
                    weight *= 1 if venue == old_venue else .5
                    for side, team in enumerate(teams):
                        if team not in old_teams:
                            continue
                        old_side = old_teams.index(team)
                        mapped = 2 if outcome == 2 else side if outcome == old_side else 1 - side
                        counts[mapped] += weight
                pred = [n / sum(counts) for n in counts]
                scores[venue, target].append((actual, p_base, pred))
        history.extend(batch)
    return scores, observed, cross


def metrics(scored, index):
    return (
        mean(max(range(3), key=row[index].__getitem__) == row[0] for row in scored),
        mean(-log(row[index][row[0]]) for row in scored),
    )


if __name__ == "__main__":
    games, regions = load(sys.argv[1])
    scores, observed, cross = evaluate(games, regions)
    for venue in ("LCK", "LPL", "WLDs"):
        for target in TARGETS:
            scored = scores[venue, target]
            print(venue, target, dict(observed[venue, target]), len(scored),
                  [tuple(round(x, 4) for x in metrics(scored, i)) for i in (1, 2)] if scored else [])
    for matchup, target in sorted(cross):
        if "LCK" in matchup and "LPL" in matchup:
            print(matchup, target, dict(cross[matchup, target]))
    print("Worlds regions", sorted({(team, regions[team]) for g in games if g[2] == "WLDs" for team in g[3]}))
