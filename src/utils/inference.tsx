import * as ort from 'onnxruntime-web';

// Define the human-readable labels matching your Python `labels` dictionary
export const SPELL_LABELS: Record<number, string> = {
  0: 'circle',
  1: 'star',
  2: 'diamond',
  3: 'line',
  4: 'squiggle'
};

/**
 * Runs local browser inference matching the Keras ONNX Python script exactly.
 * @param points - Array of normalized coordinate objects: [{x: 0.325, y: 0.015}, ...]
 * @param session - The loaded ONNX InferenceSession instance
 * @returns Promise<string> - The human-readable string name of the recognized shape
 */
export async function runSpellInference(
  points: { x: number; y: number }[],
  session: ort.InferenceSession
): Promise<string> {

  // 1. Create a flat 1D array of 80 elements (representing a 1x40x2 matrix)
  // Python test_sample array has exactly 40 elements, with zero-padding at the end
  const totalElements = 40 * 2;
  const inputData = new Float32Array(totalElements);

  // 2. Loop and fill with point positions (uncaught indices naturally stay 0.0)
  const maxPoints = Math.min(points.length, 40);
  for (let i = 0; i < maxPoints; i++) {
    inputData[i * 2] = points[i].x;     // Matches Python's nested [x]
    inputData[i * 2 + 1] = points[i].y; // Matches Python's nested [y]
  }

  try {
    // 3. Construct the tensor using the strict shape [1, 40, 2]
    // We target the literal name "input" explicitly defined in your python code: spec = (... name="input")
    const inputTensor = new ort.Tensor('float32', inputData, [1, 40, 2]);
    const feeds = { input: inputTensor };

    // 4. Execute the model runner
    const outputs = await session.run(feeds);

    // 5. Grab the first output layer dynamically
    const outputName = session.outputNames[0];
    const outputData = outputs[outputName].data as Float32Array;

    // 6. ArgMax Calculation (Finding the highest float prediction value)
    let maxVal = -Infinity;
    let predictedIndex = 0;

    for (let i = 0; i < outputData.length; i++) {
      if (outputData[i] > maxVal) {
        maxVal = outputData[i];
        predictedIndex = i;
      }
    }

    // 7. Map the index directly to your text names
    const recognizedSpell = SPELL_LABELS[predictedIndex] || 'unknown';
    console.log(`ONNX Predicted Probabilities:`, Array.from(outputData));
    console.log(`Recognized Shape: ${recognizedSpell}`);
    console.log({ feeds, outputs, session });


    return recognizedSpell;

  } catch (error) {
    console.error("Failed to run the ONNX model web inference:", error);
    throw error;
  }
}