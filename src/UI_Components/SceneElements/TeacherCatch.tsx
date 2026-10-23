// TeacherCatch.tsx
// The teacher's visits at dawn (Game: passLantern, beginCatchScene; timing: teacherCatchConfig.ts). On a
// risky turn nobody was caught on, a lantern's light passes the weaker wizard's doorway; on a catch, the
// light floods through the caught wizard's doorway, they're dragged out (PlayerComponent), and "Caught!"
// stamps on. Also the first-light card.
import styled, { css, keyframes } from 'styled-components';
import { useSnapshot } from 'valtio';
import { rootGameStore } from '../../DataClasses/store';
import { titleLetteringCss } from '../Logo/titleLettering';
import { CATCH_SCENE, DAWN_CARD, LANTERN_PASS } from './teacherCatchConfig';

/**
 * The doorways (the open arches behind each wizard, in cqw of the game's width): where the lantern's light
 * shows, and its color (r, g, b).
 */
export const DOORWAYS = { self: { left: 5.5 }, rival: { right: 5.8 }, width: 13, top: 17, height: 22, light: '255, 196, 120' };

// A lantern carried past, beyond the doorway: its glow crossing the opening, and its light spilling out
// over the floor in front, brightening and fading as it passes
const passAcross = keyframes`
  0% { transform: translateX(-60%); opacity: 0; }
  30% { opacity: 1; }
  70% { opacity: 1; }
  100% { transform: translateX(60%); opacity: 0; }
`;
const spillPass = keyframes`
  0%, 100% { opacity: 0; }
  45%, 60% { opacity: 1; }
`;
// The catch: the light swelling until it fills the doorway, and staying
const flood = keyframes`
  0% { opacity: 0; transform: scale(0.6); }
  70% { opacity: 1; transform: scale(1.25); }
  100% { opacity: 1; transform: scale(1.15); }
`;

const Doorway = styled.div<{ $side: 'self' | 'rival' }>`
  position: absolute;
  ${props => props.$side === 'self' ? `left: ${DOORWAYS.self.left}cqw;` : `right: ${DOORWAYS.rival.right}cqw;`}
  top: ${DOORWAYS.top}cqw;
  width: ${DOORWAYS.width}cqw;
  height: ${DOORWAYS.height}cqw;
  z-index: 1; /* over the background, beneath the wizards */
  pointer-events: none;
  mix-blend-mode: screen; /* light: brightening what's there */
`;

const Glow = styled.div<{ $isFlood: boolean; $seconds: number }>`
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 45% 60% at 50% 60%, rgba(${DOORWAYS.light}, 0.95) 0%, rgba(${DOORWAYS.light}, 0.35) 55%, rgba(${DOORWAYS.light}, 0) 100%);
  opacity: 0;
  ${props => props.$isFlood
    ? css`animation: ${flood} ${props.$seconds}s ease-in forwards;`
    : css`animation: ${passAcross} ${props.$seconds}s ease-in-out forwards;`}
`;

const Spill = styled.div<{ $isFlood: boolean; $seconds: number }>`
  position: absolute;
  left: -40%;
  right: -40%;
  top: 80%;
  height: 45%;
  background: radial-gradient(ellipse 50% 50% at 50% 30%, rgba(${DOORWAYS.light}, 0.6) 0%, rgba(${DOORWAYS.light}, 0) 100%);
  opacity: 0;
  ${props => props.$isFlood
    ? css`animation: ${flood} ${props.$seconds}s ease-in forwards;`
    : css`animation: ${spillPass} ${props.$seconds}s ease-in-out forwards;`}
`;

/** The lantern's light in the doorways: passing (a risky turn) or flooding (a catch). */
export function LanternLight() {
  const snap = useSnapshot(rootGameStore);
  const pass = snap.getLanternPass();
  const scene = snap.getCatchScene();
  return (
    <>
      {pass && !scene && (
        <Doorway key={pass.id} $side={pass.side}>
          <Glow $isFlood={false} $seconds={LANTERN_PASS.seconds} />
          <Spill $isFlood={false} $seconds={LANTERN_PASS.seconds} />
        </Doorway>
      )}
      {scene && scene.caught.map(side => (
        <Doorway key={`${scene.id}:${side}`} $side={side}>
          <Glow $isFlood={true} $seconds={CATCH_SCENE.floodSeconds} />
          <Spill $isFlood={true} $seconds={CATCH_SCENE.floodSeconds} />
        </Doorway>
      ))}
    </>
  );
}

const stampOn = keyframes`
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(-14deg) scale(2.6); }
  35% { opacity: 1; transform: translate(-50%, -50%) rotate(-8deg) scale(0.92); }
  45% { transform: translate(-50%, -50%) rotate(-8deg) scale(1.04); }
  55%, 100% { opacity: 1; transform: translate(-50%, -50%) rotate(-8deg) scale(1); }
`;

const Stamp = styled.div`
  position: absolute;
  left: 50%;
  top: 26cqw;
  z-index: 45;
  pointer-events: none;
  white-space: nowrap;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 11cqw;
  line-height: 1;
  color: #d23a2a;
  -webkit-text-stroke: 0.12cqw #3a0b06;
  text-shadow: 0 0 1.5cqw rgba(0, 0, 0, 0.8), 0 0.3cqw 0.6cqw rgba(0, 0, 0, 0.9);
  opacity: 0;
  animation: ${stampOn} ${CATCH_SCENE.stampSeconds}s cubic-bezier(0.2, 0.8, 0.3, 1) ${CATCH_SCENE.floodSeconds + CATCH_SCENE.dragSeconds}s forwards;
`;

/** "Caught!", stamped on once the caught wizard has been dragged away. */
export function CaughtStamp() {
  const snap = useSnapshot(rootGameStore);
  const scene = snap.getCatchScene();
  if (!scene) return null; // (kept until the game over card, fading in, covers it)
  return <Stamp key={scene.id}>{CATCH_SCENE.stampText}</Stamp>;
}

const dawnShowAndFade = keyframes`
  0% { opacity: 0; transform: translate(-50%, -40%); }
  12% { opacity: 1; transform: translate(-50%, -50%); }
  80% { opacity: 1; transform: translate(-50%, -50%); }
  100% { opacity: 0; transform: translate(-50%, -60%); }
`;

const DawnCardBox = styled.div`
  position: absolute;
  left: 50%;
  top: 27cqw;
  z-index: 40;
  pointer-events: none;
  text-align: center;
  opacity: 0;
  animation: ${dawnShowAndFade} 4.5s ease-in-out ${DAWN_CARD.delaySeconds}s forwards;
  .title {
    font-family: 'EnchantedLand', sans-serif;
    font-size: 5.5cqw;
    line-height: 1;
    ${titleLetteringCss({ strokeCqw: 0.06, glowCqw: 0.6 })}
  }
  .text {
    margin-top: 0.8cqw;
    font-family: 'EnchantedLand', sans-serif;
    font-size: 2.2cqw;
    color: #f3e2b0;
    text-shadow: 0 0 0.8cqw rgba(0, 0, 0, 0.9), 0 0.15cqw 0.3cqw rgba(0, 0, 0, 0.9);
    white-space: nowrap;
  }
`;

/** First light: the risky turns begin (not over the Spell Book or the keyboard controls). */
export function DawnCard() {
  const snap = useSnapshot(rootGameStore);
  const card = snap.getDawnCard();
  if (!card || snap.getGameOver() !== null || snap.getCatchScene() !== null) return null;
  if (snap.getIsSpellBookOpen() || snap.getIsKeyboardControlsShown()) return null;
  return (
    <DawnCardBox key={card.id}>
      <div className="title">{DAWN_CARD.title}</div>
      <div className="text">{DAWN_CARD.text}</div>
    </DawnCardBox>
  );
}

/**
 * At dawn, the weaker wizard's nerves: the anime "gloom lines", wavy strokes beside their head (on the side
 * away from the board, clear of "Pass" and the emoji above it), as in anime: black, with a faint blue-white
 * glow behind, about the head's size, just off the face and a little over it. Placed in % of the avatar
 * (top, and side: from its outer edge); size in cqw; glow: the glow's color (r, g, b).
 */
export const NERVOUS_LINES = { isOn: true, top: 16, side: 28, width: 2.6, height: 3.8, color: '#0b0b10', glow: '205, 225, 255' };

const linesWobble = keyframes`
  0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.75; }
  50% { transform: translateY(-0.3cqw) scaleY(1.08); opacity: 1; }
`;

const NervousBox = styled.svg<{ $isLeft: boolean }>`
  position: absolute;
  top: ${NERVOUS_LINES.top}%;
  ${props => props.$isLeft ? `left: ${NERVOUS_LINES.side}%;` : `right: ${NERVOUS_LINES.side}%;`}
  width: ${NERVOUS_LINES.width}cqw;
  height: ${NERVOUS_LINES.height}cqw;
  z-index: 41;
  pointer-events: none;
  overflow: visible;
  filter: drop-shadow(0 0 0.15cqw rgba(${NERVOUS_LINES.glow}, 0.95)) drop-shadow(0 0 0.5cqw rgba(${NERVOUS_LINES.glow}, 0.55));
  path { animation: ${linesWobble} 1.6s ease-in-out infinite; }
  path:nth-child(2) { animation-delay: -0.5s; }
  path:nth-child(3) { animation-delay: -1s; }
`;

/** Placed inside a wizard's avatar: the gloom lines, while they're the one at risk (Game.getAtRiskSide). */
export function NervousLines({ side }: { side: 'self' | 'rival' }) {
  const snap = useSnapshot(rootGameStore);
  if (!NERVOUS_LINES.isOn || snap.getAtRiskSide() !== side) return null;
  // (three wavy strokes, the middle one longest: in a 30 x 60 box)
  const wave = (x: number, top: number, bottom: number) => {
    let d = `M ${x} ${top}`;
    for (let y = top, k = 0; y < bottom; y += 8, k++) d += ` q ${k % 2 ? -4 : 4} 4 0 8`;
    return d;
  };
  return (
    <NervousBox $isLeft={side === 'self'} viewBox='0 0 30 60' aria-hidden>
      <path d={wave(5, 8, 48)} fill='none' stroke={NERVOUS_LINES.color} strokeWidth='3' strokeLinecap='round' />
      <path d={wave(15, 0, 56)} fill='none' stroke={NERVOUS_LINES.color} strokeWidth='3' strokeLinecap='round' />
      <path d={wave(25, 12, 44)} fill='none' stroke={NERVOUS_LINES.color} strokeWidth='3' strokeLinecap='round' />
    </NervousBox>
  );
}

const phewRise = keyframes`
  0% { opacity: 0; transform: translateY(0.5cqw); }
  20% { opacity: 1; transform: translateY(0); }
  75% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-0.8cqw); }
`;

const PhewText = styled.div<{ $isLeft: boolean }>`
  position: absolute;
  top: 48%;
  ${props => props.$isLeft ? 'right: -4%;' : 'left: -4%;'} /* (on the side toward the board, clear of "Pass" and emoji above the head) */
  z-index: 41;
  pointer-events: none;
  font-family: 'QuillHand', cursive;
  font-size: 1.9cqw;
  color: #f3e2b0;
  text-shadow: 0 0 0.6cqw rgba(0, 0, 0, 0.95), 0 0.1cqw 0.2cqw rgba(0, 0, 0, 0.9);
  white-space: nowrap;
  animation: ${phewRise} ${LANTERN_PASS.phewSeconds}s ease-out forwards;
`;

/** Placed inside a wizard's avatar: their "phew" once the lantern has passed them by. */
export function PhewBubble({ side }: { side: 'self' | 'rival' }) {
  const snap = useSnapshot(rootGameStore);
  const phew = snap.getPhew();
  if (!phew || phew.side !== side) return null;
  return <PhewText key={phew.id} $isLeft={side === 'self'}>{LANTERN_PASS.phewText}</PhewText>;
}
