// Define colors globally to maintain a uniform magical palette
export const PALETTE = {
  fireCore: '#fff4a3',
  fireMid: '#ff7700',
  fireOuter: '#ff22009c',
  // --- UPDATED WATER WHEEL SEAFOAM PALETTE ---
  waterGlow: 'rgba(180, 255, 235, 0.4)',  // Translucent bright mint highlighting glow
  waterMid: '#5de4c1',                   // Primary bright mint green body
  waterDeep: '#32cca6',                  // Deep turquoise defining core shadows
  waterCasing: 'rgba(30, 180, 150, 0.35)', // Translucent watercolor edge blending
  waterFroth: '#f2f9ff',                 // Crisp white wave caps
  // --- REST OF THE CORES ---
  tornadoBase: 'rgba(210, 200, 185, 0.18)',
  tornadoLines: ['rgba(245,240,230,0.6)', 'rgba(160,150,135,0.5)', 'rgba(255,255,255,0.7)'],
  lightningMain: '#00d0ff',
  lightningBranch: '#b3f2ff',
  lightningShadow: '#89e9ff63',
};

// Shared styling hooks matching your existing board theme palette
export const FX_PALETTE = {
  fireSmoke: 'rgba(90, 85, 80, 0.4)',
  fireEmber: '#ff5500',
  fireEmberGlow: '#fff066',
  waterSplash: PALETTE.waterMid,
  waterFroth: '#f2f9ff',
  healCross: '#a8ff69',
  healCrossShadow: '#2ecc71',
  bloodDroplets: '#570a0a',
  bloodDropletsShadow: '#200404',
};