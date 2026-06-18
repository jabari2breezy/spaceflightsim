import React, { useEffect, useContext } from 'react';
import { Screen, GameContext } from '../../App';
import FlightView from '../components/FlightView';

interface FlightScreenProps {
  onNavigate: (screen: Screen) => void;
}

const FlightScreen: React.FC<FlightScreenProps> = ({ onNavigate }) => {
  const game = useContext(GameContext);

  useEffect(() => {
    if (!game) return;
    game.start();
    const interval = setInterval(() => game.update(), 1000 / 60);
    return () => clearInterval(interval);
  }, [game]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!game) return;
        game.stop();
        game.reset();
        onNavigate('menu');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [game, onNavigate]);

  if (!game) return <div className="loading">Loading Flight...</div>;

  return (
    <div className="flight-screen">
      <div className="flight-body" style={{ position: 'fixed', inset: 0 }}>
        <FlightView game={game} autoMode={true} />
      </div>
    </div>
  );
};

export default FlightScreen;
