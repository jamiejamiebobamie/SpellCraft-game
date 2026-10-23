// SymbolSpinner.tsx
// The boot screen's gold spinner (index.html), with the Play button's symbols (HoverSymbols) appearing
// in its middle and falling away. Used while waiting: for the multiplayer service, or over a rival's head.
import styled, { keyframes } from 'styled-components';
import { SpinnerSymbols } from './HoverSymbols';

/** isSymbols: the falling symbols on or off. */
export const SYMBOL_SPINNER = { isSymbols: true };

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Wrap = styled.div<{ $size: number }>`
  position: relative;
  width: ${props => props.$size}cqw;
  aspect-ratio: 1;
  pointer-events: none;
`;

const Ring = styled.div<{ $size: number }>`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: ${props => props.$size * 0.094}cqw solid rgba(247, 215, 116, 0.15);
  border-top-color: #f7d774;
  box-shadow: 0 0 ${props => props.$size * 0.375}cqw rgba(255, 220, 120, 0.25);
  animation: ${spin} 1s linear infinite;
`;

/** The spinner (`size`: its width, cqw); place it where it should turn. */
export default function SymbolSpinner({ size = 3.2, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <Wrap $size={size} className={className} style={style}>
      {/* (the symbols outside the ring's turning, so they fall straight down) */}
      {SYMBOL_SPINNER.isSymbols && <SpinnerSymbols size={size / 3.2} />}
      <Ring $size={size} />
    </Wrap>
  );
}
