import styled from 'styled-components';
import { INTRO_WALK_ANIM_TIME } from './Player/CharacterParts';

export const UIFadeIn = styled.div<{ $isDoneWithIntro: boolean }>`
  transition: opacity ${INTRO_WALK_ANIM_TIME / 3}s;
  opacity: ${props => props.$isDoneWithIntro ? 1 : 0};
  pointer-events:  ${props => props.$isDoneWithIntro ? 'inherit' : 'none'};
`;