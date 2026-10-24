import { useEffect } from 'react';
import { rootGameStore } from '../DataClasses/store';
import { useSnapshot } from 'valtio';
import styled from 'styled-components';
import { EtchedFrame, GLASS, GOLD, GOLD_BRIGHT, GoldButton, GoldDivider, GoldLink, glassCss, goldTextCss } from './goldStyle';

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
  ${glassCss(GLASS.panelAlpha)}
  border-radius: 0.8cqw;
  padding: 3cqw;
  width: 80%;
  max-width: 800px;
  position: relative;
    
  height: 40cqw;

  display: flex;
  flex-direction: column; /* Changed to column to separate content from footer neatly */
  gap: 2cqw;
  box-shadow: 0 1cqw 3cqw rgba(0, 0, 0, 0.8), inset 0 0 2.5cqw rgba(0, 0, 0, 0.35), inset 0 0.12cqw 0 rgba(255, 255, 255, 0.16);
  color: #fff;
  > *:not(.frame) { position: relative; } /* (above the etched frame) */
  box-sizing: border-box;
  overflow: hidden; /* Hard guarantee that scrollbars never appear */
`;

const TextColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  text-align: left;
  overflow: hidden; /* Keeps the text bounded within the locked height bounds */

  h2 {
    margin: 0 0 0.6cqw;
    font-size: 5.2cqw;
    font-weight: normal;
    line-height: 1.1;
    font-family: 'EnchantedLand', sans-serif;
    ${goldTextCss}
    filter: drop-shadow(0 0 1cqw rgba(230, 197, 99, 0.3)) drop-shadow(0 0.2cqw 0.35cqw rgba(0, 0, 0, 0.85));
  }
  /* (the ornament under the title) */
  > span:first-of-type { margin-bottom: 1.6cqw; }

  p {
    margin: 0 0 1cqw 0;
    font-size: 1.4cqw;
    line-height: 1.5;
    color: #e6e1d6;
    font-family: 'Segoe UI', Calibri, 'Helvetica Neue', Helvetica, Arial, sans-serif;
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
    border: 0;//0.1cqw solid #333;
    object-fit: contain;
  }
`;

const CloseButton = styled(GoldLink)`
  position: absolute !important;
  top: 1.4cqw;
  right: 1.6cqw;
  font-size: 2cqw;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 0.8cqw;
  z-index: 1;
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
  border-top: 0.1cqw solid rgba(230, 197, 99, 0.25);
  padding-top: 1.5cqw;
`;

const PageIndicator = styled.span`
  font-size: 2.3cqw;
  color: rgba(230, 197, 99, 0.75);
  min-width: 4cqw;
  text-align: center;
  font-family: 'EnchantedLand', sans-serif;

`;

const NavArrow = styled.button<{ $disabled: boolean }>`
  background: transparent;
  border: none;
  color: ${props => props.$disabled ? '#444' : GOLD};
  font-size: 2cqw;
  cursor: ${props => props.$disabled ? 'default' : 'pointer'};
  opacity: ${props => props.$disabled ? 0.4 : 1};
  transition: color 0.2s, transform 0.2s;
  pointer-events: ${props => props.$disabled ? 'none' : 'auto'};
  padding: 0 1cqw;

  &:hover {
    color: ${GOLD_BRIGHT};
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


const TooltipModalComponent = () => {
  const snap = useSnapshot(rootGameStore);
  const isDoneWithIntro = snap.getIsDoneWithIntroWalk();
  const currTooltipPage = snap.getCurrPageContent();

  // The saved tooltips setting (on, if never chosen)
  useEffect(() => { rootGameStore.loadToolTips(); }, []);
  const isLore = snap.getIsLore();
  const isLoreChoice = isLore && snap.getIsLastTooltipPage();

  return !!currTooltipPage && !snap.getIsMatchOver() && (
    // The story can only be left by choosing (no Close, and clicking outside does nothing)
    <TooltipOverlay $isDoneWithIntro={isDoneWithIntro} onClick={isLore ? undefined : () => rootGameStore.closeTooltip()}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <EtchedFrame />
        {!isLore && <CloseButton onClick={() => rootGameStore.closeTooltip()}>Close{" "}<CloseSymbol /></CloseButton>}
        <div style={{ display: 'flex', flexDirection: 'row', gap: '3cqw', width: '100%', flex: 1, overflow: 'hidden' }}>
          {(currTooltipPage.title || currTooltipPage.paragraphs) && (
            <TextColumn>
              {currTooltipPage.title && <><h2>{currTooltipPage.title}</h2><GoldDivider width={20} align='left' /></>}
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
              onClick={() => rootGameStore.prevTooltipPage()}
            >
              &#9664;
            </NavArrow>
            <PageIndicator>
              {snap.getMultiPageProgress()}
            </PageIndicator>
            <NavArrow
              $disabled={snap.getIsNextDisabled()}
              onClick={() => rootGameStore.nextTooltipPage()}
            >
              &#9654;
            </NavArrow>
          </FooterControls>
        )}
        {/* The story's last page: play with tooltips or without (saved for next time) */}
        {isLoreChoice && (
          <ChoiceControls>
            <GoldButton isPrimary onClick={() => rootGameStore.chooseToolTips(true)}>Play with tooltips</GoldButton>
            <GoldButton onClick={() => rootGameStore.chooseToolTips(false)}>Play</GoldButton>
          </ChoiceControls>
        )}
      </ModalContent>
    </TooltipOverlay>
  )
}

export default TooltipModalComponent;
