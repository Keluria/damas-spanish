import type { SavedGame } from '../src/storage';
import { createVictoryScenario } from './victory';

/** Development-only adapter: never reads or writes browser storage. */
export function createVictoryStorage() {
  let saved = createVictoryScenario();
  return {
    loadGame() { return { saved, warning: '' }; },
    saveGame(next: SavedGame) { saved = next; return true; }
  };
}

// Only the dedicated development configuration replaces the storage import.
const memory = createVictoryStorage();
export const loadGame = memory.loadGame;
export const saveGame = memory.saveGame;
