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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (game) {
          game.stop();
          game.reset();
        }
        onNavigate('menu');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [game, onNavigate]);

  if (!game) return <div className="loading">Loading Flight...</div>;

  return (
    <div className="flight-screen">
      <div className="flight-body" style={{ gridTemplateColumns: '1fr' }}>
        <FlightView game={game} />
      </div>
    </div>
  );
};

export default FlightScreen;
