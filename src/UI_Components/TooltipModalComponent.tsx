import React, { useEffect } from 'react';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled from 'styled-components';

const TooltipOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4cqw;
  box-sizing: border-box;
  z-index: 9999; /* Top-level item */
`;

const ModalContent = styled.div`
  background: #1a1a1a;
  border: 0.2cqw solid #444;
  border-radius: 0.8cqw;
  padding: 3cqw;
  width: 80%;
  max-width: 800px;
  position: relative;
  display: flex;
  flex-direction: row;
  gap: 3cqw;
  box-shadow: 0 1cqw 3cqw rgba(0, 0, 0, 0.8);
  color: #fff;
  box-sizing: border-box;
`;

const TextColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  text-align: left;

  h2 {
    margin-top: 0;
    margin-bottom: 1.5cqw;
    font-size: 2.2cqw;
    color: #e6c563;
    font-family: sans-serif;
  }

  p {
    margin: 0 0 1cqw 0;
    font-size: 1.3cqw;
    line-height: 1.5;
    color: #e0e0e0;
    font-family: sans-serif;
  }
`;

const MediaColumn = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    max-width: 25cqw;
    max-height: 25cqw;
    border-radius: 0.4cqw;
    border: 0.1cqw solid #333;
    object-fit: contain;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1cqw;
  right: 1cqw;
  background: transparent;
  border: none;
  color: #888;
  font-size: 2cqw;
  cursor: pointer;
  line-height: 1;
  padding: 0.2cqw;
  transition: color 0.2s;

  font-family: 'EnchantedLand', sans-serif;

  display: flex;

  &:hover {
    color: #fff;
  }
`;

const CloseSymbol = styled.span`
  &::before{
    content: "\\00d7";
    font-size: 5cqw;
  }
`;

const FooterControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2cqw;
  margin-top: 2cqw;
  width: 100%;
  border-top: 0.1cqw solid #333;
  padding-top: 1.5cqw;
`;

const PageIndicator = styled.span`
  font-size: 1.2cqw;
  color: #aaa;
  font-family: sans-serif;
  min-width: 4cqw;
  text-align: center;
`;

const NavArrow = styled.button<{ $disabled: boolean }>`
  background: transparent;
  border: none;
  color: ${props => props.$disabled ? '#444' : '#e6c563'};
  font-size: 2cqw;
  cursor: ${props => props.$disabled ? 'default' : 'pointer'};
  opacity: ${props => props.$disabled ? 0.4 : 1};
  transition: color 0.2s, transform 0.2s;
  pointer-events: ${props => props.$disabled ? 'none' : 'auto'};
  padding: 0 1cqw;

  &:hover {
    color: #fff;
    transform: ${props => props.$disabled ? 'none' : 'scale(1.2)'};
  }
`;

const TooltipModalComponent = () => {
  const snap = useSnapshot(rootGameStore);
  const currTooltipPage = snap.getCurrPageContent();

  useEffect(() => {
    const item = window.localStorage.getItem('quickCast-isToolTips');
    let isToolTips = undefined;
    try {
      if (item)
        isToolTips = JSON.parse(item);
    } catch (error) {
      console.warn(`Error reading localStorage key :`, error);
    }
    if (isToolTips === true || isToolTips === undefined) {
      rootGameStore.toggleToolTips(true);
    } else {
      rootGameStore.toggleToolTips(false);
    }
  }, []);

  return !!currTooltipPage && (
    <TooltipOverlay onClick={rootGameStore.closeTooltip}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={rootGameStore.closeTooltip}>Close{" "}<CloseSymbol /></CloseButton>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '3cqw', width: '100%' }}>
          {(currTooltipPage.title || currTooltipPage.paragraphs) && (
            <TextColumn>
              {currTooltipPage.title && <h2>{currTooltipPage.title}</h2>}
              {currTooltipPage.paragraphs && currTooltipPage.paragraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </TextColumn>
          )}
          {currTooltipPage.mediaUrl && (
            <MediaColumn>
              <img
                src={currTooltipPage.mediaUrl}
                alt={currTooltipPage.title ? `${currTooltipPage.title} tutorial graphic` : 'Tutorial graphic'}
              />
            </MediaColumn>
          )}
        </div>
        {snap.getIsMultiPage() && (
          <FooterControls>
            <NavArrow
              $disabled={snap.getIsPrevDisabled()}
              onClick={() => {
                rootGameStore.prevTooltipPage();
                console.log('hey!')
              }}
            >
              &#9664;
            </NavArrow>
            <PageIndicator>
              {snap.getMultiPageProgress()}
            </PageIndicator>
            <NavArrow
              $disabled={snap.getIsNextDisabled()}
              onClick={() => {
                rootGameStore.nextTooltipPage();
                console.log('click!')
              }}
            >
              &#9654;
            </NavArrow>
          </FooterControls>
        )}
      </ModalContent>
    </TooltipOverlay>
  )
}

export default TooltipModalComponent;
