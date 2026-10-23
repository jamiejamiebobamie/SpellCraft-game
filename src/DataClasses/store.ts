import { proxy } from 'valtio';
import { Game } from './Game';

// The game's one store. Set up once proxied, so the callbacks its parts are given (the clock's,
// the key bindings') change it through valtio, and the components showing it re-render
export const rootGameStore = proxy(new Game());
rootGameStore.init();
