// duelMath.ts
// The logo's duel: poses each avatar's wand arm so its wand hand is exactly where the struggle puts
// it (two-bone IK), and works out where the wands cross. Uses the avatar parts' geometry from
// CharacterParts.tsx (in "avatar units", the parts' cqw sizes).
import { LOGO_CONFIG } from './logoConfig';

export type Vec = { x: number; y: number };

const deg = (rad: number) => rad * 180 / Math.PI;
const rad = (degrees: number) => degrees * Math.PI / 180;
const rotate = (v: Vec, degrees: number): Vec => {
  const c = Math.cos(rad(degrees)), s = Math.sin(rad(degrees));
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; // y is down, so positive = clockwise
};
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const angleOf = (v: Vec) => deg(Math.atan2(v.y, v.x));
/** The same angle, in -180..180. */
const normalize = (degrees: number) => ((degrees % 360) + 540) % 360 - 180;

// --- The avatar's geometry (CharacterParts.tsx), in its frame (before mirroring) ---------------

/** The avatar's frame: a square; the opponent's is mirrored about its middle. */
export const FRAME_SIZE = 20;
const ROBE = { x: 2.4, y: 7.75, w: 13, h: 13 * 657 / 544 };
/** Where the avatar leans from: the bottom middle of its robe. */
export const LEAN_PIVOT: Vec = { x: ROBE.x + ROBE.w / 2, y: ROBE.y + ROBE.h };
/** The shoulder: the bicep's pivot (bicep at 6.6, 0 in the robe; pivot .75, 1.5). */
const SHOULDER: Vec = { x: ROBE.x + 6.6 + 0.75, y: ROBE.y + 1.5 };
/** Upper arm, shoulder to elbow (the forearm's pivot), unrotated. */
const UPPER_ARM: Vec = { x: 4 + 1 - 0.75, y: 0.1 + 1.5 - 1.5 };
/** Forearm, elbow to wrist (the wand hand's pivot), unrotated. */
const FOREARM: Vec = { x: 2.5 + 0.2 - 1, y: -0.5 + 0.8 - 1.5 };
/** The wand in the wand hand's image (7.8 x 2.46 for 320 x 101 px), from the hand's pivot (.2, .8). */
const HAND_PX_TO_UNITS = 7.8 / 320;
const toHand = (px: number, py: number): Vec => ({ x: px * HAND_PX_TO_UNITS - 0.2, y: py * HAND_PX_TO_UNITS - 0.8 });
const WAND_GRIP = toHand(40, 62);
const WAND_TIP = toHand(300, 15);
/** The wand's direction in the unrotated hand image. */
const WAND_ANGLE_IN_HAND = angleOf(sub(WAND_TIP, WAND_GRIP));

/** Joint angles (degrees, each relative to its parent) for the bicep, forearm and wand hand. */
export type ArmAngles = { shoulder: number; elbow: number; wrist: number };

/**
 * Angles that put the wrist at `wrist` with the wand pointing along `wandAngle` (both in the
 * avatar's frame). Out of reach, the arm points straight at it instead.
 */
const solveArm = (wrist: Vec, wandAngle: number): ArmAngles => {
  const l1 = Math.hypot(UPPER_ARM.x, UPPER_ARM.y), l2 = Math.hypot(FOREARM.x, FOREARM.y);
  const toWrist = sub(wrist, SHOULDER);
  const d = Math.min(Math.max(Math.hypot(toWrist.x, toWrist.y), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
  const bend = deg(Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  // Of the two ways to bend, the one with the elbow lower
  const candidates = [angleOf(toWrist) + bend, angleOf(toWrist) - bend].map(upperAngle => {
    const elbow = add(SHOULDER, rotate({ x: l1, y: 0 }, upperAngle));
    return { upperAngle, elbow };
  });
  const { upperAngle, elbow } = candidates[0].elbow.y >= candidates[1].elbow.y ? candidates[0] : candidates[1];
  const foreAngle = angleOf(sub(add(SHOULDER, toWrist), elbow));

  const shoulder = upperAngle - angleOf(UPPER_ARM);
  const elbowAngle = foreAngle - angleOf(FOREARM) - shoulder;
  const wristAngle = wandAngle - WAND_ANGLE_IN_HAND - shoulder - elbowAngle;
  return { shoulder: normalize(shoulder), elbow: normalize(elbowAngle), wrist: normalize(wristAngle) };
};

/** Where the wrist and wand actually are for `angles` (in the avatar's frame). */
const getWand = (angles: ArmAngles): { grip: Vec; tip: Vec } => {
  const elbow = add(SHOULDER, rotate(UPPER_ARM, angles.shoulder));
  const wrist = add(elbow, rotate(FOREARM, angles.shoulder + angles.elbow));
  const handAngle = angles.shoulder + angles.elbow + angles.wrist;
  return { grip: add(wrist, rotate(WAND_GRIP, handAngle)), tip: add(wrist, rotate(WAND_TIP, handAngle)) };
};

// --- The duel, in the avatars group's units (x from the center line, y from the frames' tops) ---

/** Each side: 1 for the player (left), -1 for the opponent (right, mirrored). */
const SIDES = [1, -1] as const;

/** The left edge of each side's frame. */
const getFrameLeft = (side: number) => side === 1
  ? -LOGO_CONFIG.avatars.spacing - FRAME_SIZE / 2
  : LOGO_CONFIG.avatars.spacing - FRAME_SIZE / 2;

/** From the duel's units into a side's frame (undoing its lean and its mirroring), and back. */
const toFrame = (p: Vec, side: number, lean: number): Vec => {
  const left = getFrameLeft(side);
  const pivot = { x: left + (side === 1 ? LEAN_PIVOT.x : FRAME_SIZE - LEAN_PIVOT.x), y: LEAN_PIVOT.y };
  const unleaned = add(pivot, rotate(sub(p, pivot), -lean));
  const x = unleaned.x - left;
  return { x: side === 1 ? x : FRAME_SIZE - x, y: unleaned.y };
};
const fromFrame = (p: Vec, side: number, lean: number): Vec => {
  const left = getFrameLeft(side);
  const pivot = { x: left + (side === 1 ? LEAN_PIVOT.x : FRAME_SIZE - LEAN_PIVOT.x), y: LEAN_PIVOT.y };
  const unleaned = { x: left + (side === 1 ? p.x : FRAME_SIZE - p.x), y: p.y };
  return add(pivot, rotate(sub(unleaned, pivot), lean));
};
/** A direction (degrees) from the duel's units into a side's frame. */
const angleToFrame = (angle: number, side: number, lean: number) => side === 1 ? angle - lean : 180 - (angle - lean);

/** Where the two wand lines cross (or null if they're parallel). */
const intersect = (a1: Vec, a2: Vec, b1: Vec, b2: Vec): Vec | null => {
  const da = sub(a2, a1), db = sub(b2, b1);
  const denominator = da.x * db.y - da.y * db.x;
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((b1.x - a1.x) * db.y - (b1.y - a1.y) * db.x) / denominator;
  return add(a1, { x: da.x * t, y: da.y * t });
};

export type DuelPose = {
  /** Per side (player, opponent): its lean (degrees) and arm angles, for the avatar parts. */
  sides: Array<{ lean: number; arm: ArmAngles; freeArm: number; head: number }>;
  /** Where the wands cross, in the duel's units. */
  crossing: Vec | null;
  /** How hard it's straining right now (0 to 1), for the sparks. */
  intensity: number;
};

/** The push (avatar units, + toward the opponent) at `seconds`: a slow see-saw, trembles and surges. */
const getPush = (seconds: number): { push: number; tremble: Vec; intensity: number } => {
  const { seesawSeconds, reach, tremble, surgeEverySeconds, surgeReach } = LOGO_CONFIG.struggle;
  const phase = 2 * Math.PI * seconds / seesawSeconds;
  const seesaw = reach * (0.8 * Math.sin(phase) + 0.2 * Math.sin(phase * 0.57 + 1.3)); // a little uneven

  // A surge: a quick shove, a hold, then it's slowly won back; alternating sides
  const cycle = Math.floor(seconds / surgeEverySeconds);
  const t = seconds - cycle * surgeEverySeconds;
  const envelope = t < 0.25 ? t / 0.25 : t < 0.85 ? 1 : Math.max(0, 1 - (t - 0.85) / 1.2);
  const surge = surgeReach * envelope * (cycle % 2 === 0 ? 1 : -1);

  const shake = {
    x: tremble * (Math.sin(seconds * 37) + 0.6 * Math.sin(seconds * 53 + 1)),
    y: tremble * 0.6 * (Math.sin(seconds * 41 + 2) + 0.5 * Math.sin(seconds * 61)),
  };
  return { push: seesaw + surge, tremble: shake, intensity: Math.min(1, 0.35 + envelope * 0.65) };
};

/** The whole duel at `seconds` (or at rest: no push, no tremble). */
export const getDuelPose = (seconds: number, isAtRest: boolean = false): DuelPose => {
  const { wrist, wandTilt } = LOGO_CONFIG.avatars;
  const { lean: leanShare, freeArmSwing, headTilt } = LOGO_CONFIG.struggle;
  const { push, tremble, intensity } = isAtRest ? { push: 0, tremble: { x: 0, y: 0 }, intensity: 0 } : getPush(seconds);

  // Leaning moves the shoulders by about (height above the pivot) x angle; the arms do the rest
  const shoulderHeight = LEAN_PIVOT.y - SHOULDER.y;
  const lean = deg(push * leanShare / shoulderHeight); // both lean the same way: one in, one back

  const wands = SIDES.map(side => {
    const target = { x: side * wrist.x + push + tremble.x, y: wrist.y + tremble.y };
    const wandAngle = -90 + side * wandTilt; // up, leaning in toward the other wand
    const arm = solveArm(toFrame(target, side, lean), angleToFrame(wandAngle, side, lean));
    const { grip, tip } = getWand(arm);
    return { side, arm, grip: fromFrame(grip, side, lean), tip: fromFrame(tip, side, lean) };
  });

  return {
    sides: wands.map(({ arm }) => ({ lean, arm, freeArm: -lean * freeArmSwing, head: lean * headTilt })),
    crossing: intersect(wands[0].grip, wands[0].tip, wands[1].grip, wands[1].tip),
    intensity,
  };
};

/** Where the wands cross at rest (no push), in the duel's units: what the spells fade toward. */
export const getRestCrossing = (): Vec => {
  const pose = getDuelPose(0, true);
  return pose.crossing ?? { x: 0, y: LOGO_CONFIG.avatars.wrist.y };
};
