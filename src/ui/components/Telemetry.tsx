/**
 * Telemetry Display Component
 */

import React, { useState, useEffect } from 'react';
import { CelestiaGame } from '../../core/game';
import { getAltitude } from '../../core/bodies';

interface TelemetryProps {
  game: CelestiaGame;
}

const Telemetry: React.FC<TelemetryProps> = ({ game }) => {
  const [telemetry, setTelemetry] = useState({
    altitude: 0,
    velocity: 0,
    acceleration: 0,
    time: 0,
    apoapsis: 0,
    periapsis: 0,
    inclination: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const state = game.getSimulationState();
      const spacecraft = game.getSpacecraft();
      const bodies = game.getCelestialBodies();
      const orbital = game.getOrbitalInfo();

      if (spacecraft && bodies.length > 0) {
        const earthBody = bodies.find(b => b.id === 'earth');
        const altitude = earthBody ? getAltitude(spacecraft.position, earthBody) : 0;
        
        const vx = spacecraft.velocity.x;
        const vy = spacecraft.velocity.y;
        const vz = spacecraft.velocity.z;
        const velocity = Math.sqrt(vx * vx + vy * vy + vz * vz);

        setTelemetry({
          altitude: altitude / 1000, // Convert to km
          velocity,
          acceleration: 0,
          time: state.currentTime,
          apoapsis: orbital?.orbit?.apoApsis ? orbital.orbit.apoApsis / 1e6 : 0,
          periapsis: orbital?.orbit?.periApsis ? orbital.orbit.periApsis / 1e6 : 0,
          inclination: orbital?.orbit?.inclination ? (orbital.orbit.inclination * 180) / Math.PI : 0,
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [game]);

  return (
    <div className="telemetry">
      <h3>Telemetry</h3>
      <div className="telemetry-grid">
        <div className="telemetry-item">
          <span className="label">Altitude</span>
          <span className="value">{telemetry.altitude.toFixed(1)} km</span>
        </div>
        <div className="telemetry-item">
          <span className="label">Velocity</span>
          <span className="value">{telemetry.velocity.toFixed(0)} m/s</span>
        </div>
        <div className="telemetry-item">
          <span className="label">Apoapsis</span>
          <span className="value">{telemetry.apoapsis.toFixed(1)} Mm</span>
        </div>
        <div className="telemetry-item">
          <span className="label">Periapsis</span>
          <span className="value">{telemetry.periapsis.toFixed(1)} Mm</span>
        </div>
        <div className="telemetry-item">
          <span className="label">Inclination</span>
          <span className="value">{telemetry.inclination.toFixed(1)}°</span>
        </div>
        <div className="telemetry-item">
          <span className="label">Mission Time</span>
          <span className="value">{Math.floor(telemetry.time / 60)}m {Math.floor(telemetry.time % 60)}s</span>
        </div>
      </div>
    </div>
  );
};

export default Telemetry;
