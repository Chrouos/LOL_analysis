"""Walk-forward features for game winners, with a held-out 2026 test."""
import json
from collections import defaultdict
from itertools import groupby
from math import exp, log
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1] / "dist"
FEATURES = (
    "Elo", "紅藍方與近期狀態", "物件風格", "實際出賽選手", "已完成選角"
)


def rows():
    for path in (ROOT / "slices.json", ROOT / "slices-2026.json"):
        snapshot = json.loads(path.read_text())
        for day, patch, venue, blue, red, dragon, herald, baron, win, picks, *_ in snapshot["games"]:
            if win not in (0, 1):
                continue
            teams = [snapshot["teams"][i] for i in (blue, red)]
            players = [[], []]
            for position, player, hero in zip(picks[::3], picks[1::3], picks[2::3]):
                players[position // 5].append((position % 5, snapshot["players"][player], snapshot["heroes"][hero]))
            yield day, patch, venue, teams, (dragon, herald, baron), win, players


def features(games, half_life=45):
    from datetime import date

    elo = defaultdict(float)
    history = defaultdict(list)
    for day, batch in groupby(sorted(games), key=lambda row: row[0]):
        day_num = date.fromisoformat(day).toordinal()
        updates = []

        def weighted(key):
            total = 0.0
            count = 0.0
            for old, value in history[key]:
                weight = exp(-log(2) * (day_num - old) / half_life)
                total += weight * value
                count += weight
            return total, count

        def rate(key):
            total, count = weighted(key)
            return (2 + total) / (4 + count)

        def comfort(player, hero):
            picks, _ = weighted(('comfort', player, hero))
            _, appearances = weighted(('player', player))
            return picks / (4 + appearances)

        for _, patch, venue, teams, objectives, win, players in batch:
            blue, red = teams
            diff = elo[blue] - elo[red]
            y = int(win == 0)
            base = [diff / 400]
            form = [rate(('win', blue)) - rate(('win', red)),
                    rate(('side', blue, 0)) - rate(('side', red, 1)), rate(('venue', venue))]
            style = [rate(('objective', blue, i)) - rate(('objective', red, i)) for i in range(3)]
            lineup = []
            draft = []
            for role in range(5):
                pair = [next(((p, h) for pos, p, h in side if pos == role), (None, None)) for side in players]
                (p1, h1), (p2, h2) = pair
                lineup.append(rate(('player', p1)) - rate(('player', p2)))
                draft.extend((rate(('champion', venue, role, h1)) - rate(('champion', venue, role, h2)),
                              comfort(p1, h1) - comfort(p2, h2),
                              rate(('playerhero', p1, h1)) - rate(('playerhero', p2, h2))))
            yield day, venue, y, [base, form, style, lineup, draft]
            p = 1 / (1 + 10 ** (-diff / 400))
            updates.append((teams, venue, win, objectives, players, 24 * (y - p)))

        for teams, venue, win, objectives, players, delta in updates:
            elo[teams[0]] += delta
            elo[teams[1]] -= delta
            history['venue', venue].append((day_num, int(win == 0)))
            for side, team in enumerate(teams):
                won = int(win == side)
                for key in [('win', team), ('side', team, side)]:
                    history[key].append((day_num, won))
                for i, owner in enumerate(objectives):
                    if owner >= 0:
                        history['objective', team, i].append((day_num, int(owner == side)))
                for role, player, hero in players[side]:
                    for key in [('player', player), ('champion', venue, role, hero), ('playerhero', player, hero)]:
                        history[key].append((day_num, won))
                    history['comfort', player, hero].append((day_num, 1))


def evaluate():
    data = list(features(rows()))
    training = [r for r in data if '2025-03-01' <= r[0] < '2026-04-01']
    testing = [r for r in data if r[0] >= '2026-04-01']
    results = []
    for count, name in enumerate(FEATURES, 1):
        def matrix(batch):
            return np.asarray([sum(r[3][:count], []) for r in batch])
        model = make_pipeline(StandardScaler(), LogisticRegression(C=.1))
        model.fit(matrix(training), [r[2] for r in training])
        predictions = model.predict_proba(matrix(testing))[:, 1]
        groups = []
        for venue in ('全部', 'LCK', 'LPL'):
            mask = np.array([venue == '全部' or r[1] == venue for r in testing])
            y = np.array([r[2] for r in testing])[mask]
            p = predictions[mask]
            groups.append([venue, len(y), accuracy_score(y, p >= .5), log_loss(y, p)])
        results.append([name, groups])
    return {'train': len(training), 'test': len(testing), 'results': results}


if __name__ == "__main__":
    print(json.dumps(evaluate(), ensure_ascii=False))
