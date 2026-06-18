import React, { useState, useEffect } from 'react';
import { CelestiaGame } from '../../core/game';
import { getAltitude } from '../../core/bodies';

interface TelemetryProps {
  game: CelestiaGame;
}

const Telemetry: React.FC<TelemetryProps> = ({ game }) => {
  const [data, setData] = useState({
    altitude: 0,
    velocity: 0,
    apoapsis: 0,
    periapsis: 0,
    inclination: 0,
    time: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const state = game.getSimulationState();
      const spacecraft = game.getSpacecraft();
      const bodies = game.getCelestialBodies();
      const orbital = game.getOrbitalInfo();

      if (spacecraft && bodies.length > 0) {
        const earthBody = bodies.find((b) => b.id === 'earth');
        const altitude = earthBody ? getAltitude(spacecraft.position, earthBody) : 0;
        const v = spacecraft.velocity;
        const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

        setData({
          altitude: altitude / 1000,
          velocity: speed,
          apoapsis: orbital?.orbit?.apoApsis ? orbital.orbit.apoApsis / 1e6 : 0,
          periapsis: orbital?.orbit?.periApsis ? orbital.orbit.periApsis / 1e6 : 0,
          inclination: orbital?.orbit?.inclination ? (orbital.orbit.inclination * 180) / Math.PI : 0,
          time: state.currentTime,
        });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [game]);

  return (
    <div className="telemetry">
      <div className="panel-title">Telemetry</div>
      <div className="telemetry-grid">
        <div className="telemetry-item">
          <span className="label">Altitude</span>
          <span className="value">{data.altitude.toFixed(1)} km</span>
        </div>
        <div className="telemetry-item">
          <span className="label">Velocity</span>
          <span className="value">{data.velocity.toFixed(0)} m/s</span>
        </div>
        <div className="telemetry-item">
          <span className="label">Apoapsis</span>
          <span className="value">{data.apoapsis.toFixed(1)} Mm</span>
        </div>
        <div className="telemetry-item">
          <span className="label">Periapsis</span>
          <span className="value">{data.periapsis.toFixed(1)} Mm</span>
        </div>
        <div className="telemetry-item">
          <span className="label">Inclination</span>
          <span className="value">{data.inclination.toFixed(1)}°</span>
        </div>
        <div className="telemetry-item">
          <span className="label">Mission Time</span>
          <span className="value">{Math.floor(data.time / 60)}m {Math.floor(data.time % 60)}s</span>
        </div>
      </div>
    </div>
  );
};

export default Telemetry;
