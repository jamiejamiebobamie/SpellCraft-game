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
import { PassCard } from '../TurnCard';

/**
 * The doorways (the open arches behind each wizard, in cqw of the game's width): where the lantern's light
 * shows, its color (r, g, b: blood red), and its blur (cqw).
 */
export const DOORWAYS = { self: { left: 5.5 }, rival: { right: 5.8 }, width: 13, top: 17, height: 22, light: '190, 12, 12', blur: 1.6 };

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
  filter: blur(${DOORWAYS.blur}cqw); /* (one soft glow, not its two shapes) */
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
      {LANTERN_PASS.isLightOn && pass && !scene && (
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
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(14deg) scale(2.6); }
  35% { opacity: 1; transform: translate(-50%, -50%) rotate(8deg) scale(0.92); }
  45% { transform: translate(-50%, -50%) rotate(8deg) scale(1.04); }
  55%, 100% { opacity: 1; transform: translate(-50%, -50%) rotate(8deg) scale(1); }
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
  color: #8a0303; /* blood red */
  -webkit-text-stroke: 0.12cqw #2a0000;
  text-shadow: 0 0 1.2cqw rgba(170, 0, 0, 0.55), 0 0 2.5cqw rgba(0, 0, 0, 0.85), 0 0.3cqw 0.6cqw rgba(0, 0, 0, 0.9);
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

/** Placed inside a wizard's avatar: their "phew" once the lantern has passed them by. */
export function PhewBubble({ side }: { side: 'self' | 'rival' }) {
  const snap = useSnapshot(rootGameStore);
  const phew = snap.getPhew();
  if (!phew || phew.side !== side) return null;
  return <PassCard key={phew.id}>{LANTERN_PASS.phewText}</PassCard>; // (as "Pass": the same place and lettering)
}
