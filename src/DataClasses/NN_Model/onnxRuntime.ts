// onnxRuntime.ts
// The ONNX runtime (onnxruntime-web) is large, so it's loaded on demand, as its own file, instead of
// being part of the code the first paint waits for. Both models (the spell drawings, the NPC) use it.
// Not kept in valtio state: callers await this each time (it's cached after the first load).
import type * as Ort from 'onnxruntime-web';

let runtime: Promise<typeof Ort> | null = null;

export const loadOnnxRuntime = (): Promise<typeof Ort> => runtime ??= import('onnxruntime-web');
