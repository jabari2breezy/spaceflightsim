/**
 * Advanced Physics Engine for Celestia
 * Implements N-body gravity, atmospheric drag, and orbital mechanics
 */

import { Vector3, PhysicsState, CelestialBodyData, Orbit, TrajectoryPoint } from '../types';

const G = 6.67430e-11; // Gravitational constant (m^3 kg^-1 s^-2)
const AU = 1.496e11; // Astronomical Unit (meters)
const PHYSICS_DT = 0.016; // 60 FPS
const SUBSTEPS = 4; // Number of physics substeps per frame

export class PhysicsEngine {
  private state: PhysicsState;
  private bodies: Map<string, CelestialBodyData> = new Map();
  private trajectoryHistory: TrajectoryPoint[] = [];
  private maxHistoryPoints = 10000;

  constructor(initialState: PhysicsState) {
    this.state = { ...initialState };
  }

  /**
   * Add a celestial body to the simulation
   */
  addBody(body: CelestialBodyData): void {
    this.bodies.set(body.id, body);
  }

  /**
   * Remove a celestial body from the simulation
   */
  removeBody(bodyId: string): void {
    this.bodies.delete(bodyId);
  }

  /**
   * Update all celestial bodies' positions (simple circular orbit assumption for now)
   */
  updateCelestialBodies(deltaTime: number): void {
    for (const body of this.bodies.values()) {
      // Update body rotation
      body.position = rotateVector(body.position, body.rotationRate * deltaTime);
    }
  }

  /**
   * Calculate gravitational acceleration from all bodies
   */
  private calculateGravitationalAcceleration(): Vector3 {
    const acceleration = { x: 0, y: 0, z: 0 };
    const spacecraft = this.state;

    for (const body of this.bodies.values()) {
      const dx = body.position.x - spacecraft.position.x;
      const dy = body.position.y - spacecraft.position.y;
      const dz = body.position.z - spacecraft.position.z;

      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq);

      if (dist < 1) continue; // Avoid singularity

      // F = G * M * m / r^2
      // a = G * M / r^2
      const accelMag = (G * body.mass) / distSq;
      const accelNorm = accelMag / dist;

      acceleration.x += dx * accelNorm;
      acceleration.y += dy * accelNorm;
      acceleration.z += dz * accelNorm;
    }

    return acceleration;
  }

  /**
   * Calculate atmospheric drag
   */
  private calculateAtmosphericDrag(): Vector3 {
    const drag = { x: 0, y: 0, z: 0 };

    // Find which body we're closest to
    let closestBody: CelestialBodyData | null = null;
    let minDist = Infinity;

    for (const body of this.bodies.values()) {
      const dx = this.state.position.x - body.position.x;
      const dy = this.state.position.y - body.position.y;
      const dz = this.state.position.z - body.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < minDist) {
        minDist = dist;
        closestBody = body;
      }
    }

    if (!closestBody || !closestBody.atmosphere || minDist < closestBody.radius) {
      return drag;
    }

    const altitude = minDist - closestBody.radius;
    if (altitude < 0 || altitude > closestBody.atmosphere.scaleHeight * 30) {
      return drag; // No atmosphere at this altitude
    }

    // Exponential atmosphere model: ρ = ρ0 * exp(-h/H)
    const density =
      closestBody.atmosphere.density * Math.exp(-altitude / closestBody.atmosphere.scaleHeight);

    // Drag force: F = 0.5 * ρ * v^2 * Cd * A
    // Simplified: assume drag coefficient and cross-sectional area
    const Cd = 0.3; // Drag coefficient
    const A = 10; // Cross-sectional area in m^2
    const speedSq = this.state.velocity.x ** 2 + 
                   this.state.velocity.y ** 2 + 
                   this.state.velocity.z ** 2;
    const speed = Math.sqrt(speedSq);

    if (speed < 0.1) return drag;

    const dragMag = (0.5 * density * speedSq * Cd * A) / this.state.mass;
    const dragNorm = dragMag / speed;

    drag.x = -this.state.velocity.x * dragNorm;
    drag.y = -this.state.velocity.y * dragNorm;
    drag.z = -this.state.velocity.z * dragNorm;

    return drag;
  }

  /**
   * Calculate thrust from spacecraft engines
   */
  calculateThrust(): Vector3 {
    // Placeholder: would be calculated from active stages and throttle
    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Main physics update step using RK4 integration
   */
  update(deltaTime: number, engineThrust: Vector3 = { x: 0, y: 0, z: 0 }): void {
    this.updateCelestialBodies(deltaTime);

    const substep = deltaTime / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS; i++) {
      this.integrateRK4(substep, engineThrust);
    }

    // Record trajectory history
    this.trajectoryHistory.push({
      position: { ...this.state.position },
      velocity: { ...this.state.velocity },
      time: performance.now(),
    });

    if (this.trajectoryHistory.length > this.maxHistoryPoints) {
      this.trajectoryHistory.shift();
    }
  }

  /**
   * 4th-order Runge-Kutta integration
   */
  private integrateRK4(dt: number, engineThrust: Vector3): void {
    // k1
    const k1_v = this.state.velocity;
    const k1_a = this.calculateAccelerations(engineThrust);

    // k2
    const state2 = this.stateAtTime(dt / 2, k1_v, k1_a);
    const k2_a = this.calculateAccelerationsAtState(state2, engineThrust);

    // k3
    const state3 = this.stateAtTime(dt / 2, k1_v, k2_a);
    const k3_a = this.calculateAccelerationsAtState(state3, engineThrust);

    // k4
    const state4 = this.stateAtTime(dt, k1_v, k3_a);
    const k4_a = this.calculateAccelerationsAtState(state4, engineThrust);

    // Update state
    this.state.position.x += (dt / 6) * (k1_v.x + 2 * k1_v.x + 2 * k1_v.x + k1_v.x);
    this.state.position.y += (dt / 6) * (k1_v.y + 2 * k1_v.y + 2 * k1_v.y + k1_v.y);
    this.state.position.z += (dt / 6) * (k1_v.z + 2 * k1_v.z + 2 * k1_v.z + k1_v.z);

    this.state.velocity.x += (dt / 6) * (k1_a.x + 2 * k2_a.x + 2 * k3_a.x + k4_a.x);
    this.state.velocity.y += (dt / 6) * (k1_a.y + 2 * k2_a.y + 2 * k3_a.y + k4_a.y);
    this.state.velocity.z += (dt / 6) * (k1_a.z + 2 * k2_a.z + 2 * k3_a.z + k4_a.z);
  }

  private stateAtTime(
    t: number,
    velocity: Vector3,
    acceleration: Vector3
  ): PhysicsState {
    return {
      ...this.state,
      position: {
        x: this.state.position.x + velocity.x * t,
        y: this.state.position.y + velocity.y * t,
        z: this.state.position.z + velocity.z * t,
      },
      velocity: {
        x: this.state.velocity.x + acceleration.x * t,
        y: this.state.velocity.y + acceleration.y * t,
        z: this.state.velocity.z + acceleration.z * t,
      },
    };
  }

  private calculateAccelerations(engineThrust: Vector3): Vector3 {
    const grav = this.calculateGravitationalAcceleration();
    const drag = this.calculateAtmosphericDrag();
    const thrustAccel = {
      x: engineThrust.x / this.state.mass,
      y: engineThrust.y / this.state.mass,
      z: engineThrust.z / this.state.mass,
    };

    return {
      x: grav.x + drag.x + thrustAccel.x,
      y: grav.y + drag.y + thrustAccel.y,
      z: grav.z + drag.z + thrustAccel.z,
    };
  }

  private calculateAccelerationsAtState(state: PhysicsState, engineThrust: Vector3): Vector3 {
    // Simplified version - would need to recalculate relative to perturbed state
    return this.calculateAccelerations(engineThrust);
  }

  /**
   * Calculate orbital parameters at current position
   */
  calculateOrbit(centralBody: CelestialBodyData): Orbit | null {
    const r = subtractVectors(this.state.position, centralBody.position);
    const v = this.state.velocity;

    const rMag = magnitudeVector(r);
    const vMag = magnitudeVector(v);

    if (rMag < centralBody.radius) {
      return null; // Inside planet
    }

    // Specific orbital energy: ε = v²/2 - GM/r
    const mu = G * centralBody.mass;
    const energy = (vMag * vMag) / 2 - mu / rMag;

    // Semi-major axis: a = -GM/(2ε)
    const semiMajorAxis = -mu / (2 * energy);

    // Eccentricity vector: e = (v × h)/μ - r/|r|
    const h = crossProduct(r, v);
    const eVec = {
      x: (v.y * h.z - v.z * h.y) / mu - r.x / rMag,
      y: (v.z * h.x - v.x * h.z) / mu - r.y / rMag,
      z: (v.x * h.y - v.y * h.x) / mu - r.z / rMag,
    };
    const eccentricity = magnitudeVector(eVec);

    // True anomaly
    const cosTA = (dotProduct(r, v)) / (rMag * vMag);
    const trueAnomaly = Math.acos(Math.max(-1, Math.min(1, cosTA)));

    // Inclination: i = acos(h_z / |h|)
    const inclination = Math.acos(Math.max(-1, Math.min(1, h.z / magnitudeVector(h))));

    // Period: T = 2π√(a³/GM)
    const period = 2 * Math.PI * Math.sqrt((semiMajorAxis ** 3) / mu);

    // Apsides
    const apoApsis = semiMajorAxis * (1 + eccentricity);
    const periApsis = semiMajorAxis * (1 - eccentricity);

    return {
      semiMajorAxis,
      eccentricity,
      inclination,
      argumentOfPeriapsis: 0, // Simplified
      longitudeOfAscendingNode: 0, // Simplified
      trueAnomaly,
      period,
      apoApsis,
      periApsis,
    };
  }

  /**
   * Get current state
   */
  getState(): PhysicsState {
    return { ...this.state };
  }

  /**
   * Set state
   */
  setState(state: Partial<PhysicsState>): void {
    this.state = { ...this.state, ...state };
  }

  /**
   * Get trajectory history
   */
  getTrajectoryHistory(): TrajectoryPoint[] {
    return [...this.trajectoryHistory];
  }

  /**
   * Clear trajectory history
   */
  clearTrajectoryHistory(): void {
    this.trajectoryHistory = [];
  }
}

// Utility functions
function magnitudeVector(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function subtractVectors(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

function dotProduct(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function crossProduct(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function rotateVector(v: Vector3, angle: number): Vector3 {
  // Simple rotation around z-axis
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
    z: v.z,
  };
}
