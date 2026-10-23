// MatchScreens.tsx
// 2 Players: the host's invite screen (the link to send a friend, then Begin) and the guest's joining
// screen (opening an invite link). See MultiplayerSession.
import { useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { MultiplayerSession } from '../DataClasses/Multiplayer/MultiplayerSession';

const GOLD = '#e6c563', GOLD_BRIGHT = '#fff1b8';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(1cqw); }
  to { opacity: 1; transform: translateY(0); }
`;

const Screen = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 7cqw; /* (clear of the clock and its halo, above) */
  box-sizing: border-box;
  animation: ${fadeIn} 0.6s ease-out both;
`;

const Panel = styled.div`
  width: 52cqw;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.8cqw;
  padding: 2.6cqw 3cqw;
  background: rgba(20, 16, 10, 0.6);
  border: 0.22cqw solid rgba(230, 197, 99, 0.55);
  border-radius: 1.2cqw;
  box-shadow: 0 1cqw 3cqw rgba(0, 0, 0, 0.6);
  text-align: center;
`;

const Title = styled.div`
  font-family: 'EnchantedLand', sans-serif;
  font-size: 4cqw;
  color: ${GOLD};
  text-shadow: 0 0 1.2cqw rgba(230, 197, 99, 0.35), 0 0.2cqw 0.4cqw rgba(0, 0, 0, 0.8);
`;

const Text = styled.div`
  font-family: sans-serif;
  font-size: 1.35cqw;
  line-height: 1.5;
  color: #e0e0e0;
`;

const LinkRow = styled.div`
  width: 100%;
  display: flex;
  gap: 1cqw;
`;

const LinkBox = styled.input`
  flex: 1;
  min-width: 0;
  font-family: monospace;
  font-size: 1.25cqw;
  color: ${GOLD_BRIGHT};
  background: rgba(0, 0, 0, 0.45);
  border: 0.12cqw solid rgba(230, 197, 99, 0.4);
  border-radius: 0.5cqw;
  padding: 0.8cqw 1cqw;
  outline: none;
`;

const Button = styled.button<{ $isPrimary?: boolean }>`
  font-family: 'EnchantedLand', sans-serif;
  font-size: ${props => props.$isPrimary ? 2.8 : 2}cqw;
  padding: ${props => props.$isPrimary ? '0.6cqw 4cqw' : '0.4cqw 1.6cqw'};
  border-radius: 0.5cqw;
  border: 0.15cqw solid ${GOLD};
  background: ${props => props.$isPrimary ? 'rgba(230, 197, 99, 0.18)' : 'transparent'};
  color: ${GOLD};
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s;
  &:hover:not(:disabled) {
    color: ${GOLD_BRIGHT};
    border-color: ${GOLD_BRIGHT};
    background: rgba(230, 197, 99, 0.28);
    box-shadow: 0 0 1.4cqw rgba(255, 220, 130, 0.4);
  }
  &:disabled { opacity: 0.45; cursor: default; }
`;

const BackLink = styled.button`
  font-family: 'EnchantedLand', sans-serif;
  font-size: 1.8cqw;
  color: #aaa;
  background: transparent;
  border: none;
  cursor: pointer;
  &:hover { color: #fff; }
`;

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
        <Title>Invite a Rival</Title>
        <Text>Send this link to a friend. When they open it and press Join, their wizard walks into your hall and the duel begins.</Text>
        <LinkRow>
          <LinkBox readOnly value={error ? '' : inviteUrl || 'Creating your match…'} onFocus={e => e.currentTarget.select()} />
          <Button onClick={copy} disabled={!inviteUrl}>{copied ? 'Copied!' : 'Copy'}</Button>
          {canShare && <Button onClick={share} disabled={!inviteUrl}>Share…</Button>}
        </LinkRow>
        {error
          ? <Status>{error}</Status>
          : isRivalConnected
            ? <Status $isGood>Your rival has arrived!</Status>
            : <Status $isWaiting>{inviteUrl ? 'Waiting for your rival to open the link…' : ''}</Status>}
        <Text>You can begin now: you'll wait in the hall until they join.</Text>
        <Button $isPrimary onClick={begin} disabled={!inviteUrl || !!error}>Begin</Button>
        <BackLink onClick={onBack}>Back</BackLink>
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
        <Title>Joining the Duel</Title>
        {error
          ? <><Status>{error}</Status><Button onClick={onPlayAlone}>Play alone instead</Button></>
          : <Status $isWaiting>Finding your rival's hall…</Status>}
      </Panel>
    </Screen>
  );
}
