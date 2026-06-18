import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { CelestiaGame } from '../../core/game';
import {
  createInitialState,
  updateSimulation,
  togglePause,
  setTimeWarp,
  toggleMapView,
  adjustZoom,
  launchMission,
  SimState,
  Particle,
  EARTH_RADIUS,
  MOON_RADIUS,
  MOON_ORBIT_R,
} from '../../simulation/Simulation';

interface FlightViewProps {
  game: CelestiaGame;
}

const PX_PER_M = 1 / 500;

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

function drawGround(g: PIXI.Graphics, camX: number, camY: number, zoom: number, w: number, h: number, simTime: number) {
  const groundY = -(EARTH_RADIUS);
  const groundScreen = worldToScreen(0, groundY, camX, camY, zoom, w, h);

  if (groundScreen.y > h + 100) return;

  const horizonY = worldToScreen(0, 0, camX, camY, zoom, w, h).y;

  // Sky gradient
  const skyGrad = new PIXI.Graphics();
  const skyTop = 0;
  const skyBottom = Math.min(horizonY, h);

  if (skyBottom > skyTop) {
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const y1 = skyTop + (skyBottom - skyTop) * t;
      const y2 = skyTop + (skyBottom - skyTop) * (t + 1 / steps);
      const altitudeFactor = 1 - t;
      const r = Math.floor(10 + altitudeFactor * 20);
      const gv = Math.floor(20 + altitudeFactor * 50);
      const b = Math.floor(60 + altitudeFactor * 120);
      const color = (r << 16) | (gv << 8) | b;
      skyGrad.beginFill(color, 0.9);
      skyGrad.drawRect(0, y1, w, y2 - y1 + 1);
      skyGrad.endFill();
    }
  }
  g.addChild(skyGrad);

  // Ground
  if (groundScreen.y < h) {
    // Dirt layer
    const dirtGrad = new PIXI.Graphics();
    const dirtTop = groundScreen.y;
    const dirtBottom = h;
    const dirtSteps = 10;
    for (let i = 0; i < dirtSteps; i++) {
      const t = i / dirtSteps;
      const y1 = dirtTop + (dirtBottom - dirtTop) * t;
      const y2 = dirtTop + (dirtBottom - dirtTop) * (t + 1 / dirtSteps);
      const depth = t;
      const r = Math.floor(60 + depth * 40);
      const gv = Math.floor(100 - depth * 30);
      const b = Math.floor(40 - depth * 20);
      const color = (r << 16) | (gv << 8) | b;
      dirtGrad.beginFill(color, 1);
      dirtGrad.drawRect(0, y1, w, y2 - y1 + 1);
      dirtGrad.endFill();
    }
    g.addChild(dirtGrad);

    // Grass blades
    const grassG = new PIXI.Graphics();
    const grassCount = Math.min(200, Math.floor(w / 3));
    const grassBaseY = groundScreen.y;

    for (let i = 0; i < grassCount; i++) {
      const x = (i / grassCount) * w;
      const grassHeight = 4 + Math.random() * 8;
      const sway = Math.sin(simTime * 2 + i * 0.3) * 2;
      const shade = 0.3 + Math.random() * 0.4;
      const r = Math.floor(shade * 40);
      const gv = Math.floor(120 + shade * 80);
      const b = Math.floor(shade * 30);
      const color = (r << 16) | (gv << 8) | b;

      grassG.lineStyle(1.5, color, 0.9);
      grassG.moveTo(x, grassBaseY);
      grassG.lineTo(x + sway, grassBaseY - grassHeight);
    }
    g.addChild(grassG);
  }
}

function drawStars(g: PIXI.Graphics, camX: number, camY: number, zoom: number, w: number, h: number, simTime: number) {
  const layers = [
    { count: 150, parallax: 0.00005, minSize: 0.3, maxSize: 1.0, alpha: 0.4 },
    { count: 100, parallax: 0.0001, minSize: 0.5, maxSize: 1.5, alpha: 0.5 },
    { count: 50, parallax: 0.0002, minSize: 1.0, maxSize: 2.5, alpha: 0.6 },
    { count: 20, parallax: 0.0004, minSize: 1.5, maxSize: 3.0, alpha: 0.7 },
  ];

  layers.forEach((layer) => {
    for (let i = 0; i < layer.count; i++) {
      const seed = i * 137.5 + layer.parallax * 10000;
      const sx = ((seed * 7.13) % 2000 - 1000) * 1000;
      const sy = ((seed * 11.71) % 2000 - 1000) * 1000;
      const twinkle = 0.5 + 0.5 * Math.sin(simTime * 3 + seed);
      const size = layer.minSize + (layer.maxSize - layer.minSize) * ((seed * 3.17) % 1);
      const px = sx - camX * layer.parallax;
      const py = sy - camY * layer.parallax;
      const ss = worldToScreen(px, py, 0, 0, 1, w, h);

      if (ss.x > -10 && ss.x < w + 10 && ss.y > -10 && ss.y < h + 10) {
        const alpha = layer.alpha * twinkle;
        const colorVal = 0.7 + 0.3 * ((seed * 5.31) % 1);
        const r = Math.floor(255 * colorVal);
        const gv = Math.floor(255 * (0.8 + 0.2 * colorVal));
        const b = Math.floor(255);
        const color = (r << 16) | (gv << 8) | b;
        g.beginFill(color, alpha);
        g.drawCircle(ss.x, ss.y, Math.max(size, 0.5));
        g.endFill();
      }
    }
  });
}

function drawEarth(g: PIXI.Graphics, camX: number, camY: number, zoom: number, w: number, h: number) {
  const s = worldToScreen(0, 0, camX, camY, zoom, w, h);
  const r = EARTH_RADIUS * PX_PER_M * zoom;

  if (r < 2) return;

  // Atmosphere glow
  g.beginFill(0x4488cc, 0.03);
  g.drawCircle(s.x, s.y, r * 1.3);
  g.endFill();

  g.beginFill(0x4488cc, 0.06);
  g.drawCircle(s.x, s.y, r * 1.15);
  g.endFill();

  // Earth body
  g.beginFill(0x1a6b9e);
  g.drawCircle(s.x, s.y, r);
  g.endFill();

  // Land patches
  const landG = new PIXI.Graphics();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = r * (0.3 + 0.4 * ((i * 7.13) % 1));
    const patchR = r * (0.1 + 0.15 * ((i * 3.71) % 1));
    const px = s.x + Math.cos(angle) * dist;
    const py = s.y + Math.sin(angle) * dist;
    landG.beginFill(0x2d8c5e, 0.6);
    landG.drawCircle(px, py, patchR);
    landG.endFill();
  }
  g.addChild(landG);
}

function drawMoon(g: PIXI.Graphics, moonX: number, moonY: number, camX: number, camY: number, zoom: number, w: number, h: number) {
  const s = worldToScreen(moonX, moonY, camX, camY, zoom, w, h);
  const r = MOON_RADIUS * PX_PER_M * zoom;

  if (r < 2) return;

  // Moon body
  g.beginFill(0x888888);
  g.drawCircle(s.x, s.y, r);
  g.endFill();

  // Craters
  const craters = [
    { angle: 0.3, dist: 0.4, size: 0.15 },
    { angle: 1.2, dist: 0.3, size: 0.12 },
    { angle: 2.1, dist: 0.5, size: 0.18 },
    { angle: 3.0, dist: 0.2, size: 0.1 },
    { angle: 3.8, dist: 0.6, size: 0.2 },
    { angle: 4.5, dist: 0.35, size: 0.14 },
    { angle: 5.2, dist: 0.45, size: 0.16 },
  ];

  craters.forEach((c) => {
    const cx = s.x + Math.cos(c.angle) * r * c.dist;
    const cy = s.y + Math.sin(c.angle) * r * c.dist;
    const cr = r * c.size;

    g.beginFill(0x666666, 0.5);
    g.drawCircle(cx, cy, cr);
    g.endFill();

    g.beginFill(0x777777, 0.3);
    g.drawCircle(cx - cr * 0.2, cy - cr * 0.2, cr * 0.6);
    g.endFill();
  });
}

function drawRocket(
  g: PIXI.Graphics,
  rx: number, ry: number, angle: number,
  camX: number, camY: number,
  zoom: number,
  w: number, h: number,
  stage: number, totalStages: number
) {
  const s = worldToScreen(rx, ry, camX, camY, zoom, w, h);
  const scale = PX_PER_M * zoom;
  const rocketLen = Math.max(40, 80 * Math.max(scale, 0.3));
  const rocketW = Math.max(10, 16 * Math.max(scale, 0.3));

  const cosA = Math.cos(Math.PI / 2 - angle);
  const sinA = Math.sin(Math.PI / 2 - angle);

  const noseH = rocketLen * 0.35;
  const bodyLen = rocketLen * 0.65;
  const hw = rocketW / 2;
  const hl = bodyLen / 2;

  // Body stages with colors
  const stageColors = [0xcc3333, 0xdddddd, 0x3366cc];
  const bandColors = [0xaa2222, 0xbbbbbb, 0x2255aa];

  for (let i = 0; i < totalStages; i++) {
    const stageFrac = 1 / totalStages;
    const stageTop = -hl + bodyLen * i * stageFrac;
    const stageBot = -hl + bodyLen * (i + 1) * stageFrac;
    const color = i === stage ? stageColors[i % 3] : stageColors[i % 3];

    const pts = [
      { x: -hw, y: stageTop },
      { x: hw, y: stageTop },
      { x: hw, y: stageBot },
      { x: -hw, y: stageBot },
    ].map((p) => ({
      x: s.x + p.x * cosA - p.y * sinA,
      y: s.y + p.x * sinA + p.y * cosA,
    }));

    g.beginFill(color);
    g.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => g.lineTo(p.x, p.y));
    g.closePath();
    g.endFill();

    // Band
    if (i < totalStages - 1) {
      const bandY = stageBot;
      const bandH = 3;
      const bandPts = [
        { x: -hw, y: bandY - bandH },
        { x: hw, y: bandY - bandH },
        { x: hw, y: bandY + bandH },
        { x: -hw, y: bandY + bandH },
      ].map((p) => ({
        x: s.x + p.x * cosA - p.y * sinA,
        y: s.y + p.x * sinA + p.y * cosA,
      }));

      g.beginFill(bandColors[i % 3]);
      g.moveTo(bandPts[0].x, bandPts[0].y);
      bandPts.forEach((p) => g.lineTo(p.x, p.y));
      g.closePath();
      g.endFill();
    }
  }

  // Nose cone (triangle)
  const noseTip = { x: 0, y: -hl - noseH };
  const noseLeft = { x: -hw, y: -hl };
  const noseRight = { x: hw, y: -hl };

  const nosePts = [
    { x: s.x + noseTip.x * cosA - noseTip.y * sinA, y: s.y + noseTip.x * sinA + noseTip.y * cosA },
    { x: s.x + noseLeft.x * cosA - noseLeft.y * sinA, y: s.y + noseLeft.x * sinA + noseLeft.y * cosA },
    { x: s.x + noseRight.x * cosA - noseRight.y * sinA, y: s.y + noseRight.x * sinA + noseRight.y * cosA },
  ];

  g.beginFill(0xcc3333);
  g.moveTo(nosePts[0].x, nosePts[0].y);
  nosePts.forEach((p) => g.lineTo(p.x, p.y));
  g.closePath();
  g.endFill();

  // Engine bell
  const bellTop = hl;
  const bellBot = hl + rocketLen * 0.15;
  const bellTopW = hw * 0.8;
  const bellBotW = hw * 1.3;

  const bellPts = [
    { x: -bellTopW, y: bellTop },
    { x: bellTopW, y: bellTop },
    { x: bellBotW, y: bellBot },
    { x: -bellBotW, y: bellBot },
  ].map((p) => ({
    x: s.x + p.x * cosA - p.y * sinA,
    y: s.y + p.x * sinA + p.y * cosA,
  }));

  g.beginFill(0x222222);
  g.moveTo(bellPts[0].x, bellPts[0].y);
  bellPts.forEach((p) => g.lineTo(p.x, p.y));
  g.closePath();
  g.endFill();

  // Nozzle
  const nozzleTop = bellBot;
  const nozzleBot = bellBot + rocketLen * 0.08;
  const nozzleW = bellBotW * 0.7;

  const nozzlePts = [
    { x: -nozzleW, y: nozzleTop },
    { x: nozzleW, y: nozzleTop },
    { x: nozzleW * 0.6, y: nozzleBot },
    { x: -nozzleW * 0.6, y: nozzleBot },
  ].map((p) => ({
    x: s.x + p.x * cosA - p.y * sinA,
    y: s.y + p.x * sinA + p.y * cosA,
  }));

  g.beginFill(0x111111);
  g.moveTo(nozzlePts[0].x, nozzlePts[0].y);
  nozzlePts.forEach((p) => g.lineTo(p.x, p.y));
  g.closePath();
  g.endFill();
}

function drawExhaust(g: PIXI.Graphics, particles: Particle[], camX: number, camY: number, zoom: number, w: number, h: number) {
  const scale = PX_PER_M * zoom;
  particles.forEach((p) => {
    const s = worldToScreen(p.x, p.y, camX, camY, zoom, w, h);
    const size = p.size * scale * 2;
    if (size > 0.3 && p.alpha > 0.01) {
      g.beginFill(p.color, p.alpha);
      g.drawCircle(s.x, s.y, Math.max(size, 0.5));
      g.endFill();
    }
  });
}

function drawSmoke(g: PIXI.Graphics, particles: Particle[], camX: number, camY: number, zoom: number, w: number, h: number) {
  const scale = PX_PER_M * zoom;
  particles.forEach((p) => {
    const s = worldToScreen(p.x, p.y, camX, camY, zoom, w, h);
    const size = p.size * scale;
    if (size > 0.5 && p.alpha > 0.01) {
      g.beginFill(p.color, p.alpha * 0.5);
      g.drawCircle(s.x, s.y, Math.max(size, 1));
      g.endFill();
    }
  });
}

function drawMoonOrbit(g: PIXI.Graphics, camX: number, camY: number, zoom: number, w: number, h: number) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * MOON_ORBIT_R, y: Math.sin(a) * MOON_ORBIT_R });
  }

  g.lineStyle(1, 0x224466, 0.2);
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = worldToScreen(pts[i].x, pts[i].y, camX, camY, zoom, w, h);
    const p2 = worldToScreen(pts[i + 1].x, pts[i + 1].y, camX, camY, zoom, w, h);
    if (p1.x > -100 && p1.x < w + 100 && p1.y > -100 && p1.y < h + 100) {
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
    }
  }
}

const FlightView: React.FC<FlightViewProps> = ({ game }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const stateRef = useRef<SimState | null>(null);
  const timeRef = useRef(0);
  const [showBriefing, setShowBriefing] = useState(true);
  const [autoMode, setAutoMode] = useState(true);

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
    const groundLayer = new PIXI.Container();
    const worldLayer = new PIXI.Container();
    const particleLayer = new PIXI.Container();
    const hudLayer = new PIXI.Container();
    app.stage.addChild(bgLayer, groundLayer, worldLayer, particleLayer, hudLayer);

    const spacecraft = game.getSpacecraft();
    const mass = spacecraft ? spacecraft.mass : 50000;
    const thrust = game.getSpacecraftThrust() || 2000000;
    const isp = 300;
    const totalStages = spacecraft ? spacecraft.stages.length : 3;

    let simState = createInitialState(mass, thrust, isp, totalStages);
    simState.autoMode = autoMode;
    stateRef.current = simState;

    const handleResize = () => {
      if (!parent) return;
      const nw = parent.clientWidth;
      const nh = parent.clientHeight;
      app.renderer.resize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    app.ticker.add(() => {
      const dt = Math.min(app.ticker.deltaMS / 1000, 0.05);
      timeRef.current += dt;

      simState = updateSimulation(simState, dt);
      stateRef.current = simState;

      const r = simState.rocket;
      const camX = simState.mapView ? 0 : r.x;
      const camY = simState.mapView ? 0 : r.y;
      const zoom = simState.mapView ? 0.00005 : simState.zoom;
      const aw = app.renderer.width / (window.devicePixelRatio || 1);
      const ah = app.renderer.height / (window.devicePixelRatio || 1);

      // Clear layers
      bgLayer.removeChildren();
      groundLayer.removeChildren();
      worldLayer.removeChildren();
      particleLayer.removeChildren();
      hudLayer.removeChildren();

      // Background stars
      const starG = new PIXI.Graphics();
      drawStars(starG, camX, camY, zoom, aw, ah, timeRef.current);
      bgLayer.addChild(starG);

      // Ground & sky
      if (!simState.mapView) {
        const groundG = new PIXI.Graphics();
        drawGround(groundG, camX, camY, zoom, aw, ah, timeRef.current);
        groundLayer.addChild(groundG);
      }

      // World objects
      const worldG = new PIXI.Graphics();
      drawEarth(worldG, camX, camY, zoom, aw, ah);
      drawMoonOrbit(worldG, camX, camY, zoom, aw, ah);
      drawMoon(worldG, simState.moon.x, simState.moon.y, camX, camY, zoom, aw, ah);

      if (r.active) {
        drawRocket(worldG, r.x, r.y, r.angle, camX, camY, zoom, aw, ah, r.stage, r.totalStages);
      }
      worldLayer.addChild(worldG);

      // Particles
      const partG = new PIXI.Graphics();
      drawExhaust(partG, simState.exhaust, camX, camY, zoom, aw, ah);
      drawSmoke(partG, simState.smoke, camX, camY, zoom, aw, ah);
      particleLayer.addChild(partG);

      // HUD
      const hudG = new PIXI.Graphics();
      const bigStyle = new PIXI.TextStyle({ fontFamily: 'monospace', fontSize: 22, fontWeight: 'bold', fill: 0xffffff });
      const medStyle = new PIXI.TextStyle({ fontFamily: 'monospace', fontSize: 16, fill: 0x88ddff });
      const smStyle = new PIXI.TextStyle({ fontFamily: 'monospace', fontSize: 12, fill: 0x88aacc });

      // Altitude
      const altText = new PIXI.Text(`ALT: ${simState.altitude.toFixed(1)} km`, bigStyle);
      altText.x = 20;
      altText.y = 20;
      hudG.addChild(altText);

      // Velocity
      const velText = new PIXI.Text(`VEL: ${simState.speed.toFixed(0)} m/s`, medStyle);
      velText.x = 20;
      velText.y = 48;
      hudG.addChild(velText);

      // Phase
      const phaseLabel = simState.phase.replace(/-/g, ' ').toUpperCase();
      const phaseText = new PIXI.Text(phaseLabel, new PIXI.TextStyle({
        fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: 0x4a9eff,
      }));
      phaseText.x = 20;
      phaseText.y = 74;
      hudG.addChild(phaseText);

      // Time warp
      const warpText = new PIXI.Text(`WARP: ${simState.timeWarp}x`, smStyle);
      warpText.x = 20;
      warpText.y = 96;
      hudG.addChild(warpText);

      // Mission time
      const mins = Math.floor(simState.time / 60);
      const secs = Math.floor(simState.time % 60);
      const timeText = new PIXI.Text(`T+ ${mins}m ${String(secs).padStart(2, '0')}s`, smStyle);
      timeText.x = aw - 160;
      timeText.y = 20;
      hudG.addChild(timeText);

      // Stage
      const stageText = new PIXI.Text(`STAGE ${r.stage + 1}/${r.totalStages}`, smStyle);
      stageText.x = aw - 160;
      stageText.y = 40;
      hudG.addChild(stageText);

      // Throttle bar
      const barX = aw - 45;
      const barY = 70;
      const barW = 18;
      const barH = 180;
      hudG.beginFill(0x111122, 0.8);
      hudG.drawRoundedRect(barX, barY, barW, barH, 4);
      hudG.endFill();
      const fillH = barH * r.throttle;
      const fillColor = r.throttle > 0.5 ? 0xff6600 : 0x4488ff;
      hudG.beginFill(fillColor, 0.9);
      hudG.drawRoundedRect(barX, barY + barH - fillH, barW, fillH, 4);
      hudG.endFill();

      // Throttle label
      const throtLabel = new PIXI.Text(`${(r.throttle * 100).toFixed(0)}%`, new PIXI.TextStyle({
        fontFamily: 'monospace', fontSize: 11, fill: 0xffffff,
      }));
      throtLabel.x = barX - 4;
      throtLabel.y = barY - 16;
      hudG.addChild(throtLabel);

      // Fuel bar
      const fuelX = aw - 45;
      const fuelY = 270;
      const fuelH = 50;
      hudG.beginFill(0x111122, 0.8);
      hudG.drawRoundedRect(fuelX, fuelY, barW, fuelH, 4);
      hudG.endFill();
      const fuelPct = r.maxFuel > 0 ? r.fuel / r.maxFuel : 0;
      const fuelColor = fuelPct > 0.3 ? 0xffcc00 : 0xff4444;
      hudG.beginFill(fuelColor, 0.9);
      hudG.drawRoundedRect(fuelX, fuelY + fuelH - fuelH * fuelPct, barW, fuelH * fuelPct, 4);
      hudG.endFill();

      const fuelLabel = new PIXI.Text('FUEL', new PIXI.TextStyle({
        fontFamily: 'monospace', fontSize: 10, fill: 0xffffff,
      }));
      fuelLabel.x = fuelX - 2;
      fuelLabel.y = fuelY - 14;
      hudG.addChild(fuelLabel);

      hudLayer.addChild(hudG);

      // Countdown overlay
      if (simState.phase === 'countdown') {
        const countdown = Math.ceil(5 - simState.phaseTimer);
        const cdText = new PIXI.Text(`${countdown}`, new PIXI.TextStyle({
          fontFamily: 'monospace', fontSize: 64, fontWeight: 'bold', fill: 0xff4444,
        }));
        cdText.anchor.set(0.5);
        cdText.x = aw / 2;
        cdText.y = ah / 2 - 40;
        hudLayer.addChild(cdText);

        const launchText = new PIXI.Text('LAUNCH SEQUENCE INITIATED', new PIXI.TextStyle({
          fontFamily: 'monospace', fontSize: 14, fill: 0xff6666,
        }));
        launchText.anchor.set(0.5);
        launchText.x = aw / 2;
        launchText.y = ah / 2 + 20;
        hudLayer.addChild(launchText);
      }

      if (simState.phase === 'landed') {
        const landedBg = new PIXI.Graphics();
        landedBg.beginFill(0x000000, 0.5);
        landedBg.drawRoundedRect(aw / 2 - 180, ah / 2 - 40, 360, 80, 8);
        landedBg.endFill();
        hudLayer.addChild(landedBg);

        const landedText = new PIXI.Text('LANDING CONFIRMED', new PIXI.TextStyle({
          fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold', fill: 0x44ff88,
        }));
        landedText.anchor.set(0.5);
        landedText.x = aw / 2;
        landedText.y = ah / 2;
        hudLayer.addChild(landedText);
      }

      // Paused overlay
      if (simState.paused && simState.phase !== 'briefing') {
        const pauseText = new PIXI.Text('PAUSED', new PIXI.TextStyle({
          fontFamily: 'monospace', fontSize: 28, fontWeight: 'bold', fill: 0xffffff,
        }));
        pauseText.anchor.set(0.5);
        pauseText.x = aw / 2;
        pauseText.y = ah / 2;
        hudLayer.addChild(pauseText);
      }
    });

    appRef.current = app;

    return () => {
      window.removeEventListener('resize', handleResize);
      app.destroy(true, { children: true });
    };
  }, [game, autoMode]);

  useEffect(() => {
    if (!showBriefing) {
      const cleanup = init();
      return () => {
        if (cleanup) cleanup();
        if (appRef.current) {
          appRef.current.destroy(true, { children: true });
          appRef.current = null;
        }
      };
    }
  }, [init, showBriefing]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && showBriefing) {
        e.preventDefault();
        setShowBriefing(false);
        return;
      }

      if (e.key === ' ' && !showBriefing) {
        e.preventDefault();
        if (stateRef.current && stateRef.current.phase === 'briefing') {
          stateRef.current = launchMission(stateRef.current);
        } else if (stateRef.current) {
          stateRef.current = togglePause(stateRef.current);
        }
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
          stateRef.current.rocket.throttle = Math.max(0, stateRef.current.rocket.throttle - 0.1);
        }
      }
      if (e.key === ']') {
        if (stateRef.current) {
          stateRef.current.rocket.throttle = Math.min(1, stateRef.current.rocket.throttle + 0.1);
        }
      }
      if (e.key === '0') {
        if (stateRef.current) stateRef.current.rocket.throttle = 0;
      }
      if (e.key === '9') {
        if (stateRef.current) stateRef.current.rocket.throttle = 1;
      }
      if (e.key === 'Escape') {
        if (stateRef.current && stateRef.current.phase !== 'briefing') {
          stateRef.current.paused = true;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showBriefing]);

  if (showBriefing) {
    return (
      <div className="flight-view" style={{
        width: '100%', height: '100%', background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        fontFamily: 'Orbitron, monospace',
      }}>
        <h1 style={{ color: '#4a9eff', fontSize: 48, marginBottom: 16, textShadow: '0 0 10px rgba(74,158,255,0.5)' }}>
          LUNAR MISSION
        </h1>
        <div style={{
          background: 'rgba(255,255,255,0.04)', padding: 36, borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)', maxWidth: 580, textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}>
          <h2 style={{ marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 10, fontSize: 18, letterSpacing: 2 }}>
            MISSION BRIEFING
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.85, marginBottom: 20 }}>
            Execute a fully autonomous lunar injection and landing profile.
            Realistic N-body gravity and physical thrust limits.
          </p>
          <ul style={{ textAlign: 'left', opacity: 0.75, marginBottom: 24, lineHeight: 1.8, fontSize: 13 }}>
            <li>5-second countdown before ignition</li>
            <li>Gravity turn through atmosphere</li>
            <li>Orbit insertion at 200 km</li>
            <li>Trans-Lunar Injection burn</li>
            <li>Lunar orbit insertion and powered descent</li>
          </ul>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={autoMode}
                onChange={(e) => setAutoMode(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#4a9eff' }}
              />
              Fully Automatic Mission
            </label>
          </div>

          <h3 style={{ color: '#4a9eff', textTransform: 'uppercase', fontSize: 13, letterSpacing: 2, marginBottom: 12 }}>
            Controls
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'left', opacity: 0.75, marginBottom: 24, fontSize: 12 }}>
            <div><strong>[/]</strong> Throttle -/+</div>
            <div><strong>[9/0]</strong> Max/Min Throttle</div>
            <div><strong>[&lt;/&gt;]</strong> Time Warp</div>
            <div><strong>[M]</strong> Map View</div>
            <div><strong>[-/+]</strong> Zoom</div>
            <div><strong>[Space]</strong> Pause/Launch</div>
          </div>

          <h2 style={{ color: '#ff4a4a', animation: 'pulse 1s infinite', letterSpacing: 2, fontSize: 16 }}>
            [ PRESS SPACEBAR TO BEGIN ]
          </h2>
        </div>
        <style>{`@keyframes pulse { 0% { opacity: 1; text-shadow: 0 0 10px #ff4a4a; } 50% { opacity: 0.4; text-shadow: none; } 100% { opacity: 1; text-shadow: 0 0 10px #ff4a4a; } }`}</style>
      </div>
    );
  }

  return (
    <div className="flight-view">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
};

export default FlightView;
