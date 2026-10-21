# SpellCraft

**A strategy duel where you cast spells by drawing them.**

You're a member of a masked wizard fight club. After curfew, you sneak out of bed for a duel in the school's halls. Draw spell symbols to cast them; your spells travel across the board, collide, combine and interact with your opponent's. Bring their health to zero before sunrise or the faculty are sure to catch you.

### [▶ Play it: spellcraft-game.netlify.app](https://spellcraft-game.netlify.app/)

<p align="center">
  <img src="public/tooltip-imgs/blood-magic.gif" alt="Gameplay: the player draws a large circle with a sparkling trail and casts a big fireball, paying for it with blood magic, while the opponent's fireball heads their way" />
</p>

---

## How to play

- **Draw to cast.** Hold the mouse button and draw a spell's symbol (a circle, line, star or triangle) over your side of the board. A neural network running in your browser recognizes the drawing. The size of your drawing sets the spell's size, from one cell up to 3×3.
- **Spend focus.** Every cell of a spell costs focus. You get 2 focus back each turn and can store up to 8.
- **Or pay in blood.** Cast beyond your focus, and the difference comes out of your health instead.
- **End the turn** by clicking the clock. All spells then move and interact.
- **Mind the clock.** Its red seconds hand counts down your turn (30 seconds, ticking round faster than a real minute). If it reaches 12 before you end your turn, your turn ends anyway.
- **Survive until sunrise.** Each turn is five minutes of game time from midnight to 6 AM, and the closer it gets to dawn, the likelier a teacher catches you.

Mouse, keyboard or a mix of both all work; the keyboard controls are in the game's settings.

## Game design

### Five spells, one interaction web

Every spell beats some situations and loses to others, so there's no single best spell, only the right answer to the board.

| Spell | Name in code | Symbol | Cost per cell | What it does |
|---|---|---|---|---|
| **Fireball** | `Ether` | circle | 2 | Damages on impact and destroys weaker spells. Whatever destroys it inherits +5 damage. |
| **Chain Lightning** | `Quicken` | line | 1 | Travels fast. Whatever destroys it inherits +1 speed. |
| **Water Wheel** | `Phlegm` | star | 1 | Heals what it touches, and reflects stronger spells back the way they came. A Water Wheel that takes in another heals +15 more. |
| **Updraft / Downdraft** | `GyreUp` / `GyreDown` | diamond / triangle | 1 | Lifts stronger spells a row up or down. Anything pushed off the board is destroyed. |

Because spells pass their power on, combos emerge naturally: a Chain Lightning fed into your own Fireball makes a faster fireball, and an Updraft or Downdraft can lift an incoming spell out of a threatened row or straight off the board.

**Water Wheels.** A sized spell that runs into a Water Wheel breaks into single cells. Each cell swirls once around the wheel, and they reassemble as they leave it.

**Updrafts and Downdrafts:**
- **Lifting:** a draft lifts every stronger spell that reaches it during a turn, then dissipates at the turn's end.
- **The boost:** a spell leaving a draft gets a one-time boost of +1 move for each cell of the draft's height, used right away.
- **Drafts meeting:** the bigger draft consumes the smaller, and the smaller pushes it one row past its own tip, in the smaller's direction. Two drafts of equal size destroy each other.

**Collisions.** Pieces of the same spell never destroy each other. A spell caught in a Water Wheel or a draft can still be hit and destroyed by other spells.

### Economy and balance

- **Per-cell costs** (focus × cells), so a spell costs the same whether you draw it at full size or place its cells one by one with the keyboard.
- **No cost cap.** The biggest casts deliberately cost more focus than you can hold, so they always involve blood magic, which keeps a fully charged 3×3 Fireball a real decision.
- **Blood magic at 5 health per missing focus point** (3 and 7 were tried), tuned against two scenarios:
  - a 3×3 Fireball (18 focus) cast with a full 8 focus costs 50 health for up to 50 damage, a gamble that only pays when it lands;
  - casting the same spell every turn, on 2 regained focus, costs 80 health each time, so it never pays off.

  Saving up for a big turn is possible, but spamming isn't.

### Fairness

The movement rules are defined from one player's side and mirrored for the other. That covers the order spells resolve in, how sized spells break apart, and how rounding falls. The tests check that mirrored boards play out as exact mirror images: 1,000 random boards and 200 full games.

### The opponent

- **A trained AI:** the NPC is a reinforcement-learning agent (see below) that wins 98–100% of games against scripted and random opponents.
- **Variety:** rather than always playing its top-rated move, it samples among its good moves, with a penalty for repeating a recent move (the same spell at the same size), so it doesn't fall into the same opening every game.
- **Difficulty:** Normal, Hard and Brutal mix in more or fewer random turns. Their drawings are deliberately imperfect, like a human's, but always true to the size of the spell cast, and never stretched too far out of shape.
- **No self-destruction:** casts whose blood magic would kill the NPC are removed from its legal moves, both in training and in play.
- **Turn order:** every other match, the NPC waits for you to cast first, then answers. If it's waiting too long, a tip reminds you it's your move.

## Technical highlights

- **Drawing recognition in the browser:** a small neural network, run with ONNX Runtime Web, classifies each drawing into a spell symbol.
- **A deterministic spell engine:** all movement and collision rules live in one pure, testable engine, shared by the game (which replays its frames as animation) and a headless simulation.
- **An NPC trained with reinforcement learning:**
  - the headless simulation is wrapped as a [Gymnasium](https://gymnasium.farama.org/) environment through a Node bridge;
  - it's trained with MaskablePPO ([Stable-Baselines3](https://sb3-contrib.readthedocs.io/)), which never picks illegal moves, against a mix of scripted and random opponents;
  - it's exported to ONNX and runs in the browser.
- **Procedural visuals:** spells, particles, the animated loading-screen logo (two duelists locked in a struggle, solved with two-bone inverse kinematics) and the clock's halo are all drawn in code on canvas, SVG and CSS.
- **Fast first load:**
  - a boot screen embedded in the HTML, with a title font cut down to 5 KB, shows on the first paint;
  - assets load in two batches, the logo's first;
  - the ONNX runtime loads on demand.
- **Tests:** Vitest covers the rules engine, the simulation, the training environment and the scripted opponent.

```mermaid
flowchart LR
  subgraph Browser
    UI[React UI + canvas] --> Game[Game state, valtio]
    Game --> Engine[Spell movement engine]
    Game --> Drawing[Drawing recognizer, ONNX]
    Game --> NPC[NPC brain, ONNX]
  end
  subgraph Training
    Sim[Headless simulation] --> Engine
    Bridge[Node bridge] --> Sim
    Gym[Gymnasium env] --> Bridge
    PPO[MaskablePPO] --> Gym
    PPO -- export --> NPC
  end
```

## Built with

| | |
|---|---|
| **Game** | React 19, TypeScript, Vite, styled-components, valtio |
| **Machine learning** | ONNX Runtime Web; Python, PyTorch, Gymnasium, Stable-Baselines3 (sb3-contrib) |
| **Testing and tooling** | Vitest, Oxlint, Rolldown (the training bridge), Pillow (asset scripts) |
| **Hosting** | Netlify |

## How it was made

SpellCraft is my own project: I designed it, made its art and built it over about three months. Along the way I used AI coding assistants ([Claude Code](https://claude.com/claude-code) and Gemini) as part of my workflow, for implementation support, refactoring, testing and tooling. The game's design, art and direction are my own.

## Running locally

```bash
npm install
npm run dev     # the game at http://localhost:5173
npm test        # the rules engine and simulation tests
npm run build   # a production build in dist/
```

**Training the NPC (optional):** this needs Python 3.12. Create the environment in `training/.venv` from `training/requirements.txt`, then:

```bash
npm run build:bridge                                         # bundle the simulation for Python
training/.venv/Scripts/python training/train.py --steps 500000
training/.venv/Scripts/python training/export_onnx.py training/models/<model>.zip   # use it in the game
```

## Credits

**Art:** all game art is my own.

**Font:** [Enchanted Land](https://www.sharkshock.net/) by Dennis Ludlow (Sharkshock), free for personal use (see `public/fonts/readme.txt`).

**Sound effects:** from [Freesound](https://freesound.org/), used under their Creative Commons licenses:

| Sound | Author | License |
|---|---|---|
| [CLOCKChim, Grandfather Clock, Third Quarter Chimes](https://freesound.org/s/805325/) | designerschoice | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [Fire - Swooshes - Wind 05](https://freesound.org/s/671309/) | GregorQuendel | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) |
| [Fire - Impacts - Complex 20](https://freesound.org/s/671312/) | GregorQuendel | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) |
| [SFX_MAGIC_FIREBALL_001](https://freesound.org/s/77691/) | JoelAudio | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [a gust of wind blowing some leaves](https://freesound.org/s/711441/) | F3ather | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [REYNAS_Fanny_2019_2020_Water](https://freesound.org/s/485796/) | univ_lyon3 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [JacobsLadderSingle2](https://freesound.org/s/19487/) | Halleck | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [Male Death Cry 3](https://freesound.org/s/695386/) | F.M.Audio | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [Scream - Ugh](https://freesound.org/s/338145/) | ArtOrDie | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [Male Grunts](https://freesound.org/s/727827/) | abraksil | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| [Magic Healing Spell SFX - Fantasy RPG Restore Effect](https://freesound.org/s/853303/) | TommasoMotteran | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

**Music:** "Magic Escape Room" Kevin MacLeod ([incompetech.com](https://incompetech.com/))\
Licensed under Creative Commons: By Attribution 4.0 License\
[http://creativecommons.org/licenses/by/4.0/](http://creativecommons.org/licenses/by/4.0/)

## License

The code is released under the [MIT License](LICENSE). The art, sounds, music and font are not covered by it; they belong to their creators, under the terms above.
