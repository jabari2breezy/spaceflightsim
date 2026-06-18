import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { CelestiaGame } from '../../core/game';
import {
  createInitialState, updateSimulation, togglePause, changeTimeWarp,
  toggleMapView, adjustZoom, setThrottle, startMission,
  SimState, EARTH_RADIUS, MOON_RADIUS,
} from '../../simulation/Simulation';

interface FlightViewProps {
  game: CelestiaGame;
  autoMode: boolean;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  color: { r: number; g: number; b: number };
}

const FlightView: React.FC<FlightViewProps> = ({ game, autoMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const stateRef = useRef<SimState | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const smokeRef = useRef<Particle[]>([]);
  const starsRef = useRef<{ x: number; y: number; layer: number; size: number; alpha: number }[]>([]);
  const grassRef = useRef<{ x: number; h: number; color: number }[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const timeRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const parent = canvas.parentElement || document.body;

    const w = parent.clientWidth;
    const h = parent.clientHeight;

    const app = new PIXI.Application({
      width: w, height: h,
      backgroundColor: 0x03050f,
      view: canvas,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    const starContainer = new PIXI.Container();
    const systemContainer = new PIXI.Container();
    const particleContainer = new PIXI.Container();
    const hudContainer = new PIXI.Container();
    app.stage.addChild(starContainer, systemContainer, particleContainer, hudContainer);

    // Init stars (parallax)
    const stars: { x: number; y: number; layer: number; size: number; alpha: number }[] = [];
    for (let i = 0; i < 500; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 3000,
        y: (Math.random() - 0.5) * 3000,
        layer: Math.floor(Math.random() * 3),
        size: 0.3 + Math.random() * 1.5,
        alpha: 0.2 + Math.random() * 0.8,
      });
    }
    starsRef.current = stars;

    const spacecraft = game.getSpacecraft();
    const mass = spacecraft ? spacecraft.mass : 18000;
    const thrust = game.getSpacecraftThrust() || 1800000;
    const isp = 320;
    const stages = spacecraft ? spacecraft.stages.length : 2;

    let simState = createInitialState(mass, thrust, isp, stages, autoMode);
    stateRef.current = simState;

    timeRef.current = 0;

    // HUD text objects (reused)
    const altText = new PIXI.Text('ALT: 0.0', {
      fontFamily: 'Courier New', fontSize: 14, fill: 0xffffff,
    });
    const velText = new PIXI.Text('SPD: 0', {
      fontFamily: 'Courier New', fontSize: 14, fill: 0x88ddff,
    });
    const phaseText = new PIXI.Text('STANDBY', {
      fontFamily: 'Courier New', fontSize: 11, fontWeight: 'bold', fill: 0x4a9eff,
    });
    const warpText = new PIXI.Text('1x', {
      fontFamily: 'Courier New', fontSize: 11, fill: 0x88ddff,
    });
    const fuelText = new PIXI.Text('FUEL', {
      fontFamily: 'Courier New', fontSize: 9, fill: 0xffffff,
    });

    // Grid overlay
    const gridG = new PIXI.Graphics();
    const gridTexture = (() => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillRect(32, 0, 1, 64);
      ctx.fillRect(0, 32, 64, 1);
      return PIXI.Texture.from(c);
    })();
    const gridSprite = new PIXI.TilingSprite(gridTexture, w, h);

    const handleResize = () => {
      const nw = parent.clientWidth;
      const nh = parent.clientHeight;
      app.renderer.resize(nw, nh);
      gridSprite.width = nw;
      gridSprite.height = nh;
    };
    window.addEventListener('resize', handleResize);

    // Tick grass generation around Earth
    function generateGrass() {
      const g: { x: number; h: number; color: number }[] = [];
      for (let a = 0; a < Math.PI * 2; a += 0.02) {
        const angle = a + (Math.random() - 0.5) * 0.02;
        const noise = Math.sin(angle * 8) * 0.3 + Math.sin(angle * 3) * 0.2;
        const h = 2 + noise + Math.random() * 1.5;
        const green = 60 + Math.floor(noise * 30) + Math.floor(Math.random() * 20);
        g.push({ x: angle, h, color: green });
      }
      return g;
    }
    grassRef.current = generateGrass();

    app.ticker.add(() => {
      const dt = Math.min(app.ticker.deltaMS / 1000, 0.05);
      timeRef.current += dt;

      simState = updateSimulation(simState, dt);
      stateRef.current = simState;

      const r = simState.rocket;
      const cw = app.renderer.width / (window.devicePixelRatio || 1);
      const ch = app.renderer.height / (window.devicePixelRatio || 1);
      const zoom = simState.mapView ? 0.6 : simState.zoom;

      // Camera
      let camX: number, camY: number;
      if (simState.mapView) {
        camX = (simState.earth.x + simState.moon.x) / 2;
        camY = (simState.earth.y + simState.moon.y) / 2 - 20;
      } else {
        camX = r.x;
        camY = r.y;
      }

      function toScreen(wx: number, wy: number) {
        return {
          x: (wx - camX) * zoom + cw / 2,
          y: -(wy - camY) * zoom + ch / 2,
        };
      }

      // === STARS ===
      starContainer.removeChildren();
      const starG = new PIXI.Graphics();
      stars.forEach((st) => {
        const parallaxFactor = 0.05 * (st.layer + 1) / zoom;
        const sx = ((st.x + camX * parallaxFactor) % 3000 + 3000) % 3000 - 1500;
        const sy = ((st.y + camY * parallaxFactor * 0.6) % 3000 + 3000) % 3000 - 1500;
        const ss = toScreen(sx, sy);
        if (ss.x > -10 && ss.x < cw + 10 && ss.y > -10 && ss.y < ch + 10) {
          starG.beginFill(0xffffff, st.alpha * (0.7 + Math.sin(timeRef.current * (1 + st.layer) + st.x) * 0.3));
          starG.drawCircle(ss.x, ss.y, Math.max(st.size * (1 / Math.max(zoom, 0.3)), 0.4));
          starG.endFill();
        }
      });
      starContainer.addChild(starG);

      // === SYSTEM RENDERING ===
      systemContainer.removeChildren();
      const sg = new PIXI.Graphics();

      const earthS = toScreen(0, 0);
      const moonS = toScreen(simState.moon.x, simState.moon.y);

      // Orbit path
      const orbitPts: { x: number; y: number }[] = [];
      const moonOrbitR = dist(simState.moon.x, simState.moon.y, 0, 0);
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const px = Math.cos(a) * moonOrbitR;
        const py = Math.sin(a) * moonOrbitR;
        orbitPts.push({ x: px, y: py });
      }
      sg.lineStyle(0.5, 0x224466, 0.15);
      for (let i = 0; i < orbitPts.length - 1; i++) {
        const p1 = toScreen(orbitPts[i].x, orbitPts[i].y);
        const p2 = toScreen(orbitPts[i + 1].x, orbitPts[i + 1].y);
        sg.moveTo(p1.x, p1.y);
        sg.lineTo(p2.x, p2.y);
      }

      // Earth atmosphere glow
      const earthScreenR = EARTH_RADIUS * zoom;
      if (earthScreenR < cw * 3) {
        const gradGlow = earthScreenR * 1.2;
        sg.beginFill(0x224488, 0.04);
        sg.drawCircle(earthS.x, earthS.y, Math.max(gradGlow, 2));
        sg.endFill();
        sg.beginFill(0x4488cc, 0.06);
        sg.drawCircle(earthS.x, earthS.y, Math.max(earthScreenR * 1.05, 2));
        sg.endFill();
      }

      // Earth body
      if (earthScreenR > 1) {
        sg.beginFill(0x1a6b9e);
        sg.drawCircle(earthS.x, earthS.y, Math.max(earthScreenR, 2));
        sg.endFill();

        // Land masses (procedural blobs)
        for (let i = 0; i < 12; i++) {
          const a = i * 2.1 + 0.5;
          const landR = earthScreenR * (0.4 + Math.sin(i * 3.7) * 0.3);
          const lx = earthS.x + Math.cos(a) * earthScreenR * 0.55;
          const ly = earthS.y - Math.sin(a) * earthScreenR * 0.3;
          sg.beginFill(0x2d8c5e, 0.7);
          sg.drawCircle(lx, ly, Math.max(Math.abs(landR * 0.3), 2));
          sg.endFill();
          const lx2 = earthS.x + Math.cos(a + 1.2) * earthScreenR * 0.4;
          const ly2 = earthS.y - Math.sin(a + 1.2) * earthScreenR * 0.2;
          sg.beginFill(0x3a9d6e, 0.5);
          sg.drawCircle(lx2, ly2, Math.max(Math.abs(landR * 0.2), 1));
          sg.endFill();
        }

        // Ground surface (grass)
        const groundY = earthS.y - Math.max(earthScreenR, 2);
        const grassWidth = Math.min(cw * 2, earthScreenR * 0.2);
        if (earthScreenR > 10) {
          grassRef.current.forEach((g) => {
            const gx = earthS.x + Math.cos(g.x) * (EARTH_RADIUS * 0.99) * zoom;
            const gy = earthS.y - Math.sin(g.x) * (EARTH_RADIUS * 0.99) * zoom;
            const gh = g.h * zoom * 0.5;
            const gw = 1.5 * zoom * 0.3;
            if (gx > -10 && gx < cw + 10 && gy > -10 && gy < ch + 10) {
              sg.beginFill(0x44aa44, 0.7);
              sg.drawRect(gx - gw / 2, gy - gh, gw, gh);
              sg.endFill();
              // Grass blade
              sg.lineStyle(0.5, 0x66dd66, 0.5);
              sg.moveTo(gx, gy);
              sg.lineTo(gx + (Math.random() - 0.5) * gw * 0.5, gy - gh - Math.random() * zoom * 0.3);
            }
          });
          // Brown dirt line at surface
          sg.lineStyle(2, 0x8B4513, 0.4);
          sg.drawCircle(earthS.x, earthS.y, Math.max(earthScreenR - 0.5, 1));
        }
      } else {
        sg.beginFill(0x1a6b9e);
        sg.drawCircle(earthS.x, earthS.y, 2);
        sg.endFill();
      }

      // Moon
      const moonScreenR = MOON_RADIUS * zoom;
      if (moonScreenR > 1) {
        sg.beginFill(0x999999);
        sg.drawCircle(moonS.x, moonS.y, Math.max(moonScreenR, 2));
        sg.endFill();

        // Moon craters
        for (let i = 0; i < 8; i++) {
          const a = i * 0.8 + 0.3;
          const craterR = moonScreenR * (0.15 + Math.sin(i * 2.3) * 0.08);
          const cx = moonS.x + Math.cos(a) * moonScreenR * 0.5;
          const cy = moonS.y - Math.sin(a) * moonScreenR * 0.4;
          sg.beginFill(0x777777, 0.5);
          sg.drawCircle(cx, cy, Math.max(Math.abs(craterR), 1));
          sg.endFill();
          sg.beginFill(0xaaaaaa, 0.2);
          sg.drawCircle(cx + craterR * 0.2, cy - craterR * 0.2, Math.max(craterR * 0.3, 0.5));
          sg.endFill();
        }

        // Moon surface glow
        sg.beginFill(0x8888aa, 0.03);
        sg.drawCircle(moonS.x, moonS.y, Math.max(moonScreenR * 1.1, 2));
        sg.endFill();
      } else {
        sg.beginFill(0x999999);
        sg.drawCircle(moonS.x, moonS.y, 2);
        sg.endFill();
      }

      // Trajectory trail
      // (simple tail behind rocket)
      // Skip for now

      // === ROCKET ===
      if (!simState.landed && !simState.crashed) {
        drawRocket(sg, r.x, r.y, r.angle, zoom, cw, ch, camX, camY);
      }
      if (simState.landed && simState.moon) {
        const moonDist = Math.sqrt((r.x - simState.moon.x) ** 2 + (r.y - simState.moon.y) ** 2);
        if (moonDist < MOON_RADIUS + 10) {
          drawRocket(sg, r.x, r.y, r.angle + 0.1, zoom, cw, ch, camX, camY);
        }
      }

      systemContainer.addChild(sg);

      // === PARTICLES ===
      particleContainer.removeChildren();
      const pg = new PIXI.Graphics();

      // Spawn exhaust particles
      if (r.throttle > 0 && r.fuel > 0 && !simState.landed) {
        const ex = r.x - Math.cos(r.angle) * 8;
        const ey = r.y + Math.sin(r.angle) * 8;
        const count = Math.floor(8 * r.throttle);
        for (let i = 0; i < count; i++) {
          const spread = 2 * (1 - r.throttle * 0.5);
          const speed = 10 + Math.random() * 20 * r.throttle;
          const pAngle = r.angle + Math.PI + (Math.random() - 0.5) * spread;
          particlesRef.current.push({
            x: ex + (Math.random() - 0.5) * 2,
            y: ey + (Math.random() - 0.5) * 2,
            vx: Math.cos(pAngle) * speed + (Math.random() - 0.5) * 2,
            vy: -Math.sin(pAngle) * speed + (Math.random() - 0.5) * 2,
            life: 0.3 + Math.random() * 0.4,
            maxLife: 0.3 + Math.random() * 0.4,
            size: 2 + Math.random() * 4 * r.throttle,
            color: { r: 1, g: 0.4 + Math.random() * 0.3, b: 0 },
          });
        }
        // Smoke
        for (let i = 0; i < count * 0.5; i++) {
          const spread = 3;
          const speed = 2 + Math.random() * 4;
          const pAngle = r.angle + Math.PI + (Math.random() - 0.5) * spread;
          smokeRef.current.push({
            x: ex + (Math.random() - 0.5) * 4,
            y: ey + (Math.random() - 0.5) * 4,
            vx: Math.cos(pAngle) * speed * 0.3,
            vy: -Math.sin(pAngle) * speed * 0.3,
            life: 0.8 + Math.random() * 1.2,
            maxLife: 0.8 + Math.random() * 1.2,
            size: 3 + Math.random() * 8,
            color: { r: 0.4, g: 0.4, b: 0.4 },
          });
        }
      }

      // Update and draw particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.vy -= 2 * dt; // slight gravity on particles
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const ps = toScreen(p.x, p.y);
        const pLife = p.life / p.maxLife;
        const pSize = p.size * pLife * zoom;
        if (ps.x > -50 && ps.x < cw + 50 && ps.y > -50 && ps.y < ch + 50) {
          pg.beginFill(
            PIXI.utils.rgb2hex([p.color.r * pLife + 0.2 * (1 - pLife), p.color.g * pLife, p.color.b * pLife]),
            pLife * 0.8
          );
          pg.drawCircle(ps.x, ps.y, Math.max(pSize, 0.5));
          pg.endFill();
        }
      }

      // Draw smoke
      const smokes = smokeRef.current;
      for (let i = smokes.length - 1; i >= 0; i--) {
        const p = smokes[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += dt * 3;
        if (p.life <= 0) {
          smokes.splice(i, 1);
          continue;
        }
        const ps = toScreen(p.x, p.y);
        const pLife = p.life / p.maxLife;
        const pSize = p.size * (0.5 + pLife * 0.5) * zoom;
        if (ps.x > -50 && ps.x < cw + 50 && ps.y > -50 && ps.y < ch + 50) {
          pg.beginFill(0x888888, pLife * 0.3);
          pg.drawCircle(ps.x, ps.y, Math.max(pSize, 0.5));
          pg.endFill();
        }
      }

      particleContainer.addChild(pg);

      // === HUD ===
      hudContainer.removeChildren();
      const hud = new PIXI.Graphics();

      const alt = Math.max(0, Math.sqrt(r.x * r.x + r.y * r.y) - EARTH_RADIUS);
      const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);

      // Top-left telemetry
      const boxStyle = { background: 0x000000, alpha: 0.4, padding: 4 };

      hud.beginFill(0x000000, 0.4);
      hud.drawRoundedRect(8, 8, 200, 70, 4);
      hud.endFill();

      altText.text = `ALT: ${alt.toFixed(1)}`;
      altText.position.set(16, 10);
      hud.addChild(altText);

      velText.text = `SPD: ${speed.toFixed(0)} m/s`;
      velText.position.set(16, 30);
      hud.addChild(velText);

      phaseText.text = simState.phase === 'standby' ? 'STANDBY' : simState.phase.toUpperCase().replace(/-/g, ' ');
      phaseText.position.set(16, 50);
      hud.addChild(phaseText);

      // Time warp
      warpText.text = `WARP: ${simState.timeWarp}x`;
      warpText.position.set(cw - 100, 10);
      hud.addChild(warpText);

      // Throttle bar (right side)
      const barX = cw - 40;
      const barY = 60;
      const barW = 16;
      const barH = 140;
      hud.beginFill(0x111122, 0.7);
      hud.drawRoundedRect(barX, barY, barW, barH, 4);
      hud.endFill();
      const fillH = barH * r.throttle;
      const fillColor = r.throttle > 0.7 ? 0xff6600 : r.throttle > 0.3 ? 0x44aaff : 0x4488ff;
      hud.beginFill(fillColor, 0.8);
      hud.drawRoundedRect(barX + 1, barY + barH - fillH + 1, barW - 2, fillH - 2, 3);
      hud.endFill();

      const throtLabel = new PIXI.Text(`${(r.throttle * 100).toFixed(0)}%`, {
        fontFamily: 'Courier New', fontSize: 9, fill: 0xffffff,
      });
      throtLabel.position.set(barX - 4, barY + barH + 2);
      hud.addChild(throtLabel);

      // Fuel bar
      const fuelBarX = cw - 40;
      const fuelBarY = 220;
      const fuelBarH = 50;
      hud.beginFill(0x111122, 0.7);
      hud.drawRoundedRect(fuelBarX, fuelBarY, barW, fuelBarH, 4);
      hud.endFill();
      const fuelPct = r.maxFuel > 0 ? r.fuel / r.maxFuel : 0;
      hud.beginFill(0xffcc00, 0.8);
      hud.drawRoundedRect(fuelBarX + 1, fuelBarY + fuelBarH - fuelBarH * fuelPct + 1, barW - 2, fuelBarH * fuelPct - 2, 3);
      hud.endFill();

      fuelText.position.set(fuelBarX - 6, fuelBarY + fuelBarH + 2);
      hud.addChild(fuelText);

      // Stage indicator
      const stageHud = new PIXI.Text(`STG ${simState.stageIndex + 1}/${simState.totalStages}`, {
        fontFamily: 'Courier New', fontSize: 10, fill: 0x4a9eff,
      });
      stageHud.position.set(cw - 100, 28);
      hud.addChild(stageHud);

      // Mission time
      const t = Math.floor(simState.time);
      const mins = Math.floor(t / 60);
      const secs = t % 60;
      const timeHud = new PIXI.Text(`T+${mins}:${secs.toString().padStart(2, '0')}`, {
        fontFamily: 'Courier New', fontSize: 10, fill: 0x88ddff,
      });
      timeHud.position.set(cw - 100, 46);
      hud.addChild(timeHud);

      // Countdown overlay
      if (simState.phase === 'countdown') {
        const cd = Math.ceil(2 - simState.phaseTimer);
        if (cd > 0) {
          const cdText = new PIXI.Text(`${cd}`, {
            fontFamily: 'Courier New', fontSize: 64, fontWeight: 'bold', fill: 0xff4444,
          });
          cdText.anchor.set(0.5);
          cdText.position.set(cw / 2, ch / 2 - 20);
          hud.addChild(cdText);
        }
      }

      // Standby prompt
      if (simState.phase === 'standby') {
        const promptText = new PIXI.Text('[ SPACEBAR TO LAUNCH ]', {
          fontFamily: 'Courier New', fontSize: 16, fontWeight: 'bold',
          fill: 0x4a9eff, letterSpacing: 2,
        });
        promptText.anchor.set(0.5);
        promptText.position.set(cw / 2, ch / 2 + 40);
        promptText.alpha = 0.5 + Math.sin(timeRef.current * 3) * 0.5;
        hud.addChild(promptText);
      }

      // Touchdown message
      if (simState.phase === 'touchdown') {
        const msg = simState.crashed ? 'CRASHED' : '✓ LANDED SUCCESSFULLY';
        const color = simState.crashed ? 0xff4444 : 0x44ff88;
        const tdText = new PIXI.Text(msg, {
          fontFamily: 'Courier New', fontSize: 20, fontWeight: 'bold', fill: color,
        });
        tdText.anchor.set(0.5);
        tdText.position.set(cw / 2, ch / 2);
        hud.addChild(tdText);

        if (simState.landed) {
          const subText = new PIXI.Text('ON THE MOON', {
            fontFamily: 'Courier New', fontSize: 14, fill: 0x88ddff,
          });
          subText.anchor.set(0.5);
          subText.position.set(cw / 2, ch / 2 + 28);
          hud.addChild(subText);
        }
      }

      // Controls hint
      if (simState.phase === 'standby' || simState.phase === 'countdown') {
        const hintText = new PIXI.Text('<> warp  -+ zoom  M map', {
          fontFamily: 'Courier New', fontSize: 9, fill: 0x445566,
        });
        hintText.position.set(12, ch - 18);
        hud.addChild(hintText);
      }

      hudContainer.addChild(hud);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (!stateRef.current) return;
      const s = stateRef.current;

      if (e.key === ' ') {
        e.preventDefault();
        if (s.phase === 'standby') {
          stateRef.current = startMission(s);
        } else {
          stateRef.current = togglePause(s);
        }
      }
      if (e.key === '<' || e.key === ',') stateRef.current = changeTimeWarp(s, -1);
      if (e.key === '>' || e.key === '.') stateRef.current = changeTimeWarp(s, 1);
      if (e.key === 'm' || e.key === 'M') stateRef.current = toggleMapView(s);
      if (e.key === '-' || e.key === '_') stateRef.current = adjustZoom(s, -1);
      if (e.key === '=' || e.key === '+') stateRef.current = adjustZoom(s, 1);
      if (e.key === '[') stateRef.current = setThrottle(s, Math.max(0, s.rocket.throttle - 0.1));
      if (e.key === ']') stateRef.current = setThrottle(s, Math.min(1, s.rocket.throttle + 0.1));
      if (e.key === '0') stateRef.current = setThrottle(s, 0);
      if (e.key === '9') stateRef.current = setThrottle(s, 1);
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    appRef.current = app;

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      app.destroy(true, { children: true });
    };
  }, [game, autoMode]);

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
  );
};

function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function toScreenPoint(wx: number, wy: number, camX: number, camY: number, zoom: number, cw: number, ch: number) {
  return {
    x: (wx - camX) * zoom + cw / 2,
    y: -(wy - camY) * zoom + ch / 2,
  };
}

function drawRocket(
  g: PIXI.Graphics,
  rx: number, ry: number, angle: number,
  zoom: number, cw: number, ch: number,
  camX: number, camY: number,
) {
  const s = toScreenPoint(rx, ry, camX, camY, zoom, cw, ch);
  if (s.x < -100 || s.x > cw + 100 || s.y < -100 || s.y > ch + 100) return;

  const scale = zoom;
  const bodyLen = 22 * Math.max(scale, 0.3);
  const bodyW = 6 * Math.max(scale, 0.2);
  const noseH = bodyLen * 0.35;
  const finSize = bodyW * 0.6;

  const cosA = Math.cos(Math.PI / 2 - angle);
  const sinA = Math.sin(Math.PI / 2 - angle);
  const px = s.x;
  const py = s.y;

  // Body corners (rotated)
  function rot(x: number, y: number) {
    return {
      x: px + x * cosA - y * sinA,
      y: py + x * sinA + y * cosA,
    };
  }

  const hw = bodyW / 2;
  const hl = bodyLen / 2;

  const b1 = rot(-hw, -hl);
  const b2 = rot(hw, -hl);
  const b3 = rot(hw, hl);
  const b4 = rot(-hw, hl);

  // Nose tip
  const noseTip = rot(0, -hl - noseH);

  // Fins
  const finL = rot(-hw, hl - finSize * 0.5);
  const finR = rot(hw, hl - finSize * 0.5);
  const finLOut = rot(-hw - finSize, hl);
  const finROut = rot(hw + finSize, hl);

  // Body
  g.beginFill(0xccccdd);
  g.moveTo(b1.x, b1.y);
  g.lineTo(b2.x, b2.y);
  g.lineTo(b3.x, b3.y);
  g.lineTo(b4.x, b4.y);
  g.closePath();
  g.endFill();

  // Body stripe
  const stripeY = rot(0, hl - bodyLen * 0.3);
  const sw = hw + 0.5;
  const s1 = rot(-sw, hl - bodyLen * 0.3);
  const s2 = rot(sw, hl - bodyLen * 0.3);
  const s3 = rot(sw, hl - bodyLen * 0.3 + 2 * scale);
  const s4 = rot(-sw, hl - bodyLen * 0.3 + 2 * scale);
  g.beginFill(0x445566, 0.5);
  g.moveTo(s1.x, s1.y);
  g.lineTo(s2.x, s2.y);
  g.lineTo(s3.x, s3.y);
  g.lineTo(s4.x, s4.y);
  g.closePath();
  g.endFill();

  // Nose cone
  g.beginFill(0xdd3333);
  g.moveTo(noseTip.x, noseTip.y);
  g.lineTo(b1.x, b1.y);
  g.lineTo(b2.x, b2.y);
  g.closePath();
  g.endFill();

  // Fins
  g.beginFill(0x999999, 0.8);
  g.moveTo(b3.x, b3.y);
  g.lineTo(finLOut.x, finLOut.y);
  g.lineTo(finL.x, finL.y);
  g.closePath();
  g.endFill();

  g.beginFill(0x999999, 0.8);
  g.moveTo(b3.x, b3.y);
  g.lineTo(finROut.x, finROut.y);
  g.lineTo(finR.x, finR.y);
  g.closePath();
  g.endFill();

  // Engine bell
  if (scale > 0.5) {
    const bellW = hw * 1.5;
    const bellH = 4 * scale;
    const eb1 = rot(-bellW, hl);
    const eb2 = rot(bellW, hl);
    const eb3 = rot(bellW, hl + bellH);
    const eb4 = rot(-bellW, hl + bellH);
    g.beginFill(0x333333);
    g.moveTo(eb1.x, eb1.y);
    g.lineTo(eb2.x, eb2.y);
    g.lineTo(eb3.x, eb3.y);
    g.lineTo(eb4.x, eb4.y);
    g.closePath();
    g.endFill();
  }
}

export default FlightView;
