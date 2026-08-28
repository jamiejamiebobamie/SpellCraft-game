export interface Point {
  x: number;
  y: number;
}

/**
 * Calculates the perpendicular distance from a point to a straight line segment.
 */
function getPerpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
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
export function ramerDouglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  let maxDistance = 0;
  let indexMaxDistance = 0;
  const end = points.length - 1;

  // Find the point furthest away from the straight line segment between start and end
  for (let i = 1; i < end; i++) {
    const distance = getPerpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      indexMaxDistance = i;
    }
  }

  // If the furthest point is greater than epsilon, recursively split the line and simplify
  if (maxDistance > epsilon) {
    const results1 = ramerDouglasPeucker(points.slice(0, indexMaxDistance + 1), epsilon);
    const results2 = ramerDouglasPeucker(points.slice(indexMaxDistance), epsilon);

    // Merge the results, dropping the duplicate shared midpoint
    return results1.slice(0, results1.length - 1).concat(results2);
  }

  // If it's below epsilon, simply return the two outermost boundary endpoints
  return [points[0], points[end]];
}
