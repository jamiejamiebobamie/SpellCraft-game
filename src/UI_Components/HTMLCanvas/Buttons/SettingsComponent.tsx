import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { rootGameStore } from '../../../DataClasses/store';
import { UIFadeIn } from '../../UIFadeIn';
import { useSnapshot } from 'valtio';

const MenuAnchor = styled(UIFadeIn) < { $isShowingModal: boolean } > `
  display: ${props => props.$isShowingModal ? 'none' : 'initial'};
  position: absolute;
  bottom: -4cqw;   
  left: 42.8cqw;
  z-index: 35;
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

const SubIcons = styled.div<{ $angle: number }>`
  width: 4.5cqw;
  height: 4.5cqw;
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
  font-size: 2.2cqw;
  
  /* Radial layout placement mechanics using polar coordinates */
  /* Distance radius is set safely to 5.8cqw from the gear axis */
  transform: translate(-50%, -50%) 
             rotate(${props => props.$angle}deg) 
             translate(0, -5.8cqw) 
             rotate(-${props => props.$angle}deg);

  transition: transform 0.2s ease-out, filter 0.2s, border-color 0.2s;

  /* Global hover and active feedback configurations for elements */
  &:hover {
    border-color: #e6c563;
    transform: translate(-50%, -50%) 
               rotate(${props => props.$angle}deg) 
               translate(0, -6.1cqw) /* Pops outward visually on hover */
               rotate(-${props => props.$angle}deg) 
               scale(1.15);
  }

  &:active {
    transform: translate(-50%, -50%) 
               rotate(${props => props.$angle}deg) 
               translate(0, -5.8cqw) 
               rotate(-${props => props.$angle}deg) 
               scale(0.95);
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
  'SEE_TOOLTIPS': '👁️'
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
  const isDoneWithIntro = snap.getIsDoneWithIntroWalk();

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
    <MenuAnchor $isDoneWithIntro={isDoneWithIntro} onMouseLeave={() => setIsClicked(false)} $isShowingModal={isShowingModal} data-click-type="ui-buttons">
      <TriggerBox
        onMouseUp={() => setIsClicked(bool => !bool)}
        $isClicked={isClicked} title={'Settings'} />
      {isClicked && <SubIconGroup>
        <SubIcons
          $angle={270}
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
          $angle={335}
          onMouseUp={() => { rootGameStore.toggleToolTips(true); rootGameStore.showTooltip(); }}
          title={'See tooltips'}
        >
          {SUB_ICONS.SEE_TOOLTIPS}
        </SubIcons>
        <SubIcons
          $angle={25}
          title='See keyboard controls'
          onMouseEnter={() => setIsGearHovered(true)}
          onMouseLeave={() => setIsGearHovered(false)}
        >
          {SUB_ICONS.KEYBOARD_CONTROLS}
        </SubIcons>
        <SubIcons
          $angle={90}
          onMouseUp={() => {
            const isMusicMuted = rootGameStore.getIsMusicMuted();
            rootGameStore.toggleAudio('music');
            window.localStorage.setItem('quickCast-musicVolumeOff', JSON.stringify(!isMusicMuted));
          }}
          title={`${isMusicMuted ? 'Turn-on' : 'Turn-off'} music audio`}
        >
          {isMusicMuted ? SUB_ICONS.MUSIC_OFF : SUB_ICONS.MUSIC_ON}
        </SubIcons>
      </SubIconGroup>}
    </MenuAnchor >
  );
}
