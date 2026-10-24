// NpcBrain.ts
// The trained NPC: runs the model exported by training/export_onnx.py (public/models/npc-policy.onnx)
// on the live game, using the same observation and legal-move rules as training (NpcTrainingEnv.ts).
import type { InferenceSession } from 'onnxruntime-web';
import { loadOnnxRuntime } from '../NN_Model/onnxRuntime';
import { ref } from 'valtio';
import { AssetLoader, LoaderProperties } from '../AssetLoader/AssetLoader';
import { CellIndex, InferenceString } from '../types';
import { SpellName } from '../GameRules/GameSimulation';
import { GameView, ObservationLayout, decodeAction, encodeObservation, getActionMask, getIsRiskyTurn, getObservationLayout } from '../GameRules/NpcTrainingEnv';

/**
 * How the NPC picks its spells:
 * - 'trained': the trained model (falls back to 'random' until the model has loaded)
 * - 'random': random symbols, as before training
 */
export const NPC_POLICY: 'trained' | 'random' = 'trained';

/** Variety in the trained NPC's play: it picks moves at random, weighted by how good the model rates them. */
export const NPC_VARIETY = {
  temperature: 1, // how adventurous: 0 = always its top move, 1 = as in training, higher = tries weaker moves more often
  repeatWindow: 4, // how many of its recent casts it remembers (6 was tried: with training's own variety rewards, it passed more)
  // How strongly it avoids repeating a remembered move, per repeat (in the model's scores; 3 was tried). A
  // move is a spell, whatever its size or place (getMoveKey). Off on risky
  // turns (a teacher may catch someone at the turn's end: getIsRiskyTurn), where it plays only to win
  repeatPenalty: 1.5,
};

const MODEL_PATH = './models/npc-policy.onnx';
const MODEL_DESCRIPTION_PATH = './models/npc-policy.json'; // (its observationSize: the layout it was trained on)

/** The symbol the NPC draws for each spell. */
const SPELL_SYMBOLS: Record<SpellName, InferenceString> = {
  Phlegm: 'star', Ether: 'circle', Quicken: 'line', GyreUp: 'diamond', GyreDown: 'triangle',
};

/** A cast the NPC has decided on: the symbol to draw and the cells its drawing covers. */
export type PlannedNpcCast = { inferenceString: InferenceString; cells: Array<CellIndex> };

/**
 * A move for the repeat penalty: its spell, whatever its size or place (by size, a bigger or odd shape of the
 * same spell looked new, so the penalty pushed it toward wasteful ones).
 */
const getMoveKey = (action: number, side: number): string => {
  const decoded = decodeAction(action, side);
  return decoded.kind === 'endTurn' ? 'endTurn' : decoded.spellName;
};

export class NpcBrain {
  private session: InferenceSession | null = null;
  private recentMoves: Array<string> = []; // e.g. 'Ether 2x2'
  /** The observation's layout the model was trained on (its description's observationSize; ObservationLayout). */
  private layout: ObservationLayout = 'current';

  /** Loads the model; the game waits for it on the loading screen (AssetLoader isNpcModelLoaded). */
  constructor(assetLoader: AssetLoader) {
    const setIsLoaded = () => assetLoader.setIsLoading(new Map<LoaderProperties, boolean>([['isNpcModelLoaded', true]]));
    if (NPC_POLICY !== 'trained') {
      setIsLoaded();
      return;
    }
    assetLoader.whenPriorityAssetsLoaded()
      .then(() => fetch(MODEL_DESCRIPTION_PATH).then(r => r.json()).then(({ observationSize }) => { this.layout = getObservationLayout(observationSize); }).catch(() => { }))
      .then(loadOnnxRuntime)
      .then(ort => ort.InferenceSession.create(MODEL_PATH))
      // ref(): keep valtio from proxying the native inference session
      .then(session => { this.session = ref(session); })
      .catch(err => console.error('Failed to load the NPC model; the NPC will play randomly', err))
      .finally(setIsLoaded);
  }

  getIsReady = (): boolean => !!this.session;

  /** The model's choice for `side`: a cast, or null to end its turn. */
  planCast = async (view: GameView, side: number): Promise<PlannedNpcCast | null> => {
    if (!this.session) return null;
    const session = this.session;
    const mask = getActionMask(view, side);
    const ort = await loadOnnxRuntime();
    const run = (layout: ObservationLayout) => {
      const observation = encodeObservation(view, side, layout);
      return session.run({ observation: new ort.Tensor('float32', Float32Array.from(observation), [1, observation.length]) });
    };
    let output;
    try {
      output = await run(this.layout);
    } catch (err) {
      // (its description missing or wrong: the layouts tried in turn, the one that fits kept)
      const others = (['current', 'v2', 'v1'] as Array<ObservationLayout>).filter(layout => layout !== this.layout);
      for (const layout of others) {
        try { output = await run(layout); this.layout = layout; break; } catch { /* (the next) */ }
      }
      if (!output) throw err;
    }
    const { logits } = output;
    const action = this.chooseAction(logits.data as Float32Array, mask, side, getIsRiskyTurn(view.turnsElapsed));

    const decoded = decodeAction(action, side);
    if (decoded.kind === 'endTurn') return null;
    this.recentMoves = [...this.recentMoves, getMoveKey(action, side)].slice(-NPC_VARIETY.repeatWindow);
    return { inferenceString: SPELL_SYMBOLS[decoded.spellName], cells: decoded.cells };
  };

  /** A legal action, sampled from the model's scores, with recent moves made less likely (NPC_VARIETY; not on risky turns). */
  private chooseAction = (scores: Float32Array, mask: Array<boolean>, side: number, isRisky: boolean): number => {
    const { temperature } = NPC_VARIETY;
    const repeatPenalty = isRisky ? 0 : NPC_VARIETY.repeatPenalty;
    const legal = mask.map((isLegal, action) => isLegal ? action : -1).filter(action => action >= 0);
    const adjusted = legal.map(action => {
      const move = getMoveKey(action, side);
      return scores[action] - repeatPenalty * this.recentMoves.filter(recent => recent === move).length;
    });

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
