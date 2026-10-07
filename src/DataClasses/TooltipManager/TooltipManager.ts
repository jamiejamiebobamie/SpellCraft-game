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

    // DRAWING OFF BOARD
    drawingOffBoardCount: number = 0;
    isDrawingOffBoard: boolean = false;
    drawingOffBoardRef = 0;

    // OUT OF FOCUS
    isOutOfFocus: boolean = false;
    isOutOfFocusRef = 0;

    // SPELLBOOK 
    isSpellBookOpen: boolean = false;

    toggleToolTips = (isOn?: boolean) => {
        this.isToolTips = typeof isOn === 'boolean' ? isOn : !this.isToolTips;
    }

    // SPELLBOOK
    getIsSpellBookOpen = (): boolean => this.isSpellBookOpen;
    setIsSpellBookOpen = (isSpellBookOpen: boolean): void => {
        this.isSpellBookOpen = isSpellBookOpen;
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