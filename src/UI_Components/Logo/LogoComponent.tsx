// LogoComponent.tsx
// The loading screen's logo: two duelists locked wand to wand, in front of the spells (each symbol
// fading into its spell), in front of the clock, with "SpellCraft" across the front. Adjust it all
// in logoConfig.ts. Inside the logo, 1cqw = 1 logo unit (100 units = its width).
import { useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { LOGO_CONFIG, GroupTransform, Aura } from './logoConfig';
import { FRAME_SIZE, LEAN_PIVOT, Vec, getDuelPose, getRestCrossing } from './duelMath';
import { CrossingSparks, LogoSpellsRenderer } from './drawLogoSpells';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const LogoRoot = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 100 / ${LOGO_CONFIG.height};
  container-type: inline-size;
  pointer-events: none;
  user-select: none;
  animation: ${fadeIn} 1.5s ease-out;
`;

const Layer = styled.div<{ $z: number }>`
  position: absolute;
  inset: 0;
  z-index: ${props => props.$z};
`;

/** A canvas reaching LOGO_CONFIG.canvasMargin past the logo's box on every side. */
const CanvasLayer = styled.canvas<{ $z: number }>`
  position: absolute;
  left: ${-LOGO_CONFIG.canvasMargin.x}cqw;
  top: ${-LOGO_CONFIG.canvasMargin.y}cqw;
  width: ${100 + 2 * LOGO_CONFIG.canvasMargin.x}cqw;
  height: ${LOGO_CONFIG.height + 2 * LOGO_CONFIG.canvasMargin.y}cqw;
  z-index: ${props => props.$z};
`;

/** CSS for an Aura: a thin drop-shadow outline, then wider, fainter ones fading outward. */
const auraFilter = (aura: Aura): string => {
  if (!aura) return 'none';
  return Array.from({ length: 1 + Math.max(0, aura.layers) }, (_, k) =>
    `drop-shadow(0 0 ${aura.size * aura.growth ** k}cqw rgba(${aura.rgb}, ${aura.opacity * aura.falloff ** k}))`).join(' ');
};

/** A group's transform, anchored at (x, y) in logo units. */
const groupStyle = ({ x, y, scale, rotation }: GroupTransform): React.CSSProperties => ({
  position: 'absolute',
  left: `${x}cqw`,
  top: `${y}cqw`,
  transformOrigin: '0 0',
  transform: `rotate(${rotation}deg) scale(${scale})`,
});

/** From a group's units into logo units. */
const fromGroup = (p: Vec, { x, y, scale, rotation }: GroupTransform): Vec => {
  const c = Math.cos(rotation * Math.PI / 180), s = Math.sin(rotation * Math.PI / 180);
  return { x: x + scale * (p.x * c - p.y * s), y: y + scale * (p.x * s + p.y * c) };
};

// --- The clock -----------------------------------------------------------------------------------

/** One of the clock's images, positioned around the face's center (as in ClockFaceComponent). */
const ClockImg = styled.div<{ $src: string; $left: number; $top: number; $width: number; $aspect: string; $z: number }>`
  position: absolute;
  left: ${props => props.$left}cqw;
  top: ${props => props.$top}cqw;
  width: ${props => props.$width}cqw;
  aspect-ratio: ${props => props.$aspect};
  z-index: ${props => props.$z};
  background: url(${props => props.$src}) center / cover no-repeat;
`;

const ClockFace = styled.svg`
  position: absolute;
  left: -4.5cqw;
  top: -4.5cqw;
  width: 9cqw;
  height: 9cqw;
  z-index: 4;
  filter: drop-shadow(0 0 0.5cqw rgba(255, 255, 255, 0.6));
`;

type HandRefs = { hour: SVGLineElement | null; minute: SVGLineElement | null; second: SVGLineElement | null };

const LogoClock = ({ handRefs, clockRef }: { handRefs: React.MutableRefObject<HandRefs>; clockRef: React.MutableRefObject<HTMLDivElement | null> }) => {
  const { variant, transform, brightness } = LOGO_CONFIG.clock;
  if (variant === 'none') return null;
  // 'scene': placed by alignToSceneClock (hidden until then)
  const placement = variant === 'scene' ? { ...groupStyle({ x: 0, y: 0, scale: 1, rotation: 0 }), visibility: 'hidden' as const } : groupStyle(transform);
  return (
    <div ref={clockRef} style={{ ...placement, filter: `brightness(${brightness})` }}>
      {(variant === 'body' || (variant === 'scene' && LOGO_CONFIG.clock.sceneWithBody)) && <>
        {/* Offsets from the face's center: ClockFaceComponent's, less the face's 5cqw */}
        <ClockImg $src='background-scene/Clock/Clock-body.png' $left={-10.9} $top={-9.1} $width={21.8} $aspect='260/390' $z={3} />
        <ClockImg $src='background-scene/Clock/Clock-inside-back.png' $left={-6.5} $top={0} $width={13} $aspect='120/171' $z={1} />
        <ClockImg $src='background-scene/Clock/Clock-left-chime.png' $left={-4} $top={1.9} $width={3} $aspect='33/119' $z={2} />
        <ClockImg $src='background-scene/Clock/Clock-right-chime.png' $left={0.5} $top={-0.1} $width={3.3} $aspect='38/161' $z={2} />
      </>}
      <ClockFace viewBox='0 0 100 100'>
        <circle cx='50' cy='50' r='48' fill='#F1E9D2' stroke='#917d41' strokeWidth='4' />
        <circle cx='50' cy='50' r='46' fill='#F1E9D2' stroke='#e5c667' strokeWidth='4' />
        {[...Array(12)].map((_, i) => (
          <line key={i} x1='50' y1='8' x2='50' y2='14' stroke='#c0a657' strokeWidth='3' strokeLinecap='round' transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <line ref={el => { handRefs.current.hour = el; }} x1='50' y1='50' x2='50' y2='28' stroke='#917d41' strokeWidth='5' strokeLinecap='round' />
        <line ref={el => { handRefs.current.minute = el; }} x1='50' y1='50' x2='50' y2='16' stroke='#917d41' strokeWidth='3.5' strokeLinecap='round' />
        <line ref={el => { handRefs.current.second = el; }} x1='50' y1='58' x2='50' y2='12' stroke='#a33a2a' strokeWidth='1.5' strokeLinecap='round' />
        <circle cx='50' cy='50' r='4' fill='#917d41' />
      </ClockFace>
    </div>
  );
};

/** Puts the logo's clock face exactly over the background scene's (variant 'scene'). */
const alignToSceneClock = (clock: HTMLDivElement, root: HTMLDivElement): void => {
  const sceneFace = document.querySelector('[data-scene-clock-face]');
  if (!sceneFace) return;
  const face = sceneFace.getBoundingClientRect(), logo = root.getBoundingClientRect();
  if (!face.width || !logo.width) return;
  const toUnits = 100 / logo.width; // the logo's face is 9 units wide at scale 1
  clock.style.left = `${(face.left + face.width / 2 - logo.left) * toUnits}cqw`;
  clock.style.top = `${(face.top + face.height / 2 - logo.top) * toUnits}cqw`;
  clock.style.transform = `scale(${face.width * toUnits / 9})`;
  clock.style.visibility = 'visible';
};

/** Sets the clock's hands: startTime plus `seconds`, ticking once a second. */
const setClockHands = (hands: HandRefs, seconds: number) => {
  const { hours, minutes, seconds: startSeconds } = LOGO_CONFIG.clock.startTime;
  const total = hours * 3600 + minutes * 60 + startSeconds + Math.floor(seconds);
  const angles = { second: (total % 60) * 6, minute: (total % 3600) / 10, hour: (total % 43200) / 120 };
  (['hour', 'minute', 'second'] as const).forEach(hand => hands[hand]?.setAttribute('transform', `rotate(${angles[hand]} 50 50)`));
};

// --- The duelists --------------------------------------------------------------------------------

/** An avatar part (positions and pivots as in CharacterParts.tsx); `$angle` is a CSS variable. */
const Part = styled.div<{ $src: string; $left: number; $top: number; $width: number; $aspect: string; $origin: string; $transform?: string; $z?: number }>`
  position: absolute;
  left: ${props => props.$left}cqw;
  top: ${props => props.$top}cqw;
  width: ${props => props.$width}cqw;
  aspect-ratio: ${props => props.$aspect};
  transform-origin: ${props => props.$origin};
  ${props => props.$transform && `transform: ${props.$transform};`}
  ${props => props.$z !== undefined && `z-index: ${props.$z};`}
  transform-style: preserve-3d;
  background: url(${props => props.$src}) center / cover no-repeat;
`;

const AVATAR_IMAGES = [
  { robe: './player_avatars/Robe1a.png', head: './player_avatars/Head1.png', bicep: './player_avatars/Bicep1.png' },
  { robe: './player_avatars/Robe2a.png', head: './player_avatars/Head2.png', bicep: './player_avatars/Bicep2.png' },
];

/** One duelist (side 1: the player on the left; -1: the opponent, mirrored). Posed by CSS variables. */
const Duelist = ({ side, sideRef }: { side: 1 | -1; sideRef: (el: HTMLDivElement | null) => void }) => {
  const images = AVATAR_IMAGES[side === 1 ? 0 : 1];
  const frameLeft = -side * LOGO_CONFIG.avatars.spacing - FRAME_SIZE / 2; // the player on the left
  const pivotX = side === 1 ? LEAN_PIVOT.x : FRAME_SIZE - LEAN_PIVOT.x;
  return (
    <div ref={sideRef} style={{
      position: 'absolute', left: `${frameLeft}cqw`, top: 0, width: `${FRAME_SIZE}cqw`, height: `${FRAME_SIZE}cqw`,
      transformOrigin: `${pivotX}cqw ${LEAN_PIVOT.y}cqw`, transform: 'rotate(var(--lean, 0deg))',
    }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scaleX(${side})` }}>
        <Part $src={images.robe} $left={2.4} $top={7.75} $width={13} $aspect='544/657' $origin='bottom center'>
          <Part $src={images.head} $left={3.5} $top={-7.5} $width={4.5} $aspect='186/411' $origin='bottom center' $z={2}
            $transform='translateZ(-1px) rotate(var(--head, 0deg))' />
          <Part $src='./player_avatars/RightArm.png' $left={-2} $top={5.5} $width={4} $aspect='168/215' $origin='top left' $z={-1}
            $transform='translateZ(-1px) rotate(var(--free, 0deg))' />
          <Part $src={images.bicep} $left={6.6} $top={0} $width={6.05} $aspect='255/149' $origin='.75cqw 1.5cqw'
            $transform='rotate(var(--shoulder, 0deg))'>
            <Part $src='./player_avatars/Forearm.png' $left={4} $top={0.1} $width={3.3} $aspect='150/80' $origin='1cqw 1.5cqw'
              $transform='translateZ(-1px) rotate(var(--elbow, 0deg))'>
              <Part $src='./player_avatars/WandHand.png' $left={2.5} $top={-0.5} $width={7.8} $aspect='320/101' $origin='.2cqw .8cqw' $z={2}
                $transform='rotate(var(--wrist, 0deg))' />
            </Part>
          </Part>
        </Part>
      </div>
    </div>
  );
};

const DuelLayer = styled(Layer)`
  /* Below the waist, the duelists fade out behind the title */
  mask-image: linear-gradient(to bottom, black ${LOGO_CONFIG.avatars.fadeOut.start * 100}%, transparent ${LOGO_CONFIG.avatars.fadeOut.end * 100}%);
  -webkit-mask-image: linear-gradient(to bottom, black ${LOGO_CONFIG.avatars.fadeOut.start * 100}%, transparent ${LOGO_CONFIG.avatars.fadeOut.end * 100}%);
  /* The aura (on this unscaled layer, so its size is in logo units; faded out with the rest) */
  filter: ${auraFilter(LOGO_CONFIG.avatars.aura)};
`;

// --- The title -----------------------------------------------------------------------------------

/** A gradient stop ('#rrggbb 40%') with its color scaled by `brightness`. */
const scaleStop = (stop: string, brightness: number): string => stop.replace(/#([0-9a-f]{6})/i, (_, hex: string) =>
  '#' + [0, 2, 4].map(k => Math.min(255, Math.round(parseInt(hex.slice(k, k + 2), 16) * brightness)).toString(16).padStart(2, '0')).join(''));

/** The title's sheen: its gradient (with the darker ends over it) painted inside the letters. */
const titleGradientCss = (): string => {
  const { gradient } = LOGO_CONFIG.title;
  if (!gradient) return '';
  const shade = `rgba(90, 50, 5, ${gradient.endShade})`;
  return `
    background: linear-gradient(90deg, ${shade} 0%, transparent 20%, transparent 80%, ${shade} 100%),
      linear-gradient(${gradient.angle}deg, ${gradient.stops.map(stop => scaleStop(stop, gradient.brightness)).join(', ')});
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  `;
};

const Title = styled.div`
  position: absolute;
  left: ${LOGO_CONFIG.title.x}cqw;
  top: ${LOGO_CONFIG.title.y}cqw;
  transform: translate(-50%, -50%);
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${LOGO_CONFIG.title.size}cqw;
  line-height: 1;
  white-space: nowrap;
  color: ${LOGO_CONFIG.title.color};
  ${titleGradientCss()}
  -webkit-text-stroke: 0.12cqw ${LOGO_CONFIG.title.outline};
  /* The glow and drop shadow are drop-shadows (not text-shadow, which would show through the gradient) */
  filter: drop-shadow(0 0 0.6cqw ${LOGO_CONFIG.title.glow}) drop-shadow(0 0.3cqw 0.3cqw rgba(0, 0, 0, 0.8))
    ${LOGO_CONFIG.title.aura ? auraFilter(LOGO_CONFIG.title.aura) : ''};
`;

// --- The logo ------------------------------------------------------------------------------------

export default function LogoComponent() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const spellsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sideRefs = useRef<Array<HTMLDivElement | null>>([null, null]);
  const handRefs = useRef<HandRefs>({ hour: null, minute: null, second: null });
  const clockRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current, spellsCanvas = spellsCanvasRef.current, sparksCanvas = sparksCanvasRef.current;
    const spellsCtx = spellsCanvas?.getContext('2d'), sparksCtx = sparksCanvas?.getContext('2d');
    if (!root || !spellsCanvas || !sparksCanvas || !spellsCtx || !sparksCtx) return;

    // Canvases at their size in device pixels (the logo's, plus canvasMargin)
    const margin = LOGO_CONFIG.canvasMargin;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(root.clientWidth * (100 + 2 * margin.x) / 100 * dpr);
      const height = Math.round(root.clientWidth * (LOGO_CONFIG.height + 2 * margin.y) / 100 * dpr);
      [spellsCanvas, sparksCanvas].forEach(canvas => { canvas.width = width; canvas.height = height; });
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    resize();

    const avatarsTransform = LOGO_CONFIG.avatars.transform;
    const wandCrossing = fromGroup(getRestCrossing(), avatarsTransform);
    const radialCenter = LOGO_CONFIG.spells.fade.radialCenter ?? fromGroup({ x: 0, y: LEAN_PIVOT.y }, avatarsTransform);
    const spells = new LogoSpellsRenderer();
    const sparks = new CrossingSparks();

    const start = performance.now();
    let last = start, frameId = 0, frameCount = 0;
    const animate = (now: number) => {
      // Follow the scene's clock (a few times a second: the page can resize or still be settling)
      if (LOGO_CONFIG.clock.variant === 'scene' && clockRef.current && frameCount++ % 15 === 0) alignToSceneClock(clockRef.current, root);
      const seconds = (now - start) / 1000, dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const pxPerUnit = spellsCanvas.width / (100 + 2 * margin.x);
      const origin = { x: margin.x * pxPerUnit, y: margin.y * pxPerUnit }; // where the logo's (0, 0) is on the canvases

      const pose = getDuelPose(seconds);
      pose.sides.forEach((side, k) => {
        const style = sideRefs.current[k]?.style;
        if (!style) return;
        style.setProperty('--lean', `${side.lean}deg`);
        style.setProperty('--shoulder', `${side.arm.shoulder}deg`);
        style.setProperty('--elbow', `${side.arm.elbow}deg`);
        style.setProperty('--wrist', `${side.arm.wrist}deg`);
        style.setProperty('--free', `${side.freeArm}deg`);
        style.setProperty('--head', `${side.head}deg`);
      });
      setClockHands(handRefs.current, seconds);
      spells.render(spellsCtx, { pxPerUnit, origin, wandCrossing, radialCenter }, now, dt);
      const crossing = pose.crossing && fromGroup(pose.crossing, avatarsTransform);
      sparks.render(sparksCtx, crossing && { x: origin.x + crossing.x * pxPerUnit, y: origin.y + crossing.y * pxPerUnit }, pose.intensity, pxPerUnit, dt);

      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <LogoRoot ref={rootRef}>
      <Layer $z={1}><LogoClock handRefs={handRefs} clockRef={clockRef} /></Layer>
      <CanvasLayer $z={2} ref={spellsCanvasRef} />
      <DuelLayer $z={3}>
        <div style={groupStyle(LOGO_CONFIG.avatars.transform)}>
          <Duelist side={1} sideRef={el => { sideRefs.current[0] = el; }} />
          <Duelist side={-1} sideRef={el => { sideRefs.current[1] = el; }} />
        </div>
      </DuelLayer>
      <CanvasLayer $z={4} ref={sparksCanvasRef} />
      <Layer $z={5}><Title>{LOGO_CONFIG.title.text}</Title></Layer>
    </LogoRoot>
  );
}
