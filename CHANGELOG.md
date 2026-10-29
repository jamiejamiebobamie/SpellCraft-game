# Changelog

SpellCraft (QuickCast) was built between 28 August and 28 October 2026. Version numbers were assigned afterwards, from the commit history, following [Semantic Versioning](https://semver.org/) as it applies to a game:

- **Major**: a change in what the game *is*: a rebuilt rule set, a new way to play.
- **Minor**: new features, spells, scenes or systems.
- **Patch**: fixes, tuning and polish.

Each version lists its date range and the commits that make it up (short hashes: `git show <hash>`). The paper design notes and tickets kept during development are summarised at the end: [Design history](#design-history) and [Considered but not built](#considered-but-not-built) (quotes from them in *italics*).

---

## [2.4.0] – 2026-10-28 · Spectacle

The endings and the hall made more dramatic.

### Added
- The wallpaper around the game: one of seven seamless patterns, picked at random each visit (`3dbb015`).
- A gold frame around the game, in the Play button's brass (`3dbb015`).
- Great clashes: two 3x3 Fireballs meeting shatter like meteors, pieces flying out with streaming fire trails; two 3x3 Water Wheels burst in a splash, then drops run down the "lens" (`edf1395`, `9aa3cbb`).
- Dramatic endings: at a catch or a death the hall darkens around the wizards; the fallen wizard crumples backward, the hem of their robe showing their feet; dizzy stars circle over them (`929a065`, `cb87cbd`, `80ad676`).
- The game over card: the title's letters bounce in, a sheen sweeps across them, and a buoyant wave ripples through every few seconds; each mask sits over its wizard (`80ad676`).
- Confetti for the wizard left standing, landing on the floor and staying (`788db9c`, `68592b0`).

### Changed
- Updrafts and Downdrafts drawn about twice as opaque on the board (`576d7ab`).
- Scene placement and brightness tuning (`aed7c78`, `53f0348`).

### Fixed
- The iPad slowdown, found by bisecting builds on the device: a hidden gold highlight that kept pulsing; Safari now shows it steady (`b77c973`).
- The wallpaper on the live site, the Spell Book's handwriting font on the iPad, the background's brightness in Safari (`2c2f891`, `57a4540`).
- Focus spent on a click that cast nothing; the off-board highlight on any miss (`788db9c`).

## [2.3.0] – 2026-10-27 · The hall, layered

### Added
- A new background, with the picture frames, suit of armour and wall sconce as their own layers, each with its own brightness, blur, hue, scale and position (`8733216`, `4c983ea`).
- The door's green torch flame, animated: a flicker and sway, its glow kept inside the doorway (`8733216`).
- The landing page waits for the whole scene to load (`d4c928a`).
- Spell Book margin notes: "draw a circle / or click on a cell", "draw a line", and "up" / "down" with arrows on the drafts (`d4c928a`).
- The game over masks' vortices restyled, flat and etched (`d4c928a`).

### Changed
- The birdsong twice as loud; the tooltips toggle shown as a note (`d4c928a`).

### Fixed
- Performance in Edge and Safari: the clock's hands turned by the GPU, not repainted every frame (`a8386b5`).

## [2.2.1] – 2026-10-24

### Fixed
- Performance on the iPad: the canvases drawn at a capped pixel density, the game over backdrop's blur only while it shows (`07df24c`).
- The Spell Book tray's symbols readable at a glance, always drawn in ink (`c7c2b70`, `1fd43b7`).

## [2.2.0] – 2026-10-24 · One look

### Added
- A unified gold-and-glass UI style across every panel, button and card (`d6b25bf`).
- Drawing off the board outlines the player's side in gold (`02be7d4`).
- The moves dictionary: the player's own recorded moves used to train the opponent (`5ed14a8`, `0d151af`).
- A spell-rules audit run over random games (`f70d876`), and a tool for reviewing the opponent's habits (`d573690`).
- A new trained opponent, on the fixed rules and the moves dictionary (`d8c4d94`).

### Changed
- Brutal plays 15% random turns (`d460f2c`).

### Fixed
- Spell rules found broken by the audit (`f70d876`); the opponent never casts a mixed-size Fireball (`4bcea3c`).
- Every overlay closed once the match is over (`c3229dd`).

## [2.1.0] – 2026-10-23 · Dawn

### Added
- The teacher at dawn: from 4 AM a teacher may catch the weaker wizard, likelier each turn; a lantern passes the doorways, the caught wizard is lifted, struggles, and is dragged out; "Caught!" (`6f6cca9`, `d783a60`, `decc610`, `f0bb734`).
- Birdsong in the last hour before sunrise, and birds flying past and landing on the windowsills (`60aaf41`, `cc7b7e0`, `542d7b9`).
- A status emoji over each wizard: frightened at risk, relieved when spared (`cc7fd0d`, `acd701c`).
- Volume sliders for sound effects and music (`36357b8`).
- Choose Your Duel: framed glass plaques, a gold title with a sunrise gradient (`ac46eab`, `90263f1`, `cc96428`, `a37f1ae`).
- Game over masks in gold rings over a turning maelstrom, cracking for the loser (`929635a`, `613e804`); the player's own white mask (`cdfd242`).
- Anonymous site metrics (`64dffad`).

### Changed
- A turn is fifteen minutes of the night (was twenty) (`3618f57`).
- The game over text in a book serif (`11de939`).
- The store relies on valtio alone, without forced re-renders (`e596058`, `eaabb50`).

### Fixed
- Space and Escape no longer end the turn while the opponent is drawing (`f6e9ffc`).

## [2.0.0] – 2026-10-22 · Two players

A second way to play: against a friend.

### Added
- 2-player matches, browser to browser (PeerJS), by invite link; offered only when the service is up (`b345862`).
- Live drawings: each player's strokes appear on the rival's screen as they're drawn (`2452d8b`).
- Emoji reactions in 2-player matches (`f8cb73b`).

### Changed
- Updrafts and Downdrafts absorb damage up to a capacity, fixed when cast (`035f548`), and the opponent retrained on it (`cea312d`).
- The landing logo's spells are the real spells, drawn once and looped (`bdc5fd5`).

### Fixed
- The Spell Book's first open and the clock halo's cost each frame; page measuring every frame removed (`d5db424`, `d1f4c06`, `6e56a04`).

## [1.2.0] – 2026-10-21 · The turn clock

### Added
- The turn clock: the clock's seconds hand counts down the player's turn and ends it; it waits while the Spell Book or a tip is open (`6f75d20`, `51ebf5f`, `05f112a`).
- Turn order alternates every turn (`c6e7132`), with a Your Move / Their Move card and the active wizard's spotlight brightening (`984c0af`).
- Spells reaching a wizard fly off the board and strike them (`1949a96`).
- Reworked spell rules: Chain Lightning's bonus moves, Fireballs moving the same way merging, 3 focus a turn (`4403fcb`, `64c539f`, `8682322`, `40bf27b`, `9705be9`).
- A retrained opponent (`d54cb9f`, `d3b6be3`).

### Fixed
- The opponent's pending moves could act in a later turn or match; its turn could stall the clock (`7e15d3e`, `13afe3a`, `5762646`).

## [1.1.0] – 2026-10-19 – 2026-10-20 · Polish

### Added
- Tooltips in chunks: a one-page story, then tip cards as each becomes relevant (`080dcd1`).
- The clock's halo: twisting 3D ribbon rays (`dd86008`, `daa0095`).
- The Spell Book's pages in the style of the Book of Kells: vellum, knotwork, illuminated capitals, margin notes (`de57b78`, `4aebcb2`).
- The ruby Play button, its lettering etched with a glinting light; ruby Yes/No on the game over card (`fb066d6`, `c2bfe95`, `557414e`, `7334448`).
- App icons and the tab icon (`cfdffb9`, `afbba3a`).

### Changed
- A rules rebalance: costs, Water Wheel bonus, Gyre exit bonus and lifetime (`bb9d9dd`); the opponent never uses suicidal blood magic (`eb25e7f`).

### Fixed
- The game over card shows on a draw (`fbd468a`).

## [1.0.0] – 2026-10-17 – 2026-10-19 · First release

The rules rebuilt, a trained opponent, and the game published with a README and an MIT license.

### Added
- The spell rules rebuilt as a pure, testable movement engine: collisions, Water Wheels, Gyres, sized spells (`9aa4b4d`, `6fa4f96`, `2c1959b`, `3d458e6`, `3188ae4`, `4cfda66`).
- A headless game simulation and mirror-symmetric rules (`802a18a`, `e0fbf89`).
- A trained opponent: a reinforcement-learning environment (Gymnasium), a scripted opponent to train against, and the model playing in the game (`4ae32d0`, `bfb8261`, `5c13b06`, `9c1c339`).
- The loading screen: the logo of two duelists locked wand to wand, a boot screen from the first paint (`cbd2a15`, `27cfdb4`, `377ea0c`).
- README and MIT license (`4759e67`).

### Changed
- Focus costs per cell, and blood magic's cost in health (`c72d03e`, `acab7d6`, `c496511`).

## [0.10.0] – 2026-10-08 – 2026-10-16 · Onboarding

### Added
- The intro walk (`d323caf`), tooltips (`4d6478b`, `a1b4dd3`), an asset loader (`321835e`).
- The game over card (`0ff5a56`).
- Blood magic's damage effects, and the breaking dawn as the night ends (`e858bd7`, `21017fc`).

### Fixed
- Mobile layout (a series of on-device tests, `badf878`–`a8bc52e`); the game clock (`413ffbc`); the game over card after a blood magic death (`90b3e9b`).

## [0.9.0] – 2026-10-02 – 2026-10-07 · Sound and the Spell Book

### Added
- The Spell Book's modal pages, a keyboard-controls widget (`0fff412`, `ea20d03`).
- Placing a readied spell with the keyboard (`2e11bc5`).
- Sound effects and music (`96cebe0`), a death animation (`4bda3d9`), audio settings (`756e7a8`).

### Changed
- The opponent's move logic moved into its own class (`6c6b27f`).

## [0.8.0] – 2026-09-24 – 2026-09-29 · Spells come alive

### Added
- Procedurally drawn spells and their particles: Fireball (Ether), Chain Lightning (Quicken), Water Wheel (Phlegm), Updraft and Downdraft (Gyres) (`22025aa`, `4a28ef9`, `21d2e5b`).
- Spell names in the Spell Book (`e9c578b`); the site's name (`d3a26e6`).

## [0.7.0] – 2026-09-15 – 2026-09-21 · The hall

### Added
- Requirements for spell collisions (`2a350cf`), spells conferring their powers on what consumes them (`a789cbc`).
- The chandeliers, the background, the avatars' shadows, the seconds hand (`6e04131`).
- The opponent drawing its spells on the board, its arm following (IK) (`1543682`).

## [0.6.0] – 2026-09-08 – 2026-09-14 · Turns

### Added
- Turn-based play: click the clock to end the turn (`f2d4366`).
- Difficulty (Normal, Hard, Brutal) and its masks; key bindings for every action (`c8ae1a0`, `2a350cf`).

### Removed
- The Fizzle badges mechanic (`8047138`).

## [0.5.0] – 2026-09-04 – 2026-09-06 · An opponent

### Added
- A basic opponent making random moves (`7d3e43a`); spells moving smoothly and leaving the board (`d0aa84f`); resetting the game (`95c7e68`).

### Fixed
- Screen updates (`6d8b9d5`, `49ffdf2`).

## [0.4.0] – 2026-09-01 – 2026-09-03 · Wizards

### Added
- A clock face as the turn timer, spell stats on hover (`46639e2`).
- The wizards' bodies and their wand arm's inverse kinematics; the Spell Book and its animation (`d35ef40`, `7195b50`).

## [0.3.0] – 2026-08-30 – 2026-08-31 · Spells

### Added
- Spells and a first game loop (`709bfd9`); the Updraft and Downdraft (`b44b254`).

## [0.2.0] – 2026-08-29 · Mock-ups

### Added
- Mock-up spell icons, and the first UI interactions tested (`efcb646`).

## [0.1.0] – 2026-08-28 · First commit

### Added
- The project: React, TypeScript, Vite, valtio; mock-up images (`b32bf88`, `465218b`, `e918479`).

---

## Design history

From the paper notes, bug tickets and feature tickets kept during development.

### Before the first commit (28 August)
- **The first spells had other names and powers.** Five drawn symbols: *Stone* (the triangles: slow, raising or lowering a spell a row), *Gust* (the line: fast), *Aether Astra* (the star: damaging), *Sweat* (the circle: neutralising) and *Fizzle* (a failed drawing). In the next sketch they became *Raise / Lower*, *Hasten*, *Negate* and *Capture* (which reversed a spell and made it yours). By 0.3.0 they were the Gyres, Quicken, Ether and Phlegm, and later still, on screen, Updraft / Downdraft, Chain Lightning, Fireball and Water Wheel.
- **Blood magic was there from day one**: the first data-class sketch already says the caster takes damage for every point of focus they're missing.
- **The board, the hall and the turn were drawn before they were built**: player and enemy placement columns, the duelists in arched doorways under chandeliers, "click and hold to cast", and a turn loop ending when a duelist falls or *a proctor catches the students*, likelier the longer the match goes: the teacher at dawn, built in 2.1.0.
- **The wand arm's inverse kinematics** were worked out on paper (joint limits, the law of cosines inside the arm's reach) and built in 0.4.0.

### Spell enhancement (September)
- Sized spells: drawn across several cells, a spell grows (squares for Ether and Phlegm, rows for Quicken, columns for the Gyres), with its own collisions, break-ups and buffs: worked through in dozens of collision sketches, then rebuilt as the movement engine in 1.0.0.
- The design goals, as written then: *clear winners between pieces in play; trades; a clearing board (no traffic jams); two levels of heuristics, shallow ("pretty!") and deep ("moves"); every spell useful at every size; each with a feel: lightning fast, fire damaging, wind up and down, water the wild card; adding energy into the system, then an explosion!*
- *Update order* (which spell moves first) was designed, then dropped: "very abstract, boring, not visually presented in a good way". Spells now move together, in small steps.
- The spell names were changed to more familiar ones to *lower the barrier to understanding (at the cost of some personality and originality)*.

### Turns, onboarding and the opponent (September – October)
- A **turn-based mode** was designed for players who *can't or don't do "twitch" gameplay*, to pause and inspect the board: it became the only mode (0.6.0).
- **Fizzle and backlash** (punishing an inaccurate drawing) were removed as *not fun, confusing* (0.6.0). Removing **blood magic** was proposed too, then *withdrawn*.
- The **trained opponent** was specified on a ticket (its inputs, outputs and goal: *win, using a variety of moves, skips included*) before being built with reinforcement learning (1.0.0).
- **Multiplayer** was a stretch goal, for *more strategies (human ingenuity, error, randomness), replayability and a player culture*: built in 2.0.0, peer to peer rather than with the socket.io first planned.

## Considered but not built

Ideas from the notes that didn't make it in, or were built differently:

- **Speed-up / slow-down tokens** ("Time Warp"): an hourglass power to speed the game up for the winner or slow it down for the loser, as a balancing mechanic.
- **Five board rows** (instead of three), with the clock growing and shrinking with the board.
- **A game log** beside the board: each spell's name, info and picture on hover, and the *bookkeeping* of its buffs (every Fireball, Chain Lightning or Water Wheel it had absorbed), colour-coded by spell. The Spell Book's pages took its place.
- **Floating stat text on spells and cells** ("Speed +1", "Focus +2"), coloured by spell type. Only health changes got floating numbers.
- **Animated spell icons** (14 APNGs, with beginning / middle / end pieces for sized spells): spells became procedural canvas drawings instead.
- **Counting buffs on the spell itself**: a star per point of Fireball damage, an arc per Chain Lightning speed boost, a leaf per Gyre life.
- **Positional combos** for touching spells (stacked Gyres carrying spells off the board; Chain Lightnings in a row gaining speed): they became sized spells, and the chain bonus.
- **A "Fire-nado"**: a Gyre catching fire from a Fireball.
- **Two-wide Gyres**: Gyres stayed one column wide.
- **"Mini" inferences**: casting a combo of different spells with a single meandering stroke.
- **A sequenced tutorial** using a highlight library: tooltips and tip cards were built instead.
- **A room or face transformation** when a wizard is caught.
- **A general scaled explosion** whenever two equal spells destroy each other: built only for two 3x3 Fireballs or Water Wheels (2.4.0).
- **Halloween iconography** drawn for the background (cauldrons, witch hats, crystal balls, jack-o'-lanterns, skulls…): seamless patterns were bought instead (2.4.0).

### Known issues
- A brief flicker to black during or just after the intro walk (accepted as is).
