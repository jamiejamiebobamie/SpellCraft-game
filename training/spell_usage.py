"""How often a trained model casts each spell (and how big), over games against an opponent.

Run (from the repo root, after `npm run build:bridge`):
  training/.venv/Scripts/python training/spell_usage.py training/models/<name>.zip --games 200
"""
import argparse
import collections
import pathlib

from model_io import load_model
from quickcast_env import QuickCastEnv

SPELL_ORDER = ["Phlegm", "Ether", "Quicken", "GyreUp", "GyreDown"]  # as in NpcTrainingEnv.ts
NAMES = {"Phlegm": "Water Wheel", "Ether": "Fireball", "Quicken": "Chain Lightning", "GyreUp": "Updraft", "GyreDown": "Downdraft"}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("model", type=pathlib.Path)
    parser.add_argument("--games", type=int, default=200)
    parser.add_argument("--opponent", default="mixed")
    parser.add_argument("--seed", type=int, default=2_000_000)
    args = parser.parse_args()

    env = QuickCastEnv(opponent=args.opponent)
    model = load_model(args.model, env=None)
    rects = (env.action_space.n - 1) // len(SPELL_ORDER)
    casts = collections.Counter()
    turns = 0
    for game in range(args.games):
        observation, _ = env.reset(seed=args.seed + game)
        terminated = False
        while not terminated:
            mask = env.action_masks()
            action, _ = model.predict(observation, action_masks=mask, deterministic=True)
            action = int(action)
            if action == env.end_turn_action:
                turns += 1
            else:
                spell = SPELL_ORDER[action // rects]
                casts[spell] += 1
            observation, _, terminated, _, _ = env.step(action)
    env.close()

    total = sum(casts.values())
    print(f"{args.games} games vs {args.opponent}: {total} casts over {turns} turns ({total / max(1, turns):.2f} a turn)")
    for spell in SPELL_ORDER:
        print(f"  {NAMES[spell]:16} {casts[spell]:6}  {100 * casts[spell] / max(1, total):5.1f}%")


if __name__ == "__main__":
    main()
