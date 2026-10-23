// ModeSelectComponent.tsx
// After Play: choose "1 Player" (the duel against the NPC, as before) or "2 Players" (a match with a
// friend, by an invite link). Two large framed choices, each brightening on hover.
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
  titleInset: { x: 4, y: 5.5 },
  choicesDown: 1,
  dim: 1,
  choiceScale: 1.7,
  titleSize: 7,
  titleUnderline: { isOn: true, breakAt: 'Y', thickness: 0.1, drop: -0.75 },
  fadeInSeconds: 0.6,
};

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

const Title = styled.div`
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${MODE_SELECT.titleSize}cqw;
  color: #e6c563;
  text-shadow: 0 0 1.2cqw rgba(230, 197, 99, 0.35), 0 0.2cqw 0.4cqw rgba(0, 0, 0, 0.8);
  ${MODE_SELECT.titlePlace === 'topLeft' && `position: absolute; left: ${MODE_SELECT.titleInset.x}cqw; top: ${MODE_SELECT.titleInset.y}cqw;`}
`;

/** A stretch of the title with the underline beneath it (the letter it breaks at has none). */
const Underlined = styled.span`
  background: linear-gradient(currentColor, currentColor) no-repeat;
  background-size: 100% ${MODE_SELECT.titleUnderline.thickness}cqw;
  background-position: 0 calc(100% - ${-MODE_SELECT.titleUnderline.drop}cqw);
`;

/** The title, underlined if titleUnderline.isOn: the line broken in two at its breakAt letter. */
const TitleText = () => {
  const { title, titleUnderline } = MODE_SELECT;
  const at = title.indexOf(titleUnderline.breakAt);
  if (!titleUnderline.isOn) return <>{title}</>;
  if (at < 0) return <Underlined>{title}</Underlined>;
  return <><Underlined>{title.slice(0, at)}</Underlined>{title[at]}<Underlined>{title.slice(at + 1)}</Underlined></>;
};

const Choices = styled.div`
  display: flex;
  gap: ${4 * MODE_SELECT.choiceScale}cqw;
`;

const GOLD = '#e6c563', GOLD_BRIGHT = '#fff1b8';

const Choice = styled.button`
  width: ${21 * MODE_SELECT.choiceScale}cqw;
  aspect-ratio: 1 / 1.08;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${1.6 * MODE_SELECT.choiceScale}cqw;
  background: rgba(20, 16, 10, 0.55);
  border: 0.22cqw solid rgba(230, 197, 99, 0.55);
  border-radius: 1.2cqw;
  box-shadow: 0 1cqw 3cqw rgba(0, 0, 0, 0.6);
  color: ${GOLD};
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, color 0.2s, transform 0.2s, background 0.2s;

  .icon {
    height: ${9 * MODE_SELECT.choiceScale}cqw;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: filter 0.2s, transform 0.2s;
    filter: drop-shadow(0 0 0 rgba(255, 225, 140, 0));
  }
  .label {
    font-family: 'EnchantedLand', sans-serif;
    font-size: ${3.4 * MODE_SELECT.choiceScale}cqw;
    line-height: 1;
  }

  /* Hover: the frame, the icon and the label light up */
  &:hover, &:focus-visible {
    outline: none;
    color: ${GOLD_BRIGHT};
    border-color: ${GOLD_BRIGHT};
    background: rgba(40, 32, 16, 0.6);
    box-shadow: 0 1cqw 3cqw rgba(0, 0, 0, 0.6), 0 0 2cqw rgba(255, 220, 130, 0.45), inset 0 0 1.5cqw rgba(255, 220, 130, 0.15);
    transform: translateY(-0.3cqw);
  }
  &:hover .icon, &:focus-visible .icon {
    filter: brightness(1.3) drop-shadow(0 0 0.8cqw rgba(255, 225, 140, 0.8));
    transform: scale(1.05);
  }
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

/** A wizard drawn in gold (currentColor): pointed hat, brim, face and robe. */
const WizardSilhouette = ({ x = 0, y = 0, scale = 1, opacity = 1 }: { x?: number; y?: number; scale?: number; opacity?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
    <path d="M33 2 C30 9 27 16 21 27 L45 27 C40 20 36 13 33 2 Z" fill="currentColor" />
    <ellipse cx="33" cy="27.5" rx="15" ry="3.2" fill="currentColor" />
    <circle cx="33" cy="34" r="5.6" fill="currentColor" />
    <path d="M17 64 C18 50 24 41 33 40.5 C42 41 48 50 49 64 Z" fill="currentColor" />
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
      {players === 1
        ? <WizardSilhouette x={7} />
        : <><WizardSilhouette x={24} y={2} scale={0.88} opacity={0.6} /><WizardSilhouette x={-2} y={2} /></>}
    </svg>
  );
};

type ModeSelectProps = { onSinglePlayer: () => void; onTwoPlayers: () => void };

export default function ModeSelectComponent({ onSinglePlayer, onTwoPlayers }: ModeSelectProps) {
  return (
    <Screen>
      {MODE_SELECT.titlePlace !== 'below' && <Title><TitleText /></Title>}
      <Choices>
        {/* (2 Players on the left, 1 Player on the right) */}
        <Choice onClick={onTwoPlayers}>
          <span className="icon"><ModeIcon players={2} /></span>
          <span className="label">2 Players</span>
        </Choice>
        <Choice onClick={onSinglePlayer}>
          <span className="icon"><ModeIcon players={1} /></span>
          <span className="label">1 Player</span>
        </Choice>
      </Choices>
      {MODE_SELECT.titlePlace === 'below' && <Title><TitleText /></Title>}
    </Screen>
  );
}
