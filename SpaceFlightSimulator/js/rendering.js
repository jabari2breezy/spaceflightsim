class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.targetCamera = { x: 0, y: 0, zoom: 1 };
    this.stars = [];
    this.galaxies = [];
    this._initStars();
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  _initStars() {
    for (let i = 0; i < 800; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 100000,
        y: (Math.random() - 0.5) * 100000,
        size: 0.5 + Math.random() * 2,
        brightness: 0.3 + Math.random() * 0.7,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.5 + Math.random() * 2,
      });
    }
    for (let i = 0; i < 20; i++) {
      this.galaxies.push({
        x: (Math.random() - 0.5) * 100000,
        y: (Math.random() - 0.5) * 100000,
        radius: 20 + Math.random() * 100,
        angle: Math.random() * Math.PI * 2,
        color: `hsla(${200 + Math.random() * 100}, 30%, ${40 + Math.random() * 30}%, 0.3)`,
      });
    }
  }

  setTarget(x, y, zoom) {
    this.targetCamera.x = x;
    this.targetCamera.y = y;
    this.targetCamera.zoom = zoom;
  }

  updateCamera(lerpFactor = 0.05) {
    this.camera.x += (this.targetCamera.x - this.camera.x) * lerpFactor;
    this.camera.y += (this.targetCamera.y - this.camera.y) * lerpFactor;
    this.camera.zoom += (this.targetCamera.zoom - this.camera.zoom) * lerpFactor;
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.camera.x) * this.camera.zoom + this.width / 2,
      y: (wy - this.camera.y) * this.camera.zoom + this.height / 2,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.width / 2) / this.camera.zoom + this.camera.x,
      y: (sy - this.height / 2) / this.camera.zoom + this.camera.y,
    };
  }

  clear(color = CONFIG.COLORS.SPACE) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawStars(time) {
    const ctx = this.ctx;
    for (const star of this.stars) {
      const s = this.worldToScreen(star.x, star.y);
      if (s.x < -10 || s.x > this.width + 10 || s.y < -10 || s.y > this.height + 10) continue;
      const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.twinkle);
      const alpha = star.brightness * twinkle;
      const size = star.size * Math.max(0.5, Math.min(2, this.camera.zoom * 0.5));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = CONFIG.COLORS.STARS;
      ctx.beginPath();
      ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const g of this.galaxies) {
      const s = this.worldToScreen(g.x, g.y);
      const r = g.radius * this.camera.zoom * 0.1;
      if (r < 1 || r > 500) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(g.angle);
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 3; i++) {
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * (1 + i * 0.5));
        grad.addColorStop(0, g.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * (1 + i * 0.3), r * 0.3 * (1 + i * 0.3), 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  drawPlanet(body, time, hasAtmo) {
    if (!body.position) return;
    const ctx = this.ctx;
    const pos = this.worldToScreen(body.position.x, body.position.y);
    const radius = body.radius * this.camera.zoom * CONFIG.PLANET_SCALE;

    if (pos.x < -radius * 3 || pos.x > this.width + radius * 3 ||
        pos.y < -radius * 3 || pos.y > this.height + radius * 3) return;

    if (body.isStar) {
      const glowRadius = radius * 4;
      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowRadius);
      grad.addColorStop(0, 'rgba(255, 200, 50, 0.4)');
      grad.addColorStop(0.3, 'rgba(255, 150, 20, 0.15)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      const coronaGrad = ctx.createRadialGradient(pos.x, pos.y, radius, pos.x, pos.y, radius * 2);
      coronaGrad.addColorStop(0, 'rgba(255, 200, 50, 0.8)');
      coronaGrad.addColorStop(0.5, 'rgba(255, 150, 20, 0.5)');
      coronaGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = coronaGrad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (body.isStar) {
      ctx.fillStyle = body.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
      ctx.beginPath();
      ctx.arc(pos.x - radius * 0.1, pos.y - radius * 0.1, radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (hasAtmo && body.atmosphere) {
      const atmoRadius = radius * 1.05;
      const atmoGrad = ctx.createRadialGradient(pos.x, pos.y, radius * 0.8, pos.x, pos.y, atmoRadius * 1.3);
      const color = body.cloudColor || body.color || '#4a90d9';
      atmoGrad.addColorStop(0, color + '00');
      atmoGrad.addColorStop(0.5, color + '30');
      atmoGrad.addColorStop(1, color + '00');
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, atmoRadius * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    let rotAngle = 0;
    if (body.rotationPeriod) {
      rotAngle = (time / body.rotationPeriod) * Math.PI * 2;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.clip();

    const bodyGrad = ctx.createRadialGradient(
      pos.x - radius * 0.3, pos.y - radius * 0.3, 0,
      pos.x, pos.y, radius
    );
    const lightColor = this._lightenColor(body.color || body.terrainColor, 40);
    const darkColor = this._darkenColor(body.color || body.terrainColor, 40);
    bodyGrad.addColorStop(0, lightColor);
    bodyGrad.addColorStop(0.6, body.color || body.terrainColor);
    bodyGrad.addColorStop(1, darkColor);
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2);

    ctx.translate(pos.x, pos.y);
    ctx.rotate(rotAngle);

    if (body.terrainColor) {
      const terrainCount = Math.floor(radius * 0.3);
      for (let i = 0; i < terrainCount; i++) {
        const tx = (i / terrainCount - 0.5) * radius * 2;
        const ty = Math.sin(i * 3.7 + 1.2) * radius * 0.08 +
                   Math.sin(i * 7.1 + 0.5) * radius * 0.04 +
                   Math.sin(i * 13.3 + 2.1) * radius * 0.02;
        ctx.fillStyle = this._darkenColor(body.terrainColor, 10 - Math.sin(i * 5.1) * 15);
        ctx.fillRect(tx, radius * 0.85 + ty, radius * 2 / terrainCount + 1, radius * 0.2);
      }
    }

    if (body.oceanColor) {
      ctx.fillStyle = body.oceanColor;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(-radius, radius * 0.2, radius * 2, radius * 0.4);
      ctx.globalAlpha = 1;
    }

    if (body.cloudColor && body.atmosphere) {
      ctx.globalAlpha = 0.15;
      const cloudCount = Math.floor(radius * 0.15);
      for (let i = 0; i < cloudCount; i++) {
        const cx = (i / cloudCount - 0.5) * radius * 1.8;
        const cy = Math.sin(i * 2.3 + time * 0.00005) * radius * 0.7;
        const cw = radius * (0.1 + Math.sin(i * 1.7) * 0.05);
        ctx.fillStyle = body.cloudColor;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, cw * 0.5, Math.sin(i * 0.5) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    const termX = pos.x;
    const termY1 = pos.y - radius;
    const termY2 = pos.y + radius;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, Math.PI / 2, 3 * Math.PI / 2);
    ctx.fill();

    if (radius > 20) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${Math.max(10, Math.min(20, radius * 0.4))}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(body.name, pos.x, pos.y + radius + Math.max(16, radius * 0.15));
  }

  drawAtmosphericGlow(altitude, body) {
    if (!body.atmosphere || altitude > body.atmosphere.maxHeight) return;
    const c = this.ctx;
    const intensity = Math.max(0, 1 - altitude / body.atmosphere.maxHeight);
    const grad = c.createLinearGradient(0, 0, 0, this.height * (0.3 + 0.4 * intensity));
    const alpha = intensity * 0.15;

    grad.addColorStop(0, `rgba(74, 144, 217, 0)`);
    grad.addColorStop(0.3, `rgba(74, 144, 217, ${alpha})`);
    grad.addColorStop(0.6, `rgba(232, 130, 74, ${alpha * 0.5})`);
    grad.addColorStop(1, `rgba(74, 144, 217, ${alpha * 0.3})`);

    c.fillStyle = grad;
    c.fillRect(0, 0, this.width, this.height);
  }

  drawRocket(rocket, time) {
    if (!rocket.isBuilt || rocket.parts.length === 0) return;
    const ctx = this.ctx;
    const pos = this.worldToScreen(rocket.position.x, rocket.position.y);
    const scale = this.camera.zoom * CONFIG.ROCKET_SCALE;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(-rocket.angle);
    ctx.scale(scale, scale);

    const hw = 0.5;
    let currentY = 0;

    const staged = [...rocket.parts].sort((a, b) => {
      if (a.stage !== b.stage) return b.stage - a.stage;
      return a.gridY - b.gridY;
    });

    for (const part of staged) {
      switch (part.shape) {
        case 'triangle':
          this._drawNoseCone(ctx, part, hw, currentY);
          break;
        case 'trapezoid':
          this._drawEngine(ctx, part, hw, currentY);
          break;
        case 'separator':
          this._drawSeparator(ctx, part, hw, currentY);
          break;
        case 'legs':
          this._drawLandingLegs(ctx, part, hw, currentY, rocket.landingLegsDeployed);
          break;
        case 'panel':
          this._drawSolarPanel(ctx, part, hw, currentY);
          break;
        default:
          this._drawBlock(ctx, part, hw, currentY);
      }

      if (part.deployed && part.partId === 'PARACHUTE') {
        this._drawParachuteDeployed(ctx, hw, currentY);
      }

      currentY -= (part.height || 1);
    }

    ctx.restore();

    if (rocket.throttle > 0.01 && rocket.fuel > 0.01) {
      this._drawFlame(ctx, pos.x, pos.y, Math.PI / 2 - rocket.angle, rocket.throttle, scale, time);
    }
  }

  _drawNoseCone(ctx, part, hw, y) {
    ctx.fillStyle = part.color;
    ctx.beginPath();
    ctx.moveTo(0, y - (part.height || 1.5));
    ctx.lineTo(-hw * (part.width || 1), y);
    ctx.lineTo(hw * (part.width || 1), y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.05;
    ctx.stroke();
  }

  _drawBlock(ctx, part, hw, y) {
    const h = part.height || 1;
    const w = (part.width || 1) * hw;
    ctx.fillStyle = part.color;
    ctx.fillRect(-w, y - h, w * 2, h);

    if (part.type === 'fuel') {
      const fuelPct = part.fuel / (part.fuelCapacity || 1);
      if (fuelPct > 0) {
        ctx.fillStyle = 'rgba(255, 200, 50, 0.6)';
        ctx.fillRect(-w * 0.7, y - h + h * (1 - fuelPct), w * 1.4, h * fuelPct);
      }
      ctx.strokeStyle = 'rgba(200,200,200,0.5)';
      ctx.lineWidth = 0.03;
      ctx.strokeRect(-w, y - h, w * 2, h);
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.05;
    ctx.strokeRect(-w, y - h, w * 2, h);
  }

  _drawEngine(ctx, part, hw, y) {
    const h = part.height || 0.8;
    const w = (part.width || 1) * hw;
    ctx.fillStyle = part.color;
    ctx.beginPath();
    ctx.moveTo(-w, y - h);
    ctx.lineTo(-w * 1.2, y);
    ctx.lineTo(w * 1.2, y);
    ctx.lineTo(w, y - h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = part.nozzleColor || '#333';
    ctx.beginPath();
    ctx.moveTo(-w * 0.7, y - h * 0.3);
    ctx.lineTo(-w * 1.1, y + h * 0.05);
    ctx.lineTo(w * 1.1, y + h * 0.05);
    ctx.lineTo(w * 0.7, y - h * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.05;
    ctx.stroke();
  }

  _drawSeparator(ctx, part, hw, y) {
    const h = part.height || 0.3;
    const w = (part.width || 0.8) * hw;
    ctx.fillStyle = '#888';
    ctx.fillRect(-w, y - h, w * 2, h);
    ctx.fillStyle = '#666';
    ctx.fillRect(-w * 0.3, y - h, w * 0.6, h);
  }

  _drawLandingLegs(ctx, part, hw, y, deployed) {
    const h = part.height || 0.3;
    const w = (part.width || 1.5) * hw;
    ctx.fillStyle = part.color;
    ctx.fillRect(-w, y - h, w * 2, h);

    if (deployed) {
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(-w * 0.8, y);
      ctx.lineTo(-w * 1.5, y + 1.5);
      ctx.moveTo(w * 0.8, y);
      ctx.lineTo(w * 1.5, y + 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-w * 1.5, y + 1.55, 0.1, 0, Math.PI * 2);
      ctx.arc(w * 1.5, y + 1.55, 0.1, 0, Math.PI * 2);
      ctx.fillStyle = '#aa8844';
      ctx.fill();
    }
  }

  _drawSolarPanel(ctx, part, hw, y) {
    const h = part.height || 0.2;
    const w = (part.width || 1.5) * hw;
    ctx.fillStyle = '#2244aa';
    ctx.fillRect(-w, y - h, w * 2, h);
    ctx.fillStyle = '#4466cc';
    const segW = w * 2 / 4;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-w + i * segW + segW * 0.1, y - h * 0.8, segW * 0.8, h * 0.6);
    }
  }

  _drawParachuteDeployed(ctx, hw, y) {
    ctx.fillStyle = 'rgba(255, 68, 68, 0.6)';
    ctx.beginPath();
    ctx.arc(0, y - 1.5, 1.2, Math.PI, 0);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,68,68,0.8)';
    ctx.lineWidth = 0.03;
    for (let a = 0; a < 6; a++) {
      const angle = Math.PI + (a / 5) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(Math.cos(angle) * 1.2, y - 1.5);
      ctx.stroke();
    }
  }

  _drawFlame(ctx, x, y, angle, throttle, scale, time) {
    const ctx2 = ctx;
    const len = 3 * throttle * scale;
    const width = 0.6 * throttle * scale;

    ctx2.save();
    ctx2.translate(x, y);
    ctx2.rotate(angle);

    const flicker = 0.9 + 0.1 * Math.sin(time * 50 + x);
    const flicker2 = 0.95 + 0.05 * Math.sin(time * 73 + y);

    const coreLen = len * (0.4 + 0.2 * Math.sin(time * 30));
    const outerLen = len * (0.8 + 0.15 * Math.sin(time * 20 + 1));
    const trailLen = len * (1.2 + 0.2 * Math.sin(time * 15 + 2));

    const grad = ctx2.createRadialGradient(0, coreLen * 0.5, 0, 0, coreLen * 0.5, outerLen);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.2, 'rgba(255, 220, 100, 0.9)');
    grad.addColorStop(0.4, 'rgba(255, 150, 50, 0.8)');
    grad.addColorStop(0.6, 'rgba(255, 80, 20, 0.6)');
    grad.addColorStop(0.8, 'rgba(200, 40, 10, 0.3)');
    grad.addColorStop(1, 'rgba(100, 20, 5, 0)');

    ctx2.fillStyle = grad;
    ctx2.beginPath();
    ctx2.moveTo(-width * flicker, 0);
    ctx2.quadraticCurveTo(-width * 0.5 * flicker, trailLen * 0.5, 0, trailLen * flicker2);
    ctx2.quadraticCurveTo(width * 0.5 * flicker, trailLen * 0.5, width * flicker, 0);
    ctx2.closePath();
    ctx2.fill();

    const coreGrad = ctx2.createRadialGradient(0, 0, 0, 0, coreLen * 0.3, coreLen);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    coreGrad.addColorStop(0.5, 'rgba(200, 220, 255, 0.5)');
    coreGrad.addColorStop(1, 'rgba(100, 150, 255, 0)');
    ctx2.fillStyle = coreGrad;
    ctx2.beginPath();
    ctx2.moveTo(-width * 0.3 * flicker, 0);
    ctx2.quadraticCurveTo(-width * 0.15, coreLen * 0.4, 0, coreLen * flicker2);
    ctx2.quadraticCurveTo(width * 0.15, coreLen * 0.4, width * 0.3 * flicker, 0);
    ctx2.closePath();
    ctx2.fill();

    ctx2.restore();

    this._drawParticles(ctx, x, y, angle, throttle, scale, time);
  }

  _drawParticles(ctx, x, y, angle, throttle, scale, time) {
    const count = Math.floor(throttle * 15);
    for (let i = 0; i < count; i++) {
      const offset = i / count;
      const spread = (0.3 + offset * 0.7) * throttle * 2 * scale;
      const px = x + Math.sin(angle) * offset * 5 * scale + (Math.random() - 0.5) * spread;
      const py = y + Math.cos(angle) * offset * 5 * scale + (Math.random() - 0.5) * spread;
      const size = (1 - offset * 0.7) * 2 * scale;
      const alpha = (1 - offset) * 0.5;

      ctx.fillStyle = `rgba(255, ${150 - offset * 100}, ${50 - offset * 50}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.5, size), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawOrbitPath(points, color = CONFIG.COLORS.ORBIT, alpha = 1) {
    if (!points || points.length < 2) return;
    const ctx = this.ctx;
    ctx.save();

    let started = false;
    ctx.beginPath();
    for (const p of points) {
      const s = this.worldToScreen(p.x, p.y);
      if (!started) {
        ctx.moveTo(s.x, s.y);
        started = true;
      } else {
        ctx.lineTo(s.x, s.y);
      }
    }
    ctx.closePath();

    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha * 0.6;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = alpha * 0.15;
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }

  drawHUD(data, rocket) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 1;

    this._drawPanel(ctx, 10, 10, 220, 200);
    ctx.fillStyle = CONFIG.COLORS.HUD_TEXT;
    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let y = 22;

    const drawLine = (label, value, unit = '') => {
      ctx.fillStyle = '#88ffaa';
      ctx.fillText(label, 20, y);
      ctx.fillStyle = CONFIG.COLORS.HUD_TEXT;
      const val = typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value;
      ctx.fillText(`${val}${unit}`, 130, y);
      y += 16;
    };

    drawLine('ALT', data.altitude, 'm');
    drawLine('VEL', data.velocity, 'm/s');
    drawLine('AP', data.apoapsis > 0 ? data.apoapsis : '--', 'm');
    drawLine('PE', data.periapsis > 0 ? data.periapsis : '--', 'm');
    drawLine('THR', (data.throttle * 100).toFixed(0), '%');
    drawLine('FUEL', (data.fuel * 100 / (data.maxFuel || 1)).toFixed(1), '%');

    const stageNum = rocket.stages.length - rocket.currentStage;
    drawLine('STAGE', stageNum.toString());
    drawLine('G', data.gForce, 'G');
    drawLine('MASS', data.mass.toFixed(1), 't');
    drawLine('MACH', data.mach.toFixed(2), '');
    drawLine('Q', data.dynamicPressure.toFixed(1), 'Pa');
    drawLine('DP', data.density < 0.001 ? '<0.001' : data.density.toFixed(3), 'kg/m³');

    y += 8;
    const bodyName = data.currentBody ? data.currentBody.name : 'Unknown';
    ctx.fillStyle = '#88ffaa';
    ctx.fillText(`BODY: ${bodyName}`, 20, y);
    y += 16;
    if (data.currentBody && data.currentBody.atmosphere) {
      const atmoAlt = data.currentBody.atmosphere.maxHeight - data.altitude;
      ctx.fillStyle = atmoAlt > 0 ? '#ffaa44' : '#88ffaa';
      ctx.fillText(`ATMO: ${Math.max(0, atmoAlt).toFixed(0)}m`, 20, y);
    }

    if (data.currentBody && data.currentBody.atmosphere && data.altitude < data.currentBody.atmosphere.maxHeight) {
      y += 16;
      ctx.fillStyle = `rgba(255, ${200 - data.heat * 2}, ${200 - data.heat * 4}, ${Math.min(1, data.heat / 100)})`;
      ctx.fillText(`HEAT: ${data.heat.toFixed(0)}°C`, 20, y);
    }

    y += 24;
    ctx.fillStyle = '#445566';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText(`[W] Time Warp  [Space] Stage`, 20, y);
    ctx.fillText(`[A/D] Rotate  [LShift] Throttle+`, 20, y + 13);
    ctx.fillText(`[LCtrl] Throttle-  [P] Chute`, 20, y + 26);

    ctx.restore();
  }

  drawMapUI(time, rocket, body, data) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 1;

    this._drawPanel(ctx, this.width - 230, 10, 220, 120);

    ctx.fillStyle = CONFIG.COLORS.HUD_TEXT;
    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const t = time;
    const seconds = Math.floor(t % 60);
    const minutes = Math.floor((t / 60) % 60);
    const hours = Math.floor((t / 3600) % 24);
    const days = Math.floor(t / 86400);
    ctx.fillStyle = '#88ffaa';
    ctx.fillText('MISSION TIME', this.width - 220, 22);
    ctx.fillStyle = CONFIG.COLORS.HUD_TEXT;
    ctx.fillText(`${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`, this.width - 220, 38);

    ctx.fillStyle = '#88ffaa';
    ctx.fillText('ORBIT', this.width - 220, 60);
    ctx.fillStyle = CONFIG.COLORS.HUD_TEXT;
    ctx.fillText(`AP: ${data.apoapsis > 0 ? (data.apoapsis / 1000).toFixed(1) + 'km' : '--'}`, this.width - 220, 76);
    ctx.fillText(`PE: ${data.periapsis > 0 ? (data.periapsis / 1000).toFixed(1) + 'km' : '--'}`, this.width - 220, 92);

    ctx.restore();
  }

  drawStagingUI(rocket) {
    const ctx = this.ctx;
    if (!rocket || rocket.stages.length === 0) return;

    ctx.save();

    const panelX = this.width - 120;
    const panelY = this.height - 180;
    const panelW = 110;
    const panelH = rocket.stages.length * 30 + 20;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(panelX, panelY - panelH, panelW, panelH);
    ctx.strokeStyle = '#445566';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY - panelH, panelW, panelH);

    ctx.fillStyle = '#556677';
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STAGES', panelX + panelW / 2, panelY - panelH + 12);

    for (let i = 0; i < rocket.stages.length; i++) {
      const stageNum = rocket.stages[i];
      const yPos = panelY - panelH + 20 + i * 30;
      const isActive = stageNum === rocket.stages[rocket.currentStage];
      const parts = rocket.getStageParts(stageNum);

      ctx.fillStyle = isActive ? '#2a553a' : '#1a1a2a';
      ctx.fillRect(panelX + 5, yPos, panelW - 10, 26);
      ctx.strokeStyle = isActive ? '#44ff88' : '#334455';
      ctx.lineWidth = isActive ? 1.5 : 0.5;
      ctx.strokeRect(panelX + 5, yPos, panelW - 10, 26);

      ctx.fillStyle = isActive ? '#44ff88' : '#667788';
      ctx.font = '10px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Stage ${i + 1}`, panelX + panelW / 2, yPos + 10);

      const engineCount = parts.filter(p => p.type === 'engine').length;
      const fuelCount = parts.filter(p => p.type === 'fuel').length;
      ctx.fillStyle = '#8899aa';
      ctx.font = '8px "Courier New", monospace';
      ctx.fillText(`${parts.length} parts`, panelX + panelW / 2, yPos + 21);
    }

    ctx.restore();
  }

  drawBuildingUI(rocket, selectedPartId, techLevel, hoverPos) {
    const ctx = this.ctx;
    ctx.save();

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, this.width, this.height);

    this._drawBuildGrid(ctx, rocket);

    this._drawPartsPalette(ctx, selectedPartId, techLevel, hoverPos);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ROCKET BUILDER', this.width / 2, 30);

    ctx.fillStyle = '#8899aa';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('Click a part, then click on the grid to place | Right-click to remove | [B] Launch', this.width / 2, 52);

    const stats = rocket.getRocketData();
    ctx.fillStyle = '#44ff88';
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Parts: ${rocket.parts.length}`, 20, this.height - 80);
    ctx.fillText(`Mass: ${stats.mass.toFixed(1)}t`, 20, this.height - 64);
    ctx.fillText(`Thrust: ${(stats.thrust / 1000).toFixed(1)}kN`, 20, this.height - 48);

    ctx.restore();
  }

  _drawBuildGrid(ctx, rocket) {
    const gridW = 5;
    const gridH = 20;
    const cellSize = 35;
    const gridX = (this.width - gridW * cellSize) / 2;
    const gridY = this.height - 120;

    ctx.strokeStyle = 'rgba(68, 136, 170, 0.3)';
    ctx.lineWidth = 1;
    for (let x = 0; x < gridW; x++) {
      for (let y = 0; y < gridH; y++) {
        ctx.strokeRect(gridX + x * cellSize, gridY - y * cellSize, cellSize, cellSize);
      }
    }

    const centerX = gridX + 2 * cellSize;
    ctx.fillStyle = 'rgba(68, 136, 170, 0.15)';
    ctx.fillRect(centerX - cellSize / 4, gridY - gridH * cellSize, cellSize / 2, gridH * cellSize);

    for (const part of rocket.parts) {
      const px = centerX + part.gridX * cellSize;
      const py = gridY - (part.gridY) * cellSize;
      const pw = (part.width || 1) * cellSize;
      const ph = (part.height || 1) * cellSize;

      ctx.fillStyle = part.color || '#888';
      ctx.fillRect(px - pw / 2, py - ph, pw, ph);

      if (part.type === 'fuel') {
        const fuelPct = part.fuel / (part.fuelCapacity || 1);
        ctx.fillStyle = `rgba(255, 200, 50, ${0.3 + fuelPct * 0.4})`;
        ctx.fillRect(px - pw / 2 + 2, py - ph + ph * (1 - fuelPct), pw - 4, ph * fuelPct);
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px - pw / 2, py - ph, pw, ph);

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '8px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(part.stage.toString(), px, py - 3);
    }
  }

  _drawPartsPalette(ctx, selectedPartId, techLevel, hoverPos) {
    const categories = PART_CATEGORIES;
    const panelW = 200;
    const panelX = this.width - panelW - 10;
    const panelY = 70;
    let catY = panelY;

    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(panelX - 5, panelY - 5, panelW + 10, this.height - panelY - 100);
    ctx.strokeStyle = '#445566';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX - 5, panelY - 5, panelW + 10, this.height - panelY - 100);

    ctx.fillStyle = '#88aacc';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PARTS', panelX, catY);
    catY += 20;

    for (const cat of categories) {
      const catParts = Object.values(PARTS).filter(p =>
        cat.types.includes(p.type) && p.tech <= techLevel
      );
      if (catParts.length === 0) continue;

      ctx.fillStyle = '#667788';
      ctx.font = '10px "Courier New", monospace';
      ctx.fillText(cat.name, panelX, catY);
      catY += 14;

      for (const part of catParts) {
        const isSelected = selectedPartId === part.id;
        const py = catY;

        if (isSelected) {
          ctx.fillStyle = 'rgba(68, 255, 136, 0.2)';
          ctx.fillRect(panelX - 2, py - 1, panelW - 6, 20);
        }

        ctx.fillStyle = part.color || '#888';
        ctx.fillRect(panelX + 2, py + 3, 12, 12);
        ctx.strokeStyle = isSelected ? '#44ff88' : '#556677';
        ctx.lineWidth = isSelected ? 1.5 : 0.5;
        ctx.strokeRect(panelX + 2, py + 3, 12, 12);

        ctx.fillStyle = isSelected ? '#44ff88' : '#ccddee';
        ctx.font = isSelected ? 'bold 10px "Courier New", monospace' : '10px "Courier New", monospace';
        ctx.fillText(part.name, panelX + 18, py + 5);

        ctx.fillStyle = '#8899aa';
        ctx.font = '8px "Courier New", monospace';
        ctx.fillText(`${part.mass}t`, panelX + 18, py + 16);

        if (hoverPos && hoverPos.x > panelX - 2 && hoverPos.x < panelX + panelW - 8 &&
            hoverPos.y > py - 1 && hoverPos.y < py + 19) {
          this._drawPartTooltip(ctx, part, hoverPos);
        }

        catY += 22;
      }
    }
  }

  _drawPartTooltip(ctx, part, pos) {
    const tipX = Math.max(10, Math.min(this.width - 250, pos.x + 20));
    const tipY = Math.max(10, Math.min(this.height - 150, pos.y + 20));

    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(tipX, tipY, 230, 100);
    ctx.strokeStyle = '#556677';
    ctx.lineWidth = 1;
    ctx.strokeRect(tipX, tipY, 230, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(part.name, tipX + 8, tipY + 16);
    ctx.fillStyle = '#aabbcc';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText(part.description, tipX + 8, tipY + 32);
    ctx.fillStyle = '#88ccaa';
    ctx.fillText(`Mass: ${part.mass}t  Cost: $${part.cost}`, tipX + 8, tipY + 48);

    let info = '';
    if (part.thrust) info += `Thrust: ${(part.thrust / 1000).toFixed(0)}kN  `;
    if (part.fuelCapacity) info += `Fuel: ${part.fuelCapacity}  `;
    if (part.fuelConsumption) info += `Cons: ${part.fuelConsumption}/s`;
    ctx.fillStyle = '#8899aa';
    ctx.fillText(info, tipX + 8, tipY + 64);

    ctx.fillStyle = '#667788';
    ctx.font = '9px "Courier New", monospace';
    ctx.fillText(`Type: ${part.type}  Tech: ${part.tech}`, tipX + 8, tipY + 80);

    if (part.stackable) {
      ctx.fillStyle = '#88aacc';
      ctx.fillText('Stackable: Yes', tipX + 8, tipY + 93);
    }
  }

  drawTimeWarpIndicator(warpFactor) {
    if (warpFactor <= 1) return;
    const ctx = this.ctx;
    ctx.save();

    const text = `TIME WARP x${warpFactor}`;
    ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(text, this.width - 20, 20);

    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 200, 50, 0.6)';
    ctx.fillText('Press W to toggle', this.width - 20, 40);

    ctx.restore();
  }

  _drawPanel(ctx, x, y, w, h) {
    ctx.fillStyle = CONFIG.COLORS.HUD_BG;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#445566';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  _lightenColor(color, percent) {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, (num >> 16) + percent);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
    const b = Math.min(255, (num & 0x0000FF) + percent);
    return `rgb(${r},${g},${b})`;
  }

  _darkenColor(color, percent) {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.max(0, (num >> 16) - percent);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
    const b = Math.max(0, (num & 0x0000FF) - percent);
    return `rgb(${r},${g},${b})`;
  }
}
