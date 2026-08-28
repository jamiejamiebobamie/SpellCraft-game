interface Point {
  x: number;
  y: number;
}

/**
 * Calculates the squared Euclidean distance between two points.
 * Using squared distance avoids expensive square root operations during comparisons.
 */
function squaredDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

/**
 * Determines the cross product of vectors OA and OB.
 * Returns a positive value for counter-clockwise turn, negative for clockwise, 0 if collinear.
 */
function crossProduct(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Computes the Convex Hull of a set of points using Andrew's Monotone Chain algorithm.
 * Time Complexity: O(n log n) due to sorting.
 */
function getConvexHull(points: Point[]): Point[] {
  const n = points.length;
  if (n <= 3) return [...points];

  // Sort points lexicographically by x, then by y
  const sorted = [...points].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));

  const lower: Point[] = [];
  for (let i = 0; i < n; i++) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
      lower.pop();
    }
    lower.push(sorted[i]);
  }

  const upper: Point[] = [];
  for (let i = n - 1; i >= 0; i--) {
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
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
export function findMaxDistance(points: Point[]): number {
  if (points.length < 2) return 0;
  if (points.length === 2) return Math.sqrt(squaredDistance(points[0], points[1]));

  const hull = getConvexHull(points);
  const m = hull.length;

  if (m === 2) return Math.sqrt(squaredDistance(hull[0], hull[1]));

  let maxSqDist = 0;
  let k = 1;

  // Find the initial furthest point k from edge hull[0]-hull[m-1]
  while (crossProduct(hull[m - 1], hull[0], hull[(k + 1) % m]) > crossProduct(hull[m - 1], hull[0], hull[k])) {
    k = (k + 1) % m;
  }

  // Rotating Calipers loop
  for (let i = 0, j = k; i <= k && j < m; i++) {
    // Step caliper along the upper side
    while (crossProduct(hull[i], hull[(i + 1) % m], hull[(j + 1) % m]) > crossProduct(hull[i], hull[(i + 1) % m], hull[j])) {
      j = (j + 1) % m;
      maxSqDist = Math.max(maxSqDist, squaredDistance(hull[i], hull[j]));
    }
    maxSqDist = Math.max(maxSqDist, squaredDistance(hull[i], hull[j]));
    maxSqDist = Math.max(maxSqDist, squaredDistance(hull[(i + 1) % m], hull[j]));
  }

  return Math.sqrt(maxSqDist);
}
