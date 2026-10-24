"""Review a trained NPC's habits: games against the scripted opponents, played as the game plays it (moves
picked at random weighted by the model's scores, with the variety nudge: NpcBrain.ts NPC_VARIETY), and a
tally of what it casts: spells, shapes, wasteful shapes, passing, and its win rate.

Run (from the repo root, after `npm run build:bridge`):
  training/.venv/Scripts/python training/review_npc.py                       # the NPC in the game now
  training/.venv/Scripts/python training/review_npc.py training/models/<name>.zip --games 300

Shapes, by how a drawing over a rectangle is cast: Fireballs and Water Wheels are squares, Chain
Lightning horizontal chains, the drafts vertical stacks; a rectangle that isn't one becomes several.
'mixed sizes' marks a Fireball or Water Wheel rectangle split into squares of different sizes (e.g. 3x2:
a 2x2 and two 1x1s): bigger squares are faster, so the 2x2 swallows its own 1x1s (the fire bonus doesn't
stack), wasting their focus.
"""
import argparse
import collections
import json
import pathlib

import numpy as np
import torch

from model_io import load_model
from quickcast_env import QuickCastEnv

ROOT = pathlib.Path(__file__).parent.parent
SPELLS = ["Water Wheel", "Fireball", "Chain Lightning", "Updraft", "Downdraft"]  # (SPELL_ORDER: Phlegm, Ether, Quicken, GyreUp, GyreDown)
RECTS = [(i, j, w, h) for h in range(1, 4) for w in range(1, 4) for i in range(0, 4 - h) for j in range(0, 4 - w)]
LAYOUTS = {341: "v1", 342: "v2", 344: "current"}
VARIETY = {"temperature": 1.0, "window": 4, "penalty": 1.5}  # (NpcBrain.ts NPC_VARIETY, as in the game now)


def decode(action: int, end_turn: int):
    if action == end_turn:
        return None
    spell, (i, j, w, h) = SPELLS[action // len(RECTS)], RECTS[action % len(RECTS)]
    return spell, w, h


def shape_kind(spell: str, w: int, h: int) -> str:
    if spell in ("Water Wheel", "Fireball"):
        if w == h:
            return "one square"
        if w == 1 or h == 1:
            return "1x1s in a line"
        return "mixed sizes"
    if spell == "Chain Lightning":
        return "one chain" if h == 1 else f"{h} chains"
    return "one stack" if w == 1 else f"{w} stacks"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("model", nargs="?", type=pathlib.Path, help="a saved model (.zip); default: the game's (public/models/npc-policy.json)")
    parser.add_argument("--games", type=int, default=200, help="games per opponent")
    parser.add_argument("--opponents", nargs="+", default=["scripted", "scriptedNormal"])
    parser.add_argument("--best-move", action="store_true", help="always its top move (no randomness or variety nudge)")
    args = parser.parse_args()

    path = args.model or ROOT / "training" / "models" / json.loads((ROOT / "public" / "models" / "npc-policy.json").read_text())["model"]
    model = load_model(path)
    layout = LAYOUTS[model.observation_space.shape[0]]
    print(f"Reviewing {path.name} (observation layout {layout}), {'its top move' if args.best_move else 'played as in the game'}\n")
    rng = np.random.default_rng(0)

    for opponent in args.opponents:
        env = QuickCastEnv(opponent=opponent, layout=layout)
        end_turn = env.end_turn_action
        outcomes, casts, shapes, sizes = collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter()
        turns_first = turns_first_passed = 0
        casts_per_turn = []
        for game in range(args.games):
            observation, _ = env.reset(seed=game)
            recent, terminated, info = [], False, {}
            turn_casts, turn, moving_second = 0, 0, None
            while not terminated:
                mask = env.action_masks()
                if moving_second is None:  # (as its turn begins: isMovingSecond, the 6th number after the board; v1 lacks it)
                    moving_second = bool(observation[336 + 5]) if layout != "v1" else False
                with torch.no_grad():
                    distribution = model.policy.get_distribution(torch.as_tensor(observation[None]), action_masks=mask[None])
                    scores = distribution.distribution.logits[0].numpy().astype(np.float64)
                legal = np.flatnonzero(mask)
                if args.best_move:
                    action = int(legal[np.argmax(scores[legal])])
                else:
                    keys = [decode(a, end_turn) for a in legal]
                    adjusted = scores[legal] - VARIETY["penalty"] * np.array([recent.count(k) if k else 0 for k in keys])
                    weights = np.exp((adjusted - adjusted.max()) / VARIETY["temperature"])
                    action = int(rng.choice(legal, p=weights / weights.sum()))
                move = decode(action, end_turn)
                if move is None:
                    if not moving_second:
                        turns_first += 1
                        if turn_casts == 0 and mask[:end_turn].any():
                            turns_first_passed += 1
                    casts_per_turn.append(turn_casts)
                    turn_casts, moving_second = 0, None
                else:
                    spell, w, h = move
                    casts[spell] += 1
                    shapes[(spell, shape_kind(spell, w, h))] += 1
                    sizes[f"{spell} {w}x{h}"] += 1
                    turn_casts += 1
                    recent = (recent + [move])[-VARIETY["window"]:]
                observation, _, terminated, _, info = env.step(action)
            outcomes[info["outcome"]] += 1
        env.close()

        total = sum(casts.values())
        print(f"=== vs {opponent} ({args.games} games): won {outcomes['win']}, lost {outcomes['loss']}, drew {outcomes['draw']}")
        print(f"  casts per turn: {np.mean(casts_per_turn):.2f}; passed {turns_first_passed} of {turns_first} turns moving first ({turns_first_passed / max(1, turns_first):.0%}) though it could cast")
        print("  spells: " + ", ".join(f"{s} {casts[s] / total:.0%}" for s in SPELLS))
        print("  shapes:")
        for spell in SPELLS:
            kinds = {k: n for (s, k), n in shapes.items() if s == spell}
            if kinds:
                print(f"    {spell:16}" + ", ".join(f"{k} {n / casts[spell]:.0%}" for k, n in sorted(kinds.items(), key=lambda kv: -kv[1])))
        print("  most cast: " + ", ".join(f"{k} {n / total:.0%}" for k, n in sizes.most_common(8)))
        print()


if __name__ == "__main__":
    main()
