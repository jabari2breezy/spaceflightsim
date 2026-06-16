import React, { useState, useEffect, useRef } from 'react';
import { Screen } from '../../App';
import { PARTS_LIBRARY } from '../../core/spacecraft';
import { SpacecraftPart, Spacecraft, Stage } from '../../types';
import { drawPart2D } from '../../utils/render2d';

interface VABScreenProps {
  onNavigate: (screen: Screen) => void;
  onBuild: (spacecraft: Spacecraft) => void;
}

interface PlacedPart {
  id: string;
  type: string;
  gx: number; // grid x position
  gy: number; // grid y position
}

const VABScreen: React.FC<VABScreenProps> = ({ onNavigate, onBuild }) => {
  const [placedParts, setPlacedParts] = useState<PlacedPart[]>([]);
  const [heldPartId, setHeldPartId] = useState<string | null>(null);
  const [spacecraftName, setSpacecraftName] = useState('My Custom Rocket');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredCell, setHoveredCell] = useState<{ gx: number; gy: number } | null>(null);

  const cellSize = 30;
  const gridCols = 10;
  const gridRows = 16;

  // Interactive 2D Canvas rendering loop for the Build Grid
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const gridWidth = gridCols * cellSize;
    const gridHeight = gridRows * cellSize;
    const gridLeft = (canvas.width - gridWidth) / 2;
    const gridTop = (canvas.height - gridHeight) / 2;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#0B0D19';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw snapping grid dots/cells
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;

      for (let c = 0; c <= gridCols; c++) {
        const x = gridLeft + c * cellSize;
        ctx.beginPath();
        ctx.moveTo(x, gridTop);
        ctx.lineTo(x, gridTop + gridHeight);
        ctx.stroke();
      }

      for (let r = 0; r <= gridRows; r++) {
        const y = gridTop + r * cellSize;
        ctx.beginPath();
        ctx.moveTo(gridLeft, y);
        ctx.lineTo(gridLeft + gridWidth, y);
        ctx.stroke();
      }

      // Draw placed parts on the grid
      placedParts.forEach((placed) => {
        const spec = PARTS_LIBRARY[placed.type];
        if (!spec) return;

        const w = spec.dimensions.x * cellSize;
        const h = spec.dimensions.y * cellSize;
        const x = gridLeft + placed.gx * cellSize + w / 2;
        const y = gridTop + placed.gy * cellSize + h / 2;

        drawPart2D(ctx, spec, x, y, w, h);
      });

      // Draw ghost preview of the held part under the cursor
      if (heldPartId && hoveredCell) {
        const spec = PARTS_LIBRARY[heldPartId];
        if (spec) {
          const w = spec.dimensions.x * cellSize;
          const h = spec.dimensions.y * cellSize;
          const x = gridLeft + hoveredCell.gx * cellSize + w / 2;
          const y = gridTop + hoveredCell.gy * cellSize + h / 2;

          ctx.save();
          ctx.globalAlpha = 0.55;
          drawPart2D(ctx, spec, x, y, w, h);
          ctx.restore();

          // Green snap guide border
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 2;
          ctx.strokeRect(gridLeft + hoveredCell.gx * cellSize, gridTop + hoveredCell.gy * cellSize, w, h);
        }
      }
    };

    render();
  }, [placedParts, heldPartId, hoveredCell]);

  // Track mouse coordinates
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    const gridWidth = gridCols * cellSize;
    const gridHeight = gridRows * cellSize;
    const gridLeft = (canvas.width - gridWidth) / 2;
    const gridTop = (canvas.height - gridHeight) / 2;

    const gx = Math.floor((x - gridLeft) / cellSize);
    const gy = Math.floor((y - gridTop) / cellSize);

    if (gx >= 0 && gx < gridCols && gy >= 0 && gy < gridRows) {
      setHoveredCell({ gx, gy });
    } else {
      setHoveredCell(null);
    }
  };

  // Snapped placement click handler
  const handleCanvasClick = () => {
    if (!hoveredCell) return;

    if (heldPartId) {
      // Place the held part on the grid snapping target
      const spec = PARTS_LIBRARY[heldPartId];
      if (spec) {
        const newPart: PlacedPart = {
          id: `${heldPartId}-${Date.now()}`,
          type: heldPartId,
          gx: hoveredCell.gx,
          gy: hoveredCell.gy,
        };
        setPlacedParts((prev) => [...prev, newPart]);
        setHeldPartId(null); // release held part
      }
    } else {
      // If clicking an already placed part on the grid, pick it up (move back to held)
      const clicked = placedParts.find(
        (p) =>
          hoveredCell.gx >= p.gx &&
          hoveredCell.gx < p.gx + (PARTS_LIBRARY[p.type]?.dimensions.x || 1) &&
          hoveredCell.gy >= p.gy &&
          hoveredCell.gy < p.gy + (PARTS_LIBRARY[p.type]?.dimensions.y || 1)
      );

      if (clicked) {
        setHeldPartId(clicked.type);
        setPlacedParts((prev) => prev.filter((p) => p.id !== clicked.id));
      }
    }
  };

  // Compile placed parts into a staging rocket spacecraft object
  const launchRocket = () => {
    if (placedParts.length === 0) {
      alert('Your build grid is empty! Place some parts first.');
      return;
    }

    // Sort parts from bottom to top (highest gy down to lowest gy)
    const sorted = [...placedParts].sort((a, b) => b.gy - a.gy);
    const stages: Stage[] = [];
    let currentStageParts: SpacecraftPart[] = [];
    let currentStageNum = 1;

    sorted.forEach((p) => {
      const template = PARTS_LIBRARY[p.type];
      if (!template) return;

      const partInst: SpacecraftPart = {
        ...template,
        id: `${template.id}-${Date.now()}-${Math.random()}`,
      };

      currentStageParts.push(partInst);

      // Interstages / decouplers close a stage and split staging order
      if (template.id === 'interstage' || template.type === 'structure') {
        stages.push({
          number: currentStageNum++,
          parts: currentStageParts,
          active: false,
        });
        currentStageParts = [];
      }
    });

    if (currentStageParts.length > 0) {
      stages.push({
        number: currentStageNum,
        parts: currentStageParts,
        active: false,
      });
    }

    // Standardize stages (reverse so lower stage is active first)
    stages.reverse();
    stages.forEach((st, idx) => {
      st.number = idx + 1;
    });

    const totalMass = stages.reduce(
      (m, st) =>
        m +
        st.parts.reduce(
          (pm, pt) => pm + pt.dryMass + (pt.properties.capacity || 0),
          0
        ),
      0
    );

    const spacecraft: Spacecraft = {
      id: `sc-${Date.now()}`,
      name: spacecraftName,
      stages,
      mass: totalMass,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    };

    onBuild(spacecraft);
    onNavigate('flight');
  };

  return (
    <div className="vab-screen" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#05070F',
      color: '#FFF',
      fontFamily: 'sans-serif'
    }}>
      {/* VAB Header */}
      <div style={{
        padding: '15px 30px',
        backgroundColor: '#0F172A',
        borderBottom: '1px solid #1E293B',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <input
            type="text"
            value={spacecraftName}
            onChange={(e) => setSpacecraftName(e.target.value)}
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid #334155',
              color: '#00E5FF',
              padding: '2px 5px',
              outline: 'none'
            }}
          />
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
            Snapping Assembly Builder
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            onClick={() => setPlacedParts([])}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1E293B',
              color: '#FFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            CLEAR GRID
          </button>
          
          <button
            onClick={launchRocket}
            style={{
              padding: '8px 20px',
              backgroundColor: '#10B981',
              color: '#FFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)'
            }}
          >
            LAUNCH MISSION
          </button>
        </div>
      </div>

      {/* Main assembly floor */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Parts palette on the left */}
        <div style={{
          width: '280px',
          backgroundColor: '#0A0F1D',
          borderRight: '1px solid #1E293B',
          padding: '20px',
          overflowY: 'auto'
        }}>
          <h3 style={{ borderBottom: '1px solid #1E293B', paddingBottom: '8px', color: '#00E5FF', fontSize: '14px', letterSpacing: '1px' }}>
            PART PALETTE
          </h3>
          <p style={{ fontSize: '11px', color: '#64748B', marginBottom: '15px' }}>
            Click a part to pick it up, then click on the grid area to place and click it in.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.values(PARTS_LIBRARY).map((part) => (
              <div
                key={part.id}
                onClick={() => setHeldPartId(part.id)}
                style={{
                  padding: '10px',
                  backgroundColor: heldPartId === part.id ? '#1E293B' : '#0F172A',
                  border: heldPartId === part.id ? '1px solid #00E5FF' : '1px solid #1E293B',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#FFF' }}>{part.name}</div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                  Type: {part.type} | Mass: {part.dryMass}kg
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Snapping Grid Canvas Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#030712',
          position: 'relative'
        }}>
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onClick={handleCanvasClick}
            style={{ width: '100%', height: '100%', cursor: heldPartId ? 'crosshair' : 'default' }}
          />

          {heldPartId && (
            <div style={{
              position: 'absolute',
              bottom: '20px',
              backgroundColor: 'rgba(239, 68, 68, 0.85)',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#FFF'
            }}>
              Holding Part. Click grid to snap place, right-click/escape to cancel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VABScreen;
