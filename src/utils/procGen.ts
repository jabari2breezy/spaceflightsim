/**
 * Procedural Planet Generation
 */

import { CelestialBodyData, Vector3 } from '../types';

// Seeded random number generator for consistent generation
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  choice<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }
}

/**
 * Generate a random planetary system
 */
export function generateStarSystem(
  systemId: string,
  seed: number
): Map<string, CelestialBodyData> {
  const rng = new SeededRandom(seed);
  const bodies = new Map<string, CelestialBodyData>();

  // Generate star
  const starMass = rng.range(0.5e30, 2e30); // 0.5 to 2 solar masses
  const starRadius = Math.pow(starMass / 2e30, 0.5) * 7e8; // Stefan-Boltzmann relation

  bodies.set('star', {
    id: 'star',
    name: `${systemId} A`,
    mass: starMass,
    radius: starRadius,
    rotationRate: rng.range(1e-7, 5e-6),
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    temperature: rng.range(3000, 10000),
  });

  // Generate planets
  const numPlanets = Math.floor(rng.range(2, 8));
  const AU = 1.496e11;

  for (let i = 0; i < numPlanets; i++) {
    const planetRng = new SeededRandom(seed + i + 1);

    // Orbital distance (AU)
    const orbitalDistance = AU * Math.pow(2, i + rng.range(0, 1));

    // Planet type
    const planetType = planetRng.choice(['terrestrial', 'terrestrial', 'terrestrial', 'gas_giant', 'ice_giant']);

    let mass: number;
    let radius: number;
    let hasAtmosphere = false;
    let atmosphere: CelestialBodyData['atmosphere'] | undefined;

    if (planetType === 'terrestrial') {
      mass = planetRng.range(0.1e24, 6e24);
      radius = Math.pow(mass / 5.9e24, 0.3) * 6.371e6;

      // Some terrestrial planets have atmospheres
      if (planetRng.next() > 0.5) {
        hasAtmosphere = true;
        const compositions = [
          ['N2', 'O2', 'Ar'],
          ['CO2'],
          ['N2', 'CO2'],
          ['H2', 'He'],
        ];
        atmosphere = {
          density: planetRng.range(0.01, 1.5),
          scaleHeight: planetRng.range(5000, 15000),
          composition: planetRng.choice(compositions),
        };
      }
    } else if (planetType === 'gas_giant') {
      mass = planetRng.range(50e24, 300e24);
      radius = Math.pow(mass / 5.9e24, 0.4) * 6.371e6;
      atmosphere = {
        density: planetRng.range(100, 1000),
        scaleHeight: planetRng.range(20000, 100000),
        composition: ['H2', 'He', 'CH4'],
      };
    } else {
      // Ice giant
      mass = planetRng.range(10e24, 100e24);
      radius = Math.pow(mass / 5.9e24, 0.35) * 6.371e6;
      atmosphere = {
        density: planetRng.range(10, 100),
        scaleHeight: planetRng.range(10000, 50000),
        composition: ['H2', 'He', 'CH4', 'NH3'],
      };
    }

    // Orbital velocity
    const G = 6.67430e-11;
    const orbitalVelocity = Math.sqrt((G * starMass) / orbitalDistance);

    const planet: CelestialBodyData = {
      id: `planet-${i}`,
      name: `${systemId} ${String.fromCharCode(66 + i)}`, // Star names like "Alpha Centauri B"
      mass,
      radius,
      rotationRate: planetRng.range(1e-7, 1e-4),
      position: {
        x: orbitalDistance,
        y: planetRng.range(-orbitalDistance * 0.1, orbitalDistance * 0.1),
        z: planetRng.range(-orbitalDistance * 0.1, orbitalDistance * 0.1),
      },
      velocity: {
        x: 0,
        y: orbitalVelocity,
        z: 0,
      },
      temperature: rng.range(150, 400), // Varies by distance from star
      ...(atmosphere && { atmosphere }),
    };

    bodies.set(`planet-${i}`, planet);

    // Generate moons
    const numMoons = Math.floor(planetRng.range(0, 3));
    for (let j = 0; j < numMoons; j++) {
      const moonRng = new SeededRandom(seed + i + j + 100);
      const moonOrbitalDistance = radius * (5 + moonRng.range(0, 5));
      const moonMass = moonRng.range(mass * 0.01, mass * 0.5);
      const moonRadius = Math.pow(moonMass / 5.9e24, 0.3) * 6.371e6;

      const moonOrbitalVelocity = Math.sqrt((G * mass) / moonOrbitalDistance);

      const moon: CelestialBodyData = {
        id: `moon-${i}-${j}`,
        name: `${planet.name} ${j + 1}`,
        mass: moonMass,
        radius: moonRadius,
        rotationRate: moonRng.range(1e-7, 1e-5),
        position: {
          x: planet.position.x + moonOrbitalDistance,
          y: planet.position.y + moonRng.range(-moonOrbitalDistance * 0.1, moonOrbitalDistance * 0.1),
          z: planet.position.z + moonRng.range(-moonOrbitalDistance * 0.1, moonOrbitalDistance * 0.1),
        },
        velocity: {
          x: planet.velocity.x,
          y: planet.velocity.y + moonOrbitalVelocity,
          z: planet.velocity.z,
        },
        temperature: 200,
      };

      bodies.set(`moon-${i}-${j}`, moon);
    }
  }

  return bodies;
}

/**
 * Generate a random sector of space with multiple star systems
 */
export function generateSector(
  sectorId: string,
  seed: number
): Map<string, CelestialBodyData> {
  const rng = new SeededRandom(seed);
  const allBodies = new Map<string, CelestialBodyData>();

  const numSystems = Math.floor(rng.range(3, 8));
  const AU = 1.496e11;

  for (let i = 0; i < numSystems; i++) {
    const systemSeed = seed + i;
    const system = generateStarSystem(`${sectorId}-S${i}`, systemSeed);

    // Position systems in sector
    const distance = AU * rng.range(10, 100);
    const angle = (i / numSystems) * Math.PI * 2;

    const offsetX = Math.cos(angle) * distance;
    const offsetZ = Math.sin(angle) * distance;

    for (const [id, body] of system.entries()) {
      const newId = `${sectorId}-${i}-${id}`;
      const newBody = {
        ...body,
        id: newId,
        position: {
          x: body.position.x + offsetX,
          y: body.position.y,
          z: body.position.z + offsetZ,
        },
        velocity: {
          ...body.velocity,
          x: body.velocity.x + rng.range(-1000, 1000),
          z: body.velocity.z + rng.range(-1000, 1000),
        },
      };
      allBodies.set(newId, newBody);
    }
  }

  return allBodies;
}

/**
 * Generate system characteristics
 */
export function getSystemCharacteristics(system: Map<string, CelestialBodyData>): {
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  landableBodies: number;
  orbitalBodies: number;
  resources: string[];
} {
  let landableBodies = 0;
  let orbitalBodies = system.size;
  const resources: string[] = [];

  for (const body of system.values()) {
    if (body.atmosphere && body.radius < 1e7) {
      landableBodies++;
      if (body.atmosphere.composition.includes('O2')) {
        resources.push('breathable-atmosphere');
      }
      if (body.atmosphere.density > 1) {
        resources.push('resources');
      }
    }

    if (body.mass < 1e23) {
      resources.push('mining-opportunity');
    }
  }

  let difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
  if (landableBodies > 3 || system.size > 15) {
    difficulty = 'advanced';
  } else if (landableBodies > 1 || system.size > 8) {
    difficulty = 'intermediate';
  }

  return {
    difficulty,
    landableBodies,
    orbitalBodies,
    resources: [...new Set(resources)],
  };
}
