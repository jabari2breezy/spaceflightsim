/**
 * Celestial Bodies and Solar System Management
 */

import { CelestialBodyData, Vector3 } from '../types';

const AU = 1.496e11; // Astronomical Unit in meters
const SUN_MASS = 1.989e30; // kg
const SUN_RADIUS = 6.96e8; // meters
const EARTH_MASS = 5.972e24; // kg
const EARTH_RADIUS = 6.371e6; // meters
const MOON_MASS = 7.342e22; // kg
const MOON_RADIUS = 1.737e6; // meters
const MARS_MASS = 6.417e23; // kg
const MARS_RADIUS = 3.389e6; // meters

/**
 * Create a predefined solar system
 */
export function createSolarSystem(): Map<string, CelestialBodyData> {
  const bodies = new Map<string, CelestialBodyData>();

  // Sun
  bodies.set('sun', {
    id: 'sun',
    name: 'Sun',
    mass: SUN_MASS,
    radius: SUN_RADIUS,
    rotationRate: 2.97e-6, // rad/s
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    temperature: 5778,
    magneticField: 1.0,
  });

  // Earth
  bodies.set('earth', {
    id: 'earth',
    name: 'Earth',
    mass: EARTH_MASS,
    radius: EARTH_RADIUS,
    rotationRate: 7.29e-5, // rad/s
    position: { x: 1 * AU, y: 0, z: 0 },
    velocity: { x: 0, y: 29780, z: 0 }, // m/s orbital velocity
    temperature: 288,
    atmosphere: {
      density: 1.225, // kg/m^3 at sea level
      scaleHeight: 8500, // meters
      composition: ['N2', 'O2', 'Ar', 'CO2'],
    },
    magneticField: 3e-5,
  });

  // Moon
  bodies.set('moon', {
    id: 'moon',
    name: 'Moon',
    mass: MOON_MASS,
    radius: MOON_RADIUS,
    rotationRate: 2.66e-6, // rad/s
    position: { x: 1 * AU + 3.84e8, y: 0, z: 0 }, // 384,400 km from Earth
    velocity: { x: 0, y: 29780 + 1022, z: 0 }, // m/s
    temperature: 250,
  });

  // Mars
  bodies.set('mars', {
    id: 'mars',
    name: 'Mars',
    mass: MARS_MASS,
    radius: MARS_RADIUS,
    rotationRate: 7.08e-5, // rad/s (slightly faster than Earth)
    position: { x: 1.52 * AU, y: 0, z: 0 },
    velocity: { x: 0, y: 24070, z: 0 }, // m/s orbital velocity
    temperature: 210,
    atmosphere: {
      density: 0.020, // kg/m^3 at sea level (very thin)
      scaleHeight: 11500, // meters
      composition: ['CO2', 'N2', 'Ar'],
    },
  });

  // Venus
  bodies.set('venus', {
    id: 'venus',
    name: 'Venus',
    mass: 4.867e24,
    radius: 6.052e6,
    rotationRate: -2.99e-7, // rad/s (rotates backwards!)
    position: { x: 0.72 * AU, y: 0, z: 0 },
    velocity: { x: 0, y: 35020, z: 0 },
    temperature: 737, // Hottest planet
    atmosphere: {
      density: 67.0, // Very dense!
      scaleHeight: 15900,
      composition: ['CO2', 'N2'],
    },
  });

  // Mercury
  bodies.set('mercury', {
    id: 'mercury',
    name: 'Mercury',
    mass: 3.285e23,
    radius: 2.44e6,
    rotationRate: 1.24e-6,
    position: { x: 0.387 * AU, y: 0, z: 0 },
    velocity: { x: 0, y: 47360, z: 0 },
    temperature: 440, // Varies greatly
  });

  // Jupiter
  bodies.set('jupiter', {
    id: 'jupiter',
    name: 'Jupiter',
    mass: 1.898e27,
    radius: 7.0e7,
    rotationRate: 1.758e-4, // Rotates fast!
    position: { x: 5.2 * AU, y: 0, z: 0 },
    velocity: { x: 0, y: 13070, z: 0 },
    temperature: 165,
    magneticField: 4.28e-4, // Strong magnetic field
  });

  // Saturn
  bodies.set('saturn', {
    id: 'saturn',
    name: 'Saturn',
    mass: 5.683e26,
    radius: 6.0e7,
    rotationRate: 1.634e-4,
    position: { x: 9.54 * AU, y: 0, z: 0 },
    velocity: { x: 0, y: 9680, z: 0 },
    temperature: 134,
    magneticField: 2.1e-5,
  });

  return bodies;
}

/**
 * Create a starter system (Earth-Moon only, for learning)
 */
export function createStarterSystem(): Map<string, CelestialBodyData> {
  const bodies = new Map<string, CelestialBodyData>();

  bodies.set('earth', {
    id: 'earth',
    name: 'Earth',
    mass: EARTH_MASS,
    radius: EARTH_RADIUS,
    rotationRate: 7.29e-5,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    temperature: 288,
    atmosphere: {
      density: 1.225,
      scaleHeight: 8500,
      composition: ['N2', 'O2', 'Ar', 'CO2'],
    },
    magneticField: 3e-5,
  });

  bodies.set('moon', {
    id: 'moon',
    name: 'Moon',
    mass: MOON_MASS,
    radius: MOON_RADIUS,
    rotationRate: 2.66e-6,
    position: { x: 3.84e8, y: 0, z: 0 },
    velocity: { x: 0, y: 1022, z: 0 },
    temperature: 250,
  });

  return bodies;
}

/**
 * Calculate the distance between two bodies
 */
export function distanceBetweenBodies(
  body1: CelestialBodyData,
  body2: CelestialBodyData
): number {
  const dx = body2.position.x - body1.position.x;
  const dy = body2.position.y - body1.position.y;
  const dz = body2.position.z - body1.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate orbital velocity for a given altitude
 */
export function calculateOrbitalVelocity(
  bodyMass: number,
  altitude: number,
  bodyRadius: number
): number {
  const G = 6.67430e-11;
  const r = bodyRadius + altitude;
  return Math.sqrt((G * bodyMass) / r);
}

/**
 * Calculate escape velocity from a body
 */
export function calculateEscapeVelocity(bodyMass: number, bodyRadius: number): number {
  const G = 6.67430e-11;
  return Math.sqrt((2 * G * bodyMass) / bodyRadius);
}

/**
 * Find closest body to a position
 */
export function findClosestBody(
  position: Vector3,
  bodies: Map<string, CelestialBodyData>
): CelestialBodyData | null {
  let closest: CelestialBodyData | null = null;
  let minDistance = Infinity;

  for (const body of bodies.values()) {
    const dx = body.position.x - position.x;
    const dy = body.position.y - position.y;
    const dz = body.position.z - position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < minDistance) {
      minDistance = distance;
      closest = body;
    }
  }

  return closest;
}

/**
 * Get body by name
 */
export function getBodyByName(
  name: string,
  bodies: Map<string, CelestialBodyData>
): CelestialBodyData | undefined {
  for (const body of bodies.values()) {
    if (body.name.toLowerCase() === name.toLowerCase()) {
      return body;
    }
  }
  return undefined;
}

/**
 * Check if a position is inside a body
 */
export function isInsideBody(
  position: Vector3,
  body: CelestialBodyData
): boolean {
  const dx = position.x - body.position.x;
  const dy = position.y - body.position.y;
  const dz = position.z - body.position.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return distance < body.radius;
}

/**
 * Get altitude above a body
 */
export function getAltitude(position: Vector3, body: CelestialBodyData): number {
  const dx = position.x - body.position.x;
  const dy = position.y - body.position.y;
  const dz = position.z - body.position.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Math.max(0, distance - body.radius);
}
