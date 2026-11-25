"""Generate a descriptive 2026 feature audit. Run from any directory."""
import json
from collections import defaultdict
from statistics import correlation, mean

from win_model import features, rows

games = [row for row in rows() if row[0].startswith("2026")]
names = ["Elo 差", "近期勝率差", "紅藍方勝率差", "首小龍率差", "首預示者率差", "首巴龍率差", "先發歷史勝率差"]
observations = []
matchups = defaultdict(lambda: [0, 0, 0.0])
for game, engineered in zip(sorted(games), features(games, half_life=21), strict=True):
    day, venue, wins, (elo, form, style, lineup, _) = engineered
    observations.append((day, venue, [elo[0], *form[:2], *style, mean(lineup)], wins))
    _, patch, _, _, _, _, players = game
    blue, red = ({role: hero for role, _, hero in side} for side in players)
    p_blue = 1 / (1 + 10 ** -elo[0])
    for role in blue.keys() & red.keys():
        if blue[role] == red[role]:
            continue
        hero, enemy = sorted((blue[role], red[role]))
        on_blue = hero == blue[role]
        p = p_blue if on_blue else 1 - p_blue
        for version in ("全部", patch):
            n = matchups[venue, version, role, hero, enemy]
            n[0] += 1
            n[1] += int(bool(wins) == on_blue)
            n[2] += p


def coefficients(table):
    result = []
    for left in zip(*table):
        row = []
        for right in zip(*table):
            row.append(round(correlation(left, right), 3) if len(set(left)) > 1 and len(set(right)) > 1 else None)
        result.append(row)
    return result


def summarize(venue):
    # April onward avoids estimates driven solely by opening-week priors.
    selected = [values + [win] for day, league, values, win in observations
                if day >= "2026-04-01" and league == venue]
    events = defaultdict(lambda: [0, 0])
    for _, _, league, _, labels, winner, _ in games:
        if venue != league:
            continue
        for i, actual in enumerate(labels):
            if actual >= 0:
                key = (i, "無人取得" if actual == 2 else "取得方")
                events[key][0] += 1
                if actual != 2:
                    events[key][1] += int(actual == winner)
        dragon, herald, _ = labels
        if dragon in (0, 1) and herald in (0, 1):
            key = (-1, "同隊拿首龍與首預示者" if dragon == herald else "分由兩隊取得")
            events[key][0] += 1
    return {"n": len(selected), "matrix": coefficients(selected),
            "events": [[i, key, total, wins] for (i, key), (total, wins) in sorted(events.items())]}


if __name__ == "__main__":
    print(json.dumps({"names": [*names, "藍方勝負"], "venues": {v: summarize(v) for v in ("LCK", "LPL")},
                      "matchups": [[*key, n, wins, round(expected, 5)]
                                   for key, (n, wins, expected) in sorted(matchups.items()) if n >= 2]},
                     ensure_ascii=False, separators=(",", ":")))
