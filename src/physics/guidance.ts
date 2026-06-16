import { CelestiaGame } from '../core/game';
import { Vector3, CelestialBodyData } from '../types';

export type AutopilotPhase =
  | 'idle'
  | 'launch'
  | 'gravity_turn'
  | 'circularization'
  | 'orbiting'
  | 'tli_wait'
  | 'tli_burn'
  | 'coasting_to_moon'
  | 'lunar_capture'
  | 'lunar_orbit'
  | 'lunar_descent'
  | 'suicide_burn'
  | 'landed';

export class MoonGuidance {
  public phase: AutopilotPhase = 'idle';
  public message: string = 'Autopilot offline. Ready.';
  private targetBodyName: string = 'moon';

  // PID variables for descent landing
  private lastAltitude: number = 0;
  private lastTime: number = 0;

  constructor() {}

  /**
   * Run one step of the guidance autopilot.
   * Adjusts the game controls: throttle (0 to 100), target angle (pitch/yaw/roll in degrees), and stages.
   */
  public update(game: CelestiaGame, currentThrottle: number): {
    throttle: number;
    pitch: number;
    stageRequired: boolean;
    statusMessage: string;
  } {
    const sc = game.getSpacecraft();
    if (!sc) {
      return { throttle: 0, pitch: 0, stageRequired: false, statusMessage: 'No vehicle' };
    }

    const bodies = game.getCelestialBodies();
    const earth = bodies.find((b) => b.id === 'earth')!;
    const moon = bodies.find((b) => b.id === 'moon')!;

    // Math tools for 2D vectors (using x & y coordinates of position/velocity)
    const rx = sc.position.x - earth.position.x;
    const ry = sc.position.y - earth.position.y;
    const distToEarth = Math.sqrt(rx * rx + ry * ry);
    const altEarth = distToEarth - earth.radius;

    const rMoonX = sc.position.x - moon.position.x;
    const rMoonY = sc.position.y - moon.position.y;
    const distToMoon = Math.sqrt(rMoonX * rMoonX + rMoonY * rMoonY);
    const altMoon = distToMoon - moon.radius;

    const inMoonSOI = distToMoon < 6.6e7; // Sphere of Influence of Moon is ~66,000 km
    const activeBody = inMoonSOI ? moon : earth;
    const activeAlt = inMoonSOI ? altMoon : altEarth;

    // Speeds relative to active body
    const relVx = sc.velocity.x - activeBody.velocity.x;
    const relVy = sc.velocity.y - activeBody.velocity.y;
    const speed = Math.sqrt(relVx * relVx + relVy * relVy);

    // Dynamic state machine
    if (this.phase === 'idle') {
      this.phase = 'launch';
    }

    let targetThrottle = 100;
    let targetPitch = 90; // pointing vertical
    let stageRequired = false;

    // Stage out if active engines are empty of fuel
    const fuelCapacity = game.getSpacecraftDeltaV();
    if (fuelCapacity <= 0 && sc.stages.length > 1) {
      stageRequired = true;
    }

    switch (this.phase) {
      case 'launch':
        this.message = 'NASA Takeoff - Launching vertically...';
        targetThrottle = 100;
        targetPitch = 90;
        if (activeAlt > 5000) {
          this.phase = 'gravity_turn';
        }
        break;

      case 'gravity_turn':
        this.message = 'NASA Takeoff - Executing Gravity Turn...';
        targetThrottle = 100;
        // Pitch down slowly as a function of altitude from 90 to 20
        const progress = Math.min(1, (activeAlt - 5000) / 40000);
        targetPitch = 90 - progress * 70; // Ending at 20 degrees above horizon

        // Read orbit parameters to check apoapsis
        const orbitalInfo = game.getOrbitalInfo();
        if (orbitalInfo && orbitalInfo.orbit && orbitalInfo.orbit.apoApsis - earth.radius > 150000) {
          // Reached desired 150km target Apoapsis
          targetThrottle = 0;
          this.phase = 'circularization';
        }
        break;

      case 'circularization':
        this.message = 'NASA Takeoff - Coasting to Apoapsis (150km)...';
        targetThrottle = 0;
        targetPitch = 0; // Point horizontal (prograde direction)

        const orbitData = game.getOrbitalInfo();
        if (orbitData && orbitData.orbit) {
          const altitude = orbitData.altitude;
          const currentAp = orbitData.orbit.apoApsis - earth.radius;
          const currentPe = orbitData.orbit.periApsis - earth.radius;

          // If close to apoapsis, circularize
          if (Math.abs(altitude - currentAp) < 10000 || speed < 7400) {
            targetThrottle = 100;
            this.message = 'NASA Insertion - Burning Prograde to circularize...';
          }

          if (currentPe > 120000 && orbitData.orbit.eccentricity < 0.05) {
            // Circular orbit achieved!
            targetThrottle = 0;
            this.phase = 'tli_wait';
          }
        }
        break;

      case 'tli_wait':
        this.message = 'Trans-Lunar Insertion - Calculating orbital phase alignment...';
        targetThrottle = 0;
        // Keep pointing prograde (tangent to velocity vector)
        targetPitch = Math.atan2(relVy, relVx) * (180 / Math.PI);

        // Hohmann transfer phase angle check:
        // Moon is at ~384,000 km. Phase angle to burn is when Moon leads the rocket by ~54 degrees in orbital position.
        const scAngle = Math.atan2(rx, ry);
        const moonAngle = Math.atan2(moon.position.x - earth.position.x, moon.position.y - earth.position.y);
        let angleDiff = moonAngle - scAngle;
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        // When lead angle matches ~50-60 degrees (~0.9 rad to 1.1 rad)
        if (angleDiff > 0.8 && angleDiff < 1.2) {
          this.phase = 'tli_burn';
        }
        break;

      case 'tli_burn':
        this.message = 'NASA TLI - Burning to intercept the Moon...';
        targetThrottle = 100;
        targetPitch = Math.atan2(relVy, relVx) * (180 / Math.PI);

        const tliOrbit = game.getOrbitalInfo();
        if (tliOrbit && tliOrbit.orbit) {
          // Raise Earth apoapsis to intersect Moon's orbit (3.84e8 m)
          if (tliOrbit.orbit.apoApsis >= 3.8e8) {
            targetThrottle = 0;
            this.phase = 'coasting_to_moon';
          }
        }
        break;

      case 'coasting_to_moon':
        this.message = `NASA Trajectory - Coasting. Entering Moon influence in SOI: ${(distToMoon / 1000).toFixed(0)} km`;
        targetThrottle = 0;
        // Orient pointing forward
        targetPitch = Math.atan2(relVy, relVx) * (180 / Math.PI);

        if (inMoonSOI) {
          this.phase = 'lunar_capture';
        }
        break;

      case 'lunar_capture':
        this.message = 'Moon SOI Captured - Executing retrograde orbital insertion...';
        // Point retrograde relative to Moon
        targetPitch = Math.atan2(-relVy, -relVx) * (180 / Math.PI);
        targetThrottle = 100;

        // Capture into circular orbit (periapsis around 50km)
        if (speed < 1700 && altMoon < 300000) {
          this.phase = 'lunar_descent';
        }
        break;

      case 'lunar_descent':
        this.message = 'NASA Lunar Orbit - Initiating Powered Descent Initiative...';
        // Point retrograde to drop periapsis
        targetPitch = Math.atan2(-relVy, -relVx) * (180 / Math.PI);
        targetThrottle = 40;

        if (altMoon < 30000) {
          this.phase = 'suicide_burn';
        }
        break;

      case 'suicide_burn':
        // PID lunar vertical landing deceleration logic
        this.message = `NASA Landing - Descending at: ${speed.toFixed(1)} m/s, Altitude: ${(altMoon / 1000).toFixed(1)} km`;
        
        // Point engines directly down (radial out relative to Moon center)
        const radialOutX = rMoonX / distToMoon;
        const radialOutY = rMoonY / distToMoon;
        targetPitch = Math.atan2(radialOutY, radialOutX) * (180 / Math.PI);

        // Simple thrust controller to achieve safe touchdown speed
        // Desired vertical speed matches height (e.g. at 1000m, 15 m/s; at 100m, 3 m/s)
        const targetSpeed = Math.max(1.5, altMoon * 0.05);
        if (speed > targetSpeed) {
          targetThrottle = 100;
        } else {
          targetThrottle = 10;
        }

        if (altMoon < 5 && speed < 3) {
          targetThrottle = 0;
          this.phase = 'landed';
        }
        break;

      case 'landed':
        this.message = 'NASA Touchdown! Moon Landing Complete!';
        targetThrottle = 0;
        targetPitch = 0;
        break;
    }

    return {
      throttle: targetThrottle,
      pitch: targetPitch,
      stageRequired,
      statusMessage: this.message,
    };
  }
}
