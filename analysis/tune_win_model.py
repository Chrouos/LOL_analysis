"""Select settings on 2026 Q1, then evaluate the fixed model on April onward."""
import json

from sklearn.metrics import accuracy_score, log_loss
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

from win_model import features, rows

GROUPS = {
    "Elo": (0,), "近期與紅藍方": (1,), "歷史首物件率": (2,),
    "先發選手": (3,), "已完成選角": (4,),
}
PRE_MATCH = (0, 1, 2)
NAMES = [
    "Elo 差 ÷ 400", "近期勝率差", "紅藍方歷史勝率差", "場域藍方勝率",
    "歷史首小龍率差", "歷史首預示者率差", "歷史首巴龍率差",
]


def fit(train, groups, regularization):
    model = make_pipeline(StandardScaler(), LogisticRegression(C=regularization))
    model.fit(matrix(train, groups), labels(train))
    return model


def matrix(batch, groups):
    return [sum((row[3][i] for i in groups), []) for row in batch]


def labels(batch):
    return [row[2] for row in batch]


def metrics(model, batch, groups):
    probabilities = model.predict_proba(matrix(batch, groups))[:, 1]
    return [len(batch), accuracy_score(labels(batch), probabilities >= .5),
            log_loss(labels(batch), probabilities, labels=[0, 1])]


def run():
    games = list(rows())
    candidates = []
    datasets = {}
    for half_life in (21, 45, 90):
        data = list(features(games, half_life))
        datasets[half_life] = data
        train = [r for r in data if '2025-03-01' <= r[0] < '2026-01-01']
        validate = [r for r in data if '2026-01-01' <= r[0] < '2026-04-01']
        for groups in ((0,), (0, 1), (0, 2), PRE_MATCH):
            for c in (.01, .1, 1):
                model = fit(train, groups, c)
                n, acc, loss = metrics(model, validate, groups)
                candidates.append((loss, -acc, half_life, groups, c, n))
    loss, neg_acc, half_life, groups, c, n = min(candidates)
    data = datasets[half_life]
    train = [r for r in data if '2025-03-01' <= r[0] < '2026-04-01']
    test = [r for r in data if r[0] >= '2026-04-01']

    def by_venue(model, active):
        return {venue: metrics(model, [r for r in test if venue == '合計' or r[1] == venue], active)
                for venue in ('合計', 'LCK', 'LPL')}

    model = fit(train, groups, c)
    scaler, logistic = model.steps[0][1], model.steps[1][1]
    indices = sum(([0] if g == 0 else [1, 2, 3] if g == 1 else [4, 5, 6] for g in groups), [])
    comparisons = []
    for label, additions in GROUPS.items():
        group = additions[0]
        active = tuple(i for i in PRE_MATCH if i != group) if group in PRE_MATCH else (*PRE_MATCH, *range(3, group + 1))
        comparisons.append(["移除 " + label if group in PRE_MATCH else "加入 " + label,
                            by_venue(fit(train, active, c), active)])
    return {
        'validation': [n, -neg_acc, loss], 'half_life': half_life, 'c': c,
        'groups': [list(GROUPS)[g] for g in groups], 'training': len(train),
        'test': by_venue(model, groups), 'full': by_venue(fit(train, PRE_MATCH, c), PRE_MATCH),
        'baseline': by_venue(fit(train, (0,), .1), (0,)),
        'intercept': float(logistic.intercept_[0]),
        'weights': [[NAMES[i], float(w), float(m), float(s)] for i, w, m, s in
                    zip(indices, logistic.coef_[0], scaler.mean_, scaler.scale_)],
        'comparisons': comparisons,
    }


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False))
