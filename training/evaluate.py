"""Evaluate a trained QuickCast model against one or more opponents.

Run (from the repo root, after `npm run build:bridge`):
  training/.venv/Scripts/python training/evaluate.py training/models/<name>.zip
  training/.venv/Scripts/python training/evaluate.py training/models/<name>.zip --opponents scripted --games 500
"""
import argparse
import pathlib

from model_io import load_model

from train import evaluate

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("model", type=pathlib.Path, help="a saved model (.zip)")
    parser.add_argument("--opponents", nargs="+", default=["random", "scriptedNormal", "scripted"])
    parser.add_argument("--games", type=int, default=200, help="games per opponent")
    args = parser.parse_args()

    model = load_model(args.model)
    for opponent in args.opponents:
        result = evaluate(model, args.games, opponent)
        print(f"\nvs {opponent}: win rate {result['winRate']:.1%} "
              f"({result['win']} wins, {result['loss']} losses, {result['draw']} draws), mean reward {result['meanReward']:+.2f}")
        combos = result["combosPerGame"]
        print(f"  {'combos per game':32}{'model':>8}{'opponent':>10}")
        for key in combos["agent"]:
            print(f"  {key:32}{combos['agent'][key]:8.2f}{combos['opponent'][key]:10.2f}")
