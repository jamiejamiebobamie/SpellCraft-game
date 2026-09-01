import React from 'react';
import styled from 'styled-components';

const SpellInfoArea = styled.div`
  flex-grow: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1cqw 3cqw;
  height: 100%;
  box-sizing: border-box;
  gap: 2cqw;
`;

const StatsContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5cqw;
  flex-grow: 1;
`;

const StatRow = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 1cqw;
`;

export const GameText = styled.span<{ $color?: string; $size?: string; $weight?: string }>`
  color: ${props => props.$color || '#cccccc'};
  font-size: ${props => props.$size || '1.3cqw'};
  font-family: monospace;
  font-weight: ${props => props.$weight || 'bold'};
`;

const StatLabel = styled(GameText)`
  color: #5c4d37; /* Clean, dark contrast theme matching your border */
  width: 10cqw;   /* Ensures values align in a perfect grid column */
`;

const StatValue = styled(GameText)`
  color: #1a1a1a;
`;

const IconContainer = styled.div`
  width: 9cqw;
  height: 9cqw;
  border: 0.15cqw solid #c3b091;
  border-radius: 0.4cqw;
  background: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: inset 0 0 0.5cqw rgba(0,0,0,0.05);
`;

const SpellIcon = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;


interface SpellData {
  updateOrder: number;
  rowShift: number;
  damage: number;
  speed: number;
  iconUrl: string;
}

/* COMPACT INTERACTIVE FLYOUT LOGGER */
const SpellInfoComponent = (hoveredSpell: SpellData) => (
  /* Left: Stats Column | Right: Image Column */
  <SpellInfoArea>
    <StatsContainer>
      <StatRow>
        <StatLabel $size="1.1cqw">Update Order:</StatLabel>
        <StatValue $size="1.1cqw">{hoveredSpell.updateOrder}</StatValue>
      </StatRow>
      <StatRow>
        <StatLabel $size="1.1cqw">Row Shift:</StatLabel>
        <StatValue $size="1.1cqw">{hoveredSpell.rowShift}</StatValue>
      </StatRow>
      <StatRow>
        <StatLabel $size="1.1cqw">Damage:</StatLabel>
        <StatValue $size="1.1cqw" $color="#b33939">{hoveredSpell.damage}</StatValue>
      </StatRow>
      <StatRow>
        <StatLabel $size="1.1cqw">Speed:</StatLabel>
        <StatValue $size="1.1cqw" $color="#227093">{hoveredSpell.speed}</StatValue>
      </StatRow>
    </StatsContainer>

    <IconContainer>
      <SpellIcon src={hoveredSpell.iconUrl} alt="Spell Icon" />
    </IconContainer>
  </SpellInfoArea>);

export default SpellInfoComponent;
