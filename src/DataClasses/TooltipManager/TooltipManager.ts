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
            title: "Welcome to Spell Craft!",
            paragraphs: [
                "Welcome to Spell Craft, the strategy-drawing game!", // You are a student at a wizarding boarding school, who is up way past his bedtime! 
                "You are a member of the Hell Raisers club, an illegal club of wizard duelists.",
                "Every night, you roam the hallways of the school, looking to hone your craft and get a \"real\" education in magic...",
                "Members of the club hide their true identities behind masks, so if anyone gets caught out of bed after curfew by a teacher, nobody can rat anybody else out.",
                "As nobody knows the full membership of the Hell Raisers club..."
            ]
        },
        {
            title: "How to Play",
            paragraphs: [
                "Draw symbols on the board with your mouse to cast spells. The first 9 cells on the left are your casting area. The far-right side of the board is your opponent's casting area.",
                "You cannot cast a spell on a cell outside of your casting area or on a cell that already has an active spell on it."
            ]
        },
        {
            title: "The Ticking Clock",
            paragraphs: [
                "Once you and your opponent are done casting spells, click the clock at the top to end the turn and advance time.",
                "Spells on the board will move, and you will grow one step closer to victory--or defeat.",
                "But take heed: with every turn, the chances of getting caught by a teacher increase! By 6 AM, your chances of getting caught are 100% and the game is over.",
                "At which point, you will face a fate worse than death: expulsion!",
            ]
        },
        {
            title: "The Goal",
            paragraphs: [
                "Your goal: defeat your dueling partner. And don't get caught!",
                "As time progresses, your spells move left to right, and your opponent's: right to left, colliding with other spells and eventually with the duelists, reducing their health.",
                "The duel is over when you or your opponent's health reaches 0, or if you get caught by a teacher.",
            ]
        },
        {
            title: "Many Ways to Play",
            paragraphs: [
                "Spell Craft has mouse and keyboard controls. You can use a mixture of mouse and keyboard or just mouse/keyboard to play.",
                "Check the \"Settings\" button for the keyboard controls."
            ]
        },
        {
            title: "One Last Thing: You Need Focus...",
            paragraphs: [
                "All spells require Focus to cast. If you are out of focus, you will not be able to cast any more spells.",
                "The amount of Focus required to cast a spell is dependent on the spell and the size of the spell.",
                "Larger spells require more focus.",
                "Note: If you cast a spell that requires more Focus than you currently have, the difference can be paid for with your health, but be careful...",
            ]
        }

    ],


    /**
     * TUTORIAL 1: Placement Zones & Canvas Missteps
     */
    PLACEMENT_ZONE: [
        {
            title: "Casting Boundaries",
            paragraphs: [
                "Your magic requires anchoring. Drawing entirely off the grid or leaking lines outside your designated placement cells means the spell will drift harmlessly into the dark.",
                "Ensure your line compositions are drawn precisely over free squares within your glowing zone to ground the arcane energy successfully."
            ]
        }
    ],

    /**
     * TUTORIAL 2: Focus & Resource Exhaustion (Blood Magic)
     */
    RESOURCE_DEBT: [
        {
            title: "Resource Exhaustion",
            paragraphs: [
                "Spells extract focus costs relative to their ultimate layout footprint. Should you choose to deploy structures without possessing the necessary focus, the spell will still seek structure.",
                "However, to anchor it, the casting pipeline will automatically extract a deeper, more painful tax to normalize the missing balance."
            ]
        },
        {
            title: "Blood Magic",
            paragraphs: [
                "When focus dips past zero, you invoke forbidden Blood Magic. The remaining resource debt is instantly extracted from your absolute life pool, exchanging 5 health points for each missing node of focus.",
                "Deploying massive spatial arrays while depleted can quickly prove fatal. Balance structural ambition against physical survival."
            ]
        }
    ],

    /**
     * TUTORIAL 3: Time Dynamics, Turns, & Environmental Hazards
     */
    TIME_HAZARDS: [
        {
            title: "Witching Hours & Expulsion",
            paragraphs: [
                "Ending your turn or exhausting operations forces the heavy mechanical hands of the clock face to march forward. Time is an absolute boundary.",
                "If your skirmish drags out and the dial registers 6:00 AM, the rising sun ends the match immediately, resulting in an automatic dual expulsion."
            ]
        },
        {
            title: "The Teacher's Vigilance",
            paragraphs: [
                "Sneaking through dark corridors after hours carries grave risks. As the night morphs toward dawn, the layout ambient tension climbs rapidly.",
                "With each passing hour, the mathematical probability of getting caught by a patrolling teacher surges. Do not let the duel linger longer than necessary."
            ]
        }
    ],

    /**
     * TUTORIAL 4: Water Wheel Spell Specialization (Healing & Vectors)
     */
    WATER_WHEEL: [
        {
            title: "The Fluid Domain",
            paragraphs: [
                "The Water Wheel is an adaptable construct capable of reading shifting battlefield contexts. It doesn't merely strike forward; it harmonizes with local conditions.",
                "Depending on alignment, vector manipulation, and interaction with physical targets, this archetype serves as both a bulwark and a wellspring."
            ]
        },
        {
            title: "Restoration Mechanics",
            paragraphs: [
                "Directing the flowing alignment of the Water Wheel toward your own lines allows the element to saturate your core, granting vital health restoration.",
                "Utilizing this cycle correctly can effectively counter severe injury or reverse the resource damage exacted by deep Blood Magic deployment."
            ]
        },
        {
            title: "Vector Reversal",
            paragraphs: [
                "When an opposing horizontal force threatens your layout, positioning the Water Wheel correctly interrupts the vector. Instead of succumbing, the wheel catches the kinetic velocity.",
                "This redirects the spell path cleanly, mirroring the projectories backward toward the rival spellcaster or shoving them off the game board borders entirely."
            ]
        }
    ],

    /**
     * TUTORIAL 5: Spell Collisions, Consumption, & Metamagic Properties
     */
    SPELL_COLLISIONS: [
        {
            title: "Arcane Collisions",
            paragraphs: [
                "When two mobile spell matrices attempt to occupy identical board junctions, they do not simply vanish. A violent recalculation occurs, where tier disparities dictate the dominant architecture.",
                "The node possessing greater absolute scale or energy will completely consume the weaker matrix, absorbing its residual power into its own structural form."
            ]
        },
        {
            title: "Empowerment & Speed Traps",
            paragraphs: [
                "Consumption can be a tactical masterstroke. Swallowing a friendly or rival speed matrix infuses the dominant spell, multiplying its travel velocity or compounding its raw damage parameters.",
                "Look for opportunities to feed smaller, inexpensive sigils into larger active sectionals to supercharge your offensive line."
            ]
        },
        {
            title: "Subversion & Trajectory Shifts",
            paragraphs: [
                "Be warned: consumption is not always advantageous. Falling into a prepared elemental counter can cause your high-tier projectory to absorb chaotic properties.",
                "A carefully placed defensive sigil can cause a massive tier spell to reflect back onto your own lines, or forcefully vector the entire compound off the margins of the board."
            ]
        }
    ]
};


/*
    A class to manage game info state, tooltips, and helpers. 
*/
export class TooltipManager {

    /*
    
  
    TO-DO: consider showing tips (that can be toggled off) for certain actions the first time they are triggered:
  
      - drawing off the board completely or completely off placement cells
      - casting more than 4 spells per turn (blood magic)
      - healing with Phelgm
      - reversing with Phlegm
      - out of focus -> end turn -> progressing time necessary, but increases chances of getting caught by a teacher!
      - consuming a spell
      - NPC casting a spell -> what is the conceit of the game? what is the goal?
  
      TO-DO: store "toggle-off tool tips" in local storage
    
    */

    // SHOW TOOLTIPS
    isToolTips: boolean = true;

    // ACTIVE MULTI-PAGE TOOLTIP STATE
    active: boolean = false;
    currentPageIndex: number = 0;
    pages: TooltipPage[] = proxy(GAME_TUTORIALS.WELCOME);

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
