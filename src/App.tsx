import React, { useState, useEffect, useRef } from 'react';
import { CelestiaGame } from './core/game';
import MainMenu from './ui/screens/MainMenu';
import FlightScreen from './ui/screens/FlightScreen';
import VABScreen from './ui/screens/VABScreen';
import './styles/main.css';

export type Screen = 'menu' | 'flight' | 'vab';

export const GameContext = React.createContext<CelestiaGame | null>(null);

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('menu');
  const [game, setGame] = useState<CelestiaGame | null>(null);
  const gameRef = useRef<CelestiaGame | null>(null);

  useEffect(() => {
    const newGame = new CelestiaGame('starter');
    newGame.buildSpacecraft('Aurora', () => {});
    gameRef.current = newGame;
    setGame(newGame);
  }, []);

  const handleNavigate = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  if (!game) {
    return <div className="loading">Initializing</div>;
  }

  return (
    <GameContext.Provider value={game}>
      <div className="app">
        {currentScreen === 'menu' && (
          <MainMenu onNavigate={handleNavigate} />
        )}
        {currentScreen === 'flight' && (
          <FlightScreen onNavigate={handleNavigate} />
        )}
        {currentScreen === 'vab' && (
          <VABScreen onNavigate={handleNavigate} />
        )}
      </div>
    </GameContext.Provider>
  );
};

export default App;
