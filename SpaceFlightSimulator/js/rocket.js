class Rocket {
  constructor() {
    this.parts = [];
    this.stages = [];
    this.currentStage = 0;
    this.position = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.angle = 0;
    this.angularVelocity = 0;
    this.fuel = 0;
    this.maxFuel = 0;
    this.mass = 0;
    this.dryMass = 0;
    this.throttle = 0;
    this.thrust = 0;
    this.activeEngine = null;
    this.dragCoeff = 0;
    this.crossSection = 1;
    this.deployables = {};
    this.isBuilt = false;
    this.stagingEnabled = true;
    this.rcsEnabled = false;
    this.totalParts = 0;
    this.height = 0;
    this.width = 1;
    this.separatedParts = [];
    this.parachutesDeployed = false;
    this.landingLegsDeployed = false;
  }

  addPart(partId, x, y) {
    const partDef = getPart(partId);
    if (!partDef) return false;

    const part = {
      ...partDef,
      id: `${partId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      partId: partId,
      gridX: x,
      gridY: y,
      fuel: partDef.fuelCapacity || 0,
      deployed: false,
      stage: 0,
    };

    this.parts.push(part);
    this.rebuildStages();
    this.updateStats();
    return true;
  }

  removePart(partId) {
    const idx = this.parts.findIndex(p => p.id === partId);
    if (idx === -1) return false;
    this.parts.splice(idx, 1);
    this.rebuildStages();
    this.updateStats();
    return true;
  }

  clear() {
    this.parts = [];
    this.stages = [];
    this.currentStage = 0;
    this.fuel = 0;
    this.maxFuel = 0;
    this.mass = 0;
    this.thrust = 0;
    this.isBuilt = false;
    this.separatedParts = [];
    this.parachutesDeployed = false;
    this.landingLegsDeployed = false;
  }

  rebuildStages() {
    const stages = new Set();
    for (const part of this.parts) {
      stages.add(part.stage);
    }
    this.stages = Array.from(stages).sort((a, b) => a - b);
    if (this.stages.length === 0) this.stages = [0];
  }

  updateStats() {
    let totalFuel = 0;
    let maxFuel = 0;
    let totalMass = 0;
    let totalDry = 0;
    let maxThrust = 0;
    let totalDrag = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    for (const part of this.parts) {
      totalMass += part.mass;
      maxFuel += part.fuelCapacity || 0;
      totalFuel += part.fuel || 0;
      if (part.type === 'engine' && part.stage === this.currentStage) {
        maxThrust += part.thrust * (this.throttle || 0);
      }
      if (part.dryMass) totalDry += part.dryMass;
      totalDrag += part.dragCoeff || 0;
      maxWidth = Math.max(maxWidth, part.width || 1);
      maxHeight += part.height || 0;

      if (part.type === 'fuel') {
        totalDry += part.dryMass || 0;
      }
    }

    this.fuel = totalFuel;
    this.maxFuel = maxFuel;
    this.mass = totalMass;
    this.dryMass = totalDry;
    this.thrust = maxThrust;
    this.dragCoeff = totalDrag / Math.max(1, this.parts.length);
    this.crossSection = maxWidth;
    this.width = maxWidth;
    this.height = maxHeight;
    this.isBuilt = this.parts.length > 0;
  }

  getStageParts(stageNum) {
    return this.parts.filter(p => p.stage === stageNum);
  }

  activateStage() {
    if (this.currentStage >= this.stages.length - 1) return false;

    const detachingStage = this.currentStage;
    const detachedParts = this.parts.filter(p => p.stage === detachingStage);
    const hasSeparators = detachedParts.some(p => p.partId === 'SEPARATOR');

    if (hasSeparators) {
      for (const part of detachedParts) {
        if (part.partId === 'SEPARATOR') {
          this.separatedParts.push({
            parts: detachedParts,
            position: { x: this.position.x, y: this.position.y },
            velocity: { x: this.velocity.x, y: this.velocity.y },
            time: Date.now(),
          });
        }
      }
      this.parts = this.parts.filter(p => p.stage !== detachingStage);
    }

    this.currentStage++;
    this.rebuildStages();
    this.updateStats();
    this.throttle = 0;
    return true;
  }

  setThrottle(value) {
    this.throttle = Math.max(0, Math.min(1, value));
    this.updateStats();
  }

  deployParachutes() {
    const chutes = this.parts.filter(p => p.partId === 'PARACHUTE' && !p.deployed);
    if (chutes.length === 0) return false;
    for (const chute of chutes) {
      chute.deployed = true;
    }
    this.parachutesDeployed = true;
    return true;
  }

  deployLandingLegs() {
    const legs = this.parts.filter(p => p.partId === 'LANDING_LEG' && !p.deployed);
    if (legs.length === 0) return false;
    for (const leg of legs) {
      leg.deployed = true;
    }
    this.landingLegsDeployed = true;
    return true;
  }

  getTotalCrossSection() {
    let area = this.crossSection * 0.5;
    if (this.parachutesDeployed) {
      const chutes = this.parts.filter(p => p.partId === 'PARACHUTE' && p.deployed);
      area += chutes.length * 8;
    }
    return area;
  }

  getRocketData() {
    return {
      parts: [...this.parts],
      stages: [...this.stages],
      currentStage: this.currentStage,
      mass: this.mass,
      fuel: this.fuel,
      maxFuel: this.maxFuel,
      thrust: this.thrust,
      throttle: this.throttle,
      height: this.height,
      deployedParachutes: this.parachutesDeployed,
      landingLegs: this.landingLegsDeployed,
    };
  }
}
