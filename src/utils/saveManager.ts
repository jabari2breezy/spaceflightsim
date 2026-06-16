/**
 * Save/Load System
 */

import { SavedGame, SimulationState, Mission, Spacecraft } from '../types';

const STORAGE_KEY = 'celestia_saves';

export class SaveManager {
  /**
   * Save a game state
   */
  static saveGame(
    name: string,
    simulationState: SimulationState,
    missions: Mission[],
    spacecraft: Spacecraft[]
  ): SavedGame {
    const game: SavedGame = {
      id: `save-${Date.now()}`,
      name,
      timestamp: Date.now(),
      version: '1.0.0',
      simulationState,
      missions,
      spacecraft,
    };

    // Save to localStorage
    const saves = this.getAllSaves();
    saves.push(game);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    } catch (e) {
      console.error('Failed to save game:', e);
    }

    return game;
  }

  /**
   * Load a saved game
   */
  static loadGame(saveId: string): SavedGame | null {
    const saves = this.getAllSaves();
    return saves.find((s) => s.id === saveId) || null;
  }

  /**
   * Get all saved games
   */
  static getAllSaves(): SavedGame[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load saves:', e);
      return [];
    }
  }

  /**
   * Delete a saved game
   */
  static deleteSave(saveId: string): void {
    const saves = this.getAllSaves();
    const filtered = saves.filter((s) => s.id !== saveId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to delete save:', e);
    }
  }

  /**
   * Export a save as JSON
   */
  static exportSave(saveId: string): string | null {
    const game = this.loadGame(saveId);
    if (!game) return null;
    return JSON.stringify(game, null, 2);
  }

  /**
   * Import a save from JSON
   */
  static importSave(jsonData: string): SavedGame | null {
    try {
      const game = JSON.parse(jsonData) as SavedGame;
      const saves = this.getAllSaves();
      
      // Check for duplicates
      if (saves.some((s) => s.id === game.id)) {
        game.id = `save-${Date.now()}`;
      }

      saves.push(game);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
      return game;
    } catch (e) {
      console.error('Failed to import save:', e);
      return null;
    }
  }
}
