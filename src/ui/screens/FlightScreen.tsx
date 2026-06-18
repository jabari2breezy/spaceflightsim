import React, { useState, useEffect, useContext } from 'react';
import { Screen, GameContext } from '../../App';
import FlightView from '../components/FlightView';

interface FlightScreenProps {
  onNavigate: (screen: Screen) => void;
}

const FlightScreen: React.FC<FlightScreenProps> = ({ onNavigate }) => {
  const game = useContext(GameContext);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (!game) return;
    game.start();
    const interval = setInterval(() => game.update(), 1000 / 60);
    return () => clearInterval(interval);
  }, [game]);

  const handleAbort = () => {
    if (!game) return;
    game.stop();
    game.reset();
    onNavigate('menu');
  };

  if (!game) return <div className="loading">Loading Flight...</div>;

  return (
    <div className="flight-screen">
      <div className="flight-header" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, background: 'transparent', border: 'none', justifyContent: 'flex-end' }}>
        <div className="flight-controls">
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowControls((p) => !p)}
          >
            Controls
          </button>
          <button
            className="btn btn-sm btn-danger"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
            onClick={handleAbort}
          >
            Abort
          </button>
        </div>
      </div>

      {showControls && (
        <div
          className="glass-sm"
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            padding: '16px 24px',
            maxWidth: 500,
            fontSize: 12,
            lineHeight: 1.8,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 2, color: 'var(--accent)' }}>KEYBOARD CONTROLS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
            <span><strong>[/]</strong> Throttle -/+</span>
            <span><strong>9/0</strong> Max/Min Throttle</span>
            <span><strong>&lt; &gt;</strong> Time Warp</span>
            <span><strong>M</strong> Map View</span>
            <span><strong>-/+</strong> Zoom</span>
            <span><strong>Space</strong> Pause</span>
            <span><strong>Esc</strong> Abort</span>
          </div>
        </div>
      )}

      <div className="flight-body" style={{ gridTemplateColumns: '1fr' }}>
        <FlightView game={game} />
      </div>
    </div>
  );
};

export default FlightScreen;
