# Celestia - Development Guide

## Overview

Celestia is a modern web-first space flight simulator built with TypeScript, React, and Babylon.js. It features realistic physics simulation, advanced spacecraft builder, and beautiful 3D visualization.

## Architecture

### Physics Engine (`src/physics/engine.ts`)

The physics engine is the heart of Celestia. It simulates:

- **N-body Gravity**: Realistic gravitational interactions between all celestial bodies
- **Atmospheric Drag**: Exponential atmosphere model with temperature effects
- **RK4 Integration**: 4th-order Runge-Kutta for accurate numerical integration
- **Orbital Mechanics**: Automatic orbit calculation and analysis

Key concepts:
```typescript
// Physics simulation step
engine.update(deltaTime, engineThrust);

// Get orbital parameters
const orbit = engine.calculateOrbit(earthBody);

// Access trajectory history
const history = engine.getTrajectoryHistory();
```

### Spacecraft System (`src/core/spacecraft.ts`)

The spacecraft system manages:

- **Part Library**: Pre-defined engines, tanks, avionics, heat shields
- **Stage Management**: Multi-stage rocket assembly
- **Calculations**: Mass, cost, deltaV, thrust-to-weight ratio
- **Validation**: Design integrity checking

Building a spacecraft:
```typescript
const builder = new SpacecraftBuilder('My Rocket');
builder.addStage();
builder.addPartToStage(0, 'merlin-1d');      // Add engine
builder.addPartToStage(0, 'rp1-tank-1');     // Add fuel tank

const deltaV = builder.calculateDeltaV();
const spacecraft = builder.build();
```

### Game Manager (`src/core/game.ts`)

Central game logic:

- **Simulation State**: Manages all game state
- **Mission System**: Create and track missions
- **Event Loop**: Coordinates physics, rendering, UI updates
- **Save/Load**: Persists game state

### Celestial Bodies (`src/core/bodies.ts`)

Pre-defined solar system or generated systems:

- **Real Bodies**: Sun, Earth, Moon, Mars, Venus, Mercury, Jupiter, Saturn
- **Realistic Physics**: Accurate masses, radii, orbital parameters
- **Atmospheric Data**: Density profiles, composition, scale heights

### UI System

Built with React and organized into:

- **Screens**: Menu, VAB (Vehicle Assembly Building), Flight
- **Components**: 
  - `PartSelector`: Browse and select spacecraft parts
  - `SpacecraftPreview`: 3D visualization of design
  - `FlightView`: Main 3D game view
  - `Telemetry`: Flight data display
  - `FlightControls`: Spacecraft control inputs

## Extending the Game

### Adding New Parts

1. Create part data in `src/core/spacecraft.ts`:

```typescript
'my-engine': {
  id: 'my-engine',
  name: 'Custom Engine',
  type: 'engine',
  dryMass: 500,
  cost: 2000,
  dimensions: { x: 1.5, y: 1.5, z: 2.5 },
  properties: {
    thrustVacuum: 1000000,
    thrustSeaLevel: 800000,
    specificImpulseVacuum: 350,
    specificImpulseSeaLevel: 280,
    maxGimbalAngle: 0.087,
  } as EngineProperties,
}
```

2. It will automatically appear in the part selector UI.

### Adding Celestial Bodies

In `src/core/bodies.ts`:

```typescript
bodies.set('jupiter', {
  id: 'jupiter',
  name: 'Jupiter',
  mass: 1.898e27,
  radius: 7.0e7,
  rotationRate: 1.758e-4,
  position: { x: 5.2 * AU, y: 0, z: 0 },
  velocity: { x: 0, y: 13070, z: 0 },
  temperature: 165,
  atmosphere: {
    density: 100,
    scaleHeight: 25000,
    composition: ['H2', 'He', 'CH4'],
  },
});
```

### Creating Missions

In the game:

```typescript
const mission = game.createMission('Moon Landing', [
  'Reach lunar orbit',
  'Descend to surface',
  'Collect samples',
  'Return to Earth',
]);
```

### Adding UI Components

1. Create component in `src/ui/components/`:

```typescript
import React from 'react';

interface MyComponentProps {
  game: CelestiaGame;
}

const MyComponent: React.FC<MyComponentProps> = ({ game }) => {
  return <div className="my-component">Hello Celestia!</div>;
};

export default MyComponent;
```

2. Add styling to `src/styles/main.css`:

```css
.my-component {
  padding: 20px;
  border: 1px solid #4CAF50;
}
```

3. Import and use in screens.

### Physics Improvements

To improve the physics engine:

1. Open `src/physics/engine.ts`
2. Modify `calculateGravitationalAcceleration()` or `calculateAtmosphericDrag()`
3. Test with various spacecraft and scenarios

Example: Add relativity correction for high velocities:

```typescript
private applyRelativisticCorrection(acceleration: Vector3): Vector3 {
  const c = 3e8; // Speed of light
  const v = magnitudeVector(this.state.velocity);
  const factor = 1 - (v * v) / (c * c);
  
  return {
    x: acceleration.x * factor,
    y: acceleration.y * factor,
    z: acceleration.z * factor,
  };
}
```

### Performance Optimization

1. **Physics**: 
   - Reduce substeps for lower precision/faster simulation
   - Use spatial partitioning for many-body systems
   - Implement LOD (level of detail) for distant bodies

2. **Graphics**:
   - Use instancing for multiple similar objects
   - Reduce viewport resolution at high time scales
   - Optimize trajectory drawing

3. **State**:
   - Limit trajectory history size
   - Use Object pools for particle effects
   - Lazy load assets

## Testing

### Manual Testing

1. Build simple rocket (engine + tank)
2. Launch to orbital altitude
3. Verify orbital velocity matches calculations
4. Test Hohmann transfer maneuvers
5. Check atmospheric drag at reentry

### Automated Tests

```bash
npm run test
```

Create tests in `__tests__/` directories matching source structure.

### Physics Validation

Compare against:
- Orbital mechanics formulae
- Real NASA missions
- KSP (Kerbal Space Program) physics
- Real spacecraft dataReady

## Code Style

- **TypeScript**: Strict mode enabled
- **React**: Functional components with hooks
- **Naming**: camelCase for functions, PascalCase for classes/components
- **Comments**: JSDoc for public APIs, inline for complex logic
- **Imports**: Organize by type (types, core, ui, utils)

## Performance Targets

- **Frame Rate**: 60 FPS in flight
- **Physics**: 100x time warp with stable orbits
- **Memory**: < 500MB for full solar system simulation
- **Load Time**: < 2 seconds on modern hardware

## Debugging

### Enable Debug Mode

```typescript
// In src/core/game.ts
const DEBUG = true;

if (DEBUG) {
  console.log('Physics state:', this.physicsEngine.getState());
  console.log('Orbital info:', this.getOrbitalInfo());
}
```

### Babylon.js Inspector

In flight screen, press `Ctrl+Shift+I` to open Babylon inspector.

### Browser DevTools

Use React DevTools for component profiling.

## Common Issues

### Spacecraft Falls Through Planet

- Check `isInsideBody()` collision detection
- Verify landing zone altitude calculation
- Ensure initial velocity isn't directed toward planet

### Orbits Decay Unexpectedly

- Check atmospheric drag calculation
- Verify physics timestep not too large
- Monitor numerical precision (use RK4, not Euler)

### Poor Performance at High Warp

- Reduce trajectory history points
- Lower graphics quality
- Increase physics substep interval

### Physics Instability

- Reduce PHYSICS_DT (shorter timestep)
- Check for division by zero
- Verify mass values are positive

## Future Enhancements

- **Multiplayer**: Network synchronization
- **Advanced Graphics**: Procedural texturing, advanced lighting
- **VR Support**: Headset integration
- **Mod System**: Plugin architecture
- **Campaign Editor**: Custom mission creation
- **Replay System**: Record and playback missions
- **Docking System**: Rendezvous and assembly
- **Advanced Flight Computer**: Programmable autopilot

## Resources

- **Physics**: NASA Orbital Mechanics Textbook
- **Graphics**: Babylon.js Documentation
- **Aerospace**: Real spacecraft design references
- **Community**: Discord, GitHub Discussions

## Getting Help

- Check existing issues on GitHub
- Ask in GitHub Discussions
- Post in Discord server
- Review similar game code (KSP mods, Orbiter)

---

Happy developing! 🚀
