// LightTipCard.tsx
// The tutorial's light tips: a small card pointing at part of the screen (its caret's tip at the
// anchor), in the tooltip modal's style. It doesn't pause the game; it closes with its ×, or when the
// player does what it describes (TooltipManager). LightTipLayer shows the current one, above the
// drawing canvas so its × can be clicked; the layer itself lets clicks through to the game.
import styled, { keyframes } from 'styled-components';
import { useSnapshot } from 'valtio';
import { rootGameStore } from '../DataClasses/store';
import { LIGHT_TIPS, TipAnchor } from '../DataClasses/TooltipManager/TooltipManager';

const CARD_WIDTH = 24; // cqw
const CARET = { length: 1, halfWidth: 0.8 }; // cqw
const GAP = 0.2; // between the caret's tip and the anchor (cqw)

const popIn = keyframes`
  0% { opacity: 0; transform: scale(0.9); }
  70% { opacity: 1; transform: scale(1.03); }
  100% { opacity: 1; transform: scale(1); }
`;

/** Places the card so its caret, on the side facing the anchor, ends at the anchor. */
const placement = ({ x, y, caret, caretOffset }: TipAnchor): string => {
  const reach = CARET.length + GAP;
  switch (caret) {
    case 'down': return `left: ${x - caretOffset}cqw; bottom: calc(100% - ${y - reach}cqw);`; // above the anchor
    case 'up': return `left: ${x - caretOffset}cqw; top: ${y + reach}cqw;`; // below it
    case 'right': return `left: ${x - reach - CARD_WIDTH}cqw; top: ${y - caretOffset}cqw;`; // to its left
    case 'left': return `left: ${x + reach}cqw; top: ${y - caretOffset}cqw;`; // to its right
  }
};

/** The caret: a small gold triangle on the card's side facing the anchor. */
const caretCss = ({ caret, caretOffset }: TipAnchor): string => {
  const { length, halfWidth } = CARET;
  const side = `${halfWidth}cqw solid transparent`, point = `${length}cqw solid #6b5a2e`;
  switch (caret) {
    case 'down': return `left: ${caretOffset - halfWidth}cqw; top: 100%; border-left: ${side}; border-right: ${side}; border-top: ${point};`;
    case 'up': return `left: ${caretOffset - halfWidth}cqw; bottom: 100%; border-left: ${side}; border-right: ${side}; border-bottom: ${point};`;
    case 'right': return `top: ${caretOffset - halfWidth}cqw; left: 100%; border-top: ${side}; border-bottom: ${side}; border-left: ${point};`;
    case 'left': return `top: ${caretOffset - halfWidth}cqw; right: 100%; border-top: ${side}; border-bottom: ${side}; border-right: ${point};`;
  }
};

const Layer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 40; /* above the drawing canvas (29), so the card's × can be clicked */
  pointer-events: none; /* everywhere else, clicks go through to the game */
`;

const Card = styled.div<{ $anchor: TipAnchor }>`
  position: absolute;
  ${props => placement(props.$anchor)}
  width: ${CARD_WIDTH}cqw;
  padding: 0.9cqw 1.1cqw 1cqw;
  box-sizing: border-box;
  text-align: left;
  background: rgba(20, 20, 20, 0.88);
  border: 0.15cqw solid #6b5a2e;
  border-radius: 0.7cqw;
  box-shadow: 0 0.4cqw 1.2cqw rgba(0, 0, 0, 0.6), 0 0 1cqw rgba(230, 197, 99, 0.15);
  pointer-events: auto;
  animation: ${popIn} 0.45s ease-out;

  &::after {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    ${props => caretCss(props.$anchor)}
  }
`;

const Title = styled.div`
  font-family: 'EnchantedLand', sans-serif;
  font-size: 1.9cqw;
  line-height: 1;
  color: #e6c563;
  margin-bottom: 0.4cqw;
  padding-right: 1.6cqw; /* room for the × */
`;

const Text = styled.p`
  margin: 0;
  font-family: sans-serif;
  font-size: 1.05cqw;
  line-height: 1.35;
  color: #e0e0e0;
`;

const Close = styled.button`
  position: absolute;
  top: 0.4cqw;
  right: 0.5cqw;
  padding: 0 0.3cqw;
  border: none;
  background: transparent;
  color: #999;
  font-size: 1.5cqw;
  line-height: 1;
  cursor: pointer;
  &:hover { color: #e6c563; }
`;

/** The light tips showing (usually one), each pointing at its anchor. */
export default function LightTipLayer() {
  const snap = useSnapshot(rootGameStore);
  // (hidden while the Spell Book or the keyboard controls are open, so they never cover them; back after)
  const tipIds = snap.getIsSpellBookOpen() || snap.getIsKeyboardControlsShown() || snap.getIsMatchOver() ? [] : snap.getLightTips();
  return (
    <Layer>
      {tipIds.map(tipId => {
        const tip = LIGHT_TIPS[tipId];
        return (
          <Card key={tipId} $anchor={tip.anchor} role='status' data-click-type='ui-buttons'>
            <Close onClick={() => rootGameStore.dismissLightTip(tipId)} aria-label='Close tip' title='Close'>×</Close>
            <Title>{tip.title}</Title>
            <Text>{tip.text}</Text>
          </Card>
        );
      })}
    </Layer>
  );
}
