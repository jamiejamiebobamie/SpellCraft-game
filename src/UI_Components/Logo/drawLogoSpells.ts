// drawLogoSpells.ts
// The logo's symbols and spells (a canvas under the duelists): each symbol is drawn on the outside
// and fades into its animated spell on the inside, plus pixie dust falling from the symbols and
// sparks where the wands cross (a canvas over the duelists).
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

export class LogoSpellsRenderer {
  private scratch = document.createElement('canvas');
  private states = new Map<LogoSpell, SpellState>();

  /** Draws the symbols and spells back to front (LOGO_CONFIG.spells.layerOrder), at `time` (ms; `dt` in s). */
  render = (ctx: CanvasRenderingContext2D, frame: LogoFrame, time: number, dt: number): void => {
    const { canvas } = ctx;
    if (this.scratch.width !== canvas.width || this.scratch.height !== canvas.height) {
      this.scratch.width = canvas.width;
      this.scratch.height = canvas.height;
    }
    const scratchCtx = this.scratch.getContext('2d');
    if (!scratchCtx) return;
    const { list, layerOrder, symbolOpacity, spellOpacity } = LOGO_CONFIG.spells;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Back to front: anything not in layerOrder first, then layerOrder reversed
    const ordered = layerOrder.flatMap(([name, layer]) => list.filter(s => s.spellName === name).map(spell => ({ spell, layer })));
    const isOrdered = (spell: LogoSpell, layer: string) => ordered.some(o => o.spell === spell && o.layer === layer);
    const rest = (['symbol', 'spell'] as const).flatMap(layer => list.filter(spell => !isOrdered(spell, layer)).map(spell => ({ spell, layer })));
    const { show } = LOGO_CONFIG.spells;
    [...rest, ...ordered.reverse()].forEach(({ spell, layer }) => {
      if (spell.hidden || !(layer === 'symbol' ? show.symbols : show.spells)) return;
      const opacity = layer === 'symbol' ? symbolOpacity : spellOpacity;
      const state = this.getState(spell);
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.clearRect(0, 0, canvas.width, canvas.height);
      this.setSpellTransform(scratchCtx, spell, frame);
      const corners = this.getCorners(scratchCtx, spell);

      if (layer === 'symbol') this.drawSymbol(scratchCtx, spell, state, frame.pxPerUnit, dt);
      else this.drawSpell(scratchCtx, spell, state, frame.pxPerUnit, time, dt);

      if (!(layer === 'spell' && spell.fadeSpell === false)) this.applyFade(scratchCtx, spell, layer, corners, frame);
      // Each spell's own maximum opacity, if set; a boosted spell is drawn over itself (the last time partly)
      const maxOpacity = (layer === 'symbol' ? spell.symbolOpacity : spell.spellOpacity) ?? opacity;
      const boost = layer === 'spell' ? Math.max(1, spell.spellBoost ?? 1) : 1;
      for (let k = 0; k < boost; k++) {
        ctx.globalAlpha = maxOpacity * Math.min(1, boost - k);
        ctx.drawImage(this.scratch, 0, 0);
      }
      ctx.globalAlpha = 1;
    });
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

  /** The symbol, as drawn in the game's spellbook (gold, glowing), with pixie dust falling from it. */
  private drawSymbol = (ctx: CanvasRenderingContext2D, spell: LogoSpell, state: SpellState, pxPerUnit: number, dt: number): void => {
    const points = (HARDCODED_SYMBOLS_FOR_DISPLAY.get(spell.symbol) || []) as Array<{ x: number; y: number; moveTo?: boolean }>;
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

    // Pixie dust: from random points along the symbol, drifting down (in device pixels)
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
   * LOGO_CONFIG.spells.fade.symbolOut (or .spellIn).
   */
  private applyFade = (ctx: CanvasRenderingContext2D, spell: LogoSpell, layer: 'symbol' | 'spell', corners: Array<Vec>, frame: LogoFrame): void => {
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
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
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
