import { proxy, useSnapshot } from 'valtio';
import { Game } from './Game';

// Wraps your entire architecture cleanly into a reactive single proxy pointer
export const rootGameStore = proxy(new Game());

// Export external fast-track dispatch triggers that can be fired anywhere inside your app
export const controls = {
  click: () => rootGameStore.doLeftClick(),
  rightClick: () => rootGameStore.doRightClick(),
  cancel: () => rootGameStore.doEsc(),
  reset: () => rootGameStore.resetGame()
};