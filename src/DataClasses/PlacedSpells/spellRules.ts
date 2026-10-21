// spellRules.ts
// Tunable spell rules. See spell-movement-requirements.md ("Config summary") for what each setting does.

export const PHLEGM_RULES = {
  collisionMode: 'alwaysLoses' as 'alwaysLoses' | 'power',
  absorbCostsPower: false,
  empoweredBonus: 15, // flat (was 20)
  reflectBonusMode: 'powerDiff' as 'powerDiff' | 'size' | 'none',
  capacityMode: 'count' as 'count' | 'power' | 'unlimited',
  capacityPerCell: 1,
  powerCapacityPerCell: 5,
  capacityResetsEachTurn: true,
  // A sized spell entering a Phlegm: 'cells' breaks into single cells that each orbit it (and
  // reassemble on the way out); 'bounce' (the earlier rule) bounces the rows touching it as a block
  sizedEntry: 'cells' as 'cells' | 'bounce',
};

export const GYRE_RULES = {
  powerPerCell: 4,
  offBoardMode: 'destroy' as 'destroy' | 'clamp',
  capacityMode: 'count' as 'count' | 'power' | 'unlimited',
  capacityPerCell: 1,
  powerCapacityPerCell: 4,
  capacityResetsEachTurn: true,
  // 'turn': a Gyre lifts every spell that reaches it this turn, then dissipates at the turn's end if
  // it lifted any (capacity is ignored). 'capacity': the earlier rule (capacity, persistsAfterUse)
  lifetime: 'turn' as 'turn' | 'capacity',
  persistsAfterUse: false, // (lifetime 'capacity') false: a Gyre disappears once its last carried spell exits. true: it stays until its capacity is used up
  maxHeight: 3,
  // 'height': a spell leaving a Gyre gets +1 move per cell of its height, once, used right away
  exitBonusMode: 'height' as 'height' | 'none' | 'legacy',
  // Two Gyres meeting: 'consume', the bigger takes in the smaller, which lifts it one row past the
  // smaller's tip, in the smaller's direction (by its base); 'merge' (the earlier rule) grows or shrinks it
  meetingMode: 'consume' as 'consume' | 'merge',
  collisionMode: 'power' as 'power' | 'alwaysLoses',
};

export const QUICKEN_RULES = {
  // A Quicken's speed bonus: 'instant', a spell that consumes one gets extra moves right away, this turn
  // only, as many as the Quicken is wide (as if moving through it: like a Gyre's exit bonus, nothing
  // lasting), unless it's a Quicken itself; 'none', no bonus; 'permanent', the earlier rule (+1 speed for
  // a Quicken, and for a spell electrified by one)
  speedMode: 'instant' as 'instant' | 'none' | 'permanent',
  // ('instant' and 'none') a 1x1 Quicken's own extra speed, kept (a sized one has none)
  singleCellSpeed: 1,
  bonusMode: 'flat' as 'flat' | 'perConsumption',
  bonusMovesPerConsumption: 2,
};

export const PLAYER_RULES = {
  // Health paid per focus point a cast costs beyond what the caster has (3 and 7 were tried)
  bloodMagicHealthPerFocus: 5,
};

export const CASTING_RULES = {
  // A cast costs each spell's FOCUS_COST (Spell.ts) per cell, up to maxFocusCostPerCast (null: no
  // cap, so big casts can need blood magic, e.g. a 3x3 Ether costs 18), except for uncappedSpells.
  // (8, the most focus a player can hold, with Quickens uncapped, was tried)
  maxFocusCostPerCast: null as number | null,
  // A cast's cost (FOCUS_COST x cells) when fractional: 'floor' rounds down (so a 1x1 Fireball at 1.5
  // costs 1, as cheap as any spell, and a 3x3 13), 'ceil' up (2 and 14). Never less than 1
  costRounding: 'floor' as 'floor' | 'ceil',
  uncappedSpells: [] as Array<string>,
  // Most cells one Quicken cast can fill (null: no limit). The cells the drawing touched are filled
  // first. Tried at 3; replaced by uncapped Quicken costs
  maxQuickenCellsPerCast: null as number | null,
  // Spells can be cast onto enemy spells in the column right next to the caster's wizard, where
  // they collide at once (otherwise a spell there can't be answered before it hits). Off for now:
  // to revisit how it works with sized enemy spells (only part of them is in that column), and a
  // Phlegm cast onto part of a sized enemy spell doesn't reflect the part it covers
  canCastOntoEnemiesBesideWizard: false,
};
