import React, { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { CelestiaGame } from '../../core/game';
import {
  createInitialState,
  updateSimulation,
  togglePause,
  setTimeWarp,
  toggleMapView,
  adjustZoom,
  SimState,
  EARTH_RADIUS,
  MOON_RADIUS,
  MOON_ORBIT_R,
} from '../../simulation/Simulation';

interface FlightViewProps {
  game: CelestiaGame;
}

const PX_PER_M = 1 / 10000;

function worldToScreen(
  wx: number, wy: number,
  camX: number, camY: number,
  zoom: number,
  w: number, h: number
): { x: number; y: number } {
  const scale = PX_PER_M * zoom;
  return {
    x: (wx - camX) * scale + w / 2,
    y: -(wy - camY) * scale + h / 2,
  };
}

function drawCircle(
  g: PIXI.Graphics,
  wx: number, wy: number,
  radiusM: number,
  camX: number, camY: number,
  zoom: number,
  w: number, h: number,
  color: number, alpha = 1
) {
  const s = worldToScreen(wx, wy, camX, camY, zoom, w, h);
  const r = radiusM * PX_PER_M * zoom;
  g.beginFill(color, alpha);
  if (r > 1) g.drawCircle(s.x, s.y, Math.max(r, 1));
  else g.drawCircle(s.x, s.y, 2);
  g.endFill();
}

function drawRocket(
  g: PIXI.Graphics,
  rx: number, ry: number, angle: number,
  camX: number, camY: number,
  zoom: number,
  w: number, h: number
) {
  const s = worldToScreen(rx, ry, camX, camY, zoom, w, h);
  const scale = PX_PER_M * zoom;
  const len = 30 * Math.max(scale, 0.5);
  const wide = 8 * Math.max(scale, 0.3);

  const cosA = Math.cos(Math.PI / 2 - angle);
  const sinA = Math.sin(Math.PI / 2 - angle);
  const hw = wide / 2;
  const hl = len / 2;
  const noseH = len * 0.4;

  const px = s.x;
  const py = s.y;

  const x1 = px + (-hw) * cosA - (-hl) * sinA;
  const y1 = py + (-hw) * sinA + (-hl) * cosA;
  const x2 = px + hw * cosA - (-hl) * sinA;
  const y2 = py + hw * sinA + (-hl) * cosA;
  const x3 = px + hw * cosA - hl * sinA;
  const y3 = py + hw * sinA + hl * cosA;
  const x4 = px + (-hw) * cosA - hl * sinA;
  const y4 = py + (-hw) * sinA + hl * cosA;

  const nx = px - (hl + noseH) * sinA;
  const ny = py + (hl + noseH) * cosA;

  g.beginFill(0xcccccc);
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.lineTo(x3, y3);
  g.lineTo(x4, y4);
  g.closePath();
  g.endFill();

  g.beginFill(0xcc3333);
  g.moveTo(nx, ny);
  g.lineTo(x1, y1);
  g.lineTo(x4, y4);
  g.closePath();
  g.endFill();
}

function renderExhaust(
  g: PIXI.Graphics,
  rx: number, ry: number, angle: number,
  throttle: number,
  time: number,
  camX: number, camY: number,
  zoom: number,
  w: number, h: number
) {
  if (throttle <= 0) return;
  const s = worldToScreen(rx, ry, camX, camY, zoom, w, h);
  const scale = PX_PER_M * zoom;
  const len = 20 * throttle * Math.max(scale, 0.3);
  const wide = 6 * Math.max(scale, 0.2);

  const ex = s.x - Math.cos(angle) * len;
  const ey = s.y + Math.sin(angle) * len;

  const flicker = 0.8 + Math.sin(time * 50) * 0.2;
  const fLen = len * flicker;

  g.beginFill(0xff6600, 0.7 * throttle);
  g.drawEllipse(
    s.x - Math.cos(angle) * fLen * 0.5,
    s.y + Math.sin(angle) * fLen * 0.5,
    wide * 1.2,
    fLen * 0.5
  );
  g.endFill();
  g.beginFill(0xffcc00, 0.5 * throttle);
  g.drawEllipse(
    s.x - Math.cos(angle) * fLen * 0.5,
    s.y + Math.sin(angle) * fLen * 0.5,
    wide * 0.6,
    fLen * 0.35
  );
  g.endFill();
  g.beginFill(0xffffff, 0.3 * throttle);
  g.drawEllipse(
    s.x - Math.cos(angle) * fLen * 0.4,
    s.y + Math.sin(angle) * fLen * 0.4,
    wide * 0.3,
    fLen * 0.2
  );
  g.endFill();
}

const FlightView: React.FC<FlightViewProps> = ({ game }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const stateRef = useRef<SimState | null>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const timeRef = useRef(0);

  const init = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    if (!parent) return;

    const w = parent.clientWidth;
    const h = parent.clientHeight;

    const app = new PIXI.Application({
      width: w,
      height: h,
      backgroundColor: 0x050a15,
      view: canvas,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    const bgLayer = new PIXI.Container();
    const worldLayer = new PIXI.Container();
    const hudLayer = new PIXI.Container();
    app.stage.addChild(bgLayer, worldLayer, hudLayer);

    const spacecraft = game.getSpacecraft();
    const mass = spacecraft ? spacecraft.mass : 10000;
    const thrust = game.getSpacecraftThrust() || 500000;
    const isp = 300;

    let simState = createInitialState(mass, thrust, isp);
    if (spacecraft) {
      simState.rocket.totalStages = spacecraft.stages.length;
    }
    stateRef.current = simState;

    const stars: { x: number; y: number; r: number; a: number }[] = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * 2000 - 1000,
        y: Math.random() * 2000 - 1000,
        r: 0.5 + Math.random() * 1.5,
        a: 0.3 + Math.random() * 0.7,
      });
    }

    const handleResize = () => {
      if (!parent) return;
      const nw = parent.clientWidth;
      const nh = parent.clientHeight;
      app.renderer.resize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    app.ticker.add(() => {
      const dt = app.ticker.deltaMS / 1000;
      timeRef.current += dt;

      simState = updateSimulation(simState, dt);
      stateRef.current = simState;

      const camX = simState.mapView ? 0 : simState.rocket.x;
      const camY = simState.mapView ? 0 : simState.rocket.y;
      const zoom = simState.mapView ? 0.0002 : simState.zoom;
      const aw = app.renderer.width / (window.devicePixelRatio || 1);
      const ah = app.renderer.height / (window.devicePixelRatio || 1);

      // Stars
      bgLayer.removeChildren();
      const starG = new PIXI.Graphics();
      stars.forEach((st) => {
        const sx = ((st.x + camX * PX_PER_M * 0.001) % 2000 + 2000) % 2000 - 1000;
        const sy = ((st.y + camY * PX_PER_M * 0.001) % 2000 + 2000) % 2000 - 1000;
        const ss = worldToScreen(sx * 50000, sy * 50000, camX, camY, zoom, aw, ah);
        if (ss.x > 0 && ss.x < aw && ss.y > 0 && ss.y < ah) {
          starG.beginFill(0xffffff, st.a);
          starG.drawCircle(ss.x, ss.y, Math.max(st.r, 1));
          starG.endFill();
        }
      });
      bgLayer.addChild(starG);

      // World rendering
      worldLayer.removeChildren();
      const wg = new PIXI.Graphics();

      // Earth
      drawCircle(wg, 0, 0, EARTH_RADIUS, camX, camY, zoom, aw, ah, 0x1a6b9e);
      drawCircle(wg, 0, 0, EARTH_RADIUS * 1.01, camX, camY, zoom, aw, ah, 0x4488cc, 0.08);
      // Earth atmosphere glow
      const earthScreen = worldToScreen(0, 0, camX, camY, zoom, aw, ah);
      if (earthScreen.x > -100 && earthScreen.x < aw + 100 && earthScreen.y > -100 && earthScreen.y < ah + 100) {
        wg.beginFill(0x4488cc, 0.04);
        wg.drawCircle(earthScreen.x, earthScreen.y, EARTH_RADIUS * PX_PER_M * zoom * 1.3);
        wg.endFill();
      }

      // Moon
      const moonR = MOON_RADIUS;
      drawCircle(wg, simState.moon.x, simState.moon.y, moonR, camX, camY, zoom, aw, ah, 0x888888);
      drawCircle(wg, simState.moon.x, simState.moon.y, moonR * 0.4, camX, camY, zoom, aw, ah, 0x666666);

      // Orbit path (moon orbit)
      const orbitPts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        orbitPts.push({ x: Math.cos(a) * MOON_ORBIT_R, y: Math.sin(a) * MOON_ORBIT_R });
      }
      wg.lineStyle(1, 0x224466, 0.3);
      for (let i = 0; i < orbitPts.length - 1; i++) {
        const p1 = worldToScreen(orbitPts[i].x, orbitPts[i].y, camX, camY, zoom, aw, ah);
        const p2 = worldToScreen(orbitPts[i + 1].x, orbitPts[i + 1].y, camX, camY, zoom, aw, ah);
        wg.moveTo(p1.x, p1.y);
        wg.lineTo(p2.x, p2.y);
      }

      // Rocket
      const r = simState.rocket;
      if (r.active) {
        drawRocket(wg, r.x, r.y, r.angle, camX, camY, zoom, aw, ah);
        renderExhaust(wg, r.x, r.y, r.angle, r.throttle, timeRef.current, camX, camY, zoom, aw, ah);
      }

      worldLayer.addChild(wg);

      // HUD rendering
      hudLayer.removeChildren();
      const hud = new PIXI.Graphics();
      const textStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fill: 0x88ddff,
      });
      const bigStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 24,
        fontWeight: 'bold',
        fill: 0xffffff,
      });
      const phaseStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 16,
        fontWeight: 'bold',
        fill: 0x4a9eff,
      });

      // Altitude
      const altText = new PIXI.Text(`ALT: ${simState.altitude.toFixed(1)} km`, bigStyle);
      altText.x = 20;
      altText.y = 20;
      hud.addChild(altText);

      // Velocity
      const velStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 18,
        fill: 0x88ddff,
      });
      const velText = new PIXI.Text(`VEL: ${simState.speed.toFixed(0)} m/s`, velStyle);
      velText.x = 20;
      velText.y = 52;
      hud.addChild(velText);

      // Phase
      const phaseLabel = simState.phase.replace(/-/g, ' ').toUpperCase();
      const phaseText = new PIXI.Text(phaseLabel, phaseStyle);
      phaseText.x = 20;
      phaseText.y = 80;
      hud.addChild(phaseText);

      // Time warp
      const warpText = new PIXI.Text(`WARP: ${simState.timeWarp}x`, textStyle);
      warpText.x = 20;
      warpText.y = aw > 600 ? 110 : 105;
      hud.addChild(warpText);

      // Throttle bar
      const barX = aw - 50;
      const barY = 60;
      const barW = 20;
      const barH = 200;
      hud.beginFill(0x222244, 0.8);
      hud.drawRoundedRect(barX, barY, barW, barH, 4);
      hud.endFill();
      const fillH = barH * simState.rocket.throttle;
      const fillColor = simState.rocket.throttle > 0.5 ? 0xff6600 : 0x4488ff;
      hud.beginFill(fillColor, 0.9);
      hud.drawRoundedRect(barX, barY + barH - fillH, barW, fillH, 4);
      hud.endFill();

      // Fuel bar
      const fuelBarX = aw - 50;
      const fuelBarY = 280;
      const fuelBarH = 60;
      hud.beginFill(0x222244, 0.8);
      hud.drawRoundedRect(fuelBarX, fuelBarY, barW, fuelBarH, 4);
      hud.endFill();
      const fuelPct = simState.rocket.maxFuel > 0 ? simState.rocket.fuel / simState.rocket.maxFuel : 0;
      hud.beginFill(0xffcc00, 0.9);
      hud.drawRoundedRect(fuelBarX, fuelBarY + fuelBarH - fuelBarH * fuelPct, barW, fuelBarH * fuelPct, 4);
      hud.endFill();

      // Throttle %
      const throtText = new PIXI.Text(`${(simState.rocket.throttle * 100).toFixed(0)}%`, new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 11,
        fill: 0xffffff,
      }));
      throtText.x = barX - 5;
      throtText.y = barY - 16;
      hud.addChild(throtText);

      // Fuel label
      const fuelLabel = new PIXI.Text('FUEL', new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 10,
        fill: 0xffffff,
      }));
      fuelLabel.x = fuelBarX - 3;
      fuelLabel.y = fuelBarY - 14;
      hud.addChild(fuelLabel);

      // Mission time
      const mins = Math.floor(simState.time / 60);
      const secs = Math.floor(simState.time % 60);
      const timeText = new PIXI.Text(`T+ ${mins}m ${secs}s`, textStyle);
      timeText.x = aw - 180;
      timeText.y = 20;
      hud.addChild(timeText);

      // Stage indicator
      const stageText = new PIXI.Text(`STAGE ${simState.rocket.stage + 1}/${simState.rocket.totalStages}`, textStyle);
      stageText.x = aw - 180;
      stageText.y = 42;
      hud.addChild(stageText);

      hudLayer.addChild(hud);

      // Controls hint
      if (simState.phase === 'countdown' && simState.phaseTimer < 5) {
        const countdown = new PIXI.Text(
          `LAUNCH IN ${Math.ceil(5 - simState.phaseTimer)}...`,
          new PIXI.TextStyle({
            fontFamily: 'monospace',
            fontSize: 32,
            fontWeight: 'bold',
            fill: 0xff4444,
          })
        );
        countdown.x = aw / 2 - 120;
        countdown.y = ah / 2 - 40;
        hud.addChild(countdown);
      }

      if (simState.phase === 'landed') {
        const landed = new PIXI.Text(
          '✓ LANDED ON THE MOON',
          new PIXI.TextStyle({
            fontFamily: 'monospace',
            fontSize: 28,
            fontWeight: 'bold',
            fill: 0x44ff88,
          })
        );
        landed.x = aw / 2 - 160;
        landed.y = ah / 2 - 20;
        hud.addChild(landed);
      }
    });

    appRef.current = app;

    return () => {
      window.removeEventListener('resize', handleResize);
      app.destroy(true, { children: true });
    };
  }, [game]);

  useEffect(() => {
    const cleanup = init();
    return () => {
      if (cleanup) cleanup();
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [init]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);

      if (e.key === ' ' || e.key === 'p') {
        e.preventDefault();
        if (stateRef.current) stateRef.current = togglePause(stateRef.current);
      }
      if (e.key === '<' || e.key === ',') {
        if (stateRef.current) stateRef.current = setTimeWarp(stateRef.current, -1);
      }
      if (e.key === '>' || e.key === '.') {
        if (stateRef.current) stateRef.current = setTimeWarp(stateRef.current, 1);
      }
      if (e.key === 'm' || e.key === 'M') {
        if (stateRef.current) stateRef.current = toggleMapView(stateRef.current);
      }
      if (e.key === '-' || e.key === '_') {
        if (stateRef.current) stateRef.current = adjustZoom(stateRef.current, -1);
      }
      if (e.key === '=' || e.key === '+') {
        if (stateRef.current) stateRef.current = adjustZoom(stateRef.current, 1);
      }
      if (e.key === '[') {
        if (stateRef.current) {
          const r = stateRef.current.rocket;
          r.throttle = Math.max(0, r.throttle - 0.1);
        }
      }
      if (e.key === ']') {
        if (stateRef.current) {
          const r = stateRef.current.rocket;
          r.throttle = Math.min(1, r.throttle + 0.1);
        }
      }
      if (e.key === '0') {
        if (stateRef.current) {
          stateRef.current.rocket.throttle = 0;
        }
      }
      if (e.key === '9') {
        if (stateRef.current) {
          stateRef.current.rocket.throttle = 1;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="flight-view">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
};

export default FlightView;
