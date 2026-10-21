import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { rootGameStore } from '../../../DataClasses/store';
import { UIFadeIn } from '../../UIFadeIn';
import { useSnapshot } from 'valtio';
import { cursorSettings, toggleCanvasWand } from '../../cursors';

/**
 * How the settings buttons show: 'row', always there in a row along the bottom (no gear); 'gear', hidden
 * behind the gear, swinging out around it on hover.
 */
export const SETTINGS_LAYOUT: 'row' | 'gear' = 'row' as 'row' | 'gear';
/** The row: the space between the buttons' centers, and the buttons' size (cqw). */
const ROW = { spacing: 4.6, size: 3.6 };

const MenuAnchor = styled(UIFadeIn) < { $isShowingModal: boolean } > `
  display: ${props => props.$isShowingModal ? 'none' : 'initial'};
  position: absolute;
  bottom: -4cqw;   
  left: 42.8cqw;
  z-index: 35;
  ${SETTINGS_LAYOUT === 'row' ? 'pointer-events: none; /* only the buttons take the mouse, not the space around them */' : ''}
  filter: brightness(${props => props.$isShowingModal ? .55 : 1});
    width: 15.5cqw;
    height: 15.5cqw;
`;

const TriggerBox = styled.div < { $isClicked: boolean } > `
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: -1; /* Always sits higher than the trailing layout ring */
  position: relative;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.9);
  }

  &::before {
    position: absolute;
    top: 50%;
    left: 50%;
    color: #a0a0a0;
    content: '\u2699\uFE0F';
    transform: translate(-50%, -50%) ${props => props.$isClicked ? 'rotate(45deg)' : 'rotate(0deg)'};
    filter: ${props => props.$isClicked ? 'brightness(1.2)' : 'brightness(.7)'} drop-shadow(.2cqw .2cqw .3cqw black);
    font-size: 5cqw;
    line-height: 0;
    transition: transform 0.4s ease-out, filter 0.2s;
  }
`;

/* Pinpoints the layout grid center exactly to the core axle of the gear wheel */
const SubIconGroup = styled.div`
  position: absolute;
  top: 50%; 
  left: 50%;
  transform: translate(-50%, -50%);
  width: 0;
  height: 0;
  z-index: 2;
`;

/**
 * Opening the gear swings the buttons up into place around it, as if they turn with it; closing swings
 * them back down out of sight (SWING_DEGREES, one after another by SWING_STAGGER_SECONDS).
 */
const SWING_DEGREES = 160;
/** How long the buttons stay after the mouse leaves (so slipping off a button for a moment doesn't close them). */
const CLOSE_DELAY_MILLI = 500;
const SWING_SECONDS = 0.45;
const SWING_STAGGER_SECONDS = 0.04;

const SubIcons = styled.div<{ $angle: number; $isOpen: boolean; $order: number; $rowX: number | null }>`
  /* --at: where it is on its way round (its place when open; swung back below the gear when closed) */
  --at: ${props => props.$isOpen ? props.$angle : props.$angle - SWING_DEGREES}deg;
  opacity: ${props => props.$isOpen ? 1 : 0};
  pointer-events: ${props => props.$isOpen ? 'auto' : 'none'};
  width: ${props => props.$rowX === null ? 4.5 : ROW.size}cqw;
  height: ${props => props.$rowX === null ? 4.5 : ROW.size}cqw;
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  
  /* Geometric formatting layout fixing the visual emoji shifts */
  background: rgba(20, 20, 20, 0.85);
  border: 0.15cqw solid #444;
  border-radius: 50%;
  box-shadow: 0 .2cqw .5cqw rgba(0,0,0,0.6);
  font-size: ${props => props.$rowX === null ? 2.2 : 1.8}cqw;
  
  /* Radial layout placement mechanics using polar coordinates */
  /* Distance radius is set safely to 5.8cqw from the gear axis */
  transform: translate(-50%, -50%) 
             rotate(var(--at)) 
             translate(0, -5.8cqw) 
             rotate(calc(-1 * var(--at)));
  ${props => props.$rowX !== null && `transform: translate(calc(-50% + ${props.$rowX}cqw), -50%);`}

  transition:
    transform ${SWING_SECONDS}s cubic-bezier(0.34, 1.3, 0.64, 1) ${props => props.$order * SWING_STAGGER_SECONDS}s,
    opacity ${SWING_SECONDS * 0.6}s ease-out ${props => props.$order * SWING_STAGGER_SECONDS}s,
    filter 0.2s, border-color 0.2s;

  /* Global hover and active feedback configurations for elements */
  &:hover {
    border-color: #e6c563;
    transition: transform 0.2s ease-out, filter 0.2s, border-color 0.2s;
    transform: translate(-50%, -50%) 
               rotate(var(--at)) 
               translate(0, -6.1cqw) /* Pops outward visually on hover */
               rotate(calc(-1 * var(--at))) 
               scale(1.15);
    ${props => props.$rowX !== null && `transform: translate(calc(-50% + ${props.$rowX}cqw), -60%) scale(1.15);`}
  }

  &:active {
    transform: translate(-50%, -50%) 
               rotate(var(--at)) 
               translate(0, -5.8cqw) 
               rotate(calc(-1 * var(--at))) 
               scale(0.95);
    ${props => props.$rowX !== null && `transform: translate(calc(-50% + ${props.$rowX}cqw), -50%) scale(0.95);`}
  }
`;

type SettingsComponentComponentProps = {
  isShowingModal: boolean;
  setIsGearHovered: Function;
}

const SUB_ICONS = {
  'FX_ON': '🔊', 'FX_OFF': '🔇',
  'MUSIC_ON': '🔊', 'MUSIC_OFF': '🔇',
  'KEYBOARD_CONTROLS': '⌨️',
  'SEE_TOOLTIPS': '👁️',
  'CANVAS_WAND': '🪄',
}

const localStorageKeys = [
  'quickCast-fxVolumeOff',
  'quickCast-musicVolumeOff'
]

export default function SettingsComponent({ isShowingModal, setIsGearHovered }: SettingsComponentComponentProps) {
  const snap = useSnapshot(rootGameStore);
  const isMusicMuted = snap.getIsMusicMuted();
  const isFxMuted = snap.getIsFxMuted();
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const [isShowingKeys, setIsShowingKeys] = useState<boolean>(false); // the keyboard controls overlay
  const isToolTips = snap.getIsTooltips();
  const isDoneWithIntro = snap.getIsDoneWithIntroWalk();
  const isCanvasWand = useSnapshot(cursorSettings).isCanvasWand;

  // Shown while hovered: leaving closes them after a moment, and coming back (to the gear or any
  // button) in that moment keeps them open
  const closeTimeout = useRef<number | undefined>(undefined);
  const keepOpen = () => clearTimeout(closeTimeout.current);
  const open = () => { keepOpen(); setIsClicked(true); };
  const closeSoon = () => {
    clearTimeout(closeTimeout.current);
    closeTimeout.current = setTimeout(() => setIsClicked(false), CLOSE_DELAY_MILLI);
  };
  useEffect(() => () => clearTimeout(closeTimeout.current), []);
  // The buttons, left to right (around the gear, each with its place and swing order; or in a row)
  const isRow = SETTINGS_LAYOUT === 'row';
  const isOpen = isRow || isClicked;
  const at = (order: number) => ({ $angle: 270 + order * 45, $order: order, $isOpen: isOpen, $rowX: isRow ? (order - 2) * ROW.spacing : null });

  useEffect(() => {
    localStorageKeys.forEach((k, i) => {
      const item = window.localStorage.getItem(k);
      let isMuted = undefined;
      try {
        if (item)
          isMuted = JSON.parse(item);
      } catch (error) {
        console.warn(`Error reading localStorage key :`, error);
      }
      if (isMuted) {
        i == 0 ? rootGameStore.toggleAudio('fx', isMuted) : rootGameStore.toggleAudio('music', isMuted);
      }
    });
  }, []);

  return (
    <MenuAnchor $isDoneWithIntro={isDoneWithIntro} onMouseEnter={keepOpen} onMouseLeave={closeSoon} $isShowingModal={isShowingModal} data-click-type="ui-buttons">
      {/* Opens on hover (not mid-drawing, when the mouse may just be passing over) or on click */}
      {!isRow && <TriggerBox
        onMouseEnter={() => { if (!rootGameStore.getIsDrawing()) open(); }}
        onMouseUp={open}
        $isClicked={isClicked} title={'Settings'} />}
      {/* Always there, so they can swing in and out (hidden and unclickable while closed) */}
      <SubIconGroup>
        <SubIcons
          {...at(0)}
          onMouseUp={() => {
            const isFxMuted = rootGameStore.getIsFxMuted();
            rootGameStore.toggleAudio('fx');
            window.localStorage.setItem('quickCast-fxVolumeOff', JSON.stringify(!isFxMuted));
          }}
          title={`${isFxMuted ? 'Turn-on' : 'Turn-off'} sound effects audio`}
        >
          {isFxMuted ? SUB_ICONS.FX_OFF : SUB_ICONS.FX_ON}
        </SubIcons>
        <SubIcons
          {...at(1)}
          onMouseUp={() => rootGameStore.toggleToolTips()}
          title={isToolTips ? 'Turn off tooltips' : 'Turn on tooltips'}
          style={{ opacity: isOpen ? (isToolTips ? 1 : 0.45) : 0 }}
        >
          {SUB_ICONS.SEE_TOOLTIPS}
        </SubIcons>
        <SubIcons
          {...at(2)}
          title='See keyboard controls'
          // Shown on a click (a second click hides them), hidden once the mouse leaves the button
          onMouseUp={() => { const isShowing = !isShowingKeys; setIsShowingKeys(isShowing); setIsGearHovered(isShowing); }}
          onMouseLeave={() => { setIsShowingKeys(false); setIsGearHovered(false); }}
        >
          {SUB_ICONS.KEYBOARD_CONTROLS}
        </SubIcons>
        <SubIcons
          {...at(3)}
          onMouseUp={toggleCanvasWand}
          title={isCanvasWand ? 'Use the regular cursor' : 'Use the wand cursor'}
          style={{ opacity: isOpen ? (isCanvasWand ? 1 : 0.45) : 0 }}
        >
          {SUB_ICONS.CANVAS_WAND}
        </SubIcons>
        <SubIcons
          {...at(4)}
          onMouseUp={() => {
            const isMusicMuted = rootGameStore.getIsMusicMuted();
            rootGameStore.toggleAudio('music');
            window.localStorage.setItem('quickCast-musicVolumeOff', JSON.stringify(!isMusicMuted));
          }}
          title={`${isMusicMuted ? 'Turn-on' : 'Turn-off'} music audio`}
        >
          {isMusicMuted ? SUB_ICONS.MUSIC_OFF : SUB_ICONS.MUSIC_ON}
        </SubIcons>
      </SubIconGroup>
    </MenuAnchor >
  );
}
