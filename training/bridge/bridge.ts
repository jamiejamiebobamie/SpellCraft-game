// bridge.ts
// Runs one NpcTrainingEnv and talks to Python (training/quickcast_env.py) over stdin/stdout, one
// JSON message per line. Build with `npm run build:bridge` (bundles the game rules into
// training/bridge/dist/bridge.mjs).
//
// Requests:                                          Responses:
//   {"cmd": "spec"}                                  {"observationSize", "numActions", "endTurnAction"}
//   {"cmd": "reset", "seed"?: n, "opponent"?: name}  a step result
//   {"cmd": "step", "action": n}                     a step result
// A step result is {"observation", "actionMask", "reward", "terminated", "info"}; errors are
// {"error": message}.
import { createInterface } from 'node:readline';
import { END_TURN_ACTION, NUM_ACTIONS, NpcTrainingEnv, OBSERVATION_SIZE, OpponentName } from '../../src/DataClasses/GameRules/NpcTrainingEnv';

type Request =
  | { cmd: 'spec' }
  | { cmd: 'reset'; seed?: number; opponent?: OpponentName }
  | { cmd: 'step'; action: number };

const env = new NpcTrainingEnv();

const handle = (request: Request): unknown => {
  switch (request.cmd) {
    case 'spec': return { observationSize: OBSERVATION_SIZE, numActions: NUM_ACTIONS, endTurnAction: END_TURN_ACTION };
    case 'reset': return env.reset({ seed: request.seed, opponent: request.opponent });
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
