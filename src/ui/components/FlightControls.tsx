import React, { useState, useEffect } from 'react';
import { CelestiaGame } from '../../core/game';

interface FlightControlsProps {
  game: CelestiaGame;
}

const FlightControls: React.FC<FlightControlsProps> = ({ game }) => {
  const [throttle, setThrottleState] = useState(0);
  const [pitch, setPitchState] = useState(90);
  const [fuelPercentage, setFuelPercentage] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      // Pull state from game
      setThrottleState(game.throttle);
      setPitchState(game.pitchAngle);
      
      const sc = game.getSpacecraft();
      if (sc) {
        const totalFuel = game.getSpacecraftFuel();
        const initialFuel = game.getSpacecraftDeltaV() || 10000;
        const pct = Math.min(100, Math.max(0, (totalFuel / 10000) * 100)); // normalized scale
        setFuelPercentage(game.unlimitedFuel ? 100 : pct);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [game]);

  const handleThrottleChange = (value: number) => {
    game.throttle = value;
    setThrottleState(value);
  };

  const handlePitchChange = (value: number) => {
    game.pitchAngle = value;
    setPitchState(value);
  };

  const triggerStage = () => {
    game.triggerStage();
  };

  return (
    <div className="flight-controls-panel">
      <h3>Flight Controls</h3>

      <div className="control-group">
        <label>Throttle: {throttle}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={throttle}
          onChange={(e) => handleThrottleChange(Number(e.target.value))}
          className="control-slider"
        />
        <div className="throttle-buttons">
          <button onClick={() => handleThrottleChange(0)}>0%</button>
          <button onClick={() => handleThrottleChange(50)}>50%</button>
          <button onClick={() => handleThrottleChange(100)}>100%</button>
        </div>
      </div>

      <div className="control-group">
        <label>Steer Pitch Angle: {pitch.toFixed(0)}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          value={pitch}
          onChange={(e) => handlePitchChange(Number(e.target.value))}
          className="control-slider"
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <button onClick={() => handlePitchChange(90)}>90° (Up)</button>
          <button onClick={() => handlePitchChange(0)}>0° (Right)</button>
          <button onClick={() => handlePitchChange(-90)}>-90° (Down)</button>
        </div>
      </div>

      <div className="control-group">
        <label>Fuel Level: {game.unlimitedFuel ? 'Unlimited' : `${fuelPercentage.toFixed(1)}%`}</label>
        <div style={{
          width: '100%',
          height: '12px',
          backgroundColor: '#1E293B',
          borderRadius: '6px',
          overflow: 'hidden',
          marginTop: '6px'
        }}>
          <div style={{
            width: `${fuelPercentage}%`,
            height: '100%',
            backgroundColor: fuelPercentage < 20 ? '#EF4444' : '#F59E0B',
            transition: 'width 0.1s ease'
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
        <button
          onClick={triggerStage}
          style={{
            flex: 1,
            padding: '10px 0',
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Decouple Stage (SPACE)
        </button>
      </div>
    </div>
  );
};

export default FlightControls;
