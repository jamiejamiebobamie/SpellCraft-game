export const drawKeyboardOverlay = (ctx: CanvasRenderingContext2D, viewW: number, viewH: number) => {
    ctx.save();

    // 1. Dark Solid Background Layer Mask
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, 0, viewW, viewH);

    // 2. High-Contrast Main Title
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${viewW * 0.038}px 'EnchantedLand', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText("Keyboard Controls", viewW * 0.5, viewH * 0.03);

    // Core layout boundary structures
    const colY = viewH * 0.22;
    const colW = viewW * 0.26;
    const gap = viewW * 0.03;

    // Anchor X positions for Left, Middle, and Right column blocks
    const leftColX = viewW * 0.5 - colW * 1.5 - gap;
    const midColX = viewW * 0.5 - colW * 0.5;
    const rightColX = viewW * 0.5 + colW * 0.5 + gap;

    const keySize = viewW * 0.045;
    const keyGap = viewW * 0.008;
    const keyPositions = new Map<string, { x: number; y: number; w: number; h: number }>();

    // Shared method to render flat solid keys with white frames and red translucent fill
    const renderSingleKeyNode = (k: string, x: number, y: number, customW?: number) => {
        const finalW = customW ? customW : keySize;
        ctx.save();

        ctx.beginPath();

        ctx.fillStyle = 'rgba(80, 26, 26, .5)';
        ctx.strokeStyle = '#ebdca5';
        ctx.lineWidth = 2;

        if (ctx.roundRect) ctx.roundRect(x, y, finalW, keySize, viewW * 0.004);
        else ctx.rect(x, y, finalW, keySize);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff'; // Flat solid white text strings
        ctx.font = `bold ${viewW * 0.016}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(k, x + finalW * 0.5, y + keySize * 0.5);
        ctx.restore();

        keyPositions.set(k, { x, y, w: finalW, h: keySize });
    };

    // Draw Column Structural Vertical Dotted Lines
    const drawVerticalDivider = (dividerX: number) => {
        ctx.save();
        ctx.strokeStyle = 'rgba(235, 220, 165, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]); // Dotted look
        ctx.beginPath();
        ctx.moveTo(dividerX, colY - viewH * 0.02);
        ctx.lineTo(dividerX, viewH * 0.9);
        ctx.stroke();
        ctx.restore();
    };
    drawVerticalDivider(midColX - gap * 0.5);
    drawVerticalDivider(rightColX - gap * 0.5);

    // =========================================================================
    // VISUAL WORKFLOW HEADER SYSTEM (1 → 2 → 3)
    // =========================================================================
    const workflowY = colY - viewH * 0.09;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${viewW * 0.032}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const num1X = leftColX + colW * 0.5;
    const num2X = midColX + colW * 0.5;
    const num3X = rightColX + colW * 0.5;

    ctx.fillText("1", num1X, workflowY);
    ctx.fillText("2", num2X, workflowY);
    ctx.fillText("3", num3X, workflowY);

    // Draw arrow lines between step indicators
    const drawWorkflowArrow = (start: number, end: number) => {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(start + viewW * 0.02, workflowY);
        ctx.lineTo(end - viewW * 0.02, workflowY);
        ctx.stroke();

        // Arrow head point vectors
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(end - viewW * 0.02, workflowY);
        ctx.lineTo(end - viewW * 0.026, workflowY - viewW * 0.005);
        ctx.lineTo(end - viewW * 0.026, workflowY + viewW * 0.005);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    };
    drawWorkflowArrow(num1X, num2X);
    drawWorkflowArrow(num2X, num3X);
    ctx.restore();


    // =========================================================================
    // COLUMN 1: READY SPELL (LEFT)
    // =========================================================================
    ctx.fillStyle = '#ebdca5';
    ctx.font = `bold ${viewW * 0.022}px 'EnchantedLand', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText("Ready Spell", leftColX + colW * 0.5, colY);

    const leftGroupKeys = ['1', '2', '3', '4', '5'];
    const leftKeysStartX = leftColX + (colW - (keySize * 5 + keyGap * 4)) * 0.5;
    leftGroupKeys.forEach((k, idx) => {
        const kX = leftKeysStartX + idx * (keySize + keyGap);
        const kY = colY + viewH * 0.22 + viewH * 0.02 * (idx % 2 == 0 ? 1 : -1);
        renderSingleKeyNode(k, kX, kY);
    });


    // =========================================================================
    // COLUMN 2: CAST SPELL / CANCEL SPELL (MIDDLE)
    // =========================================================================
    ctx.fillStyle = '#ebdca5';
    ctx.textAlign = 'center';
    ctx.fillText("Place Spell", midColX + colW * 0.5, colY);

    const gridRows = [
        ['Q', 'W', 'E'],
        ['A', 'S', 'D'],
        ['Z', 'X', 'C']
    ];
    const gridMatrixWidth = keySize * 3 + keyGap * 2;
    const midGridStartX = midColX + (colW - gridMatrixWidth) * 0.5;
    // const midGridStartY = colY + viewH * 0.06;
    const midGridStartY = colY + viewH * 0.08;

    gridRows.forEach((row, rIdx) => {
        row.forEach((k, cIdx) => {
            const kX = midGridStartX + cIdx * (keySize + keyGap);
            const kY = midGridStartY + rIdx * (keySize + keyGap);
            renderSingleKeyNode(k, kX, kY);
        });
    });

    // 2b. Cancel Spell Row Placement
    const cancelTextY = midGridStartY + (keySize + keyGap) * 3 + viewH * 0.07;
    ctx.fillStyle = '#ebdca5';
    ctx.fillText("Cancel Readied Spell", midColX + colW * 0.5, cancelTextY);

    const cancelKeyX = midColX + (colW - keySize) * 0.5;
    const cancelKeyY = cancelTextY + viewH * 0.05;
    renderSingleKeyNode('6', cancelKeyX, cancelKeyY);


    // =========================================================================
    // COLUMN 3: END TURN & NPC DIFFICULTY (RIGHT COLUMN COMPARTMENT)
    // =========================================================================
    const lastColHeader = rightColX + colW * 0.6;
    ctx.fillStyle = '#ebdca5';
    ctx.textAlign = 'center';
    ctx.fillText("End Turn", lastColHeader, colY);

    const rightKeysStartY = colY + viewH * 0.08;
    const escWidth = keySize * 1.5;
    const escX = rightColX + (colW - escWidth) * 0.7;
    renderSingleKeyNode('ESC', escX, rightKeysStartY);

    const spaceWidth = colW;
    const spaceX = rightColX + colW * 0.1;
    const spaceY = rightKeysStartY + keySize + viewH * 0.05;
    renderSingleKeyNode('SPACE', spaceX, spaceY, spaceWidth);

    // Dotted horizontal line partition underneath spacebar
    const dividerRightY = spaceY + keySize + viewH * 0.063;
    ctx.save();
    ctx.strokeStyle = 'rgba(235, 220, 165, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rightColX + colW * 0.05, dividerRightY);
    ctx.lineTo(rightColX + colW * 1.15, dividerRightY);
    ctx.stroke();
    ctx.restore();

    // Appended NPC Configuration Sub-Header track block inside Right Column width limits
    ctx.fillStyle = '#ebdca5';
    ctx.fillText("Change Difficulty", lastColHeader, cancelTextY);

    const shiftWidth = colW * 0.55;
    const shiftX = rightColX + (colW - shiftWidth) * 0.73;
    renderSingleKeyNode('SHIFT', shiftX, cancelKeyY, shiftWidth);


    // =========================================================================
    // LOW-PRIMACY WIDGET CONNECTOR LINE ENGINE (0.35 OPACITY BLEND)
    // =========================================================================
    const drawKeyWidgetConnectorLine = (
        keyLabel: string,
        actionLabel: string,
        layoutMode: 'left' | 'right' | 'up' | 'down',
        lengthScalar = 1.0
    ) => {
        const pos = keyPositions.get(keyLabel);
        if (!pos) return;

        const keyCenterX = pos.x + pos.w * 0.5;
        const keyCenterY = pos.y + pos.h * 0.5;

        ctx.save();
        ctx.globalAlpha = 0.35; // Diminished priority opacity layer mesh
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ebdca5';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let p4X = keyCenterX;
        let p4Y = keyCenterY;
        let txtAlign: CanvasTextAlign = 'center';

        ctx.beginPath();
        ctx.moveTo(keyCenterX, keyCenterY);

        if (layoutMode === 'up' || layoutMode === 'down') {
            const vertSign = (layoutMode === 'up') ? -1 : 1;
            const segment1Y = viewH * 0.015 * vertSign;
            const angleX = viewW * 0.012 * (keyCenterX > viewW * 0.5 ? 1 : -1);
            const angleY = viewH * 0.018 * vertSign * lengthScalar;
            const segment2Y = viewH * 0.063 * vertSign;

            const p2X = keyCenterX;
            const p2Y = keyCenterY + segment1Y;
            const p3X = p2X + angleX;
            const p3Y = p2Y + angleY;
            p4X = p3X;
            p4Y = p3Y + segment2Y;

            ctx.lineTo(p2X, p2Y);
            ctx.lineTo(p3X, p3Y);
            ctx.lineTo(p4X, p4Y);
            txtAlign = 'center';
        } else {
            const sideSign = (layoutMode === 'left') ? -1 : 1;
            const h1 = viewW * 0.012 * sideSign;
            const cx = viewW * 0.018 * sideSign * lengthScalar;
            const cy = viewW * 0.022 * (keyCenterY > viewH * 0.5 ? -1 : 1);
            const h2 = viewW * 0.012 * sideSign;

            const p2X = keyCenterX + h1;
            const p2Y = keyCenterY;
            const p3X = p2X + cx;
            const p3Y = p2Y + cy;
            p4X = p3X + h2;
            p4Y = p3Y;

            ctx.lineTo(p2X, p2Y);
            ctx.lineTo(p3X, p3Y);
            ctx.lineTo(p4X, p4Y);
            txtAlign = (layoutMode === 'left') ? 'right' : 'left';
        }
        ctx.stroke();

        ctx.fillStyle = '#ebdca5';
        ctx.beginPath();
        ctx.arc(keyCenterX, keyCenterY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Print flat text label content paths safely
        ctx.save();
        ctx.font = `bold ${viewW * 0.02}px 'EnchantedLand', sans-serif`;
        ctx.textBaseline = (layoutMode === 'up' || layoutMode === 'down') ? (layoutMode === 'up' ? 'bottom' : 'top') : 'middle';
        ctx.textAlign = txtAlign;
        const txtLines = actionLabel.split('\n');
        const verticalLineSpacingDelta = viewW * 0.015;
        let baseTextX = p4X;
        let baseTextY = p4Y;
        if (layoutMode === 'left') baseTextX -= viewW * 0.005;
        if (layoutMode === 'right') baseTextX += viewW * 0.005;
        if (layoutMode === 'up') baseTextY -= viewH * 0.005;
        if (layoutMode === 'down') baseTextY += viewH * 0.005;
        txtLines.forEach((lineText, lineIdx) => {
            let finalY = baseTextY;
            if (layoutMode === 'left' || layoutMode === 'right') {
                finalY += (lineIdx - (txtLines.length - 1) * 0.5) * verticalLineSpacingDelta;
            } else {
                finalY += lineIdx * verticalLineSpacingDelta;
                if (layoutMode === 'up') finalY -= (txtLines.length - 1) * verticalLineSpacingDelta;
            }
            ctx.fillStyle = '#ffffff'; // Pristine solid white font string layers
            ctx.fillText(lineText, baseTextX, finalY);
        });
        ctx.restore();
    };
    // 1. Ready Spell Column Actions (Alternated up and down alignment layout tracks)
    drawKeyWidgetConnectorLine('1', "Chain Lightning", 'up', 1.5);
    drawKeyWidgetConnectorLine('2', "Fireball", 'down', 1.5);
    drawKeyWidgetConnectorLine('3', "Updraft", 'up', 0.6);
    drawKeyWidgetConnectorLine('4', "Downdraft", 'down', 1.5);
    drawKeyWidgetConnectorLine('5', "Water Wheel", 'up', 1.5);
    ctx.restore();
};