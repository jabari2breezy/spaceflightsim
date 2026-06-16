/**
 * Main App Component
 */

import React, { useState, useEffect, useRef } from 'react';
import { CelestiaGame } from './core/game';
import { SpacecraftBuilder } from './core/spacecraft';
import MainMenu from './ui/screens/MainMenu';
import VABScreen from './ui/screens/VABScreen';
import FlightScreen from './ui/screens/FlightScreen';
import './styles/main.css';

export type Screen = 'menu' | 'vab' | 'flight' | 'missions';

export const GameContext = React.createContext<CelestiaGame | null>(null);

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('menu');
  const [game, setGame] = useState<CelestiaGame | null>(null);
  const gameRef = useRef<CelestiaGame | null>(null);

  useEffect(() => {
    // Initialize game on mount
    const newGame = new CelestiaGame('starter');
    gameRef.current = newGame;
    setGame(newGame);
  }, []);

  const handleNavigateTo = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const handleBuildSpacecraft = (sc: any) => {
    if (gameRef.current) {
      gameRef.current.loadSpacecraft(sc);
    }
  };

  if (!game) {
    return <div className="loading">Initializing Celestia...</div>;
  }

  return (
    <GameContext.Provider value={game}>
      <div className="app">
        {currentScreen === 'menu' && (
          <MainMenu onNavigate={handleNavigateTo} />
        )}
        {currentScreen === 'vab' && (
          <VABScreen onNavigate={handleNavigateTo} onBuild={handleBuildSpacecraft} />
        )}
        {currentScreen === 'flight' && (
          <FlightScreen onNavigate={handleNavigateTo} />
        )}
      </div>
    </GameContext.Provider>
  );
};

export default App;
