import { useEffect } from 'react';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled from 'styled-components';

const TooltipOverlay = styled.div<{ $isDoneWithIntro: boolean }>`
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
  ${props => props.$isDoneWithIntro && 'background: rgba(0, 0, 0, 0.7);'}

`;

const ModalContent = styled.div`
  // background: #1a1a1a;
  background: #1a1a1a75;
  border: 0.2cqw solid #444;
  border-radius: 0.8cqw;
  padding: 3cqw;
  width: 80%;
  max-width: 800px;
  position: relative;
    
  height: 40cqw;

  display: flex;
  flex-direction: column; /* Changed to column to separate content from footer neatly */
  gap: 2cqw;
  box-shadow: 0 1cqw 3cqw rgba(0, 0, 0, 0.8);
  color: #fff;
  box-sizing: border-box;
  overflow: hidden; /* Hard guarantee that scrollbars never appear */
`;

// const StyledHeader = styled.h2`
//   font-family: 'EnchantedLand', sans-serif;
// `;

const TextColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  text-align: left;
  overflow: hidden; /* Keeps the text bounded within the locked height bounds */

  h2 {
    margin-top: 0;
    margin-bottom: 1.5cqw;
    font-size: 5.2cqw;
    color: #e6c563;
    // font-family: sans-serif;
    font-family: 'EnchantedLand', sans-serif;
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
  align-items: center;
  gap: 0.8cqw;

  &:hover {
    color: #fff;
  }
`;

const CloseSymbol = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  &::before {
    content: "\\00d7";
    font-size: 4cqw;
    line-height: 0;
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
  font-size: 2.3cqw;
  color: #aaa;
  // font-family: sans-serif;
  min-width: 4cqw;
  text-align: center;
  font-family: 'EnchantedLand', sans-serif;

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

const ChoiceControls = styled.div`
  display: flex;
  justify-content: center;
  gap: 2cqw;
  margin-top: 1.5cqw;
  width: 100%;
`;

const ChoiceButton = styled.button<{ $isPrimary: boolean }>`
  font-family: 'EnchantedLand', sans-serif;
  font-size: 2.2cqw;
  padding: 0.6cqw 2.2cqw;
  border-radius: 0.5cqw;
  border: 0.15cqw solid #e6c563;
  background: ${props => props.$isPrimary ? 'rgba(230, 197, 99, 0.18)' : 'transparent'};
  color: #e6c563;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, transform 0.2s;

  &:hover {
    background: rgba(230, 197, 99, 0.32);
    color: #fff;
    transform: scale(1.04);
  }
`;

const TooltipModalComponent = () => {
  const snap = useSnapshot(rootGameStore);
  const isDoneWithIntro = snap.getIsDoneWithIntroWalk();
  const currTooltipPage = snap.getCurrPageContent();

  // The saved tooltips setting (on, if never chosen)
  useEffect(() => { rootGameStore.loadToolTips(); }, []);
  const isLore = snap.getIsLore();
  const isLoreChoice = isLore && snap.getIsLastTooltipPage();

  return !!currTooltipPage && (
    // The story can only be left by choosing (no Close, and clicking outside does nothing)
    <TooltipOverlay $isDoneWithIntro={isDoneWithIntro} onClick={isLore ? undefined : rootGameStore.closeTooltip}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        {!isLore && <CloseButton onClick={rootGameStore.closeTooltip}>Close{" "}<CloseSymbol /></CloseButton>}
        <div style={{ display: 'flex', flexDirection: 'row', gap: '3cqw', width: '100%', flex: 1, overflow: 'hidden' }}>
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
              onClick={rootGameStore.prevTooltipPage}
            >
              &#9664;
            </NavArrow>
            <PageIndicator>
              {snap.getMultiPageProgress()}
            </PageIndicator>
            <NavArrow
              $disabled={snap.getIsNextDisabled()}
              onClick={rootGameStore.nextTooltipPage}
            >
              &#9654;
            </NavArrow>
          </FooterControls>
        )}
        {/* The story's last page: play with tooltips or without (saved for next time) */}
        {isLoreChoice && (
          <ChoiceControls>
            <ChoiceButton $isPrimary onClick={() => rootGameStore.chooseToolTips(true)}>Play with tooltips</ChoiceButton>
            <ChoiceButton $isPrimary={false} onClick={() => rootGameStore.chooseToolTips(false)}>Play</ChoiceButton>
          </ChoiceControls>
        )}
      </ModalContent>
    </TooltipOverlay>
  )
}

export default TooltipModalComponent;
