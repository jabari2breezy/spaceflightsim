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

// Map part type to integer grid sizes so everything aligns and snaps perfectly
export const getPartGridSize = (type: string): { w: number; h: number } => {
  switch (type) {
    case 'rp1-tank-1':
    case 'lh2-tank-1':
      return { w: 2, h: 3 }; // Tanks: 2 wide, 3 tall
    case 'merlin-1d':
    case 'rs-25':
      return { w: 2, h: 2 }; // Engines: 2 wide, 2 tall (perfect fit)
    case 'guidance-computer':
    case 'ablative-shield':
    case 'tank-cap-large':
    case 'interstage':
      return { w: 2, h: 1 }; // Adaptors: 2 wide, 1 tall
    case 'ion-drive':
    case 'rcs-thruster':
    case 'antenna-hga':
      return { w: 1, h: 1 }; // Utility: 1 wide, 1 tall
    case 'solar-panel':
      return { w: 1, h: 2 }; // Side attachments: 1 wide, 2 tall
    default:
      return { w: 2, h: 2 };
  }
};

const VABScreen: React.FC<VABScreenProps> = ({ onNavigate, onBuild }) => {
  const [placedParts, setPlacedParts] = useState<PlacedPart[]>([]);
  const [draggedPartType, setDraggedPartType] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null); // if dragging an already placed part
  
  const [spacecraftName, setSpacecraftName] = useState('My Custom Rocket');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{ gx: number; gy: number } | null>(null);

  const cellSize = 30;
  const gridCols = 12;
  const gridRows = 18;

  // Interactive 2D Canvas rendering loop for VAB Floor
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
      // Clear with dark blueprints color
      ctx.fillStyle = '#090B14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid blueprint lines
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
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

      // Draw placed parts on grid
      placedParts.forEach((placed) => {
        // Skip rendering if this part is actively being dragged/moved
        if (placed.id === activeDragId) return;

        const spec = PARTS_LIBRARY[placed.type];
        if (!spec) return;

        const gSize = getPartGridSize(placed.type);
        const w = gSize.w * cellSize;
        const h = gSize.h * cellSize;
        const x = gridLeft + placed.gx * cellSize + w / 2;
        const y = gridTop + placed.gy * cellSize + h / 2;

        drawPart2D(ctx, spec, x, y, w, h);
      });

      // Draw drag preview under mouse
      const activeType = draggedPartType || (activeDragId ? placedParts.find(p => p.id === activeDragId)?.type : null);
      if (activeType && hoveredCell) {
        const spec = PARTS_LIBRARY[activeType];
        if (spec) {
          const gSize = getPartGridSize(activeType);
          const w = gSize.w * cellSize;
          const h = gSize.h * cellSize;
          const x = gridLeft + hoveredCell.gx * cellSize + w / 2;
          const y = gridTop + hoveredCell.gy * cellSize + h / 2;

          ctx.save();
          ctx.globalAlpha = 0.55;
          drawPart2D(ctx, spec, x, y, w, h);
          ctx.restore();

          // Highlight green snap target outline
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 2;
          ctx.strokeRect(gridLeft + hoveredCell.gx * cellSize, gridTop + hoveredCell.gy * cellSize, w, h);
        }
      }
    };

    render();
  }, [placedParts, draggedPartType, activeDragId, hoveredCell]);

  // Handle drag coordinates calculation
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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

  // Drag and drop trigger mousedown
  const handleCanvasMouseDown = () => {
    if (!hoveredCell) return;

    // Check if clicking on an already placed part to drag/move it
    const clicked = placedParts.find((p) => {
      const gSize = getPartGridSize(p.type);
      return (
        hoveredCell.gx >= p.gx &&
        hoveredCell.gx < p.gx + gSize.w &&
        hoveredCell.gy >= p.gy &&
        hoveredCell.gy < p.gy + gSize.h
      );
    });

    if (clicked) {
      setActiveDragId(clicked.id);
      setHoveredCell({ gx: clicked.gx, gy: clicked.gy });
    }
  };

  // Drop part on mouseup
  const handleCanvasMouseUp = () => {
    if (hoveredCell) {
      if (draggedPartType) {
        // Place new part dragged from panel
        const newPart: PlacedPart = {
          id: `${draggedPartType}-${Date.now()}`,
          type: draggedPartType,
          gx: hoveredCell.gx,
          gy: hoveredCell.gy,
        };
        setPlacedParts((prev) => [...prev, newPart]);
        setDraggedPartType(null);
      } else if (activeDragId) {
        // Drop already placed part onto new snap location
        setPlacedParts((prev) =>
          prev.map((p) =>
            p.id === activeDragId
              ? { ...p, gx: hoveredCell.gx, gy: hoveredCell.gy }
              : p
          )
        );
        setActiveDragId(null);
      }
    } else {
      // If dropped outside grid, delete/cancel drag
      if (activeDragId) {
        setPlacedParts((prev) => prev.filter((p) => p.id !== activeDragId));
        setActiveDragId(null);
      }
      setDraggedPartType(null);
    }
  };

  // Start dragging from palette
  const handlePaletteStartDrag = (type: string) => {
    setDraggedPartType(type);
  };

  // Compile placed parts list into sequential Stages spacecraft object
  const compileSpacecraft = () => {
    if (placedParts.length === 0) {
      alert('Grid is empty! Drag some parts on to build a rocket.');
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
            Click & Drag Rocket Builder (Standardized Grid System)
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
            onClick={compileSpacecraft}
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
            DRAG PALETTE
          </h3>
          <p style={{ fontSize: '11px', color: '#64748B', marginBottom: '15px' }}>
            Hold & drag parts from here directly onto the grid. Drag placed parts inside the grid to reposition them. Drop off-grid to delete.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.values(PARTS_LIBRARY).map((part) => (
              <div
                key={part.id}
                onMouseDown={() => handlePaletteStartDrag(part.id)}
                style={{
                  padding: '12px',
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '6px',
                  cursor: 'grab',
                  userSelect: 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#FFF' }}>{part.name}</div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                  Grid Size: {getPartGridSize(part.id).w}x{getPartGridSize(part.id).h}
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
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={handleCanvasMouseUp}
            style={{ width: '100%', height: '100%', cursor: (draggedPartType || activeDragId) ? 'grabbing' : 'default' }}
          />

          {(draggedPartType || activeDragId) && (
            <div style={{
              position: 'absolute',
              bottom: '20px',
              backgroundColor: '#10B981',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#FFF',
              fontWeight: 'bold'
            }}>
              Dragging Part... Release over the grid to snap place!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VABScreen;
