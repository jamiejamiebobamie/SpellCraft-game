"""The moves dictionary: the player's recorded moves against the NPC (MoveRecorder.ts, downloaded with the
8 key), used to teach a new NPC by example before it learns by playing.

- load_demos: the moves, as arrays (observations, legal-move masks, actions), keeping the ones worth
  learning from: made before the NPC moved (moving first) or in reply to it (moving second), not a
  fake-out's bait, and recorded with this model's observation layout.
- pretrain: the copy phase, the policy taught to choose the player's moves (behavior cloning).
- DemoPullCallback: during training by self-play, a pull toward the player's moves that fades to nothing
  over the first part of training, then pure self-play.
"""
import json
import pathlib

import numpy as np
import torch
from stable_baselines3.common.callbacks import BaseCallback


def _mask_from_hex(hex_mask: str, num_actions: int) -> np.ndarray:
    """A legal-move bitmask (4 actions a hex digit, action 0 the lowest bit of the first) as booleans."""
    mask = np.zeros(num_actions, dtype=bool)
    for k in range(num_actions):
        mask[k] = (int(hex_mask[k // 4], 16) >> (k % 4)) & 1
    return mask


def load_demos(paths: list, observation_size: int, num_actions: int, wins_only: bool = False) -> dict:
    """The recorded moves in `paths` (JSON files), filtered (see above), as arrays; and what was kept."""
    observations, masks, actions = [], [], []
    counts = {"total": 0, "duplicate": 0, "bait": 0, "duringNpc": 0, "otherLayout": 0, "notWon": 0, "kept": 0}
    seen = set()  # (each download has every move saved in that browser: the same move in several files counted once)
    for path in paths:
        for move in json.loads(pathlib.Path(path).read_text())["moves"]:
            counts["total"] += 1
            key = (move["match"], move["turn"], move["phase"], move["action"], move["legal"], json.dumps(move["obs"]))
            if key in seen:
                counts["duplicate"] += 1
                continue
            seen.add(key)
            if move.get("isBait"):
                counts["bait"] += 1
                continue
            if move["phase"] == "during":
                counts["duringNpc"] += 1
                continue
            if move["size"] != observation_size:
                counts["otherLayout"] += 1
                continue
            if wins_only and move.get("outcome") != "win":
                counts["notWon"] += 1
                continue
            observation = np.zeros(observation_size, dtype=np.float32)
            for index, value in move["obs"]:
                observation[index] = value
            observations.append(observation)
            masks.append(_mask_from_hex(move["legal"], num_actions))
            actions.append(move["action"])
            counts["kept"] += 1
    return {
        "observations": np.array(observations, dtype=np.float32).reshape(-1, observation_size),
        "masks": np.array(masks, dtype=bool).reshape(-1, num_actions),
        "actions": np.array(actions, dtype=np.int64),
        "counts": counts,
    }


def demo_loss(policy, demos: dict, indices: np.ndarray) -> torch.Tensor:
    """How unlikely the policy finds the player's moves (mean negative log-probability, legal moves only)."""
    device = policy.device
    observations = torch.as_tensor(demos["observations"][indices], device=device)
    actions = torch.as_tensor(demos["actions"][indices], device=device)
    _, log_prob, _ = policy.evaluate_actions(observations, actions, action_masks=demos["masks"][indices])
    return -log_prob.mean()


def pretrain(model, demos: dict, epochs: int, batch_size: int = 64, seed: int = 0) -> list:
    """The copy phase: `epochs` passes over the moves, the policy taught to choose them. Returns each pass's loss."""
    rng = np.random.default_rng(seed)
    policy, losses = model.policy, []
    count = len(demos["actions"])
    policy.set_training_mode(True)
    for _ in range(epochs):
        order, total = rng.permutation(count), 0.0
        for start in range(0, count, batch_size):
            loss = demo_loss(policy, demos, order[start:start + batch_size])
            policy.optimizer.zero_grad()
            loss.backward()
            policy.optimizer.step()
            total += loss.item() * len(order[start:start + batch_size])
        losses.append(total / count)
    return losses


def demo_accuracy(model, demos: dict) -> float:
    """How often the policy's top move is the player's."""
    policy = model.policy
    with torch.no_grad():
        observations = torch.as_tensor(demos["observations"], device=policy.device)
        distribution = policy.get_distribution(observations, action_masks=demos["masks"])
        chosen = distribution.distribution.probs.argmax(dim=1).cpu().numpy()
    return float(np.mean(chosen == demos["actions"])) if len(chosen) else 0.0


class DemoPullCallback(BaseCallback):
    """
    During training by self-play: after each round of play, a few steps toward the player's moves,
    weighted `pull` at first and fading to nothing by `fade` (a fraction of the training's steps).
    """

    def __init__(self, demos: dict, total_steps: int, pull: float = 0.5, fade: float = 0.25, steps_per_round: int = 4, batch_size: int = 64):
        super().__init__()
        self.demos, self.total_steps, self.pull, self.fade = demos, total_steps, pull, fade
        self.steps_per_round, self.batch_size = steps_per_round, batch_size
        self.rng = np.random.default_rng(0)
        self.start_steps = None

    def _on_step(self) -> bool:
        return True

    def _on_rollout_end(self) -> None:
        if self.start_steps is None:
            self.start_steps = self.num_timesteps
        progress = (self.num_timesteps - self.start_steps) / max(1, self.total_steps)
        weight = self.pull * max(0.0, 1.0 - progress / self.fade) if self.fade > 0 else 0.0
        self.logger.record("demos/pull", weight)
        if weight <= 0 or not len(self.demos["actions"]):
            return
        policy = self.model.policy
        policy.set_training_mode(True)
        for _ in range(self.steps_per_round):
            indices = self.rng.choice(len(self.demos["actions"]), size=min(self.batch_size, len(self.demos["actions"])), replace=False)
            loss = weight * demo_loss(policy, self.demos, indices)
            policy.optimizer.zero_grad()
            loss.backward()
            policy.optimizer.step()
        self.logger.record("demos/loss", loss.item() / weight)
