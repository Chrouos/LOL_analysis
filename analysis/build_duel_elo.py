"""Compute per-game Elo expectations aligned to the champion views."""
import hashlib
import json
from collections import defaultdict
from itertools import groupby
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "dist"


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def signature(venue, day, patch, winner, picks):
    return venue, day, patch, winner, tuple(picks)


def expected(snapshot):
    teams, players, heroes = (snapshot[name] for name in ("teams", "players", "heroes"))
    ratings = defaultdict(float)
    probabilities = defaultdict(list)
    for _, rows in groupby(sorted(snapshot["games"], key=lambda game: game[0]), key=lambda game: game[0]):
        delta = defaultdict(float)
        for day, patch, venue, blue, red, _, _, _, winner, picks, *_ in rows:
            if winner not in (0, 1):
                continue
            blue, red = teams[blue], teams[red]
            p = 1 / (1 + 10 ** (-(ratings[blue] - ratings[red]) / 400))
            shift = 24 * (int(winner == 0) - p)
            delta[blue] += shift
            delta[red] -= shift
            lineup = [None] * 10
            for i, player, hero in zip(picks[::3], picks[1::3], picks[2::3]):
                lineup[i] = (players[player], heroes[hero])
            key = signature(venue, day, patch, int(winner == 0), lineup)
            probabilities[key].append(p)
        for team, shift in delta.items():
            ratings[team] += shift
    return probabilities


def build(year, source):
    elo = expected(load(source))
    view = load(f"champions-{year}.json")
    players, heroes = view["players"], view["heroes"]
    output = []
    for venue, _, day, patch, winner, picks, _ in view["games"]:
        lineup = [None if pick is None else (players[pick[0]], heroes[pick[1]]) for pick in picks]
        probabilities = elo.get(signature(venue, day, patch, winner, lineup), [])
        # Ambiguous matches are only usable when their odds agree.
        p = probabilities[0] if probabilities and max(probabilities) - min(probabilities) < 1e-9 else None
        output.append(round(p, 6) if p is not None else None)
    return output


if __name__ == "__main__":
    for year, source in ((2025, "slices.json"), (2026, "slices-2026.json")):
        data = build(year, source)
        snapshot = (ROOT / f"champions-{year}.json").read_bytes()
        payload = {"sha256": hashlib.sha256(snapshot).hexdigest(), "probabilities": data}
        (ROOT / f"duel-elo-{year}.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        print(year, sum(p is not None for p in data), len(data))
