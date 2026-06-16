/**
 * Main Game Manager and Simulation Core
 */

import { PhysicsEngine } from '../physics/engine';
import { SpacecraftBuilder, PARTS_LIBRARY } from './spacecraft';
import { createSolarSystem, createStarterSystem, getAltitude } from './bodies';
import { MoonGuidance } from '../physics/guidance';
import {
  SimulationState,
  PhysicsState,
  CelestialBodyData,
  Spacecraft,
  Vector3,
  Mission,
} from '../types';

export class CelestiaGame {
  private physicsEngine: PhysicsEngine | null = null;
  private simulationState: SimulationState;
  private bodies: Map<string, CelestialBodyData>;
  private spacecraft: Spacecraft | null = null;
  private missions: Mission[] = [];
  private isRunning = false;
  private lastFrameTime = 0;

  public throttle = 0; // 0 to 100
  public pitchAngle = 90; // degrees
  public unlimitedFuel = false;
  public autopilotActive = false;
  public guidance: MoonGuidance = new MoonGuidance();
  public autopilotMessage = 'Autopilot offline';

  constructor(systemType: 'starter' | 'full' = 'starter') {
    // Initialize celestial bodies
    this.bodies = systemType === 'starter' ? createStarterSystem() : createSolarSystem();

    // Initialize simulation state
    this.simulationState = {
      currentTime: 0,
      timeScale: 1,
      paused: false,
      spacecraft: {
        id: '',
        name: '',
        stages: [],
        mass: 0,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      },
      celestialBodies: Array.from(this.bodies.values()),
      trajectoryHistory: [],
    };
  }

  /**
   * Build a new spacecraft using the builder
   */
  buildSpacecraft(name: string, designCallback: (builder: SpacecraftBuilder) => void): boolean {
    const builder = new SpacecraftBuilder(name);

    // Let the user design the spacecraft
    designCallback(builder);

    // Validate the design
    const validation = builder.validate();
    if (!validation.valid) {
      console.error('Invalid spacecraft design:', validation.errors);
      return false;
    }

    // Build and set the spacecraft
    this.spacecraft = builder.build();
    this.simulationState.spacecraft = this.spacecraft;

    // Initialize physics engine
    const earthBody = this.bodies.get('earth');
    if (earthBody) {
      // Start on the ground at Earth
      const initialHeight = earthBody.radius + 100000; // 100 km altitude
      this.spacecraft.position = {
        x: earthBody.position.x + initialHeight,
        y: 0,
        z: 0,
      };

      // Initial velocity at surface
      const surfaceVelocity = 7850; // m/s for 100 km altitude
      this.spacecraft.velocity = {
        x: 0,
        y: surfaceVelocity,
        z: 0,
      };

      const initialState: PhysicsState = {
        position: this.spacecraft.position,
        velocity: this.spacecraft.velocity,
        acceleration: { x: 0, y: 0, z: 0 },
        rotation: this.spacecraft.rotation,
        angularVelocity: this.spacecraft.angularVelocity,
        mass: this.spacecraft.mass,
        temperature: 288,
      };

      this.physicsEngine = new PhysicsEngine(initialState);

      // Add all bodies to physics engine
      for (const body of this.bodies.values()) {
        this.physicsEngine.addBody(body);
      }

      return true;
    }

    return false;
  }

  /**
   * Load spacecraft directly from built stage parts and initialize on Earth surface
   */
  loadSpacecraft(spacecraft: Spacecraft): void {
    this.spacecraft = spacecraft;
    this.simulationState.spacecraft = spacecraft;

    const earthBody = this.bodies.get('earth');
    if (earthBody) {
      // Start sitting on Earth surface (just above radius)
      const initialHeight = earthBody.radius + 15;
      this.spacecraft.position = {
        x: earthBody.position.x + initialHeight,
        y: 0,
        z: 0,
      };

      // Sitting stationary relative to surface
      this.spacecraft.velocity = {
        x: 0,
        y: 0,
        z: 0,
      };

      const initialState: PhysicsState = {
        position: this.spacecraft.position,
        velocity: this.spacecraft.velocity,
        acceleration: { x: 0, y: 0, z: 0 },
        rotation: this.spacecraft.rotation,
        angularVelocity: this.spacecraft.angularVelocity,
        mass: this.spacecraft.mass,
        temperature: 288,
      };

      this.physicsEngine = new PhysicsEngine(initialState);

      // Add all bodies to physics engine
      for (const body of this.bodies.values()) {
        this.physicsEngine.addBody(body);
      }
    }
  }

  /**
   * Start the simulation
   */
  start(): void {
    if (!this.physicsEngine || !this.spacecraft) {
      console.error('Cannot start simulation: spacecraft not built or physics engine not initialized');
      return;
    }
    this.isRunning = true;
    this.lastFrameTime = performance.now();
  }

  /**
   * Pause/unpause simulation
   */
  togglePause(): void {
    this.simulationState.paused = !this.simulationState.paused;
  }

  /**
   * Set time scale (1 = real-time, 10 = 10x faster)
   */
  setTimeScale(scale: number): void {
    this.simulationState.timeScale = Math.max(0.1, Math.min(1000, scale));
  }

  /**
   * Update simulation frame
   */
  update(): void {
    if (!this.isRunning || !this.physicsEngine || this.simulationState.paused) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = currentTime;

    // Apply time scale
    const scaledDeltaTime = deltaTime * this.simulationState.timeScale;

    // Compute autopilot step if enabled
    let currentThrottle = this.throttle;
    let targetPitch = this.pitchAngle; // in degrees
    
    if (this.autopilotActive && this.guidance) {
      const autoOut = this.guidance.update(this, currentThrottle);
      this.throttle = autoOut.throttle;
      this.pitchAngle = autoOut.pitch;
      this.autopilotMessage = autoOut.statusMessage;
      if (autoOut.stageRequired) {
        this.triggerStage();
      }
      currentThrottle = this.throttle;
      targetPitch = this.pitchAngle;
    }

    // Calculate active thrust vector in 2D (along the pitch angle)
    const rad = (targetPitch * Math.PI) / 180;
    const maxThrust = this.getSpacecraftThrust();
    
    // Check fuel levels
    const totalFuelLeft = this.getSpacecraftFuel();
    let thrustMag = maxThrust * (currentThrottle / 100);

    if (totalFuelLeft <= 0 && !this.unlimitedFuel) {
      thrustMag = 0; // Out of fuel
    }

    // Consume fuel if not unlimited
    if (thrustMag > 0 && !this.unlimitedFuel && this.spacecraft) {
      const isp = 300; // Average ISP
      const fuelFlow = thrustMag / (isp * 9.81); // kg/s
      this.consumeFuel(fuelFlow * scaledDeltaTime);
    }

    if (this.spacecraft && this.physicsEngine) {
      let currentMass = 0;
      for (const stage of this.spacecraft.stages) {
        for (const part of stage.parts) {
          currentMass += part.dryMass;
          if (part.type === 'tank') {
            currentMass += part.properties.fuelLeft ?? part.properties.capacity ?? 0;
          }
        }
      }
      this.spacecraft.mass = currentMass;
      this.physicsEngine.setState({ mass: currentMass });
    }

    const thrustVector = {
      x: Math.cos(rad) * thrustMag,
      y: Math.sin(rad) * thrustMag,
      z: 0,
    };

    // Update physics with thrust force
    this.physicsEngine.update(scaledDeltaTime, thrustVector);

    // Update spacecraft state from physics engine
    if (this.spacecraft) {
      const physicsState = this.physicsEngine.getState();
      this.spacecraft.position = physicsState.position;
      this.spacecraft.velocity = physicsState.velocity;
      this.spacecraft.rotation = { x: 0, y: 0, z: rad };
      this.simulationState.spacecraft = this.spacecraft;
    }

    // Update simulation time
    this.simulationState.currentTime += scaledDeltaTime;

    // Record trajectory
    const trajectory = this.physicsEngine.getTrajectoryHistory();
    this.simulationState.trajectoryHistory = trajectory.slice(-1000); // Keep last 1000 points
  }

  /**
   * Create a new mission
   */
  createMission(name: string, objectives: string[] = []): Mission {
    const mission: Mission = {
      id: `mission-${Date.now()}`,
      name,
      objectives: objectives.map((desc, idx) => ({
        id: `obj-${idx}`,
        description: desc,
        completed: false,
      })),
      status: 'planning',
      createdAt: Date.now(),
    };

    this.missions.push(mission);
    return mission;
  }

  /**
   * Get current orbital info
   */
  getOrbitalInfo() {
    if (!this.physicsEngine || !this.spacecraft) {
      return null;
    }

    const earthBody = this.bodies.get('earth');
    if (!earthBody) {
      return null;
    }

    const orbit = this.physicsEngine.calculateOrbit(earthBody);
    const altitude = getAltitude(this.spacecraft.position, earthBody);

    return {
      orbit,
      altitude,
      velocity: this.spacecraft.velocity,
      position: this.spacecraft.position,
    };
  }

  /**
   * Get simulation state (for rendering)
   */
  getSimulationState(): SimulationState {
    return { ...this.simulationState };
  }

  /**
   * Get celestial bodies
   */
  getCelestialBodies(): CelestialBodyData[] {
    return Array.from(this.bodies.values());
  }

  /**
   * Get spacecraft
   */
  getSpacecraft(): Spacecraft | null {
    return this.spacecraft ? { ...this.spacecraft } : null;
  }

  /**
   * Get missions
   */
  getMissions(): Mission[] {
    return [...this.missions];
  }

  /**
   * Stop simulation
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Reset simulation
   */
  reset(): void {
    this.stop();
    this.physicsEngine = null;
    this.spacecraft = null;
    this.missions = [];
    this.simulationState.currentTime = 0;
    this.simulationState.trajectoryHistory = [];
  }

  /**
   * Calculate orbital maneuver requirements
   */
  calculateManeuver(
    targetAltitude: number,
    currentAltitude: number,
    bodyMass: number,
    bodyRadius: number
  ): { deltaV: number; burnTime: number } {
    const G = 6.67430e-11;
    const currentRadius = bodyRadius + currentAltitude;
    const targetRadius = bodyRadius + targetAltitude;

    // Hohmann transfer deltaV
    const mu = G * bodyMass;
    const v1 = Math.sqrt(mu / currentRadius);
    const v2 = Math.sqrt(mu / targetRadius);
    const va = Math.sqrt(mu * (2 / currentRadius - 1 / ((currentRadius + targetRadius) / 2)));

    const deltaV1 = va - v1;
    const deltaV2 = v2 - Math.sqrt(mu * (2 / targetRadius - 1 / ((currentRadius + targetRadius) / 2)));

    const totalDeltaV = deltaV1 + deltaV2;

    // Estimate burn time based on thrust and mass
    let burnTime = 0;
    if (this.spacecraft) {
      const thrust = this.getSpacecraftThrust();
      if (thrust > 0) {
        const acceleration = thrust / this.spacecraft.mass;
        burnTime = totalDeltaV / acceleration;
      }
    }

    return {
      deltaV: totalDeltaV,
      burnTime,
    };
  }

  /**
   * Get total spacecraft thrust
   */
  getSpacecraftThrust(): number {
    if (!this.spacecraft) return 0;

    let totalThrust = 0;
    for (const stage of this.spacecraft.stages) {
      for (const part of stage.parts) {
        if (part.type === 'engine' && part.properties.thrustVacuum) {
          totalThrust += part.properties.thrustVacuum;
        }
      }
    }
    return totalThrust;
  }

  /**
   * Get spacecraft deltaV capability
   */
  getSpacecraftDeltaV(): number {
    if (!this.spacecraft) return 0;

    let totalDeltaV = 0;

    for (const stage of this.spacecraft.stages) {
      let stageInitialMass = 0;
      let stageFinalMass = 0;
      let stageIsp = 0;

      for (const part of stage.parts) {
        stageInitialMass += part.dryMass;

        if (part.type === 'tank' && part.properties.capacity) {
          stageInitialMass += part.properties.capacity;
          stageFinalMass += part.dryMass;
        } else if (part.type === 'engine') {
          stageFinalMass += part.dryMass;
          if (part.properties.specificImpulseVacuum) {
            stageIsp = Math.max(stageIsp, part.properties.specificImpulseVacuum);
          }
        } else {
          stageFinalMass += part.dryMass;
        }
      }

      if (stageInitialMass > stageFinalMass && stageIsp > 0) {
        const g = 9.81;
        const deltaV = stageIsp * g * Math.log(stageInitialMass / stageFinalMass);
        totalDeltaV += deltaV;
      }
    }

    return totalDeltaV;
  }

  /**
   * Get total spacecraft fuel mass
   */
  getSpacecraftFuel(): number {
    if (!this.spacecraft) return 0;
    let totalFuel = 0;
    for (const stage of this.spacecraft.stages) {
      for (const part of stage.parts) {
        if (part.type === 'tank') {
          if (part.properties.fuelLeft === undefined) {
            part.properties.fuelLeft = part.properties.capacity || 10000;
          }
          totalFuel += part.properties.fuelLeft;
        }
      }
    }
    return totalFuel;
  }

  /**
   * Consume fuel from active tanks
   */
  consumeFuel(amount: number): void {
    if (!this.spacecraft) return;
    let needed = amount;
    for (const stage of this.spacecraft.stages) {
      for (const part of stage.parts) {
        if (part.type === 'tank') {
          if (part.properties.fuelLeft === undefined) {
            part.properties.fuelLeft = part.properties.capacity || 10000;
          }
          const fuel = part.properties.fuelLeft;
          if (fuel > 0) {
            const consumed = Math.min(fuel, needed);
            part.properties.fuelLeft -= consumed;
            needed -= consumed;
            if (needed <= 0) return;
          }
        }
      }
    }
  }

  /**
   * Trigger next stage
   */
  triggerStage(): boolean {
    if (!this.spacecraft || this.spacecraft.stages.length <= 1) return false;
    // Remove the bottom stage
    this.spacecraft.stages.shift();
    if (this.physicsEngine) {
      const state = this.physicsEngine.getState();
      state.mass = this.spacecraft.stages.reduce((m, stage) => {
        return m + stage.parts.reduce((pm, p) => pm + p.dryMass + (p.type === 'tank' ? (p.properties.fuelLeft ?? p.properties.capacity ?? 10000) : 0), 0);
      }, 0);
      this.physicsEngine.setState({ mass: state.mass });
    }
    return true;
  }
}
