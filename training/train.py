"""Train the QuickCast NPC with MaskablePPO (PPO that never picks illegal moves).

Run (from the repo root, after `npm run build:bridge`):
  training/.venv/Scripts/python training/train.py --steps 200000
  training/.venv/Scripts/python training/train.py --steps 200000 --resume training/models/<name>.zip

Each run saves a model (.zip) and a description (.json: the git commit of the rules it was trained
on, settings, and its win rate) to training/models/, plus checkpoints along the way.
"""
import argparse
import datetime
import json
import pathlib
import subprocess

import numpy as np
from sb3_contrib import MaskablePPO
from stable_baselines3.common.callbacks import CheckpointCallback
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.vec_env import SubprocVecEnv

from quickcast_env import QuickCastEnv

MODELS_DIR = pathlib.Path(__file__).parent / "models"


def evaluate(model, num_games: int, opponent: str = "random", seed: int = 1_000_000) -> dict:
    """Plays `num_games` games with the model's best move each turn; returns the results."""
    env = QuickCastEnv(opponent=opponent)
    outcomes = {"win": 0, "loss": 0, "draw": 0}
    rewards = []
    for game in range(num_games):
        observation, _ = env.reset(seed=seed + game)
        total_reward, terminated = 0.0, False
        while not terminated:
            action, _ = model.predict(observation, action_masks=env.action_masks(), deterministic=True)
            observation, reward, terminated, _, info = env.step(action)
            total_reward += reward
        outcomes[info["outcome"]] += 1
        rewards.append(total_reward)
    env.close()
    return {**outcomes, "winRate": outcomes["win"] / num_games, "meanReward": float(np.mean(rewards))}


def git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return "unknown"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--steps", type=int, default=200_000, help="training steps (agent actions)")
    parser.add_argument("--envs", type=int, default=8, help="games played in parallel")
    parser.add_argument("--opponent", default="random", help="opponent to train against")
    parser.add_argument("--resume", type=pathlib.Path, help="continue training this saved model")
    parser.add_argument("--eval-games", type=int, default=200, help="games for the before/after evaluation")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    run_name = f"quickcast-{datetime.datetime.now():%Y%m%d-%H%M}-{git_commit()}"
    MODELS_DIR.mkdir(exist_ok=True)

    envs = make_vec_env(QuickCastEnv, n_envs=args.envs, seed=args.seed, env_kwargs={"opponent": args.opponent},
                        vec_env_cls=SubprocVecEnv if args.envs > 1 else None)
    if args.resume:
        model = MaskablePPO.load(args.resume, env=envs)
        print(f"Resuming from {args.resume}")
    else:
        model = MaskablePPO("MlpPolicy", envs, seed=args.seed, verbose=1)

    before = evaluate(model, args.eval_games, args.opponent)
    print(f"Before training: {before}")

    checkpoints = CheckpointCallback(save_freq=max(1, 50_000 // args.envs), save_path=str(MODELS_DIR / f"{run_name}-checkpoints"))
    model.learn(total_timesteps=args.steps, callback=checkpoints, reset_num_timesteps=not args.resume)

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
        "evaluation": {"before": before, "after": after, "games": args.eval_games},
    }, indent=2))
    print(f"Saved {model_path}")
    envs.close()


if __name__ == "__main__":
    main()
