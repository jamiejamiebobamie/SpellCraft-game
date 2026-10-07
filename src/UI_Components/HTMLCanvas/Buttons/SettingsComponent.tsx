import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { rootGameStore } from '../../../DataClasses/store';
import { useSnapshot } from 'valtio';

const MenuAnchor = styled.div<{ $isShowingModal: boolean }>`
  display:${props => props.$isShowingModal ? 'none' : 'initial'};
  position: absolute;
  bottom: 1cqw;   
  left: 47.5cqw; 
  z-index: 35;
  filter: brightness(${props => props.$isShowingModal ? .55 : 1});
`;

const TriggerBox = styled.div<{ $isClicked: boolean }>`
  width: 5.5cqw;
  height: 5.5cqw;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  color: white;
  font-weight: bold;
  font-size: 2cqw;
  z-index: 3; /* Sits higher than the tray */
  position: relative; /* Gives it local z-index priority */
  cursor: pointer;
  font-family: 'EnchantedLand', sans-serif;
  font-size: 2.5cqw;
  transition: filter 1s, transform .5s;
  ${MenuAnchor}:hover & {
    transform: scale(1.1);
    ${props => props.$isClicked && 'transform: scale(.9);'}
  }

  &::before{
    position: absolute;
    top: 3cqw;
    left: 50%;
    color: grey;
    content: '\u2699\uFE0F';
    transform: translate(-50%,-50%);
    filter: brightness(.5) drop-shadow(.2cqw .2cqw .3cqw black);
    font-size: 5cqw;
  }
`;

const SubIconGroup = styled.div`
  position: absolute;
  bottom: 0;
  transform: translateX(-42.5%);

  width: 35.5cqw;
  height: 7cqw;
  display: flex;
  align-self: center;
  justify-content: space-around;

  font-family: 'EnchantedLand', sans-serif;
  white-space: nowrap;
`;

const SubIcons = styled.div<{ $content: string }>`
  width: 10.5cqw;
  height: 1.5cqw;
  position: relative;
  display: flex;
  cursor: pointer;

  &:nth-child(odd){ top: 5cqw; }
  &:nth-child(even) { top: -2cqw; }

  &::before{
  color: white;
    position: absolute;
    top: 50%; 
    left: 50%;
    color: grey;
    content: '${props => props.$content}';
    transform: translate(-50%,-50%);
    filter: brightness(.5) drop-shadow(.2cqw .2cqw .3cqw black);
    font-size: 3cqw;
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
        // Sound is not muted by default, so toggle to muted.
        i == 0 ? rootGameStore.toggleAudio('fx', isMuted) : rootGameStore.toggleAudio('music', isMuted);
      }
    });
  }, []);

  return (
    <MenuAnchor onMouseLeave={() => setIsClicked(false)} $isShowingModal={isShowingModal} data-click-type="ui-buttons">
      <TriggerBox
        onMouseUp={() => setIsClicked(bool => !bool)}
        $isClicked={isClicked} title={'Settings'} />
      {isClicked && <SubIconGroup>
        <SubIcons
          onMouseUp={() => {
            const isFxMuted = rootGameStore.getIsFxMuted();
            rootGameStore.toggleAudio('fx');
            window.localStorage.setItem('quickCast-fxVolumeOff', JSON.stringify(!isFxMuted));
          }}
          title={`${isFxMuted ? 'Turn-on' : 'Turn-off'} sound effects audio`}
          $content={`${isFxMuted ? SUB_ICONS.FX_OFF : SUB_ICONS.FX_ON}FX`}
        />
        <SubIcons
          title='See keyboard controls'
          onMouseEnter={() => setIsGearHovered(true)}
          onMouseLeave={() => setIsGearHovered(false)}
          $content={SUB_ICONS.KEYBOARD_CONTROLS}
        />
        <SubIcons
          onMouseUp={() => {
            const isMusicMuted = rootGameStore.getIsMusicMuted();
            rootGameStore.toggleAudio('music');
            window.localStorage.setItem('quickCast-musicVolumeOff', JSON.stringify(!isMusicMuted));
          }}
          title={`${isMusicMuted ? 'Turn-on' : 'Turn-off'} music audio`}
          $content={`${isMusicMuted ? SUB_ICONS.MUSIC_OFF : SUB_ICONS.MUSIC_ON}MUSIC`} />

      </SubIconGroup>}
    </MenuAnchor >
  );
}