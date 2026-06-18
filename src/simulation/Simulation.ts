export const G = 6.67430e-11;
export const EARTH_MASS = 5.972e24;
export const EARTH_RADIUS = 6_371_000;
export const MOON_MASS = 7.34767309e22;
export const MOON_RADIUS = 1_737_000;
export const MOON_ORBIT_R = 384_400_000;
export const MOON_ORBIT_SPEED = Math.sqrt(G * EARTH_MASS / MOON_ORBIT_R);
export const ATMOSPHERE_ALT = 100_000;
export const LEO_ALT = 200_000;
export const TLI_DELTA_V = 3200;
export const LUNAR_INSERTION_DELTA_V = 800;
export const SURFACE_G = 9.81;

export interface SimBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
}

export interface SimRocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  mass: number;
  fuel: number;
  maxFuel: number;
  thrust: number;
  isp: number;
  stage: number;
  totalStages: number;
  active: boolean;
  throttle: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
  color: number;
}

export type MissionPhase =
  | 'briefing'
  | 'countdown'
  | 'ignition'
  | 'lift-off'
  | 'gravity-turn'
  | 'max-q'
  | 'atmosphere-exit'
  | 'meco'
  | 'orbit-insertion'
  | 'coast-to-tli'
  | 'tli-burn'
  | 'trans-lunar-coast'
  | 'lunar-insertion'
  | 'lunar-orbit'
  | 'deorbit-burn'
  | 'powered-descent'
  | 'landing'
  | 'landed';

export interface SimState {
  rocket: SimRocket;
  earth: SimBody;
  moon: SimBody;
  time: number;
  simTime: number;
  dt: number;
  timeWarp: number;
  phase: MissionPhase;
  phaseTimer: number;
  altitude: number;
  speed: number;
  paused: boolean;
  mapView: boolean;
  zoom: number;
  smoke: Particle[];
  exhaust: Particle[];
  autoMode: boolean;
  launched: boolean;
}

function gravityAccel(x: number, y: number, body: SimBody): { ax: number; ay: number } {
  const dx = body.x - x;
  const dy = body.y - y;
  const d2 = dx * dx + dy * dy;
  const d = Math.sqrt(d2);
  if (d < body.radius * 0.99) return { ax: 0, ay: 0 };
  const a = G * body.mass / d2;
  return { ax: a * dx / d, ay: a * dy / d };
}

function addSmoke(s: SimState, x: number, y: number, angle: number, throttle: number): void {
  if (throttle <= 0 || s.smoke.length > 300) return;
  const count = Math.floor(throttle * 3);
  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * 0.5;
    const speed = 20 + Math.random() * 40;
    s.smoke.push({
      x: x - Math.cos(angle) * 5 + (Math.random() - 0.5) * 4,
      y: y + Math.sin(angle) * 5 + (Math.random() - 0.5) * 4,
      vx: -Math.cos(angle) * speed * throttle + spread,
      vy: Math.sin(angle) * speed * throttle + spread,
      life: 1.5 + Math.random() * 2,
      maxLife: 1.5 + Math.random() * 2,
      size: 6 + Math.random() * 10,
      alpha: 0.6 + Math.random() * 0.4,
      color: throttle > 0.7 ? 0xffaa33 : 0x888888,
    });
  }
}

function addExhaust(s: SimState, x: number, y: number, angle: number, throttle: number): void {
  if (throttle <= 0 || s.exhaust.length > 500) return;
  const count = Math.floor(throttle * 4);
  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * 0.8;
    const speed = 60 + Math.random() * 100;
    s.exhaust.push({
      x: x - Math.cos(angle) * 3,
      y: y + Math.sin(angle) * 3,
      vx: -Math.cos(angle) * speed * throttle + spread,
      vy: Math.sin(angle) * speed * throttle + spread,
      life: 0.15 + Math.random() * 0.25,
      maxLife: 0.15 + Math.random() * 0.25,
      size: 2 + Math.random() * 4,
      alpha: 0.9,
      color: Math.random() > 0.5 ? 0xffcc00 : 0xff6600,
    });
  }
}

function updateParticles(particles: Particle[], dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.alpha = Math.max(0, (p.life / p.maxLife) * 0.6);
    p.size *= 1.02;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function createInitialState(rocketMass: number, thrustN: number, isp: number, totalStages: number): SimState {
  const startY = -(EARTH_RADIUS + 0.5);
  return {
    rocket: {
      x: 0,
      y: startY,
      vx: 0,
      vy: 0,
      angle: Math.PI / 2,
      mass: rocketMass,
      fuel: rocketMass * 0.55,
      maxFuel: rocketMass * 0.55,
      thrust: thrustN,
      isp,
      stage: 0,
      totalStages,
      active: true,
      throttle: 0,
    },
    earth: {
      x: 0, y: 0, vx: 0, vy: 0,
      mass: EARTH_MASS, radius: EARTH_RADIUS,
    },
    moon: {
      x: MOON_ORBIT_R, y: 0, vx: 0, vy: MOON_ORBIT_SPEED,
      mass: MOON_MASS, radius: MOON_RADIUS,
    },
    time: 0,
    simTime: 0,
    dt: 1 / 60,
    timeWarp: 1,
    phase: 'briefing',
    phaseTimer: 0,
    altitude: 0,
    speed: 0,
    paused: true,
    mapView: false,
    zoom: 1,
    smoke: [],
    exhaust: [],
    autoMode: true,
    launched: false,
  };
}

function executeAutoPilot(s: SimState): MissionPhase {
  const r = s.rocket;
  const altKm = s.altitude;
  const alt = s.altitude * 1000;

  switch (s.phase) {
    case 'briefing':
      r.throttle = 0;
      r.angle = Math.PI / 2;
      return 'briefing';

    case 'countdown':
      r.throttle = 0;
      r.angle = Math.PI / 2;
      if (s.phaseTimer >= 5) return 'ignition';
      return 'countdown';

    case 'ignition':
      r.throttle = 0.3;
      r.angle = Math.PI / 2;
      if (s.phaseTimer >= 0.5) return 'lift-off';
      return 'ignition';

    case 'lift-off':
      r.throttle = 1;
      r.angle = Math.PI / 2;
      if (altKm > 0.5) return 'gravity-turn';
      return 'lift-off';

    case 'gravity-turn':
      r.throttle = 1;
      {
        const turnProgress = Math.min(1, altKm / 60000);
        r.angle = Math.PI / 2 - turnProgress * 0.6;
        if (r.angle < Math.PI / 4) r.angle = Math.PI / 4;
      }
      if (altKm > 40000) return 'max-q';
      return 'gravity-turn';

    case 'max-q':
      r.throttle = 0.8;
      {
        const turnProgress = Math.min(1, altKm / 80000);
        r.angle = Math.PI / 2 - turnProgress * 0.7;
        if (r.angle < Math.PI / 6) r.angle = Math.PI / 6;
      }
      if (altKm > 80000) return 'atmosphere-exit';
      return 'max-q';

    case 'atmosphere-exit':
      r.throttle = 1;
      {
        const turnProgress = Math.min(1, (altKm - 80000) / 40000);
        r.angle = Math.PI / 3 - turnProgress * 0.3;
        if (r.angle < 0) r.angle = 0;
      }
      if (r.fuel < 0.05) return 'meco';
      if (altKm > 120 && Math.abs(r.angle) < 0.1) return 'orbit-insertion';
      return 'atmosphere-exit';

    case 'meco':
      r.throttle = 0;
      return 'meco';

    case 'orbit-insertion':
      r.throttle = r.fuel > 0.05 ? 1 : 0;
      r.angle = 0;
      if (altKm > LEO_ALT / 1000 && r.fuel < 0.05) return 'coast-to-tli';
      if (altKm > LEO_ALT / 1000) return 'coast-to-tli';
      return 'orbit-insertion';

    case 'coast-to-tli':
      r.throttle = 0;
      r.angle = 0;
      {
        const moonAngle = Math.atan2(s.moon.y, s.moon.x);
        const rocketAngle = Math.atan2(r.y, r.x);
        const angleDiff = Math.abs(moonAngle - rocketAngle);
        if (angleDiff < 0.3 || angleDiff > Math.PI * 2 - 0.3) {
          return 'tli-burn';
        }
      }
      return 'coast-to-tli';

    case 'tli-burn':
      r.throttle = 1;
      {
        const toMoon = Math.atan2(s.moon.y - r.y, s.moon.x - r.x);
        r.angle = toMoon;
      }
      if (r.fuel < 0.02) return 'trans-lunar-coast';
      {
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        if (moonDist < MOON_RADIUS * 5) return 'lunar-insertion';
      }
      return 'tli-burn';

    case 'trans-lunar-coast':
      r.throttle = 0;
      {
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        if (moonDist < MOON_RADIUS * 3) return 'lunar-insertion';
      }
      return 'trans-lunar-coast';

    case 'lunar-insertion':
      r.throttle = 1;
      {
        const toMoon = Math.atan2(s.moon.y - r.y, s.moon.x - r.x);
        r.angle = toMoon + Math.PI;
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        if (moonDist < MOON_RADIUS * 1.5) return 'lunar-orbit';
        if (r.fuel < 0.02) return 'lunar-orbit';
      }
      return 'lunar-insertion';

    case 'lunar-orbit':
      r.throttle = 0;
      {
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        if (s.phaseTimer > 2) return 'deorbit-burn';
      }
      return 'lunar-orbit';

    case 'deorbit-burn':
      r.throttle = 1;
      {
        const toMoon = Math.atan2(s.moon.y - r.y, s.moon.x - r.x);
        r.angle = toMoon;
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        if (moonDist < MOON_RADIUS * 1.2) return 'powered-descent';
        if (r.fuel < 0.02) return 'powered-descent';
      }
      return 'deorbit-burn';

    case 'powered-descent':
      r.throttle = 0.8;
      {
        const toMoon = Math.atan2(s.moon.y - r.y, s.moon.x - r.x);
        r.angle = toMoon;
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
        if (moonDist < MOON_RADIUS + 200) {
          r.throttle = 1;
        }
        if (moonDist < MOON_RADIUS + 5) return 'landing';
      }
      return 'powered-descent';

    case 'landing':
      r.throttle = 1;
      {
        const toMoon = Math.atan2(s.moon.y - r.y, s.moon.x - r.x);
        r.angle = toMoon;
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        if (moonDist < MOON_RADIUS + 1) {
          r.x = (r.x / moonDist) * (MOON_RADIUS + 0.5);
          r.y = (r.y / moonDist) * (MOON_RADIUS + 0.5);
          r.vx = 0;
          r.vy = 0;
          r.throttle = 0;
          return 'landed';
        }
        if (r.fuel < 0.01) {
          r.vx *= 0.1;
          r.vy *= 0.1;
          return 'landed';
        }
      }
      return 'landing';

    case 'landed':
      r.throttle = 0;
      r.vx = 0;
      r.vy = 0;
      return 'landed';

    default:
      return s.phase;
  }
}

export function updateSimulation(state: SimState, dt: number): SimState {
  if (state.paused || state.phase === 'briefing' || state.phase === 'landed') return state;

  const effectiveDt = dt * state.timeWarp;
  state.time += dt;
  state.simTime += effectiveDt;
  state.phaseTimer += effectiveDt;

  const r = state.rocket;
  const { earth, moon } = state;

  // Moon orbit
  const moonG = gravityAccel(moon.x, moon.y, earth);
  moon.vx += moonG.ax * effectiveDt;
  moon.vy += moonG.ay * effectiveDt;
  moon.x += moon.vx * effectiveDt;
  moon.y += moon.vy * effectiveDt;

  // Rocket gravity
  const gEarth = gravityAccel(r.x, r.y, earth);
  const gMoon = gravityAccel(r.x, r.y, moon);
  let ax = gEarth.ax + gMoon.ax;
  let ay = gEarth.ay + gMoon.ay;

  // Thrust
  if (r.active && r.throttle > 0 && r.fuel > 0) {
    const thrustForce = r.thrust * r.throttle;
    ax += Math.cos(r.angle) * thrustForce / r.mass;
    ay += Math.sin(r.angle) * thrustForce / r.mass;
    const fuelRate = thrustForce / (r.isp * SURFACE_G);
    r.fuel -= fuelRate * effectiveDt;
    if (r.fuel < 0) r.fuel = 0;

    addExhaust(state, r.x, r.y, r.angle, r.throttle);
    if (state.altitude < 100000) {
      addSmoke(state, r.x, r.y, r.angle, r.throttle);
    }
  }

  r.vx += ax * effectiveDt;
  r.vy += ay * effectiveDt;
  r.x += r.vx * effectiveDt;
  r.y += r.vy * effectiveDt;

  // Altitude & speed
  const distEarth = Math.sqrt(r.x * r.x + r.y * r.y);
  state.altitude = Math.max(0, (distEarth - EARTH_RADIUS) / 1000);
  state.speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);

  // Update particles
  updateParticles(state.smoke, effectiveDt);
  updateParticles(state.exhaust, effectiveDt);

  // Auto-pilot
  if (state.autoMode) {
    state.phase = executeAutoPilot(state);
  }

  return state;
}

export function togglePause(s: SimState): SimState {
  return { ...s, paused: !s.paused };
}

function nearestPresetIndex(value: number, presets: number[]): number {
  const exact = presets.indexOf(value);
  if (exact >= 0) return exact;
  let best = 0;
  let bestDiff = Math.abs(presets[0] - value);
  for (let i = 1; i < presets.length; i++) {
    const diff = Math.abs(presets[i] - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

export function setTimeWarp(s: SimState, dir: number): SimState {
  const warps = [0.5, 1, 2, 5, 10, 50, 100, 500, 1000];
  const idx = nearestPresetIndex(s.timeWarp, warps);
  const next = dir > 0 ? Math.min(idx + 1, warps.length - 1) : Math.max(idx - 1, 0);
  return { ...s, timeWarp: warps[next] };
}

export function toggleMapView(s: SimState): SimState {
  return { ...s, mapView: !s.mapView };
}

export function adjustZoom(s: SimState, dir: number): SimState {
  const zooms = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
  const idx = nearestPresetIndex(s.zoom, zooms);
  const next = dir > 0 ? Math.min(idx + 1, zooms.length - 1) : Math.max(idx - 1, 0);
  return { ...s, zoom: zooms[next] };
}

export function launchMission(s: SimState): SimState {
  return { ...s, phase: 'countdown', paused: false, launched: true, phaseTimer: 0 };
}
