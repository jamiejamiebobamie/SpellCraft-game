import { FX_PALETTE } from "./ColorPalette";
import { GameParticle } from "../../../../DataClasses/types";

export const spawnBloodMagicHitParticles = (particles: GameParticle[], targetX: number, targetY: number, dmgAmount: number) => {
    for (let i = 0; i < dmgAmount; i++) {
        particles.push({
            x: targetX + (Math.random() * 60 - 30),
            y: targetY + (Math.random() * -90 + 60),
            vx: (Math.random() * 20 - 10),
            vy: -(Math.random() * 60 + 40), // Smooth, floaty drift upward
            alpha: 1.0,
            size: Math.random() * 8 + 6,     // Size dictates the length of the cross arms
            color: FX_PALETTE.bloodDroplets,
            shadowColor: FX_PALETTE.bloodDropletsShadow,
            rotation: Math.random() * Math.PI,
            vRotation: Math.random() * 2 - 1, // Tumbles gently in the air
            life: 1.0,
            decay: Math.random() * 0.4 + 0.4,
            type: 'bloodDroplets'                // Custom type tag for drawing the upward-facing tear drop shape
        });
    }
}