const Physics = {
  G: 6.674e-11,

  gravity(bodyMass, distance) {
    if (distance < 1) return 0;
    return (this.G * bodyMass) / (distance * distance);
  },

  atmDensity(body, altitude) {
    if (!body.atmosphere) return 0;
    if (altitude > body.atmosphere.maxHeight) return 0;
    const h = body.atmosphere.scaleHeight || 8500;
    return body.atmosphere.seaLevelDensity * Math.exp(-altitude / h);
  },

  atmPressure(body, altitude) {
    if (!body.atmosphere) return 0;
    if (altitude > body.atmosphere.maxHeight) return 0;
    const h = body.atmosphere.scaleHeight || 8500;
    return body.atmosphere.seaLevelPressure * Math.exp(-altitude / h);
  },

  dragForce(density, velocity, crossSection, dragCoeff) {
    const vMag = magnitude(velocity);
    if (vMag < 0.01) return { x: 0, y: 0 };
    const dragMag = 0.5 * density * vMag * vMag * crossSection * dragCoeff;
    return {
      x: -(velocity.x / vMag) * dragMag,
      y: -(velocity.y / vMag) * dragMag,
    };
  },

  getOrbitalElements(pos, vel, centralMass) {
    const r = magnitude(pos);
    const v = magnitude(vel);
    const mu = this.G * centralMass;

    const specificEnergy = (v * v) / 2 - mu / r;
    const specificAngularMomentum = pos.x * vel.y - pos.y * vel.x;

    const a = -mu / (2 * specificEnergy);

    const h = specificAngularMomentum;
    const eccVecX = (vel.y * h) / mu - pos.x / r;
    const eccVecY = (-vel.x * h) / mu - pos.y / r;
    const e = magnitude({ x: eccVecX, y: eccVecY });

    const inc = 0;

    const rDotV = pos.x * vel.x + pos.y * vel.y;
    const trueAnomaly = Math.acos(Math.max(-1, Math.min(1,
      (h * h / mu - r) / (e * r)
    )));

    const currentDist = r;
    const periapsis = a * (1 - e);
    const apoapsis = a * (1 + e);

    return {
      semiMajorAxis: a,
      eccentricity: e,
      inclination: inc,
      periapsis: periapsis,
      apoapsis: apoapsis,
      specificEnergy: specificEnergy,
      specificAngularMomentum: h,
      period: 2 * Math.PI * Math.sqrt((a * a * a) / mu),
      trueAnomaly: rDotV >= 0 ? trueAnomaly : 2 * Math.PI - trueAnomaly,
    };
  },

  step(rocket, body, dt) {
    const pos = rocket.position;
    const vel = rocket.velocity;
    const alt = magnitude(pos) - body.radius;
    const r = magnitude(pos);

    const gAccel = this.gravity(body.mass, r);
    const gForce = {
      x: -(pos.x / r) * gAccel,
      y: -(pos.y / r) * gAccel,
    };

    let thrustForce = { x: 0, y: 0 };
    let fuelUsed = 0;
    if (rocket.throttle > 0.01 && rocket.activeEngine && rocket.fuel > 0) {
      const engine = rocket.activeEngine;
      const angle = rocket.angle;
      const T = engine.thrust * rocket.throttle;
      thrustForce = {
        x: Math.sin(angle) * T,
        y: Math.cos(angle) * T,
      };
      fuelUsed = engine.fuelConsumption * rocket.throttle * dt;
    }

    const density = this.atmDensity(body, alt);
    const crossSection = rocket.getTotalCrossSection();
    const dragForce = this.dragForce(density, vel, crossSection, rocket.dragCoeff);

    const totalAccel = {
      x: gForce.x + (thrustForce.x / rocket.mass) + (dragForce.x / rocket.mass),
      y: gForce.y + (thrustForce.y / rocket.mass) + (dragForce.y / rocket.mass),
    };

    vel.x += totalAccel.x * dt;
    vel.y += totalAccel.y * dt;
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;

    rocket.fuel = Math.max(0, rocket.fuel - fuelUsed);

    if (rocket.fuel <= 0.01) {
      rocket.throttle = 0;
    }

    if (body.rotationPeriod) {
      const angularVel = (2 * Math.PI) / body.rotationPeriod;
      const surfaceVelMag = angularVel * body.radius;
      const surfaceDir = { x: 1, y: 0 };
    }

    if (alt < 0) {
      const penetration = -alt;
      pos.x = (pos.x / r) * body.radius;
      pos.y = (pos.y / r) * body.radius;
      vel.x *= 0.5;
      vel.y *= 0.5;
    }

    return {
      altitude: Math.max(0, alt),
      velocity: magnitude(vel),
      acceleration: magnitude(totalAccel),
      density: density,
      mach: magnitude(vel) / Math.sqrt(1.4 * 287 * (288.15 - 0.0065 * alt)),
      dynamicPressure: 0.5 * density * magnitude(vel) * magnitude(vel),
      fuelUsed: fuelUsed,
      gForce: magnitude(totalAccel) / 9.81,
    };
  },

  getOrbitPoints(pos, vel, centralMass, numPoints = 360) {
    const r = magnitude(pos);
    const v = magnitude(vel);
    const mu = this.G * centralMass;

    const h = pos.x * vel.y - pos.y * vel.x;
    const specificEnergy = (v * v) / 2 - mu / r;

    if (Math.abs(h) < 1) return [];

    const a = -mu / (2 * specificEnergy);

    const eccVecX = (vel.y * h) / mu - pos.x / r;
    const eccVecY = (-vel.x * h) / mu - pos.y / r;
    const e = magnitude({ x: eccVecX, y: eccVecY });

    if (e >= 1) {
      const points = [];
      const p = (h * h) / mu;
      for (let i = 0; i < numPoints * 2; i++) {
        const theta = -Math.PI + (i / (numPoints * 2)) * 2 * Math.PI;
        const denom = 1 + e * Math.cos(theta);
        if (Math.abs(denom) < 0.01) continue;
        const rr = p / denom;
        if (rr < 0) continue;
        points.push({ x: rr * Math.cos(theta), y: rr * Math.sin(theta) });
      }
      return points;
    }

    if (a <= 0) return [];

    const points = [];
    const angle = Math.atan2(eccVecY, eccVecX);
    for (let i = 0; i <= numPoints; i++) {
      const theta = (i / numPoints) * 2 * Math.PI;
      const rOrbit = (a * (1 - e * e)) / (1 + e * Math.cos(theta));
      const x = rOrbit * Math.cos(theta + angle);
      const y = rOrbit * Math.sin(theta + angle);
      points.push({ x, y });
      if (rOrbit < 0) break;
    }

    return points;
  },

  getSOIBoundary(body, parentBody) {
    if (!parentBody) return null;
    const a = body.orbit ? body.orbit.semiMajorAxis : 0;
    const m = body.mass;
    const M = parentBody.mass;
    return a * Math.pow(m / M, 0.4);
  },

  getBodyAtPoint(bodyList, point) {
    let minDist = Infinity;
    let nearest = null;
    for (const body of bodyList) {
      if (!body.position) continue;
      const d = dist(point, body.position);
      if (d < minDist) {
        minDist = d;
        nearest = body;
      }
    }
    return nearest;
  },
};
