// NpcBrain.ts
// The trained NPC: runs the model exported by training/export_onnx.py (public/models/npc-policy.onnx)
// on the live game, using the same observation and legal-move rules as training (NpcTrainingEnv.ts).
import * as ort from 'onnxruntime-web';
import { ref } from 'valtio';
import { AssetLoader, LoaderProperties } from '../AssetLoader/AssetLoader';
import { CellIndex, InferenceString } from '../types';
import { SpellName } from '../GameRules/GameSimulation';
import { GameView, decodeAction, encodeObservation, getActionMask } from '../GameRules/NpcTrainingEnv';

/**
 * How the NPC picks its spells:
 * - 'trained': the trained model (falls back to 'random' until the model has loaded)
 * - 'random': random symbols, as before training
 */
export const NPC_POLICY: 'trained' | 'random' = 'trained';

/** Variety in the trained NPC's play: it picks moves at random, weighted by how good the model rates them. */
export const NPC_VARIETY = {
  temperature: 1, // how adventurous: 0 = always its top move, 1 = as in training, higher = tries weaker moves more often
  repeatWindow: 4, // how many of its recent casts it remembers (a cast = the same spell over the same area)
  repeatPenalty: 1.5, // how strongly it avoids repeating a remembered cast, per repeat (in the model's scores)
};

const MODEL_PATH = './models/npc-policy.onnx';

/** The symbol the NPC draws for each spell. */
const SPELL_SYMBOLS: Record<SpellName, InferenceString> = {
  Phlegm: 'star', Ether: 'circle', Quicken: 'line', GyreUp: 'diamond', GyreDown: 'triangle',
};

/** A cast the NPC has decided on: the symbol to draw and the cells its drawing covers. */
export type PlannedNpcCast = { inferenceString: InferenceString; cells: Array<CellIndex> };

export class NpcBrain {
  private session: ort.InferenceSession | null = null;
  private recentActions: Array<number> = [];

  /** Loads the model; the game waits for it on the loading screen (AssetLoader isNpcModelLoaded). */
  constructor(assetLoader: AssetLoader) {
    const setIsLoaded = () => assetLoader.setIsLoading(new Map<LoaderProperties, boolean>([['isNpcModelLoaded', true]]));
    if (NPC_POLICY !== 'trained') {
      setIsLoaded();
      return;
    }
    ort.InferenceSession.create(MODEL_PATH)
      // ref(): keep valtio from proxying the native inference session
      .then(session => { this.session = ref(session); })
      .catch(err => console.error('Failed to load the NPC model; the NPC will play randomly', err))
      .finally(setIsLoaded);
  }

  getIsReady = (): boolean => !!this.session;

  /** The model's choice for `side`: a cast, or null to end its turn. */
  planCast = async (view: GameView, side: number): Promise<PlannedNpcCast | null> => {
    if (!this.session) return null;
    const observation = Float32Array.from(encodeObservation(view, side));
    const mask = getActionMask(view, side);
    const { logits } = await this.session.run({ observation: new ort.Tensor('float32', observation, [1, observation.length]) });
    const action = this.chooseAction(logits.data as Float32Array, mask);

    const decoded = decodeAction(action, side);
    if (decoded.kind === 'endTurn') return null;
    this.recentActions = [...this.recentActions, action].slice(-NPC_VARIETY.repeatWindow);
    return { inferenceString: SPELL_SYMBOLS[decoded.spellName], cells: decoded.cells };
  };

  /** A legal action, sampled from the model's scores, with recent moves made less likely (NPC_VARIETY). */
  private chooseAction = (scores: Float32Array, mask: Array<boolean>): number => {
    const { temperature, repeatPenalty } = NPC_VARIETY;
    const legal = mask.map((isLegal, action) => isLegal ? action : -1).filter(action => action >= 0);
    const adjusted = legal.map(action =>
      scores[action] - repeatPenalty * this.recentActions.filter(recent => recent === action).length);

    if (temperature <= 0) return legal[adjusted.indexOf(Math.max(...adjusted))];
    const top = Math.max(...adjusted);
    const weights = adjusted.map(score => Math.exp((score - top) / temperature));
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let k = 0; k < legal.length; k++) {
      roll -= weights[k];
      if (roll <= 0) return legal[k];
    }
    return legal[legal.length - 1];
  };
}
