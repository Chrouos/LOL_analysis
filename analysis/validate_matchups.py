"""python analysis/validate_matchups.py path/to/LoL-Draft/2026/games.csv"""
import csv
import hashlib
import json
import math
import sys
from collections import defaultdict
from datetime import date
from itertools import groupby
from pathlib import Path

DIST = Path(__file__).resolve().parents[1] / "dist"
ALIASES = {"BNK FearX": "BNK FEARX", "Dplus KIA": "Dplus Kia", "Hanwha Life": "Hanwha Life Esports",
           "Anyone s Legend": "Anyone's Legend"}


def name(raw):
    return ALIASES.get(raw, raw)


def slices(file):
    doc = json.loads((DIST / file).read_text())
    return [(g[0], g[1], g[2], name(doc["teams"][g[3]]), name(doc["teams"][g[4]]), g[8], tuple(g[5:8]))
            for g in doc["games"] if g[8] in (0, 1)]


def drafts(path):
    with open(path, encoding="utf-8-sig", newline="") as handle:
        for r in csv.DictReader(handle):
            stage = r["tournament_name"]
            if r["tier"] != "primary" or not stage.startswith(("LCK 2026 ", "LCK Cup 2026", "LPL 2026 ")):
                continue
            if r["winner_side"] not in ("blue", "red"):
                continue
            yield (r["start_time_utc"][:10], r["patch_label"], stage[:3], name(r["blue_team"]),
                   name(r["red_team"]), int(r["winner_side"] == "red"), (-1, -1, -1))


def update_elo(old, games):
    delta = defaultdict(float)
    for _, _, _, b, r, win, _ in games:
        chance = 1 / (1 + 10 ** (-(old[b] - old[r]) / 400))
        shift = 24 * ((win == 0) - chance)
        delta[b] += shift
        delta[r] -= shift
    for team, shift in delta.items():
        old[team] += shift


def evaluate(games, cutoff, carry=0, prior_games=(), objectives=False):
    elo = defaultdict(float)
    games = sorted(games, key=lambda game: game[0])
    if carry:
        for _, batch in groupby(sorted(prior_games), key=lambda game: game[0]):
            update_elo(elo, batch)
        elo = defaultdict(float, {team: value * carry for team, value in elo.items()})

    team_history = defaultdict(list)
    h2h = defaultdict(list)
    arena = defaultdict(list)
    audit = defaultdict(lambda: [0, 0, 0.0])
    matchup = defaultdict(lambda: [[0, 0], [0, 0]])

    def score(target, variant, venue, actual, probs):
        pred = max(range(len(probs)), key=probs.__getitem__)
        for group in ("合計", venue):
            key = (target, variant, group)
            audit[key][0] += 1
            audit[key][1] += int(pred == actual)
            audit[key][2] -= math.log(max(1e-12, probs[actual]))

    for day, iterator in groupby(games, key=lambda game: game[0]):
        batch = list(iterator)
        now = date.fromisoformat(day).toordinal()

        def weight(previous_day):
            return 2 ** (-(now - previous_day) / 21)

        def rate(team, side=None):
            observations = [(weight(t), y) for t, s, y, _, _ in team_history[team] if side is None or s == side]
            return (2 + sum(w * y for w, y in observations)) / (4 + sum(w for w, _ in observations))

        def logit(p):
            return math.log(p / (1 - p))

        for _, patch, venue, blue, red, win, labels in batch:
            if day < cutoff:
                continue
            z = math.log(10) * (elo[blue] - elo[red]) / 400
            recent = .5 * (logit(rate(blue)) - logit(rate(red)))
            side = .5 * (logit(rate(blue, 0)) - logit(rate(red, 1)))
            opponents = [(weight(t), won) for t, won in h2h[blue, red]]
            rivalry = logit((2 + sum(w * won for w, won in opponents)) / (4 + sum(w for w, _ in opponents)))
            for key, adjustment in (("Elo", 0), ("＋近期勝率", recent), ("＋紅藍方勝率", side),
                                    ("＋交手勝率", rivalry), ("＋全部", recent + side + rivalry)):
                p = 1 / (1 + math.exp(-z - adjustment))
                score("勝負", key, venue, win, [p, 1 - p])
            if {blue, red} == {"T1", "Gen.G"}:
                matchup[venue][0][0] += 1
                matchup[venue][0][1] += int((blue, red)[win] == "T1")
            if not objectives:
                continue
            for idx, (target, actual) in enumerate(zip(("首小龍", "首預示者", "首巴龍"), labels)):
                if actual < 0:
                    continue
                base = [1., 1., 1.]
                for kind in arena[venue, idx]:
                    base[kind] += 1
                base = [v / sum(base) for v in base]
                score(target, "場域基準", venue, actual, base)
                for discount in (0, .25, .5, 1):
                    votes = [4 * p for p in base]
                    for side_now, team in enumerate((blue, red)):
                        for t, _, _, version, outcomes in team_history[team]:
                            outcome = outcomes[idx]
                            distance = int(patch.split(".")[-1]) - int(version.split(".")[-1])
                            if outcome < 0 or distance < 0:
                                continue
                            kind = side_now if outcome == 1 else 1 - side_now if outcome == 0 else 2
                            votes[kind] += weight(t) * discount ** distance
                    score(target, f"隊伍風格 λ={discount}", venue, actual, [v / sum(votes) for v in votes])
        update_elo(elo, batch)
        for _, patch, venue, blue, red, win, labels in batch:
            for side, team in enumerate((blue, red)):
                outcomes = tuple(-1 if x < 0 else 2 if x == 2 else int(x == side) for x in labels)
                team_history[team].append((now, side, int(win == side), patch, outcomes))
            h2h[blue, red].append((now, int(win == 0)))
            h2h[red, blue].append((now, int(win == 1)))
            for i, outcome in enumerate(labels):
                if outcome >= 0:
                    arena[venue, i].append(outcome)
    return {"scores": [[*key, n, correct, loss / n] for key, (n, correct, loss) in audit.items()],
            "t1VsGeng": {venue: pair[0] for venue, pair in matchup.items()}}


def main(path):
    fresh = list(drafts(path))
    old = slices("slices.json")
    labeled = slices("slices-2026.json")
    result = {"sourceSha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(),
              "freshStart": "2026-05-23", "freshEnd": max(g[0] for g in fresh),
              "fresh": {str(c): evaluate(fresh, "2026-05-23", c, old) for c in (0, .25, .5)},
              "objectivesStart": "2026-04-01", "objectivesEnd": max(g[0] for g in labeled),
              "objectives": evaluate(labeled, "2026-04-01", objectives=True)}
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main(sys.argv[1])
