#!/usr/bin/env python3

from __future__ import annotations

import json
import sys

def main(language: str, keyboard: str, path: str):
    storage = {
        4: [],
        5: [],
        6: [],
        7: [],
        8: [],
    }

    with open(f"{language}/{keyboard}.json", "rt") as infile:
        valid_chars = [item for sublist in json.load(infile) for item in sublist if item not in ["\n", "\t"]]

    with open(path, "rt") as infile:
        for line in infile:
            line = line.strip()

            if len(line) < 4 or len(line) > 8:
                continue

            if not all(char in valid_chars for char in line):
                print(f"Skipping {line} for invalid chars")
                continue

            if len(set(line)) <= int(len(line) / 2):
                print(f"Skipping {line} for not enough unique letters")
                continue

            storage[len(line)].append(line)

    for length in storage:
        with open(f"{language}/length{length}.json", "wt", encoding="utf-8") as outfile:
            print(f"Writing {len(storage[length])} words of length {length}.")
            json.dump(storage[length], outfile)


if __name__ == "__main__":
    main(*sys.argv[1:])
