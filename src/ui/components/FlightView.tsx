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

function worldToScreen(wx: number, wy: number, camX: number, camY: number, zoom: number, w: number, h: number) {
  const scale = PX_PER_M * zoom;
  return { x: (wx - camX) * scale + w / 2, y: -(wy - camY) * scale + h / 2 };
}

function drawGround(container: PIXI.Container, camX: number, camY: number, zoom: number, w: number, h: number, simTime: number) {
  const groundScreen = worldToScreen(0, -EARTH_RADIUS, camX, camY, zoom, w, h);
  const horizonScreen = worldToScreen(0, 0, camX, camY, zoom, w, h);

  if (groundScreen.y > h + 50) return;

  // Sky gradient
  const skyG = new PIXI.Graphics();
  const horizonY = Math.min(horizonScreen.y, h);
  if (horizonY > 0) {
    const steps = 15;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const y1 = (horizonY * t);
      const y2 = (horizonY * (t + 1 / steps));
      const alt = 1 - t;
      const r = Math.floor(8 + alt * 15);
      const gv = Math.floor(15 + alt * 40);
      const b = Math.floor(50 + alt * 100);
      skyG.beginFill((r << 16) | (gv << 8) | b);
      skyG.drawRect(0, y1, w, y2 - y1 + 1);
      skyG.endFill();
    }
  }
  container.addChild(skyG);

  // Ground
  if (groundScreen.y < h) {
    const dirtG = new PIXI.Graphics();
    const dirtTop = Math.max(0, groundScreen.y);
    const dirtBot = h;
    const dirtSteps = 8;
    for (let i = 0; i < dirtSteps; i++) {
      const t = i / dirtSteps;
      const y1 = dirtTop + (dirtBot - dirtTop) * t;
      const y2 = dirtTop + (dirtBot - dirtTop) * (t + 1 / dirtSteps);
      const depth = t;
      const r = Math.floor(55 + depth * 35);
      const gv = Math.floor(90 - depth * 25);
      const b = Math.floor(35 - depth * 15);
      dirtG.beginFill((r << 16) | (gv << 8) | b);
      dirtG.drawRect(0, y1, w, y2 - y1 + 1);
      dirtG.endFill();
    }
    container.addChild(dirtG);

    // Grass
    const grassG = new PIXI.Graphics();
    const grassCount = Math.min(300, Math.floor(w / 2));
    for (let i = 0; i < grassCount; i++) {
      const x = (i / grassCount) * w;
      const h2 = 3 + Math.sin(i * 7.3 + simTime * 2.5) * 3 + Math.sin(i * 13.1) * 2;
      const shade = 0.3 + Math.abs(Math.sin(i * 3.7)) * 0.4;
      const r = Math.floor(shade * 35);
      const gv = Math.floor(110 + shade * 70);
      const b = Math.floor(shade * 25);
      grassG.lineStyle(1.5 + Math.random() * 0.5, (r << 16) | (gv << 8) | b, 0.85);
      const sway = Math.sin(simTime * 2 + i * 0.4) * 1.5;
      grassG.moveTo(x, dirtTop);
      grassG.lineTo(x + sway, dirtTop - h2);
    }
    container.addChild(grassG);
  }
}

function drawStars(g: PIXI.Graphics, camX: number, camY: number, w: number, h: number, simTime: number) {
  const layers = [
    { count: 200, parallax: 0.00003, minSize: 0.3, maxSize: 0.8, alpha: 0.35 },
    { count: 120, parallax: 0.00008, minSize: 0.5, maxSize: 1.2, alpha: 0.45 },
    { count: 60, parallax: 0.00015, minSize: 0.8, maxSize: 2.0, alpha: 0.55 },
    { count: 25, parallax: 0.0003, minSize: 1.2, maxSize: 2.8, alpha: 0.65 },
  ];

  layers.forEach((layer) => {
    for (let i = 0; i < layer.count; i++) {
      const seed = i * 137.508 + layer.parallax * 50000;
      const bx = ((seed * 7.13) % 2000 - 1000) * 800;
      const by = ((seed * 11.71) % 2000 - 1000) * 800;
      const px = bx - camX * layer.parallax;
      const py = by - camY * layer.parallax;
      const ss = worldToScreen(px, py, 0, 0, 1, w, h);
      if (ss.x < -5 || ss.x > w + 5 || ss.y < -5 || ss.y > h + 5) continue;

      const twinkle = 0.5 + 0.5 * Math.sin(simTime * (2 + (seed % 3)) + seed);
      const size = layer.minSize + (layer.maxSize - layer.minSize) * ((seed * 3.17) % 1);
      const colorTemp = (seed * 5.31) % 1;
      const r = Math.floor(200 + colorTemp * 55);
      const gv = Math.floor(210 + colorTemp * 45);
      const b = 255;
      g.beginFill((r << 16) | (gv << 8) | b, layer.alpha * twinkle);
      g.drawCircle(ss.x, ss.y, Math.max(size, 0.3));
      g.endFill();
    }
  });
}

function drawEarth(g: PIXI.Graphics, camX: number, camY: number, zoom: number, w: number, h: number) {
  const s = worldToScreen(0, 0, camX, camY, zoom, w, h);
  const r = EARTH_RADIUS * PX_PER_M * zoom;
  if (r < 2) return;

  // Atmosphere glow
  g.beginFill(0x4488cc, 0.025); g.drawCircle(s.x, s.y, r * 1.4); g.endFill();
  g.beginFill(0x4488cc, 0.05); g.drawCircle(s.x, s.y, r * 1.2); g.endFill();
  // Body
  g.beginFill(0x1a6b9e); g.drawCircle(s.x, s.y, r); g.endFill();
  // Land
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const d = r * (0.25 + 0.35 * ((i * 7.13) % 1));
    const pr = r * (0.08 + 0.12 * ((i * 3.71) % 1));
    g.beginFill(0x2d8c5e, 0.55);
    g.drawCircle(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, pr);
    g.endFill();
  }
}

function drawMoonBody(g: PIXI.Graphics, mx: number, my: number, camX: number, camY: number, zoom: number, w: number, h: number) {
  const s = worldToScreen(mx, my, camX, camY, zoom, w, h);
  const r = MOON_RADIUS * PX_PER_M * zoom;
  if (r < 2) return;

  g.beginFill(0x888888); g.drawCircle(s.x, s.y, r); g.endFill();

  const craters = [
    { a: 0.3, d: 0.35, s: 0.14 }, { a: 1.1, d: 0.5, s: 0.18 }, { a: 2.0, d: 0.25, s: 0.1 },
    { a: 2.8, d: 0.55, s: 0.2 }, { a: 3.5, d: 0.4, s: 0.12 }, { a: 4.2, d: 0.3, s: 0.16 },
    { a: 5.0, d: 0.45, s: 0.15 }, { a: 5.8, d: 0.2, s: 0.09 },
  ];
  craters.forEach((c) => {
    const cx = s.x + Math.cos(c.a) * r * c.d;
    const cy = s.y + Math.sin(c.a) * r * c.d;
    const cr = r * c.s;
    g.beginFill(0x666666, 0.5); g.drawCircle(cx, cy, cr); g.endFill();
    g.beginFill(0x777777, 0.3); g.drawCircle(cx - cr * 0.2, cy - cr * 0.15, cr * 0.6); g.endFill();
  });
}

function drawRocket(g: PIXI.Graphics, rx: number, ry: number, angle: number, camX: number, camY: number, zoom: number, w: number, h: number, stage: number, totalStages: number) {
  const s = worldToScreen(rx, ry, camX, camY, zoom, w, h);
  const scale = PX_PER_M * zoom;
  const len = Math.max(50, 90 * Math.max(scale, 0.2));
  const wd = Math.max(12, 18 * Math.max(scale, 0.2));

  const cosA = Math.cos(Math.PI / 2 - angle);
  const sinA = Math.sin(Math.PI / 2 - angle);

  const noseH = len * 0.3;
  const bodyLen = len * 0.7;
  const hw = wd / 2;
  const hl = bodyLen / 2;

  // Stages
  const stageColors = [0xcc3333, 0xdddddd, 0x3366cc];
  const bandColors = [0x992222, 0xbbbbbb, 0x2244aa];
  const frac = 1 / totalStages;

  for (let i = 0; i < totalStages; i++) {
    const top = -hl + bodyLen * i * frac;
    const bot = -hl + bodyLen * (i + 1) * frac;
    const col = stageColors[i % 3];

    const pts = [
      { x: -hw, y: top }, { x: hw, y: top }, { x: hw, y: bot }, { x: -hw, y: bot },
    ].map((p) => ({ x: s.x + p.x * cosA - p.y * sinA, y: s.y + p.x * sinA + p.y * cosA }));

    g.beginFill(col);
    g.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => g.lineTo(p.x, p.y));
    g.closePath();
    g.endFill();

    // Band
    if (i < totalStages - 1) {
      const by = bot;
      const bh = 2;
      const bp = [
        { x: -hw, y: by - bh }, { x: hw, y: by - bh }, { x: hw, y: by + bh }, { x: -hw, y: by + bh },
      ].map((p) => ({ x: s.x + p.x * cosA - p.y * sinA, y: s.y + p.x * sinA + p.y * cosA }));
      g.beginFill(bandColors[i % 3]);
      g.moveTo(bp[0].x, bp[0].y);
      bp.forEach((p) => g.lineTo(p.x, p.y));
      g.closePath();
      g.endFill();
    }
  }

  // Nose cone
  const nPts = [
    { x: 0, y: -hl - noseH }, { x: -hw, y: -hl }, { x: hw, y: -hl },
  ].map((p) => ({ x: s.x + p.x * cosA - p.y * sinA, y: s.y + p.x * sinA + p.y * cosA }));
  g.beginFill(0xcc3333);
  g.moveTo(nPts[0].x, nPts[0].y);
  nPts.forEach((p) => g.lineTo(p.x, p.y));
  g.closePath();
  g.endFill();

  // Engine bell
  const bellTop = hl;
  const bellBot = hl + len * 0.12;
  const btW = hw * 0.75;
  const bbW = hw * 1.25;
  const bellPts = [
    { x: -btW, y: bellTop }, { x: btW, y: bellTop }, { x: bbW, y: bellBot }, { x: -bbW, y: bellBot },
  ].map((p) => ({ x: s.x + p.x * cosA - p.y * sinA, y: s.y + p.x * sinA + p.y * cosA }));
  g.beginFill(0x222222);
  g.moveTo(bellPts[0].x, bellPts[0].y);
  bellPts.forEach((p) => g.lineTo(p.x, p.y));
  g.closePath();
  g.endFill();

  // Nozzle
  const nzTop = bellBot;
  const nzBot = bellBot + len * 0.06;
  const nzW = bbW * 0.65;
  const nzPts = [
    { x: -nzW, y: nzTop }, { x: nzW, y: nzTop }, { x: nzW * 0.55, y: nzBot }, { x: -nzW * 0.55, y: nzBot },
  ].map((p) => ({ x: s.x + p.x * cosA - p.y * sinA, y: s.y + p.x * sinA + p.y * cosA }));
  g.beginFill(0x111111);
  g.moveTo(nzPts[0].x, nzPts[0].y);
  nzPts.forEach((p) => g.lineTo(p.x, p.y));
  g.closePath();
  g.endFill();
}

function drawExhaust(g: PIXI.Graphics, particles: Particle[], camX: number, camY: number, zoom: number, w: number, h: number) {
  const scale = PX_PER_M * zoom;
  particles.forEach((p) => {
    const s = worldToScreen(p.x, p.y, camX, camY, zoom, w, h);
    const sz = p.size * scale * 1.5;
    if (sz > 0.2 && p.alpha > 0.01) {
      g.beginFill(p.color, p.alpha);
      g.drawCircle(s.x, s.y, Math.max(sz, 0.4));
      g.endFill();
    }
  });
}

function drawSmoke(g: PIXI.Graphics, particles: Particle[], camX: number, camY: number, zoom: number, w: number, h: number) {
  const scale = PX_PER_M * zoom;
  particles.forEach((p) => {
    const s = worldToScreen(p.x, p.y, camX, camY, zoom, w, h);
    const sz = p.size * scale * 0.8;
    if (sz > 0.3 && p.alpha > 0.01) {
      g.beginFill(p.color, p.alpha * 0.4);
      g.drawCircle(s.x, s.y, Math.max(sz, 0.8));
      g.endFill();
    }
  });
}

function drawOrbit(g: PIXI.Graphics, camX: number, camY: number, zoom: number, w: number, h: number) {
  g.lineStyle(1, 0x224466, 0.15);
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const p1 = worldToScreen(Math.cos(a) * MOON_ORBIT_R, Math.sin(a) * MOON_ORBIT_R, camX, camY, zoom, w, h);
    const p2 = worldToScreen(Math.cos((i + 1) / 64 * Math.PI * 2) * MOON_ORBIT_R, Math.sin((i + 1) / 64 * Math.PI * 2) * MOON_ORBIT_R, camX, camY, zoom, w, h);
    if (p1.x > -50 && p1.x < w + 50 && p1.y > -50 && p1.y < h + 50) {
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

  // Briefing keyboard handler - works while briefing is showing
  useEffect(() => {
    if (!showBriefing) return;
    const handleBriefingKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setShowBriefing(false);
      }
    };
    window.addEventListener('keydown', handleBriefingKey);
    return () => window.removeEventListener('keydown', handleBriefingKey);
  }, [showBriefing]);

  useEffect(() => {
    if (showBriefing) return;

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

    const simState = createInitialState(mass, thrust, isp, totalStages);
    simState.autoMode = autoMode;
    simState.paused = true;
    simState.phase = 'briefing';
    stateRef.current = simState;

    const handleResize = () => {
      if (!parent) return;
      app.renderer.resize(parent.clientWidth, parent.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (!s) return;

      if (e.key === ' ') {
        e.preventDefault();
        if (s.phase === 'briefing') {
          Object.assign(s, launchMission(s));
        } else {
          Object.assign(s, togglePause(s));
        }
        return;
      }
      if (e.key === '<' || e.key === ',') { Object.assign(s, setTimeWarp(s, -1)); return; }
      if (e.key === '>' || e.key === '.') { Object.assign(s, setTimeWarp(s, 1)); return; }
      if (e.key === 'm' || e.key === 'M') { Object.assign(s, toggleMapView(s)); return; }
      if (e.key === '-' || e.key === '_') { Object.assign(s, adjustZoom(s, -1)); return; }
      if (e.key === '=' || e.key === '+') { Object.assign(s, adjustZoom(s, 1)); return; }
      if (e.key === '[') { s.rocket.throttle = Math.max(0, s.rocket.throttle - 0.1); return; }
      if (e.key === ']') { s.rocket.throttle = Math.min(1, s.rocket.throttle + 0.1); return; }
      if (e.key === '0') { s.rocket.throttle = 0; return; }
      if (e.key === '9') { s.rocket.throttle = 1; return; }
      if (e.key === 'Escape' && s.phase !== 'briefing' && s.phase !== 'landed') {
        s.paused = true;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    app.ticker.add(() => {
      const dt = Math.min(app.ticker.deltaMS / 1000, 0.05);
      timeRef.current += dt;

      const s = stateRef.current!;
      const updated = updateSimulation(s, dt);
      if (updated !== s) Object.assign(s, updated);

      const r = s.rocket;
      const camX = s.mapView ? 0 : r.x;
      const camY = s.mapView ? 0 : r.y;
      const zoom = s.mapView ? 0.00003 : s.zoom;
      const aw = app.renderer.width / (window.devicePixelRatio || 1);
      const ah = app.renderer.height / (window.devicePixelRatio || 1);

      bgLayer.removeChildren();
      groundLayer.removeChildren();
      worldLayer.removeChildren();
      particleLayer.removeChildren();
      hudLayer.removeChildren();

      // Stars
      const starG = new PIXI.Graphics();
      drawStars(starG, camX, camY, aw, ah, timeRef.current);
      bgLayer.addChild(starG);

      // Ground
      if (!s.mapView) {
        const gndG = new PIXI.Graphics();
        drawGround(groundLayer, camX, camY, zoom, aw, ah, timeRef.current);
      }

      // World
      const wG = new PIXI.Graphics();
      drawEarth(wG, camX, camY, zoom, aw, ah);
      drawOrbit(wG, camX, camY, zoom, aw, ah);
      drawMoonBody(wG, s.moon.x, s.moon.y, camX, camY, zoom, aw, ah);
      if (r.active) drawRocket(wG, r.x, r.y, r.angle, camX, camY, zoom, aw, ah, r.stage, r.totalStages);
      worldLayer.addChild(wG);

      // Particles
      const pG = new PIXI.Graphics();
      drawExhaust(pG, s.exhaust, camX, camY, zoom, aw, ah);
      drawSmoke(pG, s.smoke, camX, camY, zoom, aw, ah);
      particleLayer.addChild(pG);

      // HUD
      const hudG = new PIXI.Graphics();
      const bigSt = new PIXI.TextStyle({ fontFamily: 'Courier New, monospace', fontSize: 22, fontWeight: 'bold', fill: 0xffffff });
      const medSt = new PIXI.TextStyle({ fontFamily: 'Courier New, monospace', fontSize: 16, fill: 0x88ddff });
      const smSt = new PIXI.TextStyle({ fontFamily: 'Courier New, monospace', fontSize: 12, fill: 0x88aacc });

      // Top center: altitude + velocity
      const altText = new PIXI.Text(`ALT: ${s.altitude.toFixed(2)} km`, bigSt);
      altText.anchor.set(0.5, 0);
      altText.x = aw / 2;
      altText.y = 16;
      hudG.addChild(altText);

      const velText = new PIXI.Text(`VEL: ${s.speed.toFixed(1)} m/s`, medSt);
      velText.anchor.set(0.5, 0);
      velText.x = aw / 2;
      velText.y = 44;
      hudG.addChild(velText);

      // Bottom center: mission status
      const phaseLabel = s.phase.replace(/-/g, ' ').toUpperCase();
      const statusText = new PIXI.Text(phaseLabel, new PIXI.TextStyle({
        fontFamily: 'Courier New, monospace', fontSize: 14, fontWeight: 'bold', fill: 0x4a9eff,
      }));
      statusText.anchor.set(0.5);
      statusText.x = aw / 2;
      statusText.y = ah - 36;
      hudG.addChild(statusText);

      // Status background
      const statusBg = new PIXI.Graphics();
      statusBg.beginFill(0x000000, 0.6);
      statusBg.drawRoundedRect(aw / 2 - statusText.width / 2 - 16, ah - 54, statusText.width + 32, 30, 15);
      statusBg.endFill();
      hudG.addChild(statusBg);
      hudG.addChild(statusText);

      // Bottom left: staging + warp
      const warpText = new PIXI.Text(`WARP: ${s.timeWarp}x`, smSt);
      warpText.x = 20;
      warpText.y = ah - 50;
      hudG.addChild(warpText);

      // Staging stack
      const stageBg = new PIXI.Graphics();
      stageBg.beginFill(0x000000, 0.4);
      stageBg.lineStyle(1, 0xffffff, 0.2);
      stageBg.drawRoundedRect(16, ah - 200, 120, 140, 4);
      stageBg.endFill();
      hudG.addChild(stageBg);

      const stageItems = ['Capsule', 'Separator', 'Engine', 'Fuel Tank'];
      stageItems.forEach((item, i) => {
        const isActive = i === 2;
        const itemBg = new PIXI.Graphics();
        if (isActive) {
          itemBg.beginFill(0x4a9eff, 0.3);
          itemBg.lineStyle(1, 0x4a9eff, 0.8);
        } else {
          itemBg.beginFill(0xffffff, 0.1);
          itemBg.lineStyle(0);
        }
        itemBg.drawRoundedRect(20, ah - 190 + i * 34, 112, 28, 2);
        itemBg.endFill();
        hudG.addChild(itemBg);

        const itemText = new PIXI.Text(item.toUpperCase(), new PIXI.TextStyle({
          fontFamily: 'Courier New, monospace', fontSize: 10, fill: isActive ? 0x4a9eff : 0xaaaaaa,
        }));
        itemText.anchor.set(0.5);
        itemText.x = 76;
        itemText.y = ah - 176 + i * 34;
        hudG.addChild(itemText);
      });

      // Bottom right: throttle
      const throttleBg = new PIXI.Graphics();
      throttleBg.beginFill(0x000000, 0.4);
      throttleBg.lineStyle(1, 0xffffff, 0.1);
      throttleBg.drawRoundedRect(aw - 70, ah - 240, 50, 220, 8);
      throttleBg.endFill();
      hudG.addChild(throttleBg);

      // Throttle fill
      const barInnerW = 30;
      const barInnerH = 160;
      const barInnerX = aw - 60;
      const barInnerY = ah - 220;
      hudG.beginFill(0x222233);
      hudG.drawRoundedRect(barInnerX, barInnerY, barInnerW, barInnerH, 10);
      hudG.endFill();

      const fillH = barInnerH * r.throttle;
      const fillCol = r.throttle > 0.5 ? 0xff6600 : 0x4a9eff;
      hudG.beginFill(fillCol, 0.9);
      hudG.drawRoundedRect(barInnerX, barInnerY + barInnerH - fillH, barInnerW, fillH, 10);
      hudG.endFill();

      const throtPct = new PIXI.Text(`${(r.throttle * 100).toFixed(0)}%`, new PIXI.TextStyle({
        fontFamily: 'Courier New, monospace', fontSize: 11, fill: 0xffffff,
      }));
      throtPct.anchor.set(0.5);
      throtPct.x = aw - 45;
      throtPct.y = ah - 14;
      hudG.addChild(throtPct);

      // Mission time
      const mins = Math.floor(s.time / 60);
      const secs = Math.floor(s.time % 60);
      const timeStr = new PIXI.Text(`T+ ${mins}m ${String(secs).padStart(2, '0')}s`, smSt);
      timeStr.x = aw - 160;
      timeStr.y = 16;
      hudG.addChild(timeStr);

      // Stage indicator
      const stageStr = new PIXI.Text(`STAGE ${r.stage + 1}/${r.totalStages}`, smSt);
      stageStr.x = aw - 160;
      stageStr.y = 34;
      hudG.addChild(stageStr);

      hudLayer.addChild(hudG);

      // Countdown overlay
      if (s.phase === 'countdown') {
        const cd = Math.ceil(5 - s.phaseTimer);
        const cdBg = new PIXI.Graphics();
        cdBg.beginFill(0x000000, 0.5);
        cdBg.drawRoundedRect(aw / 2 - 60, ah / 2 - 50, 120, 100, 8);
        cdBg.endFill();
        hudLayer.addChild(cdBg);

        const cdText = new PIXI.Text(`${cd}`, new PIXI.TextStyle({
          fontFamily: 'Courier New, monospace', fontSize: 56, fontWeight: 'bold', fill: 0xff4444,
        }));
        cdText.anchor.set(0.5);
        cdText.x = aw / 2;
        cdText.y = ah / 2 - 10;
        hudLayer.addChild(cdText);

        const cdLabel = new PIXI.Text('IGNITION', new PIXI.TextStyle({
          fontFamily: 'Courier New, monospace', fontSize: 12, fill: 0xff6666,
        }));
        cdLabel.anchor.set(0.5);
        cdLabel.x = aw / 2;
        cdLabel.y = ah / 2 + 30;
        hudLayer.addChild(cdLabel);
      }

      if (s.phase === 'landed') {
        const landedBg = new PIXI.Graphics();
        landedBg.beginFill(0x000000, 0.6);
        landedBg.drawRoundedRect(aw / 2 - 160, ah / 2 - 30, 320, 60, 8);
        landedBg.endFill();
        hudLayer.addChild(landedBg);

        const landedText = new PIXI.Text('LANDING CONFIRMED', new PIXI.TextStyle({
          fontFamily: 'Courier New, monospace', fontSize: 22, fontWeight: 'bold', fill: 0x44ff88,
        }));
        landedText.anchor.set(0.5);
        landedText.x = aw / 2;
        landedText.y = ah / 2;
        hudLayer.addChild(landedText);
      }

      if (s.paused && s.phase !== 'briefing' && s.phase !== 'landed') {
        const pauseBg = new PIXI.Graphics();
        pauseBg.beginFill(0x000000, 0.5);
        pauseBg.drawRoundedRect(aw / 2 - 50, ah / 2 - 20, 100, 40, 8);
        pauseBg.endFill();
        hudLayer.addChild(pauseBg);

        const pauseText = new PIXI.Text('PAUSED', new PIXI.TextStyle({
          fontFamily: 'Courier New, monospace', fontSize: 20, fontWeight: 'bold', fill: 0xffffff,
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
      window.removeEventListener('keydown', handleKeyDown);
      app.destroy(true, { children: true });
      appRef.current = null;
    };
  }, [showBriefing, autoMode, game]);

  if (showBriefing) {
    return (
      <div className="flight-view" style={{
        width: '100%', height: '100%', background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        fontFamily: 'Courier New, monospace',
      }}>
        <h1 style={{ color: '#4a9eff', fontSize: 48, marginBottom: 16, textShadow: '0 0 10px rgba(74,158,255,0.5)' }}>
          LUNAR MISSION
        </h1>
        <div style={{
          background: 'rgba(255,255,255,0.05)', padding: 40, borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)', maxWidth: 650, textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}>
          <h2 style={{ marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 10 }}>
            MISSION BRIEFING
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.5, opacity: 0.9, marginBottom: 20 }}>
            Execute a fully autonomous lunar injection and landing profile.
            Realistic N-body gravity and physical thrust limits.
          </p>
          <ul style={{ textAlign: 'left', opacity: 0.8, marginBottom: 30, lineHeight: 1.6 }}>
            <li>5-second countdown before ignition</li>
            <li>Gravity turn to establish Low Earth Orbit</li>
            <li>Coast to Hohmann transfer window</li>
            <li>Trans-Lunar Injection burn</li>
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

          <h3 style={{ color: '#4a9eff', textTransform: 'uppercase', marginBottom: 10 }}>
            System Controls
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left', opacity: 0.8, marginBottom: 30, fontSize: 14 }}>
            <div><strong>[&lt; / &gt;]</strong> : Adjust Time Warp</div>
            <div><strong>[- / +]</strong> : Manual Zoom Camera</div>
            <div><strong>MAP MODE</strong> : Toggle System View</div>
            <div><strong>[/ ]</strong> : Throttle Control</div>
          </div>

          <h2 style={{ color: '#ff4a4a', animation: 'pulse 1s infinite', letterSpacing: 2 }}>
            [ PRESS SPACEBAR TO LAUNCH ]
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
