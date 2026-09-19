import * as ort from 'onnxruntime-web';
import { InferenceString, Point } from '../types';

/*
  
  the Model class encapsulates the NN model. it...
      - stores the loaded model session
      - runs the model on input data and returns the string shape.
          - stores all required logic and helper functions to assist with this...
      - is "inserted" into UI for the above tasks:
          - 1. init-ing the model session:
                METHOD: init(): void
          - 2. running inference:  
                METHOD: async runInference(rawPoints: Array<Point>): Promise<string>
 
  the Model class does NOT:
      - render the HTML canvas
      - hold point data of the raw points needed to render the drawing
 
*/

export class Model {

    // Properties
    private session: ort.InferenceSession | null = null;

    // Define the human-readable labels matching your Python `labels` dictionary

    // sequential7.onnx:
    // private static readonly SPELL_LABELS: Record<number, InferenceString> = {
    //     0: 'circle',
    //     1: 'star',
    //     2: 'diamond',
    //     3: 'line',
    //     4: 'squiggle'
    // };

    // sequential8.onnx
    private static readonly SPELL_LABELS: Record<number, InferenceString> = { 0: 'circle', 1: 'square', 2: 'star', 3: 'triangle', 4: 'diamond', 5: 'line', 6: 'squiggle' }


    public async init(): Promise<void> {
        if (!this.session) {
            let session = await this.loadModel();
            this.session = session;
        }
    }

    private async loadModel(): Promise<ort.InferenceSession | null> {
        try {
            const net = await ort.InferenceSession.create('./models/sequential8.onnx');
            console.log("Spell model loaded successfully!");
            return net;
        } catch (e) {
            console.error("Failed to load ONNX model", e);
            return null;
        }
    }

    // Methods
    public async runInference(rawPoints: Array<Point>): Promise<InferenceString> {
        // Run RDP to strip out hand jitter and keep sharp geometric vertexes
        // Adjust epsilon (0.01 - 0.05 is standard for a 0.0 to 1.0 normalized canvas space)
        const epsilon = .005;

        const minXY = rawPoints.reduce((acc, item) => {
            if (acc.x > item.x) acc.x = item.x;
            if (acc.y > item.y) acc.y = item.y;
            return acc;
        }, { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER });

        const maxDistance = this.findMaxDistance(rawPoints);

        if(maxDistance < 30) return 'squiggle'; // too short 

        const simplifiedPoints = this.ramerDouglasPeucker(rawPoints.map(p => {
            const normalizedPoint: Point = {
                x: (p.x - minXY.x) / maxDistance,
                y: (p.y - minXY.y) / maxDistance
            }
            return normalizedPoint;
        }), epsilon);

        if (this.session) {
            const result = await this.runSpellInference(simplifiedPoints, this.session);
            return result;
        } else {
            return 'squiggle';
        }

    }

    /**
     * Runs local browser inference 
     * @param points - Array of normalized coordinate objects: [{x: 0.325, y: 0.015}, ...]
     * @param session - The loaded ONNX InferenceSession instance
     * @returns Promise<string> - The human-readable string name of the recognized shape
     */
    private async runSpellInference(
        points: { x: number; y: number }[],
        session: ort.InferenceSession
    ): Promise<InferenceString> {

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
            const recognizedSpell = Model.SPELL_LABELS[predictedIndex] || 'squiggle';
            return recognizedSpell;
        } catch (error) {
            console.error("Failed to run the ONNX model web inference:", error);
            //   throw error;
            return 'squiggle';
        }
    }

    /**
     * Calculates the squared Euclidean distance between two points.
     * Using squared distance avoids expensive square root operations during comparisons.
     */
    private squaredDistance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return dx * dx + dy * dy;
    }

    /**
     * Determines the cross product of vectors OA and OB.
     * Returns a positive value for counter-clockwise turn, negative for clockwise, 0 if collinear.
     */
    private crossProduct(o: Point, a: Point, b: Point): number {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }

    /**
     * Computes the Convex Hull of a set of points using Andrew's Monotone Chain algorithm.
     * Time Complexity: O(n log n) due to sorting.
     */
    private getConvexHull(points: Point[]): Point[] {
        const n = points.length;
        if (n <= 3) return [...points];

        // Sort points lexicographically by x, then by y
        const sorted = [...points].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));

        const lower: Point[] = [];
        for (let i = 0; i < n; i++) {
            while (lower.length >= 2 && this.crossProduct(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
                lower.pop();
            }
            lower.push(sorted[i]);
        }

        const upper: Point[] = [];
        for (let i = n - 1; i >= 0; i--) {
            while (upper.length >= 2 && this.crossProduct(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
                upper.pop();
            }
            upper.push(sorted[i]);
        }

        // Remove the last point of each half because it's repeated as the first point of the other half
        lower.pop();
        upper.pop();

        return lower.concat(upper);
    }

    /**
     * Finds the maximum distance between any two points in an array.
     * Uses Convex Hull + Rotating Calipers.
     * Time Complexity: O(n log n)
     */
    private findMaxDistance(points: Point[]): number {
        if (points.length < 2) return 0;
        if (points.length === 2) return Math.sqrt(this.squaredDistance(points[0], points[1]));

        const hull = this.getConvexHull(points);
        const m = hull.length;

        if (m === 2) return Math.sqrt(this.squaredDistance(hull[0], hull[1]));

        let maxSqDist = 0;
        let k = 1;

        // Find the initial furthest point k from edge hull[0]-hull[m-1]
        while (this.crossProduct(hull[m - 1], hull[0], hull[(k + 1) % m]) > this.crossProduct(hull[m - 1], hull[0], hull[k])) {
            k = (k + 1) % m;
        }

        // Rotating Calipers loop
        for (let i = 0, j = k; i <= k && j < m; i++) {
            // Step caliper along the upper side
            while (this.crossProduct(hull[i], hull[(i + 1) % m], hull[(j + 1) % m]) > this.crossProduct(hull[i], hull[(i + 1) % m], hull[j])) {
                j = (j + 1) % m;
                maxSqDist = Math.max(maxSqDist, this.squaredDistance(hull[i], hull[j]));
            }
            maxSqDist = Math.max(maxSqDist, this.squaredDistance(hull[i], hull[j]));
            maxSqDist = Math.max(maxSqDist, this.squaredDistance(hull[(i + 1) % m], hull[j]));
        }

        return Math.sqrt(maxSqDist);
    }

    /**
     * Calculates the perpendicular distance from a point to a straight line segment.
     */
    private getPerpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;

        // If the start and end points are identical, calculate standard distance to that point
        if (dx === 0 && dy === 0) {
            return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
        }

        // Standard line-point distance formula
        const numerator = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
        const denominator = Math.sqrt(dx * dx + dy * dy);

        return numerator / denominator;
    }

    /**
     * Ramer-Douglas-Peucker (RDP) algorithm to simplify a path of 2D points.
     * @param points - Array of ordered coordinate objects
     * @param epsilon - Distance threshold. Higher = more aggressive simplification/smoothing.
     */
    private ramerDouglasPeucker(points: Point[], epsilon: number): Point[] {
        if (points.length <= 2) {
            return points;
        }

        let maxDistance = 0;
        let indexMaxDistance = 0;
        const end = points.length - 1;

        // Find the point furthest away from the straight line segment between start and end
        for (let i = 1; i < end; i++) {
            const distance = this.getPerpendicularDistance(points[i], points[0], points[end]);
            if (distance > maxDistance) {
                maxDistance = distance;
                indexMaxDistance = i;
            }
        }

        // If the furthest point is greater than epsilon, recursively split the line and simplify
        if (maxDistance > epsilon) {
            const results1 = this.ramerDouglasPeucker(points.slice(0, indexMaxDistance + 1), epsilon);
            const results2 = this.ramerDouglasPeucker(points.slice(indexMaxDistance), epsilon);

            // Merge the results, dropping the duplicate shared midpoint
            return results1.slice(0, results1.length - 1).concat(results2);
        }

        // If it's below epsilon, simply return the two outermost boundary endpoints
        return [points[0], points[end]];
    }
}