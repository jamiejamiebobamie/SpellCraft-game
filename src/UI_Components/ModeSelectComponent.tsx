// ModeSelectComponent.tsx
// After Play: choose "1 Player" (the duel against the NPC, as before) or "2 Players" (a match with a
// friend, by an invite link). Two large framed plaques, each brightening on hover.
import styled, { keyframes } from 'styled-components';

/**
 * The choices' look. iconStyle: 'users' (the 👤 / 👥 icons), 'wizards' (the 🧙 emoji: one, or two
 * overlapping like 👥) or 'silhouettes' (wizards drawn in the game's gold, the same on every device).
 * titlePlace: the title 'above' the choices, 'below' them (clear of the clock's halo, behind the top), or
 * in the 'topLeft' corner (titleInset: from the corner, cqw). choicesDown: the choices moved down from the
 * middle (cqw). dim: a soft darkening of the scene behind them, so the title and choices lead rather than
 * the clock (0: none, 1: black).
 * choiceScale: the choices' size (1: as first made, 21cqw wide); titleSize: the title's (cqw; was 4.4).
 * titleUnderline: a thin line under the title (isOn), broken in two by the letter breakAt (its tail
 * crossing the line); thickness and drop (below the text's box bottom, negative: up) in cqw.
 */
export const MODE_SELECT = {
  iconStyle: 'silhouettes' as 'users' | 'wizards' | 'silhouettes',
  title: 'Choose Your Duel',
  titlePlace: 'topLeft' as 'above' | 'below' | 'topLeft',
  titleInset: { x: 4.5, y: 7 },
  choicesDown: 1,
  dim: 1,
  choiceScale: 1.6,
  titleSize: 7,
  titleUnderline: { isOn: true, breakAt: 'Y', thickness: 0.1, drop: -.95 },
  fadeInSeconds: 0.6,
  hoverMotion: 'press' as 'press' | 'rise', // (a choice on hover: pressed in, its shadow tighter; or lifted)
};

// The choice's hover motion and shadow (MODE_SELECT.hoverMotion)
const HOVER_MOTION = MODE_SELECT.hoverMotion === 'press'
  ? { shift: 0.35, shadow: '0 0.3cqw 1cqw rgba(0, 0, 0, 0.7)', rest: '0 1cqw 3cqw rgba(0, 0, 0, 0.6)' }
  : { shift: -0.3, shadow: '0 1.4cqw 3.5cqw rgba(0, 0, 0, 0.65)', rest: '0 1cqw 3cqw rgba(0, 0, 0, 0.6)' };

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(1cqw); }
  to { opacity: 1; transform: translateY(0); }
`;

const Screen = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3cqw;
  padding-top: ${7 + MODE_SELECT.choicesDown * 2}cqw; /* (clear of the clock and its halo, above; then moved down) */
  box-sizing: border-box;
  animation: ${fadeIn} ${MODE_SELECT.fadeInSeconds}s ease-out both;
  /* the dimming: darkest in the middle, behind the choices, fading toward the edges */
  background: radial-gradient(ellipse 70% 75% at 50% 55%, rgba(0, 0, 0, ${MODE_SELECT.dim}) 0%, rgba(0, 0, 0, ${MODE_SELECT.dim * 0.6}) 60%, rgba(0, 0, 0, ${MODE_SELECT.dim * 0.35}) 100%);
`;

const GOLD = '#e6c563', GOLD_BRIGHT = '#fff1b8', GOLD_DEEP = '#a9822e';
// (the inner frame and its diamonds: a matte, muted black-brown; its hover a shade lighter)
const FRAME_MATTE = '#2b2119', FRAME_MATTE_HOVER = '#3d2f23';
// (metallic gold: bright at the top, deep at the bottom; the labels and the ornaments)
const GOLD_GRADIENT = `linear-gradient(180deg, ${GOLD_BRIGHT} 0%, ${GOLD} 45%, ${GOLD_DEEP} 100%)`;
/**
 * The title's gold: lit by a rising sun just above the "oo" of "Choose" (sun: its place in the title's box,
 * %; x along, y down: above the letters' middle, as if a second "oo" sat on them), deepening away from it.
 */
const TITLE_SUN = { x: 25, y: 20 };
const TITLE_GRADIENT = `radial-gradient(circle at ${TITLE_SUN.x}% ${TITLE_SUN.y}%, ${GOLD_BRIGHT} 0%, ${GOLD} 35%, ${GOLD_DEEP} 100%)`;
/** The underline's gold at a point along it (%): brightest beneath the sun, deeper away from it. */
const getUnderlineGold = (at: number) => `color-mix(in srgb, ${GOLD_BRIGHT} ${Math.max(0, 85 - Math.abs(at - TITLE_SUN.x) * 0.85)}%, ${GOLD_DEEP})`;

const Title = styled.div`
  position: relative;
  isolation: isolate; /* (the sfumato behind the lettering, not the scene) */
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${MODE_SELECT.titleSize}cqw;
  ${MODE_SELECT.titlePlace === 'topLeft' && `position: absolute; left: ${MODE_SELECT.titleInset.x}cqw; top: ${MODE_SELECT.titleInset.y}cqw;`}
`;

/**
 * The title's lettering: the gold (TITLE_GRADIENT) showing through the letters, with a soft gold glow and a
 * shadow beneath (a filter: a text-shadow would muddy the gold).
 */
const TitleLettering = styled.span`
  position: relative;
  background: ${TITLE_GRADIENT};
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 1.2cqw rgba(230, 197, 99, 0.3)) drop-shadow(0 0.2cqw 0.35cqw rgba(0, 0, 0, 0.85));
`;

/**
 * A stretch of the title with the underline beneath it (the letter it breaks at has none): the line's gold
 * brightest beneath the sun, continuing across both stretches ($from, $to: where along it this stretch
 * begins and ends, %).
 */
const Underlined = styled.span<{ $from: number; $to: number }>`
  background: linear-gradient(90deg, ${props => [props.$from, ...(props.$from < TITLE_SUN.x && TITLE_SUN.x < props.$to ? [TITLE_SUN.x] : []), props.$to]
    .map(at => `${getUnderlineGold(at)} ${(at - props.$from) / (props.$to - props.$from) * 100}%`).join(', ')}) no-repeat;
  background-size: 100% ${MODE_SELECT.titleUnderline.thickness}cqw;
  background-position: 0 calc(100% - ${-MODE_SELECT.titleUnderline.drop}cqw);
`;

/**
 * The darkness behind the title, sfumato: soft dark strokes (brushed sideways by a noise, then blurred), so
 * the title reads over the hall. Larger than the title (inset, cqw), behind it.
 */
const SFUMATO = { inset: { x: -8, y: -5 }, opacity: 1 };
const SfumatoSvg = styled.svg`
  position: absolute;
  left: ${SFUMATO.inset.x}cqw;
  right: ${SFUMATO.inset.x}cqw;
  top: ${SFUMATO.inset.y}cqw;
  bottom: ${SFUMATO.inset.y}cqw;
  width: calc(100% - ${2 * SFUMATO.inset.x}cqw);
  height: calc(100% - ${2 * SFUMATO.inset.y}cqw);
  z-index: -1;
  opacity: ${SFUMATO.opacity};
  pointer-events: none;
  overflow: visible;
`;
const TitleSfumato = () => (
  <SfumatoSvg viewBox='0 0 400 120' preserveAspectRatio='none' aria-hidden='true'>
    <defs>
      <radialGradient id='sfumato-dark'>
        <stop offset='0%' stopColor='#000' stopOpacity='1' />
        <stop offset='60%' stopColor='#000' stopOpacity='0.9' />
        <stop offset='100%' stopColor='#000' stopOpacity='0' />
      </radialGradient>
      {/* (the strokes' edges roughened sideways, like a dry brush, then softened) */}
      <filter id='sfumato-brush' x='-20%' y='-50%' width='140%' height='200%'>
        <feTurbulence type='fractalNoise' baseFrequency='0.012 0.11' numOctaves='3' seed='7' result='noise' />
        <feDisplacementMap in='SourceGraphic' in2='noise' scale='34' xChannelSelector='R' yChannelSelector='G' result='brushed' />
        <feGaussianBlur in='brushed' stdDeviation='4.5' />
      </filter>
    </defs>
    <g filter='url(#sfumato-brush)'>
      <ellipse cx='200' cy='62' rx='190' ry='46' fill='url(#sfumato-dark)' />
      <ellipse cx='150' cy='46' rx='150' ry='24' fill='url(#sfumato-dark)' opacity='0.75' />
      <ellipse cx='255' cy='78' rx='145' ry='20' fill='url(#sfumato-dark)' opacity='0.7' />
      <ellipse cx='90' cy='66' rx='85' ry='30' fill='url(#sfumato-dark)' opacity='0.6' />
    </g>
  </SfumatoSvg>
);

/** The title, underlined if titleUnderline.isOn: the line broken in two at its breakAt letter. */
const TitleText = () => {
  const { title, titleUnderline } = MODE_SELECT;
  const at = title.indexOf(titleUnderline.breakAt);
  const lettering = (() => {
    if (!titleUnderline.isOn) return <>{title}</>;
    if (at < 0) return <Underlined $from={0} $to={100}>{title}</Underlined>;
    // (the line's gold continuing across the break: each stretch its share, by its letters)
    const split = Math.round(at / title.length * 100);
    return <><Underlined $from={0} $to={split}>{title.slice(0, at)}</Underlined>{title[at]}<Underlined $from={split} $to={100}>{title.slice(at + 1)}</Underlined></>;
  })();
  return <><TitleSfumato /><TitleLettering>{lettering}</TitleLettering></>;
};

const Choices = styled.div`
  display: flex;
  gap: ${4 * MODE_SELECT.choiceScale}cqw;
`;


// The light sweeping across a choice on hover
const sheen = keyframes`
  from { transform: translateX(-120%) skewX(-18deg); }
  to { transform: translateX(320%) skewX(-18deg); }
`;

/**
 * A choice: a framed plaque (an outer gold edge, a fine inner frame with a diamond at each corner), dark
 * and deep (a warm glow behind the icon, an inner shadow, a faint top highlight); on hover its gold
 * brightens and a light sweeps across it.
 */
const Choice = styled.button`
  position: relative;
  overflow: hidden;
  width: ${21 * MODE_SELECT.choiceScale}cqw;
  aspect-ratio: 1 / 1.08;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${1.1 * MODE_SELECT.choiceScale}cqw;
  background:
    radial-gradient(ellipse 60% 45% at 50% 40%, rgba(255, 205, 110, 0.13), rgba(255, 205, 110, 0) 70%),
    linear-gradient(180deg, rgba(34, 27, 15, 0.92) 0%, rgba(14, 11, 7, 0.95) 100%);
  border: 0.16cqw solid rgba(230, 197, 99, 0.7);
  border-radius: 0.8cqw;
  box-shadow: ${HOVER_MOTION.rest}, inset 0 0 3cqw rgba(0, 0, 0, 0.65), inset 0 0.12cqw 0 rgba(255, 240, 200, 0.14);
  color: ${GOLD};
  cursor: pointer;
  transition: border-color 0.25s, box-shadow 0.25s, transform 0.2s, background 0.25s;

  /* the inner frame */
  .frame {
    position: absolute;
    inset: ${0.9 * MODE_SELECT.choiceScale}cqw;
    border: 0.12cqw solid ${FRAME_MATTE};
    border-radius: 0.35cqw;
    pointer-events: none;
    transition: border-color 0.25s;
  }
  /* a diamond at each of its corners */
  .frame i {
    position: absolute;
    width: 0.75cqw;
    height: 0.75cqw;
    background: ${FRAME_MATTE};
    transform: translate(-50%, -50%) rotate(45deg);
    transition: background 0.25s;
  }
  .frame i:nth-child(1) { left: 0; top: 0; }
  .frame i:nth-child(2) { left: 100%; top: 0; }
  .frame i:nth-child(3) { left: 0; top: 100%; }
  .frame i:nth-child(4) { left: 100%; top: 100%; }

  /* the sweeping light (hover) */
  &::after {
    content: '';
    position: absolute;
    top: -10%;
    bottom: -10%;
    left: 0;
    width: 35%;
    background: linear-gradient(90deg, rgba(255, 240, 200, 0), rgba(255, 240, 200, 0.13), rgba(255, 240, 200, 0));
    transform: translateX(-120%) skewX(-18deg);
    pointer-events: none;
  }

  .icon {
    position: relative;
    height: ${9 * MODE_SELECT.choiceScale}cqw;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: filter 0.25s, transform 0.25s;
    filter: drop-shadow(0 0.3cqw 0.5cqw rgba(0, 0, 0, 0.7));
  }
  /* the ornament between the icon and the label: a line, a diamond, a line */
  .divider {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.8cqw;
    width: ${10 * MODE_SELECT.choiceScale}cqw;
    opacity: 0.85;
  }
  .divider::before, .divider::after {
    content: '';
    flex: 1;
    height: 0.1cqw;
  }
  .divider::before { background: linear-gradient(90deg, rgba(230, 197, 99, 0), ${GOLD}); }
  .divider::after { background: linear-gradient(90deg, ${GOLD}, rgba(230, 197, 99, 0)); }
  .divider i {
    width: 0.6cqw;
    height: 0.6cqw;
    background: ${GOLD_GRADIENT};
    transform: rotate(45deg);
  }
  .label {
    position: relative;
    font-family: 'EnchantedLand', sans-serif;
    font-size: ${3.4 * MODE_SELECT.choiceScale}cqw;
    line-height: 1.1;
    letter-spacing: 0.04em;
    background: ${GOLD_GRADIENT};
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 0.25cqw 0.35cqw rgba(0, 0, 0, 0.8));
    transition: filter 0.25s;
  }

  /* Hover: the gold brightens, the glow grows, a light sweeps across */
  &:hover, &:focus-visible {
    outline: none;
    border-color: ${GOLD_BRIGHT};
    background:
      radial-gradient(ellipse 65% 50% at 50% 40%, rgba(255, 205, 110, 0.24), rgba(255, 205, 110, 0) 70%),
      linear-gradient(180deg, rgba(42, 33, 18, 0.94) 0%, rgba(16, 12, 7, 0.95) 100%);
    box-shadow: ${HOVER_MOTION.shadow}, 0 0 2.2cqw rgba(255, 220, 130, 0.35), inset 0 0 3cqw rgba(0, 0, 0, 0.55), inset 0 0.12cqw 0 rgba(255, 240, 200, 0.22);
    transform: translateY(${HOVER_MOTION.shift}cqw);
  }
  &:hover::after, &:focus-visible::after { animation: ${sheen} 0.9s ease-out 1; }
  &:hover .frame, &:focus-visible .frame { border-color: ${FRAME_MATTE_HOVER}; }
  &:hover .frame i, &:focus-visible .frame i { background: ${FRAME_MATTE_HOVER}; }
  &:hover .icon, &:focus-visible .icon {
    filter: brightness(1.2) drop-shadow(0 0 0.9cqw rgba(255, 225, 140, 0.6));
    transform: scale(1.04);
  }
  &:hover .label, &:focus-visible .label { filter: brightness(1.15) drop-shadow(0 0 0.7cqw rgba(255, 225, 140, 0.45)); }
`;

const Emoji = styled.span<{ $size: number }>`
  font-size: ${props => props.$size}cqw;
  line-height: 1;
`;

/** Two emoji wizards, one behind the other, read as one group (like 👥). */
const EmojiPair = styled.span`
  position: relative;
  width: 10cqw;
  height: 9cqw;
  span { position: absolute; font-size: 6.6cqw; line-height: 1; }
  span:first-child { right: 0; top: 0; opacity: 0.8; transform: scale(0.88); }
  span:last-child { left: 0; bottom: 0; }
`;

/** A wizard drawn in gold (fill: currentColor, or a gradient's url): pointed hat, brim, face and robe. */
const WizardSilhouette = ({ x = 0, y = 0, scale = 1, opacity = 1, fill = 'currentColor' }: { x?: number; y?: number; scale?: number; opacity?: number; fill?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
    <path d="M33 2 C30 9 27 16 21 27 L45 27 C40 20 36 13 33 2 Z" fill={fill} />
    <ellipse cx="33" cy="27.5" rx="15" ry="3.2" fill={fill} />
    <circle cx="33" cy="34" r="5.6" fill={fill} />
    <path d="M17 64 C18 50 24 41 33 40.5 C42 41 48 50 49 64 Z" fill={fill} />
  </g>
);

const ModeIcon = ({ players }: { players: 1 | 2 }) => {
  if (MODE_SELECT.iconStyle === 'users') return <Emoji $size={8}>{players === 1 ? '👤' : '👥'}</Emoji>;
  if (MODE_SELECT.iconStyle === 'wizards') {
    return players === 1 ? <Emoji $size={8}>🧙</Emoji> : <EmojiPair><span>🧙</span><span>🧙</span></EmojiPair>;
  }
  // (a second, smaller wizard behind and to the right, a little faded: one group, as in 👥)
  return (
    <svg viewBox="0 0 80 66" style={{ height: `${9 * MODE_SELECT.choiceScale}cqw`, overflow: 'visible' }} aria-hidden="true">
      <defs>
        <linearGradient id={`mode-gold-${players}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD_BRIGHT} />
          <stop offset="45%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
      </defs>
      {players === 1
        ? <WizardSilhouette x={7} fill={`url(#mode-gold-${players})`} />
        : <><WizardSilhouette x={24} y={2} scale={0.88} opacity={0.6} fill={`url(#mode-gold-${players})`} /><WizardSilhouette x={-2} y={2} fill={`url(#mode-gold-${players})`} /></>}
    </svg>
  );
};

/** A choice's inner frame, a diamond at each corner. */
const ChoiceFrame = () => <span className="frame" aria-hidden="true"><i /><i /><i /><i /></span>;

type ModeSelectProps = { onSinglePlayer: () => void; onTwoPlayers: () => void };

export default function ModeSelectComponent({ onSinglePlayer, onTwoPlayers }: ModeSelectProps) {
  return (
    <Screen>
      {MODE_SELECT.titlePlace !== 'below' && <Title><TitleText /></Title>}
      <Choices>
        {/* (2 Players on the left, 1 Player on the right) */}
        <Choice onClick={onTwoPlayers}>
          <ChoiceFrame />
          <span className="icon"><ModeIcon players={2} /></span>
          <span className="divider"><i /></span>
          <span className="label">2 Players</span>
        </Choice>
        <Choice onClick={onSinglePlayer}>
          <ChoiceFrame />
          <span className="icon"><ModeIcon players={1} /></span>
          <span className="divider"><i /></span>
          <span className="label">1 Player</span>
        </Choice>
      </Choices>
      {MODE_SELECT.titlePlace === 'below' && <Title><TitleText /></Title>}
    </Screen>
  );
}
