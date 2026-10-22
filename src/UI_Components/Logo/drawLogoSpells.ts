// drawLogoSpells.ts
// The logo's symbols and spells (a canvas under the duelists): each symbol is drawn on the outside
// and fades into its animated spell on the inside, plus pixie dust falling from the symbols and
// sparks where the wands cross (a canvas over the duelists). With LOGO_CONFIG.spells.still, the spells
// and the symbols' outlines are drawn once and reused (only the dust is live).
import { HARDCODED_SYMBOLS_FOR_DISPLAY } from '../../DataClasses/PlacedSpells/HardCodedSymbolsForDisplay';
import { drawProceduralSpell, spawnPreviewSpellParticles, updateAndDrawParticles } from '../HTMLCanvas/DrawFunctions/RenderSpells/renderSpells';
import { draw4PointStar } from '../HTMLCanvas/DrawFunctions/Sparkles/SparkleFunctions';
import { pixieColors } from '../HTMLCanvas/DrawFunctions/SpellBook/SpellBookFunctions';
import { LOGO_CONFIG, LogoSpell } from './logoConfig';
import { Vec } from './duelMath';

type Dust = { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; color: string; isStar: boolean };

/** Per spell: its particles and pixie dust, kept between frames. */
type SpellState = { particles: Array<any>; dust: Array<Dust> };

/**
 * Where things are on the canvas: device pixels per logo unit, where the logo's (0, 0) is (device
 * pixels: the canvas reaches past the logo), and where the fades point (logo units).
 */
export type LogoFrame = { pxPerUnit: number; origin: Vec; wandCrossing: Vec; radialCenter: Vec };

/** A rectangle in device pixels. */
type Rect = { x: number; y: number; w: number; h: number };

/** A picture drawn once (faded, at its opacity), cropped to `rect` on the logo's canvas. */
type StillFrame = { image: HTMLCanvasElement; rect: Rect };

/**
 * A spell or symbol drawn once, or (a flipbook) several times, shown in turn every `frameSeconds`. A
 * spell moves (still.motion) about `pivot` (device pixels); `flatten`: a Phlegm ring's height / width;
 * `bodySign`: which way the spell lies from its pivot (1: below, -1: above).
 */
type Still = { frames: Array<StillFrame>; frameSeconds: number; pivot: Vec; flatten: number; bodySign: number };

/** A steady pseudo-random number from -1 to 1 for each whole number `n`. */
const random = (n: number): number => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return 2 * (x - Math.floor(x)) - 1;
};

export class LogoSpellsRenderer {
  private scratch = document.createElement('canvas');
  private states = new Map<LogoSpell, SpellState>();

  private stills = new Map<string, Still>(); // by spell and layer
  private stillsKey = ''; // what they were drawn for (the canvas's size and the frame)
  private stillsFrame: LogoFrame | null = null; // (the frame the shown stills were drawn for)
  private nextStills: { stills: Map<string, Still>; frame: LogoFrame } | null = null; // (being drawn)
  private drawingStills: Generator<void> | null = null; // (drawing them, a step at a time)
  private isReadyTold = false;
  private onReady?: () => void;
  isShown: boolean;

  /**
   * `onReady`: told once the spells are first ready to show (their stills all drawn). `isShown`: false
   * while the logo is hidden (behind the boot screen), when the stills may take longer each frame.
   */
  constructor(onReady?: () => void, isShown: boolean = true) {
    this.onReady = onReady;
    this.isShown = isShown;
  }

  private tellReady = (): void => {
    if (this.isReadyTold) return;
    this.isReadyTold = true;
    this.onReady?.();
  };

  /** Draws the symbols and spells back to front (LOGO_CONFIG.spells.layerOrder), at `time` (ms; `dt` in s). */
  render = (ctx: CanvasRenderingContext2D, frame: LogoFrame, time: number, dt: number): void => {
    const { canvas } = ctx;
    if (this.scratch.width !== canvas.width || this.scratch.height !== canvas.height) {
      this.scratch.width = canvas.width;
      this.scratch.height = canvas.height;
    }
    const scratchCtx = this.scratch.getContext('2d');
    if (!scratchCtx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (LOGO_CONFIG.spells.still.isOn) this.renderStill(ctx, scratchCtx, frame, time, dt);
    else {
      this.renderLive(ctx, scratchCtx, frame, time, dt);
      this.tellReady();
    }
  };

  /** Each spell and symbol to draw, back to front: anything not in layerOrder first, then layerOrder reversed. */
  private getDrawOrder = (): Array<{ spell: LogoSpell; layer: 'symbol' | 'spell' }> => {
    const { list, layerOrder, show } = LOGO_CONFIG.spells;
    const ordered = layerOrder.flatMap(([name, layer]) => list.filter(s => s.spellName === name).map(spell => ({ spell, layer })));
    const isOrdered = (spell: LogoSpell, layer: string) => ordered.some(o => o.spell === spell && o.layer === layer);
    const rest = (['symbol', 'spell'] as const).flatMap(layer => list.filter(spell => !isOrdered(spell, layer)).map(spell => ({ spell, layer })));
    return [...rest, ...ordered.reverse()].filter(({ spell, layer }) => !spell.hidden && (layer === 'symbol' ? show.symbols : show.spells));
  };

  /** This spell's (or symbol's) maximum opacity. */
  private getMaxOpacity = (spell: LogoSpell, layer: 'symbol' | 'spell'): number => layer === 'symbol'
    ? spell.symbolOpacity ?? LOGO_CONFIG.spells.symbolOpacity
    : spell.spellOpacity ?? LOGO_CONFIG.spells.spellOpacity;

  /**
   * Draws the scratch canvas (or its `rect`, at `ctx`'s origin) onto `ctx` at the spell's opacity: a
   * boosted spell over itself, the last time partly.
   */
  private composite = (ctx: CanvasRenderingContext2D, spell: LogoSpell, layer: 'symbol' | 'spell', rect?: Rect): void => {
    const maxOpacity = this.getMaxOpacity(spell, layer);
    const boost = layer === 'spell' ? Math.max(1, spell.spellBoost ?? 1) : 1;
    for (let k = 0; k < boost; k++) {
      ctx.globalAlpha = maxOpacity * Math.min(1, boost - k);
      if (rect) ctx.drawImage(this.scratch, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      else ctx.drawImage(this.scratch, 0, 0);
    }
    ctx.globalAlpha = 1;
  };

  /** Everything drawn afresh each frame: each on the whole scratch canvas, faded, then copied (the earlier way). */
  private renderLive = (ctx: CanvasRenderingContext2D, scratchCtx: CanvasRenderingContext2D, frame: LogoFrame, time: number, dt: number): void => {
    const { canvas } = ctx;
    this.getDrawOrder().forEach(({ spell, layer }) => {
      const state = this.getState(spell);
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.clearRect(0, 0, canvas.width, canvas.height);
      this.setSpellTransform(scratchCtx, spell, frame);
      const corners = this.getCorners(scratchCtx, spell);

      if (layer === 'symbol') {
        this.drawSymbolOutline(scratchCtx, spell, frame.pxPerUnit);
        this.spawnDust(scratchCtx, spell, state, frame.pxPerUnit, dt);
        this.drawDust(scratchCtx, state, dt);
      } else this.drawSpell(scratchCtx, spell, state, frame.pxPerUnit, time, dt);

      if (!(layer === 'spell' && spell.fadeSpell === false)) this.applyFade(scratchCtx, spell, layer, corners, frame);
      this.composite(ctx, spell, layer);
    });
  };

  /**
   * The spells and the symbols' outlines as drawn once (stills), the dust live: each symbol's dust is
   * drawn and faded only over the area it covers. Each spell brightens slowly in turn (still.pulse).
   */
  private renderStill = (ctx: CanvasRenderingContext2D, scratchCtx: CanvasRenderingContext2D, frame: LogoFrame, time: number, dt: number): void => {
    const { canvas } = ctx;
    const key = [canvas.width, canvas.height, frame.pxPerUnit, frame.origin.x, frame.origin.y, frame.wandCrossing.x, frame.wandCrossing.y, frame.radialCenter.x, frame.radialCenter.y].join();
    if (key !== this.stillsKey) {
      // New stills (e.g. the logo resized): the current ones stay shown until they're all drawn
      const next = new Map<string, Still>();
      this.drawingStills = this.drawStills(scratchCtx, frame, next);
      this.nextStills = { stills: next, frame };
      this.stillsKey = key;
    }
    // Drawn a little at a time, so the page never pauses
    const { drawMilliPerFrame, hiddenDrawMilliPerFrame } = LOGO_CONFIG.spells.still;
    const until = performance.now() + (this.isShown ? drawMilliPerFrame : hiddenDrawMilliPerFrame);
    while (this.drawingStills && performance.now() < until) {
      if (this.drawingStills.next().done) {
        this.drawingStills = null;
        if (this.nextStills) {
          this.stills = this.nextStills.stills;
          this.stillsFrame = this.nextStills.frame;
          this.nextStills = null;
        }
        this.tellReady();
      }
    }
    const { pulse, motion } = LOGO_CONFIG.spells.still;
    const spellNames = LOGO_CONFIG.spells.list.map(s => s.spellName);
    const seconds = time / 1000;
    // Stills drawn for an earlier size are scaled to this one (about the logo's origin) until replaced
    const drawnFor = this.stillsFrame ?? frame;
    const resize = frame.pxPerUnit / drawnFor.pxPerUnit;

    this.getDrawOrder().forEach(({ spell, layer }) => {
      const still = this.stills.get(`${spell.spellName}:${layer}`);
      // (a flipbook: its frames in turn, looping)
      const shown = still && still.frames[Math.floor(seconds / still.frameSeconds) % still.frames.length];
      ctx.save();
      ctx.setTransform(resize, 0, 0, resize, frame.origin.x - drawnFor.origin.x * resize, frame.origin.y - drawnFor.origin.y * resize);
      if (shown && layer === 'symbol') ctx.drawImage(shown.image, shown.rect.x, shown.rect.y, shown.rect.w, shown.rect.h);
      if (still && shown && layer === 'spell') {
        const phase = spellNames.indexOf(spell.spellName) / spellNames.length; // (the spells take turns)
        const move = motion[spell.spellName];
        const index = spellNames.indexOf(spell.spellName);
        const angle = 2 * Math.PI * (seconds / move.seconds + phase);
        // Its motion: two waves, so it doesn't tick like a metronome; with jitter, partly a new random
        // pose several times a second (a crackle)
        let wave = 0.65 * Math.sin(angle) + 0.35 * Math.sin(2.7 * angle + 1.1);
        let sideWave = 0.65 * Math.sin(angle + 1.7) + 0.35 * Math.sin(1.9 * angle);
        if (move.jitterPerSecond > 0) {
          const step = Math.floor(seconds * move.jitterPerSecond);
          wave = 0.4 * wave + 0.6 * random(step * 7 + index);
          sideWave = 0.4 * sideWave + 0.6 * random(step * 13 + index + 101);
        }
        const toRadians = Math.PI / 180;
        ctx.save();
        ctx.translate(still.pivot.x, still.pivot.y);
        const { orbit } = move;
        if (orbit.radiusX > 0 || orbit.radiusY > 0) {
          // Whirling in place (a Tasmanian devil): its base going round a small ellipse on the ground
          // (radiusX by radiusY), upright, its far end trailing a little, and a fast
          // wobble in its width, as if spinning
          const orbitAngle = 2 * Math.PI * (seconds / orbit.seconds + phase);
          ctx.translate(orbit.radiusX * drawnFor.pxPerUnit * Math.cos(orbitAngle), orbit.radiusY * drawnFor.pxPerUnit * Math.sin(orbitAngle));
          const sidewaysSpeed = -Math.sin(orbitAngle);
          ctx.transform(1, 0, -still.bodySign * Math.tan(orbit.lean * toRadians * sidewaysSpeed), 1, 0, 0);
          ctx.scale(1 + orbit.wobble * Math.sin(2 * Math.PI * seconds / orbit.wobbleSeconds), 1);
        }
        if (move.spinSeconds > 0) {
          // Spinning in its own plane (a ring seen at an angle): made round, turned, then flattened again
          ctx.scale(1, still.flatten);
          ctx.rotate(2 * Math.PI * seconds / move.spinSeconds);
          ctx.scale(1, 1 / still.flatten);
        }
        ctx.rotate(move.rotate * toRadians * sideWave);
        ctx.transform(1, 0, Math.tan(move.skew * toRadians * sideWave), 1, 0, 0);
        // Grows and shrinks, and squashes along its squashAngle (0: wider while shorter)
        ctx.rotate(move.squashAngle * toRadians);
        ctx.scale(1 + move.scale * wave + move.squash * wave, 1 + move.scale * wave - move.squash * wave);
        ctx.rotate(-move.squashAngle * toRadians);
        ctx.translate(-still.pivot.x, -still.pivot.y);
        ctx.drawImage(shown.image, shown.rect.x, shown.rect.y, shown.rect.w, shown.rect.h);
        if (pulse.amount > 0) {
          // The pulse: the spell drawn over itself, adding light
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = pulse.amount * (0.5 - 0.5 * Math.cos(2 * Math.PI * (seconds / pulse.seconds + phase)));
          ctx.drawImage(shown.image, shown.rect.x, shown.rect.y, shown.rect.w, shown.rect.h);
        }
        ctx.restore();
      }
      ctx.restore();
      if (layer !== 'symbol') return;

      // The symbol's dust: live, faded as the symbol is, drawn over just the area it covers
      const state = this.getState(spell);
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.setSpellTransform(scratchCtx, spell, frame);
      const corners = this.getCorners(scratchCtx, spell);
      this.spawnDust(scratchCtx, spell, state, frame.pxPerUnit, dt);
      const rect = this.getDustRect(state, canvas);
      if (!rect) {
        state.dust = state.dust.filter(d => (d.life -= dt) > 0);
        return;
      }
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.clearRect(rect.x, rect.y, rect.w, rect.h);
      this.drawDust(scratchCtx, state, dt);
      this.applyFade(scratchCtx, spell, layer, corners, frame, rect);
      ctx.save();
      ctx.translate(rect.x, rect.y);
      this.composite(ctx, spell, layer, rect);
      ctx.restore();
    });
  };

  /**
   * Draws each spell (its particles built up first) and each symbol's outline once, faded, into stills;
   * a spell with a flipbook (still.motion) is drawn that many times over its seconds, at its resolution,
   * its last frames blended into its first (blendFrames) so the loop joins smoothly. A step at a time:
   * it pauses after each frame (as the caller's time allows).
   */
  private *drawStills(scratchCtx: CanvasRenderingContext2D, frame: LogoFrame, into: Map<string, Still>): Generator<void> {
    const { canvas } = scratchCtx;
    const { atSeconds, warmUpSeconds, motion } = LOGO_CONFIG.spells.still;
    const stepSeconds = 1 / 60;
    const clearScratch = () => {
      scratchCtx.save();
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.clearRect(0, 0, canvas.width, canvas.height);
      scratchCtx.restore();
    };
    for (const { spell, layer } of this.getDrawOrder()) {
      const setTransform = () => {
        scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.setSpellTransform(scratchCtx, spell, frame);
      };
      clearScratch();
      setTransform();
      const corners = this.getCorners(scratchCtx, spell);
      // What it moves about: its center, or its base (a Gyre's narrow end: a GyreUp's bottom, a GyreDown's top)
      const move = motion[spell.spellName];
      const bodySign = move.pivot === 'base' ? (spell.spellName === 'GyreUp' ? -1 : 1) : 1;
      const baseOffset = move.pivot === 'base' ? -bodySign * spell.cells.h * spell.cellSize / 2 : 0;
      const center = scratchCtx.getTransform().transformPoint(new DOMPoint(spell.spellOffset?.x ?? 0, (spell.spellOffset?.y ?? 0) + baseOffset));
      const pivot = { x: center.x, y: center.y };
      // A Phlegm is a ring seen at an angle (drawPhlegm: radii 0.44 of its width, 0.34 of its height)
      const flatten = (0.34 * spell.cells.h) / (0.44 * spell.cells.w);
      const { flipbook } = move;
      const isFlipbook = layer === 'spell' && flipbook.frames > 1;
      const resolution = layer === 'spell' ? flipbook.resolution : 1;

      // Faded, then kept cropped: to what was drawn (the first frame; a flipbook's with room to spare)
      let rect: Rect | null = null;
      const capture = (): StillFrame | null => {
        if (!(layer === 'spell' && spell.fadeSpell === false)) this.applyFade(scratchCtx, spell, layer, corners, frame);
        rect ??= this.getDrawnRect(scratchCtx, isFlipbook ? flipbook.cropMargin : 0);
        if (!rect) return null;
        const image = document.createElement('canvas');
        image.width = Math.max(1, Math.round(rect.w * resolution));
        image.height = Math.max(1, Math.round(rect.h * resolution));
        const imageCtx = image.getContext('2d');
        if (!imageCtx) return null;
        imageCtx.scale(image.width / rect.w, image.height / rect.h);
        this.composite(imageCtx, spell, layer, rect);
        return { image, rect };
      };

      const frames: Array<StillFrame> = [];
      let frameSeconds = 1;
      if (layer === 'symbol') {
        this.drawSymbolOutline(scratchCtx, spell, frame.pxPerUnit);
        const still = capture();
        if (still) frames.push(still);
      } else {
        // Its particles, built up over warmUpSeconds (drawn, then cleared), then each frame, and the
        // frames past the end that are blended into the first
        const count = Math.max(1, flipbook.frames);
        const blendCount = isFlipbook ? Math.min(count - 1, flipbook.blendFrames) : 0;
        const start = flipbook.startSeconds ?? atSeconds;
        frameSeconds = flipbook.seconds / count;
        const stepsPerFrame = Math.max(1, Math.round(frameSeconds / stepSeconds));
        const state: SpellState = { particles: [], dust: [] };
        const warmUpSteps = Math.round(warmUpSeconds / stepSeconds);
        for (let k = warmUpSteps; k > 0; k--) this.drawSpell(scratchCtx, spell, state, frame.pxPerUnit, (start - k * stepSeconds) * 1000, stepSeconds);
        const captured: Array<StillFrame> = [];
        for (let f = 0; f < count + blendCount; f++) {
          // (the particles moving on between frames, drawn and cleared)
          setTransform();
          const frameStart = start + f * frameSeconds;
          if (f > 0) for (let k = stepsPerFrame - 1; k > 0; k--) this.drawSpell(scratchCtx, spell, state, frame.pxPerUnit, (frameStart - k * frameSeconds / stepsPerFrame) * 1000, frameSeconds / stepsPerFrame);
          clearScratch();
          this.drawSpell(scratchCtx, spell, state, frame.pxPerUnit, frameStart * 1000, frameSeconds / stepsPerFrame);
          const still = capture();
          if (still) captured.push(still);
          yield;
        }
        // The loop's join: its first frames fade in from the frames that follow its last (an even mix,
        // adding light, so nothing dims)
        for (let f = 0; f < count && f < captured.length; f++) {
          const after = captured[count + f];
          if (f < blendCount && after) {
            const mix = f / blendCount;
            const blendCtx = after.image.getContext('2d');
            if (blendCtx) {
              blendCtx.save();
              blendCtx.setTransform(1, 0, 0, 1, 0, 0); // (its own pixels: not the resolution's scale)
              blendCtx.globalCompositeOperation = 'copy';
              blendCtx.globalAlpha = 1 - mix;
              blendCtx.drawImage(after.image, 0, 0);
              blendCtx.globalCompositeOperation = 'lighter';
              blendCtx.globalAlpha = mix;
              blendCtx.drawImage(captured[f].image, 0, 0);
              blendCtx.restore();
              frames.push(after);
              continue;
            }
          }
          frames.push(captured[f]);
        }
      }
      if (frames.length) into.set(`${spell.spellName}:${layer}`, { frames, frameSeconds, pivot, flatten, bodySign });
      yield;
    }
  }

  /**
   * The area of the scratch canvas with anything drawn on it (device pixels), or null if none; with
   * `margin`, that much bigger on every side (a fraction of its size), within the canvas.
   */
  private getDrawnRect = (ctx: CanvasRenderingContext2D, margin: number = 0): Rect | null => {
    const { width, height } = ctx.canvas;
    // (read at a quarter of the size, which is plenty to find the edges, then padded by a cell of that)
    const step = 4;
    const small = document.createElement('canvas');
    small.width = Math.ceil(width / step);
    small.height = Math.ceil(height / step);
    const smallCtx = small.getContext('2d', { willReadFrequently: true });
    if (!smallCtx) return null;
    smallCtx.drawImage(ctx.canvas, 0, 0, small.width, small.height);
    const { data } = smallCtx.getImageData(0, 0, small.width, small.height);
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    for (let y = 0; y < small.height; y++) for (let x = 0; x < small.width; x++) {
      if (data[(y * small.width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (maxX < 0) return null;
    const padX = margin * (maxX - minX) * step, padY = margin * (maxY - minY) * step;
    const x = Math.max(0, Math.floor((minX - 1) * step - padX)), y = Math.max(0, Math.floor((minY - 1) * step - padY));
    return { x, y, w: Math.min(width, Math.ceil((maxX + 2) * step + padX)) - x, h: Math.min(height, Math.ceil((maxY + 2) * step + padY)) - y };
  };

  /** The area a symbol's dust covers (device pixels, with room for its glow), or null if it has none. */
  private getDustRect = (state: SpellState, canvas: HTMLCanvasElement): Rect | null => {
    if (!state.dust.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.dust.forEach(d => {
      const reach = d.size * 5;
      minX = Math.min(minX, d.x - reach);
      minY = Math.min(minY, d.y - reach);
      maxX = Math.max(maxX, d.x + reach);
      maxY = Math.max(maxY, d.y + reach);
    });
    const x = Math.max(0, Math.floor(minX)), y = Math.max(0, Math.floor(minY));
    const w = Math.min(canvas.width, Math.ceil(maxX)) - x, h = Math.min(canvas.height, Math.ceil(maxY)) - y;
    return w > 0 && h > 0 ? { x, y, w, h } : null;
  };

  private getState = (spell: LogoSpell): SpellState => {
    if (!this.states.has(spell)) this.states.set(spell, { particles: [], dust: [] });
    return this.states.get(spell)!;
  };

  /**
   * The spells group's transform, then the spell's: drawing is then in logo units, around its center.
   * The group's scale and spread move the spell; only itemScale resizes it.
   */
  private setSpellTransform = (ctx: CanvasRenderingContext2D, spell: LogoSpell, { pxPerUnit, origin }: LogoFrame): void => {
    const { transform: { x, y, scale, rotation }, spread, itemScale } = LOGO_CONFIG.spells;
    const anchor = { x: 50, y: LOGO_CONFIG.height / 2 };
    ctx.setTransform(pxPerUnit, 0, 0, pxPerUnit, origin.x, origin.y);
    ctx.translate(anchor.x + x, anchor.y + y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate((spell.x - anchor.x) * spread.x * scale, (spell.y - anchor.y) * spread.y * scale);
    ctx.rotate(spell.rotation * Math.PI / 180);
    ctx.scale(itemScale, itemScale);
  };

  /** The spell's box corners, in device pixels. */
  private getCorners = (ctx: CanvasRenderingContext2D, spell: LogoSpell): Array<Vec> => {
    const m = ctx.getTransform();
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const p = m.transformPoint(new DOMPoint(sx * spell.w / 2, sy * spell.h / 2));
      return { x: p.x, y: p.y };
    });
  };

  private getSymbolPoints = (spell: LogoSpell) => (HARDCODED_SYMBOLS_FOR_DISPLAY.get(spell.symbol) || []) as Array<{ x: number; y: number; moveTo?: boolean }>;

  /** The symbol, as drawn in the game's spellbook (gold, glowing). */
  private drawSymbolOutline = (ctx: CanvasRenderingContext2D, spell: LogoSpell, pxPerUnit: number): void => {
    const points = this.getSymbolPoints(spell);
    if (!points.length) return;
    const toBox = (p: { x: number; y: number }) => ({ x: (p.x - 0.5) * spell.w, y: (p.y - 0.5) * spell.h });
    const size = Math.min(spell.w, spell.h);

    ctx.save();
    ctx.lineWidth = size * LOGO_CONFIG.spells.symbolLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f7cb44';
    ctx.shadowBlur = size * LOGO_CONFIG.spells.symbolGlow * pxPerUnit; // (in pixels: the transform doesn't scale it)
    ctx.shadowColor = '#e8dfb9';
    ctx.beginPath();
    points.forEach((p, k) => {
      const { x, y } = toBox(p);
      if (k === 0 || p.moveTo) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  };

  /** New pixie dust, from random points along the symbol (`ctx` has the spell's transform), to drift down. */
  private spawnDust = (ctx: CanvasRenderingContext2D, spell: LogoSpell, state: SpellState, pxPerUnit: number, dt: number): void => {
    const points = this.getSymbolPoints(spell);
    if (!points.length) return;
    const toBox = (p: { x: number; y: number }) => ({ x: (p.x - 0.5) * spell.w, y: (p.y - 0.5) * spell.h });
    const m = ctx.getTransform();
    const segments = points.slice(1).map((p, k) => ({ a: toBox(points[k]), b: toBox(p), skip: !!p.moveTo }))
      .filter(s => !s.skip).map(s => ({ ...s, length: Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) }));
    const totalLength = segments.reduce((sum, s) => sum + s.length, 0);
    let toSpawn = LOGO_CONFIG.spells.pixieDustPerSecond * dt;
    while (totalLength > 0 && (toSpawn >= 1 || Math.random() < toSpawn)) {
      toSpawn -= 1;
      let along = Math.random() * totalLength;
      const segment = segments.find(s => (along -= s.length) <= 0) || segments[segments.length - 1];
      const t = Math.random();
      const point = m.transformPoint(new DOMPoint(segment.a.x + (segment.b.x - segment.a.x) * t, segment.a.y + (segment.b.y - segment.a.y) * t));
      const maxLife = 1.2 + Math.random() * 1.2;
      state.dust.push({
        x: point.x, y: point.y,
        vx: (Math.random() - 0.5) * 0.6 * pxPerUnit, vy: (0.5 + Math.random() * 1.1) * pxPerUnit,
        size: (0.08 + Math.random() * 0.22) * pxPerUnit, life: maxLife, maxLife,
        color: pixieColors[Math.floor(Math.random() * pixieColors.length)], isStar: Math.random() > 0.55,
      });
    }
  };

  /** The symbol's pixie dust, moved on by `dt` (in device pixels). */
  private drawDust = (ctx: CanvasRenderingContext2D, state: SpellState, dt: number): void => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.dust = state.dust.filter(d => (d.life -= dt) > 0);
    state.dust.forEach(d => {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const fade = d.life / d.maxLife;
      ctx.globalAlpha = fade * (0.6 + 0.4 * Math.sin(d.life * 12)); // twinkle
      ctx.fillStyle = d.color;
      ctx.shadowBlur = d.size * 2;
      ctx.shadowColor = d.color;
      if (d.isStar) draw4PointStar(ctx, d.x, d.y, d.size * 2, d.size * 0.4);
      else { ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2); ctx.fill(); }
    });
    ctx.restore();
  };

  /** The spell, animated as on the board, with its particles (in pixels, like the game). */
  private drawSpell = (ctx: CanvasRenderingContext2D, spell: LogoSpell, state: SpellState, pxPerUnit: number, time: number, dt: number): void => {
    const cellPx = spell.cellSize * pxPerUnit;
    const wPx = cellPx * spell.cells.w, hPx = cellPx * spell.cells.h;
    const standIn = {
      constructor: { spellName: spell.spellName },
      getPropertyValue: (property: string) =>
        property === 'widthCells' ? spell.cells.w : property === 'heightCells' ? spell.cells.h : property === 'speedDirection' ? spell.direction : 0,
    };
    ctx.save();
    if (spell.spellOffset) ctx.translate(spell.spellOffset.x, spell.spellOffset.y);
    if (spell.flipX) ctx.scale(-1, 1);
    ctx.scale(1 / pxPerUnit, 1 / pxPerUnit);
    ctx.translate(-wPx / 2, -hPx / 2);
    drawProceduralSpell(ctx, standIn, cellPx, cellPx, time, 1.0);
    spawnPreviewSpellParticles(spell.spellName, state.particles, wPx, hPx, time);
    updateAndDrawParticles(ctx, state.particles, dt);
    ctx.restore();
  };

  /**
   * Fades the symbol out (or the spell in) across its box, from the outside to the inside, over
   * LOGO_CONFIG.spells.fade.symbolOut (or .spellIn). With `rect`, only within it.
   */
  private applyFade = (ctx: CanvasRenderingContext2D, spell: LogoSpell, layer: 'symbol' | 'spell', corners: Array<Vec>, frame: LogoFrame, rect?: Rect): void => {
    const ranges = spell.fadeRanges ?? LOGO_CONFIG.spells.fade;
    const { start, end } = layer === 'symbol' ? ranges.symbolOut : ranges.spellIn;
    const center = { x: corners.reduce((s, c) => s + c.x, 0) / 4, y: corners.reduce((s, c) => s + c.y, 0) / 4 };
    let gradient: CanvasGradient;

    if (spell.fade === 'radial') {
      const c = { x: frame.origin.x + frame.radialCenter.x * frame.pxPerUnit, y: frame.origin.y + frame.radialCenter.y * frame.pxPerUnit };
      const distances = corners.map(p => Math.hypot(p.x - c.x, p.y - c.y));
      const inner = Math.max(0, Math.min(...distances)), outer = Math.max(...distances);
      gradient = ctx.createRadialGradient(c.x, c.y, inner, c.x, c.y, outer);
      // 0 is the inside here, so the stops are reversed
      const [inside, outside] = layer === 'symbol' ? [0, 1] : [1, 0];
      gradient.addColorStop(0, `rgba(0,0,0,${inside})`);
      gradient.addColorStop(1 - end, `rgba(0,0,0,${inside})`);
      gradient.addColorStop(1 - start, `rgba(0,0,0,${outside})`);
      gradient.addColorStop(1, `rgba(0,0,0,${outside})`);
    } else {
      // The direction from the outside in: toward the wands, or down
      const target = { x: frame.origin.x + frame.wandCrossing.x * frame.pxPerUnit, y: frame.origin.y + frame.wandCrossing.y * frame.pxPerUnit };
      const raw = spell.fade === 'towardWands' ? { x: target.x - center.x, y: target.y - center.y } : { x: 0, y: 1 };
      const length = Math.hypot(raw.x, raw.y) || 1;
      const d = { x: raw.x / length, y: raw.y / length };
      const projections = corners.map(p => (p.x - center.x) * d.x + (p.y - center.y) * d.y);
      const from = Math.min(...projections), to = Math.max(...projections);
      gradient = ctx.createLinearGradient(center.x + d.x * from, center.y + d.y * from, center.x + d.x * to, center.y + d.y * to);
      const [outside, inside] = layer === 'symbol' ? [1, 0] : [0, 1];
      gradient.addColorStop(0, `rgba(0,0,0,${outside})`);
      gradient.addColorStop(start, `rgba(0,0,0,${outside})`);
      gradient.addColorStop(end, `rgba(0,0,0,${inside})`);
      gradient.addColorStop(1, `rgba(0,0,0,${inside})`);
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = gradient;
    if (rect) ctx.fillRect(rect.x, rect.y, rect.w, rect.h); // (only there: the rest of the canvas isn't used)
    else ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  };
}

// --- Sparks where the wands cross ----------------------------------------------------------------

type Spark = { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; color: string };
const SPARK_COLORS = ['#fff7c2', '#ffe53b', '#ffffff', '#ffd27a'];

/** Sparks at `crossing` (device pixels), more when the struggle is fiercer (`intensity`, 0 to 1). */
export class CrossingSparks {
  private sparks: Array<Spark> = [];

  render = (ctx: CanvasRenderingContext2D, crossing: Vec | null, intensity: number, pxPerUnit: number, dt: number): void => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    let toSpawn = crossing ? LOGO_CONFIG.struggle.sparksPerSecond * (0.4 + intensity * 1.6) * dt : 0;
    while (crossing && (toSpawn >= 1 || Math.random() < toSpawn)) {
      toSpawn -= 1;
      const angle = Math.random() * Math.PI * 2, speed = (1 + Math.random() * 4) * pxPerUnit;
      const maxLife = 0.25 + Math.random() * 0.45;
      this.sparks.push({
        x: crossing.x, y: crossing.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - pxPerUnit,
        size: (0.06 + Math.random() * 0.14) * pxPerUnit, life: maxLife, maxLife,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
      });
    }
    this.sparks = this.sparks.filter(s => (s.life -= dt) > 0);
    this.sparks.forEach(s => {
      s.vy += 6 * pxPerUnit * dt; // they fall
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      ctx.globalAlpha = s.life / s.maxLife;
      ctx.fillStyle = s.color;
      ctx.shadowBlur = s.size * 3;
      ctx.shadowColor = s.color;
      draw4PointStar(ctx, s.x, s.y, s.size * 2, s.size * 0.5);
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  };
}
