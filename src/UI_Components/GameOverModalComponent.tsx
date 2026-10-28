import React, { useLayoutEffect, useRef, useState } from 'react';
import { MASK_VORTEX, MaskVortex } from './MaskVortex';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled, { css, keyframes } from 'styled-components';
import { GameOverStatus } from '../DataClasses/types'; // Update paths based on your actual structure
import { getTitleGold, titleLetteringCss } from './Logo/titleLettering';
import { GoldButton, GoldDivider } from './goldStyle';

// --- Configuration Content Maps ---
interface ModalTextConfig {
  title: string;
  text: string;
  fontSize: number;
  isPlayAgainOwnLine?: boolean; // "Play again?" on its own line, below (for a long ending)
  secondLine?: string; // (with isPlayAgainOwnLine) a sentence starting that line, before "Play again?"
}

// Assuming your 4th state "Caught by Teacher" maps to a status key or string fallback
// (fontSize, cqw: each ending's line, with "Play again?" after it, on one line)
const MODAL_CONTENT_MAP: Record<string, ModalTextConfig> = {
  [GameOverStatus.BothDead]: {
    title: 'A Draw',
    text: "The match ends in a draw.",
    fontSize: 3.6
  },
  [GameOverStatus.PlayerWon]: {
    title: 'You Won',
    text: 'You won!',
    fontSize: 3.6
  },
  [GameOverStatus.NpcWon]: {
    title: 'You Lost',
    text: 'You lost...',
    fontSize: 3.6
  },
  // Caught by a teacher (the weaker wizard; both, if even)
  [GameOverStatus.TimesUp]: {
    title: 'Teacher!',
    text: 'A teacher caught you both out of bed after curfew.',
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
  [GameOverStatus.CaughtPlayer]: {
    title: 'You Lost', // (caught: the rival got away, so they won)
    text: 'Too weary to flee, you were caught by a teacher.',
    secondLine: 'Your rival slipped away...',
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
  [GameOverStatus.EnemyFled]: {
    title: 'Enemy Fled',
    text: 'Your rival fled.',
    fontSize: 3.6,
  },
  [GameOverStatus.OutOfStep]: {
    title: 'Out of Step',
    text: "Your spells and your rival's no longer match up: the duel can't go on fairly.",
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
  [GameOverStatus.CaughtNpc]: {
    title: 'You Won', // (the rival was caught: you got away)
    text: 'A teacher caught your rival, too weary to flee.',
    secondLine: 'You slipped away...',
    fontSize: 3.2,
    isPlayAgainOwnLine: true,
  },
};

const MIN_OPACITY = 0, MAX_OPACITY = .85, TRANSITION_TIME_SEC = 1.5;
/** The card fading in: after delaySeconds (the game over), over seconds (Overlay's transition). PlayerComponent follows it. */
export const CARD_FADE_IN = { delaySeconds: TRANSITION_TIME_SEC, seconds: 0.5 };

// --- Styled Component Architectures ---

// Fiddle with the \$bgOpacity parameter inside your wrapper implementation to adjust view shading
const ModalDimOverlay = styled.div<{ $isDisplay: boolean; $bgOpacity: number }>`
  display: flex;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  padding: 4cqw;
  box-sizing: border-box;
  z-index: 10000; /* Layered slightly over your LoadingOverlay (9999) */

  opacity: ${props => props.$isDisplay ? 1 : 0};
  pointer-events: ${props => props.$isDisplay ? 'auto' : 'none'};
  
  background: rgba(0, 0, 0, ${props => props.$bgOpacity});
  ${props => props.$isDisplay && 'backdrop-filter: blur(2px);'} /* (only when shown: a full-screen blur costs every frame, even unseen) */
  
  transition: opacity 0.5s ease, background 0.5s ease;
  transition-delay: ${props => props.$isDisplay ? `${TRANSITION_TIME_SEC}s` : '0s'};
`;

const ModalCardContent = styled.div`
  padding: 4cqw;
  width: 85%;
  position: relative;
  align-items: center;
  justify-content: center;
  display: flex;
  flex-direction: column;
  gap: 3cqw;
  text-align: center;
`;

// Reused Loader text specifications for your centered Modal Title
const ModalTitle = styled.h2`
  width: 100%;
  margin: 0;
  padding: 0;
  text-align: center;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 15cqw;
  line-height: 1.1;

  margin-bottom: 1cqw;
`;

/**
 * The title's letters dropping in, one after another (first to last: `stagger` seconds apart, starting as the
 * card comes in, after `delaySeconds`): each fades in as it falls from `fromCqw` above, gathering speed, lands
 * past its place (overshootCqw) squashing (squash: wider, shorter), springs back up past it stretching (bounces:
 * how high each rebound goes, cqw, smaller each time; stretch), and settles, losing momentum with each bounce;
 * `seconds` for each letter, fading in over the first `fadeShare` of it.
 */
const TITLE_DROP = { isOn: true, fromCqw: -6, overshootCqw: 1.3, bounces: [1.2, 0.45, 0.15], squash: 0.14, stretch: 0.08, seconds: 1.2, stagger: 0.06, fadeShare: 0.2, delaySeconds: TRANSITION_TIME_SEC };

// (falling, ease-in: gathering speed; rising, ease-out: losing it. Squashed as it lands, stretched as it springs up)
const { fromCqw, overshootCqw, bounces, squash, stretch } = TITLE_DROP;
const at = (share: number) => `${(share * 100).toFixed(1)}%`;
const shape = (squashBy: number) => `scale(${1 + squashBy}, ${1 - squashBy})`;
const letterDrop = keyframes`
  0% { transform: translateY(${fromCqw}cqw) ${shape(-stretch)}; opacity: 0; animation-timing-function: ease-in; }
  ${at(TITLE_DROP.fadeShare)} { opacity: 1; }
  ${at(0.3)} { transform: translateY(${overshootCqw}cqw) ${shape(squash)}; animation-timing-function: ease-out; }
  ${at(0.46)} { transform: translateY(${-bounces[0]}cqw) ${shape(-stretch)}; animation-timing-function: ease-in; }
  ${at(0.6)} { transform: translateY(${overshootCqw * 0.35}cqw) ${shape(squash * 0.55)}; animation-timing-function: ease-out; }
  ${at(0.72)} { transform: translateY(${-bounces[1]}cqw) ${shape(-stretch * 0.4)}; animation-timing-function: ease-in; }
  ${at(0.82)} { transform: translateY(${overshootCqw * 0.1}cqw) ${shape(squash * 0.2)}; animation-timing-function: ease-out; }
  ${at(0.91)} { transform: translateY(${-bounces[2]}cqw) ${shape(0)}; animation-timing-function: ease-in; }
  100% { transform: translateY(0) ${shape(0)}; opacity: 1; }
`;

/**
 * Once they've landed, the letters hop again now and then (every everySeconds, no fade), as a wave running
 * through the word from its first letter to its last (waveStagger: seconds from one letter to the next): each
 * surges up as if buoyed by water (heightCqw: quickly, easing off at the top), dips back down past its place
 * (sinkCqw), bobs up and down again (bobs: each smaller) and settles, in `seconds`. As in water, it's carried
 * along with the passing wave as well: forward (driftCqw, to the right) as it rides up to the crest, back to the
 * left as it drops into the trough, its sideways sway following its rise and fall (a small loop).
 */
const TITLE_HOP = { isOn: true, everySeconds: 8, heightCqw: 1.4, sinkCqw: 0.45, bobs: [0.28, 0.1], seconds: 1.5, waveStagger: 0.09, driftCqw: 0.4 };
// (the hop at the end of each cycle: the first a full everySeconds after landing; still, as it landed, till then)
const hopAt = (share: number) => at(1 - (1 - share) * TITLE_HOP.seconds / TITLE_HOP.everySeconds);
// (sideways in step with the height: right on the way up and at the crest, back left down into the trough)
const drift = (share: number) => (share * TITLE_HOP.driftCqw).toFixed(3);
const letterHop = keyframes`
  0%, ${hopAt(0)} { transform: translate(0, 0); animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1); }
  ${hopAt(0.26)} { transform: translate(${drift(1)}cqw, ${-TITLE_HOP.heightCqw}cqw); animation-timing-function: ease-in-out; }
  ${hopAt(0.5)} { transform: translate(${drift(-0.4)}cqw, ${TITLE_HOP.sinkCqw}cqw); animation-timing-function: ease-in-out; }
  ${hopAt(0.68)} { transform: translate(${drift(0.25)}cqw, ${-TITLE_HOP.bobs[0]}cqw); animation-timing-function: ease-in-out; }
  ${hopAt(0.84)} { transform: translate(${drift(-0.1)}cqw, ${TITLE_HOP.bobs[1]}cqw); animation-timing-function: ease-in-out; }
  100% { transform: translate(0, 0); }
`;

/**
 * Once the letters have landed, a light sweeping across the title (as across Choose Your Duel's: ModeSelect's
 * TITLE_SHEEN), letter by letter left to right, once every everySeconds: crossing each letter in
 * letterSeconds, perLetter seconds after the one before; brightness: the light's opacity at its middle.
 */
const TITLE_SHEEN = { isOn: true, everySeconds: 3, letterSeconds: 0.45, perLetter: 0.07, brightness: 0.75 };
// (the light a band in a layer 2.5x the letter's width: at 100% it's off its left, at 0% off its right)
const letterSheen = keyframes`
  0% { background-position: 100% 0, 0 0; }
  ${TITLE_SHEEN.letterSeconds / TITLE_SHEEN.everySeconds * 100}%, 100% { background-position: 0% 0, 0 0; }
`;
const SHEEN_BAND = `linear-gradient(105deg, rgba(255, 255, 255, 0) 38%, rgba(255, 255, 255, ${TITLE_SHEEN.brightness}) 50%, rgba(255, 255, 255, 0) 62%) 100% 0 / 250% 100% no-repeat`;

// (each letter in the "SpellCraft" title's lettering: its gradient runs top to bottom, so it reads the same per letter)
const TitleLetter = styled.span<{ $index: number; $count: number; $isDropping: boolean }>`
  display: inline-block;
  transform-origin: 50% 85%; /* (squashing onto its baseline) */
  white-space: pre;
  ${titleLetteringCss({ strokeCqw: 0.1, glowCqw: 0.8 })}
  ${TITLE_SHEEN.isOn && `background: ${SHEEN_BAND}, ${getTitleGold()}; -webkit-background-clip: text; background-clip: text;`}
  ${props => {
    const landed = TITLE_DROP.delaySeconds + (props.$count - 1) * TITLE_DROP.stagger + TITLE_DROP.seconds;
    const drop = TITLE_DROP.delaySeconds + props.$index * TITLE_DROP.stagger, sheenFrom = landed + props.$index * TITLE_SHEEN.perLetter;
    // (hopping once all have landed: a wave, letter after letter, first to last)
    const hopFrom = landed + props.$index * TITLE_HOP.waveStagger;
    if (props.$isDropping && TITLE_SHEEN.isOn && TITLE_HOP.isOn) return css`
      opacity: 0;
      animation: ${letterDrop} ${TITLE_DROP.seconds}s linear ${drop}s forwards, ${letterHop} ${TITLE_HOP.everySeconds}s linear ${hopFrom}s infinite, ${letterSheen} ${TITLE_SHEEN.everySeconds}s ease-in-out ${sheenFrom}s infinite;
    `;
    if (props.$isDropping && TITLE_SHEEN.isOn) return css`
      opacity: 0;
      animation: ${letterDrop} ${TITLE_DROP.seconds}s linear ${drop}s forwards, ${letterSheen} ${TITLE_SHEEN.everySeconds}s ease-in-out ${sheenFrom}s infinite;
    `;
    if (props.$isDropping) return css`
      opacity: 0;
      animation: ${letterDrop} ${TITLE_DROP.seconds}s linear ${drop}s forwards;
    `;
    return TITLE_SHEEN.isOn ? css`animation: ${letterSheen} ${TITLE_SHEEN.everySeconds}s ease-in-out ${props.$index * TITLE_SHEEN.perLetter}s infinite;` : '';
  }}
`;

/** The title, its letters dropping in as the card comes in (TITLE_DROP). */
const DroppingTitle = ({ text, isShown }: { text: string; isShown: boolean }) => (
  <ModalTitle aria-label={text}>
    {[...text].map((letter, k) => <TitleLetter key={k} $index={k} $count={text.length} $isDropping={TITLE_DROP.isOn && isShown} aria-hidden>{letter}</TitleLetter>)}
  </ModalTitle>
);

/** The ending's text's line height (in its font size). */
const SUBTEXT_LINE_HEIGHT = 2;
/**
 * The buttons follow the text, as close on every card as on the two-line caught ones (their text, 3.2cqw, a
 * line longer than one at 3.6cqw: that much taken back out of the gap between the text and the buttons).
 */
/**
 * The ending's text's font: the device's own plain sans-serif, readable (Segoe UI on Windows, Calibri's
 * family; Helvetica on Apple's; Arial elsewhere), family; weight; scale: its size against the sizes set
 * per ending, which were set for the narrower EnchantedLand ('EnchantedLand', scale 1: as those were).
 */
const SUBTEXT_FONT = { family: "'Segoe UI', Calibri, 'Helvetica Neue', Helvetica, Arial, sans-serif", weight: 400, scale: 0.66 };
const TEXT_TO_BUTTONS_TRIM = (2 * 3.2 - 3.6) * SUBTEXT_LINE_HEIGHT * SUBTEXT_FONT.scale;

const ModalSubText = styled.p<{ $fontSize: number }>`
  font-family: ${SUBTEXT_FONT.family};
  font-weight: ${SUBTEXT_FONT.weight};
  font-size: ${props => props.$fontSize * SUBTEXT_FONT.scale}cqw;
  color: #efe0b9; /* vellum */
  white-space: nowrap; /* one line */
  margin: 0 auto;
  text-shadow: 0 0.2cqw 0.4cqw rgba(0, 0, 0, 0.9), 0 0 0.8cqw rgba(0, 0, 0, 0.7);
  line-height: ${SUBTEXT_LINE_HEIGHT};
  text-align: center;
`;

/** The ending's text (the buttons close beneath it: TEXT_TO_BUTTONS_TRIM). */
const ModalSubTextContainer = styled.div`
  display: flex;
  flex-flow: column wrap;
  justify-content: center;
  align-items: center;
  width: 100%;
  text-align: center;
  margin-bottom: -${TEXT_TO_BUTTONS_TRIM}cqw;
`;

const ButtonRow = styled.div`
  width: 80%;
  max-width: 600px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6cqw;
  margin-top: 2cqw;
`;

// --- Shared Core Shape Sub-Layouts ---
const ModalNote = styled.div`
  font-family: 'EnchantedLand', sans-serif;
  font-size: 2.6cqw;
  color: #e6c563;
  text-align: center;
  margin-top: 1.5cqw;
`;

/** Raises the title and its line of text (not the buttons) this far (cqw). */
const TEXT_RAISE = 4;

/** The title and its line of text, raised (TEXT_RAISE). */
/**
 * Both wizards' masks beside the title: the player's (white) on the left, the rival's (green) on the right.
 * A winner's stays whole; a loser's cracks, then splits along the crack and falls apart, a moment after the
 * card shows. size: cqw wide. backlight: the white light behind a whole mask (and a missing one: black); whiteBacklight: behind the player's white one (softer: 'none' for none). titleGap: between each
 * mask's frame and the title (cqw). raise: the mask lifted (% of its height: the image's mask sits low in it), centered in its frame.
 */
const OUTCOME_MASKS = { size: 9, raise: 8, titleGap: 6, crackDelaySeconds: 0.6, crackSeconds: 0.5, splitSeconds: 0.7, backlight: 'drop-shadow(0 0 0.5cqw rgba(255, 255, 255, 0.9)) drop-shadow(0 0 1.6cqw rgba(255, 255, 255, 0.45))', whiteBacklight: 'drop-shadow(0 0 0.5cqw rgba(255, 255, 255, 0.9)) drop-shadow(0 0 1.6cqw rgba(255, 255, 255, 0.45))' }; // (white: as the green's again; was halved)

/** A mask's place: the vortex beneath it (MaskVortex), the mask over its eye. */
const MaskFrame = styled.div`
  position: relative;
  flex: none;
  width: ${MASK_VORTEX.size}cqw;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/** For each game over (from this player's side): each mask whole, breaking, or missing (a rival who fled: black, backlit). */
type MaskOutcome = 'whole' | 'broken' | 'missing';
const MASK_OUTCOMES: Record<number, { self: MaskOutcome; rival: MaskOutcome }> = {
  [GameOverStatus.BothDead]: { self: 'broken', rival: 'broken' }, // (a draw: both fallen, both masks shattering)
  [GameOverStatus.PlayerWon]: { self: 'whole', rival: 'broken' },
  [GameOverStatus.NpcWon]: { self: 'broken', rival: 'whole' },
  [GameOverStatus.TimesUp]: { self: 'broken', rival: 'broken' }, // (both caught)
  [GameOverStatus.CaughtPlayer]: { self: 'broken', rival: 'whole' },
  [GameOverStatus.CaughtNpc]: { self: 'whole', rival: 'broken' },
  [GameOverStatus.OutOfStep]: { self: 'whole', rival: 'whole' },
  [GameOverStatus.EnemyFled]: { self: 'whole', rival: 'missing' },
};

const crackDraw = keyframes`
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
`;
const crackJolt = keyframes`
  0%, 100% { transform: rotate(0deg) scale(1); }
  20% { transform: rotate(-4deg) scale(1.06); }
  45% { transform: rotate(3deg) scale(0.98); }
  70% { transform: rotate(-1deg) scale(1); }
`;
const cracksFade = keyframes`
  to { opacity: 0; }
`;
const splitLeft = keyframes`
  to { transform: translate(-0.35cqw, 0.35cqw) rotate(-4deg); }
`;
const splitRight = keyframes`
  to { transform: translate(0.35cqw, 0.5cqw) rotate(3.5deg); }
`;

// The halves, cut along the main crack (in the mask image's 58 x 73 box, as %)
const CRACK_LINE = '53.4% 0%, 51.7% 19.2%, 46.6% 30.1%, 53.4% 39.7%, 44.8% 50.7%, 50% 63%, 43.1% 75.3%, 41.4% 100%';
const LEFT_HALF = `polygon(0% 0%, ${CRACK_LINE}, 0% 100%)`;
// (the right half: up the crack from the bottom, then round by the top right corner: not crossing itself)
const RIGHT_HALF = `polygon(${CRACK_LINE.split(', ').reverse().join(', ')}, 100% 0%, 100% 100%)`;

const MaskBox = styled.div<{ $delay: number; $isBroken: boolean; $isMissing: boolean; $isWhite: boolean }>`
  position: relative;
  top: ${-OUTCOME_MASKS.raise / 100 * OUTCOME_MASKS.size * 73 / 58}cqw;
  z-index: 1;
  flex: none;
  width: ${OUTCOME_MASKS.size}cqw;
  aspect-ratio: 58 / 73;
  filter: ${props => props.$isWhite ? OUTCOME_MASKS.whiteBacklight : OUTCOME_MASKS.backlight}; /* (broken or whole: its halves glow as they part) */
  ${props => props.$isBroken && css`animation: ${crackJolt} 0.45s ease-out ${props.$delay}s 1;`}
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  svg { ${props => css`animation: ${cracksFade} 0.3s ease-in ${props.$delay + OUTCOME_MASKS.crackSeconds + 0.15}s forwards;`} }
  path {
    fill: none;
    stroke: #1a0e06;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    ${props => css`animation: ${crackDraw} ${OUTCOME_MASKS.crackSeconds}s ease-out ${props.$delay}s forwards;`}
  }
`;

const MaskHalf = styled.div<{ $isWhite: boolean; $isMissing?: boolean; $clip: string; $split: ReturnType<typeof keyframes> | null; $delay: number }>`
  position: absolute;
  inset: 0;
  background: url(${props => props.$isWhite ? 'mask-icons/1mask-icon-Normal-white.png' : 'mask-icons/1mask-icon-Normal.png'}) center / cover no-repeat;
  ${props => props.$isMissing && 'filter: brightness(0);'}
  clip-path: ${props => props.$clip};
  transform-origin: 50% 100%;
  ${props => props.$split && css`animation: ${props.$split} ${OUTCOME_MASKS.splitSeconds}s cubic-bezier(0.3, 0, 0.6, 1) ${props.$delay}s forwards;`}
`;

/** A wizard's mask on the card: whole, cracking and splitting apart (`delaySeconds`: when it cracks), or missing. */
/**
 * Whether each mask sits right above its own wizard (centered over their spotlight: data-spotlight, shifted
 * across from its place beside the title), or beside the title (false).
 */
const MASKS_OVER_WIZARDS = true;
/**
 * Where the masks (and their vortices) sit up and down: their middle this far below the game's top (cqw), the
 * same on every card (the title, with them in its row, sits higher on a card with more text: a catch's).
 */
const MASK_MIDDLE_FROM_TOP = 9.5;

/**
 * How far (px) to shift a mask: across, so it's centered over its wizard's spotlight; down, so its middle is
 * MASK_MIDDLE_FROM_TOP below the game's top. Measured as it's laid out, and on resizing.
 */
const useOverWizardShift = (side: 'self' | 'rival') => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shift, setShift] = useState(0);
  const [drop, setDrop] = useState(0);
  useLayoutEffect(() => {
    if (!MASKS_OVER_WIZARDS) return;
    const measure = () => {
      const frame = ref.current, spot = document.querySelector(`[data-spotlight="${side}"]`);
      if (!frame || !spot) return;
      const f = frame.getBoundingClientRect(), s = spot.getBoundingClientRect();
      setShift(current => Math.round((s.left + s.width / 2) - (f.left + f.width / 2 - current)));
      // (the game: the frame's nearest container, its cqw)
      let game = frame.parentElement;
      while (game && getComputedStyle(game).containerType === 'normal') game = game.parentElement;
      if (game) {
        const g = game.getBoundingClientRect();
        setDrop(current => Math.round(g.top + MASK_MIDDLE_FROM_TOP * g.width / 100 - (f.top + f.height / 2 - current)));
      }
    };
    // (again while the card comes in, as it moves: until it has settled)
    measure();
    const settling = window.setInterval(measure, 200);
    const settled = window.setTimeout(() => window.clearInterval(settling), (CARD_FADE_IN.delaySeconds + CARD_FADE_IN.seconds + 2) * 1000);
    window.addEventListener('resize', measure);
    return () => { window.clearInterval(settling); window.clearTimeout(settled); window.removeEventListener('resize', measure); };
  }, [side]);
  return { ref, style: MASKS_OVER_WIZARDS ? { transform: `translate(${shift}px, ${drop}px)` } : undefined };
};

const OutcomeMask = ({ side, outcome, delaySeconds }: { side: 'self' | 'rival'; outcome: MaskOutcome; delaySeconds: number }) => {
  const splitDelay = delaySeconds + OUTCOME_MASKS.crackSeconds + 0.1;
  const isWhite = side === 'self', isBroken = outcome === 'broken', isMissing = outcome === 'missing';
  const overWizard = useOverWizardShift(side);
  return (
    <MaskFrame aria-hidden ref={overWizard.ref} style={overWizard.style}>
    <MaskVortex />
    <MaskBox $delay={delaySeconds} $isBroken={isBroken} $isMissing={isMissing} $isWhite={isWhite}>
      <MaskHalf $isWhite={isWhite} $isMissing={isMissing} $clip={isBroken ? LEFT_HALF : 'none'} $split={isBroken ? splitLeft : null} $delay={splitDelay} />
      {isBroken && <MaskHalf $isWhite={isWhite} $clip={RIGHT_HALF} $split={splitRight} $delay={splitDelay} />}
      {isBroken && (
        // (cracks from a point on the brow; pathLength 1 so each draws in evenly)
        <svg viewBox='0 0 58 73'>
          <path pathLength={1} d='M30 14 L27 22 L31 29 L26 37 L29 46 L25 55' />
          <path pathLength={1} d='M27 22 L19 26 L15 33' />
          <path pathLength={1} d='M31 29 L39 32 L43 40' />
          <path pathLength={1} d='M29 46 L35 51' />
        </svg>
      )}
    </MaskBox>
    </MaskFrame>
  );
};

/** The title, between the two masks. */
const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${OUTCOME_MASKS.titleGap}cqw;
  width: max-content; /* (a long title on one line: the row past the text's width if need be, still centered) */
  h2 { width: auto; white-space: nowrap; }
`;

const RaisedText = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3cqw;
  transform: translateY(-${TEXT_RAISE}cqw);
`;

// --- Component Definition ---
interface ActionButtonProps {
  label: string;
  onClick: () => void;
}

/** A game over button: the shared gold button (goldStyle), a little wide for one word. */
const ModalButtonWithSymbols: React.FC<ActionButtonProps> = ({ label, onClick }) => (
  <GoldButton size='large' isPrimary onClick={onClick} style={{ minWidth: '18cqw' }}>{label}</GoldButton>
);

export const GameOverModalComponent: React.FC = () => {
  const snap = useSnapshot(rootGameStore);
  const currentGameOverState = snap.getGameOver();
  // (compared with null: a draw, GameOverStatus.BothDead, is 0)
  const isGameOver = currentGameOverState !== null;
  const contentConfig = isGameOver ? MODAL_CONTENT_MAP[currentGameOverState] : { title: '', fontSize: 0, text: '' };
  const isAwaitingRematch = snap.getIsAwaitingRematch(), isRivalLeft = snap.getIsRivalLeft();
  // (the masks beside the title: a loser's cracking once the card has faded in)
  const masks = isGameOver ? MASK_OUTCOMES[currentGameOverState] : null;
  const maskDelay = TRANSITION_TIME_SEC + OUTCOME_MASKS.crackDelaySeconds;

  return (
    <ModalDimOverlay $isDisplay={isGameOver} $bgOpacity={isGameOver ? MAX_OPACITY : MIN_OPACITY}>
      <ModalCardContent>
        <RaisedText>
          <TitleRow>
            {masks && <OutcomeMask key={`self:${currentGameOverState}`} side='self' outcome={masks.self} delaySeconds={maskDelay} />}
            <DroppingTitle key={`${currentGameOverState}:${isGameOver}`} text={contentConfig.title} isShown={isGameOver} />
            {masks && <OutcomeMask key={`rival:${currentGameOverState}`} side='rival' outcome={masks.rival} delaySeconds={maskDelay} />}
          </TitleRow>
          <GoldDivider width={24} />
          <ModalSubTextContainer>
            {contentConfig.isPlayAgainOwnLine ? (
              <>
                <ModalSubText $fontSize={contentConfig.fontSize}>{contentConfig.text}</ModalSubText>
                {/* (no "Play again?" once the rival has left) */}
                {(contentConfig.secondLine || !isRivalLeft) && (
                  <ModalSubText $fontSize={contentConfig.fontSize}>{[contentConfig.secondLine, isRivalLeft ? '' : 'Play again?'].filter(Boolean).join(' ')}</ModalSubText>
                )}
              </>
            ) : (
              <ModalSubText $fontSize={contentConfig.fontSize}>{contentConfig.text}{isRivalLeft ? '' : ' Play again?'}</ModalSubText>
            )}
          </ModalSubTextContainer>
        </RaisedText>
        {/* (a 2-player match: Yes waits for the rival's; a rival who left can't play again) */}
        {isGameOver && isRivalLeft && currentGameOverState !== GameOverStatus.EnemyFled && <ModalNote>Your rival has left the hall.</ModalNote>}
        {isGameOver && isAwaitingRematch && !isRivalLeft && <ModalNote>Waiting for your rival…</ModalNote>}
        {isGameOver && !isAwaitingRematch && <ButtonRow>
          {!isRivalLeft && <ModalButtonWithSymbols label="Yes" onClick={() => rootGameStore.chooseRematch()} />}
          <ModalButtonWithSymbols label={isRivalLeft ? "Back" : "No"} onClick={() => {
            // Back to the landing page (a fresh start; an invite link's join left off, so it isn't joined again)
            if (snap.getIsMultiplayer()) rootGameStore.leaveMatch();
            window.location.href = window.location.origin + window.location.pathname;
          }} />
        </ButtonRow>}
      </ModalCardContent>
    </ModalDimOverlay>
  );
};

export default GameOverModalComponent;
