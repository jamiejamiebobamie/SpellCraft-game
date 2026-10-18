# Spell Movement Requirements

Supersedes `spell-enhancement.txt`. Built up point by point; each section is a confirmed decision.

## Design principles
- **Everything is visual.** Any state the engine tracks that affects gameplay (a Gyre's remaining capacity, an empowered Phlegm, fire/electric bonuses, etc.) must have a visible indicator for the player.
- **Each spell-movement turn is a mini battle.** Spells may persist between turns, but per-turn state (e.g. Gyre capacity, by default) resets.
- **Rules are tunable.** Balance-sensitive rules live in config (`PHLEGM_RULES`, `GYRE_RULES`, ...) so they can be playtested and reverted without code changes. Guarding against easy exploits matters, since an RL agent (Gymnasium) will be trained on the game.

## 1. Collision detection and resolution order

### 1a. Detection (one pass per micro-step, no look-ahead)
Each micro-step:
1. Record every active spell's starting footprint (all cells it occupies).
2. Move every active spell one cell.
3. In a single pass over all pairs of active spells, a pair **collides** if either:
   - **Overlap:** their new footprints share at least one cell, or
   - **Swap:** A's new footprint overlaps B's old footprint **and** B's new footprint overlaps A's old footprint.

Spells moving the same direction side by side only satisfy one half of the swap test, so they do not collide. The test is footprint-based, so it also applies to vertical (Gyre) movement.

### 1b. Resolution order
1. Collect all colliding pairs for the micro-step.
2. Resolve pairs in order of their **weakest participant's damage**, lowest first.
3. Before resolving each pair, re-read both spells' current damage (an earlier resolution may have changed a spell's stats, e.g. gaining `consumedEthers`).
4. Skip any pair in which either spell has already been destroyed.

This lets the strongest spell in a pile-up inherit the spoils of earlier consumptions.

### 1c. Losers
A spell that loses a collision takes no further part in collisions, except as a consumed Phlegm or Gyre, which may be entered by multiple spells (see point 10).

## 2. Phlegm power, healing, and collision rules

### 2a. Power vs. effect
A spell's damage is split into two concepts:
- **Power** — always positive (cells × 5, plus bonuses). Used for all collision comparisons.
- **Effect** — what happens when the spell exits the board. Phlegms **heal** the player whose edge they exit; all other spells **damage** that player.

Healing the opponent is intended: Phlegms are powerful reflectors, and the risk is that they heal whoever they reach.

### 2b. Configurable collision rule (for playtesting)
Phlegm collision behavior is controlled by a config so it can be playtested and reverted without code changes:

```ts
PHLEGM_RULES = {
  collisionMode: 'alwaysLoses', // default; current behavior
  absorbCostsPower: false,
  empoweredBonus: 20,
}
```

- **`'alwaysLoses'`** (default, current behavior; playtested and working well): a Phlegm loses every collision with a non-Phlegm, so it reflects every spell that enters it. In Phlegm vs. Phlegm, the **smaller** Phlegm consumes the larger (equal sizes destroy both). This enables a self-heal combo: a fast 2x2 Phlegm overtakes a 1x1, which is kicked back to its caster empowered.
- **`'power'`**: Phlegms compare by power like any other spell.
  - Attacker stronger: the attacker enters the Phlegm and is reflected (orbit).
  - Phlegm stronger: the Phlegm **absorbs** the attacker and gains its modifier (Ether → fire bonus, Quicken → speed bonus, Gyre → row shift).
- **`absorbCostsPower`** (`'power'` mode only): when absorbing, the Phlegm loses power equal to the absorbed spell's power, then applies any gained bonuses. Makes large Phlegms a shield that wears down.

Motivation: in `'alwaysLoses'`, a cheap 1x1 Phlegm counters any attack regardless of size. That is a likely exploit for an RL agent (Gymnasium training is planned).

### 2c. Empowered Phlegms
- A Phlegm that consumes another Phlegm becomes **empowered**: a flat **+20** power (`empoweredBonus`), not cumulative.
- `consumedPhlegms` is **persistent** like `consumedEthers` and `consumedQuickens`: it is never reset at end of turn, and it is preserved when a spell breaks apart or combines.
- Per-turn orbit state uses its own fields, separate from `consumedPhlegms`.

## 3. Gyre power
Gyres have **4 power per cell** (all other spells have 5), configurable as `GYRE_RULES.powerPerCell = 4`.

This is deliberate: a Gyre is slightly weaker than any other spell of the same size, so equal-sized spells enter it and get shifted rows rather than tying with it.

## 4. Gyre movement

Board rows are indexed top to bottom (row 0 is the top). GyreUp pushes spells up; GyreDown pushes spells down.

### 4a. Vertical moves
A spell that enters a Gyre moves vertically until it is **one cell past the Gyre's tip**:
- **GyreUp:** moves = entry row − Gyre's top row + 1
- **GyreDown:** moves = Gyre's bottom row − entry row + 1

Example: a height-3 GyreDown entered at its base (top cell) gives 3 moves; a height-3 GyreUp entered at its top cell gives 1 move.

Vertical moves are **added** to the spell's moves for the turn and do not use up its horizontal speed. After the vertical moves finish, the spell continues horizontally with its remaining horizontal moves.

### 4b. Leaving the board vertically
Configurable as `GYRE_RULES.offBoardMode`:
- **`'destroy'`** (default): a spell pushed above or below the board is destroyed.
- **`'clamp'`**: the spell stops at the board edge and continues horizontally.

A **1x1 Gyre** affects only one spell, then destroys itself. **Sized Gyres** persist and can consume multiple spells (subject to capacity, see 4c).

### 4c. Gyre capacity
A Gyre can only consume a limited amount before it is used up:

```ts
GYRE_RULES = {
  powerPerCell: 4,
  offBoardMode: 'destroy',      // 'destroy' | 'clamp'
  capacityMode: 'count',        // 'count' | 'power' | 'unlimited'
  capacityPerCell: 1,           // 'count': spells consumed per Gyre cell
  powerCapacityPerCell: 4,      // 'power': power absorbed per Gyre cell
  capacityResetsEachTurn: true, // false = spent capacity carries across turns
}
```

- **`'count'`** (default): a Gyre can consume `height × capacityPerCell` spells. A 1x1 Gyre consumes 1.
- **`'power'`**: a Gyre absorbs up to `height × powerCapacityPerCell` total power; large spells use it up faster.
- **`'unlimited'`**: sized Gyres never wear out (1x1 Gyres still consume only 1).

When a Gyre's capacity is used up, it immediately stops taking part in collisions (later spells pass through its cells). It stays visible until the spell it is carrying has exited, then it is removed.

Remaining capacity must be visually indicated (see Design principles).

## 5. Gyre consuming a Gyre

### 5a. Merge and cancel
- **Same direction** (e.g. GyreUp + GyreUp): the Gyres **always merge**, even when their power is equal (an exception to the tie rule). The winner grows by the loser's height; the loser is destroyed immediately and does not persist.
- **Opposite directions** (GyreUp + GyreDown): the winner shrinks by the loser's height; the loser is destroyed immediately. A Gyre reduced to height 0 is destroyed. Equal heights cancel, destroying both.

### 5b. Base stays fixed
- GyreUp's base is its **bottom** cell; it grows upward.
- GyreDown's base is its **top** cell; it grows downward.
- Shrinking removes cells from the tip end.

### 5c. Height limit
- Gyres always stay **entirely on the board**. Max height is **3** (`GYRE_RULES.maxHeight = 3`, the board height).
- Because the base is fixed, a Gyre can only grow as far as the board edge in its growth direction. Any excess height is discarded.

### 5d. Capacity after a merge
Merging does not use up capacity. The merged Gyre's capacity is `newHeight × capacityPerCell` minus the capacity both Gyres had already spent this turn.

## 6. Leaving the board vertically
Covered by 4b and 5c: Gyres never leave the board, and any other spell pushed above or below the board is destroyed (in `'destroy'` mode). Only broken-down 1x1 pieces move vertically, so a spell is never partially off the board.

## 7. Phlegm orbit

### 7a. Orbit path and exit
A spell (of any type, including a Phlegm) that enters a Phlegm:
1. **Reverses direction.**
2. Travels around the Phlegm's perimeter: **clockwise** in a right-moving Phlegm, **counterclockwise** in a left-moving Phlegm.
3. Completes **one full lap**, then continues along the perimeter until it reaches the side it is now moving toward (left column if moving left, right column if moving right), and exits there.

While the spell is inside, the Phlegm does not move.

Examples:
- An NPC spell (moving ←) enters the player's right-moving Phlegm on its right side. It reverses to →, laps, and exits on the right side: **reflected** back toward the NPC.
- A 2x2 Phlegm (speed 2) overtakes its caster's 1x1 Phlegm (speed 1), both moving →. The 1x1 consumes the 2x2 (2b), reverses to ←, laps clockwise, continues to the left side, and exits moving ← back to its caster: a **self-heal**.

A **1x1 Phlegm** has a zero-length lap: the spell reverses and exits immediately. The 1x1 Phlegm is then used up (7c).

### 7b. Reflection bonus moves
After exiting, the spell gains bonus horizontal moves in its new direction, as if the Phlegm shot it outward. They are added after its normal remaining horizontal moves:

```
bonusMoves = max(1, floor(|attackerPower − phlegmPower| / 5))
```

`attackerPower` is the attacker's power **before** it was broken apart (see breakdown). Configurable as `PHLEGM_RULES.reflectBonusMode = 'powerDiff' | 'size' | 'none'` (default `'powerDiff'`; `'size'` scales the bonus by the Phlegm's size instead).

Orbit moves are added to the spell's moves for the turn and do not use up its horizontal speed.

### 7c. Phlegm capacity
Phlegms use the same tunable capacity model as Gyres (4c): `count` / `power` / `unlimited`, with optional reset each turn. A 1x1 Phlegm consumes one spell, then is destroyed.

Capacity is used **per cell**: a sized spell hitting a Phlegm only has as many of its cells taken (reflected or orbited) as the Phlegm has capacity left, leading cells first; the rest keep going (13a). With the default `count` capacity, a 1x1 Phlegm takes 1 cell, a 2x2 up to 4, a 3x3 up to 9. A used-up Phlegm takes no part in collisions: later spells pass through it.

### 7d. Friendly collisions
Spells collide regardless of caster: a player's own spells can collide with each other (e.g. a faster spell overtaking a slower one).

## 10. Phlegm and Gyre lifetime
(Points 8 and 9 of the original review are covered by 7b and 7c.)

- **10a. Pausing:** a Phlegm or Gyre stops moving while it is carrying spells. Once all carried spells have exited, it resumes its remaining moves for the turn if it still has capacity.
- **10b. Removal:** a Phlegm or Gyre is removed only when its capacity is fully used, immediately after its last carried spell exits.
- **10c. Between turns:** Phlegms and Gyres with capacity remaining survive into the next turn. Whether spent capacity resets or carries over is set by `capacityResetsEachTurn` (default `true`, reset), in both `PHLEGM_RULES` and `GYRE_RULES`.

This replaces the old rule that cleared every Phlegm or Gyre that consumed anything at end of spell movement.

## 11. Bonus moves (Quicken, Ether, Gyre exit)

### 11a. Quicken bonus
```ts
QUICKEN_RULES = {
  bonusMode: 'flat',           // 'flat' | 'perConsumption'
  bonusMovesPerConsumption: 2, // 'perConsumption' only
}
```
- **`'flat'`** (default, matches the spell book): a spell with `consumedQuickens > 0` (or any Quicken) has +1 speed. It does not stack. A spell that becomes electrified mid-turn immediately gains +1 remaining move. A Quicken consuming a Quicken gains nothing extra.
- **`'perConsumption'`** (the current behavior, which enables combos): every consumed Quicken grants `bonusMovesPerConsumption` extra moves this turn. If this mode is kept, it must be documented in the spell book.

### 11b. Ether bonus
Flat +5 power for any Ether or spell with `consumedEthers > 0`. It does not stack.

### 11c. Gyre exit bonus
`GYRE_RULES.exitBonusMode`:
- **`'none'`** (default): a spell leaving a Gyre continues with exactly its remaining horizontal moves (see 4a).
- **`'legacy'`** (the current behavior): the spell gains `height + 1` extra horizontal moves after leaving the Gyre.

## 12. Ether consuming a Quicken
No special rule. The old "Quickens race through Ethers" requirement is dropped: a Quicken that loses to an Ether is consumed whole.

## 13. Breaking apart sized spells

### 13a. When and how
When a sized spell (larger than 1x1) wins a collision:
- **Against a Phlegm**, by shape:
  - **Single-row spells (Quicken chains)** enter cell by cell: cells inside the Phlegm break off as 1x1 pieces that orbit it in single file (7a); the rest stays chained and breaks off as it reaches the Phlegm. Example: a 1x3 chain becomes 1x1 + 1x2, then 1x1 + 1x1 + 1x1, orbits, exits, and recombines (13d).
  - **Taller spells (Ethers, sized Phlegms, Gyres)** split by rows: the rows touching the Phlegm **bounce off it as a block**: the block first slides into the Phlegm (until centered on it if it fits, otherwise until its front edge reaches the Phlegm's far side), then swirls in place (shown rotating) for the orbit's duration (`4 × (Phlegm size − 1)` steps, at least 1), then reversing. The other rows keep going. If every row touches, the whole spell bounces without breaking up.
  - **1x1 spells** orbit as in 7a.
- **Against a Gyre** (not yet rebuilt, step 3): only the cells overlapping the Gyre become 1x1 pieces, which enter it (each uses 1 capacity).

Whenever cells are split off, they form the **largest valid shapes** for the spell's type (squares for Ether/Phlegm, vertical stacks for Gyre, horizontal chains for Quicken; see 14). Ties are broken by scanning from the top-left, so the result is deterministic.

Example: a 3x3 Ether hitting a 2x2 Phlegm that covers rows 0-1 splits into a bouncing 3x2 part (one 2x2 and two 1x1s) and a 3x1 part in row 2 that keeps going.

### 13b. Piece behavior
- Pieces keep moving. Most will move into the Phlegm/Gyre on later steps.
- In collisions with **the Phlegm/Gyre that broke them apart**, pieces use the **parent's power** (before breaking). In all other collisions, they use their own power.
- In `'power'` capacity mode, a piece drains capacity by **its own** power, not the parent's.
- Pieces keep the parent's `consumedEthers`, `consumedQuickens`, and `consumedPhlegms`.
- Pieces keep the **parent's remaining moves** for the rest of the turn.
- Pieces of the same spell **moving the same direction** never collide with each other and **never share a cell**: a piece whose next cell holds a sibling waits (keeping its move) if that sibling will move away this step; if the sibling is stuck, the piece gives up the move instead.
- Pieces of the same spell **moving toward each other** (e.g. one reflected by a Phlegm) collide like any other spells. Example: a 1x1 Phlegm reflects one cell of a 2x2 Ether; that cell then meets its sibling head-on and both are destroyed (equal power).
- Reflection bonus moves (7b) use the parent's power.

### 13c. When a Gyre wins
`GYRE_RULES.collisionMode`:
- **`'power'`** (default, current behavior): Gyres compare by power. A Gyre that wins consumes the other spell and gains its modifier (e.g. an Ether sets the Gyre on fire).
- **`'alwaysLoses'`**: Gyres are pure terrain; any non-Gyre spell that collides with a Gyre is lifted.

Balance note: a full-height (3) Gyre's tip is always at the board edge, so in `'destroy'` mode every spell it lifts is destroyed. Capacity and `offBoardMode` are the levers if this proves too strong.

### 13d. Reassembly after exiting
Applies to every sized spell type (Ether, Phlegm, Quicken, Gyre). Once **every** piece of a broken-up spell has left the Phlegm/Gyre that broke it (none overlapping it, orbiting, or being lifted), and the pieces are moving the same direction and exactly fill an allowed shape, they **immediately reassemble** into one spell.

The reassembled spell then takes its reflection bonus moves (7b). *Until 7b is implemented (rebuild step 4), it stops for the rest of the turn as a placeholder.*

Example: a 3x3 Ether reflected by a 3x3 Phlegm reassembles where it started, now facing the other way. With 7b it gets `max(1, floor(|50 − 45| / 5))` = 1 bonus move, exits the board, and hits the opponent once for 50 that turn (not as separate pieces).

If pieces were destroyed or separated, they do not reassemble mid-turn; they wait for the end-of-turn merge (14).

## 14. Recombining
- **When:** at the end of the spell-movement turn (plus the mid-turn reassembly in 13d).
- **What:** spells of the same type moving in the same direction (caster does not matter) combine into the largest allowed shapes:
  - **Phlegm, Ether:** squares (1x1, 2x2, 3x3), trying the largest first. Only pieces lying **entirely** inside the square may merge.
  - **Gyre:** vertical stacks of the same Gyre direction, up to `GYRE_RULES.maxHeight` (3).
  - **Quicken:** horizontal chains up to 7 (the board width).
- The merged spell keeps every bonus any of its pieces had (on fire, electrified, empowered).

## 15. Headless simulation
- The rules engine is pure and deterministic, with no timers, rendering, React, or valtio. Given a board state, it returns the resulting state plus a log of every micro-step.
- The UI animates that log.
- This supports RL training (Gymnasium): either port the engine to Python, or run the TypeScript engine headless in Node behind a Python bridge, which keeps one copy of the rules.
- A suite of saved test scenarios (input board, expected result) verifies the rebuild, and later verifies any Python port behaves the same.

## Config summary
All tunable rules with their defaults:

```ts
PHLEGM_RULES = {
  collisionMode: 'alwaysLoses',  // 'alwaysLoses' | 'power'                       (2b)
  absorbCostsPower: false,       // 'power' mode only                             (2b)
  empoweredBonus: 20,            //                                               (2c)
  reflectBonusMode: 'powerDiff', // 'powerDiff' | 'size' | 'none'                 (7b)
  capacityMode: 'count',         // 'count' | 'power' | 'unlimited'               (7c)
  capacityPerCell: 1,
  powerCapacityPerCell: 5,
  capacityResetsEachTurn: true,  //                                               (10c)
}

GYRE_RULES = {
  powerPerCell: 4,               //                                               (3)
  offBoardMode: 'destroy',       // 'destroy' | 'clamp'                           (4b)
  capacityMode: 'count',         // 'count' | 'power' | 'unlimited'               (4c)
  capacityPerCell: 1,
  powerCapacityPerCell: 4,
  capacityResetsEachTurn: true,  //                                               (4c, 10c)
  maxHeight: 3,                  //                                               (5c)
  exitBonusMode: 'none',         // 'none' | 'legacy'                             (11c)
  collisionMode: 'power',        // 'power' | 'alwaysLoses'                       (13c)
}

QUICKEN_RULES = {
  bonusMode: 'flat',             // 'flat' | 'perConsumption'                     (11a)
  bonusMovesPerConsumption: 2,   // 'perConsumption' only                         (11a)
}
```

## Out of scope
Drawing logic and sized focus costs (old 1Bi) live in other files and are handled separately.

## Open design question: placement visibility (turn flow, not spell movement)
Today the NPC places first and the player watches, so the player always moves second with full information and can counter anything (e.g. a 3x3 Phlegm against a visible 3x3 Ether). This removes the Phlegm's risk of healing the opponent (2a) and will make a trained AI exploitable.

Proposed: a setting `NPC_PLACEMENT_VISIBILITY: 'full' | 'shape' | 'hidden'`:
- **`'full'`**: current behavior.
- **`'shape'`**: the player sees where and how big the NPC's spells are, but not their type, until spell movement starts. Recommended to playtest first.
- **`'hidden'`**: the NPC visibly draws, but its spells are veiled until the clock is clicked (truly simultaneous moves; recommended for RL training).

## Known bugs (current implementation)
To fix during the rebuild:
- Gyres, or parts of Gyres, can persist off the board.
- Phlegm bonus moves are applied twice with opposite signs (`Phlegm.conferModifierTo` and `doCollision`).
- `consumedGyres` is set by two conflicting formulas. The GyreDown formula returns an absolute row rather than a distance, and the extra `remainingMoves` it adds gives spells unwanted horizontal moves after leaving a Gyre.
- The square merge (Phlegm/Ether combining) does not check that every merged piece fits inside the square.
- Each consumed Quicken adds +2 moves rather than a flat +1 speed.
