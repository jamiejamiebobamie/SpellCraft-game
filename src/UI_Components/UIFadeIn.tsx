import styled from 'styled-components';
import { INTRO_WALK_ANIM_TIME } from './Player/CharacterParts';

/** UI that fades in once the intro walk is over; until then nothing in it takes a click (not even a part that asks to). */
export const UIFadeIn = styled.div<{ $isDoneWithIntro: boolean }>`
  transition: opacity ${INTRO_WALK_ANIM_TIME / 3}s;
  opacity: ${props => props.$isDoneWithIntro ? 1 : 0};
  pointer-events:  ${props => props.$isDoneWithIntro ? 'inherit' : 'none'};
  ${props => !props.$isDoneWithIntro && '& * { pointer-events: none !important; }'}
`;