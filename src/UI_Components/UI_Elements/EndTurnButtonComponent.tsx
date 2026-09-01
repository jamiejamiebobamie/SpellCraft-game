import React from 'react';
import { Game } from '../../DataClasses/Game'
import styled from 'styled-components';
import { useSnapshot } from 'valtio';

// 1. The Main Absolute Anchor in the Top-Left Corner
const MenuAnchor = styled.div`
  position: absolute;
  top: 2cqw;   
  left: 4cqw; 
  z-index: 31;
`;

// 2. The Button
const Button = styled.div`
  width: 8cqw;
  height: 8cqw;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 2cqw;
  cursor: pointer;
  background-image: url("spell-icons/EtherIcon_mockup.png");
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  filter: drop-shadow(2px 2px 4px black);
`;

interface EndTurnButtonComponentProps {
  rootGameStore: Game;
}

export default function EndTurnButtonComponent({ rootGameStore }: EndTurnButtonComponentProps) {
  const snap = useSnapshot(rootGameStore);
  return (
    <MenuAnchor data-click-type="ui-buttons">
      <Button onClick={() => {
        if (rootGameStore.getIsClickDisabled()) return;
        rootGameStore.updatePlayerTurn();
        // rootGameStore.updatePlacedSpells()
      }}><div>End</div><div>Turn</div></Button>
    </MenuAnchor >
  );
}