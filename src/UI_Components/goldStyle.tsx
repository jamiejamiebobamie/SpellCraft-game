// goldStyle.tsx
// The UI's look, from Choose Your Duel: panels and buttons of dark glass framed in gold, a fine etched
// inner frame with a diamond at each corner, metallic gold lettering, a line-diamond-line ornament; on
// hover the gold brightens, a button presses in, and a light sweeps across it. Shared by every screen.
import React from 'react';
import styled, { css, keyframes } from 'styled-components';

export const GOLD = '#e6c563', GOLD_BRIGHT = '#fff1b8', GOLD_DEEP = '#a9822e';
/** Metallic gold: bright at the top, deep at the bottom (lettering and ornaments). */
export const GOLD_GRADIENT = `linear-gradient(180deg, ${GOLD_BRIGHT} 0%, ${GOLD} 45%, ${GOLD_DEEP} 100%)`;

/**
 * The glass: dark and translucent (tint: its color; alpha: a button's opacity, hoverAlpha on hover,
 * panelAlpha a panel's: darker, for the text on it), the hall blurred behind it (blur, cqw), a faint sheen
 * across its top (sheen: the white's opacity there).
 */
export const GLASS = { tint: '12, 13, 18', alpha: 0.38, hoverAlpha: 0.48, panelAlpha: 0.72, blur: 0.5, sheen: 0.07 };

/**
 * The etched inner frame and its diamonds: a faint pale line in the glass, a little clearer on hover;
 * solid, the frame faded as one, so the lines don't show through the diamonds where they cross.
 */
export const FRAME_ETCH = { color: '#ffffff', opacity: 0.13, hoverOpacity: 0.24 };

/** The gold edge around the glass (cqw), and its opacity (brighter on hover). */
export const GOLD_EDGE = { width: 0.16, opacity: 0.7 };

/** The glass's layers: the sheen at its top, a soft warm glow (glow: its strength), the tint. */
export const glassBackground = (alpha: number, glow = 0.08, sheen = GLASS.sheen): string => `
  linear-gradient(180deg, rgba(255, 255, 255, ${sheen}) 0%, rgba(255, 255, 255, 0) 38%),
  radial-gradient(ellipse 60% 45% at 50% 40%, rgba(255, 215, 140, ${glow}), rgba(255, 215, 140, 0) 70%),
  rgba(${GLASS.tint}, ${alpha})`;

/** Glass with its gold edge (the hall blurred behind). */
export const glassCss = (alpha: number) => css`
  background: ${glassBackground(alpha)};
  backdrop-filter: blur(${GLASS.blur}cqw) saturate(1.15);
  -webkit-backdrop-filter: blur(${GLASS.blur}cqw) saturate(1.15);
  border: ${GOLD_EDGE.width}cqw solid rgba(230, 197, 99, ${GOLD_EDGE.opacity});
`;

/** Metallic gold lettering (the gold showing through the letters, a shadow beneath). */
export const goldTextCss = css`
  background: ${GOLD_GRADIENT};
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0.2cqw 0.35cqw rgba(0, 0, 0, 0.85));
`;

/** A title in metallic gold (EnchantedLand). */
export const GoldTitle = styled.div<{ $size?: number }>`
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${props => props.$size ?? 4}cqw;
  line-height: 1.1;
  ${goldTextCss}
  filter: drop-shadow(0 0 1cqw rgba(230, 197, 99, 0.3)) drop-shadow(0 0.2cqw 0.35cqw rgba(0, 0, 0, 0.85));
`;

// --- The etched inner frame
const Frame = styled.span<{ $inset: number; $diamond: number }>`
  position: absolute;
  inset: ${props => props.$inset}cqw;
  border: 0.12cqw solid ${FRAME_ETCH.color};
  border-radius: 0.35cqw;
  opacity: ${FRAME_ETCH.opacity};
  pointer-events: none;
  transition: opacity 0.25s;
  i {
    position: absolute;
    width: ${props => props.$diamond}cqw;
    height: ${props => props.$diamond}cqw;
    background: ${FRAME_ETCH.color};
    transform: translate(-50%, -50%) rotate(45deg);
  }
  i:nth-child(1) { left: 0; top: 0; }
  i:nth-child(2) { left: 100%; top: 0; }
  i:nth-child(3) { left: 0; top: 100%; }
  i:nth-child(4) { left: 100%; top: 100%; }
`;
/**
 * The etched inner frame, inside its parent (inset: from the parent's edge, cqw; diamond: the corner
 * diamonds' size, 0 for none). Its parent brightens it on hover through the class "frame".
 */
export const EtchedFrame = ({ inset = 0.9, diamond = 0.75 }: { inset?: number; diamond?: number }) => (
  <Frame className='frame' $inset={inset} $diamond={diamond} aria-hidden>
    {diamond > 0 && <><i /><i /><i /><i /></>}
  </Frame>
);

// --- The ornament: a line, a diamond, a line
const Divider = styled.span<{ $width: number; $align: 'center' | 'left' }>`
  display: flex;
  align-items: center;
  gap: 0.8cqw;
  width: ${props => props.$width}cqw;
  opacity: 0.85;
  ${props => props.$align === 'center' && 'margin: 0 auto;'}
  &::before, &::after {
    content: '';
    flex: 1;
    height: 0.1cqw;
  }
  &::before { ${props => props.$align === 'left' ? 'display: none;' : `background: linear-gradient(90deg, rgba(230, 197, 99, 0), ${GOLD});`} }
  &::after { background: linear-gradient(90deg, ${GOLD}, rgba(230, 197, 99, 0)); }
  i {
    width: 0.6cqw;
    height: 0.6cqw;
    background: ${GOLD_GRADIENT};
    transform: rotate(45deg);
  }
`;
/** The ornament (width: cqw; align: centered, or from the left: a diamond, then the line). */
export const GoldDivider = ({ width = 16, align = 'center' }: { width?: number; align?: 'center' | 'left' }) => (
  <Divider $width={width} $align={align} aria-hidden><i /></Divider>
);

// --- A panel of glass
/** A panel of glass with its gold edge (put an <EtchedFrame /> inside it for the inner frame). */
export const GlassPanel = styled.div`
  position: relative;
  ${glassCss(GLASS.panelAlpha)}
  border-radius: 0.8cqw;
  box-shadow: 0 1cqw 3cqw rgba(0, 0, 0, 0.6), inset 0 0 2.5cqw rgba(0, 0, 0, 0.35), inset 0 0.12cqw 0 rgba(255, 255, 255, 0.16);
`;

// --- Buttons
/** The light sweeping across a button on hover. */
export const sheenSweep = keyframes`
  from { transform: translateX(-120%) skewX(-18deg); }
  to { transform: translateX(320%) skewX(-18deg); }
`;

/**
 * A button's sizes (cqw): its lettering, padding (up and down, across), and its inner frame's inset and
 * corner diamonds. Primary: brighter, with the frame's diamonds; secondary: plainer.
 */
const BUTTON_SIZES = {
  large: { font: 3, pad: [0.9, 4.2], inset: 0.5, diamond: 0.5 },
  medium: { font: 2.3, pad: [0.6, 2.6], inset: 0.4, diamond: 0.4 },
  small: { font: 1.8, pad: [0.45, 1.6], inset: 0.3, diamond: 0 },
};
/** A button's hover: pressed in (cqw), its shadow tighter. */
const PRESS = { shift: 0.2, rest: '0 0.6cqw 1.6cqw rgba(0, 0, 0, 0.55)', pressed: '0 0.2cqw 0.6cqw rgba(0, 0, 0, 0.7)' };

const Plaque = styled.button<{ $size: keyof typeof BUTTON_SIZES; $isPrimary: boolean }>`
  position: relative;
  overflow: hidden;
  padding: ${props => BUTTON_SIZES[props.$size].pad.map(v => `${v}cqw`).join(' ')};
  ${props => glassCss(props.$isPrimary ? GLASS.alpha + 0.12 : GLASS.alpha)}
  ${props => !props.$isPrimary && `border-color: rgba(230, 197, 99, ${GOLD_EDGE.opacity * 0.6});`}
  border-radius: 0.6cqw;
  box-shadow: ${PRESS.rest}, inset 0 0 1.5cqw rgba(0, 0, 0, 0.35), inset 0 0.1cqw 0 rgba(255, 255, 255, 0.16);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.25s, box-shadow 0.25s, transform 0.2s, background 0.25s, opacity 0.2s;
  .label {
    position: relative;
    font-family: 'EnchantedLand', sans-serif;
    font-size: ${props => BUTTON_SIZES[props.$size].font}cqw;
    line-height: 1.1;
    letter-spacing: 0.03em;
    ${goldTextCss}
    transition: filter 0.25s;
  }
  /* the sweeping light (hover) */
  &::after {
    content: '';
    position: absolute;
    top: -10%;
    bottom: -10%;
    left: 0;
    width: 35%;
    background: linear-gradient(90deg, rgba(255, 240, 200, 0), rgba(255, 240, 200, 0.15), rgba(255, 240, 200, 0));
    transform: translateX(-120%) skewX(-18deg);
    pointer-events: none;
  }
  &:hover:not(:disabled), &:focus-visible {
    outline: none;
    border-color: ${GOLD_BRIGHT};
    background: ${glassBackground(GLASS.hoverAlpha + 0.08, 0.18, GLASS.sheen * 1.4)};
    box-shadow: ${PRESS.pressed}, 0 0 1.8cqw rgba(255, 220, 130, 0.35), inset 0 0 1.5cqw rgba(0, 0, 0, 0.3), inset 0 0.1cqw 0 rgba(255, 255, 255, 0.24);
    transform: translateY(${PRESS.shift}cqw);
  }
  &:hover:not(:disabled)::after, &:focus-visible::after { animation: ${sheenSweep} 0.9s ease-out 1; }
  &:hover:not(:disabled) .frame, &:focus-visible .frame { opacity: ${FRAME_ETCH.hoverOpacity}; }
  &:hover:not(:disabled) .label, &:focus-visible .label { filter: brightness(1.15) drop-shadow(0 0 0.6cqw rgba(255, 225, 140, 0.45)); }
  &:disabled { opacity: 0.45; cursor: default; }
`;

type GoldButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: keyof typeof BUTTON_SIZES; isPrimary?: boolean };
/** A button of glass framed in gold, its label in metallic gold (size: large, medium or small). */
export const GoldButton = ({ size = 'medium', isPrimary = false, children, ...props }: GoldButtonProps) => (
  <Plaque $size={size} $isPrimary={isPrimary} {...props}>
    <EtchedFrame inset={BUTTON_SIZES[size].inset} diamond={isPrimary ? BUTTON_SIZES[size].diamond : 0} />
    <span className='label'>{children}</span>
  </Plaque>
);

/** A quiet text button (Back, Close): gold lettering, underlined on hover. */
export const GoldLink = styled.button<{ $size?: number }>`
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${props => props.$size ?? 1.8}cqw;
  color: rgba(230, 197, 99, 0.75);
  background: transparent;
  border: none;
  padding: 0.2cqw 0.4cqw;
  cursor: pointer;
  text-decoration: underline transparent;
  text-underline-offset: 0.3cqw;
  transition: color 0.2s, text-decoration-color 0.2s;
  &:hover { color: ${GOLD_BRIGHT}; text-decoration-color: currentColor; }
`;

/**
 * A small round close button: an ✕ in a gold ring (size: across, cqw). The ✕ drawn as two crossed lines,
 * dead center (a text ✕ sits off center in its font); on hover it brightens, its ring glowing.
 */
export const GoldClose = styled.button<{ $size?: number }>`
  position: relative;
  width: ${props => props.$size ?? 2}cqw;
  height: ${props => props.$size ?? 2}cqw;
  padding: 0;
  font-size: 0; /* (any text inside: for screen readers only) */
  color: ${GOLD};
  background: rgba(${GLASS.tint}, 0.4);
  border: 0.1cqw solid rgba(230, 197, 99, 0.45);
  border-radius: 50%;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
  &::before, &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 50%;
    height: 0.12cqw;
    background: currentColor;
    border-radius: 0.1cqw;
  }
  &::before { transform: translate(-50%, -50%) rotate(45deg); }
  &::after { transform: translate(-50%, -50%) rotate(-45deg); }
  &:hover { border-color: ${GOLD_BRIGHT}; color: ${GOLD_BRIGHT}; box-shadow: 0 0 0.6cqw rgba(255, 220, 130, 0.5); }
`;
