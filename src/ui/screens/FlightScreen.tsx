/**
 * Flight Screen - Main Mission Control
 */

import React, { useState, useEffect, useContext } from 'react';
import { Screen, GameContext } from '../../App';
import FlightView from '../components/FlightView';
import Telemetry from '../components/Telemetry';
import FlightControls from '../components/FlightControls';

interface FlightScreenProps {
  onNavigate: (screen: Screen) => void;
}

const FlightScreen: React.FC<FlightScreenProps> = ({ onNavigate }) => {
  const game = useContext(GameContext);
  const [isPaused, setIsPaused] = useState(false);
  const [timeScale, setTimeScale] = useState(1);
  const [showTelemetry, setShowTelemetry] = useState(true);

  useEffect(() => {
    if (game) {
      game.start();
      
      const interval = setInterval(() => {
        game.update();
      }, 1000 / 60); // 60 FPS

      return () => clearInterval(interval);
    }
  }, [game]);

  const handlePause = () => {
    if (game) {
      game.togglePause();
      setIsPaused(!isPaused);
    }
  };

  const handleTimeScaleChange = (scale: number) => {
    if (game) {
      game.setTimeScale(scale);
      setTimeScale(scale);
    }
  };

  const handleAbort = () => {
    if (game) {
      game.stop();
      game.reset();
    }
    onNavigate('menu');
  };

  if (!game) {
    return <div className="loading">Loading Flight Screen...</div>;
  }

  return (
    <div className="flight-screen">
      <div className="flight-header">
        <h1>Mission Control</h1>
        <div className="flight-controls">
          <button
            onClick={handlePause}
            className={`control-button ${isPaused ? 'paused' : ''}`}
          >
            {isPaused ? '▶' : '⏸'}
          </button>

          <div className="time-scale-controls">
            {[1, 5, 10, 50].map((scale) => (
              <button
                key={scale}
                onClick={() => handleTimeScaleChange(scale)}
                className={`time-scale-button ${timeScale === scale ? 'active' : ''}`}
              >
                {scale}x
              </button>
            ))}
          </div>

          <button onClick={handleAbort} className="abort-button">
            Abort Mission
          </button>
        </div>
      </div>

      <div className="flight-body">
        <div className="flight-main">
          <FlightView game={game} />
        </div>

        <div className="flight-sidebar">
          <FlightControls game={game} />
          {showTelemetry && <Telemetry game={game} />}
        </div>
      </div>
    </div>
  );
};

export default FlightScreen;
