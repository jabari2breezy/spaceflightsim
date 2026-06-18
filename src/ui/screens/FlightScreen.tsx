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
    if (!game) return;
    game.start();
    const interval = setInterval(() => game.update(), 1000 / 60);
    return () => clearInterval(interval);
  }, [game]);

  const handlePause = () => {
    if (!game) return;
    game.togglePause();
    setIsPaused((p) => !p);
  };

  const handleTimeScale = (scale: number) => {
    if (!game) return;
    game.setTimeScale(scale);
    setTimeScale(scale);
  };

  const handleAbort = () => {
    if (!game) return;
    game.stop();
    game.reset();
    onNavigate('menu');
  };

  if (!game) return <div className="loading">Loading Flight Screen...</div>;

  return (
    <div className="flight-screen">
      <div className="flight-header">
        <h1>Mission Control</h1>
        <div className="flight-controls">
          <button onClick={handlePause} className={`btn btn-sm ${isPaused ? 'active' : ''}`}>
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <div className="time-scale-btns">
            {[1, 5, 10, 50].map((s) => (
              <button
                key={s}
                onClick={() => handleTimeScale(s)}
                className={`btn btn-sm ${timeScale === s ? 'active' : ''}`}
              >
                {s}x
              </button>
            ))}
          </div>
          <button onClick={handleAbort} className="btn btn-sm btn-danger">
            Abort
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
