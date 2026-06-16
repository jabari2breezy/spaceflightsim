import { SpacecraftPart, CelestialBodyData } from '../types';

/**
 * Renders a single rocket part in 2D on a Canvas context
 */
export function drawPart2D(
  ctx: CanvasRenderingContext2D,
  part: SpacecraftPart,
  x: number, // center X of part
  y: number, // center Y of part
  w: number, // width of part
  h: number, // height of part
  rcsDirection: 'left' | 'right' | null = null,
  throttle: number = 0
): void {
  ctx.save();

  // Draw part based on its type
  switch (part.type) {
    case 'engine':
      // Draw engine mount
      ctx.fillStyle = '#4A4A4A';
      ctx.fillRect(x - w / 2, y - h / 2, w, h * 0.2);

      // Draw combustion chamber / bell
      ctx.fillStyle = '#2B2B2B';
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.3, y - h * 0.3);
      ctx.lineTo(x + w * 0.3, y - h * 0.3);
      ctx.lineTo(x + w * 0.5, y + h * 0.5);
      ctx.lineTo(x - w * 0.5, y + h * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw exhaust nozzle rim
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(x - w * 0.52, y + h * 0.4, w * 1.04, h * 0.1);

      // Draw thrust flame if throttle > 0
      if (throttle > 0) {
        ctx.save();
        const plumeHeight = h * 1.5 * throttle * (0.9 + Math.random() * 0.2);
        const grad = ctx.createLinearGradient(x, y + h * 0.5, x, y + h * 0.5 + plumeHeight);
        
        // Inner hot core
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.2, '#FFDD66');
        grad.addColorStop(0.5, '#FF8822');
        grad.addColorStop(1, 'rgba(255, 34, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.4, y + h * 0.5);
        ctx.quadraticCurveTo(x, y + h * 0.5 + plumeHeight * 0.8, x + w * 0.4, y + h * 0.5);
        ctx.lineTo(x, y + h * 0.5 + plumeHeight);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;

    case 'tank':
      // Tank cylinder body
      ctx.fillStyle = '#E5E5E5';
      ctx.fillRect(x - w / 2, y - h / 2, w, h);

      // Draw ribbed metallic textures (horizontal lines)
      ctx.strokeStyle = '#CCCCCC';
      ctx.lineWidth = 1;
      const ribs = 4;
      for (let i = 1; i < ribs; i++) {
        const lineY = y - h / 2 + (h / ribs) * i;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, lineY);
        ctx.lineTo(x + w / 2, lineY);
        ctx.stroke();
      }

      // Draw left/right vertical borders for 3D rounded look
      const sideGrad = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
      sideGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
      sideGrad.addColorStop(0.15, 'rgba(0,0,0,0.0)');
      sideGrad.addColorStop(0.85, 'rgba(255,255,255,0.0)');
      sideGrad.addColorStop(1, 'rgba(255,255,255,0.25)');
      ctx.fillStyle = sideGrad;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);

      // Draw outline
      ctx.strokeStyle = '#444444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      break;

    case 'avionics':
      // Guidance Computer box
      ctx.fillStyle = '#222225';
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);

      // LED blinkers
      const blink = Math.floor(Date.now() / 250) % 2 === 0;
      ctx.fillStyle = blink ? '#00FF66' : '#003311';
      ctx.beginPath();
      ctx.arc(x - w * 0.25, y, w * 0.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = !blink ? '#FF3300' : '#330000';
      ctx.beginPath();
      ctx.arc(x + w * 0.25, y, w * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'heatshield':
      // Thick curved shield block at the bottom
      ctx.fillStyle = '#3E2723';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y - h / 2);
      ctx.lineTo(x + w * 0.5, y - h / 2);
      ctx.quadraticCurveTo(x, y + h * 1.2, x - w * 0.5, y - h / 2);
      ctx.closePath();
      ctx.fill();

      // Top adapter rim
      ctx.fillStyle = '#2D1510';
      ctx.fillRect(x - w * 0.45, y - h / 2, w * 0.9, h * 0.2);
      break;

    case 'solar':
      // Retracted or extended solar panels
      // Main attachment hinge
      ctx.fillStyle = '#555';
      ctx.fillRect(x - w * 0.1, y - h / 2, w * 0.2, h);

      // Solar arrays (blue grid panels left and right)
      ctx.fillStyle = '#0D47A1';
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1;
      
      // Left panel
      ctx.fillRect(x - w / 2, y - h * 0.4, w * 0.38, h * 0.8);
      ctx.strokeRect(x - w / 2, y - h * 0.4, w * 0.38, h * 0.8);

      // Right panel
      ctx.fillRect(x + w * 0.12, y - h * 0.4, w * 0.38, h * 0.8);
      ctx.strokeRect(x + w * 0.12, y - h * 0.4, w * 0.38, h * 0.8);
      break;

    case 'antenna':
      // Dish structure
      ctx.strokeStyle = '#CCCCCC';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y + h * 0.2, w * 0.4, Math.PI, 0);
      ctx.stroke();

      // Transceiver pole
      ctx.fillStyle = '#888';
      ctx.fillRect(x - w * 0.04, y - h * 0.5, w * 0.08, h * 0.7);

      // Signal wave arc
      const wave = Math.floor(Date.now() / 400) % 3;
      ctx.strokeStyle = 'rgba(0, 229, 255, ' + (1 - wave * 0.3) + ')';
      ctx.beginPath();
      ctx.arc(x, y - h * 0.6, w * 0.1 * (wave + 1), Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
      break;

    case 'rcs':
      // Simple side block
      ctx.fillStyle = '#616161';
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = '#333';
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);

      // Nozzles
      ctx.fillStyle = '#111';
      ctx.fillRect(x - w * 0.6, y - h * 0.2, w * 0.2, h * 0.4);
      ctx.fillRect(x + w * 0.4, y - h * 0.2, w * 0.2, h * 0.4);

      // Active thruster puff
      if (rcsDirection) {
        ctx.save();
        ctx.fillStyle = 'rgba(240, 248, 255, 0.8)';
        ctx.beginPath();
        if (rcsDirection === 'left') {
          ctx.arc(x - w * 0.9, y, w * 0.5 * (0.8 + Math.random() * 0.4), 0, Math.PI * 2);
        } else {
          ctx.arc(x + w * 0.9, y, w * 0.5 * (0.8 + Math.random() * 0.4), 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      }
      break;

    case 'structure':
    default:
      // Truss frame structure
      ctx.fillStyle = '#757575';
      ctx.fillRect(x - w / 2, y - h / 2, w, h * 0.1);
      ctx.fillRect(x - w / 2, y + h * 0.4, w, h * 0.1);

      // Diagonal cross brace lines
      ctx.strokeStyle = '#757575';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - h / 2);
      ctx.lineTo(x + w / 2, y + h / 2);
      ctx.moveTo(x + w / 2, y - h / 2);
      ctx.lineTo(x - w / 2, y + h / 2);
      ctx.stroke();
      break;
  }

  ctx.restore();
}

/**
 * Draw 2D Planetary Body (Earth, Moon, Mars, Sun)
 */
export function drawCelestialBody2D(
  ctx: CanvasRenderingContext2D,
  body: CelestialBodyData,
  screenX: number,
  screenY: number,
  radiusPx: number
): void {
  ctx.save();

  const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radiusPx);

  if (body.id === 'earth') {
    grad.addColorStop(0, '#1E40AF'); // Deep Blue Core
    grad.addColorStop(0.75, '#3B82F6'); // Light Blue Surface
    grad.addColorStop(0.9, '#60A5FA'); // High Atmosphere
    grad.addColorStop(1, 'rgba(96, 165, 250, 0)'); // Glow edge
  } else if (body.id === 'moon') {
    grad.addColorStop(0, '#666666'); // Dark lunar surface
    grad.addColorStop(0.7, '#888888'); // Lunar gray
    grad.addColorStop(1, '#AAAAAA'); // Light dust
  } else if (body.id === 'sun') {
    grad.addColorStop(0, '#FFFFFF'); // Hot white center
    grad.addColorStop(0.4, '#FBBF24'); // Sun Gold
    grad.addColorStop(0.8, '#F97316'); // Corona Orange
    grad.addColorStop(1, 'rgba(249, 115, 22, 0)'); // Corona glow
  } else if (body.id === 'mars') {
    grad.addColorStop(0, '#7C2D12'); // Dark red center
    grad.addColorStop(0.8, '#EA580C'); // Mars rust orange
    grad.addColorStop(1, '#F97316');
  } else {
    grad.addColorStop(0, '#555');
    grad.addColorStop(0.8, '#777');
    grad.addColorStop(1, '#999');
  }

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(screenX, screenY, radiusPx, 0, Math.PI * 2);
  ctx.fill();

  // Add crater textures on the Moon
  if (body.id === 'moon' && radiusPx > 10) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.arc(screenX - radiusPx * 0.3, screenY - radiusPx * 0.2, radiusPx * 0.2, 0, Math.PI * 2);
    ctx.arc(screenX + radiusPx * 0.4, screenY + radiusPx * 0.3, radiusPx * 0.15, 0, Math.PI * 2);
    ctx.arc(screenX - radiusPx * 0.2, screenY + radiusPx * 0.4, radiusPx * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
