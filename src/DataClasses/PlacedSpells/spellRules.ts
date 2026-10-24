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
  // Capacity (lifetime 'capacity'): 'power', the damage a Gyre can absorb in all (each spell cell entering
  // uses its power: a Chain Lightning cell 5, a 1x1 Fireball 10), powerCapacityPerCell per cell of its
  // height; 'count' (tried), how many spell cells it can lift, capacityPerCell per cell. At most
  // maxCapacity (in the mode's units), fixed when it's cast, and never restored; Gyres joining
  // (stacking, or one consuming another) add up what each has left (at most maxCapacity). A full Gyre
  // is passed through, and dissipates once what it carries is out
  capacityMode: 'power' as 'count' | 'power' | 'unlimited',
  capacityPerCell: 1, // ('count': 2 per cell, at most 6, was tried: too strong; then 1)
  powerCapacityPerCell: 5,
  maxCapacity: 15,
  // A Gyre with any capacity left lifts the next spell cell, even one stronger than what it has left
  // (which uses up the rest: e.g. a 1x1 Fireball, 10, lifted by a 1x1 Gyre, 5, which is then spent). (A 1x3 Gyre, power 12, destroys a 1x1 Fireball instead)

  // Its height follows the capacity it has left (left / capacity per cell, rounded up), shrinking from its
  // tip (its base fixed) at the turn's end: a used Gyre is weaker, reaches fewer rows, lifts less far
  // and gives a smaller exit bonus. (A partly used top cell sputters: GYRE_SPUTTER)
  shrinksWithCapacity: true,
  capacityResetsEachTurn: false,
  // 'capacity': a Gyre lasts until its capacity is used up. 'turn' (tried): it lifts every spell that
  // reaches it this turn, then dissipates at the turn's end if it lifted any (capacity is ignored)
  lifetime: 'capacity' as 'turn' | 'capacity',
  persistsAfterUse: true, // (lifetime 'capacity') true: it stays until its capacity is used up. false: it disappears once its last carried spell exits
  maxHeight: 3,
  // 'height': a spell leaving a Gyre gets +1 move per cell of its height, once, used right away
  exitBonusMode: 'height' as 'height' | 'none' | 'legacy',
  // Two Gyres meeting: 'shrink', the stronger takes in the weaker and shrinks by its height, keeping its
  // base (a GyreUp's bottom cell, a GyreDown's top cell), the weaker destroyed (a 3x1 meeting a 1x1 becomes
  // a 2x1 where it was); 'consume' (the rule before), the weaker lifts the stronger one row past its tip (a
  // 1x1 at the edge could push a 3x1 off the board); 'merge' (the earliest) grows or shrinks it by direction
  meetingMode: 'shrink' as 'shrink' | 'consume' | 'merge',
  collisionMode: 'power' as 'power' | 'alwaysLoses',
};

export const ETHER_RULES = {
  // Two Ethers of equal power, moving the same way, meeting: 'oneSurvives', the one ahead consumes the
  // one catching up (gaining its +5, as any consumer of an Ether); 'bothDestroyed', the earlier rule
  // (as any tie). Ethers moving opposite ways, or any other tie, still destroy each other
  sameDirectionTie: 'oneSurvives' as 'oneSurvives' | 'bothDestroyed',
};

export const QUICKEN_RULES = {
  // A Quicken's speed bonus: 'instant', a spell that consumes one gets extra moves right away, this turn
  // only, as many as the Quicken is wide (as if moving through it: like a Gyre's exit bonus, nothing
  // lasting; a Quicken too, if isBonusForQuickens); 'none', no bonus; 'permanent', the earlier rule (+1 speed for
  // a Quicken, and for a spell electrified by one)
  speedMode: 'instant' as 'instant' | 'none' | 'permanent',
  // ('instant' and 'none') a 1x1 Quicken's own extra speed, kept (a sized one has none)
  singleCellSpeed: 1,
  // ('instant') whether a Quicken that consumes another gets its extra moves too (a chain of them)
  isBonusForQuickens: true,
  // ('instant' and 'none') the lasting extra speed a 1x1 Quicken gives a spell (not a Quicken) that
  // consumes it: once, not adding up (0: none)
  singleCellConfersSpeed: 1,
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
