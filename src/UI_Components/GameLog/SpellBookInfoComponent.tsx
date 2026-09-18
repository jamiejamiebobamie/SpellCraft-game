import React from 'react';
import styled from 'styled-components';

// Global shared styled component from your code base
export const GameText = styled.span<{ $color?: string; $size?: string; $weight?: string }>`
  color: ${props => props.$color || '#cccccc'};
  font-size: ${props => props.$size || '1.3cqw'};
  font-family: monospace;
  font-weight: ${props => props.$weight || 'bold'};
`;

// Container layout for the detailed layout
const SpellBookArea = styled.div`
  display: flex;
  flex-direction: column;
  padding: 2cqw 3cqw;
  height: 100%;
  box-sizing: border-box;
  gap: 1.5cqw;
`;

// Top section splitting the icon (left) from the title block (right)
const TopSection = styled.div`
  display: flex;
  align-items: center;
  gap: 2cqw;
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
  flex-shrink: 0;
`;

const SpellIcon = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const TitleContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

// Body text block for description narratives
const DescriptionContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1cqw;
  flex-grow: 1;
`;

const DescriptionParagraph = styled(GameText)`
  line-height: 1.4;
  text-align: justify;
`;

// Single horizontal row stretching metrics consistently across the footer
const HorizontalStatsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 0.1cqw solid rgba(92, 77, 55, 0.2);
  padding-top: 1.2cqw;
  gap: 2cqw;
`;

const CompactStatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5cqw;
`;

const StatLabel = styled(GameText)`
  color: #5c4d37;
`;

const StatValue = styled(GameText)`
  color: #1a1a1a;
`;

export interface SpellBookData {
  name: string;
  updateOrder: number;
  rowShift: number;
  damage: number;
  speed: number;
  iconUrl: string;
}

export const SpellBookInfoComponent: React.FC<SpellBookData> = ({
  name = "Fireball Arcana",
  updateOrder,
  rowShift,
  damage,
  speed,
  iconUrl,
}) => {
  return (
    <SpellBookArea>
      {/* Top Header Group */}
      <TopSection>
        <IconContainer>
          <SpellIcon src={iconUrl} alt={`${name} Icon`} />
        </IconContainer>
        <TitleContainer>
          <GameText $size="2.2cqw" $color="#1a1a1a" $weight="900">
            {name}
          </GameText>
        </TitleContainer>
      </TopSection>

      {/* Narrative Detail Blocks */}
      <DescriptionContainer>
        <DescriptionParagraph $size="1.1cqw">
          Gathering volatile elemental energy from the inner planes, this incantation reshapes the battlefield layout. Upon completion, the spell manifests a cascading trajectory that cuts deep into enemy positioning arrays.
        </DescriptionParagraph>
        <DescriptionParagraph $size="1.1cqw">
          Casters are advised to monitor lane synchronization closely. If timed during active grid updates, its kinetic payload shifts horizontal structural vectors, overlapping standard board priorities.
        </DescriptionParagraph>
      </DescriptionContainer>

      {/* Unified Single-Row Statistics Footer */}
      <HorizontalStatsContainer>
        <CompactStatItem>
          <StatLabel $size="1.05cqw">Order:</StatLabel>
          <StatValue $size="1.05cqw">{updateOrder}</StatValue>
        </CompactStatItem>
        
        <CompactStatItem>
          <StatLabel $size="1.05cqw">Shift:</StatLabel>
          <StatValue $size="1.05cqw">{rowShift}</StatValue>
        </CompactStatItem>
        
        <CompactStatItem>
          <StatLabel $size="1.05cqw">Damage:</StatLabel>
          <StatValue $size="1.05cqw" $color="#b33939">{damage}</StatValue>
        </CompactStatItem>
        
        <CompactStatItem>
          <StatLabel $size="1.05cqw">Speed:</StatLabel>
          <StatValue $size="1.05cqw" $color="#227093">{speed}</StatValue>
        </CompactStatItem>
      </HorizontalStatsContainer>
    </SpellBookArea>
  );
};

export default SpellBookInfoComponent;
