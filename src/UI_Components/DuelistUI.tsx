
import React from 'react';
import { Player } from './GameTypes';
import styled from 'styled-components';

const DuelistSideColumn = styled.div`
  flex: 1;
  background: transparent;// #161616;
  padding: 1.5cqw;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1cqw;
//   border: 1px solid #222;
  z-index: 10;
`;

const AvatarFrame = styled.img<{ $direction: number }>`
transform: scale(${props => props.$direction}, 1);
  width: 100%; aspect-ratio: 1/1; object-fit: cover; 
//   border-radius: 0.5cqw; border: 0.15cqw solid #333;
`;

const BarBorder = styled.div`
  width: 80%; align-self: center; height: 1.6cqw; border: 0.15cqw solid #666; background: #222; border-radius: 0.3cqw; overflow: hidden;
`;

const BarFill = styled.div<{ $pct: number }>`
  width: ${props => props.$pct}%; height: 100%; background: #aa2222; float: right; transition: width 0.2s ease;
`;

const FocusContainer = styled.div`
    display: flex;
    padding: .5cqw 5.75cqw;
    justify-content: space-around;
    gap: 0.4cqw;
    align-items: center;
`;

const FocusBadge = styled.div<{ key: number, $i: number, $focusAmt: number }>`
    width: .75cqw;
    height: .75cqw;
    border-radius: 50%;
    border: 0.12cqw solid #777;
    background: ${props => props.$i < props.$focusAmt ? '#6aadd9' : 'transparent'};
    transition: 'background 0.2s'
`;

const FizzleContainer = styled.div`
    height: 2.1cqw;
    display: flex;
    padding-left: 3.75cqw;
    gap: 0.4cqw;
    align-items: center;
    min-height: 1.5cqw; 
`;

const FizzleBadge = styled.div<{ key: string }>`
    color: #e67e22;
    font-size: 2.1cqw;
    padding-left: 1.59cqw;
`;

const DuelistUI = ({
    healthAmt,
    maxHealth,
    maxFocus,
    focusAmt,
    fizzles,
    avatarUrl,
    direction
    }: Player) => {
    return (<DuelistSideColumn>
        <AvatarFrame src={avatarUrl} alt={avatarUrl} $direction={direction} />
        <BarBorder><BarFill $pct={(healthAmt / maxHealth) * 100} /></BarBorder>
        <FocusContainer>
            {Array.from({ length: maxFocus }).map((_, i) => <FocusBadge key={i} $i={i} $focusAmt={focusAmt} />)}
        </FocusContainer>
        <FizzleContainer>
            {fizzles.map(f => (<FizzleBadge key={f.id} />))}
        </FizzleContainer>

        {/* <div style={{ display: 'flex', padding: '.5cqw 5.75cqw', justifyContent: 'space-around', gap: '0.4cqw', alignItems: 'center' }}>
            {Array.from({ length: duelistData.maxFocus }).map((_, i) => (
                <div key={i} style={{
                    width: '.75cqw', height: '.75cqw', borderRadius: '50%', border: '0.12cqw solid #777',
                    background: i < duelistData.focusAmt ? '#6aadd9' : 'transparent', transition: 'background 0.2s'
                }} />
            ))}
        </div>
        <div style={{ height: '2.1cqw', display: 'flex', paddingLeft: '3.75cqw', gap: '0.4cqw', alignItems: 'center', minHeight: '1.5cqw' }}>
            {duelistData.fizzles.map(f => (
                <div key={f.id} style={{ color: '#e67e22', fontSize: '2.1cqw', paddingLeft: '1.59cqw' }}>❌</div>
            ))}
        </div> */}
    </DuelistSideColumn>);
}

export default DuelistUI;
