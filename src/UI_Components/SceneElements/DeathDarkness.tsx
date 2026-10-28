// DeathDarkness.tsx
// A wizard falling (their health gone): the scene darkens around the two of them, as at a catch (TeacherCatch's
// CatchDarkness). Both wizards and their spotlights stay lit, over the darkness (CATCH_LAYERS); their health,
// focus and status darken with the rest (PlayerComponent).
import styled, { keyframes } from 'styled-components';
import { useSnapshot } from 'valtio';
import { rootGameStore } from '../../DataClasses/store';
import { CATCH_LAYERS } from './teacherCatchConfig';

/**
 * The darkness at a death: how dark (opacity: 0 none, 1 black), how long it takes to fall (fadeSeconds), and
 * when it starts (fromSeconds after the wizard's health is gone; the game over card follows 1.5s after).
 */
export const DEATH_DIM = { isOn: true, opacity: 0.75, fadeSeconds: 0.9, fromSeconds: 0.3 };

const darken = keyframes`
  from { opacity: 0; }
  to { opacity: ${DEATH_DIM.opacity}; }
`;

const Darkness = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${CATCH_LAYERS.dim};
  pointer-events: none;
  background: #000;
  opacity: 0;
  animation: ${darken} ${DEATH_DIM.fadeSeconds}s ease-in ${DEATH_DIM.fromSeconds}s forwards;
`;

/** Whether a wizard has fallen (so the scene darkens around them both). */
export const useIsAnyWizardDead = (): boolean => {
  const snap = useSnapshot(rootGameStore);
  return !!snap.getHumanPlayer()?.getIsDead() || !!snap.getNpcPlayer()?.getIsDead();
};

/** The darkness that falls when a wizard does. */
export default function DeathDarkness() {
  const snap = useSnapshot(rootGameStore);
  const isAnyDead = useIsAnyWizardDead();
  if (!DEATH_DIM.isOn || !isAnyDead || snap.getCatchScene()) return null;
  return <Darkness />;
}
