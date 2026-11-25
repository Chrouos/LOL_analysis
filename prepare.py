"""Build the static snapshot from games.csv, all_patches.inter and Data Dragon champion.json."""
import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("games", "draft", "champions"):
        parser.add_argument(name, type=Path)
    args = parser.parse_args()

    with args.games.open(encoding="utf-8-sig", newline="") as source:
        games = {
            row["match_id"]: row for row in csv.DictReader(source)
            if row["tier"] == "primary" and row["tournament_name"].startswith(("LCK 2026 ", "LCK Cup 2026"))
        }
    actions = defaultdict(list)
    with args.draft.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source, delimiter="\t")
        reader.fieldnames = [name.split(":")[0] for name in reader.fieldnames]
        for row in reader:
            match = row["match_id"]
            if match in games:
                actions[match].append((int(float(row["timestamp"])), row["item_id"], row["action_type"]))

    patch_order = "b b b b b b p p p p p p b b b b p p p p".split()
    snapshot = []
    for match, row in games.items():
        ordered = sorted(actions[match])
        if [slot for slot, _, _ in ordered] != list(range(20)):
            raise ValueError(f"Incomplete draft for {match}")
        if [kind[0] for _, _, kind in ordered] != patch_order:
            raise ValueError(f"Unexpected draft format for {match}")
        snapshot.append({
            "id": match, "series": row["series_id"], "number": int(row["game_number"]),
            "date": row["start_time_utc"][:10], "patch": int(row["patch"]),
            "label": row["patch_label"], "teams": [row["blue_team"], row["red_team"]],
            "winner": int(row["winner_side"] == "red"), "first": int(row["first_side"] == "red"),
            "actions": [hero for _, hero, _ in ordered],
        })

    dragon = json.loads(args.champions.read_text(encoding="utf-8"))
    heroes = {hero["key"]: [hero["name"], hero["id"], hero["image"]["full"]]
              for hero in dragon["data"].values()}
    missing = {hero for game in snapshot for hero in game["actions"] if hero not in heroes and hero not in ("0", "-1")}
    if missing or not snapshot:
        raise ValueError(f"Invalid snapshot. Missing champions: {missing}")
    output = {"version": dragon["version"], "heroes": heroes,
              "games": sorted(snapshot, key=lambda game: (game["date"], game["series"], game["number"]))}
    destination = Path(__file__).parent / "dist" / "data.json"
    destination.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(snapshot)} games, {len(heroes)} champions")


if __name__ == "__main__":
    main()
