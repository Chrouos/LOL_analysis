"""Check analytical snapshot integrity using only the Python standard library."""
import hashlib
import json
import sys
from collections import Counter
from datetime import date
from math import isclose
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "analysis"))
from backtest import evaluate, outcomes
from build_duel_elo import build


def read(name):
    return json.loads((ROOT / "dist" / name).read_bytes())


def validate_year(year, filename):
    snapshot = read(filename)
    champions = read(f"champions-{year}.json")
    elo = read(f"duel-elo-{year}.json")
    assert (len(snapshot["games"]) == len(champions["games"]) == len(elo["probabilities"]))
    assert elo["sha256"] == hashlib.sha256((ROOT / "dist" / f"champions-{year}.json").read_bytes()).hexdigest()
    assert elo["probabilities"] == build(year, filename)
    dates = [row[0] for row in snapshot["games"]]
    assert dates == sorted(dates)
    coverage = Counter()
    for day, patch, venue, blue, red, *values in snapshot["games"]:
        dragon, herald, baron, winner, picks, *extra = values
        assert day.startswith(str(year))
        assert blue != red
        assert all(label in (-1, 0, 1, 2) for label in (dragon, herald, baron))
        assert winner in (-1, 0, 1)
        assert len(picks) % 3 == 0
        slots = picks[::3]
        assert len(slots) == len(set(slots)) and all(0 <= slot < 10 for slot in slots)
        if extra and extra[0]:
            assert all(int(role) in slots for role in extra[0])
            coverage[venue] += 1
    print(f"{year}: {len(dates)} games, GD@15 coverage {dict(coverage)}")


def validate_backtest():
    from backtest import TARGETS

    def game(day, teams, winner):
        return (date(2026, 4, day), (16, 7), "LCK", teams,
                {target: winner if target == "result" else None for target in TARGETS})

    games = [game(1, ("Blue", "Red"), 0), game(2, ("Red", "Blue"), 1),
             game(2, ("Blue", "Red"), 0)]
    scores, _, _ = evaluate(games, {}, date(2026, 4, 2))
    reverse, same = scores["LCK", "result"]
    weight = 2 ** (-1 / 60)
    assert len(reverse[1]) == len(reverse[2]) == 2
    assert isclose(reverse[2][1], (8 / 3 + weight) / (8 + weight))
    assert isclose(same[2][0], (16 / 3 + weight) / (8 + weight))
    assert reverse[1] == same[1]  # Same-day results cannot change the baseline.


def main():
    test = dict(firstdragon="0", firstherald="", firstbaron="", result="0", heralds="0")
    assert outcomes(test, test) == {
        "firstdragon": 2, "firstherald": 2, "firstbaron": None, "result": None,
    }
    assert outcomes(dict(test, heralds="1"), test)["firstherald"] == 0
    assert outcomes(dict(test, heralds="2"), test)["firstherald"] is None
    validate_backtest()
    validate_year(2025, "slices.json")
    validate_year(2026, "slices-2026.json")


if __name__ == "__main__":
    main()
