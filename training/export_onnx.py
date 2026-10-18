"""Export a trained QuickCast model to ONNX, for the NPC in the browser (onnxruntime-web).

Run (from the repo root):
  training/.venv/Scripts/python training/export_onnx.py training/models/<name>.zip

Writes public/models/npc-policy.onnx (input "observation" [1, observationSize] -> output "logits"
[1, numActions]) and npc-policy.json (where it came from). The browser picks the highest-scoring
legal action, like the model's deterministic choice during evaluation; this script checks the
exported model gives the same scores as the original.
"""
import argparse
import json
import pathlib

import numpy as np
import onnxruntime
import torch

from model_io import load_model

PUBLIC_MODELS_DIR = pathlib.Path(__file__).parent.parent / "public" / "models"


class PolicyLogits(torch.nn.Module):
    """The policy network's action scores (before masking) for an observation."""

    def __init__(self, policy):
        super().__init__()
        self.policy = policy

    def forward(self, observation):
        features = self.policy.extract_features(observation, self.policy.pi_features_extractor)
        return self.policy.action_net(self.policy.mlp_extractor.forward_actor(features))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("model", type=pathlib.Path, help="a saved model (.zip)")
    args = parser.parse_args()

    model = load_model(args.model, device="cpu")
    policy = PolicyLogits(model.policy).eval()
    observation_size = model.observation_space.shape[0]
    onnx_path = PUBLIC_MODELS_DIR / "npc-policy.onnx"

    example = torch.zeros((1, observation_size), dtype=torch.float32)
    torch.onnx.export(policy, (example,), str(onnx_path), input_names=["observation"], output_names=["logits"],
                      dynamo=False)

    # The exported model must score actions exactly like the original
    session = onnxruntime.InferenceSession(str(onnx_path))
    observations = np.random.default_rng(0).random((64, observation_size), dtype=np.float32)
    with torch.no_grad():
        expected = np.concatenate([policy(torch.from_numpy(o[None])).numpy() for o in observations])
    actual = np.concatenate([session.run(["logits"], {"observation": o[None]})[0] for o in observations])
    assert np.allclose(expected, actual, atol=1e-4), f"ONNX differs from PyTorch by up to {np.abs(expected - actual).max()}"
    assert (expected.argmax(1) == actual.argmax(1)).all(), "ONNX picks different actions than PyTorch"

    description_path = args.model.with_suffix(".json")
    description = json.loads(description_path.read_text()) if description_path.exists() else {}
    (PUBLIC_MODELS_DIR / "npc-policy.json").write_text(json.dumps({
        "model": args.model.name,
        "rulesCommit": description.get("rulesCommit"),
        "observationSize": observation_size,
        "numActions": int(model.action_space.n),
        "evaluation": description.get("evaluation", {}).get("after"),
    }, indent=2))
    print(f"Exported {onnx_path} ({onnx_path.stat().st_size / 1024:.0f} KB); matches the original on 64 random observations")
