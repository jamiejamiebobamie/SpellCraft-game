import { useState } from 'react';
import { rootGameStore } from '../../../DataClasses/store';
import { useSnapshot } from 'valtio';
import { UIFadeIn } from '../../UIFadeIn';
import { LAYERS } from '../../layers';
import styled, { css, keyframes } from 'styled-components';

const repeatingGlow = keyframes`
  0% { filter: drop-shadow(0 0 .01cqw rgba(248, 255, 54, 0.6)) drop-shadow(0 0 .03cqw rgba(250, 244, 144, 0.3)) drop-shadow(0 0 .5cqw rgba(6, 6, 1, 0.56)); }
  50% { filter: drop-shadow(0 0 .1cqw rgba(248, 255, 54, 0.6)) drop-shadow(0 0 .3cqw rgba(250, 244, 144, 0.3)) drop-shadow(0 0 .5cqw rgba(6, 6, 1, 0.56)); }
  100% { filter: drop-shadow(0 0 .01cqw rgba(248, 255, 54, 0.6)) drop-shadow(0 0 .03cqw rgba(250, 244, 144, 0.3)) drop-shadow(0 0 .5cqw rgba(6, 6, 1, 0.56)); }
`;

// The Main Absolute Anchor
const MenuAnchor = styled(UIFadeIn)<{ $isGearHovered: boolean }>`
  position: absolute;
  top: 2cqw;
  left: 3cqw; 
  /* beneath the canvas while it shows the keyboard controls, which then cover it (layers.ts) */
  z-index: ${props => props.$isGearHovered ? LAYERS.buttonUnderOverlay : LAYERS.button};
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
  font-size: 100%;
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

/**
 * "Spell" and "Book" on the cover, drawn as SVG text: placed by their baselines (each line's right end
 * and baseline, in cqw from the button's top left), so they sit the same in every browser. As HTML
 * text, where a line sits depends on the font's metrics, which iOS reads differently from Windows
 * (the words slipped down on iPhones).
 */
const COVER_TEXT = { size: 2.5, right: 6.3, lines: [{ text: 'Spell', baseline: 3.53 }, { text: 'Book', baseline: 5.53 }] };

const CoverText = styled.svg`
  display: block;
  width: 6cqw;
  height: 4cqw;
  overflow: visible;
  fill: currentColor;
  font-family: 'EnchantedLand', sans-serif;
  letter-spacing: normal; /* (the page's 0.18px would be read in this SVG's units, cqw: far too wide) */
  filter: drop-shadow(0 0 0.1cqw rgba(248, 255, 54, 0.3))
          drop-shadow(0 0 0.3cqw rgba(250, 245, 144, 0.14));
`;

type SpellBookComponentProps = { isGearHovered: boolean }
export default function SpellBookComponent({ isGearHovered }: SpellBookComponentProps) {
  const snap = useSnapshot(rootGameStore);
  const isOpen = snap.getIsSpellBookOpen();
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const [isClickedOnce, setIsClickedOnce] = useState<boolean>(false);
  const isDoneWithIntro = snap.getIsDoneWithIntroWalk();


  return (
    <MenuAnchor $isDoneWithIntro={isDoneWithIntro} $isGearHovered={isGearHovered} data-click-type="ui-buttons">
      <TriggerBox
        onClick={() => {
          rootGameStore.setIsSpellBookOpen();
          setIsClickedOnce(true);
        }}
        onMouseDown={() => setIsClicked(true)}
        onMouseUp={() => setIsClicked(false)}
        $isClicked={isClicked}
        $isOpen={isOpen}
        $isClickedOnce={isClickedOnce}
        title={`${isOpen ? 'Close' : 'Open'} book`}
      >
        {/* (its units: cqw) */}
        <CoverText viewBox='0 0 6 4' aria-hidden>
          {COVER_TEXT.lines.map(({ text, baseline }) => (
            <text key={text} x={COVER_TEXT.right} y={baseline} fontSize={COVER_TEXT.size} textAnchor='end'>{text}</text>
          ))}
        </CoverText>
      </TriggerBox>
    </MenuAnchor >
  );
}