import styled, { keyframes } from 'styled-components';

// Soft breathing/shimmering animation for a cinematic, dust-mote lens effect
const lightShimmer = keyframes`
  0%, 100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.35;
  }
`;

export const Spotlight = styled.div`
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
  filter: blur(1cqw);
  
  /* Stays under your text content but layers automatically above background elements */
  z-index: -1; 
  
  /* Ensures click events flow right through the light cone to elements beneath */
  pointer-events: none;

  /* Optional: gives it that 90s projection-booth breathing vibe */
  animation: ${lightShimmer} 6s ease-in-out infinite;
`;
