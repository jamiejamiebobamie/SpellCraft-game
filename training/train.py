"""Train the QuickCast NPC with MaskablePPO (PPO that never picks illegal moves).

Run (from the repo root, after `npm run build:bridge`):
  training/.venv/Scripts/python training/train.py --steps 200000
  training/.venv/Scripts/python training/train.py --steps 200000 --resume training/models/<name>.zip
  training/.venv/Scripts/python training/train.py --steps 2000000 --demos training/demos/*.json
With --demos (the player's recorded moves, MoveRecorder.ts: the moves dictionary), a new model first learns
to choose the player's moves (--demo-epochs), then trains by playing with a pull toward them that fades to
nothing over the first --demo-fade of its steps (demos.py).

Each run saves a model (.zip) and a description (.json: the git commit of the rules it was trained
on, settings, its win rate and combos) to training/models/, plus checkpoints along the way.

Charts (win rate, game length, and how often each combo happens, for the agent and its opponent):
  training/.venv/Scripts/tensorboard --logdir training/runs
"""
import argparse
import datetime
import json
import pathlib
import subprocess

import numpy as np
from sb3_contrib import MaskablePPO
from stable_baselines3.common.callbacks import BaseCallback, CallbackList, CheckpointCallback
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.vec_env import SubprocVecEnv

from demos import DemoPullCallback, demo_accuracy, load_demos, pretrain
from model_io import load_model
from quickcast_env import QuickCastEnv

MODELS_DIR = pathlib.Path(__file__).parent / "models"
RUNS_DIR = pathlib.Path(__file__).parent / "runs"


def mean_combos(infos: list, side: str) -> dict:
    """Average count of each spell interaction per game, for 'agent' or 'opponent'."""
    keys = infos[0]["interactions"][side].keys()
    return {key: float(np.mean([info["interactions"][side][key] for info in infos])) for key in keys}


class GameStatsCallback(BaseCallback):
    """Logs, per rollout, the agent's win rate, game length, and combos per game (agent and opponent)."""

    def __init__(self):
        super().__init__()
        self._finished_games = []

    def _on_step(self) -> bool:
        for done, info in zip(self.locals["dones"], self.locals["infos"]):
            if done:
                self._finished_games.append(info)
        return True

    def _on_rollout_end(self) -> None:
        games = self._finished_games
        if not games:
            return
        self.logger.record("game/win_rate", float(np.mean([g["outcome"] == "win" for g in games])))
        for opponent in sorted({g["opponent"] for g in games}):
            vs = [g for g in games if g["opponent"] == opponent]
            self.logger.record(f"game/win_rate_vs_{opponent}", float(np.mean([g["outcome"] == "win" for g in vs])))
        self.logger.record("game/turns", float(np.mean([g["turnsElapsed"] for g in games])))
        for side in ("agent", "opponent"):
            for key, value in mean_combos(games, side).items():
                self.logger.record(f"combos_{side}/{key}", value)
        self._finished_games = []


def evaluate(model, num_games: int, opponent: str = "random", seed: int = 1_000_000) -> dict:
    """Plays `num_games` games with the model's best move each turn; returns the results."""
    env = QuickCastEnv(opponent=opponent)
    outcomes = {"win": 0, "loss": 0, "draw": 0}
    rewards, final_infos = [], []
    for game in range(num_games):
        observation, _ = env.reset(seed=seed + game)
        total_reward, terminated = 0.0, False
        while not terminated:
            action, _ = model.predict(observation, action_masks=env.action_masks(), deterministic=True)
            observation, reward, terminated, _, info = env.step(action)
            total_reward += reward
        outcomes[info["outcome"]] += 1
        rewards.append(total_reward)
        final_infos.append(info)
    env.close()
    return {
        **outcomes,
        "winRate": outcomes["win"] / num_games,
        "meanReward": float(np.mean(rewards)),
        "combosPerGame": {side: mean_combos(final_infos, side) for side in ("agent", "opponent")},
    }


def git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return "unknown"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--steps", type=int, default=200_000, help="training steps (agent actions)")
    parser.add_argument("--envs", type=int, default=8, help="games played in parallel")
    parser.add_argument("--opponent", default="mixed",
                        help="opponent to train against: random, scripted, scriptedNormal, or mixed (a mix of all three)")
    parser.add_argument("--resume", type=pathlib.Path, help="continue training this saved model")
    parser.add_argument("--eval-games", type=int, default=200, help="games for the before/after evaluation")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--demos", nargs="*", type=pathlib.Path, default=[],
                        help="the player's recorded moves (JSON files from the game's 8 key): taught first, then a fading pull")
    parser.add_argument("--demo-epochs", type=int, default=15, help="passes over the recorded moves before training by playing")
    parser.add_argument("--demo-pull", type=float, default=0.5, help="the pull toward them while training by playing, at first")
    parser.add_argument("--demo-fade", type=float, default=0.25, help="the share of the training's steps over which the pull fades out")
    parser.add_argument("--demo-wins-only", action="store_true", help="only moves from matches the player won")
    args = parser.parse_args()

    run_name = f"quickcast-{datetime.datetime.now():%Y%m%d-%H%M}-{git_commit()}"
    MODELS_DIR.mkdir(exist_ok=True)

    envs = make_vec_env(QuickCastEnv, n_envs=args.envs, seed=args.seed, env_kwargs={"opponent": args.opponent},
                        vec_env_cls=SubprocVecEnv if args.envs > 1 else None)
    if args.resume:
        model = load_model(args.resume, env=envs, tensorboard_log=str(RUNS_DIR))
        print(f"Resuming from {args.resume}")
    else:
        model = MaskablePPO("MlpPolicy", envs, seed=args.seed, verbose=1, tensorboard_log=str(RUNS_DIR))

    # The moves dictionary: the copy phase (a fresh model only), and the pull during training
    demos, demo_summary = None, None
    if args.demos:
        demos = load_demos(args.demos, model.observation_space.shape[0], int(model.action_space.n), args.demo_wins_only)
        demo_summary = {"files": [str(p) for p in args.demos], "counts": demos["counts"]}
        print(f"Recorded moves: {demos['counts']}")
        if not args.resume and len(demos["actions"]):
            losses = pretrain(model, demos, args.demo_epochs, seed=args.seed)
            demo_summary.update({"pretrainLosses": losses, "accuracyAfterCopying": demo_accuracy(model, demos)})
            print(f"Copy phase: loss {losses[0]:.3f} -> {losses[-1]:.3f}; picks the player's move {demo_summary['accuracyAfterCopying']:.0%} of the time")

    before = evaluate(model, args.eval_games, args.opponent)
    print(f"Before training: {before}")

    checkpoints = CheckpointCallback(save_freq=max(1, 50_000 // args.envs), save_path=str(MODELS_DIR / f"{run_name}-checkpoints"))
    callbacks = [checkpoints, GameStatsCallback()]
    if demos is not None and len(demos["actions"]):
        callbacks.append(DemoPullCallback(demos, args.steps, pull=args.demo_pull, fade=args.demo_fade))
    model.learn(total_timesteps=args.steps, callback=CallbackList(callbacks),
                tb_log_name=run_name, reset_num_timesteps=not args.resume)
    if demo_summary is not None:
        demo_summary["accuracyAfterTraining"] = demo_accuracy(model, demos)

    after = evaluate(model, args.eval_games, args.opponent)
    print(f"After training:  {after}")

    model_path = MODELS_DIR / f"{run_name}.zip"
    model.save(model_path)
    (MODELS_DIR / f"{run_name}.json").write_text(json.dumps({
        "model": model_path.name,
        "rulesCommit": git_commit(),
        "resumedFrom": str(args.resume) if args.resume else None,
        "steps": args.steps,
        "opponent": args.opponent,
        "demos": demo_summary,
        "evaluation": {"before": before, "after": after, "games": args.eval_games},
    }, indent=2))
    print(f"Saved {model_path}")
    envs.close()


if __name__ == "__main__":
    main()
