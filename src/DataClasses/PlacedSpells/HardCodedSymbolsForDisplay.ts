// Used for SpellBook Symbol display.
export const HARDCODED_SYMBOLS_FOR_DISPLAY = new Map([
    [
        'circle', [
            { x: 0.51, y: 0.02 }, // Top center
            { x: 0.77, y: 0.08 },
            { x: 0.94, y: 0.28 },
            { x: 0.98, y: 0.53 }, // Right side
            { x: 0.91, y: 0.77 },
            { x: 0.73, y: 0.95 },
            { x: 0.48, y: 0.98 }, // Bottom
            { x: 0.23, y: 0.91 },
            { x: 0.05, y: 0.72 },
            { x: 0.02, y: 0.47 }, // Left side
            { x: 0.08, y: 0.22 },
            { x: 0.27, y: 0.05 },
            { x: 0.53, y: 0.01 }, // Top "overshoot" to close the loop
            
            // 🌟 Lift the pen and mark a tiny 2-point dash in the center
            { x: 0.50, y: 0.50, moveTo: true }, 
            { x: 0.52, y: 0.50 }
        ]
    ],
    [
        'triangle', [
            { x: 0.52, y: 0.02 },
            { x: 0.97, y: 0.96 },
            { x: 0.49, y: 0.98 },
            { x: 0.03, y: 0.94 },
            { x: 0.50, y: 0.0 }
        ]
    ],
    [
        'diamond', [
            { x: 0.02, y: 0.03 },
            { x: 0.51, y: 0.05 },
            { x: 0.98, y: 0.02 },
            { x: 0.52, y: 0.97 },
            { x: 0.04, y: 0.05 }
        ]
    ],
    [
        'star', [
            { x: 0.49, y: 0.03 },
            { x: 0.83, y: 0.97 },
            { x: 0.02, y: 0.36 },
            { x: 0.97, y: 0.41 },
            { x: 0.16, y: 0.95 },
            { x: 0.51, y: 0.01 }
        ]
    ],
    [
        'line', [
            { x: 0.01, y: 0.48 },
            { x: 0.33, y: 0.46 },
            { x: 0.68, y: 0.52 },
            { x: 0.99, y: 0.49 }
        ]
    ]
]);
