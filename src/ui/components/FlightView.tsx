import React, { useEffect, useRef, useState } from 'react';
import { CelestiaGame } from '../../core/game';
import { drawPart2D, drawCelestialBody2D } from '../../utils/render2d';
import { Vector3 } from '../../types';
import { getPartGridSize } from '../screens/VABScreen';

interface FlightViewProps {
  game: CelestiaGame;
}

const FlightView: React.FC<FlightViewProps> = ({ game }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapView, setMapView] = useState(false);
  const [zoom, setZoom] = useState(1.0); // 1.0 = close up, smaller values = zoomed out
  const [autopilotMsg, setAutopilotMsg] = useState('Autopilot offline');

  // Interactive controls state
  const keysPressed = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (e.key === 'm' || e.key === 'M') {
        setMapView((prev) => {
          setZoom(prev ? 1.0 : 0.000005); // Zoom way out for map view
          return !prev;
        });
      }
      if (e.key === ' ') {
        // Space to stage
        game.triggerStage();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [game]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set resolution backing
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    let animFrameId = 0;

    // Generate static stars for parallax
    const stars: { x: number; y: number; r: number; color: string }[] = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.5 + Math.random() * 1.5,
        color: `rgba(255, 255, 255, ${0.3 + Math.random() * 0.7})`,
      });
    }

    const renderLoop = () => {
      const w = canvas.width;
      const h = canvas.height;
      const dpr = window.devicePixelRatio || 1;
      
      ctx.save();
      ctx.scale(dpr, dpr);

      const displayW = w / dpr;
      const displayH = h / dpr;

      // Handle keyboard steering controls
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
        game.pitchAngle += 1.5; // Turn counterclockwise
      }
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
        game.pitchAngle -= 1.5; // Turn clockwise
      }
      if (keysPressed.current['w'] || keysPressed.current['arrowup']) {
        game.throttle = Math.min(100, game.throttle + 1);
      }
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) {
        game.throttle = Math.max(0, game.throttle - 1);
      }

      // Sync autopilot status message
      if (game.autopilotActive) {
        setAutopilotMsg(game.autopilotMessage);
      } else {
        setAutopilotMsg('Autopilot offline. Direct input active.');
      }

      // Clear with deep space color
      ctx.fillStyle = '#050512';
      ctx.fillRect(0, 0, displayW, displayH);

      const sc = game.getSpacecraft();
      if (!sc) {
        ctx.restore();
        animFrameId = requestAnimationFrame(renderLoop);
        return;
      }

      const bodies = game.getCelestialBodies();
      const earth = bodies.find((b) => b.id === 'earth')!;
      const moon = bodies.find((b) => b.id === 'moon')!;

      // Dynamic SOI checking
      const distToMoon = Math.sqrt(
        (sc.position.x - moon.position.x) ** 2 +
        (sc.position.y - moon.position.y) ** 2
      );
      const inMoonSOI = distToMoon < 6.6e7;
      const centerBody = inMoonSOI ? moon : earth;

      // Draw Parallax Stars background
      const camX = mapView ? centerBody.position.x : sc.position.x;
      const camY = mapView ? centerBody.position.y : sc.position.y;
      stars.forEach((star) => {
        // Star screen position wrap-around based on camera coordinates
        const starX = (star.x * displayW - camX * 0.00002 * star.r) % displayW;
        const starY = (star.y * displayH + camY * 0.00002 * star.r) % displayH;
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(
          starX < 0 ? starX + displayW : starX,
          starY < 0 ? starY + displayH : starY,
          star.r,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });

      // Calculate camera transform
      // Map scale vs Close flight scale
      const viewScale = zoom * (displayH / 600); // normalize zoom factor
      const centerX = displayW / 2;
      const centerY = displayH / 2;

      // Translate coordinate space relative to camera
      const worldToScreenX = (wx: number) => centerX + (wx - camX) * viewScale;
      const worldToScreenY = (wy: number) => centerY - (wy - camY) * viewScale;

      // 1. Draw orbits and trajectories
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1.5;

      // If zoomed out, draw Earth orbit trajectory paths
      if (mapView) {
        // Moon Orbit around Earth
        const moonOrbRadius = 3.84e8 * viewScale;
        if (!isNaN(moonOrbRadius) && moonOrbRadius > 0.1) {
          ctx.beginPath();
          const earthScreen = { x: worldToScreenX(earth.position.x), y: worldToScreenY(earth.position.y) };
          ctx.arc(earthScreen.x, earthScreen.y, moonOrbRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Draw Moon Orbit text label
          ctx.fillStyle = '#10B981';
          ctx.font = '10px sans-serif';
          ctx.fillText('Moon Orbital Track', earthScreen.x + moonOrbRadius * 0.7, earthScreen.y - 10);
        }
      }

      // Draw current Spacecraft Orbit trajectory path
      const orbitalInfo = game.getOrbitalInfo();
      if (orbitalInfo && orbitalInfo.orbit) {
        ctx.strokeStyle = '#00F5FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        // Draw orbital prediction ellipse
        const a = orbitalInfo.orbit.semiMajorAxis;
        const e = orbitalInfo.orbit.eccentricity;
        const bodyScreen = {
          x: worldToScreenX(centerBody.position.x),
          y: worldToScreenY(centerBody.position.y),
        };

        if (e < 1 && a > 0) {
          const b = a * Math.sqrt(1 - e * e);
          const focusOffset = a * e * viewScale;
          const rx = a * viewScale;
          const ry = b * viewScale;

          if (!isNaN(rx) && !isNaN(ry) && rx > 0.1 && ry > 0.1 && !isNaN(focusOffset)) {
            // Draw prediction circle/ellipse around dominant body center
            ctx.ellipse(
              bodyScreen.x - focusOffset,
              bodyScreen.y,
              rx,
              ry,
              0,
              0,
              Math.PI * 2
            );
            ctx.stroke();
          }

          // Draw Apoapsis (Ap) and Periapsis (Pe) markers
          const apDist = orbitalInfo.orbit.apoApsis;
          const peDist = orbitalInfo.orbit.periApsis;

          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          // Ap marker
          const apX = bodyScreen.x - focusOffset - a * viewScale;
          ctx.arc(apX, bodyScreen.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '10px sans-serif';
          ctx.fillText(`Ap: ${((apDist - centerBody.radius) / 1000).toFixed(0)}km`, apX - 25, bodyScreen.y - 8);

          // Pe marker
          ctx.fillStyle = '#10B981';
          ctx.beginPath();
          const peX = bodyScreen.x - focusOffset + a * viewScale;
          ctx.arc(peX, bodyScreen.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(`Pe: ${((peDist - centerBody.radius) / 1000).toFixed(0)}km`, peX - 25, bodyScreen.y - 8);
        }
      }

      // 2. Draw Planets as 2D Gradient Circles
      bodies.forEach((body) => {
        const sx = worldToScreenX(body.position.x);
        const sy = worldToScreenY(body.position.y);
        const sRadius = body.radius * viewScale;
        
        // Render planet disk
        drawCelestialBody2D(ctx, body, sx, sy, sRadius);

        // Draw name labels
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(body.name, sx, sy - sRadius - 10);
      });

      // 3. Draw Rocket Vehicle in 2D
      ctx.save();
      // Translate to center of screen (rocket location)
      ctx.translate(centerX, centerY);
      // Rotate by the current spacecraft pitch
      const pitchRad = (game.pitchAngle * Math.PI) / 180;
      ctx.rotate(-pitchRad + Math.PI / 2); // align rocket pointing upwards by default

      // Stacking parts scale factor
      const partScale = Math.min(22, Math.max(8, viewScale * 35000));

      let currentY = 0;
      // Staging loops
      sc.stages.forEach((stage) => {
        stage.parts.forEach((part) => {
          const gSize = getPartGridSize(part.type);
          const partW = gSize.w * partScale;
          const partH = gSize.h * partScale;

          // Render physical part stacking
          const isSteeringLeft = keysPressed.current['a'] || keysPressed.current['arrowleft'];
          const isSteeringRight = keysPressed.current['d'] || keysPressed.current['arrowright'];
          
          let rcsDir: 'left' | 'right' | null = null;
          if (part.type === 'rcs') {
            rcsDir = isSteeringLeft ? 'right' : isSteeringRight ? 'left' : null;
          }

          ctx.save();
          ctx.translate(0, currentY - partH / 2);
          ctx.rotate(((part.properties.rotation || 0) * Math.PI) / 180);
          drawPart2D(ctx, part, 0, 0, partW, partH, rcsDir, game.throttle / 100);
          ctx.restore();

          currentY -= partH;
        });
        currentY -= 0.2 * partScale; // stage gap spacing
      });

      ctx.restore();

      ctx.restore();
      animFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [game, zoom, mapView]);

  const toggleUnlimitedFuel = () => {
    game.unlimitedFuel = !game.unlimitedFuel;
  };

  const toggleAutopilot = () => {
    game.autopilotActive = !game.autopilotActive;
    if (game.autopilotActive) {
      game.guidance.phase = 'launch'; // Reset to takeoff phase
    }
  };

  return (
    <div className="flight-view" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      
      {/* 2D control overlays */}
      <div className="flight-view-ui" style={{
        position: 'absolute',
        top: '15px',
        left: '20px',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #1E293B',
        borderRadius: '8px',
        padding: '12px 18px',
        color: '#F8FAFC',
        fontFamily: 'sans-serif',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '8px', color: '#00E5FF' }}>
          CELESTIA 2D GUIDANCE
        </div>
        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
          Controls: [W/S] Throttle | [A/D] Steer Pitch | [SPACE] Decouple Stage
        </div>
        <div style={{ fontSize: '13px', color: '#10B981', fontWeight: 'bold', marginTop: '6px' }}>
          {autopilotMsg}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <button
            onClick={() => setMapView(!mapView)}
            style={{
              padding: '6px 12px',
              backgroundColor: mapView ? '#00E5FF' : '#1E293B',
              color: mapView ? '#000' : '#FFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          >
            {mapView ? 'FLIGHT VIEW' : 'MAP VIEW'}
          </button>
          
          <button
            onClick={toggleUnlimitedFuel}
            style={{
              padding: '6px 12px',
              backgroundColor: game.unlimitedFuel ? '#F59E0B' : '#1E293B',
              color: '#FFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          >
            UNLIMITED FUEL: {game.unlimitedFuel ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={toggleAutopilot}
            style={{
              padding: '6px 12px',
              backgroundColor: game.autopilotActive ? '#10B981' : '#1E293B',
              color: '#FFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          >
            AUTOPILOT: {game.autopilotActive ? 'ACTIVE' : 'OFF'}
          </button>
        </div>

        {mapView && (
          <div style={{ marginTop: '10px', fontSize: '12px' }}>
            <label style={{ marginRight: '6px' }}>Map Zoom: </label>
            <input
              type="range"
              min="0.0000005"
              max="0.00005"
              step="0.0000005"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ width: '120px', verticalAlign: 'middle' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightView;
