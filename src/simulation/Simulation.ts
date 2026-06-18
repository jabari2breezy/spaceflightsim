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

export interface SimState {
  rocket: SimRocket;
  earth: SimBody;
  moon: SimBody;
  time: number;
  dt: number;
  timeWarp: number;
  phase: MissionPhase;
  phaseTimer: number;
  altitude: number;
  speed: number;
  paused: boolean;
  mapView: boolean;
  zoom: number;
}

export type MissionPhase =
  | 'countdown'
  | 'lift-off'
  | 'gravity-turn'
  | 'atmosphere-exit'
  | 'coast'
  | 'tli-burn'
  | 'trans-lunar'
  | 'lunar-insertion'
  | 'lunar-orbit'
  | 'deorbit-burn'
  | 'landing'
  | 'landed';

export const G = 6.67430e-11;
export const EARTH_MASS = 5.972e24;
export const EARTH_RADIUS = 6_371_000;
export const MOON_MASS = 7.34767309e22;
export const MOON_RADIUS = 1_737_000;
export const MOON_ORBIT_R = 384_400_000;
export const MOON_ORBIT_SPEED = Math.sqrt(G * EARTH_MASS / MOON_ORBIT_R);
export const ATMOSPHERE_ALT = 100_000;
export const MOON_ALT_ORBIT = 50_000;

export function createInitialState(rocketMass: number, thrustN: number, isp: number): SimState {
  const startY = -(EARTH_RADIUS + 0.1);
  return {
    rocket: {
      x: 0,
      y: startY,
      vx: 0,
      vy: 0,
      angle: Math.PI / 2,
      mass: rocketMass,
      fuel: rocketMass * 0.6,
      maxFuel: rocketMass * 0.6,
      thrust: thrustN,
      isp,
      stage: 0,
      totalStages: 1,
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
    dt: 1 / 60,
    timeWarp: 1,
    phase: 'countdown',
    phaseTimer: 0,
    altitude: 0,
    speed: 0,
    paused: false,
    mapView: false,
    zoom: 0.5,
  };
}

function gravityAccel(x: number, y: number, body: SimBody): { ax: number; ay: number } {
  const dx = body.x - x;
  const dy = body.y - y;
  const d2 = dx * dx + dy * dy;
  const d = Math.sqrt(d2);
  if (d < body.radius) return { ax: 0, ay: 0 };
  const a = G * body.mass / d2;
  return { ax: a * dx / d, ay: a * dy / d };
}

export function updateSimulation(state: SimState, dt: number): SimState {
  if (state.paused || state.phase === 'landed') return state;

  const s = { ...state };
  s.rocket = { ...s.rocket };
  s.moon = { ...s.moon, x: s.moon.x, y: s.moon.y, vx: s.moon.vx, vy: s.moon.vy };
  s.time += dt * s.timeWarp;
  s.phaseTimer += dt * s.timeWarp;

  const r = s.rocket;
  const { earth, moon } = s;

  // Moon orbit
  const moonG = gravityAccel(moon.x, moon.y, earth);
  moon.vx += moonG.ax * dt * s.timeWarp;
  moon.vy += moonG.ay * dt * s.timeWarp;
  moon.x += moon.vx * dt * s.timeWarp;
  moon.y += moon.vy * dt * s.timeWarp;

  // Rocket gravity
  const gEarth = gravityAccel(r.x, r.y, earth);
  const gMoon = gravityAccel(r.x, r.y, moon);
  let ax = gEarth.ax + gMoon.ax;
  let ay = gEarth.ay + gMoon.ay;

  // Thrust
  if (r.active && r.throttle > 0 && r.fuel > 0) {
    const thrustForce = r.thrust * r.throttle;
    const tx = Math.cos(r.angle) * thrustForce;
    const ty = Math.sin(r.angle) * thrustForce;
    ax += tx / r.mass;
    ay += ty / r.mass;

    const fuelRate = thrustForce / (r.isp * 9.81);
    r.fuel -= fuelRate * dt * s.timeWarp;
    if (r.fuel < 0) r.fuel = 0;
  }

  r.vx += ax * dt * s.timeWarp;
  r.vy += ay * dt * s.timeWarp;
  r.x += r.vx * dt * s.timeWarp;
  r.y += r.vy * dt * s.timeWarp;

  // Altitude & speed
  const distEarth = Math.sqrt(r.x * r.x + r.y * r.y);
  s.altitude = Math.max(0, (distEarth - EARTH_RADIUS) / 1000);
  s.speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);

  // Auto-pilot phases
  s.phase = executeAutoPilot(s);

  return s;
}

function executeAutoPilot(s: SimState): MissionPhase {
  const r = s.rocket;
  const altKm = s.altitude;

  switch (s.phase) {
    case 'countdown':
      r.throttle = 0;
      r.angle = Math.PI / 2;
      if (s.phaseTimer > 5) return 'lift-off';
      return 'countdown';

    case 'lift-off':
      r.throttle = 1;
      r.angle = Math.PI / 2;
      if (altKm > 1) return 'gravity-turn';
      return 'lift-off';

    case 'gravity-turn':
      r.throttle = 1;
      {
        const turnRate = Math.min(0.002, (altKm / 50000) * 0.02);
        r.angle += turnRate * s.timeWarp * s.dt;
        if (r.angle > Math.PI) r.angle = Math.PI;
      }
      if (altKm > 100 || r.fuel < 0.01) return 'atmosphere-exit';
      return 'gravity-turn';

    case 'atmosphere-exit':
      r.throttle = r.fuel > 0.01 ? 1 : 0;
      if (r.angle < Math.PI) r.angle += 0.001 * s.timeWarp * s.dt;
      if (r.angle > Math.PI) r.angle = Math.PI;
      if (altKm > 200 || r.fuel < 0.01) return 'coast';
      return 'atmosphere-exit';

    case 'coast':
      r.throttle = 0;
      {
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        const moonAltKm = (moonDist - MOON_RADIUS) / 1000;
        if (moonAltKm < 500) return 'lunar-insertion';
      }
      // TLI when angle is right (roughly when pointing prograde near moon intercept)
      {
        const earthDist = Math.sqrt(r.x * r.x + r.y * r.y);
        const progradeAngle = Math.atan2(r.vy, r.vx);
        const angleDiff = Math.abs(r.angle - progradeAngle);
        if (earthDist > 350_000_000 && angleDiff < 0.3 && r.fuel > 0.1) return 'tli-burn';
      }
      return 'coast';

    case 'tli-burn':
      r.throttle = 1;
      {
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        const moonAltKm = (moonDist - MOON_RADIUS) / 1000;
        if (moonAltKm < 500) return 'lunar-insertion';
        if (r.fuel < 0.01) return 'coast';
      }
      return 'tli-burn';

    case 'lunar-insertion':
      r.throttle = 1;
      {
        r.angle = Math.atan2(s.moon.y - r.y, s.moon.x - r.x) + Math.PI;
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        const moonAltKm = (moonDist - MOON_RADIUS) / 1000;
        if (moonAltKm < 50) return 'lunar-orbit';
        if (r.fuel < 0.01) return 'lunar-orbit';
      }
      return 'lunar-insertion';

    case 'lunar-orbit':
      r.throttle = 0;
      {
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
        const orbitalSpeed = Math.sqrt(G * MOON_MASS / moonDist);
        if (speed < orbitalSpeed * 0.7 && s.phaseTimer > 10) return 'deorbit-burn';
      }
      return 'lunar-orbit';

    case 'deorbit-burn':
      r.throttle = 1;
      r.angle = Math.atan2(s.moon.y - r.y, s.moon.x - r.x);
      {
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        const moonAltKm = (moonDist - MOON_RADIUS) / 1000;
        if (moonAltKm < 5) return 'landing';
        if (r.fuel < 0.01) return 'landing';
      }
      return 'deorbit-burn';

    case 'landing':
      r.throttle = 1;
      {
        const moonDist = Math.sqrt((r.x - s.moon.x) ** 2 + (r.y - s.moon.y) ** 2);
        r.angle = Math.atan2(s.moon.y - r.y, s.moon.x - r.x) + Math.PI / 2;
        const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
        if (speed > 100) {
          r.throttle = 1;
        } else if (speed > 20) {
          r.throttle = 0.5;
        } else {
          r.throttle = 0.3;
        }
        if (moonDist < MOON_RADIUS + 1) {
          r.x = r.x * (MOON_RADIUS / moonDist);
          r.y = r.y * (MOON_RADIUS / moonDist);
          r.vx = 0;
          r.vy = 0;
          r.throttle = 0;
          return 'landed';
        }
        if (r.fuel < 0.01) return 'landed';
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

export function togglePause(s: SimState): SimState {
  return { ...s, paused: !s.paused };
}

export function setTimeWarp(s: SimState, warp: number): SimState {
  const warps = [0.1, 0.5, 1, 2, 5, 10, 50, 100, 1000];
  const idx = warps.indexOf(s.timeWarp);
  const next = warp > 0 ? Math.min(idx + 1, warps.length - 1) : Math.max(idx - 1, 0);
  return { ...s, timeWarp: warps[next] };
}

export function toggleMapView(s: SimState): SimState {
  return { ...s, mapView: !s.mapView };
}

export function adjustZoom(s: SimState, dir: number): SimState {
  const zooms = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 50];
  const idx = zooms.indexOf(s.zoom);
  const next = dir > 0 ? Math.min(idx + 1, zooms.length - 1) : Math.max(idx - 1, 0);
  return { ...s, zoom: zooms[next] };
}
