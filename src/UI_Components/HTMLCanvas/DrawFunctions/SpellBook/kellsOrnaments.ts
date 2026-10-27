// kellsOrnaments.ts
// Book of Kells style illumination for the Spell Book's page (drawModalDetails): a mottled vellum
// page, a border of interlaced knotwork (two cords weaving over and under each other), triskele
// spirals in the corners, and an illuminated capital in a lapis panel ringed with red dots, the
// manuscript's signature contour.

/** The manuscript's pigments. */
export const KELLS = {
  vellum: ['#efe0b9', '#e2cd98', '#d4bb80'], // light to aged
  ink: '#1c140c',
  lapis: '#2f4f8f', // blue
  verdigris: '#4e8a6e', // green
  orpiment: '#e2b13c', // yellow
  vermilion: '#b8382c', // red
  dots: '#a8322a', // the red contour dots
};

// --- The page ---------------------------------------------------------------------------------

/** A tile of faint mottling for the vellum, made once (seeded, so it never flickers). */
let mottleTile: HTMLCanvasElement | null = null;
const getMottleTile = (): HTMLCanvasElement => {
  if (mottleTile) return mottleTile;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 256;
  const t = tile.getContext('2d')!;
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let k = 0; k < 900; k++) {
    const x = random() * 256, y = random() * 256, r = 2 + random() * 14;
    const glow = t.createRadialGradient(x, y, 0, x, y, r);
    const isDark = random() < 0.55;
    glow.addColorStop(0, isDark ? `rgba(120, 85, 40, ${0.05 + random() * 0.06})` : `rgba(255, 245, 215, ${0.05 + random() * 0.07})`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    t.fillStyle = glow;
    t.fillRect(x - r, y - r, r * 2, r * 2);
  }
  mottleTile = tile;
  return tile;
};

/** The vellum page: warm, mottled, its edges aged darker. */
export const drawVellum = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void => {
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius);
  else ctx.rect(x, y, w, h);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 16;
  const base = ctx.createLinearGradient(x, y, x + w, y + h);
  base.addColorStop(0, KELLS.vellum[0]);
  base.addColorStop(0.6, KELLS.vellum[1]);
  base.addColorStop(1, KELLS.vellum[2]);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.clip();
  // Mottling
  const pattern = ctx.createPattern(getMottleTile(), 'repeat');
  if (pattern) { ctx.fillStyle = pattern; ctx.fillRect(x, y, w, h); }
  // Aged edges
  const age = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  age.addColorStop(0, 'rgba(90, 55, 20, 0)');
  age.addColorStop(1, 'rgba(90, 55, 20, 0.35)');
  ctx.fillStyle = age;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
};

// --- Knotwork ---------------------------------------------------------------------------------

/**
 * One cord's segments along a straight run from (x0, y0) to (x1, y1): it waves across the band
 * (`phase` 0 or PI for the two cords), and each half-wave is marked over or under.
 */
const cordSegments = (x0: number, y0: number, x1: number, y1: number, amplitude: number, waves: number, phase: number) => {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / length, uy = (y1 - y0) / length; // along the run
  const nx = -uy, ny = ux; // across it
  const steps = Math.max(24, Math.round(waves * 16));
  const points = Array.from({ length: steps + 1 }, (_, k) => {
    const s = k / steps;
    const offset = Math.sin(s * waves * Math.PI * 2 + phase) * amplitude;
    return { x: x0 + ux * length * s + nx * offset, y: y0 + uy * length * s + ny * offset, s };
  });
  // Crossings are where both cords meet (offset 0): every half-wave; over and under alternate
  return points.slice(1).map((p, k) => {
    const prev = points[k];
    const halfWave = Math.floor(((prev.s + p.s) / 2) * waves * 2);
    return { a: prev, b: p, isOver: (halfWave + (phase === 0 ? 0 : 1)) % 2 === 0 };
  });
};

/** Strokes cord segments as a colored cord with an ink outline. */
const strokeCord = (ctx: CanvasRenderingContext2D, segments: ReturnType<typeof cordSegments>, width: number, color: string) => {
  ctx.lineCap = 'round';
  [[KELLS.ink, width + width * 0.7], [color, width]].forEach(([style, lineWidth]) => {
    ctx.strokeStyle = style as string;
    ctx.lineWidth = lineWidth as number;
    ctx.beginPath();
    segments.forEach(({ a, b }) => { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); });
    ctx.stroke();
  });
};

/**
 * A band of interlaced knotwork around a rectangle: two cords weaving along each side, crossing over
 * and under in turn (the "over" half-waves are drawn last, so they lie on top).
 */
export const drawKnotworkBorder = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, band: number): void => {
  const inset = band / 2;
  const amplitude = band * 0.32, cordWidth = band * 0.22, waveLength = band * 2.2;
  const sides: Array<[number, number, number, number]> = [
    [x + band, y + inset, x + w - band, y + inset], // top
    [x + w - inset, y + band, x + w - inset, y + h - band], // right
    [x + w - band, y + h - inset, x + band, y + h - inset], // bottom
    [x + inset, y + h - band, x + inset, y + band], // left
  ];
  ctx.save();
  // The band's ground: a thin ink frame on each edge
  ctx.strokeStyle = KELLS.ink;
  ctx.lineWidth = Math.max(1, band * 0.08);
  ctx.strokeRect(x, y, w, h);
  ctx.strokeRect(x + band, y + band, w - band * 2, h - band * 2);
  sides.forEach(([x0, y0, x1, y1], side) => {
    const waves = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / waveLength));
    const cordA = cordSegments(x0, y0, x1, y1, amplitude, waves, 0);
    const cordB = cordSegments(x0, y0, x1, y1, amplitude, waves, Math.PI);
    const colorA = side % 2 === 0 ? KELLS.lapis : KELLS.verdigris;
    const colorB = side % 2 === 0 ? KELLS.orpiment : KELLS.vermilion;
    // Under first, then over: each cord passes over the other every other crossing
    strokeCord(ctx, cordA.filter(s => !s.isOver), cordWidth, colorA);
    strokeCord(ctx, cordB.filter(s => !s.isOver), cordWidth, colorB);
    strokeCord(ctx, cordA.filter(s => s.isOver), cordWidth, colorA);
    strokeCord(ctx, cordB.filter(s => s.isOver), cordWidth, colorB);
  });
  ctx.restore();
};

/** A triskele: three spirals turning out from one center, in a roundel, for the border's corners. */
export const drawTriskele = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, rotation: number = 0): void => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  // The roundel
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = KELLS.orpiment;
  ctx.fill();
  ctx.lineWidth = radius * 0.12;
  ctx.strokeStyle = KELLS.ink;
  ctx.stroke();
  // Three spiral arms, each in its own pigment
  [KELLS.lapis, KELLS.vermilion, KELLS.verdigris].forEach((color, arm) => {
    ctx.save();
    ctx.rotate((arm * Math.PI * 2) / 3);
    ctx.beginPath();
    const turns = 1.6, steps = 40;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const angle = t * turns * Math.PI * 2;
      const r = radius * 0.78 * t;
      const px = Math.cos(angle) * r * 0.55, py = -radius * 0.42 + Math.sin(angle) * r * 0.55;
      if (k === 0) ctx.moveTo(0, 0); else ctx.lineTo(px, py);
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = radius * 0.22;
    ctx.strokeStyle = KELLS.ink;
    ctx.stroke();
    ctx.lineWidth = radius * 0.13;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();
};

// --- The capital ------------------------------------------------------------------------------

/** A ring of red contour dots around a rectangle, the Book of Kells' signature outline. */
export const drawDotContour = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, spacing: number, dotRadius: number): void => {
  ctx.save();
  ctx.fillStyle = KELLS.dots;
  const dotsAlong = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / spacing));
    for (let k = 0; k < n; k++) {
      ctx.beginPath();
      ctx.arc(x0 + (x1 - x0) * (k / n), y0 + (y1 - y0) * (k / n), dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  dotsAlong(x, y, x + w, y);
  dotsAlong(x + w, y, x + w, y + h);
  dotsAlong(x + w, y + h, x, y + h);
  dotsAlong(x, y + h, x, y);
  ctx.restore();
};

/**
 * An illuminated capital: the letter in orpiment with an ink outline and the spell's own color as a
 * glow, on a lapis panel with a knot-tinted frame, ringed with red dots. (x, y): the panel's top left.
 * Returns the panel's width.
 */
export const drawIlluminatedCapital = (ctx: CanvasRenderingContext2D, letter: string, x: number, y: number, size: number, accent: string, font: string): number => {
  const panel = size * 1.15;
  ctx.save();
  // The red dot contour, just outside the panel
  const dotGap = size * 0.07;
  drawDotContour(ctx, x - dotGap, y - dotGap, panel + dotGap * 2, panel + dotGap * 2, size * 0.075, size * 0.022);
  // The lapis panel, with a vermilion and orpiment frame
  ctx.fillStyle = KELLS.lapis;
  ctx.fillRect(x, y, panel, panel);
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = KELLS.vermilion;
  ctx.strokeRect(x, y, panel, panel);
  ctx.lineWidth = size * 0.025;
  ctx.strokeStyle = KELLS.orpiment;
  ctx.strokeRect(x + size * 0.05, y + size * 0.05, panel - size * 0.1, panel - size * 0.1);
  // Tiny knot dots in the panel's corners
  ctx.fillStyle = KELLS.orpiment;
  [[0.16, 0.16], [0.84, 0.16], [0.16, 0.84], [0.84, 0.84]].forEach(([fx, fy]) => {
    ctx.beginPath();
    ctx.arc(x + panel * fx, y + panel * fy, size * 0.035, 0, Math.PI * 2);
    ctx.fill();
  });
  // The letter: the spell's color as a glow, an ink outline, orpiment fill
  ctx.font = `bold ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lx = x + panel / 2, ly = y + panel * 0.54;
  ctx.shadowColor = accent;
  ctx.shadowBlur = size * 0.25;
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.08;
  ctx.strokeStyle = KELLS.ink;
  ctx.strokeText(letter, lx, ly);
  ctx.shadowBlur = 0;
  ctx.fillStyle = KELLS.orpiment;
  ctx.fillText(letter, lx, ly);
  ctx.restore();
  return panel;
};

// --- Margin notes -----------------------------------------------------------------------------

/** The quill hand of the notes scribbled in the margins (QuillHand, in index.css). */
const QUILL_FONT = "'QuillHand', cursive";
/**
 * Loads the quill font ahead of time (a canvas only draws with a font once it's loaded). Ready once its
 * load has finished, or once the browser says so: asked about the face alone, as Safari can go on
 * answering no for a list ending in a generic family ('cursive'), and the notes never showed.
 */
let quillFontState: 'unrequested' | 'loading' | 'ready' = 'unrequested';
export const getIsQuillFontReady = (): boolean => {
  if (typeof document === 'undefined' || !document.fonts) return false;
  if (quillFontState === 'ready') return true;
  if (quillFontState === 'unrequested') {
    quillFontState = 'loading';
    document.fonts.load("20px 'QuillHand'").then(faces => { if (faces.length > 0) quillFontState = 'ready'; }).catch(() => { });
  }
  if (document.fonts.check("20px 'QuillHand'")) quillFontState = 'ready';
  return quillFontState === 'ready';
};

/**
 * A note scribbled in the margin by some earlier owner of the book: brown ink in a quick hand, tilted
 * by `tilt` (radians), centered on (x, y) (its lines split at \n), with a wobbly underline unless `underline` is
 * false, and an `arrow` to its right if given (two shafts, wide apart, under one caret). Skipped until the font has loaded.
 */
export const drawMarginNote = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, tilt: number, { underline = true, arrow }: { underline?: boolean; arrow?: 'up' | 'down' } = {}): void => {
  if (!getIsQuillFontReady()) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.font = `${size}px ${QUILL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(48, 26, 10, 0.92)'; // iron-gall ink, browned with age
  const lines = text.split('\n'), lineHeight = size * 1.2;
  ctx.translate(0, -(lines.length - 1) * lineHeight / 2);
  lines.forEach((line, k) => ctx.fillText(line, 0, k * lineHeight));
  ctx.translate(0, (lines.length - 1) * lineHeight);
  // (the underline and arrow go by the last line)
  const halfW = ctx.measureText(lines[lines.length - 1]).width / 2;
  ctx.strokeStyle = 'rgba(48, 26, 10, 0.75)';
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (arrow) {
    // Two shafts (wide apart), under a single caret at the end they point to
    // (as tall as the capitals: from the baseline to their tops)
    const left = halfW + size * 0.45, right = left + size * 0.42, middle = (left + right) / 2;
    const tip = arrow === 'up' ? -size * 0.95 : size * 0.12, tail = arrow === 'up' ? size * 0.12 : -size * 0.95;
    const toward = Math.sign(tip - tail), caretH = size * 0.42, flare = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(left, tail); ctx.lineTo(left, tip - toward * caretH * 0.55);
    ctx.moveTo(right, tail); ctx.lineTo(right, tip - toward * caretH * 0.55);
    ctx.moveTo(left - flare, tip - toward * caretH); ctx.lineTo(middle, tip); ctx.lineTo(right + flare, tip - toward * caretH);
    ctx.stroke();
  }
  if (!underline) { ctx.restore(); return; }
  // The underline: one quick stroke, wobbling a little (the same wobble every frame)
  ctx.beginPath();
  const underY = size * 0.45, steps = 12;
  for (let k = 0; k <= steps; k++) {
    const u = k / steps;
    const px = -halfW * 0.95 + halfW * 1.9 * u;
    const py = underY + Math.sin(u * 7 + text.length) * size * 0.06 + u * size * 0.12;
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
};

// --- The whole page, cached -------------------------------------------------------------------

/** The page's frame (vellum, knotwork border, triskeles) never changes, so it's drawn once per size and reused. */
let pageCache: { key: string; canvas: HTMLCanvasElement; pad: number } | null = null;

/** The page (x, y, w, h), its band of knotwork `band` wide: drawn from a cached image after the first frame. */
export const drawKellsPage = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, band: number, radius: number): void => {
  const dpr = ctx.getTransform().a || 1; // the canvas' scale (device pixels per drawing unit)
  const key = `${Math.round(w)}x${Math.round(h)}:${band.toFixed(2)}@${dpr}`;
  if (pageCache?.key !== key) {
    const pad = 24; // room for the page's shadow
    const canvas = pageCache?.canvas ?? document.createElement('canvas');
    canvas.width = Math.ceil((w + pad * 2) * dpr);
    canvas.height = Math.ceil((h + pad * 2) * dpr);
    const page = canvas.getContext('2d')!;
    page.setTransform(dpr, 0, 0, dpr, pad * dpr, pad * dpr);
    page.clearRect(-pad, -pad, w + pad * 2, h + pad * 2);
    drawVellum(page, 0, 0, w, h, radius);
    const inset = band * 0.3;
    drawKnotworkBorder(page, inset, inset, w - inset * 2, h - inset * 2, band);
    const knotR = band * 0.95;
    const k0 = inset + band / 2, kx1 = w - inset - band / 2, ky1 = h - inset - band / 2;
    drawTriskele(page, k0, k0, knotR, 0);
    drawTriskele(page, kx1, k0, knotR, Math.PI / 2);
    drawTriskele(page, kx1, ky1, knotR, Math.PI);
    drawTriskele(page, k0, ky1, knotR, Math.PI * 1.5);
    pageCache = { key, canvas, pad };
  }
  const { canvas, pad } = pageCache;
  ctx.drawImage(canvas, x - pad, y - pad, w + pad * 2, h + pad * 2);
};

/** Starts loading the quill font ahead of time (so the first notes don't wait for it). */
export const prewarmQuillFont = (): void => { getIsQuillFontReady(); };
