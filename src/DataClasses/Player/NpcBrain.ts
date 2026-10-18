// NpcBrain.ts
// The trained NPC: runs the model exported by training/export_onnx.py (public/models/npc-policy.onnx)
// on the live game, using the same observation and legal-move rules as training (NpcTrainingEnv.ts).
import * as ort from 'onnxruntime-web';
import { ref } from 'valtio';
import { CellIndex, InferenceString } from '../types';
import { SpellName } from '../GameRules/GameSimulation';
import { END_TURN_ACTION, GameView, decodeAction, encodeObservation, getActionMask } from '../GameRules/NpcTrainingEnv';

/**
 * How the NPC picks its spells:
 * - 'trained': the trained model (falls back to 'random' until the model has loaded)
 * - 'random': random symbols, as before training
 */
export const NPC_POLICY: 'trained' | 'random' = 'trained';

const MODEL_PATH = './models/npc-policy.onnx';

/** The symbol the NPC draws for each spell. */
const SPELL_SYMBOLS: Record<SpellName, InferenceString> = {
  Phlegm: 'star', Ether: 'circle', Quicken: 'line', GyreUp: 'diamond', GyreDown: 'triangle',
};

/** A cast the NPC has decided on: the symbol to draw and the cells its drawing covers. */
export type PlannedNpcCast = { inferenceString: InferenceString; cells: Array<CellIndex> };

export class NpcBrain {
  private session: ort.InferenceSession | null = null;

  constructor() {
    if (NPC_POLICY !== 'trained') return;
    ort.InferenceSession.create(MODEL_PATH)
      // ref(): keep valtio from proxying the native inference session
      .then(session => { this.session = ref(session); })
      .catch(err => console.error('Failed to load the NPC model; the NPC will play randomly', err));
  }

  getIsReady = (): boolean => !!this.session;

  /** The model's choice for `side`: a cast, or null to end its turn. */
  planCast = async (view: GameView, side: number): Promise<PlannedNpcCast | null> => {
    if (!this.session) return null;
    const observation = Float32Array.from(encodeObservation(view, side));
    const mask = getActionMask(view, side);
    const { logits } = await this.session.run({ observation: new ort.Tensor('float32', observation, [1, observation.length]) });
    const scores = logits.data as Float32Array;

    let bestAction = END_TURN_ACTION;
    mask.forEach((isLegal, action) => { if (isLegal && scores[action] > scores[bestAction]) bestAction = action; });

    const decoded = decodeAction(bestAction, side);
    return decoded.kind === 'endTurn' ? null : { inferenceString: SPELL_SYMBOLS[decoded.spellName], cells: decoded.cells };
  };
}
