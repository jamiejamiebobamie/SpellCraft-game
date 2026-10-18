"""Gymnasium environment for QuickCast.

The game rules live in TypeScript (src/DataClasses/GameRules). This environment starts the Node
bridge (training/bridge, built with `npm run build:bridge`) and talks to it over stdin/stdout, so
training always uses exactly the same rules as the game.

The agent plays the left side; observations, actions, legal-move masks and rewards are defined in
NpcTrainingEnv.ts. Use with sb3-contrib's MaskablePPO, which reads `action_masks()`.
"""
import json
import pathlib
import subprocess

import gymnasium as gym
import numpy as np
from gymnasium import spaces

BRIDGE_PATH = pathlib.Path(__file__).parent / "bridge" / "dist" / "bridge.mjs"


class QuickCastEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, opponent: str = "random"):
        if not BRIDGE_PATH.exists():
            raise FileNotFoundError(f"{BRIDGE_PATH} not found: run `npm run build:bridge` first")
        self.opponent = opponent
        self._process = subprocess.Popen(
            ["node", str(BRIDGE_PATH)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8", bufsize=1,
        )
        spec = self._request({"cmd": "spec"})
        self.observation_space = spaces.Box(0.0, 1.0, shape=(spec["observationSize"],), dtype=np.float32)
        self.action_space = spaces.Discrete(spec["numActions"])
        self.end_turn_action = spec["endTurnAction"]
        self._action_mask = np.ones(spec["numActions"], dtype=bool)

    def _request(self, message: dict) -> dict:
        self._process.stdin.write(json.dumps(message) + "\n")
        self._process.stdin.flush()
        line = self._process.stdout.readline()
        if not line:
            raise RuntimeError("the QuickCast bridge stopped unexpectedly")
        response = json.loads(line)
        if "error" in response:
            raise RuntimeError(f"QuickCast bridge error: {response['error']}")
        return response

    def _unpack(self, result: dict) -> np.ndarray:
        self._action_mask = np.array(result["actionMask"], dtype=bool)
        return np.array(result["observation"], dtype=np.float32)

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        # The game's own randomness (and the opponent's) comes from this seed, so episodes replay exactly
        game_seed = int(self.np_random.integers(0, 2**31 - 1))
        result = self._request({"cmd": "reset", "seed": game_seed, "opponent": self.opponent})
        return self._unpack(result), result["info"]

    def step(self, action):
        result = self._request({"cmd": "step", "action": int(action)})
        observation = self._unpack(result)
        return observation, float(result["reward"]), bool(result["terminated"]), False, result["info"]

    def action_masks(self) -> np.ndarray:
        """Legal actions right now (read by MaskablePPO)."""
        return self._action_mask

    def close(self):
        if self._process.poll() is None:
            self._process.stdin.close()
            self._process.wait(timeout=5)
