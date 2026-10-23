// CodeLinkComponent.tsx
// The landing page's link to the project's code (bottom-left), "see the code" on hover, in one of
// three looks (CODE_LINK.look).
import styled, { css } from 'styled-components';

/**
 * look: 'round' (a dark round button with a code icon, like the game's own buttons), 'github' (the
 * GitHub mark) or 'pill' (a small framed button: the code icon and "see the code").
 */
export const CODE_LINK = {
  url: 'https://github.com/jamiejamiebobamie/SpellCraft-game',
  look: 'round' as 'round' | 'github' | 'pill',
  // The icon ('round' and 'pill'): '</>' (the usual code icon), '{}' (braces), '>_' (a terminal
  // prompt), 'scroll' (a scroll with lines of code) or 'github' (the GitHub mark)
  icon: 'scroll' as '</>' | '{}' | '>_' | 'scroll' | 'github',
  title: 'See the code',
};

const GOLD = '#e6c563';
const OFF_WHITE = 'rgba(240, 236, 226, 0.85)';

const Link = styled.a<{ $isHidden: boolean; $look: string }>`
  position: absolute;
  left: 2cqw;
  bottom: 1.6cqw;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6cqw;
  color: ${OFF_WHITE};
  text-decoration: none;
  opacity: ${props => props.$isHidden ? 0 : 1};
  pointer-events: ${props => props.$isHidden ? 'none' : 'auto'};
  transition: color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, filter 0.2s, opacity 0.6s;
  svg { display: block; }

  ${props => props.$look === 'round' && css`
    width: 3.4cqw;
    height: 3.4cqw;
    background: rgba(20, 20, 20, 0.85);
    border: 0.15cqw solid #444;
    border-radius: 50%;
    box-shadow: 0 0.2cqw 0.5cqw rgba(0, 0, 0, 0.6);
    svg { width: 1.9cqw; }
    svg.scroll { width: 2.3cqw; } /* (the scroll a little bigger: its detail shows) */
    &:hover { color: ${GOLD}; border-color: ${GOLD}; transform: scale(1.12); box-shadow: 0 0 1.2cqw rgba(230, 197, 99, 0.35); }
  `}
  ${props => props.$look === 'github' && css`
    opacity: ${props.$isHidden ? 0 : 0.7};
    svg { width: 2.6cqw; }
    &:hover { opacity: 1; filter: drop-shadow(0 0 0.6cqw rgba(255, 255, 255, 0.5)); transform: scale(1.08); }
  `}
  ${props => props.$look === 'pill' && css`
    padding: 0.5cqw 1.1cqw;
    background: rgba(20, 16, 10, 0.6);
    border: 0.12cqw solid rgba(230, 197, 99, 0.55);
    border-radius: 2cqw;
    font-family: Arial, sans-serif;
    font-size: 1.15cqw;
    svg { width: 1.5cqw; }
    &:hover { color: ${GOLD}; border-color: ${GOLD}; box-shadow: 0 0 1.2cqw rgba(230, 197, 99, 0.35); }
  `}
`;

/** A code icon: angle brackets and a slash (</>), in the text's color. */
const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="8 6 2 12 8 18" />
    <polyline points="16 6 22 12 16 18" />
    <line x1="14" y1="3.5" x2="10" y2="20.5" />
  </svg>
);

/** Curly braces, in the text's color. */
const BracesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3.5C6.5 3.5 6.5 5 6.5 7v2.2C6.5 10.8 5.6 12 4 12c1.6 0 2.5 1.2 2.5 2.8V17c0 2 0 3.5 2.5 3.5" />
    <path d="M15 3.5c2.5 0 2.5 1.5 2.5 3.5v2.2c0 1.6.9 2.8 2.5 2.8-1.6 0-2.5 1.2-2.5 2.8V17c0 2 0 3.5-2.5 3.5" />
  </svg>
);

/** A terminal prompt (>_), in the text's color. */
const TerminalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="4 7 9.5 12 4 17" />
    <line x1="12" y1="18" x2="20" y2="18" />
  </svg>
);

/** A scroll, rolled at both ends, with lines of code on it, in the text's color. */
const ScrollIcon = () => (
  <svg className="scroll" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 3h11a2 2 0 0 1 2 2v1h-3" />
    <path d="M17 6v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1h11v1a2 2 0 0 0 2 2" />
    <path d="M7 3a2 2 0 0 0-2 2v13" />
    <polyline points="9.5 9 8 10.5 9.5 12" />
    <polyline points="12.5 9 14 10.5 12.5 12" />
    <line x1="8" y1="15" x2="14" y2="15" />
  </svg>
);

/** The GitHub mark, in the text's color. */
const GitHubIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export default function CodeLinkComponent({ isHidden }: { isHidden: boolean }) {
  const { url, look, title, icon } = CODE_LINK;
  const Icon = look === 'github' || icon === 'github' ? GitHubIcon : icon === '{}' ? BracesIcon : icon === '>_' ? TerminalIcon : icon === 'scroll' ? ScrollIcon : CodeIcon;
  return (
    <Link href={url} target="_blank" rel="noopener noreferrer" title={title} aria-label={title} $isHidden={isHidden} $look={look}>
      <Icon />
      {look === 'pill' && <span>{title}</span>}
    </Link>
  );
}
