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
                "As a member of the Hell Raisers club, an illicit club of wizard duelists, you are up way past your bedtime..."
            ]
        },
        {
            title: "Out of Bed, After Curfew",
            paragraphs: [
                // "Every night you and the other members of your club leave the safety of your beds, to roam the hallways of the wizarding boarding school that you all attend--wands drawn, looking for a fight!",
                "Tonight, just as every night, you have left the safety of your bed, to roam the hallways of the wizarding boarding school that you attend--wand drawn--with one goal in mind: to get into a fight!",
                // "You risk expulsion to gain a \"truer\" education in magic than that which they recieve during the day.",
                "You risk expulsion to gain a \"true\" education in magic.",// than that which they recieve during the day.",
                // "And when you find another member of your club, the duel begins!",
            ]
        },
        // {
        //     title: "Lure of Power",
        //     paragraphs: [
        //         "You're not supposed to be out of bed at this hour. But all of you cannot help it. There is something ...undeniable in breaking the rules.",
        //         "So, every night you risk expulsion and gain a truer education in magic than you recieve during the day.",
        //         // "Besides, this is where one gets a real education in magic.",
        //         // "Such is the life of a Hell Raiser.",
        //         // "So out of a desire for self-preservation, all members of your club have sworn a vow of secrecy, even from one another.",
        //         // "You don't know who is in your club and they don't know you. You all wear masks that cover your faces and distort your voices.",
        //         // "It's a small bit of insurance against the inevitable: when one of you gets caught by a teacher.",
        //         // "By punishment or persuasion, information cannot be forced from someone who knows nothing.",
        //         // "Anonymity is a small comfort in a cruel world.",
        //     ]
        // },
        {
            title: "Masked Demons",
            paragraphs: [
                // "You're not supposed to be out of bed at this hour, wondering the hallways of the school. Put simply: you risk expulsion.",
                // "But nothing ventured, is nothing gained...",
                // "Every night, you grow more powerful, more seasoned. The lure of power is intoxicating.",
                // "Out of a desire for self-preservation, 
                // "All members of your club have sworn a vow of secrecy, even from each other.",//one another.",
                // "As a small bit of insurance, every Hell Raiser wears a mask that covers their face and distorts their voice. For when the inevitable finally does occur--when someone finally gets caught, out of bed by a teacher--no information can be forced from their lips, by punishment or persuasion, for that student will know nothing.",
                // "\"Who are the other Hell Raisers,\" one professor may cry between whippings. \"Tell me their names!\"",
                // , information cannot be forced from someone's lips when they know nothing.",
                // "Anonymity is but a small comfort in this oh-too-cruel world.",
                // "As a small bit of insurance against tattle-tales, 
                "You, and every other duelist this evening, is wearing a mask. It covers your face and distorts your voice, obscuring your identity from all, even from one another.",
                "A small insurance policy against tattle-tales, for if one of you gets caught, the idenitites of the others are safe.",
                "You do not know them, and they do not know you, a Hell Raisers life."// for we."
                // every Hell Raiser wears a mask that covers their face and distorts their voice, hiding their identities even from one another.",
                // "Every Hell Raiser wears a mask. For when the inevitable finally does occur--when a Hell Raiser does get caught one night, out of bed by a teacher--no information can be forced from his or her lips, by punishment or persuasion, for that student will truly know nothing of the others.",
                // "For if you are caught, a professor cannot force from your lips, by punishment or persuasion, the identites of your compatriots, for you do not know them, and they don't know you."//information that someone simply does not have."// can be forced from his or her lips, for that student will truly know nothing of the others.",
            ]
        },
        {
            title: "How to Play",
            paragraphs: [
                "Once a duel has begun, each duelist casts Spells in the hopes of reducing their opponent's Health to zero.",
                "To cast a Spell, click and hold the left mouse button to draw a Spell's symbol on the gameboard.",
                "Release the left mouse button when done drawing to place the Spell."
                // To cast spells, click and hold the left mouse button and draw a spell symbol on the gameboard.",
                // "Each player can cast spells only on their side of the board.",
                // "For you, that means the first 9 cells on the far-left.",
                // "You cannot cast outside of this area and you cannot cast a spell where there already is one.",
                // "Check your \"Spell Book\" for what spells are available to cast, and their corresponding symbols.",
            ]
        },
        {
            title: "Casting Area",
            paragraphs: [
                // "Once the duel begins, each duelist casts spells in the hopes of defeating their opponent (ie. reducing their opponent's Health to zero).",
                // "To cast spells, click and hold the left mouse button and draw a spell symbol on the gameboard.",
                "Each player can cast Spells only on their side of the board. For you, that means the first 9 cells on the far-left.",
                "You cannot cast outside of this area and you cannot cast a Spell where there already is one.",
                // "Check your \"Spell Book\" for what spells are available to cast, and their corresponding symbols.",
            ]
        },
        {
            title: "Spell Book",
            paragraphs: [
                // "Once the duel begins, each duelist casts spells in the hopes of defeating their opponent (ie. reducing their opponent's Health to zero).",
                // "To cast spells, click and hold the left mouse button and draw a spell symbol on the gameboard.",
                // "Each player can cast spells only on their side of the board.",
                // "For you, that means the first 9 cells on the far-left.",
                // "You cannot cast outside of this area and you cannot cast a spell where there already is one.",
                "Check your \"Spell Book\" to see what Spells are available to cast, and their corresponding symbols.",
            ]
        },
        {
            title: "The Ticking Clock",
            paragraphs: [
                "Once you and your opponent are done adding Spells to the gameboard, click the Clock to end the turn and advance time.",
                "Spells on the board will move, and interact with one another.",
                // "With every turn of the Clock, you grow one step closer to victory or defeat, but your chances of getting caught also increase.",
                // "Do not dilly-dally: Defeat your dueling partner as quickly as possible... For by 6 AM, you both will surely be caught!",
            ]
        },
        {
            title: "Sunrise",
            paragraphs: [
                // "Once you and your opponent are done adding spells to the gameboard, click the Clock to end the turn and advance time.",
                // "Spells on the board will move, and interact with one another.",
                "With every turn of the Clock, you grow one step closer to victory or defeat, but your chances of getting caught also increase.",
                "Do not dilly-dally. Defeat your dueling partner as quickly as possible. By 6 AM, sunrise, you both will surely be caught!",
            ]
        },
        // {
        //     title: "The Goal",
        //     paragraphs: [
        //         "Defeat your dueling partner. And don't get caught!",
        //         "As time progresses, your spells move left to right, and your opponent's: right to left, colliding with other spells and eventually with the duelists, reducing their health.",
        //         "The duel is over when you or your opponent's health reaches 0, or if you get caught by a teacher.",
        //     ]
        // },
        {
            title: "Many Ways to Play",
            paragraphs: [
                "SpellCraft has mouse and keyboard controls. You can use a mixture of mouse and keyboard controls or just mouse or keyboard to play.",
                "Check the \"Settings\" button for the keyboard controls.",
                // "Check your \"Spell Book\" for what spells are available to cast, and their corresponding symbols.",
            ]
        },
        {
            title: "You Need Focus...",
            paragraphs: [
                "All Spells require Focus to cast. If you are out of Focus, you will not be able to cast any more Spells.",
                "The amount of Focus required to cast a Spell is dependent on the size of the Spell, with larger Spells requiring more Focus.",
                // "After every turn, you will regain 2 Focus points to use on your next turn.",
                // "You can store up to 8 Focus points at a time.",
                // "If you cast a spell that requires more Focus than you currently have, the missing Focus points can be paid for with Health points...",
                // "For every missing point of Focus a spell requires, the spell will take 5 points of Health from you.",
                // "This is Blood Magic, and it can end your duel early if you draw too much."
            ]
        },
        {
            title: "Regaining Focus",
            paragraphs: [
                // "All spells require Focus to cast. If you are out of Focus, you will not be able to cast any more spells.",
                // "The amount of Focus required to cast a spell is dependent on the size of the spell, with larger spells requiring more Focus.",
                "After every turn, you will regain 2 Focus points to use on your next turn.",
                "You can store up to 8 Focus points at a time.",
                // "If you cast a spell that requires more Focus than you currently have, the missing Focus points can be paid for with Health points...",
                // "For every missing point of Focus a spell requires, the spell will take 5 points of Health from you.",
                // "This is Blood Magic, and it can end your duel early if you draw too much."
            ]
        },
        {
            title: "Blood Magic",
            paragraphs: [
                // "All spells require Focus to cast. If you are out of Focus, you will not be able to cast any more spells.",
                // "The amount of Focus required to cast a spell is dependent on the size of the spell, with larger spells requiring more Focus.",
                // "After every turn, you will regain 2 Focus points to use on your next turn.",
                // "You can store up to 8 Focus points at a time.",
                "If you cast a Spell that requires more Focus than you currently have, the missing Focus points will be paid for in blood.",// Health points...",
                "For every missing point of Focus a Spell requires, the Spell will take 5 points of Health from you.",
                "This is Blood Magic, and it can end the duel early if you are careless."
            ]
        },
        {
            title: "Speed and Damage",
            paragraphs: [
                "Beyond a Focus cost, all Spells also have a Damage and a Speed.",
                "Speed determines how many cells a Spell moves during a turn.",
                "And Damage determines how many Health points are detracted when the Spell collides with a player.",
            ]
        },
        {
            title: "Winners and Losers",
            paragraphs: [
                "Damage also determines what happens when two Spells collide on the gameboard.",
                "If two Spells do the same amount of Damage and collide, they destroy each other.",
                "If one Spell does more damage than another Spell, it will consume the weaker the Spell on collision.",
                "Consuming a weaker Spell can be a benefit or a detriment to the stronger Spell, depending on the context.",
                "Consult your Spell Book for further information."
            ]
        },
    ]
};


/*
    A class to manage game info state, tooltips, and helpers. 
*/
export class TooltipManager {

    /*
      TO-DO: store "toggle-off tool tips" in local storage
    */

    // SHOW TOOLTIPS
    isToolTips: boolean = true;

    // ACTIVE MULTI-PAGE TOOLTIP STATE
    active: boolean = false;
    currentPageIndex: number = 0;
    pages: TooltipPage[] = [];//proxy(GAME_TUTORIALS.WELCOME);

    // DRAWING OFF BOARD
    drawingOffBoardCount: number = 0;
    isDrawingOffBoard: boolean = false;
    drawingOffBoardRef: any = 0;

    // OUT OF FOCUS
    isOutOfFocus: boolean = false;
    isOutOfFocusRef: any = 0;

    // SPELLBOOK 
    isSpellBookOpen: boolean = false;

    toggleToolTips = (isOn?: boolean) => {
        this.isToolTips = typeof isOn === 'boolean' ? isOn : !this.isToolTips;
        if (!this.isToolTips) {
            this.closeTooltip();
        }
    }

    // Accepts a single page or an entire sequence array
    showTooltip = (tooltipPages: TooltipPage | TooltipPage[]): void => {
        if (!this.isToolTips) return;
        this.pages = Array.isArray(tooltipPages) ? tooltipPages : [tooltipPages];
        this.currentPageIndex = 0;
        this.active = true;
    }

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
}
