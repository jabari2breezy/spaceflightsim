const game = {
  state: 'build',
  rocket: null,
  renderer: null,
  activeBody: null,
  bodies: [],
  time: 0,
  warpFactor: 1,
  warpIndex: 0,
  warpPresets: [1, 2, 5, 10, 50, 100, 1000, 10000],
  selectedPartId: null,
  techLevel: 3,
  keys: {},
  mouse: { x: 0, y: 0, worldX: 0, worldY: 0 },
  hoveredPart: null,
  info: {
    altitude: 0, velocity: 0, apoapsis: 0, periapsis: 0,
    throttle: 0, fuel: 0, maxFuel: 1, mass: 0, gForce: 0,
    mach: 0, dynamicPressure: 0, density: 0, heat: 0,
    currentBody: null,
  },
  launchSite: null,
  gameTime: 0,
  particles: [],
  mapView: false,
  gridSnap: true,
  orbitPoints: [],

  init() {
    const canvas = document.getElementById('gameCanvas');
    this.renderer = new Renderer(canvas);
    this.resize();

    window.addEventListener('resize', () => this.resize());

    SOLAR_SYSTEM.init();
    this.bodies = Object.values(SOLAR_SYSTEM.bodies).filter(b => b.hasSurface || b.isStar);
    this.activeBody = SOLAR_SYSTEM.bodies.earth;
    this.launchSite = { x: 0, y: -SOLAR_SYSTEM.bodies.earth.radius };

    this.rocket = new Rocket();
    this._setupDefaultRocket();

    this._setupInput();
    this._gameLoop();

    const loading = document.getElementById('loading');
    if (loading) {
      setTimeout(() => {
        loading.style.opacity = '0';
        setTimeout(() => { loading.style.display = 'none'; }, 500);
      }, 1500);
    }
  },

  resize() {
    const canvas = document.getElementById('gameCanvas');
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    if (this.renderer) this.renderer.resize(w, h);
  },

  _setupDefaultRocket() {
    this.rocket.clear();
    this.rocket.addPart('ENGINE_S', 0, 0);
    this.rocket.addPart('FUEL_TANK_S', 0, 1);
    this.rocket.addPart('FUEL_TANK_S', 0, 2);
    this.rocket.addPart('NOSE_CONE', 0, 3);
    this.rocket.addPart('NOSE_CONE_POINTY', 0, 4);
    this.rocket.rebuildStages();
    this.rocket.updateStats();
    this.rocket.parts.forEach(p => p.stage = 0);
    this.rocket.rebuildStages();
    this.rocket.updateStats();
  },

  _setupInput() {
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ') e.preventDefault();
      this.keys[e.key] = true;
      this._handleKey(e.key, e);
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });

    const canvas = document.getElementById('gameCanvas');
    canvas.addEventListener('mousedown', (e) => this._handleMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this._handleMouseMove(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      if (this.state === 'flight' || this.state === 'map') {
        this.renderer.targetCamera.zoom *= e.deltaY > 0 ? 0.9 : 1.1;
        this.renderer.targetCamera.zoom = Math.max(1e-10, Math.min(1000, this.renderer.targetCamera.zoom));
      }
    });
  },

  _handleKey(key, event) {
    switch (this.state) {
      case 'build':
        if ((key === 'b' || key === 'B') && this.rocket.isBuilt) {
          if (!this.rocket.parts.some(p => p.type === 'engine')) {
            alert('Rocket needs at least one engine!');
            return;
          }
          this._startFlight();
        }
        if (key === 'c' || key === 'C') this.rocket.clear();
        if (key === 'r' || key === 'R') this.selectedPartId = null;
        break;

      case 'flight':
        if (key === ' ') { event.preventDefault(); this.rocket.activateStage(); }
        if (key === 'w' || key === 'W') {
          this.warpIndex = (this.warpIndex + 1) % this.warpPresets.length;
          this.warpFactor = this.warpPresets[this.warpIndex];
        }
        if (key === 'p' || key === 'P') this.rocket.deployParachutes();
        if (key === 'l' || key === 'L') this.rocket.deployLandingLegs();
        if (key === 'm' || key === 'M') { this.mapView = !this.mapView; }
        if (key === 'c' || key === 'C') {
          if (this.renderer.camera.zoom > 0.01) {
            this.renderer.targetCamera.zoom = 0.00005;
          } else {
            this.renderer.targetCamera.zoom = 2.0;
          }
          this.warpFactor = 1;
          this.warpIndex = 0;
        }
        break;
    }
  },

  _handleMouseDown(event) {
    if (this.state !== 'build') return;
    const rect = event.target.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    const gridW = 5;
    const gridH = 20;
    const cellSize = 35;
    const gridX = (this.renderer.width - gridW * cellSize) / 2;
    const gridYPosOffset = this.renderer.height - 120;
    const centerX = gridX + 2 * cellSize;

    const onGrid = mx >= centerX - cellSize / 2 && mx <= centerX + cellSize / 2 &&
                   my >= gridYPosOffset - gridH * cellSize && my <= gridYPosOffset;

    const gridYPos = onGrid ? Math.round((gridYPosOffset - my) / cellSize) : -1;

    const existingPart = onGrid ? this.rocket.parts.find(p => p.gridY === gridYPos) : null;

    if (onGrid && existingPart && event.button === 0) {
      existingPart.stage = (existingPart.stage + 1) % 3;
      this.rocket.rebuildStages();
      this.rocket.updateStats();
      return;
    }

    if (onGrid && !existingPart && event.button === 0 && this.selectedPartId) {
      this.rocket.addPart(this.selectedPartId, 0, gridYPos);
      return;
    }

    if (onGrid && event.button === 2) {
      const partsAtPos = this.rocket.parts.filter(p => p.gridY === gridYPos);
      if (partsAtPos.length > 0) {
        this.rocket.removePart(partsAtPos[partsAtPos.length - 1].id);
      }
      return;
    }

    const panelX = this.renderer.width - 210;
    const panelY = 70;
    if (mx >= panelX && mx <= panelX + 200 && my >= panelY && my <= this.renderer.height - 110) {
      let catY = panelY;
      for (const cat of PART_CATEGORIES) {
        const catParts = Object.values(PARTS).filter(p =>
          cat.types.includes(p.type) && p.tech <= this.techLevel
        );
        if (catParts.length === 0) continue;
        catY += 14;
        for (const part of catParts) {
          if (my >= catY - 1 && my <= catY + 19) {
            this.selectedPartId = this.selectedPartId === part.id ? null : part.id;
            return;
          }
          catY += 22;
        }
      }
    }
  },

  _handleMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    this.mouse.x = event.clientX - rect.left;
    this.mouse.y = event.clientY - rect.top;

    if (this.renderer) {
      const world = this.renderer.screenToWorld(this.mouse.x, this.mouse.y);
      this.mouse.worldX = world.x;
      this.mouse.worldY = world.y;
    }
  },

  _startFlight() {
    this.state = 'flight';
    this.mapView = false;
    this.gameTime = 0;

    const earth = SOLAR_SYSTEM.bodies.earth;
    const launchLat = (Math.random() - 0.5) * 0.1;
    const launchLon = 0;
    const r = earth.radius;

    this.rocket.position = { x: 0, y: -r };
    this.rocket.velocity = { x: 0, y: 0 };
    this.rocket.angle = 0;
    this.rocket.angularVelocity = 0;
    this.rocket.throttle = 0;
    this.rocket.currentStage = 0;
    this.rocket.activeEngine = null;
    this.rocket.rebuildStages();
    this.rocket.updateStats();

    const allEngines = this.rocket.parts.filter(p => p.type === 'engine');
    if (allEngines.length > 0) {
      this.rocket.activeEngine = allEngines[0];
    }

    this.activeBody = earth;
    this.warpFactor = 1;
    this.warpIndex = 0;

    SOLAR_SYSTEM.updateOrbitalPositions(0);

    const cameraZoom = 2.0;
    const lookAhead = 300 / cameraZoom;
    this.renderer.setTarget(this.rocket.position.x, this.rocket.position.y + lookAhead, cameraZoom);
  },

  update(dt) {
    const steps = this.warpFactor;
    const simDt = dt * steps;

    for (let s = 0; s < Math.min(100, steps); s++) {
      this._updatePhysics(simDt / Math.min(100, steps));
    }

    this.gameTime += simDt;

    this._updateCamera();

    if (this.state === 'flight') {
      this._updateInfo();
      this._updateParticles(dt);
    }

    this.renderer.updateCamera(0.08);
  },

  _updatePhysics(dt) {
    if (this.state !== 'flight') return;

    const rocket = this.rocket;
    if (!this.activeBody) return;

    const dx = rocket.position.x - this.activeBody.position.x;
    const dy = rocket.position.y - this.activeBody.position.y;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    const alt = Math.max(0, distFromCenter - this.activeBody.radius);

    let nearestBody = this.activeBody;
    let nearestDist = distFromCenter;
    for (const body of this.bodies) {
      if (!body.position || body.isStar || body === this.activeBody) continue;
      const d = dist(body.position, rocket.position);
      if (d < nearestDist && d < (body.soi || Infinity)) {
        if (d < distFromCenter * 0.5) {
          nearestBody = body;
          nearestDist = d;
        }
      }
    }
    if (nearestBody !== this.activeBody) {
      this.activeBody = nearestBody;
    }

    const gAccel = CONFIG.G * this.activeBody.mass / (nearestDist * nearestDist);
    const gDirX = -dx / nearestDist;
    const gDirY = -dy / nearestDist;

    rocket.activeEngine = null;
    let thrustForce = { x: 0, y: 0 };
    if (rocket.throttle > 0.01 && rocket.fuel > 0.01) {
      const stageParts = rocket.getStageParts(rocket.stages[rocket.currentStage] || 0);
      rocket.activeEngine = stageParts.find(p => p.type === 'engine') ||
                           rocket.parts.find(p => p.type === 'engine');
      if (rocket.activeEngine) {
        const T = rocket.activeEngine.thrust * rocket.throttle;
        thrustForce = {
          x: -Math.sin(rocket.angle) * T,
          y: -Math.cos(rocket.angle) * T,
        };
        const fuelUsed = rocket.activeEngine.fuelConsumption * rocket.throttle * dt;
        rocket.fuel = Math.max(0, rocket.fuel - fuelUsed);
        let fuelRemaining = fuelUsed;
        for (const part of rocket.parts) {
          if (part.type === 'fuel' && part.fuel > 0 && fuelRemaining > 0) {
            const take = Math.min(part.fuel, fuelRemaining);
            part.fuel -= take;
            fuelRemaining -= take;
          }
        }
      }
    }

    const density = Physics.atmDensity(this.activeBody, alt);
    const vMag = magnitude(rocket.velocity);
    const crossSection = rocket.getTotalCrossSection();
    const dragMag = 0.5 * density * vMag * vMag * crossSection * rocket.dragCoeff;
    const dragDir = vMag > 0.5 ? {
      x: -(rocket.velocity.x / vMag),
      y: -(rocket.velocity.y / vMag),
    } : { x: 0, y: 0 };

    const ax = gDirX * gAccel + (thrustForce.x / Math.max(0.1, rocket.mass)) + (dragDir.x * dragMag / Math.max(0.1, rocket.mass));
    const ay = gDirY * gAccel + (thrustForce.y / Math.max(0.1, rocket.mass)) + (dragDir.y * dragMag / Math.max(0.1, rocket.mass));

    if (this.keys['a'] || this.keys['A'] || this.keys['rotateLeft']) {
      rocket.angle += 1.5 * dt;
    }
    if (this.keys['d'] || this.keys['D'] || this.keys['rotateRight']) {
      rocket.angle -= 1.5 * dt;
    }

    if (this.keys['Shift']) rocket.setThrottle(rocket.throttle + 0.8 * dt);
    if (this.keys['Control']) rocket.setThrottle(rocket.throttle - 0.8 * dt);

    rocket.velocity.x += ax * dt;
    rocket.velocity.y += ay * dt;
    rocket.position.x += rocket.velocity.x * dt;
    rocket.position.y += rocket.velocity.y * dt;

    if (alt <= 0) {
      const normX = rocket.position.x - this.activeBody.position.x;
      const normY = rocket.position.y - this.activeBody.position.y;
      const nMag = Math.sqrt(normX * normX + normY * normY);
      if (nMag > 0) {
        rocket.position.x = this.activeBody.position.x + (normX / nMag) * this.activeBody.radius;
        rocket.position.y = this.activeBody.position.y + (normY / nMag) * this.activeBody.radius;
        const radialVel = (rocket.velocity.x * normX + rocket.velocity.y * normY) / nMag;
        if (radialVel < 0) {
          if (Math.abs(radialVel) > 6) {
            this._crash(Math.abs(radialVel));
            return;
          }
          rocket.velocity.x -= (normX / nMag) * radialVel * 0.8;
          rocket.velocity.y -= (normY / nMag) * radialVel * 0.8;
        }
      }
    }

    rocket.updateStats();

    const heat = density * Math.max(0, vMag - 100) * vMag * 0.00005;
    this.info.heat += (heat - this.info.heat) * 0.05;
    if (this.info.heat > 2000 && rocket.parts.some(p => p.partId === 'HEAT_SHIELD')) {
      this.info.heat *= 0.3;
    }
    if (this.info.heat > 4500) {
      this._crash(0, 'Heat shield failure!');
    }
  },

  _updateCamera() {
    if (this.state !== 'flight') return;

    if (this.mapView) {
      const b = this.activeBody;
      const cx = b ? b.position.x : 0;
      const cy = b ? b.position.y : 0;
      this.renderer.setTarget(cx, cy, this.renderer.targetCamera.zoom);
    } else {
      const alt = this.info.altitude;
      const atmoH = this.activeBody && this.activeBody.atmosphere ? this.activeBody.atmosphere.maxHeight : 100000;
      const safeZoom = Math.max(1e-8, this.renderer.camera.zoom);
      const maxOffset = Math.min(this.renderer.height * 0.3, 250 / safeZoom);
      const altFraction = Math.min(1, alt / (atmoH * 3));
      const lookAhead = maxOffset * Math.max(0, 1 - altFraction);

      this.renderer.setTarget(
        this.rocket.position.x,
        this.rocket.position.y + lookAhead,
        this.renderer.targetCamera.zoom
      );
    }
  },

  _updateInfo() {
    if (!this.activeBody) return;

    const relPos = {
      x: this.rocket.position.x - this.activeBody.position.x,
      y: this.rocket.position.y - this.activeBody.position.y,
    };
    const r = magnitude(relPos);
    this.info.altitude = Math.max(0, r - this.activeBody.radius);
    this.info.velocity = magnitude(this.rocket.velocity);
    this.info.throttle = this.rocket.throttle;
    this.info.fuel = this.rocket.fuel;
    this.info.maxFuel = this.rocket.maxFuel;
    this.info.mass = this.rocket.mass;
    this.info.currentBody = this.activeBody;
    this.info.density = Physics.atmDensity(this.activeBody, this.info.altitude);
    this.info.mach = this.info.velocity / Math.sqrt(1.4 * 287 * Math.max(200, 288.15 - 0.0065 * this.info.altitude));
    this.info.dynamicPressure = 0.5 * this.info.density * this.info.velocity * this.info.velocity;

    const h = relPos.x * this.rocket.velocity.y - relPos.y * this.rocket.velocity.x;
    const v = this.info.velocity;
    const mu = CONFIG.G * this.activeBody.mass;
    const specificEnergy = (v * v) / 2 - mu / Math.max(r, 1);

    this.info.apoapsis = -1;
    this.info.periapsis = -1;

    if (Math.abs(h) > 1 && specificEnergy < 0) {
      const a = -mu / (2 * specificEnergy);
      if (a > 0) {
        const eccVecX = (this.rocket.velocity.y * h) / mu - relPos.x / Math.max(r, 1);
        const eccVecY = (-this.rocket.velocity.x * h) / mu - relPos.y / Math.max(r, 1);
        const e = Math.sqrt(eccVecX * eccVecX + eccVecY * eccVecY);
        if (e < 1) {
          this.info.apoapsis = a * (1 + e) - this.activeBody.radius;
          this.info.periapsis = a * (1 - e) - this.activeBody.radius;
        }
      }
    }

    if (!this._prevVel) this._prevVel = { x: 0, y: 0 };
    const dV = {
      x: this.rocket.velocity.x - this._prevVel.x,
      y: this.rocket.velocity.y - this._prevVel.y,
    };
    this.info.gForce = magnitude(dV) / 0.016 / 9.81;
    this._prevVel = { x: this.rocket.velocity.x, y: this.rocket.velocity.y };

    if (this.activeBody && this.activeBody.position) {
      this.orbitPoints = Physics.getOrbitPoints(
        relPos,
        { x: this.rocket.velocity.x, y: this.rocket.velocity.y },
        this.activeBody.mass
      );
    }
  },

  _updateParticles(dt) {
    if (!this.rocket.throttle || this.rocket.fuel <= 0) return;

    const flameAngle = Math.PI / 2 - this.rocket.angle;
    const count = Math.floor(this.rocket.throttle * 5);
    for (let i = 0; i < count; i++) {
      const speed = 10 + Math.random() * 30;
      const spread = (Math.random() - 0.5) * 0.3;
      const spawnDist = 0.3;
      this.particles.push({
        x: this.rocket.position.x + Math.cos(flameAngle) * spawnDist,
        y: this.rocket.position.y + Math.sin(flameAngle) * spawnDist,
        vx: Math.cos(flameAngle + spread) * speed + this.rocket.velocity.x * 0.1,
        vy: Math.sin(flameAngle + spread) * speed + this.rocket.velocity.y * 0.1,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 0.5 + Math.random() * 0.5,
        size: 0.5 + Math.random() * 1.5,
      });
    }

    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.size *= 0.98;
      return p.life > 0;
    });

    if (this.particles.length > 500) {
      this.particles = this.particles.slice(-500);
    }
  },

  _crash(speed, reason) {
    this.state = 'build';
    this.info.heat = 0;
    this.particles = [];
    if (reason) {
      alert(`Mission Failed: ${reason}`);
    } else {
      alert(`Mission Failed: Crashed at ${speed.toFixed(1)} m/s`);
    }
    this._setupDefaultRocket();
  },

  render() {
    const r = this.renderer;
    r.clear();

    if (this.state === 'build') {
      r.drawBuildingUI(this.rocket, this.selectedPartId, this.techLevel, this.mouse);
      return;
    }

    r.drawStars(this.gameTime);

    SOLAR_SYSTEM.updateOrbitalPositions(this.gameTime);

    if (this.mapView) {
      this._drawMapView();
    } else {
      this._drawFlightView();
    }

    r.drawHUD(this.info, this.rocket);
    r.drawMapUI(this.gameTime, this.rocket, this.activeBody, this.info);
    r.drawStagingUI(this.rocket);
    r.drawTimeWarpIndicator(this.warpFactor);

    this._drawParticles();
  },

  _drawFlightView() {
    const r = this.renderer;
    const ctx = r.ctx;

    if (this.activeBody && this.activeBody.position) {
      const alt = this.info.altitude;
      const maxAtmo = this.activeBody.atmosphere ? this.activeBody.atmosphere.maxHeight : 0;

      if (alt < maxAtmo * 2 && this.activeBody.atmosphere) {
        r.drawAtmosphericGlow(alt, this.activeBody);
      }

      const renderBodies = this.bodies.filter(b =>
        b !== this.activeBody && b.position && b.hasSurface
      );
      for (const body of this.activeBody ? [this.activeBody, ...renderBodies] : renderBodies) {
        const hasAtmo = body.atmosphere !== null;
        if (body === this.activeBody) {
          r.drawPlanet(body, this.gameTime, hasAtmo);
        } else {
          const screenPos = r.worldToScreen(body.position.x, body.position.y);
          const screenRad = body.radius * r.camera.zoom * CONFIG.PLANET_SCALE;
          if (screenPos.x > -screenRad * 2 && screenPos.x < r.width + screenRad * 2 &&
              screenPos.y > -screenRad * 2 && screenPos.y < r.height + screenRad * 2) {
            r.drawPlanet(body, this.gameTime, body.atmosphere !== null);
          }
        }
      }
    }

    if (this.orbitPoints && this.orbitPoints.length > 2 && this.activeBody && this.activeBody.position) {
      const translatedPoints = this.orbitPoints.map(p => ({
        x: p.x + this.activeBody.position.x,
        y: p.y + this.activeBody.position.y,
      }));
      r.drawOrbitPath(translatedPoints, CONFIG.COLORS.ORBIT, 0.5);
    }

    r.drawRocket(this.rocket, this.gameTime);
  },

  _drawMapView() {
    const r = this.renderer;
    const ctx = r.ctx;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, r.width, r.height);

    ctx.fillStyle = '#44ff88';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MAP VIEW', r.width / 2, 30);

    for (const body of this.bodies) {
      if (!body.position) continue;
      r.drawPlanet(body, this.gameTime, body.atmosphere !== null);
    }

    if (this.activeBody && this.activeBody.position) {
      const relPos = {
        x: this.rocket.position.x - this.activeBody.position.x,
        y: this.rocket.position.y - this.activeBody.position.y,
      };
      const orbPoints = Physics.getOrbitPoints(
        relPos,
        this.rocket.velocity,
        this.activeBody.mass,
        180
      );
      if (orbPoints.length > 2) {
        const translated = orbPoints.map(p => ({
          x: p.x + this.activeBody.position.x,
          y: p.y + this.activeBody.position.y,
        }));
        r.drawOrbitPath(translated, '#ffaa44', 0.6);
      }

      const soi = this.activeBody.soi;
      if (soi && soi < 1e12) {
        const sPos = r.worldToScreen(this.activeBody.position.x, this.activeBody.position.y);
        const sRad = soi * r.camera.zoom;
        ctx.strokeStyle = 'rgba(255,255,0,0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.arc(sPos.x, sPos.y, sRad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const rocketScreen = r.worldToScreen(this.rocket.position.x, this.rocket.position.y);
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(rocketScreen.x, rocketScreen.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _drawParticles() {
    const r = this.renderer;
    const ctx = r.ctx;

    for (const p of this.particles) {
      const s = r.worldToScreen(p.x, p.y);
      const alpha = (p.life / p.maxLife) * 0.6;
      const size = p.size * r.camera.zoom * 2;
      ctx.fillStyle = `rgba(255, ${150 + Math.floor(100 * p.life)}, ${50 + Math.floor(50 * p.life)}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.5, size), 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _gameLoop() {
    const loop = () => {
      const dt = 1 / 60;
      this.update(dt);
      this.render();
      requestAnimationFrame(loop);
    };
    loop();
  },
};

const dist = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const magnitude = (v) => {
  return Math.sqrt(v.x * v.x + v.y * v.y);
};

window.addEventListener('DOMContentLoaded', () => game.init());
