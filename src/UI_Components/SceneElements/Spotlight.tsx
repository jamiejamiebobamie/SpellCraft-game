import styled, { keyframes, css } from 'styled-components';
import { INTRO_WALK_ANIM_TIME } from '../Player/CharacterParts';
import { rootGameStore } from '../../DataClasses/store';

// Soft breathing/shimmering animation for a cinematic, dust-mote lens effect
const lightShimmer = keyframes`
  0%, 100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.35;
  }
`;

const fadeIn = keyframes`
  0% { opacity: 0; }
  100% { opacity: ${rootGameStore.HIGH_BRIGHTNESS}; }
`;

/**
 * The spotlights show whose move it is: the active wizard's brightens, the other's dims (neither
 * between turns). Brightness, as a multiplier.
 */
export const SPOTLIGHT_TURN = { active: 1.9, inactive: 0.55, seconds: 0.8 };

export const Spotlight = styled.div<{ $isBeginIntroWalk: boolean; $isDoneWithIntroWalk: boolean, $isDead: boolean, $turn?: 'active' | 'inactive' | 'none' }>`
  position: absolute;
  /* Hangs outside the top bounds so the origin source is invisible/out-of-shot */
  top: -15cqw; 
  left: 50%;
  transform: translateX(-50%);
  
  /* Dimensions relative to container width query units */
  width: 17cqw;
  height: 60cqw;
  
  /* A massive horizontal oval centered at the top (50% 0%).
     The 100% width and 200% height ensure it slopes gently down into a rounded bottom dome. */
  clip-path: ellipse(100% 200% at 50% 0%);
  
  /* White-yellow classic vintage light blend that dissipates downwards */
  background: linear-gradient(
    to bottom,
    rgba(239, 253, 255, 0.73) 0%,   /* Intense warm white at the top origin */
    rgba(239, 253, 255, 0.26) 40%,  /* Soft cinematic yellow glow in the mid-stream */
    rgba(239, 253, 255, 0.32) 90%   /* Completely dissolves before hitting the bottom floor */
  );
  
  /* Softens the edges of the clip-path so it doesn't look like sharp vector lines */
  filter: blur(1cqw) brightness(${props => props.$turn === 'active' ? SPOTLIGHT_TURN.active : props.$turn === 'inactive' ? SPOTLIGHT_TURN.inactive : 1});
  
  /* Stays under your text content but layers automatically above background elements */
  z-index: -1; 
  
  /* Ensures click events flow right through the light cone to elements beneath */
  pointer-events: none;

  /* Optional: gives it that 90s projection-booth breathing vibe */
  /* (before the walk begins: off, with no animation yet, as a paused one could still run on Safari) */
  ${props => props.$isDoneWithIntroWalk ? css`animation: ${lightShimmer} 6s ease-in-out infinite;` : props.$isBeginIntroWalk ? css`animation: ${fadeIn} ${INTRO_WALK_ANIM_TIME}s ease-in forwards;` : ''}

  transition: opacity 3s, filter ${SPOTLIGHT_TURN.seconds}s ease-in-out;
  opacity: ${props => props.$isDead || (!props.$isBeginIntroWalk && !props.$isDoneWithIntroWalk) ? 0 : 1};
`;
