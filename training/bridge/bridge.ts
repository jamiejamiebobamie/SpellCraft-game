// bridge.ts
// Runs one NpcTrainingEnv and talks to Python (training/quickcast_env.py) over stdin/stdout, one
// JSON message per line. Build with `npm run build:bridge` (bundles the game rules into
// training/bridge/dist/bridge.mjs).
//
// Requests:                                          Responses:
//   {"cmd": "spec", "layout"?: name}                {"observationSize", "numActions", "endTurnAction"}
//   {"cmd": "reset", "seed"?: n, "opponent"?: name, "layout"?: name}  a step result
// (layout: the observation's, an older model's to play or review it: ObservationLayout; default 'current')
//   {"cmd": "step", "action": n}                     a step result
// A step result is {"observation", "actionMask", "reward", "terminated", "info"}; errors are
// {"error": message}.
import { createInterface } from 'node:readline';
import { END_TURN_ACTION, NUM_ACTIONS, NpcTrainingEnv, ObservationLayout, OpponentName, getObservationSize } from '../../src/DataClasses/GameRules/NpcTrainingEnv';

type Request =
  | { cmd: 'spec'; layout?: ObservationLayout }
  | { cmd: 'reset'; seed?: number; opponent?: OpponentName; layout?: ObservationLayout }
  | { cmd: 'step'; action: number };

const env = new NpcTrainingEnv();

const handle = (request: Request): unknown => {
  switch (request.cmd) {
    case 'spec': return { observationSize: getObservationSize(request.layout ?? 'current'), numActions: NUM_ACTIONS, endTurnAction: END_TURN_ACTION };
    case 'reset': return env.reset({ seed: request.seed, opponent: request.opponent, layout: request.layout });
    case 'step': return env.step(request.action);
    default: return { error: `unknown command: ${JSON.stringify(request)}` };
  }
};

createInterface({ input: process.stdin }).on('line', line => {
  if (!line.trim()) return;
  let response: unknown;
  try {
    response = handle(JSON.parse(line));
  } catch (err) {
    response = { error: String(err) };
  }
  process.stdout.write(JSON.stringify(response) + '\n');
});
