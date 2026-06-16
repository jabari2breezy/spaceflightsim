/**
 * Spacecraft Builder and Parts System
 */

import { Spacecraft, SpacecraftPart, Stage, Vector3 } from '../types';

export interface EngineProperties {
  thrustVacuum: number; // Newtons
  thrustSeaLevel: number; // Newtons
  specificImpulseVacuum: number; // seconds
  specificImpulseSeaLevel: number; // seconds
  maxGimbalAngle: number; // radians
  combustionChamberTemperature: number; // Kelvin
}

export interface FuelTankProperties {
  capacity: number; // kg
  fuelTypes: string[]; // e.g., ["RP1", "LH2"]
  boiloffRate: number; // kg/s at room temperature
}

export interface AvionicsProperties {
  computerPower: number; // FLOPS
  communicationRange: number; // meters
  sensorTypes: string[]; // e.g., ["radar", "lidar", "spectrometer"]
}

export interface HeatShieldProperties {
  material: string; // e.g., "ablative", "radiative"
  maxTemperature: number; // Kelvin
  ablationRate: number; // kg/(m^2 s K)
}

/**
 * Part Library - Predefined spacecraft components
 */
export const PARTS_LIBRARY: Record<string, SpacecraftPart> = {
  // Engines
  'merlin-1d': {
    id: 'merlin-1d',
    name: 'Merlin 1D',
    type: 'engine',
    dryMass: 470,
    cost: 1500,
    dimensions: { x: 1.5, y: 1.5, z: 2.5 },
    properties: {
      thrustVacuum: 854000,
      thrustSeaLevel: 710000,
      specificImpulseVacuum: 312,
      specificImpulseSeaLevel: 260,
      maxGimbalAngle: 0.087,
    } as EngineProperties,
  },
  'rs-25': {
    id: 'rs-25',
    name: 'RS-25 (SSME)',
    type: 'engine',
    dryMass: 3617,
    cost: 4000,
    dimensions: { x: 2.1, y: 2.1, z: 4.2 },
    properties: {
      thrustVacuum: 2279000,
      thrustSeaLevel: 1860000,
      specificImpulseVacuum: 453,
      specificImpulseSeaLevel: 366,
      maxGimbalAngle: 0.087,
    } as EngineProperties,
  },
  'ion-drive': {
    id: 'ion-drive',
    name: 'Ion Thruster (NEXT)',
    type: 'engine',
    dryMass: 113,
    cost: 800,
    dimensions: { x: 0.5, y: 0.5, z: 1.0 },
    properties: {
      thrustVacuum: 0.092,
      thrustSeaLevel: 0,
      specificImpulseVacuum: 4190,
      specificImpulseSeaLevel: 0,
      maxGimbalAngle: 0.017,
    } as EngineProperties,
  },

  // Fuel Tanks
  'lh2-tank-1': {
    id: 'lh2-tank-1',
    name: 'LH2 Tank (1000L)',
    type: 'tank',
    dryMass: 345,
    cost: 600,
    dimensions: { x: 1.2, y: 1.2, z: 2.5 },
    properties: {
      capacity: 62500, // 1000L * 62.5 kg/m^3 density
      fuelTypes: ['LH2'],
      boiloffRate: 0.001,
    } as FuelTankProperties,
  },
  'rp1-tank-1': {
    id: 'rp1-tank-1',
    name: 'RP-1 Tank (1000L)',
    type: 'tank',
    dryMass: 450,
    cost: 500,
    dimensions: { x: 1.2, y: 1.2, z: 2.5 },
    properties: {
      capacity: 830000, // 1000L * 830 kg/m^3 density
      fuelTypes: ['RP1'],
      boiloffRate: 0.0001,
    } as FuelTankProperties,
  },

  // Avionics
  'guidance-computer': {
    id: 'guidance-computer',
    name: 'Flight Computer (ACE)',
    type: 'avionics',
    dryMass: 45,
    cost: 2000,
    dimensions: { x: 0.3, y: 0.3, z: 0.5 },
    properties: {
      computerPower: 1e12,
      communicationRange: 1e9,
      sensorTypes: ['accelerometer', 'gyroscope', 'thermometer'],
    } as AvionicsProperties,
  },

  // Heat Shields
  'ablative-shield': {
    id: 'ablative-shield',
    name: 'Ablative Heat Shield',
    type: 'heatshield',
    dryMass: 125,
    cost: 800,
    dimensions: { x: 2.0, y: 2.0, z: 0.5 },
    properties: {
      material: 'ablative',
      maxTemperature: 1600,
      ablationRate: 0.0001,
    } as HeatShieldProperties,
  },

  // Structure
  'tank-cap-large': {
    id: 'tank-cap-large',
    name: 'Tank Cap (Large)',
    type: 'structure',
    dryMass: 50,
    cost: 100,
    dimensions: { x: 1.2, y: 1.2, z: 0.2 },
    properties: {},
  },
  'interstage': {
    id: 'interstage',
    name: 'Interstage',
    type: 'structure',
    dryMass: 75,
    cost: 150,
    dimensions: { x: 1.5, y: 1.5, z: 0.5 },
    properties: {},
  },

  // RCS
  'rcs-thruster': {
    id: 'rcs-thruster',
    name: 'RCS Thruster',
    type: 'rcs',
    dryMass: 8,
    cost: 200,
    dimensions: { x: 0.1, y: 0.1, z: 0.15 },
    properties: {
      thrustVacuum: 445,
      thrustSeaLevel: 370,
      specificImpulseVacuum: 290,
      specificImpulseSeaLevel: 240,
    },
  },

  // Solar & Antenna
  'solar-panel': {
    id: 'solar-panel',
    name: 'Solar Panel',
    type: 'solar',
    dryMass: 30,
    cost: 500,
    dimensions: { x: 3.0, y: 1.5, z: 0.05 },
    properties: {
      powerOutput: 5000, // Watts in sunlight
    },
  },
  'antenna-hga': {
    id: 'antenna-hga',
    name: 'High-Gain Antenna',
    type: 'antenna',
    dryMass: 25,
    cost: 800,
    dimensions: { x: 2.5, y: 2.5, z: 0.3 },
    properties: {
      communicationRange: 1e10,
    },
  },
};

/**
 * Spacecraft Builder Class
 */
export class SpacecraftBuilder {
  private spacecraft: Spacecraft;
  private nextPartId = 0;

  constructor(name: string) {
    this.spacecraft = {
      id: `sc-${Date.now()}`,
      name,
      stages: [],
      mass: 0,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    };
  }

  /**
   * Add a new stage
   */
  addStage(): void {
    const stageNumber = this.spacecraft.stages.length + 1;
    this.spacecraft.stages.push({
      number: stageNumber,
      parts: [],
      active: false,
    });
  }

  /**
   * Add a part to a stage
   */
  addPartToStage(stageIndex: number, partId: string, quantity: number = 1): boolean {
    if (stageIndex < 0 || stageIndex >= this.spacecraft.stages.length) {
      return false;
    }

    const partTemplate = PARTS_LIBRARY[partId];
    if (!partTemplate) {
      return false;
    }

    for (let i = 0; i < quantity; i++) {
      const part: SpacecraftPart = {
        ...partTemplate,
        id: `${partTemplate.id}-${this.nextPartId++}`,
      };
      this.spacecraft.stages[stageIndex].parts.push(part);
    }

    this.recalculateMass();
    return true;
  }

  /**
   * Remove a part from a stage
   */
  removePartFromStage(stageIndex: number, partIndex: number): boolean {
    if (
      stageIndex < 0 ||
      stageIndex >= this.spacecraft.stages.length ||
      partIndex < 0 ||
      partIndex >= this.spacecraft.stages[stageIndex].parts.length
    ) {
      return false;
    }

    this.spacecraft.stages[stageIndex].parts.splice(partIndex, 1);
    this.recalculateMass();
    return true;
  }

  /**
   * Calculate total spacecraft mass
   */
  private recalculateMass(): void {
    let totalMass = 0;
    for (const stage of this.spacecraft.stages) {
      for (const part of stage.parts) {
        totalMass += part.dryMass;
        // Add fuel mass if it's a tank
        if (part.type === 'tank') {
          const props = part.properties as FuelTankProperties;
          totalMass += props.capacity;
        }
      }
    }
    this.spacecraft.mass = totalMass;
  }

  /**
   * Get total cost of spacecraft
   */
  getTotalCost(): number {
    let totalCost = 0;
    for (const stage of this.spacecraft.stages) {
      for (const part of stage.parts) {
        totalCost += part.cost;
      }
    }
    return totalCost;
  }

  /**
   * Calculate total thrust available
   */
  getTotalThrust(throttle: number = 1.0): number {
    let totalThrust = 0;
    for (const stage of this.spacecraft.stages) {
      for (const part of stage.parts) {
        if (part.type === 'engine') {
          const props = part.properties as EngineProperties;
          totalThrust += props.thrustVacuum * throttle;
        }
      }
    }
    return totalThrust;
  }

  /**
   * Calculate total fuel capacity
   */
  getTotalFuelCapacity(): number {
    let totalCapacity = 0;
    for (const stage of this.spacecraft.stages) {
      for (const part of stage.parts) {
        if (part.type === 'tank') {
          const props = part.properties as FuelTankProperties;
          totalCapacity += props.capacity;
        }
      }
    }
    return totalCapacity;
  }

  /**
   * Calculate TWR (Thrust-to-Weight Ratio) on a body
   */
  calculateTWR(bodyMass: number, bodyRadius: number): number {
    const g = (G * bodyMass) / (bodyRadius * bodyRadius);
    const weight = this.spacecraft.mass * g;
    const thrust = this.getTotalThrust();
    return thrust / weight;
  }

  /**
   * Calculate deltaV (Tsiolkovsky rocket equation)
   */
  calculateDeltaV(): number {
    let totalDeltaV = 0;

    for (const stage of this.spacecraft.stages) {
      let stageInitialMass = 0;
      let stageFinalMass = 0;
      let stagIsp = 0;

      for (const part of stage.parts) {
        stageInitialMass += part.dryMass;

        if (part.type === 'tank') {
          const props = part.properties as FuelTankProperties;
          stageInitialMass += props.capacity;
          stageFinalMass += part.dryMass;
        } else if (part.type === 'engine') {
          stageFinalMass += part.dryMass;
          const props = part.properties as EngineProperties;
          stagIsp = Math.max(stagIsp, props.specificImpulseVacuum);
        } else {
          stageFinalMass += part.dryMass;
        }
      }

      if (stageInitialMass > stageFinalMass && stagIsp > 0) {
        const g = 9.81;
        const deltaV = stagIsp * g * Math.log(stageInitialMass / stageFinalMass);
        totalDeltaV += deltaV;
      }
    }

    return totalDeltaV;
  }

  /**
   * Get the built spacecraft
   */
  build(): Spacecraft {
    return { ...this.spacecraft };
  }

  /**
   * Validate spacecraft design
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.spacecraft.stages.length === 0) {
      errors.push('Spacecraft must have at least one stage');
    }

    for (let i = 0; i < this.spacecraft.stages.length; i++) {
      const stage = this.spacecraft.stages[i];

      if (stage.parts.length === 0) {
        errors.push(`Stage ${i + 1} has no parts`);
      }

      const hasEngine = stage.parts.some((p) => p.type === 'engine');
      const hasTank = stage.parts.some((p) => p.type === 'tank');

      if (hasEngine && !hasTank) {
        errors.push(`Stage ${i + 1} has engines but no fuel tanks`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Gravitational constant
const G = 6.67430e-11;
