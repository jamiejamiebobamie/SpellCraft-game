import { proxy } from "valtio";

export interface TooltipPage {
    title?: string;
    paragraphs?: string[];
    mediaUrl?: string;
}

// Define your pre-written tutorial database mapping keys to specific slide sets
export const GAME_TUTORIALS = {
    WELCOME: [
        {
            title: "Welcome to SpellCraft",
            paragraphs: [
                "Welcome to the world of SpellCraft, the strategy-drawing game!",
                "You are a member of the Hell Raisers, a wizard fight club."
            ],
            mediaUrl: './logo.png'
        },
        {
            title: "Out of Bed, After Curfew",
            paragraphs: [
                "Tonight, like the other nights, you have left the safety of your bed, to roam the halls of the school--your wand drawn--for one purpose: to gain a \"truer\" education in magic.",
            ],
            mediaUrl: './tooltip-imgs/out-of-bed.png'
        },
        {
            title: "The Masquerade",
            paragraphs: [
                "You and every Hell Raiser wear a mask to hide your identities, even from each another.",
                "A small insurance policy against tattle-tales... for if one of you gets caught by a teacher, the others are safe.",
            ],
            mediaUrl: './mask-icons/1mask-icon-Normal.png'
        },
        {
            title: "How to Play",
            paragraphs: [
                "Each combatant casts Spells in the hopes of reducing their opponent's Health to zero.",
                "To cast a Spell, click and hold the left mouse button and draw a Spell symbol.",
            ],
            mediaUrl: './tooltip-imgs/how-to-play.gif'
        },
        {
            title: "Casting Area",
            paragraphs: [
                "Each player can cast Spells only on their side of the gameboard (the first 9 cells).",
            ],
            mediaUrl: './tooltip-imgs/casting-area.gif'
        },
        {
            title: "Spell Book",
            paragraphs: [
                "Check your \"Spell Book\" to see what Spells are available and their corresponding symbols.",
            ],
            mediaUrl: './tooltip-imgs/spell-book.gif'
        },
        {
            title: "The Ticking Clock",
            paragraphs: [
                "Once you are done adding Spells to the gameboard, click the Clock to end the turn.",
                "Spells on the board will move and interact.",
            ],
            mediaUrl: './tooltip-imgs/ticking-clock.png'
        },
        {
            title: "Sunrise",
            paragraphs: [
                "With every turn of the Clock, you grow one step closer to victory or defeat, but your chances of getting caught by the faculty also increase.",
                "By 6 AM, you will surely be caught.",
            ],
            mediaUrl: './tooltip-imgs/sunrise.png'
        },
        {
            title: "Many Ways to Play",
            paragraphs: [
                "SpellCraft has mouse and keyboard controls. You can use a mixture of mouse and keyboard controls or just mouse/keyboard to play.",
                "Check the \"Settings\" button for the keyboard controls.",
            ],
            mediaUrl: './tooltip-imgs/many-ways-to-play.png'
        },
        {
            title: "You Need to Focus",
            paragraphs: [
                "To cast a spell, you must spend Focus points. If you are out of Focus points, you will not be able to cast.",
                "Larger Spells require more Focus points.",
            ],
            mediaUrl: './tooltip-imgs/out-of-focus.gif'
        },
        {
            title: "Regaining Focus",
            paragraphs: [
                "After every turn, you will regain 2 Focus points to use on your next turn.",
                "You can store up to 8 Focus points at a time.",
            ],
            mediaUrl: './tooltip-imgs/regaining-focus.gif'
        },
        {
            title: "Blood Magic",
            paragraphs: [
                "If you cast a Spell that requires more Focus points than you have, the missing Focus points will come from your Health bar.",
                "For every missing point of Focus, the Spell will cost you 5 Health points.",
            ],
            mediaUrl: './tooltip-imgs/blood-magic.gif'
        },
        {
            title: "Speed and Damage",
            paragraphs: [
                "Spells also have a Damage and a Speed.",
                "Speed determines how fast a Spell moves during a turn.",
                "Damage determines how many Health points are lost when the Spell collides with a player.",
            ],
            mediaUrl: './tooltip-imgs/speed-and-damage.gif'
        },
        {
            title: "Winners and Losers",
            paragraphs: [
                "When two Spells collide, they are either destroyed or consumed.",
                "If two Spells do the same amount of Damage and collide, they destroy each other.",
                "If one Spell does more damage, the stronger Spell will consume the weaker one.",
                "Consult your Spell Book for further information.",
            ],
            mediaUrl: './tooltip-imgs/winners-and-losers.gif'
        },
    ]
};


/*
    A class to manage game info state, tooltips, and helpers. 
*/
export class TooltipManager {

    // SHOW TOOLTIPS
    isToolTips: boolean = true;

    // ACTIVE MULTI-PAGE TOOLTIP STATE
    active: boolean = false;
    currentPageIndex: number = 0;
    pages: TooltipPage[] = [];

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

        // TOOLTIPS
        this.closeTooltip();
    }

    toggleToolTips = (isOn?: boolean) => {
        this.isToolTips = typeof isOn === 'boolean' ? isOn : !this.isToolTips;
        if (!this.isToolTips) {
            this.closeTooltip();
        }
    }

    // Accepts a single page or an entire sequence array
    showTooltip = (tooltipPages: TooltipPage | TooltipPage[] = proxy(GAME_TUTORIALS.WELCOME)): void => {
        if (!this.isToolTips) return;
        this.pages = Array.isArray(tooltipPages) ? tooltipPages : [tooltipPages];
        this.currentPageIndex = 0;
        this.active = true;
    }

    getIsTooltips = (): boolean => this.isToolTips;
    getTotalPages = (): number => this.pages.length;
    getCurrPageNum = (): number => this.currentPageIndex + 1;
    getCurrPageContent = (): TooltipPage | null => this.pages[this.currentPageIndex] ? this.pages[this.currentPageIndex] : null;
    getIsMultiPage = (): boolean => this.pages.length > 1;
    getMultiPageProgress = (): string => `${this.currentPageIndex + 1} / ${this.pages.length}`;
    getIsNextDisabled = (): boolean => this.currentPageIndex === this.pages.length - 1;
    getIsPrevDisabled = (): boolean => this.currentPageIndex === 0;

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

    closeTooltip = (): void => {
        this.active = false;
        this.currentPageIndex = 0;
        this.pages = [];
        this.isToolTips = false;
        window.localStorage.setItem('quickCast-isToolTips', JSON.stringify(false));
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
        this.isClickClockRef = setTimeout(() => { this.isClickClock = true; forceUpdate(); }, !!waitTimeMilli ? waitTimeMilli : this.CLICK_CLOCK_WAIT_TIME_MILLI);
    }
    clearClickClockRef = (): void => {
        clearTimeout(this.isClickClockRef);
        this.isClickClock = false;
    }
}
