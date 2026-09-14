import { proxy } from 'valtio';
import { Game } from './Game';

// Wraps your entire architecture cleanly into a reactive single proxy pointer
export const rootGameStore = proxy(new Game());