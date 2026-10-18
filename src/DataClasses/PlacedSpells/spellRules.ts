// spellRules.ts
// Tunable spell rules. See spell-movement-requirements.md ("Config summary") for what each setting does.

export const PHLEGM_RULES = {
  collisionMode: 'alwaysLoses' as 'alwaysLoses' | 'power',
  absorbCostsPower: false,
  empoweredBonus: 20,
  reflectBonusMode: 'powerDiff' as 'powerDiff' | 'size' | 'none',
  capacityMode: 'count' as 'count' | 'power' | 'unlimited',
  capacityPerCell: 1,
  powerCapacityPerCell: 5,
  capacityResetsEachTurn: true,
};

export const GYRE_RULES = {
  powerPerCell: 4,
  offBoardMode: 'destroy' as 'destroy' | 'clamp',
  capacityMode: 'count' as 'count' | 'power' | 'unlimited',
  capacityPerCell: 1,
  powerCapacityPerCell: 4,
  capacityResetsEachTurn: true,
  persistsAfterUse: false, // false: a Gyre disappears once its last carried spell exits. true: it stays until its capacity is used up
  maxHeight: 3,
  exitBonusMode: 'none' as 'none' | 'legacy',
  collisionMode: 'power' as 'power' | 'alwaysLoses',
};

export const QUICKEN_RULES = {
  bonusMode: 'flat' as 'flat' | 'perConsumption',
  bonusMovesPerConsumption: 2,
};

export const PLAYER_RULES = {
  bloodMagicHealthPerFocus: 5, // health paid per focus point a cast costs beyond what the caster has (7 was tried)
};

export const CASTING_RULES = {
  // Most cells one Quicken cast can fill (null: no limit). Stops a single wide drawing filling the
  // whole zone with Quickens. The cells the drawing touched are filled first.
  maxQuickenCellsPerCast: 3 as number | null,
  // Spells can be cast onto enemy spells in the column right next to the caster's wizard, where
  // they collide at once (otherwise a spell there can't be answered before it hits). Off for now:
  // to revisit how it works with sized enemy spells (only part of them is in that column), and a
  // Phlegm cast onto part of a sized enemy spell doesn't reflect the part it covers
  canCastOntoEnemiesBesideWizard: false,
};
