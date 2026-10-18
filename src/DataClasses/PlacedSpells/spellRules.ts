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
  // Health paid per focus point a cast costs beyond what the caster has (was 5; 7 was tried). At 3,
  // a 3x3 Ether (18 focus) saved up for costs 30 health; cast every turn (2 focus), 48
  bloodMagicHealthPerFocus: 3,
};

export const CASTING_RULES = {
  // A cast costs each spell's FOCUS_COST (Spell.ts) per cell, up to maxFocusCostPerCast (null: no
  // cap, so big casts can need blood magic, e.g. a 3x3 Ether costs 18), except for uncappedSpells.
  // (8, the most focus a player can hold, with Quickens uncapped, was tried)
  maxFocusCostPerCast: null as number | null,
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
