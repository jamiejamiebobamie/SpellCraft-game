import styled, { keyframes, css } from 'styled-components';

export const caughtInGyre = keyframes`
  /* Center-Right | Max forward tilt (slammed by wind) */
  0% {
    transform: translate3d(15px, 0px, 0) scaleX(1) rotate(35deg);
  }
  
  /* Center-Top | Erratic whip-back at the apex */
  25% {
    transform: translate3d(0px, -15px, 0) scaleX(0.5) rotate(-20deg);
  }
  
  /* Center-Left | Deep lean into the reverse spin curve */
  50% {
    transform: translate3d(-15px, 0px, 0) scaleX(-1) rotate(-35deg);
  }
  
  /* Center-Bottom | Violent wobble recovery at the trough */
  75% {
    transform: translate3d(0px, 15px, 0) scaleX(-0.5) rotate(15deg);
  }
  
  /* Loop reset */
  100% {
    transform: translate3d(15px, 0px, 0) scaleX(1) rotate(35deg);
  }
`;