export interface SimState {
  rocket: RocketState;
  earth: { x: number; y: number; radius: number };
  moon: { x: number; y: number; radius: number; vx: number; vy: number };
  phase: MissionPhase;
  phaseTimer: number;
  time: number;
  timeWarp: number;
  paused: boolean;
  mapView: boolean;
  zoom: number;
  targetZoom: number;
  autoMode: boolean;
  missionStarted: boolean;
  stageIndex: number;
  totalStages: number;
  landed: boolean;
  crashed: boolean;
  throttleInput: number;
}

export interface RocketState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  mass: number;
  dryMass: number;
  fuel: number;
  maxFuel: number;
  thrust: number;
  isp: number;
  throttle: number;
  stageFuel: number;
  stageMaxFuel: number;
  stageDryMass: number;
}

export type MissionPhase =
  | 'standby'
  | 'countdown'
  | 'liftoff'
  | 'gravity-turn'
  | 'ascent'
  | 'stage-sep'
  | 'coast'
  | 'tli-burn'
  | 'trans-lunar'
  | 'lunar-insertion'
  | 'landing-burn'
  | 'touchdown';

// Game-scale values (not real meters)
export const EARTH_RADIUS = 180;
export const MOON_RADIUS = 48;
const G = 1200;
const EARTH_MASS = 500000;
const MOON_MASS = 6200;
const ATMOSPHERE_ALT = 35;
const SURFACE_FRICTION = 0.97;
const GRAVITY_STRENGTH = 800;

export function createInitialState(
  rocketMass: number,
  thrustN: number,
  isp: number,
  totalStages: number,
  autoMode: boolean
): SimState {
  const startY = -(EARTH_RADIUS - 4);
  return {
    rocket: {
      x: 0,
      y: startY,
      vx: 0,
      vy: 0,
      angle: Math.PI / 2,
      angularVel: 0,
      mass: rocketMass,
      dryMass: rocketMass * 0.4,
      fuel: rocketMass * 0.6,
      maxFuel: rocketMass * 0.6,
      thrust: thrustN,
      isp,
      throttle: 0,
      stageFuel: rocketMass * 0.6,
      stageMaxFuel: rocketMass * 0.6,
      stageDryMass: rocketMass * 0.4 / totalStages,
    },
    earth: { x: 0, y: 0, radius: EARTH_RADIUS },
    moon: {
      x: 580,
      y: 120,
      radius: MOON_RADIUS,
      vx: 0,
      vy: 2.6,
    },
    phase: 'standby',
    phaseTimer: 0,
    time: 0,
    timeWarp: 1,
    paused: false,
    mapView: false,
    zoom: 3,
    targetZoom: 3,
    autoMode,
    missionStarted: false,
    stageIndex: 0,
    totalStages,
    landed: false,
    crashed: false,
    throttleInput: 0,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function dist(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function updateSimulation(s: SimState, dt: number): SimState {
  const state = { ...s };
  state.rocket = { ...state.rocket };
  state.moon = { ...state.moon };

  const r = state.rocket;
  const dtScaled = dt * state.timeWarp;

  if (state.paused || state.phase === 'touchdown') return state;

  state.time += dtScaled;
  state.phaseTimer += dtScaled;

  // Moon orbit
  const moonEarthDist = dist(state.moon.x, state.moon.y, state.earth.x, state.earth.y);
  const moonG = G * EARTH_MASS / (moonEarthDist * moonEarthDist);
  const moonGx = -moonG * (state.moon.x - state.earth.x) / moonEarthDist;
  const moonGy = -moonG * (state.moon.y - state.earth.y) / moonEarthDist;
  state.moon.vx += moonGx * dtScaled;
  state.moon.vy += moonGy * dtScaled;
  state.moon.x += state.moon.vx * dtScaled;
  state.moon.y += state.moon.vy * dtScaled;

  // Rocket gravity from Earth
  const earthDist = dist(r.x, r.y, state.earth.x, state.earth.y);
  let gForce = 0;
  if (earthDist > state.earth.radius) {
    gForce = G * EARTH_MASS / (earthDist * earthDist);
  } else {
    gForce = G * EARTH_MASS * earthDist / (state.earth.radius * state.earth.radius * state.earth.radius);
  }
  const gx = -gForce * (r.x - state.earth.x) / Math.max(earthDist, 1);
  const gy = -gForce * (r.y - state.earth.y) / Math.max(earthDist, 1);

  // Rocket gravity from Moon
  const moonDist = dist(r.x, r.y, state.moon.x, state.moon.y);
  if (moonDist > 1) {
    const mG = G * MOON_MASS / (moonDist * moonDist);
    r.vx += (-mG * (r.x - state.moon.x) / moonDist) * dtScaled;
    r.vy += (-mG * (r.y - state.moon.y) / moonDist) * dtScaled;
  }

  // Atmospheric drag
  const alt = earthDist - state.earth.radius;
  let drag = 0;
  if (alt < ATMOSPHERE_ALT && alt > 0) {
    const density = 1 - alt / ATMOSPHERE_ALT;
    const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
    drag = 0.001 * density * speed * speed / r.mass;
    const dragAngle = Math.atan2(r.vy, r.vx);
    r.vx -= Math.cos(dragAngle) * drag * dtScaled;
    r.vy -= Math.sin(dragAngle) * drag * dtScaled;
  }

  // Thrust
  if (r.throttle > 0 && r.fuel > 0 && !state.landed) {
    const thrustForce = r.thrust * r.throttle;
    const tx = Math.cos(r.angle) * thrustForce / r.mass;
    const ty = Math.sin(r.angle) * thrustForce / r.mass;
    r.vx += tx * dtScaled;
    r.vy += ty * dtScaled;

    const fuelRate = (thrustForce / (r.isp * 9.81)) * dtScaled;
    r.fuel -= fuelRate;
    if (r.fuel < 0) r.fuel = 0;
  }

  // Apply gravity and update position
  r.vx += gx * dtScaled;
  r.vy += gy * dtScaled;
  r.x += r.vx * dtScaled;
  r.y += r.vy * dtScaled;

  // Angle (auto-pilot or manual)
  r.angle += r.angularVel * dtScaled;
  r.angularVel *= 0.95;

  // Ground collision
  const distFromEarthCenter = dist(r.x, r.y, 0, 0);
  if (distFromEarthCenter < state.earth.radius + 2 && !state.landed && !state.crashed) {
    const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
    if (speed > 5 && alt < 5) {
      state.crashed = true;
      state.phase = 'touchdown';
      r.vx = 0;
      r.vy = 0;
    }
    if (state.crashed) return state;
  }

  // Moon collision
  const distFromMoonCenter = dist(r.x, r.y, state.moon.x, state.moon.y);
  if (distFromMoonCenter < state.moon.radius + 2 && !state.landed) {
    const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
    if (speed < 8) {
      r.x = state.moon.x + (r.x - state.moon.x) / distFromMoonCenter * (state.moon.radius + 1);
      r.y = state.moon.y + (r.y - state.moon.y) / distFromMoonCenter * (state.moon.radius + 1);
      r.vx = 0;
      r.vy = 0;
      r.throttle = 0;
      state.landed = true;
      state.phase = 'touchdown';
    } else {
      state.crashed = true;
      state.phase = 'touchdown';
      r.vx = 0;
      r.vy = 0;
    }
    return state;
  }

  // === AUTO-PILOT ===
  if (state.autoMode && state.missionStarted) {
    executeAutoPilot(state, dtScaled);
  }

  // Smooth zoom
  state.zoom += (state.targetZoom - state.zoom) * 0.05;

  return state;
}

function executeAutoPilot(s: SimState, dt: number) {
  const r = s.rocket;
  const alt = dist(r.x, r.y, 0, 0) - EARTH_RADIUS;
  const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
  const moonDist = dist(r.x, r.y, s.moon.x, s.moon.y);

  switch (s.phase) {
    case 'standby':
      r.throttle = 0;
      break;

    case 'countdown':
      r.throttle = 0;
      if (s.phaseTimer > 2) {
        s.phase = 'liftoff';
        s.phaseTimer = 0;
      }
      break;

    case 'liftoff':
      r.throttle = s.throttleInput > 0 ? s.throttleInput : 1;
      r.angle = Math.PI / 2;
      if (alt > 3) {
        s.phase = 'gravity-turn';
        s.phaseTimer = 0;
      }
      break;

    case 'gravity-turn':
      r.throttle = 1;
      {
        const turnRate = 0.5;
        r.angularVel = -turnRate * 0.3;
      }
      if (alt > 15) {
        s.phase = 'ascent';
        s.phaseTimer = 0;
      }
      break;

    case 'ascent':
      r.throttle = 1;
      {
        const targetAngle = Math.PI * 0.7;
        const diff = targetAngle - r.angle;
        r.angularVel = diff * 2;
      }
      if (alt > ATMOSPHERE_ALT || r.fuel < 0.01) {
        s.phase = 'stage-sep';
        s.phaseTimer = 0;
      }
      break;

    case 'stage-sep':
      r.throttle = 0;
      if (s.phaseTimer > 0.5) {
        r.throttle = 0;
        // Auto-warp during coast
        s.timeWarp = 5;
        s.phase = 'coast';
        s.phaseTimer = 0;
      }
      break;

    case 'coast':
      r.throttle = 0;
      // Circularize angle to horizontal
      {
        const targetAngle = Math.PI;
        const diff = targetAngle - r.angle;
        r.angularVel = diff * 0.5;
      }
      // When approaching moon, prepare for TLI
      {
        const earthDist = dist(r.x, r.y, 0, 0);
        // TLI when we're about 1/3 of the way to the moon
        if ((moonDist < 350 && moonDist > 0) || s.phaseTimer > 4) {
          s.timeWarp = 1;
          s.phase = 'tli-burn';
          s.phaseTimer = 0;
        }
      }
      break;

    case 'tli-burn':
      r.throttle = 1;
      {
        // Point prograde (toward velocity direction)
        const progradeAngle = Math.atan2(r.vy, r.vx);
        const diff = progradeAngle - r.angle;
        r.angularVel = diff * 2;
      }
      if (moonDist < 120 || r.fuel < 0.01) {
        s.phase = 'trans-lunar';
        s.phaseTimer = 0;
        s.timeWarp = 5;
      }
      break;

    case 'trans-lunar':
      r.throttle = 0;
      if (moonDist < 60) {
        s.timeWarp = 1;
        s.phase = 'lunar-insertion';
        s.phaseTimer = 0;
      }
      break;

    case 'lunar-insertion':
      r.throttle = 1;
      {
        // Point retrograde relative to moon
        const angleToMoon = Math.atan2(s.moon.y - r.y, s.moon.x - r.x);
        const retroAngle = angleToMoon + Math.PI;
        const diff = retroAngle - r.angle;
        r.angularVel = diff * 2;
      }
      if (moonDist < 55 || s.phaseTimer > 2) {
        s.phase = 'landing-burn';
        s.phaseTimer = 0;
      }
      break;

    case 'landing-burn':
      r.throttle = 1;
      {
        const angleToMoon = Math.atan2(s.moon.y - r.y, s.moon.x - r.x);
        const targetAngle = angleToMoon + Math.PI / 2;
        const diff = targetAngle - r.angle;
        r.angularVel = diff * 3;
      }
      // Throttle down as we approach
      {
        const moonDistNorm = (moonDist - MOON_RADIUS) / 60;
        r.throttle = clamp(moonDistNorm, 0.2, 1);
      }
      if (moonDist < MOON_RADIUS + 5) {
        r.throttle = 0.3;
      }
      break;

    case 'touchdown':
      r.throttle = 0;
      break;
  }
}

export function togglePause(s: SimState): SimState {
  return { ...s, paused: !s.paused };
}

export function changeTimeWarp(s: SimState, dir: number): SimState {
  const warps = [0.5, 1, 2, 5, 10, 50];
  const idx = warps.indexOf(s.timeWarp);
  let next: number;
  if (dir > 0) {
    next = Math.min(idx + 1, warps.length - 1);
  } else {
    next = Math.max(idx - 1, 0);
  }
  return { ...s, timeWarp: warps[next] };
}

export function toggleMapView(s: SimState): SimState {
  const newMap = !s.mapView;
  return { ...s, mapView: newMap, targetZoom: newMap ? 0.8 : 3 };
}

export function adjustZoom(s: SimState, dir: number): SimState {
  const zooms = [1, 1.5, 2, 3, 5, 8, 12, 20, 40];
  const idx = zooms.indexOf(s.targetZoom);
  const next = dir > 0 ? Math.min(idx + 1, zooms.length - 1) : Math.max(idx - 1, 0);
  return { ...s, targetZoom: zooms[next] };
}

export function setThrottle(s: SimState, val: number): SimState {
  s.rocket.throttle = clamp(val, 0, 1);
  s.throttleInput = s.rocket.throttle;
  return s;
}

export function startMission(s: SimState): SimState {
  if (s.phase !== 'standby') return s;
  return { ...s, missionStarted: true, phase: 'countdown', phaseTimer: 0 };
}
