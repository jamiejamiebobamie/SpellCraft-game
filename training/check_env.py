"""Sanity checks for QuickCastEnv: Gymnasium's API checker, then random games and their speed.

Run: training/.venv/Scripts/python training/check_env.py
"""
import time

import numpy as np
from gymnasium.utils.env_checker import check_env

from quickcast_env import QuickCastEnv


def play_random_games(env: QuickCastEnv, num_games: int, seed: int = 0):
    rng = np.random.default_rng(seed)
    outcomes = {"win": 0, "loss": 0, "draw": 0}
    steps = 0
    rewards = []
    for game in range(num_games):
        _, info = env.reset(seed=seed + game)
        total_reward, terminated = 0.0, False
        while not terminated:
            legal = np.flatnonzero(env.action_masks())
            _, reward, terminated, _, info = env.step(rng.choice(legal))
            total_reward += reward
            steps += 1
        outcomes[info["outcome"]] += 1
        rewards.append(total_reward)
    return outcomes, steps, float(np.mean(rewards))


if __name__ == "__main__":
    env = QuickCastEnv(opponent="random")
    check_env(env, skip_render_check=True)
    print("Gymnasium API check passed.")

    start = time.perf_counter()
    outcomes, steps, mean_reward = play_random_games(env, num_games=200)
    elapsed = time.perf_counter() - start
    print(f"200 random games vs the random opponent: {outcomes}, mean reward {mean_reward:+.3f}")
    print(f"{steps} steps in {elapsed:.1f}s ({steps / elapsed:,.0f} steps/s through the bridge)")
    env.close()
