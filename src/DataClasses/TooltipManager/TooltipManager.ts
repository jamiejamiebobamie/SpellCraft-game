import { PLAYER_RULES } from "../PlacedSpells/spellRules";

export interface TooltipPage {
    title?: string;
    paragraphs?: string[];
    mediaUrl?: string;
}

// The tutorial: the story (a modal, when you press Play, if tooltips are on or not chosen yet; it
// asks "Play with tooltips" or "Play"), then light tips: small cards pointing at part of the screen,
// each shown once per browser window, when it becomes relevant.
export const GAME_TUTORIALS = {
    LORE: [
        {
            title: "Welcome to SpellCraft",
            paragraphs: [
                "You are a member of a secret wizard fight club.",
                "Tonight, like every night, you've slipped out of bed after curfew to roam the school's halls, wand drawn, in search of a \"true education\" in magic.",
                "Everyone wears a mask, even among themselves: if a teacher catches one of you, the rest stay safe.",
            ],
            mediaUrl: './icon-512.png', // the mask
        },
    ],
};

/** The tutorial's chunks. */
export type TipId = 'casting' | 'spellBook' | 'spellSize' | 'bloodMagic' | 'focus' | 'endTurn' | 'spellsInMotion' | 'collisions' | 'nightPassing';

/** Where a light tip points (game cqw: x right, y down): its caret's tip, and which way the caret points. */
export type TipAnchor = { x: number; y: number; caret: 'down' | 'up' | 'left' | 'right'; caretOffset: number };

const ANCHORS = {
    focusDots: { x: 3.2, y: 47.9, caret: 'down', caretOffset: 1.8 }, // your focus dots (the card above them)
    clock: { x: 44.6, y: 9.8, caret: 'right', caretOffset: 3 }, // the clock face (the card to its left)
    board: { x: 50, y: 41.2, caret: 'up', caretOffset: 12 }, // the board's bottom middle (the card below it)
    castingArea: { x: 33.9, y: 41.2, caret: 'up', caretOffset: 12 }, // below your 3 columns of the board
    healthBar: { x: 22, y: 51.4, caret: 'down', caretOffset: 3 }, // your health bar (the card above its right end)
    spellBook: { x: 11, y: 6.2, caret: 'left', caretOffset: 3 }, // the Spell Book icon (the card to its right)
} satisfies Record<string, TipAnchor>;

/** The light tips: short, pointing at what they're about. */
export const LIGHT_TIPS: Record<TipId, { title: string; text: string; anchor: TipAnchor }> = {
    casting: {
        title: "Casting Spells",
        text: "Hold the mouse button and draw a spell's symbol on your side of the board: your 3 columns.",
        anchor: ANCHORS.castingArea,
    },
    spellBook: {
        title: "Spell Book",
        text: "Your Spell Book shows every spell and the symbol that casts it.",
        anchor: ANCHORS.spellBook,
    },
    spellSize: {
        title: "Spell Size",
        text: "The bigger you draw a symbol, the bigger the spell, up to 3 by 3 cells.",
        anchor: ANCHORS.castingArea,
    },
    bloodMagic: {
        title: "Blood Magic",
        text: `Cast beyond your Focus, and the rest is paid in Health: ${PLAYER_RULES.bloodMagicHealthPerFocus} Health for every missing point of Focus.`,
        anchor: ANCHORS.healthBar,
    },
    focus: {
        title: "Focus",
        text: "Each cell of a spell costs Focus. A Fireball costs 2 per cell; the others, 1. You regain 2 Focus each turn, and can store up to 8.",
        anchor: ANCHORS.focusDots,
    },
    endTurn: {
        title: "Ending Your Turn",
        text: "Done casting? Click the Clock (or press Space) to end your turn. Every spell on the board then moves and interacts.",
        anchor: ANCHORS.clock,
    },
    spellsInMotion: {
        title: "Speed and Damage",
        text: "Speed is how far a spell travels each turn. Damage is how much Health it takes from a wizard it reaches.",
        anchor: ANCHORS.board,
    },
    collisions: {
        title: "When Spells Collide",
        text: "The stronger spell consumes the weaker; equals destroy each other. Water Wheels and drafts bend the rules: see your Spell Book.",
        anchor: ANCHORS.board,
    },
    nightPassing: {
        title: "The Night Is Passing",
        text: "Each turn brings sunrise five minutes closer. After 5:30, a teacher may catch you, and by 6 AM you'll surely be caught.",
        anchor: ANCHORS.clock,
    },
};

const TOOLTIPS_STORAGE_KEY = 'quickCast-isToolTips';

/*
    A class to manage game info state, tooltips, and helpers.
*/
export class TooltipManager {

    // SHOW TOOLTIPS (saved between visits; the Settings button toggles it)
    isToolTips: boolean = true;

    // THE TUTORIAL (for this browser window: a session spans every match in it)
    isLoreDone: boolean = false; // the story has been shown (or tooltips are off)
    seenTips: Set<TipId> = new Set();
    lightTips: Array<TipId> = []; // the light tips showing (usually one; a group shows together)
    tipQueue: Array<Array<TipId>> = []; // groups of tips waiting their turn (one group at a time)

    // ACTIVE MULTI-PAGE TOOLTIP STATE
    active: boolean = false;
    currentPageIndex: number = 0;
    pages: TooltipPage[] = [];
    isLore: boolean = false; // the modal is showing the story (its last page asks about tooltips)

    // DRAWING OFF BOARD
    drawingOffBoardCount: number = 0;
    isDrawingOffBoard: boolean = false;
    drawingOffBoardRef: number = 0;

    // OUT OF FOCUS
    isOutOfFocus: boolean = false;
    isOutOfFocusRef: number = 0;

    // END TURN
    isClickClock: boolean = false;
    isClickClockRef: number = 0;
    private readonly CLICK_CLOCK_WAIT_TIME_MILLI: number = 30000;

    // SPELLBOOK
    isSpellBookOpen: boolean = false;

    // KEYBOARD CONTROLS (shown while the Settings keyboard button is hovered; tips hide meanwhile)
    isKeyboardControlsShown: boolean = false;
    getIsKeyboardControlsShown = (): boolean => this.isKeyboardControlsShown;
    setIsKeyboardControlsShown = (isShown: boolean): void => { this.isKeyboardControlsShown = isShown; }

    reset = (forceUpdate: Function): void => {
        // OUT OF FOCUS
        clearTimeout(this.isOutOfFocusRef);
        this.isOutOfFocus = false;

        // SPELL BOOK
        this.isSpellBookOpen = false;

        // DRAWING OFF BOARD
        clearTimeout(this.drawingOffBoardRef);
        this.drawingOffBoardCount = 0;
        this.isDrawingOffBoard = false;

        // END TURN
        clearTimeout(this.isClickClockRef);
        this.isClickClock = false;
        this.doClickClockFlash(forceUpdate);

        // TOOLTIPS (which ones were seen carries over to the next match)
        this.closeTooltip();
        this.lightTips = [];
        this.tipQueue = [];
    }

    /** Loads the saved setting: on if it was never chosen. */
    loadToolTips = (): void => {
        let saved: unknown = undefined;
        try {
            const item = window.localStorage.getItem(TOOLTIPS_STORAGE_KEY);
            if (item) saved = JSON.parse(item);
        } catch (error) {
            console.warn('Error reading the tooltips setting:', error);
        }
        this.isToolTips = saved !== false;
    }

    /**
     * Turns tooltips on or off (and saves it). Off: closes any showing. The story only opens a session,
     * so turning them on later (Settings) starts with the in-game tips.
     */
    toggleToolTips = (isOn?: boolean) => {
        this.isToolTips = typeof isOn === 'boolean' ? isOn : !this.isToolTips;
        this.isLoreDone = true;
        try {
            window.localStorage.setItem(TOOLTIPS_STORAGE_KEY, JSON.stringify(this.isToolTips));
        } catch (error) {
            console.warn('Error saving the tooltips setting:', error);
        }
        if (!this.isToolTips) {
            this.closeTooltip();
            this.lightTips = [];
            this.tipQueue = [];
        }
    }

    // THE STORY
    getIsLoreDone = (): boolean => this.isLoreDone || !this.isToolTips;
    showLore = (): void => {
        this.pages = GAME_TUTORIALS.LORE;
        this.currentPageIndex = 0;
        this.isLore = true;
        this.active = true;
    }
    /** The story's last page: "Play with tooltips" (true) or "Play" (false). */
    chooseToolTips = (isOn: boolean): void => {
        this.isLoreDone = true;
        this.toggleToolTips(isOn);
        this.closeTooltip();
    }
    getIsLore = (): boolean => this.isLore;

    /**
     * A chunk becomes relevant: shows it (once per session, if tooltips are on), or queues it while
     * another is showing.
     */
    triggerTip = (tip: TipId): void => this.triggerTips([tip]);

    /** Several chunks that show together (e.g. the opening two), each closing on its own. */
    triggerTips = (tips: Array<TipId>): void => {
        if (!this.isToolTips) return;
        const isPending = (tip: TipId) => this.seenTips.has(tip) || this.lightTips.includes(tip) || this.tipQueue.some(group => group.includes(tip));
        const group = tips.filter(tip => !isPending(tip));
        if (!group.length) return;
        if (this.active || this.lightTips.length) {
            this.tipQueue.push(group);
            return;
        }
        this.showTips(group);
    }

    private showTips = (group: Array<TipId>): void => {
        group.forEach(tip => this.seenTips.add(tip));
        this.lightTips = group;
    }

    /**
     * Shows a tip again as a reminder (e.g. "Ending Your Turn" when the player idles), alongside any
     * light tips already showing (not over the story).
     */
    remindTip = (tip: TipId): void => {
        if (!this.isToolTips || this.active || this.lightTips.includes(tip)) return;
        this.seenTips.add(tip);
        this.lightTips = [...this.lightTips, tip];
        this.dropQueuedTip(tip);
    }

    /** Shows the next queued group, once nothing is showing. */
    private showNextTip = (): void => {
        if (this.active || this.lightTips.length || !this.isToolTips) return;
        const next = this.tipQueue.shift();
        if (next) this.showTips(next);
    }

    getLightTips = (): Array<TipId> => this.lightTips;

    /** Closes a light tip (`tip`, or every one showing); once none are left, the next queued group shows. */
    dismissLightTip = (tip?: TipId): void => {
        if (!this.lightTips.length || (tip && !this.lightTips.includes(tip))) return;
        this.lightTips = tip ? this.lightTips.filter(shown => shown !== tip) : [];
        this.showNextTip();
    }

    /** Drops a queued tip that's no longer relevant (and won't show it later). */
    dropQueuedTip = (tip: TipId): void => {
        if (!this.tipQueue.some(group => group.includes(tip))) return;
        this.tipQueue = this.tipQueue.map(group => group.filter(queued => queued !== tip)).filter(group => group.length);
        this.seenTips.add(tip);
    }

    getIsTooltips = (): boolean => this.isToolTips;
    getTotalPages = (): number => this.pages.length;
    getCurrPageNum = (): number => this.currentPageIndex + 1;
    getCurrPageContent = (): TooltipPage | null => this.pages[this.currentPageIndex] ? this.pages[this.currentPageIndex] : null;
    getIsMultiPage = (): boolean => this.pages.length > 1;
    getMultiPageProgress = (): string => `${this.currentPageIndex + 1} / ${this.pages.length}`;
    getIsNextDisabled = (): boolean => this.currentPageIndex === this.pages.length - 1;
    getIsPrevDisabled = (): boolean => this.currentPageIndex === 0;
    getIsLastPage = (): boolean => this.currentPageIndex === this.pages.length - 1;

    nextPage = (): void => {
        if (this.currentPageIndex < this.pages.length - 1) {
            this.currentPageIndex++;
        }
    }

    prevPage = (): void => {
        if (this.currentPageIndex > 0) {
            this.currentPageIndex--;
        }
    }

    /** Closes the modal. Closing the story keeps the current setting (on, if never chosen). */
    closeTooltip = (): void => {
        if (this.isLore && !this.isLoreDone) {
            this.isLoreDone = true;
            this.toggleToolTips(this.isToolTips);
        }
        this.active = false;
        this.currentPageIndex = 0;
        this.pages = [];
        this.isLore = false;
        this.showNextTip();
    }

    // SPELLBOOK
    getIsSpellBookOpen = (): boolean => this.isSpellBookOpen;
    setIsSpellBookOpen = (isSpellBookOpen?: boolean): void => {
        this.isSpellBookOpen = typeof isSpellBookOpen === 'boolean' ? isSpellBookOpen : !this.isSpellBookOpen;
    }

    // DRAWING OFF BOARD
    getIsDrawingOffBoard = (): boolean => this.isDrawingOffBoard;
    incrementDrawingOffBoard = (forceUpdate: Function): void => {
        this.drawingOffBoardCount++;
        if (this.drawingOffBoardCount > 1) {
            clearTimeout(this.drawingOffBoardRef);
            this.isDrawingOffBoard = true;
            forceUpdate();
            this.drawingOffBoardRef = setTimeout(() => {
                this.isDrawingOffBoard = false;
                this.drawingOffBoardCount = 0;
                forceUpdate();
            }, 2000);
        }
    }

    // OUT OF FOCUS
    getIsOutOfFocus = (): boolean => this.isOutOfFocus;
    doOutOfFocusFlash = (forceUpdate: Function): void => {
        clearTimeout(this.isOutOfFocusRef);
        this.isOutOfFocus = true;
        this.isOutOfFocusRef = setTimeout(() => { this.isOutOfFocus = false; forceUpdate(); }, 3000);
    }

    // END TURN
    getIsClickClock = (): boolean => this.isClickClock;
    turnOffIsClickClock = (): void => { this.isClickClock = false; }
    doClickClockFlash = (forceUpdate: Function, waitTimeMilli?: number): void => {
        clearTimeout(this.isClickClockRef);
        // After a while without ending the turn: the "Ending Your Turn" tip, as a reminder
        this.isClickClockRef = setTimeout(() => { this.isClickClock = true; this.remindTip('endTurn'); forceUpdate(); }, !!waitTimeMilli ? waitTimeMilli : this.CLICK_CLOCK_WAIT_TIME_MILLI);
    }
    clearClickClockRef = (): void => {
        clearTimeout(this.isClickClockRef);
        this.isClickClock = false;
    }
}
