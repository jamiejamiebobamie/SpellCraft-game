import React, { useState, useRef, useEffect } from 'react';
import AutomaticSpellCanvasComponent from '../../SpellCanvas/AutomaticSpellCanvasComponent';
import { GameSymbol } from '../../../DataClasses/PlacedSpells/GameSymbol';
import { HARDCODED_SYMBOLS } from '../../../DataClasses/PlacedSpells/HardCodedSymbols';
import { rootGameStore } from '../../../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled, { css, keyframes } from 'styled-components';

// --- Particle Sparkle System ---
interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  alpha: number;
  decay: number;
  color: string;
}

const SparkleCanvas = styled.canvas`
  position: absolute;
  top: -2cqw;   /* Slightly offset upward to cover the book's bounds */
  left: -2cqw;  /* Offset outward to let particles float into view */
  width: 12cqw;  /* Extends past the 6cqw TriggerBox */
  height: 15cqw;
  pointer-events: none;
  z-index: 1;    /* Sits underneath the TriggerBox (z-index: 3) */
`;

function SparkleCanvasComponent() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    // Track real pixel sizing based on responsive cqw dimensions
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Color pools for magical depth
    const goldColors = ['#ffd700', '#ffdf00', '#f3ce13', '#fff3a8'];
    const silverColors = ['#e6e6e6', '#cccccc', '#f2f2f2', '#ffffff'];

    const createParticle = (): Particle => {
      const rect = canvas.getBoundingClientRect();
      const isGold = Math.random() > 0.5;
      const pool = isGold ? goldColors : silverColors;

      return {
        // Spawn centered horizontally behind the book
        x: rect.width / 2 + (Math.random() * 20 - 10),
        // Spawn slightly hidden from the top/middle book region
        y: rect.height * 0.3 + (Math.random() * 15 - 7),
        size: Math.random() * 2.5 + 1,
        speedY: Math.random() * 0.4 + 0.2, // Gentle downward drift
        speedX: (Math.random() - 0.5) * 0.3, // Soft sway left/right
        alpha: Math.random() * 0.6 + 0.4,
        decay: Math.random() * 0.004 + 0.002,
        color: pool[Math.floor(Math.random() * pool.length)],
      };
    };

    const updateAndDraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Maintain a maximum cap of 45 gentle sparkles for low CPU footprint
      if (particles.length < 45 && Math.random() < 0.15) {
        particles.push(createParticle());
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += p.speedX;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        // Draw an elegant 4-pointed star magical sparkle
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.size);
        ctx.quadraticCurveTo(p.x, p.y, p.x + p.size, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + p.size);
        ctx.quadraticCurveTo(p.x, p.y, p.x - p.size, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - p.size);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(updateAndDraw);
    };

    updateAndDraw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return <SparkleCanvas ref={canvasRef} />;
}


const repeatingGlow = keyframes`
  0% { filter: drop-shadow(0 0 .01cqw rgba(248, 255, 54, 0.6)) drop-shadow(0 0 .03cqw rgba(250, 244, 144, 0.3)) drop-shadow(0 0 .5cqw rgba(6, 6, 1, 0.56)); }
  50% { filter: drop-shadow(0 0 .1cqw rgba(248, 255, 54, 0.6)) drop-shadow(0 0 .3cqw rgba(250, 244, 144, 0.3)) drop-shadow(0 0 .5cqw rgba(6, 6, 1, 0.56)); }
  100% { filter: drop-shadow(0 0 .01cqw rgba(248, 255, 54, 0.6)) drop-shadow(0 0 .03cqw rgba(250, 244, 144, 0.3)) drop-shadow(0 0 .5cqw rgba(6, 6, 1, 0.56)); }
`;

const repeatingGlowText = keyframes`
  0%,100% { color: rgba(248, 255, 54, 0.2); filter: drop-shadow(0 0 .5cqw rgba(248, 255, 54, 0.6)) drop-shadow(0 0 .8cqw rgba(250, 244, 144, 0.3)); }
  50% { color: #2d101099; filter: drop-shadow(0 0 .1cqw rgba(248, 255, 54, 0.6)) drop-shadow(0 0 .3cqw rgba(250, 244, 144, 0.3)); }
`;

// The Main Absolute Anchor
const MenuAnchor = styled.div`
  position: absolute;
  top: 2cqw;
  left: 3cqw; 
  // top: 6cqw;   
  // left: 5cqw; 
  z-index: 35;
`;

// The Visual Trigger Element
const TriggerBox = styled.div<{ $isClicked: boolean, $isOpen: boolean, $isClickedOnce: boolean }>`
  width: 6cqw;
  display: flex;
  flex-direction: column;

  justify-content: center;
  text-align: center;
  align-items: center;

  font-weight: bold;
  font-size: 2cqw;
  z-index: 3; /* Sits higher than the tray */
  position: relative; /* Gives it local z-index priority */
  cursor: pointer;
    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 150%;
      aspect-ratio: 332/ 307;
      background-image: url(spell-icons/spellbook-icon.png);
      background-repeat: no-repeat;
      background-size: cover;
      background-position: center;
      filter: brightness(.7);
      z-index: -1;
      transition: filter 1s, width 1s;
      ${props => props.$isOpen && 'filter: brightness(.9);'}
  }

  filter: drop-shadow(2px 2px 4px black);
  font-family: 'EnchantedLand', sans-serif;
  font-size: 2.5cqw;
  color: #2d101099;
  transition: width 1s, filter 1s, transform 1s;

  ${MenuAnchor}:hover & {
    transform: scale(1.2);
    filter: drop-shadow(0 0 .1cqw rgba(248, 255, 54, 0.6)) 
            drop-shadow(0 0 .3cqw rgba(250, 244, 144, 0.3));
    ${props => props.$isOpen && `transform: scale(1.2); filter: drop-shadow(0 0 .1cqw rgba(248, 255, 54, 0.6)) 
            drop-shadow(0 0 .3cqw rgba(250, 244, 144, 0.3)) brightness(1.1);`}
    ${props => props.$isClicked && 'transform: scale(.9);'}
  }

  ${MenuAnchor}:hover &::before {
      filter: brightness(.9);
  }

  ${props => props.$isOpen && 'transform: scale(1.1); filter: drop-shadow(2px 2px 4px black) brightness(1.1);'}
  ${props => !props.$isClickedOnce && css`animation: ${repeatingGlow} 7s ease-in-out infinite;`}
`;

// The Tray holding the columns
const SlidingTray = styled.div<{ $isOpen: boolean }>`
  display: flex;
  flex-direction: row;
  gap: 0.5cqw;

  background-color: #000000a9;
  padding: .25cqw .25cqw;
  corner-shape: squircle;
  border-radius: 1cqw;

  /* 
    By setting this to absolute, it is completely removed from the 
    MenuAnchor's dimensional size calculations.
  */
  position: absolute;
  top: 0;
  left: 150%; /* Positions the right edge of the tray against the left edge of the anchor */
  
  z-index: 2; 
  
  /* Start completely hidden behind the TriggerBox */
  transform: translateX(-100%); 
  opacity: 0;
  transition: transform 1s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease;
  pointer-events: none; 
  ${props => props.$isOpen && 'transform: translateX(0); opacity: 1; pointer-events: auto;'}
`;

// The Square Images inside the columns
const SquareImage = styled.img`
  width: 4cqw;
  height: 4cqw;
  object-fit: cover;
  border-radius: 4px;
  background-color: transparent;
  border: 0;
  transition: transform 0.2s ease, border-color 0.2s ease;
  padding: .5cqw;
  pointer-events: none;
`;

const CanvasContainer = styled.div`
  display: flex;
  position: relative;
  width: 4cqw;
  height: 4cqw;
  border-radius: 4px;
  background-color: transparent;
  transition: transform 0.2s ease, border-color 0.2s ease;
  padding: .5cqw;
  pointer-events: none;
`;

// Each Individual Slide-Out Column Group
const ColumnGroup = styled.div<{ $isClicked: boolean }>`
  display: flex;
  position: relative;
  flex-direction: column;
  gap: .1cqw;
  &:hover ${SquareImage},
  &:hover  ${CanvasContainer} {
    transform: scale(1.25);
    transition: transform .5s;
    cursor: pointer;
    pointer-events: auto;
    ${props => props.$isClicked && 'transform: scale(.9);'}
  }
`;

const CoverText = styled.div<{ $style?: string, $isClickedOnce: boolean }>`
    padding: .25cqw 0cqw 0cqw 2.8cqw;
    ${props => !!props.$style && props.$style}
    filter: drop-shadow(0 0 .1cqw rgba(248, 255, 54, 0.3)) drop-shadow(0 0 .3cqw rgba(250, 245, 144, 0.14));
`;

export default function SpellBookComponent() {
  const snap = useSnapshot(rootGameStore);
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  // const [hoveredSpell, setHoveredSpell] = useState<string | null>(null);
  const [isClickedOnce, setIsClickedOnce] = useState<boolean>(false);
  const spells = Array.from(GameSymbol.SPELL_LOOKUP.entries()).map(([inferenceString, spellClass]) => (
    <ColumnGroup
      $isClicked={isClicked}
      key={spellClass.name}
      onClick={() => {
        rootGameStore.instantiateGameSymbolFromInferenceString(inferenceString);
      }}
      onMouseEnter={() => snap.setHoveredSpellBookSpell(spellClass)}
      onMouseLeave={() => snap.setHoveredSpellBookSpell(null)}
    >
      <SquareImage src={`spell-icons/${spellClass.name}Icon_mockup.png`} draggable="false" alt="SpellImg" />
      <CanvasContainer>
        <AutomaticSpellCanvasComponent points={HARDCODED_SYMBOLS.get(inferenceString)} size={'4cqw'} drawSpeed={.3} loopDelay={4000} isLooped={isOpen} />
      </CanvasContainer>
    </ColumnGroup>))
  return (
    <MenuAnchor data-click-type="ui-buttons">
      <SparkleCanvasComponent />
        <TriggerBox
          onClick={() => setIsOpen(isOpen => {
            setIsClickedOnce(true);
            rootGameStore.setIsSpellBookOpen(!isOpen);
            if (!isOpen) rootGameStore.pauseClock();
            else rootGameStore.unpauseClock();
            return !isOpen;
          })}
          onMouseDown={() => setIsClicked(true)}
          onMouseUp={() => setIsClicked(false)}
          $isClicked={isClicked}
          $isOpen={isOpen}
          $isClickedOnce={isClickedOnce}
        >
          <CoverText
            $style={'padding-top: 1.5cqw;'}
            $isClickedOnce={isClickedOnce}
          >
            Spell
          </CoverText>
          <CoverText
            $isClickedOnce={isClickedOnce}
          >
            Book
          </CoverText>
        </TriggerBox>
      <SlidingTray $isOpen={isOpen}>
        {spells}
      </SlidingTray>
    </MenuAnchor >
  );
}