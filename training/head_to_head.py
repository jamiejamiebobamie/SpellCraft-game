"""Two trained NPCs against each other: which is stronger. Each plays with the observation layout it was
trained on; they swap sides each game; who moves first alternates each turn, as in the game.

Run (from the repo root, after `npm run build:bridge`):
  training/.venv/Scripts/python training/head_to_head.py training/models/<new>.zip training/models/<old>.zip --games 400
  (--best-move: each always plays its top move; otherwise as the game plays them: moves picked at random
  weighted by the model's scores, with the variety nudge, NpcBrain.ts)
"""
import argparse
import json
import pathlib
import subprocess

import numpy as np
import torch

from model_io import load_model

BRIDGE = pathlib.Path(__file__).parent / "bridge" / "dist" / "bridge.mjs"
LAYOUTS = {341: "v1", 342: "v2", 344: "current"}
SPELL_OF = ["Phlegm", "Ether", "Quicken", "GyreUp", "GyreDown"]
RECTS_PER_SPELL = 36
VARIETY = {"temperature": 1.0, "window": 4, "penalty": 1.5}  # (NpcBrain.ts NPC_VARIETY)
GAME_OVER = {0: "draw", 1: "left", 2: "right"}  # (GameOverStatus: BothDead, PlayerWon, NpcWon; TimesUp: by health)
CATCH_FIRST_TURN = 16  # (CAUGHT_RULES.firstTurn: the variety nudge is off from the turn before)


class Bridge:
    def __init__(self):
        self.process = subprocess.Popen(["node", str(BRIDGE)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8", bufsize=1)

    def __call__(self, **message):
        self.process.stdin.write(json.dumps(message) + "\n")
        self.process.stdin.flush()
        response = json.loads(self.process.stdout.readline())
        if "error" in response:
            raise RuntimeError(response["error"])
        return response

    def close(self):
        self.process.stdin.close()
        self.process.wait(timeout=5)


class Player:
    def __init__(self, path: pathlib.Path, best_move: bool, rng):
        self.name, self.model = path.stem, load_model(path)
        self.layout = LAYOUTS[self.model.observation_space.shape[0]]
        self.best_move, self.rng, self.recent = best_move, rng, []

    def choose(self, observation, mask, end_turn: int, turn: int) -> int:
        with torch.no_grad():
            distribution = self.model.policy.get_distribution(torch.as_tensor(np.array(observation, dtype=np.float32)[None]), action_masks=mask[None])
            scores = distribution.distribution.logits[0].numpy().astype(np.float64)
        legal = np.flatnonzero(mask)
        if self.best_move:
            return int(legal[np.argmax(scores[legal])])
        penalty = 0 if turn + 1 >= CATCH_FIRST_TURN else VARIETY["penalty"]
        keys = [None if a == end_turn else SPELL_OF[a // RECTS_PER_SPELL] for a in legal]
        adjusted = scores[legal] - penalty * np.array([self.recent.count(k) if k else 0 for k in keys])
        weights = np.exp((adjusted - adjusted.max()) / VARIETY["temperature"])
        action = int(self.rng.choice(legal, p=weights / weights.sum()))
        if action != end_turn:
            self.recent = (self.recent + [SPELL_OF[action // RECTS_PER_SPELL]])[-VARIETY["window"]:]
        return action


def play(bridge: Bridge, players: list, seed: int, end_turn: int) -> str:
    """One game (players[0] on the left): 'left', 'right' or 'draw'."""
    bridge(cmd="match.reset", seed=seed)
    for p in players:
        p.recent = []
    turn = 0
    while True:
        # (the left side moves second on even turns, as the agent does in training)
        order = [1, 0] if turn % 2 == 0 else [0, 1]
        for k, side in enumerate(order):
            for _ in range(12):
                view = bridge(cmd="match.view", side=side, layout=players[side].layout, isMovingSecond=k == 1)
                mask = np.array(view["actionMask"], dtype=bool)
                action = players[side].choose(view["observation"], mask, end_turn, turn)
                if action == end_turn:
                    break
                bridge(cmd="match.act", side=side, action=action)
        result = bridge(cmd="match.endTurn")
        turn = result["turnsElapsed"]
        if result["gameOver"] is not None:
            if result["gameOver"] in GAME_OVER:
                return GAME_OVER[result["gameOver"]]
            left, right = result["healths"]  # (a teacher's catch: the weaker is caught)
            return "left" if left > right else "right" if right > left else "draw"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("first", type=pathlib.Path)
    parser.add_argument("second", type=pathlib.Path)
    parser.add_argument("--games", type=int, default=400)
    parser.add_argument("--best-move", action="store_true")
    args = parser.parse_args()

    rng = np.random.default_rng(0)
    a, b = Player(args.first, args.best_move, rng), Player(args.second, args.best_move, rng)
    bridge = Bridge()
    end_turn = bridge(cmd="spec")["endTurnAction"]
    tally = {a.name: 0, b.name: 0, "draw": 0}
    for game in range(args.games):
        players = [a, b] if game % 2 == 0 else [b, a]  # (sides swapped each game)
        winner = play(bridge, players, seed=game, end_turn=end_turn)
        tally["draw" if winner == "draw" else players[0 if winner == "left" else 1].name] += 1
    bridge.close()
    print(f"{args.games} games ({'top moves' if args.best_move else 'played as in the game'}):")
    for name, wins in tally.items():
        print(f"  {name}: {wins} ({wins / args.games:.0%})")


if __name__ == "__main__":
    main()
