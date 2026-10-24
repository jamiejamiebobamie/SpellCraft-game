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
// A match between two models (training/head_to_head.py drives both sides):
//   {"cmd": "match.reset", "seed": n}                  {"turnsElapsed"}
//   {"cmd": "match.view", "side": 0|1, "layout": name, "isMovingSecond": bool}  {"observation", "actionMask"}
//   {"cmd": "match.act", "side": 0|1, "action": n}       {} (a cast; the end-turn action does nothing)
//   {"cmd": "match.endTurn"}                           {"turnsElapsed", "gameOver", "healths"}
// A step result is {"observation", "actionMask", "reward", "terminated", "info"}; errors are
// {"error": message}.
import { createInterface } from 'node:readline';
import { END_TURN_ACTION, NUM_ACTIONS, NpcTrainingEnv, ObservationLayout, OpponentName, decodeAction, encodeObservation, getActionMask, getObservationSize } from '../../src/DataClasses/GameRules/NpcTrainingEnv';
import { GameSimulation } from '../../src/DataClasses/GameRules/GameSimulation';

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
let match = new GameSimulation();

type Request =
  | { cmd: 'spec'; layout?: ObservationLayout }
  | { cmd: 'reset'; seed?: number; opponent?: OpponentName; layout?: ObservationLayout }
  | { cmd: 'step'; action: number }
  | { cmd: 'match.reset'; seed: number }
  | { cmd: 'match.view'; side: number; layout: ObservationLayout; isMovingSecond: boolean }
  | { cmd: 'match.act'; side: number; action: number }
  | { cmd: 'match.endTurn' };

const env = new NpcTrainingEnv();

const handle = (request: Request): unknown => {
  switch (request.cmd) {
    case 'spec': return { observationSize: getObservationSize(request.layout ?? 'current'), numActions: NUM_ACTIONS, endTurnAction: END_TURN_ACTION };
    case 'reset': return env.reset({ seed: request.seed, opponent: request.opponent, layout: request.layout });
    case 'step': return env.step(request.action);
    case 'match.reset': match = new GameSimulation({ random: mulberry32(request.seed) }); return { turnsElapsed: 0 };
    case 'match.view': return {
      observation: encodeObservation({ ...match, isMovingSecond: request.isMovingSecond }, request.side, request.layout),
      actionMask: getActionMask(match, request.side),
    };
    case 'match.act': {
      const decoded = decodeAction(request.action, request.side);
      if (decoded.kind === 'cast' && getActionMask(match, request.side)[request.action]) match.cast(request.side, decoded.spellName, decoded.cells);
      return {};
    }
    case 'match.endTurn': match.endTurn(); return { turnsElapsed: match.turnsElapsed, gameOver: match.gameOver, healths: match.players.map(p => p.getHealth()) };
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
