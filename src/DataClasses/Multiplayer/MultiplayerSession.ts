// MultiplayerSession.ts
// A 2-player match's connection: PeerJS (WebRTC, browser to browser; its free service only introduces
// them). The host gets an invite link (?join=<their id>); the guest opens it and connects. Only small
// messages are sent (each turn's casts and the like): each browser runs the game itself.
//
// A dropped connection (a closed tab, a lost signal) is noticed by its closing or by its silence (each
// side says it's still there every few seconds); the guest then keeps reconnecting, and messages sent
// meanwhile wait, delivered once it's back. A page opened afresh can't join a match already under way.
import Peer, { DataConnection } from 'peerjs';

export type MatchRole = 'host' | 'guest';

/** What the two browsers tell each other (the game's messages). */
export type MatchMessage =
  | { type: 'hello' } // the guest has joined, and its wizard is walking in
  | { type: 'welcome'; seed: number } // the host's answer: the match's shared random seed
  | { type: 'ready' } // the sender's intro is over (both wizards in): the first turn starts once both are
  | { type: 'rematch' } // the sender wants to play again (a new match starts once both do)
  | { type: 'leave' } // the sender has left the match
  // A cast, on the sender's side of the board (the receiver mirrors the columns)
  | { type: 'cast'; turn: number; symbol: string; cells: Array<{ i: number; j: number }>; isDrawn?: boolean }
  // The sender's drawing as it's drawn (points in board units: columns, rows; on the sender's side, as a
  // cast's cells): isNew starts a new stroke. Only a picture: the casts are what count
  | { type: 'stroke'; points: Array<[number, number]>; isNew: boolean }
  | { type: 'strokeEnd' }
  | { type: 'emote'; emoji: string } // an emoji over the sender's wizard's head (one of EMOTES)
  | { type: 'endTurn'; turn: number } // the sender's part of the turn is over
  | { type: 'check'; turn: number; fingerprint: string }; // the board after the turn (both should match)

/** The connection's own messages (never passed on to the game). */
type LinkMessage =
  | { type: 'ping' } // still here
  | { type: 'accepted' } // (host to a new guest) welcome in
  | { type: 'inProgress' }; // (host to a new guest) this match has already begun

const LINK_TYPES = new Set(['ping', 'accepted', 'inProgress']);

/** How the connection keeps watch (ms): a ping every pingMilli; silent for silentMilli, the rival is lost. */
const LINK = { pingMilli: 2000, silentMilli: 6000, retryMilli: 3000 };

/** The query parameter carrying the host's id in an invite link. */
const JOIN_PARAM = 'join';
/** Ids are prefixed, so they're unlikely to clash with other apps on PeerJS's shared service. */
const ID_PREFIX = 'spellcraft-';

const randomCode = (length: number): string => {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'; // (no look-alikes: i, l, o, 0, 1)
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};

export class MultiplayerSession {
  readonly role: MatchRole;
  private peer: Peer | null = null;
  private hostId = ''; // (the guest's: who it reconnects to)
  private connection: DataConnection | null = null;
  private messageHandlers: Array<(message: MatchMessage) => void> = [];
  private undelivered: Array<MatchMessage> = []; // (arrived before anything listened: e.g. the guest joining before the host begins)
  private outbox: Array<MatchMessage> = []; // (sent while the connection was down: delivered once it's back)
  private connectedHandlers: Array<() => void> = [];
  private lostHandlers: Array<() => void> = [];
  private backHandlers: Array<() => void> = [];
  private hasRival = false; // (a rival has joined: a fresh page can't join after that)
  private isRivalPresent = false;
  private lastHeardAt = 0;
  private watchTimer: number | undefined;
  private retryTimer: number | undefined;
  private isClosed = false;

  private constructor(role: MatchRole) {
    this.role = role;
  }

  /**
   * Whether PeerJS's free service (which introduces the two browsers) is up: it's asked for a new id,
   * as the PeerJS library itself does, within `timeoutMilli`.
   */
  static checkService = async (timeoutMilli: number = 3000): Promise<boolean> => {
    const abort = new AbortController();
    const timeout = window.setTimeout(() => abort.abort(), timeoutMilli);
    try {
      const response = await fetch(`https://0.peerjs.com/peerjs/id?ts=${Date.now()}${Math.random()}`, { signal: abort.signal, cache: 'no-store' });
      return response.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  /** The host id in this page's link, if it's an invite (?join=...). */
  static getJoinIdFromUrl = (): string | null => {
    const id = new URLSearchParams(window.location.search).get(JOIN_PARAM);
    return id && id.startsWith(ID_PREFIX) ? id : null;
  };

  /** Hosts a match: resolves with the session and its invite link once PeerJS has registered it. */
  static host = (): Promise<{ session: MultiplayerSession; inviteUrl: string }> => new Promise((resolve, reject) => {
    const session = new MultiplayerSession('host');
    const id = ID_PREFIX + randomCode(8);
    const peer = new Peer(id);
    session.peer = peer;
    peer.on('open', () => {
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set(JOIN_PARAM, id);
      resolve({ session, inviteUrl: url.toString() });
    });
    peer.on('connection', connection => session.handleIncoming(connection));
    // (losing PeerJS's service, the host reconnects to it, so a dropped guest can find it again)
    peer.on('disconnected', () => { if (!session.isClosed) peer.reconnect(); });
    peer.on('error', error => { if (!session.hasRival) reject(error); });
  });

  /**
   * Joins the match hosted by `hostId` (from an invite link): resolves once the host accepts; rejects
   * with an Error('inProgress') if its match has already begun with someone else.
   */
  static join = (hostId: string): Promise<MultiplayerSession> => new Promise((resolve, reject) => {
    const session = new MultiplayerSession('guest');
    session.hostId = hostId;
    const peer = new Peer();
    session.peer = peer;
    peer.on('open', () => {
      const connection = peer.connect(hostId, { reliable: true, metadata: { isResuming: false } });
      session.attach(connection, link => {
        if (link.type === 'accepted') resolve(session);
        if (link.type === 'inProgress') { session.close(); reject(new Error('inProgress')); }
      });
    });
    peer.on('error', error => { if (!session.hasRival) reject(error); });
  });

  /** (host) A guest connecting: the first, a returning one (resuming), or a stranger turned away. */
  private handleIncoming = (connection: DataConnection): void => {
    const isResuming = !!(connection.metadata as { isResuming?: boolean } | undefined)?.isResuming;
    if (this.hasRival && !isResuming) {
      connection.on('open', () => { connection.send({ type: 'inProgress' } satisfies LinkMessage); window.setTimeout(() => connection.close(), 500); });
      return;
    }
    // (a returning guest replaces its old connection, which may still look open)
    if (this.connection && this.connection !== connection) this.connection.close();
    this.attach(connection);
    connection.on('open', () => { if (!isResuming) connection.send({ type: 'accepted' } satisfies LinkMessage); });
  };

  private attach = (connection: DataConnection, onLink?: (link: LinkMessage) => void): void => {
    this.connection = connection;
    connection.on('open', () => {
      this.hasRival = true;
      this.heard();
      this.flushOutbox();
      this.startWatch();
      this.connectedHandlers.forEach(handler => handler());
    });
    connection.on('data', data => {
      if (connection !== this.connection) return;
      this.heard();
      const message = data as MatchMessage | LinkMessage;
      if (LINK_TYPES.has(message.type)) { onLink?.(message as LinkMessage); return; }
      if (!this.messageHandlers.length) this.undelivered.push(message as MatchMessage);
      else this.messageHandlers.forEach(handler => handler(message as MatchMessage));
    });
    connection.on('close', () => {
      if (connection !== this.connection) return;
      this.connection = null;
      this.lose();
    });
  };

  /** A message from the rival (any): it's there; if it had been lost, it's back. */
  private heard = (): void => {
    this.lastHeardAt = Date.now();
    if (!this.isRivalPresent) {
      const wasLost = this.hasRival && this.lastHeardAt > 0 && this.isWatching;
      this.isRivalPresent = true;
      if (wasLost) { window.clearTimeout(this.retryTimer); this.backHandlers.forEach(handler => handler()); }
    }
  };

  /** The rival is lost (its connection closed, or silent): the game is told, and the guest keeps reconnecting. */
  private lose = (): void => {
    if (this.isClosed || !this.isRivalPresent) return;
    this.isRivalPresent = false;
    this.lostHandlers.forEach(handler => handler());
    if (this.role === 'guest') this.retry();
  };

  /** (guest) Reconnecting to the host, every few seconds until it's back (or the session closes). */
  private retry = (): void => {
    window.clearTimeout(this.retryTimer);
    if (this.isClosed || this.isRivalPresent || !this.peer) return;
    if (this.peer.disconnected) this.peer.reconnect();
    this.connection?.close();
    this.attach(this.peer.connect(this.hostId, { reliable: true, metadata: { isResuming: true } }));
    this.retryTimer = window.setTimeout(this.retry, LINK.retryMilli);
  };

  /** Pings the rival, and notices if it has gone silent. */
  private isWatching = false;
  private startWatch = (): void => {
    if (this.isWatching) return;
    this.isWatching = true;
    this.watchTimer = window.setInterval(() => {
      if (this.connection?.open) this.connection.send({ type: 'ping' } satisfies LinkMessage);
      if (this.isRivalPresent && Date.now() - this.lastHeardAt > LINK.silentMilli) {
        this.connection?.close();
        this.connection = null;
        this.lose();
      }
    }, LINK.pingMilli);
  };

  private flushOutbox = (): void => {
    if (!this.connection?.open) return;
    const waiting = this.outbox;
    this.outbox = [];
    waiting.forEach(message => this.connection?.send(message));
  };

  getIsConnected = (): boolean => !!this.connection?.open;

  /** Sends a message (or, while the connection is down, keeps it until it's back). */
  send = (message: MatchMessage): void => {
    if (this.connection?.open && this.isRivalPresent) this.connection.send(message);
    else if (!this.isClosed) this.outbox.push(message);
  };

  /** Listens for messages (and is given, in order, any that arrived before anything listened). */
  onMessage = (handler: (message: MatchMessage) => void): void => {
    this.messageHandlers.push(handler);
    const waiting = this.undelivered;
    this.undelivered = [];
    waiting.forEach(handler);
  };
  onConnected = (handler: () => void): void => { this.connectedHandlers.push(handler); };
  /** The rival's connection dropped (it may come back: onRivalBack). */
  onRivalLost = (handler: () => void): void => { this.lostHandlers.push(handler); };
  onRivalBack = (handler: () => void): void => { this.backHandlers.push(handler); };
  /** (kept for the invite screen) The rival's connection dropped. */
  onDisconnected = (handler: () => void): void => { this.lostHandlers.push(handler); };

  close = (): void => {
    this.isClosed = true;
    window.clearInterval(this.watchTimer);
    window.clearTimeout(this.retryTimer);
    this.connection?.close();
    this.peer?.destroy();
    this.connection = null;
    this.peer = null;
  };
}
