/**
 * Flight Controls Component
 */

import React, { useState } from 'react';
import { CelestiaGame } from '../../core/game';

interface FlightControlsProps {
  game: CelestiaGame;
}

const FlightControls: React.FC<FlightControlsProps> = ({ game }) => {
  const [throttle, setThrottle] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [yaw, setYaw] = useState(0);
  const [roll, setRoll] = useState(0);

  const spacecraft = game.getSpacecraft();
  const deltaV = spacecraft ? game.getSpacecraftDeltaV() : 0;
  const thrust = game.getSpacecraftThrust() / 1e6; // Convert to MN

  return (
    <div className="flight-controls-panel">
      <h3>Flight Controls</h3>

      <div className="control-group">
        <label>Throttle: {throttle.toFixed(0)}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={throttle}
          onChange={(e) => setThrottle(Number(e.target.value))}
          className="control-slider"
        />
        <div className="throttle-buttons">
          <button onClick={() => setThrottle(0)}>0%</button>
          <button onClick={() => setThrottle(25)}>25%</button>
          <button onClick={() => setThrottle(50)}>50%</button>
          <button onClick={() => setThrottle(75)}>75%</button>
          <button onClick={() => setThrottle(100)}>100%</button>
        </div>
      </div>

      <div className="control-group">
        <label>Pitch: {pitch.toFixed(1)}°</label>
        <input
          type="range"
          min="-90"
          max="90"
          value={pitch}
          onChange={(e) => setPitch(Number(e.target.value))}
          className="control-slider"
        />
      </div>

      <div className="control-group">
        <label>Yaw: {yaw.toFixed(1)}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          value={yaw}
          onChange={(e) => setYaw(Number(e.target.value))}
          className="control-slider"
        />
      </div>

      <div className="control-group">
        <label>Roll: {roll.toFixed(1)}°</label>
        <input
          type="range"
          min="-180"
          max="180"
          value={roll}
          onChange={(e) => setRoll(Number(e.target.value))}
          className="control-slider"
        />
      </div>

      <div className="control-info">
        <div className="info-item">
          <span className="label">Available ΔV:</span>
          <span className="value">{deltaV.toFixed(0)} m/s</span>
        </div>
        <div className="info-item">
          <span className="label">Thrust:</span>
          <span className="value">{thrust.toFixed(2)} MN</span>
        </div>
      </div>

      <div className="quick-actions">
        <button className="action-button">Prograde</button>
        <button className="action-button">Retrograde</button>
        <button className="action-button">Normal</button>
        <button className="action-button">Radial</button>
      </div>
    </div>
  );
};

export default FlightControls;
