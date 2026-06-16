const SOLAR_SYSTEM = {
  bodies: {},
  scaledBodies: {},

  init() {
    const bodies = {
      sun: {
        name: 'Sun',
        radius: 696340000,
        mass: 1.989e30,
        color: '#f5d742',
        glowColor: '#ffaa00',
        isStar: true,
        soi: Infinity,
        orbit: null,
        rotationPeriod: 25.4 * 86400,
        atmosphere: null,
        surfaceGravity: 274,
      },

      mercury: {
        name: 'Mercury',
        radius: 2439700,
        mass: 3.285e23,
        color: '#8c8c8c',
        isStar: false,
        soi: 112000000,
        orbit: {
          semiMajorAxis: 57909050000,
          eccentricity: 0.2056,
          inclination: 7.0,
          longitudeAscending: 48.3,
          argumentPeriapsis: 29.1,
          meanAnomaly: 174.8,
          period: 87.97 * 86400,
        },
        rotationPeriod: 58.646 * 86400,
        atmosphere: null,
        surfaceGravity: 3.7,
        hasSurface: true,
        terrainColor: '#8c8c8c',
      },

      venus: {
        name: 'Venus',
        radius: 6051800,
        mass: 4.867e24,
        color: '#d4a030',
        isStar: false,
        soi: 616000000,
        orbit: {
          semiMajorAxis: 108208000000,
          eccentricity: 0.0067,
          inclination: 3.4,
          longitudeAscending: 76.7,
          argumentPeriapsis: 54.9,
          meanAnomaly: 50.1,
          period: 224.7 * 86400,
        },
        rotationPeriod: -243.025 * 86400,
        atmosphere: {
          scaleHeight: 15900,
          seaLevelPressure: 9200000,
          seaLevelDensity: 65,
          maxHeight: 250000,
        },
        surfaceGravity: 8.87,
        hasSurface: true,
        terrainColor: '#d4a030',
        cloudColor: '#e8c060',
      },

      earth: {
        name: 'Earth',
        radius: 6371000,
        mass: 5.972e24,
        color: '#2d5a27',
        isStar: false,
        soi: 924000000,
        orbit: {
          semiMajorAxis: 149598023000,
          eccentricity: 0.0167,
          inclination: 0,
          longitudeAscending: 0,
          argumentPeriapsis: 114.2,
          meanAnomaly: 358.6,
          period: 365.25 * 86400,
        },
        rotationPeriod: 86164,
        atmosphere: {
          scaleHeight: 8500,
          seaLevelPressure: 101325,
          seaLevelDensity: 1.225,
          maxHeight: 100000,
        },
        surfaceGravity: 9.81,
        hasSurface: true,
        terrainColor: '#2d5a27',
        oceanColor: '#1a5c8a',
        cloudColor: '#ffffff',
      },

      moon: {
        name: 'Moon',
        parent: 'earth',
        radius: 1737100,
        mass: 7.342e22,
        color: '#aaaaaa',
        isStar: false,
        soi: 66200,
        orbit: {
          semiMajorAxis: 384400000,
          eccentricity: 0.0549,
          inclination: 5.15,
          longitudeAscending: 0,
          argumentPeriapsis: 0,
          meanAnomaly: 0,
          period: 27.32 * 86400,
        },
        rotationPeriod: 27.32 * 86400,
        atmosphere: null,
        surfaceGravity: 1.62,
        hasSurface: true,
        terrainColor: '#aaaaaa',
        parentBody: 'earth',
      },

      mars: {
        name: 'Mars',
        radius: 3389500,
        mass: 6.39e23,
        color: '#c1440e',
        isStar: false,
        soi: 576000000,
        orbit: {
          semiMajorAxis: 227939200000,
          eccentricity: 0.0934,
          inclination: 1.85,
          longitudeAscending: 49.6,
          argumentPeriapsis: 286.5,
          meanAnomaly: 19.4,
          period: 687 * 86400,
        },
        rotationPeriod: 88642,
        atmosphere: {
          scaleHeight: 11100,
          seaLevelPressure: 610,
          seaLevelDensity: 0.02,
          maxHeight: 50000,
        },
        surfaceGravity: 3.72,
        hasSurface: true,
        terrainColor: '#c1440e',
      },

      phobos: {
        name: 'Phobos',
        parent: 'mars',
        radius: 11200,
        mass: 1.06e16,
        color: '#887766',
        isStar: false,
        soi: 9000,
        orbit: {
          semiMajorAxis: 9376000,
          eccentricity: 0.0151,
          inclination: 1.08,
          longitudeAscending: 0,
          argumentPeriapsis: 0,
          meanAnomaly: 0,
          period: 0.32 * 86400,
        },
        rotationPeriod: 0.32 * 86400,
        atmosphere: null,
        surfaceGravity: 0.0057,
        hasSurface: true,
        terrainColor: '#887766',
        parentBody: 'mars',
      },

      deimos: {
        name: 'Deimos',
        parent: 'mars',
        radius: 6200,
        mass: 1.48e15,
        color: '#998877',
        isStar: false,
        soi: 5000,
        orbit: {
          semiMajorAxis: 23463600,
          eccentricity: 0.0002,
          inclination: 0.93,
          longitudeAscending: 0,
          argumentPeriapsis: 0,
          meanAnomaly: 0,
          period: 1.26 * 86400,
        },
        rotationPeriod: 1.26 * 86400,
        atmosphere: null,
        surfaceGravity: 0.003,
        hasSurface: true,
        terrainColor: '#998877',
        parentBody: 'mars',
      },
    };

    Object.entries(bodies).forEach(([key, body]) => {
      this.bodies[key] = body;
      body.position = { x: 0, y: 0 };
      if (body.hasSurface) {
        this.scaledBodies[key] = {
          ...body,
          displayRadius: body.radius * CONFIG.PLANET_SCALE,
          displayOrbit: body.orbit ? {
            semiMajorAxis: body.orbit.semiMajorAxis * CONFIG.PLANET_SCALE,
            eccentricity: body.orbit.eccentricity,
          } : null,
        };
      }
    });
    this.bodies.earth.position = { x: 0, y: 0 };
    this.bodies.moon.position = { x: 0, y: -384400000 };
    this.bodies.mars.position = { x: 200000000000, y: -100000000000 };
    this.bodies.venus.position = { x: -50000000000, y: -80000000000 };
    this.bodies.mercury.position = { x: 30000000000, y: 40000000000 };
    this.bodies.sun.position = { x: -149600000000, y: 0 };
  },

  getBody(name) {
    return this.bodies[name];
  },

  getBodyAtPosition(pos, activeBody, bodies) {
    let nearest = activeBody;
    let nearestDist = Infinity;
    const bodyList = bodies || Object.values(this.bodies);

    for (const body of bodyList) {
      if (!body.hasSurface && !body.isStar) continue;
      const d = dist(pos, body.position);
      const influenceRadius = body.soi || Infinity;
      if (d < influenceRadius && d < nearestDist) {
        nearestDist = d;
        nearest = body;
      }
    }
    return nearest;
  },

  updateOrbitalPositions(time) {
    for (const body of Object.values(this.bodies)) {
      if (body.orbit && !body.parent) {
        body.position = this.orbitalPosition(body.orbit, time);
      }
    }
    for (const body of Object.values(this.bodies)) {
      if (body.parent && body.orbit) {
        const parent = this.bodies[body.parent];
        if (parent && parent.position) {
          const relPos = this.orbitalPosition(body.orbit, time);
          body.position = {
            x: parent.position.x + relPos.x,
            y: parent.position.y + relPos.y,
          };
        }
      }
    }
  },

  orbitalPosition(orbit, time) {
    if (!orbit) return { x: 0, y: 0 };
    const M = ((orbit.meanAnomaly || 0) + (2 * Math.PI * time) / (orbit.period || 365.25 * 86400)) % (2 * Math.PI);
    const E = this.solveKepler(M, orbit.eccentricity || 0);
    const a = orbit.semiMajorAxis || 0;
    const e = orbit.eccentricity || 0;
    const x = a * (Math.cos(E) - e);
    const y = a * Math.sqrt(1 - e * e) * Math.sin(E);

    const argPeri = ((orbit.argumentPeriapsis || 0) * Math.PI) / 180;
    const lonAsc = ((orbit.longitudeAscending || 0) * Math.PI) / 180;
    const inc = ((orbit.inclination || 0) * Math.PI) / 180;

    const cosAP = Math.cos(argPeri);
    const sinAP = Math.sin(argPeri);
    const cosLA = Math.cos(lonAsc);
    const sinLA = Math.sin(lonAsc);
    const cosI = Math.cos(inc);
    const sinI = Math.sin(inc);

    const xPeri = x * cosAP - y * sinAP;
    const yPeri = x * sinAP + y * cosAP;

    return {
      x: xPeri * cosLA - yPeri * sinLA * cosI,
      y: xPeri * sinLA + yPeri * cosLA * cosI,
    };
  },

  solveKepler(M, e, tol = 1e-12) {
    let E = M;
    for (let i = 0; i < 100; i++) {
      const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
      E += dE;
      if (Math.abs(dE) < tol) break;
    }
    return E;
  },
};
