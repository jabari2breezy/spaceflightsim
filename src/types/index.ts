/**
 * Core type definitions for Celestia
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface CelestialBodyData {
  id: string;
  name: string;
  mass: number; // kg
  radius: number; // meters
  rotationRate: number; // rad/s
  atmosphere?: {
    density: number; // kg/m^3 at sea level
    scaleHeight: number; // meters
    composition: string[]; // e.g., ["N2", "O2", "Ar"]
  };
  position: Vector3; // meters
  velocity: Vector3; // m/s
  temperature: number; // Kelvin
  magneticField?: number; // Tesla
}

export interface SpacecraftPart {
  id: string;
  name: string;
  type: 'engine' | 'tank' | 'avionics' | 'heatshield' | 'solar' | 'antenna' | 'rcs' | 'structure';
  dryMass: number; // kg
  cost: number; // arbitrary units
  dimensions: Vector3;
  properties: Record<string, any>;
}

export interface Stage {
  number: number;
  parts: SpacecraftPart[];
  active: boolean;
}

export interface Spacecraft {
  id: string;
  name: string;
  stages: Stage[];
  mass: number; // calculated
  position: Vector3;
  velocity: Vector3;
  rotation: Vector3; // Euler angles
  angularVelocity: Vector3;
}

export interface PhysicsState {
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
  rotation: Vector3; // Euler angles (roll, pitch, yaw)
  angularVelocity: Vector3;
  mass: number;
  temperature: number; // Kelvin
}

export interface Orbit {
  semiMajorAxis: number; // meters
  eccentricity: number;
  inclination: number; // radians
  argumentOfPeriapsis: number; // radians
  longitudeOfAscendingNode: number; // radians
  trueAnomaly: number; // radians
  period: number; // seconds
  apoApsis: number; // meters
  periApsis: number; // meters
}

export interface Mission {
  id: string;
  name: string;
  objectives: MissionObjective[];
  status: 'planning' | 'active' | 'completed' | 'failed';
  createdAt: number;
}

export interface MissionObjective {
  id: string;
  description: string;
  targetBody?: string;
  targetAltitude?: number;
  completed: boolean;
}

export interface TrajectoryPoint {
  position: Vector3;
  velocity: Vector3;
  time: number;
}

export interface SimulationState {
  currentTime: number;
  timeScale: number;
  paused: boolean;
  spacecraft: Spacecraft;
  celestialBodies: CelestialBodyData[];
  trajectoryHistory: TrajectoryPoint[];
}

export interface SavedGame {
  id: string;
  name: string;
  timestamp: number;
  version: string;
  simulationState: SimulationState;
  missions: Mission[];
  spacecraft: Spacecraft[];
}
