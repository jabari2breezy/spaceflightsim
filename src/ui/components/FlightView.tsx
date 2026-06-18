import React, { useEffect, useRef, useState } from 'react';
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

const FlightView: React.FC<FlightViewProps> = ({ game }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const stateRef = useRef<SimState | null>(null);
  const timeRef = useRef(0);
  const [showBriefing, setShowBriefing] = useState(true);
  const [autoMode, setAutoMode] = useState(true);
  const launchPendingRef = useRef(false);

  useEffect(() => {
    if (stateRef.current) stateRef.current.autoMode = autoMode;
  }, [autoMode, showBriefing]);

  useEffect(() => {
    if (!showBriefing) return;
    const handleBriefingKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      launchPendingRef.current = true;
      setShowBriefing(false);
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
      width: w, height: h, backgroundColor: 0x050a15,
      view: canvas, antialias: true,
      resolution: window.devicePixelRatio || 1, autoDensity: true,
    });

    // Pre-allocate layers
    const bgLayer = new PIXI.Graphics();
    const groundLayer = new PIXI.Container();
    const worldLayer = new PIXI.Graphics();
    const particleLayer = new PIXI.Graphics();
    app.stage.addChild(bgLayer, groundLayer, worldLayer, particleLayer);

    // Pre-allocate reusable graphics
    const starGfx = new PIXI.Graphics();
    const groundGfx = new PIXI.Graphics();
    const earthGfx = new PIXI.Graphics();
    const orbitGfx = new PIXI.Graphics();
    const moonGfx = new PIXI.Graphics();
    const rocketGfx = new PIXI.Graphics();
    const exhaustGfx = new PIXI.Graphics();
    const smokeGfx = new PIXI.Graphics();
    const hudBgGfx = new PIXI.Graphics();
    const stageBgGfx = new PIXI.Graphics();
    const throttleBgGfx = new PIXI.Graphics();
    const throttleFillGfx = new PIXI.Graphics();
    const countdownGfx = new PIXI.Graphics();
    const landedGfx = new PIXI.Graphics();
    const pauseGfx = new PIXI.Graphics();

    bgLayer.addChild(starGfx);
    groundLayer.addChild(groundGfx);
    worldLayer.addChild(earthGfx, orbitGfx, moonGfx, rocketGfx);
    particleLayer.addChild(exhaustGfx, smokeGfx);

    // Pre-allocate HUD container
    const hudContainer = new PIXI.Container();
    app.stage.addChild(hudContainer);

    // Pre-allocate HUD graphics
    const hudGfx = new PIXI.Graphics();
    hudContainer.addChild(hudGfx);

    // Pre-allocate HUD texts (never destroy these, just update content)
    const altText = new PIXI.Text('', { fontFamily: 'Courier New, monospace', fontSize: 22, fontWeight: 'bold', fill: 0xffffff });
    altText.anchor.set(0.5, 0);
    const velText = new PIXI.Text('', { fontFamily: 'Courier New, monospace', fontSize: 16, fill: 0x88ddff });
    velText.anchor.set(0.5, 0);
    const statusText = new PIXI.Text('', { fontFamily: 'Courier New, monospace', fontSize: 14, fontWeight: 'bold', fill: 0x4a9eff });
    statusText.anchor.set(0.5);
    const warpText = new PIXI.Text('', { fontFamily: 'Courier New, monospace', fontSize: 12, fill: 0x88aacc });
    const timeStrText = new PIXI.Text('', { fontFamily: 'Courier New, monospace', fontSize: 12, fill: 0x88aacc });
    const stageStrText = new PIXI.Text('', { fontFamily: 'Courier New, monospace', fontSize: 12, fill: 0x88aacc });
    const throtPctText = new PIXI.Text('', { fontFamily: 'Courier New, monospace', fontSize: 11, fill: 0xffffff });
    throtPctText.anchor.set(0.5);

    // Stage item texts (pre-allocate 6 max)
    const stageItemTexts: PIXI.Text[] = [];
    for (let i = 0; i < 6; i++) {
      const t = new PIXI.Text('', { fontFamily: 'Courier New, monospace', fontSize: 10, fill: 0xaaaaaa });
      t.anchor.set(0.5);
      stageItemTexts.push(t);
      hudContainer.addChild(t);
    }

    hudContainer.addChild(altText, velText, statusText, warpText, timeStrText, stageStrText, throtPctText);

    // Countdown overlay texts
    const cdText = new PIXI.Text('', { fontFamily: 'Courier New, monospace', fontSize: 56, fontWeight: 'bold', fill: 0xff4444 });
    cdText.anchor.set(0.5);
    const cdLabel = new PIXI.Text('IGNITION', { fontFamily: 'Courier New, monospace', fontSize: 12, fill: 0xff6666 });
    cdLabel.anchor.set(0.5);
    const landedLabel = new PIXI.Text('LANDING CONFIRMED', { fontFamily: 'Courier New, monospace', fontSize: 22, fontWeight: 'bold', fill: 0x44ff88 });
    landedLabel.anchor.set(0.5);
    const pauseLabel = new PIXI.Text('PAUSED', { fontFamily: 'Courier New, monospace', fontSize: 20, fontWeight: 'bold', fill: 0xffffff });
    pauseLabel.anchor.set(0.5);
    hudContainer.addChild(cdText, cdLabel, landedLabel, pauseLabel);

    // Initial state
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

    if (launchPendingRef.current) {
      launchPendingRef.current = false;
      Object.assign(simState, launchMission(simState));
    }

    // Pre-generate star positions (static, never change)
    const stars: { x: number; y: number; s: number; a: number; l: number }[] = [];
    for (let i = 0; i < 200; i++) {
      const seed = i * 137.508;
      stars.push({
        x: ((seed * 7.13) % 2000 - 1000) * 800,
        y: ((seed * 11.71) % 2000 - 1000) * 800,
        s: 0.3 + ((seed * 3.17) % 1) * 2.5,
        a: 0.2 + ((seed * 2.71) % 1) * 0.6,
        l: 0.00003 + ((seed * 1.37) % 1) * 0.0003,
      });
    }

    // Crater data (static)
    const craters = [
      { a: 0.3, d: 0.35, s: 0.14 }, { a: 1.1, d: 0.5, s: 0.18 }, { a: 2.0, d: 0.25, s: 0.1 },
      { a: 2.8, d: 0.55, s: 0.2 }, { a: 3.5, d: 0.4, s: 0.12 }, { a: 4.2, d: 0.3, s: 0.16 },
      { a: 5.0, d: 0.45, s: 0.15 }, { a: 5.8, d: 0.2, s: 0.09 },
    ];

    const handleResize = () => {
      if (!parent) return;
      app.renderer.resize(parent.clientWidth, parent.clientHeight);
    };
    window.addEventListener('resize', handleResize);

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

      // --- STARS ---
      starGfx.clear();
      for (const st of stars) {
        const px = st.x - camX * st.l;
        const py = st.y - camY * st.l;
        const ss = worldToScreen(px, py, 0, 0, 1, aw, ah);
        if (ss.x < -5 || ss.x > aw + 5 || ss.y < -5 || ss.y > ah + 5) continue;
        const twinkle = 0.5 + 0.5 * Math.sin(timeRef.current * (2 + (st.s % 3)) + st.s);
        starGfx.beginFill(0xffffff, st.a * twinkle);
        starGfx.drawCircle(ss.x, ss.y, Math.max(st.s, 0.3));
        starGfx.endFill();
      }

      // --- GROUND ---
      groundGfx.clear();
      if (!s.mapView) {
        const groundScreen = worldToScreen(0, -EARTH_RADIUS, camX, camY, zoom, aw, ah);
        const horizonScreen = worldToScreen(0, 0, camX, camY, zoom, aw, ah);

        if (groundScreen.y > -50 && groundScreen.y < ah + 200) {
          // Sky gradient
          const horizonY = Math.min(horizonScreen.y, ah);
          if (horizonY > 0) {
            const steps = 15;
            for (let i = 0; i < steps; i++) {
              const t = i / steps;
              const y1 = horizonY * t;
              const y2 = horizonY * (t + 1 / steps);
              const alt = 1 - t;
              const cr = Math.floor(8 + alt * 15);
              const cg = Math.floor(15 + alt * 40);
              const cb = Math.floor(50 + alt * 100);
              groundGfx.beginFill((cr << 16) | (cg << 8) | cb);
              groundGfx.drawRect(0, y1, aw, y2 - y1 + 1);
              groundGfx.endFill();
            }
          }

          // Dirt layers
          if (groundScreen.y < ah) {
            const dirtTop = Math.max(0, groundScreen.y);
            const dirtBot = ah;
            for (let i = 0; i < 8; i++) {
              const t = i / 8;
              const y1 = dirtTop + (dirtBot - dirtTop) * t;
              const y2 = dirtTop + (dirtBot - dirtTop) * (t + 1 / 8);
              const depth = t;
              const cr = Math.floor(55 + depth * 35);
              const cg = Math.floor(90 - depth * 25);
              const cb = Math.floor(35 - depth * 15);
              groundGfx.beginFill((cr << 16) | (cg << 8) | cb);
              groundGfx.drawRect(0, y1, aw, y2 - y1 + 1);
              groundGfx.endFill();
            }

            // Grass
            const grassCount = Math.min(200, Math.floor(aw / 3));
            for (let i = 0; i < grassCount; i++) {
              const x = (i / grassCount) * aw;
              const gh = 3 + Math.sin(i * 7.3 + timeRef.current * 2.5) * 3 + Math.sin(i * 13.1) * 2;
              const shade = 0.3 + Math.abs(Math.sin(i * 3.7)) * 0.4;
              const cr = Math.floor(shade * 35);
              const cg = Math.floor(110 + shade * 70);
              const cb = Math.floor(shade * 25);
              groundGfx.lineStyle(1.5, (cr << 16) | (cg << 8) | cb, 0.85);
              const sway = Math.sin(timeRef.current * 2 + i * 0.4) * 1.5;
              groundGfx.moveTo(x, dirtTop);
              groundGfx.lineTo(x + sway, dirtTop - gh);
            }
          }
        }
      }

      // --- EARTH ---
      earthGfx.clear();
      {
        const s2 = worldToScreen(0, 0, camX, camY, zoom, aw, ah);
        const radius = EARTH_RADIUS * PX_PER_M * zoom;
        if (radius > 2) {
          earthGfx.beginFill(0x4488cc, 0.025); earthGfx.drawCircle(s2.x, s2.y, radius * 1.4); earthGfx.endFill();
          earthGfx.beginFill(0x4488cc, 0.05); earthGfx.drawCircle(s2.x, s2.y, radius * 1.2); earthGfx.endFill();
          earthGfx.beginFill(0x1a6b9e); earthGfx.drawCircle(s2.x, s2.y, radius); earthGfx.endFill();
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const d = radius * (0.25 + 0.35 * ((i * 7.13) % 1));
            const pr = radius * (0.08 + 0.12 * ((i * 3.71) % 1));
            earthGfx.beginFill(0x2d8c5e, 0.55);
            earthGfx.drawCircle(s2.x + Math.cos(a) * d, s2.y + Math.sin(a) * d, pr);
            earthGfx.endFill();
          }
        }
      }

      // --- ORBIT ---
      orbitGfx.clear();
      {
        orbitGfx.lineStyle(1, 0x224466, 0.15);
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const a2 = ((i + 1) / 64) * Math.PI * 2;
          const p1 = worldToScreen(Math.cos(a) * MOON_ORBIT_R, Math.sin(a) * MOON_ORBIT_R, camX, camY, zoom, aw, ah);
          const p2 = worldToScreen(Math.cos(a2) * MOON_ORBIT_R, Math.sin(a2) * MOON_ORBIT_R, camX, camY, zoom, aw, ah);
          if (p1.x > -50 && p1.x < aw + 50 && p1.y > -50 && p1.y < ah + 50) {
            orbitGfx.moveTo(p1.x, p1.y);
            orbitGfx.lineTo(p2.x, p2.y);
          }
        }
      }

      // --- MOON ---
      moonGfx.clear();
      {
        const ms = worldToScreen(s.moon.x, s.moon.y, camX, camY, zoom, aw, ah);
        const mr = MOON_RADIUS * PX_PER_M * zoom;
        if (mr > 2) {
          moonGfx.beginFill(0x888888); moonGfx.drawCircle(ms.x, ms.y, mr); moonGfx.endFill();
          for (const c of craters) {
            const cx = ms.x + Math.cos(c.a) * mr * c.d;
            const cy = ms.y + Math.sin(c.a) * mr * c.d;
            const cr = mr * c.s;
            moonGfx.beginFill(0x666666, 0.5); moonGfx.drawCircle(cx, cy, cr); moonGfx.endFill();
            moonGfx.beginFill(0x777777, 0.3); moonGfx.drawCircle(cx - cr * 0.2, cy - cr * 0.15, cr * 0.6); moonGfx.endFill();
          }
        }
      }

      // --- ROCKET ---
      rocketGfx.clear();
      if (r.active) {
        const rs = worldToScreen(r.x, r.y, camX, camY, zoom, aw, ah);
        const scale = PX_PER_M * zoom;
        const len = Math.max(50, 90 * Math.max(scale, 0.2));
        const wd = Math.max(12, 18 * Math.max(scale, 0.2));
        const cosA = Math.cos(Math.PI / 2 - r.angle);
        const sinA = Math.sin(Math.PI / 2 - r.angle);
        const noseH = len * 0.3;
        const bodyLen = len * 0.7;
        const hw = wd / 2;
        const hl = bodyLen / 2;
        const stageColors = [0xcc3333, 0xdddddd, 0x3366cc];
        const bandColors = [0x992222, 0xbbbbbb, 0x2244aa];
        const frac = 1 / r.totalStages;

        for (let i = 0; i < r.totalStages; i++) {
          const top = -hl + bodyLen * i * frac;
          const bot = -hl + bodyLen * (i + 1) * frac;
          const col = stageColors[i % 3];
          const pts = [
            { x: -hw, y: top }, { x: hw, y: top }, { x: hw, y: bot }, { x: -hw, y: bot },
          ].map((p) => ({ x: rs.x + p.x * cosA - p.y * sinA, y: rs.y + p.x * sinA + p.y * cosA }));
          rocketGfx.beginFill(col);
          rocketGfx.moveTo(pts[0].x, pts[0].y);
          pts.forEach((p) => rocketGfx.lineTo(p.x, p.y));
          rocketGfx.closePath();
          rocketGfx.endFill();
          if (i < r.totalStages - 1) {
            const bp = [
              { x: -hw, y: bot - 2 }, { x: hw, y: bot - 2 }, { x: hw, y: bot + 2 }, { x: -hw, y: bot + 2 },
            ].map((p) => ({ x: rs.x + p.x * cosA - p.y * sinA, y: rs.y + p.x * sinA + p.y * cosA }));
            rocketGfx.beginFill(bandColors[i % 3]);
            rocketGfx.moveTo(bp[0].x, bp[0].y);
            bp.forEach((p) => rocketGfx.lineTo(p.x, p.y));
            rocketGfx.closePath();
            rocketGfx.endFill();
          }
        }
        // Nose cone
        const nPts = [
          { x: 0, y: -hl - noseH }, { x: -hw, y: -hl }, { x: hw, y: -hl },
        ].map((p) => ({ x: rs.x + p.x * cosA - p.y * sinA, y: rs.y + p.x * sinA + p.y * cosA }));
        rocketGfx.beginFill(0xcc3333);
        rocketGfx.moveTo(nPts[0].x, nPts[0].y);
        nPts.forEach((p) => rocketGfx.lineTo(p.x, p.y));
        rocketGfx.closePath();
        rocketGfx.endFill();
        // Engine bell
        const btW = hw * 0.75;
        const bbW = hw * 1.25;
        const bellPts = [
          { x: -btW, y: hl }, { x: btW, y: hl }, { x: bbW, y: hl + len * 0.12 }, { x: -bbW, y: hl + len * 0.12 },
        ].map((p) => ({ x: rs.x + p.x * cosA - p.y * sinA, y: rs.y + p.x * sinA + p.y * cosA }));
        rocketGfx.beginFill(0x222222);
        rocketGfx.moveTo(bellPts[0].x, bellPts[0].y);
        bellPts.forEach((p) => rocketGfx.lineTo(p.x, p.y));
        rocketGfx.closePath();
        rocketGfx.endFill();
        // Nozzle
        const nzW = bbW * 0.65;
        const nzPts = [
          { x: -nzW, y: hl + len * 0.12 }, { x: nzW, y: hl + len * 0.12 },
          { x: nzW * 0.55, y: hl + len * 0.18 }, { x: -nzW * 0.55, y: hl + len * 0.18 },
        ].map((p) => ({ x: rs.x + p.x * cosA - p.y * sinA, y: rs.y + p.x * sinA + p.y * cosA }));
        rocketGfx.beginFill(0x111111);
        rocketGfx.moveTo(nzPts[0].x, nzPts[0].y);
        nzPts.forEach((p) => rocketGfx.lineTo(p.x, p.y));
        rocketGfx.closePath();
        rocketGfx.endFill();
      }

      // --- PARTICLES ---
      exhaustGfx.clear();
      smokeGfx.clear();
      {
        const scale = PX_PER_M * zoom;
        for (const p of s.exhaust) {
          const ps = worldToScreen(p.x, p.y, camX, camY, zoom, aw, ah);
          const sz = p.size * scale * 1.5;
          if (sz > 0.2 && p.alpha > 0.01) {
            exhaustGfx.beginFill(p.color, p.alpha);
            exhaustGfx.drawCircle(ps.x, ps.y, Math.max(sz, 0.4));
            exhaustGfx.endFill();
          }
        }
        for (const p of s.smoke) {
          const ps = worldToScreen(p.x, p.y, camX, camY, zoom, aw, ah);
          const sz = p.size * scale * 0.8;
          if (sz > 0.3 && p.alpha > 0.01) {
            smokeGfx.beginFill(0x888888, p.alpha * 0.4);
            smokeGfx.drawCircle(ps.x, ps.y, Math.max(sz, 0.8));
            smokeGfx.endFill();
          }
        }
      }

      // --- HUD ---
      hudGfx.clear();
      hudBgGfx.clear();
      stageBgGfx.clear();
      throttleBgGfx.clear();
      throttleFillGfx.clear();
      countdownGfx.clear();
      landedGfx.clear();
      pauseGfx.clear();

      // Top center
      altText.x = aw / 2;
      altText.y = 16;
      velText.x = aw / 2;
      velText.y = 44;
      altText.text = s.altitude < 10 ? `ALT: ${(s.altitude * 1000).toFixed(0)} m` : `ALT: ${s.altitude.toFixed(2)} km`;
      velText.text = `VEL: ${s.speed.toFixed(1)} m/s`;

      // Status bar
      statusText.x = aw / 2;
      statusText.y = ah - 36;
      statusText.text = s.phase.replace(/-/g, ' ').toUpperCase();
      hudGfx.beginFill(0x000000, 0.6);
      hudGfx.drawRoundedRect(aw / 2 - 70, ah - 52, 140, 30, 15);
      hudGfx.endFill();

      // Bottom left: warp + stage
      warpText.x = 20;
      warpText.y = ah - 50;
      warpText.text = `WARP: ${s.timeWarp}x`;

      timeStrText.x = aw - 160;
      timeStrText.y = 16;
      stageStrText.x = aw - 160;
      stageStrText.y = 34;
      const mins = Math.floor(s.time / 60);
      const secs = Math.floor(s.time % 60);
      timeStrText.text = `T+ ${mins}m ${String(secs).padStart(2, '0')}s`;
      stageStrText.text = `STAGE ${r.stage + 1}/${r.totalStages}`;

      // Staging stack
      stageBgGfx.beginFill(0x000000, 0.4);
      stageBgGfx.lineStyle(1, 0xffffff, 0.2);
      stageBgGfx.drawRoundedRect(16, ah - 200, 120, 140, 4);
      stageBgGfx.endFill();
      const stageItems = ['Capsule', 'Separator', 'Engine', 'Fuel Tank'];
      for (let i = 0; i < stageItems.length && i < stageItemTexts.length; i++) {
        const isActive = i === 2;
        stageBgGfx.beginFill(isActive ? 0x4a9eff : 0xffffff, isActive ? 0.3 : 0.1);
        if (isActive) stageBgGfx.lineStyle(1, 0x4a9eff, 0.8);
        else stageBgGfx.lineStyle(0);
        stageBgGfx.drawRoundedRect(20, ah - 190 + i * 34, 112, 28, 2);
        stageBgGfx.endFill();
        stageItemTexts[i].text = stageItems[i].toUpperCase();
        stageItemTexts[i].x = 76;
        stageItemTexts[i].y = ah - 176 + i * 34;
        stageItemTexts[i].style.fill = isActive ? 0x4a9eff : 0xaaaaaa;
      }

      // Throttle bar
      throttleBgGfx.beginFill(0x000000, 0.4);
      throttleBgGfx.lineStyle(1, 0xffffff, 0.1);
      throttleBgGfx.drawRoundedRect(aw - 70, ah - 240, 50, 220, 8);
      throttleBgGfx.endFill();
      const barInnerW = 30;
      const barInnerH = 160;
      const barInnerX = aw - 60;
      const barInnerY = ah - 220;
      throttleFillGfx.beginFill(0x222233);
      throttleFillGfx.drawRoundedRect(barInnerX, barInnerY, barInnerW, barInnerH, 10);
      throttleFillGfx.endFill();
      const fillH = barInnerH * r.throttle;
      const fillCol = r.throttle > 0.5 ? 0xff6600 : 0x4a9eff;
      throttleFillGfx.beginFill(fillCol, 0.9);
      throttleFillGfx.drawRoundedRect(barInnerX, barInnerY + barInnerH - fillH, barInnerW, fillH, 10);
      throttleFillGfx.endFill();
      throtPctText.text = `${(r.throttle * 100).toFixed(0)}%`;
      throtPctText.x = aw - 45;
      throtPctText.y = ah - 14;

      // Countdown overlay
      countdownGfx.clear();
      if (s.phase === 'countdown') {
        const cd = Math.ceil(5 - s.phaseTimer);
        countdownGfx.beginFill(0x000000, 0.5);
        countdownGfx.drawRoundedRect(aw / 2 - 60, ah / 2 - 50, 120, 100, 8);
        countdownGfx.endFill();
        cdText.text = `${cd}`;
        cdText.x = aw / 2;
        cdText.y = ah / 2 - 10;
        cdText.visible = true;
        cdLabel.x = aw / 2;
        cdLabel.y = ah / 2 + 30;
        cdLabel.visible = true;
      } else {
        cdText.visible = false;
        cdLabel.visible = false;
      }

      // Landed overlay
      if (s.phase === 'landed') {
        landedGfx.beginFill(0x000000, 0.6);
        landedGfx.drawRoundedRect(aw / 2 - 160, ah / 2 - 30, 320, 60, 8);
        landedGfx.endFill();
        landedLabel.x = aw / 2;
        landedLabel.y = ah / 2;
        landedLabel.visible = true;
      } else {
        landedLabel.visible = false;
      }

      // Pause overlay
      if (s.paused && s.phase !== 'briefing' && s.phase !== 'landed') {
        pauseGfx.beginFill(0x000000, 0.5);
        pauseGfx.drawRoundedRect(aw / 2 - 50, ah / 2 - 20, 100, 40, 8);
        pauseGfx.endFill();
        pauseLabel.x = aw / 2;
        pauseLabel.y = ah / 2;
        pauseLabel.visible = true;
      } else {
        pauseLabel.visible = false;
      }
    });

    appRef.current = app;

    return () => {
      window.removeEventListener('resize', handleResize);
      app.destroy(true, { children: true });
      appRef.current = null;
      stateRef.current = null;
    };
  }, [showBriefing, autoMode, game]);

  useEffect(() => {
    if (showBriefing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (!s) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (s.phase === 'briefing') Object.assign(s, launchMission(s));
        else if (!e.repeat) Object.assign(s, togglePause(s));
        return;
      }
      if (e.repeat) return;

      if (e.code === 'Comma' || e.key === '<') {
        e.preventDefault();
        Object.assign(s, setTimeWarp(s, -1));
        return;
      }
      if (e.code === 'Period' || e.key === '>') {
        e.preventDefault();
        Object.assign(s, setTimeWarp(s, 1));
        return;
      }
      if (e.code === 'KeyW') {
        Object.assign(s, setTimeWarp(s, 1));
        return;
      }
      if (e.code === 'KeyM') {
        Object.assign(s, toggleMapView(s));
        return;
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        Object.assign(s, adjustZoom(s, -1));
        return;
      }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        Object.assign(s, adjustZoom(s, 1));
        return;
      }
      if (e.code === 'BracketLeft') {
        s.rocket.throttle = Math.max(0, s.rocket.throttle - 0.1);
        return;
      }
      if (e.code === 'BracketRight') {
        s.rocket.throttle = Math.min(1, s.rocket.throttle + 0.1);
        return;
      }
      if (e.code === 'Digit0' || e.code === 'Numpad0') {
        s.rocket.throttle = 0;
        return;
      }
      if (e.code === 'Digit9' || e.code === 'Numpad9') {
        s.rocket.throttle = 1;
        return;
      }
      if (e.code === 'Escape' && s.phase !== 'briefing' && s.phase !== 'landed') {
        s.paused = true;
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
              <input type="checkbox" checked={autoMode} onChange={(e) => setAutoMode(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#4a9eff' }} />
              Fully Automatic Mission
            </label>
          </div>
          <h3 style={{ color: '#4a9eff', textTransform: 'uppercase', marginBottom: 10 }}>System Controls</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left', opacity: 0.8, marginBottom: 30, fontSize: 14 }}>
            <div><strong>, / .</strong> : Adjust Time Warp</div>
            <div><strong>- / +</strong> : Manual Zoom Camera</div>
            <div><strong>M</strong> : Toggle Map Mode</div>
            <div><strong>[ / ]</strong> : Throttle Control</div>
            <div><strong>W</strong> : Cycle Time Warp Up</div>
            <div><strong>Space</strong> : Pause / Resume</div>
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
