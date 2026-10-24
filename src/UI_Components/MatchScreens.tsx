// MatchScreens.tsx
// 2 Players: the host's invite screen (the link to send a friend, then Begin) and the guest's joining
// screen (opening an invite link). See MultiplayerSession.
import React, { useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { MultiplayerSession } from '../DataClasses/Multiplayer/MultiplayerSession';
import { MODE_SELECT } from './ModeSelectComponent';
import { EtchedFrame, screenDim, GOLD, GOLD_BRIGHT, GlassPanel, GoldButton, GoldDivider, GoldLink, GoldTitle } from './goldStyle';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(1cqw); }
  to { opacity: 1; transform: translateY(0); }
`;

const Screen = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center; /* (centered: the hall, its clock too, dimmed behind, as on Choose Your Duel) */
  box-sizing: border-box;
  background: ${screenDim(MODE_SELECT.dim)};
  animation: ${fadeIn} 0.6s ease-out both;
`;

const Panel = styled(GlassPanel)`
  width: 52cqw;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.6cqw;
  padding: 2.8cqw 3.4cqw;
  text-align: center;
  > *:not(.frame) { position: relative; }
`;

/** The panel's title, and the ornament beneath it. */
const Heading = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6cqw' }}>
    <GoldTitle $size={4}>{children}</GoldTitle>
    <GoldDivider width={18} />
  </div>
);

const Text = styled.div`
  font-family: 'Segoe UI', Calibri, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 1.35cqw;
  line-height: 1.5;
  color: #e6e1d6;
`;

const LinkRow = styled.div`
  width: 100%;
  display: flex;
  gap: 1cqw;
`;

/** The invite link: a recessed field in the glass, a faint etched edge. */
const LinkBox = styled.input`
  flex: 1;
  min-width: 0;
  font-family: monospace;
  font-size: 1.25cqw;
  color: ${GOLD_BRIGHT};
  background: rgba(0, 0, 0, 0.5);
  border: 0.1cqw solid rgba(255, 255, 255, 0.14);
  border-radius: 0.5cqw;
  box-shadow: inset 0 0.2cqw 0.6cqw rgba(0, 0, 0, 0.7);
  padding: 0.8cqw 1cqw;
  outline: none;
  &:focus { border-color: rgba(230, 197, 99, 0.6); }
`;

/** A note on the invite and joining screens (the rival's drawings are seen live). */
const Notice = styled.div`
  font-family: 'Segoe UI', Calibri, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 1.05cqw;
  font-style: italic;
  color: rgba(230, 225, 214, 0.55);
`;
const DRAWINGS_NOTICE = "In 2-player duels, you'll see your rival's drawings as they cast. Only duel people you trust.";


const pulse = keyframes`
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
`;

const Status = styled.div<{ $isGood?: boolean; $isWaiting?: boolean }>`
  font-family: 'EnchantedLand', sans-serif;
  font-size: 2.2cqw;
  color: ${props => props.$isGood ? '#9be8a2' : GOLD};
  ${props => props.$isWaiting && css`animation: ${pulse} 1.8s ease-in-out infinite;`}
`;

/** The host: creates the match, shows the invite link (copy / share), and Begin. */
export function HostMatchScreen({ onBegin, onBack }: { onBegin: (session: MultiplayerSession) => void; onBack: () => void }) {
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isRivalConnected, setIsRivalConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const sessionRef = useRef<MultiplayerSession | null>(null);
  const isBegunRef = useRef(false);

  useEffect(() => {
    let isCancelled = false;
    // (a moment's wait first: a screen set up and at once undone, as React does in development, never connects)
    const start = window.setTimeout(() => {
      MultiplayerSession.host()
        .then(({ session, inviteUrl }) => {
          if (isCancelled) { session.close(); return; }
          sessionRef.current = session;
          setInviteUrl(inviteUrl);
          session.onConnected(() => setIsRivalConnected(true));
          session.onDisconnected(() => setIsRivalConnected(false));
        })
        .catch(() => { if (!isCancelled) setError("Couldn't create a match. Check your connection and try again."); });
    }, 50);
    // (leaving without beginning: the match is closed)
    return () => { isCancelled = true; window.clearTimeout(start); if (!isBegunRef.current) sessionRef.current?.close(); };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* (the link can still be selected and copied by hand) */ }
  };
  const canShare = typeof navigator.share === 'function';
  const share = () => { navigator.share?.({ title: 'SpellCraft', text: 'Duel me in SpellCraft!', url: inviteUrl }).catch(() => { }); };
  const begin = () => {
    if (!sessionRef.current) return;
    isBegunRef.current = true;
    onBegin(sessionRef.current);
  };

  return (
    <Screen>
      <Panel>
        <EtchedFrame />
        <Heading>Invite a Rival</Heading>
        <Text>Send this link to a friend. When they open it and press Join, their wizard walks into your hall and the duel begins.</Text>
        <LinkRow>
          <LinkBox readOnly value={error ? '' : inviteUrl || 'Creating your match…'} onFocus={e => e.currentTarget.select()} />
          <GoldButton size='small' onClick={copy} disabled={!inviteUrl}>{copied ? 'Copied!' : 'Copy'}</GoldButton>
          {canShare && <GoldButton size='small' onClick={share} disabled={!inviteUrl}>Share…</GoldButton>}
        </LinkRow>
        {error
          ? <Status>{error}</Status>
          : isRivalConnected
            ? <Status $isGood>Your rival has arrived!</Status>
            : <Status $isWaiting>{inviteUrl ? 'Waiting for your rival to open the link…' : ''}</Status>}
        <Text>You can begin now: you'll wait in the hall until they join.</Text>
        <Notice>{DRAWINGS_NOTICE}</Notice>
        <GoldButton size='large' isPrimary onClick={begin} disabled={!inviteUrl || !!error}>Begin</GoldButton>
        <GoldLink onClick={onBack}>Back</GoldLink>
      </Panel>
    </Screen>
  );
}

/** The guest: connects to the host from the invite link; on success, the match begins (onJoined). */
export function JoinMatchScreen({ hostId, onJoined, onPlayAlone }: { hostId: string; onJoined: (session: MultiplayerSession) => void; onPlayAlone: () => void }) {
  const [error, setError] = useState<string>('');
  useEffect(() => {
    let isCancelled = false;
    // (PeerJS gives no answer if the host is gone: a time limit)
    const timeout = window.setTimeout(() => { if (!isCancelled) setError("Couldn't reach your rival's duel. The link may have expired, or they've left."); }, 15000);
    // (a moment's wait first: a screen set up and at once undone, as React does in development, never connects)
    const start = window.setTimeout(() => {
      MultiplayerSession.join(hostId)
        .then(session => {
          window.clearTimeout(timeout);
          if (isCancelled) { session.close(); return; }
          onJoined(session);
        })
        .catch((error: Error) => {
          window.clearTimeout(timeout);
          if (isCancelled) return;
          setError(error?.message === 'inProgress'
            ? 'That duel has already begun. Ask your rival for a new link.'
            : "Couldn't reach your rival's duel. The link may have expired, or they've left.");
        });
    }, 50);
    return () => { isCancelled = true; window.clearTimeout(timeout); window.clearTimeout(start); };
  }, [hostId]);

  return (
    <Screen>
      <Panel>
        <EtchedFrame />
        <Heading>Joining the Duel</Heading>
        {error
          ? <><Status>{error}</Status><GoldButton isPrimary onClick={onPlayAlone}>Play alone instead</GoldButton></>
          : <Status $isWaiting>Finding your rival's hall…</Status>}
        <Notice>{DRAWINGS_NOTICE}</Notice>
      </Panel>
    </Screen>
  );
}
