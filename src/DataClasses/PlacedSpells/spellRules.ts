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
