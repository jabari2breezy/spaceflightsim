import React, { useEffect, useRef } from 'react';
import { Spacecraft } from '../../types';
import { drawPart2D } from '../../utils/render2d';

interface SpacecraftPreviewProps {
  spacecraft: Spacecraft;
}

const SpacecraftPreview: React.FC<SpacecraftPreviewProps> = ({ spacecraft }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high resolution display backing
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    let animFrameId = 0;

    const render = () => {
      // Clear screen
      ctx.fillStyle = '#0B0D17';
      ctx.fillRect(0, 0, w, h);

      // Draw VAB building guidelines grid
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      const gridSize = 20;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Calculate total height of all parts
      let totalPartHeight = 0;
      spacecraft.stages.forEach((stage) => {
        stage.parts.forEach((part) => {
          totalPartHeight += part.dimensions.y;
        });
        // Add interstage gaps
        totalPartHeight += 0.5;
      });

      // Fit layout scale
      const scale = Math.min(25, (h * 0.75) / Math.max(1, totalPartHeight));
      const centerX = w / 2;
      
      // Start drawing from bottom up
      let currentY = h * 0.85;

      // Draw stages in reverse order (bottom first)
      for (let sIdx = spacecraft.stages.length - 1; sIdx >= 0; sIdx--) {
        const stage = spacecraft.stages[sIdx];
        
        // Draw parts inside this stage
        for (let pIdx = stage.parts.length - 1; pIdx >= 0; pIdx--) {
          const part = stage.parts[pIdx];
          const partW = part.dimensions.x * scale;
          const partH = part.dimensions.y * scale;

          // Draw part
          drawPart2D(ctx, part, centerX, currentY - partH / 2, partW, partH);

          // Render RCS indicator alignment
          if (part.type === 'rcs') {
            drawPart2D(ctx, part, centerX - partW * 0.6, currentY - partH / 2, partW * 0.5, partH * 0.5, 'left');
            drawPart2D(ctx, part, centerX + partW * 0.6, currentY - partH / 2, partW * 0.5, partH * 0.5, 'right');
          }

          currentY -= partH;
        }

        // Add spacer for stage decoupling
        currentY -= 0.5 * scale;
      }

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [spacecraft]);

  return (
    <div className="spacecraft-preview">
      <h3>Vehicle Preview</h3>
      <canvas ref={canvasRef} className="preview-canvas" style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
};

export default SpacecraftPreview;
