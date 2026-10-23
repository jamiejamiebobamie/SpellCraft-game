import { Player } from "./Player"
import { NPCPlayer } from './NpcPlayer';
import { GameSymbol } from '../PlacedSpells/GameSymbol';
import { proxy } from 'valtio';

export class Players {
    private players: Array<Player> = [];
    private humanPlayer: Player | null = null;
    private computerPlayer: NPCPlayer | null = null;
    // Extra reference to human player's GameSymbol name, for convenience.
    private playerGameSymbolSpellName: string | null = null;

    // INIT
    init = (): void => {
        const humanPlayer = proxy(new Player(1, './player_avatars/PlayerAvatar.png'));
        const computerPlayer = proxy(new NPCPlayer(-1, './player_avatars/PlayerAvatar_NPC.png'));
        this.players = [humanPlayer, computerPlayer];
        this.humanPlayer = humanPlayer;
        this.computerPlayer = computerPlayer;
    }

    // GET
    getPlayers = (): Array<Player> => this.players;
    getNpcPlayer = (): NPCPlayer | null => this.computerPlayer;
    getHumanPlayer = (): Player | null => this.humanPlayer;
    getPlayer = (idx: number): Player => this.players[idx];
    getReadiedSpell = (): string | null => this.playerGameSymbolSpellName;
    getGameSymbol = (): GameSymbol | null => {
        const humanPlayer = this.players[0];
        const gameSymbol = humanPlayer?.getGameSymbol();
        return gameSymbol || null;
    }

    // SET
    setReadiedSpell = (readiedSpell: string | null): void => {
        this.playerGameSymbolSpellName = readiedSpell;
    }

    cancelPlacingSymbol = (player?: Player): void => {
        const p = player ? player : this.getHumanPlayer();
        p?.setGameSymbol(null);
        if (p === this.getHumanPlayer()) {
            this.setReadiedSpell(null);
        }
    }

    // RESET
    reset = (): void => this.players.forEach(p => p.reset());
    regenFocusForPlayers = () => this.players.forEach(p => p.decrementFocus(p.getFocusRegenAmt()));
}